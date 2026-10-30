// Banc d'essai local : fait tourner le Worker sous Node avec des imitations de R2 (disque) et D1 (SQLite).
// Usage : node test/devserver.mjs [port] [dossier-données]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";

// ---------- FixedLengthStream (natif dans Workers) ----------
globalThis.FixedLengthStream = class {
  constructor(n) {
    let seen = 0;
    const ts = new TransformStream({
      transform(chunk, c) { seen += chunk.byteLength; if (seen > n) c.error(new Error("FixedLengthStream overflow")); else c.enqueue(chunk); },
      flush(c) { if (seen !== n) c.error(new Error(`FixedLengthStream: ${seen} != ${n}`)); },
    });
    this.readable = ts.readable; this.writable = ts.writable; this.readable.__len = n;
  }
};

// ---------- R2 ----------
class R2 {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); this.mpu = new Map(); }
  f(key) { return path.join(this.dir, encodeURIComponent(key)); }
  meta(key) { try { return JSON.parse(fs.readFileSync(this.f(key) + ".meta")); } catch { return null; } }
  async bytesOf(body) {
    if (body == null) return Buffer.alloc(0);
    if (typeof body === "string") return Buffer.from(body);
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return Buffer.from(body.buffer ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : body);
    const chunks = []; for await (const c of body) chunks.push(Buffer.from(c)); return Buffer.concat(chunks);
  }
  async put(key, body, opts = {}) {
    const b = await this.bytesOf(body);
    fs.writeFileSync(this.f(key), b);
    const m = { key, size: b.length, etag: crypto.createHash("md5").update(b).digest("hex"), httpMetadata: opts.httpMetadata || {} };
    fs.writeFileSync(this.f(key) + ".meta", JSON.stringify(m));
    return m;
  }
  obj(key, range) {
    const m = this.meta(key); if (!m) return null;
    const start = range ? range.offset : 0, len = range ? range.length : m.size;
    const file = this.f(key);
    return {
      ...m, size: m.size,
      get body() { return Readable.toWeb(fs.createReadStream(file, { start, end: start + len - 1, highWaterMark: 64 * 1024 })); },
      async arrayBuffer() { const b = fs.readFileSync(file); return b.buffer.slice(b.byteOffset + start, b.byteOffset + start + len); },
    };
  }
  async get(key, opts = {}) { return this.obj(key, opts.range); }
  async head(key) { const m = this.meta(key); return m ? { ...m } : null; }
  async delete(keys) { for (const k of [].concat(keys)) { try { fs.unlinkSync(this.f(k)); fs.unlinkSync(this.f(k) + ".meta"); } catch {} } }
  async list({ prefix = "", cursor, limit = 1000 } = {}) {
    const all = fs.readdirSync(this.dir).filter(n => n.endsWith(".meta")).map(n => decodeURIComponent(n.slice(0, -5))).filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? +cursor : 0, page = all.slice(start, start + limit);
    return { objects: page.map(k => ({ key: k, size: this.meta(k).size })), truncated: start + limit < all.length, cursor: String(start + limit) };
  }
  async createMultipartUpload(key, opts = {}) { const uploadId = crypto.randomUUID(); this.mpu.set(uploadId, { key, opts, parts: new Map() }); return { key, uploadId }; }
  resumeMultipartUpload(key, uploadId) {
    const r2 = this;
    return {
      async uploadPart(n, body) { const u = r2.mpu.get(uploadId); if (!u) throw new Error("no such upload"); const b = await r2.bytesOf(body); const etag = crypto.createHash("md5").update(b).digest("hex"); u.parts.set(n, { b, etag }); return { partNumber: n, etag }; },
      async complete(parts) { const u = r2.mpu.get(uploadId); const bufs = parts.sort((a, b) => a.partNumber - b.partNumber).map(p => { const x = u.parts.get(p.partNumber); if (!x || x.etag !== p.etag) throw new Error("bad part " + p.partNumber); return x.b; }); r2.mpu.delete(uploadId); return r2.put(key, Buffer.concat(bufs), u.opts); },
      async abort() { r2.mpu.delete(uploadId); },
    };
  }
}

// ---------- D1 ----------
const norm = v => v === undefined ? (() => { throw new Error("D1_TYPE_ERROR: undefined") })() : typeof v === "boolean" ? (v ? 1 : 0) : v;
class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.db, this.sql, a.map(norm)); }
  async first(col) { const r = this.db.prepare(this.sql).get(...this.args); return r ? (col ? r[col] : { ...r }) : null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args).map(r => ({ ...r })), success: true }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}
class D1 {
  constructor(file) { this.db = new DatabaseSync(file); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) {
    this.db.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(/^\s*select/i.test(s.sql) ? await s.all() : await s.run()); this.db.exec("COMMIT"); return out; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  exec(sql) { this.db.exec(sql); }
}

// ---------- serveur ----------
const port = +(process.argv[2] || 8787);
const dataDir = process.argv[3] || path.resolve("test/.data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new D1(path.join(dataDir, "db.sqlite"));
db.exec(fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const env = {
  DB: db, BUCKET: new R2(path.join(dataDir, "r2")),
  SITE_ORIGIN: process.env.SITE_ORIGIN || "http://localhost:8765", DEV_ORIGINS: process.env.DEV_ORIGINS || "http://127.0.0.1:8765",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "motdepasse-de-test", SIGNING_KEY: process.env.SIGNING_KEY || "cle-de-signature-de-test-0123456789abcdef",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT: process.env.AWS_ENDPOINT, AWS_REGION: "ca-central-1",
  SINGLE_MAX: process.env.SINGLE_MAX, PART_SIZE: process.env.PART_SIZE,
};
const worker = (await import("../src/index.js")).default;
const pending = new Set();
http.createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host}${req.url}`;
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: "half" });
    const ctx = { waitUntil(p) { const x = Promise.resolve(p).catch(e => console.error("waitUntil:", e)); pending.add(x); x.finally(() => pending.delete(x)); } };
    const r = await worker.fetch(request, env, ctx);
    const headers = Object.fromEntries(r.headers);
    if (r.body && r.body.__len != null) headers["content-length"] = String(r.body.__len);
    if (hasBody) headers["connection"] = "close"; // Node ne peut pas vider un corps non lu une fois converti en flux web
    res.writeHead(r.status, headers);
    if (r.body) Readable.fromWeb(r.body).on("error", e => { console.error("stream:", e.message); res.destroy(e); }).pipe(res); else res.end();
  } catch (e) { console.error(e); res.writeHead(500); res.end("harness error"); }
}).listen(port, "127.0.0.1", () => console.log(`worker on http://127.0.0.1:${port} data=${dataDir}`));

// Point d'entrée de la tâche quotidienne : GET /__cron
http.createServer(async (_req, res) => { const { cleanup } = await import("../src/index.js"); res.end(JSON.stringify(await cleanup(env))); }).listen(port + 1, "127.0.0.1");
