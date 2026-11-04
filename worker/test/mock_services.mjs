// Imitations locales de GitHub (API contents), Resend et Turnstile pour les tests. node test/mock_services.mjs 9922
import http from "node:http";
// Dépôt imité : branches → commits → instantané des fichiers { sha, content (base64) }. API contents + git data (blobs, trees, commits, refs).
let n = 0;
const calls = [];
const sha = () => "sha" + (++n).toString(16).padStart(6, "0");
const commits = new Map(), trees = new Map(), blobs = new Map(), branches = {};
const B = s => Buffer.from(s).toString("base64");
function mkCommit(parent, files, message = "") { const id = "c" + sha(); commits.set(id, { parent, files, message, tree: "t" + id }); trees.set("t" + id, files); return id; }
const files0 = new Map();
const put0 = (m, path, text) => m.set(path, { sha: sha(), content: B(text) });
put0(files0, "content/portfolio.json", JSON.stringify({ chapters: [{ id: "soirees", name: { fr: "La nuit", en: "Nightlife" }, projects: [{ id: "bashment", title: "The Bashment", eds: [{ year: "2025", imgs: [1, 2, 3] }] }] }] }));
put0(files0, "content/home.json", JSON.stringify({ hero: [4], about: [5], wall: [6], me: 7, heroLab: {}, cap: {} }));
put0(files0, "content/site.json", JSON.stringify({ email: "baeypro@gmail.com", api: "" }));
put0(files0, "meta.json", "{" + [1, 2, 3, 4, 5, 6, 7].map(i => `"${i}": {"w": 1200, "h": 1800, "q": "x"}`).join(", ") + "}");
put0(files0, "hashes.json", '{"1": 13562375111192815399, "2": 511758639232857308, "3": 4, "4": 8, "5": 16, "6": 32, "7": 64}');
// MOCK_CONTENT=<dossier> : sert les vrais fichiers content/*.json, meta.json et hashes.json (essai de l'administration).
if (process.env.MOCK_CONTENT) {
  const fs = await import("node:fs");
  for (const f of ["portfolio", "home", "site"]) files0.set(`content/${f}.json`, { sha: sha(), content: fs.readFileSync(`${process.env.MOCK_CONTENT}/${f}.json`).toString("base64") });
  for (const f of ["meta.json", "hashes.json"]) if (fs.existsSync(`${process.env.MOCK_CONTENT}/../${f}`)) files0.set(f, { sha: sha(), content: fs.readFileSync(`${process.env.MOCK_CONTENT}/../${f}`).toString("base64") });
}
branches.source = mkCommit(null, files0);
const site0 = new Map(); for (const i of [1, 2, 3, 4, 5, 6, 7]) put0(site0, `img/f/00${i}.webp`, "RIFF");
branches.main = mkCommit(null, site0);
const filesAt = ref => { const c = commits.get(branches[ref] || ref); return c ? c.files : null; };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();
  const u = new URL(req.url, "http://x");
  calls.push({ method: req.method, path: u.pathname, auth: req.headers.authorization || "", body: body.slice(0, 4000) });
  const send = (st, obj) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (u.pathname === "/") return send(200, { calls });
  if (/^\/repos\//.test(u.pathname) && !/^Bearer gh_test/.test(req.headers.authorization || "")) return send(401, { message: "Bad credentials" });
  if (u.pathname === "/__orphan") { const fl = new Map(filesAt("main")); fl.set(u.searchParams.get("path"), { sha: sha(), content: B("RIFF") }); const id = mkCommit(branches.main, fl); branches.main = id; return send(200, { id }); }
  if (u.pathname === "/__state") return send(200, { branches, parents: Object.fromEntries(Object.entries(branches).map(([k, v]) => [k, commits.get(v).parent])), files: Object.fromEntries([...filesAt(u.searchParams.get("ref") || "source")].map(([k, v]) => [k, { sha: v.sha, size: Buffer.from(v.content, "base64").length, text: k.endsWith(".json") ? Buffer.from(v.content, "base64").toString() : undefined }])) });
  let m = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(u.pathname);
  if (m) {
    const ref = u.searchParams.get("ref") || "main", fl = filesAt(ref);
    const f = fl && fl.get(decodeURIComponent(m[1]));
    if (req.method === "GET") return f ? send(200, { sha: f.sha, encoding: "base64", content: f.content }) : send(404, {});
  }
  const R = "^\\/repos\\/[^/]+\\/[^/]+\\/git\\/";
  if ((m = new RegExp(R + "ref\\/heads\\/(.+)$").exec(u.pathname)) && req.method === "GET") return branches[m[1]] ? send(200, { object: { sha: branches[m[1]] } }) : send(404, {});
  if ((m = new RegExp(R + "commits\\/(.+)$").exec(u.pathname)) && req.method === "GET") { const c = commits.get(m[1]); return c ? send(200, { sha: m[1], tree: { sha: c.tree } }) : send(404, {}); }
  if (new RegExp(R + "blobs$").test(u.pathname) && req.method === "POST") { const b = JSON.parse(body), id = sha(); blobs.set(id, b.content.replace(/\s/g, "")); return send(201, { sha: id }); }
  if (new RegExp(R + "trees$").test(u.pathname) && req.method === "POST") {
    const b = JSON.parse(body), base = trees.get(b.base_tree); if (!base) return send(422, {});
    const nf = new Map(base); for (const t of b.tree) { if (!blobs.has(t.sha)) return send(422, {}); nf.set(t.path, { sha: t.sha, content: blobs.get(t.sha) }); }
    const id = "t" + sha(); trees.set(id, nf); return send(201, { sha: id });
  }
  if (new RegExp(R + "commits$").test(u.pathname) && req.method === "POST") {
    const b = JSON.parse(body), fl = trees.get(b.tree); if (!fl) return send(422, {});
    const id = "c" + sha(); commits.set(id, { parent: b.parents[0], files: fl, message: b.message, tree: b.tree }); return send(201, { sha: id });
  }
  if ((m = new RegExp(R + "refs\\/heads\\/(.+)$").exec(u.pathname)) && req.method === "PATCH") {
    const b = JSON.parse(body), c = commits.get(b.sha);
    if (!c || !branches[m[1]]) return send(422, { message: "bad ref" });
    if (c.parent !== branches[m[1]] && !b.force) return send(422, { message: "Update is not a fast forward" });
    branches[m[1]] = b.sha; return send(200, { object: { sha: b.sha } });
  }
  if (u.pathname === "/emails" && req.method === "POST") return send(200, { id: "em_" + (++n) });
  if (u.pathname === "/turnstile/v0/siteverify" && req.method === "POST") { // jeton « tok-ok » accepté, avec le bon secret
    const ok = /name="secret"\r\n\r\nts_secret_test\r\n/.test(body) && /name="response"\r\n\r\ntok-ok\r\n/.test(body);
    return send(200, { success: ok });
  }
  send(404, { message: "not found" });
}).listen(+(process.argv[2] || 9922), "127.0.0.1", () => console.log("mock services on", process.argv[2] || 9922));
