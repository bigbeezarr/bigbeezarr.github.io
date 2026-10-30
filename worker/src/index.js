// API « Récupérer mes photos » · BIGBEEZARR
// Cloudflare Worker + R2 (fichiers) + D1 (base) + Amazon Rekognition (visages, optionnel).
import {
  HttpError, fail, json, corsHeaders, randomId, now, makeToken, readToken, bearer, signPath, checkPath, adminKey,
  hashPassword, checkPassword, checkAdminPassword, clientKey, rateLimit, readJson, contentDisposition, cleanName,
} from "./util.js";
import { planZip, streamZip, uniqueNames } from "./zip.js";
import * as face from "./aws.js";

const KINDS = new Set(["private", "event", "restricted"]);
const SINGLE_MAX = 95 * 1024 * 1024;        // au-delà : import en plusieurs parties
const PART_SIZE = 50 * 1024 * 1024;          // R2 : toutes les parties (sauf la dernière) ont la même taille
const singleMax = env => +env.SINGLE_MAX || SINGLE_MAX; // réglables pour les tests
const partSize = env => +env.PART_SIZE || PART_SIZE;
const MAX_FILE = 20 * 1024 * 1024 * 1024;    // 20 Go par fichier
const ZIP_MAX_FILES = 400;                   // reste loin de la limite de 1 000 appels R2 par requête
const MEDIA_TTL = 12 * 3600;
const DAY = 86400;

const okey = (gid, pid) => `g/${gid}/o/${pid}`;
const pkey = (gid, pid) => `g/${gid}/p/${pid}`;
const tkey = (gid, pid) => `g/${gid}/t/${pid}`;
const isExpired = g => !!(g.expires_at && g.expires_at <= now());
const passKey = g => g.pass_hash ? g.pass_hash.slice(-10) : "";
const faceLive = (env, g) => !!(g.face_enabled && g.face_until && g.face_until > now() && face.faceConfigured(env));
const galleryLink = (env, g, code) => `${env.SITE_ORIGIN}/galerie/?g=${g.slug}${code ? `&c=${code}` : ""}`;

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res;
    try { res = await route(req, env, ctx); }
    catch (e) {
      if (e instanceof HttpError) res = json({ error: e.code, ...(e.extra || {}) }, e.status);
      else if (e instanceof face.AwsError) res = e.type === "NoFace" ? json({ error: "no_face" }, 422) : e.type === "BadImage" ? json({ error: "bad_image" }, 415) : json({ error: "face_engine_error", detail: e.type }, 502);
      else { console.error(e && e.stack || e); res = json({ error: "server_error" }, 500); }
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "no-referrer");
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    // Rien de ce que sert ce domaine ne doit pouvoir s'exécuter ni être encadré : fichiers et JSON sont mis en bac à sable.
    h.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox");
    h.set("X-Frame-Options", "DENY");
    // Les photos sont affichées par les pages du site (autre origine) : autorisé, mais rien d'autre.
    h.set("Cross-Origin-Resource-Policy", "cross-origin");
    return new Response(res.body, { status: res.status, headers: h });
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(cleanup(env)); },
};

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const m = req.method;
  const is = (method, ...parts) => m === method && p.length === parts.length && parts.every((x, i) => x === "*" || x === p[i]);

  if (is("GET", "api", "health")) return json({ ok: true, face: face.faceConfigured(env) });

  // ---------- fichiers signés ----------
  if (is("GET", "m", "*", "*", "*", "*")) return media(req, env, url, p[1], p[2], p[4]);
  if (is("GET", "o", "*", "*")) return original(req, env, ctx, url, p[1], p[2]);
  if (is("GET", "z", "*")) return zipDownload(req, env, ctx, p[1]);

  // ---------- visiteurs ----------
  if (is("GET", "api", "public")) return publicList(env, url);
  if (p[0] === "api" && p[1] === "g" && p[2]) {
    const g = await gallery(env, "slug", p[2]);
    if (is("GET", "api", "g", "*")) return galleryMeta(env, url, g);
    if (is("POST", "api", "g", "*", "unlock")) return unlock(req, env, g);
    if (isExpired(g)) fail(410, "expired");
    const v = await visitor(req, env, g);
    if (is("GET", "api", "g", "*", "photos")) return visitorPhotos(env, url, g, v);
    if (is("POST", "api", "g", "*", "zip")) return createZip(req, env, url, g, v);
    if (is("POST", "api", "g", "*", "faces", "search")) return faceSearch(req, env, g, v, false);
    if (is("POST", "api", "g", "*", "faces", "forget")) return faceSearch(req, env, g, v, true);
    fail(404, "not_found");
  }

  // ---------- administration ----------
  if (is("POST", "api", "admin", "login")) return adminLogin(req, env);
  if (p[0] === "api" && p[1] === "admin") {
    await admin(req, env);
    if (is("GET", "api", "admin", "overview")) return overview(env, url);
    if (is("POST", "api", "admin", "galleries")) return createGallery(req, env);
    if (p[2] === "galleries" && p[3]) {
      const g = await gallery(env, "id", p[3]);
      if (is("GET", "api", "admin", "galleries", "*")) return galleryDetail(env, url, g);
      if (is("PATCH", "api", "admin", "galleries", "*")) return updateGallery(req, env, g);
      if (is("DELETE", "api", "admin", "galleries", "*")) { await deleteGallery(env, g.id); return json({ ok: true }); }
      if (is("POST", "api", "admin", "galleries", "*", "relink")) return relink(env, g);
      if (is("POST", "api", "admin", "galleries", "*", "photos")) return createPhoto(req, env, g);
      if (is("POST", "api", "admin", "galleries", "*", "order")) return reorder(req, env, g);
      if (is("POST", "api", "admin", "galleries", "*", "guests")) return createGuest(req, env, g);
      if (is("POST", "api", "admin", "galleries", "*", "faces", "index")) return indexGallery(req, env, g);
      if (is("DELETE", "api", "admin", "galleries", "*", "faces")) { await dropFaceIndex(env, g.id); return json({ ok: true }); }
    }
    if (p[2] === "guests" && p[3]) {
      const guest = await env.DB.prepare("SELECT * FROM guests WHERE id = ?").bind(p[3]).first();
      if (!guest) fail(404, "not_found");
      if (is("PUT", "api", "admin", "guests", "*", "photos")) return assignGuest(req, env, guest);
      if (is("DELETE", "api", "admin", "guests", "*")) {
        await env.DB.batch([env.DB.prepare("DELETE FROM guest_photos WHERE guest_id = ?").bind(guest.id), env.DB.prepare("DELETE FROM guests WHERE id = ?").bind(guest.id)]);
        return json({ ok: true });
      }
    }
    if (p[2] === "photos" && p[3]) {
      const ph = await env.DB.prepare("SELECT * FROM photos WHERE id = ?").bind(p[3]).first();
      if (!ph) fail(404, "not_found");
      if (is("PUT", "api", "admin", "photos", "*", "original")) return putOriginal(req, env, ph);
      if (is("PUT", "api", "admin", "photos", "*", "preview")) return putRendition(req, env, ph, "p");
      if (is("PUT", "api", "admin", "photos", "*", "thumb")) return putRendition(req, env, ph, "t");
      if (is("POST", "api", "admin", "photos", "*", "mpu")) return mpuCreate(env, ph);
      if (is("PUT", "api", "admin", "photos", "*", "mpu", "*", "*")) return mpuPart(req, env, ph, p[5], +p[6]);
      if (is("POST", "api", "admin", "photos", "*", "mpu", "*", "complete")) return mpuComplete(req, env, ph, p[5]);
      if (is("DELETE", "api", "admin", "photos", "*", "mpu", "*")) { await env.BUCKET.resumeMultipartUpload(okey(ph.gallery_id, ph.id), p[5]).abort(); return json({ ok: true }); }
      if (is("POST", "api", "admin", "photos", "*", "done")) return photoDone(env, ph);
      if (is("POST", "api", "admin", "photos", "*", "replace")) return replacePhoto(req, env, ph);
      if (is("PATCH", "api", "admin", "photos", "*")) return updatePhoto(req, env, ph);
      if (is("DELETE", "api", "admin", "photos", "*")) { await deletePhoto(env, ph); return json({ ok: true }); }
    }
  }
  fail(404, "not_found");
}

// ================= accès =================
async function gallery(env, by, value) {
  const g = await env.DB.prepare(`SELECT * FROM galleries WHERE ${by === "slug" ? "slug" : "id"} = ?`).bind(value).first();
  if (!g) fail(404, "gallery_not_found");
  return g;
}
async function admin(req, env) {
  const t = await readToken(env, bearer(req));
  if (!t || t.r !== "a" || t.k !== await adminKey(env)) fail(401, "admin_required");
}
async function visitor(req, env, g) {
  const t = await readToken(env, bearer(req));
  if (!t || t.r !== "v" || t.g !== g.id || (t.k || "") !== passKey(g)) fail(401, "locked");
  let guest = null;
  if (t.u) {
    guest = await env.DB.prepare("SELECT * FROM guests WHERE id = ? AND gallery_id = ?").bind(t.u, g.id).first();
    if (!guest) fail(401, "locked");
  } else if (g.kind === "restricted") fail(401, "locked");
  return { guest };
}
async function mediaSig(env, gid, ttl = MEDIA_TTL, cap) {
  // Fenêtres de 6 h : la même URL reste en cache navigateur tant que la fenêtre dure.
  let e = Math.ceil((now() + ttl) / 21600) * 21600;
  if (cap) e = Math.min(e, cap);
  return { e, s: await signPath(env, `m/${gid}`, e) };
}
const mediaUrl = (origin, g, ph, size, sig) => `${origin}/m/${g.id}/${ph.id}/${ph.version}/${size}?e=${sig.e}&s=${sig.s}`;

async function adminLogin(req, env) {
  await rateLimit(env, "login:" + await clientKey(env, req), 6, 900);
  await rateLimit(env, "login:all", 40, 3600); // frein global contre les essais venus de nombreuses adresses
  const { password } = await readJson(req, 4096);
  if (!(await checkAdminPassword(env, password))) fail(401, "bad_password");
  return json({ token: await makeToken(env, { r: "a", k: await adminKey(env), e: now() + 12 * 3600 }), expiresIn: 12 * 3600 });
}

async function unlock(req, env, g) {
  if (isExpired(g)) fail(410, "expired");
  await rateLimit(env, `unlock:${g.id}:${await clientKey(env, req)}`, 10, 900);
  const body = await readJson(req);
  if (g.pass_hash && !(await checkPassword(env, g.pass_hash, body.password || ""))) fail(401, "bad_password");
  let guest = null;
  if (g.kind === "restricted" || body.code) {
    guest = body.code ? await env.DB.prepare("SELECT * FROM guests WHERE gallery_id = ? AND code = ?").bind(g.id, String(body.code)).first() : null;
    if (!guest && g.kind === "restricted") fail(401, "bad_code");
  }
  const e = Math.min(now() + 7 * DAY, g.expires_at || Infinity);
  await env.DB.batch([
    env.DB.prepare("UPDATE galleries SET views = views + 1 WHERE id = ?").bind(g.id),
    env.DB.prepare("INSERT INTO events (gallery_id, kind, at) VALUES (?, 'view', ?)").bind(g.id, now()),
  ]);
  return json({ token: await makeToken(env, { r: "v", g: g.id, u: guest ? guest.id : null, k: passKey(g), e }), guest: guest ? guest.name : null, expiresAt: e });
}

// ================= visiteurs =================
async function coverFor(env, origin, g) {
  const ph = await env.DB.prepare(
    "SELECT id, version, w, h FROM photos WHERE gallery_id = ? AND status = 'ready' AND has_preview = 1 ORDER BY (id = ?) DESC, sort, created_at LIMIT 1"
  ).bind(g.id, g.cover_photo || "").first();
  if (!ph) return null;
  return { url: mediaUrl(origin, g, ph, "p", await mediaSig(env, g.id, MEDIA_TTL, g.expires_at)), w: ph.w, h: ph.h };
}

async function galleryMeta(env, url, g) {
  const base = { title: g.title, date: g.event_date, kind: g.kind };
  if (isExpired(g)) return json({ ...base, expired: true }, 410);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM photos WHERE gallery_id = ? AND status = 'ready'").bind(g.id).first();
  const open = !g.pass_hash && g.kind !== "restricted";
  return json({
    ...base, count: n.n, needsPassword: !!g.pass_hash, needsCode: g.kind === "restricted",
    allowDownload: !!g.allow_download, faceSearch: faceLive(env, g), expiresAt: g.expires_at,
    cover: open ? await coverFor(env, url.origin, g) : null,
  });
}

async function publicList(env, url) {
  const t = now();
  const { results } = await env.DB.prepare(
    "SELECT * FROM galleries WHERE listed = 1 AND kind = 'event' AND pass_hash IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY COALESCE(event_date, '') DESC, created_at DESC LIMIT 60"
  ).bind(t).all();
  const out = [];
  for (const g of results) {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM photos WHERE gallery_id = ? AND status = 'ready'").bind(g.id).first();
    if (!n.n) continue;
    out.push({ slug: g.slug, title: g.title, date: g.event_date, count: n.n, faceSearch: faceLive(env, g), cover: await coverFor(env, url.origin, g) });
  }
  return json({ galleries: out });
}

async function visibleSet(env, g, v) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, mime, size, w, h, version, has_preview, allow_all FROM photos WHERE gallery_id = ? AND status = 'ready' ORDER BY sort, created_at"
  ).bind(g.id).all();
  let mine = new Set();
  if (v.guest) {
    const r = await env.DB.prepare("SELECT photo_id FROM guest_photos WHERE guest_id = ?").bind(v.guest.id).all();
    mine = new Set(r.results.map(x => x.photo_id));
  }
  const restricted = g.kind === "restricted";
  const canDl = ph => !!g.allow_download && (!restricted || !!ph.allow_all || mine.has(ph.id));
  const photos = results.filter(ph => !restricted || g.guest_view_all || ph.allow_all || mine.has(ph.id));
  return { photos, canDl, mine };
}

async function visitorPhotos(env, url, g, v) {
  const { photos, canDl, mine } = await visibleSet(env, g, v);
  const sig = await mediaSig(env, g.id, MEDIA_TTL, g.expires_at);
  const u = v.guest ? v.guest.id : "-";
  const oe = Math.min(now() + MEDIA_TTL, g.expires_at || Infinity);
  const os = await signPath(env, `o/${g.id}/${u}`, oe);
  return json({
    gallery: { title: g.title, client: g.client, date: g.event_date, kind: g.kind, allowDownload: !!g.allow_download, faceSearch: faceLive(env, g), faceThreshold: g.face_threshold, expiresAt: g.expires_at },
    guest: v.guest ? v.guest.name : null,
    photos: photos.map(ph => ({
      id: ph.id, name: ph.name, size: ph.size, w: ph.w, h: ph.h, mine: mine.has(ph.id),
      t: ph.has_preview ? mediaUrl(url.origin, g, ph, "t", sig) : null,
      p: ph.has_preview ? mediaUrl(url.origin, g, ph, "p", sig) : null,
      o: canDl(ph) ? `${url.origin}/o/${g.id}/${ph.id}?u=${u}&e=${oe}&s=${os}` : null,
    })),
  });
}

async function media(req, env, url, gid, pid, size) {
  if (!(await checkPath(env, `m/${gid}`, url.searchParams.get("e"), url.searchParams.get("s")))) fail(403, "bad_signature");
  if (size !== "t" && size !== "p") fail(404, "not_found");
  const obj = await env.BUCKET.get(size === "t" ? tkey(gid, pid) : pkey(gid, pid));
  if (!obj) fail(404, "not_found");
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Content-Length": String(obj.size), "Cache-Control": "private, max-age=86400, immutable" } });
}

async function original(req, env, ctx, url, gid, pid) {
  const u = url.searchParams.get("u") || "-";
  if (!(await checkPath(env, `o/${gid}/${u}`, url.searchParams.get("e"), url.searchParams.get("s")))) fail(403, "bad_signature");
  const row = await env.DB.prepare(
    "SELECT p.*, g.allow_download, g.kind, g.expires_at FROM photos p JOIN galleries g ON g.id = p.gallery_id WHERE p.id = ? AND p.gallery_id = ? AND p.status = 'ready'"
  ).bind(pid, gid).first();
  if (!row) fail(404, "not_found");
  if (isExpired(row)) fail(410, "expired");
  if (!row.allow_download) fail(403, "download_disabled");
  if (row.kind === "restricted" && !row.allow_all) {
    const ok = u !== "-" && await env.DB.prepare("SELECT 1 x FROM guest_photos WHERE guest_id = ? AND photo_id = ?").bind(u, pid).first();
    if (!ok) fail(403, "not_assigned");
  }
  const headers = {
    "Content-Type": row.mime || "application/octet-stream", "Content-Disposition": contentDisposition(row.name),
    "Cache-Control": "private, no-store", "Accept-Ranges": "bytes",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? +range[1] : row.size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], row.size - 1) : row.size - 1;
    if (start < 0 || start > end || start >= row.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${row.size}` } });
    const obj = await env.BUCKET.get(okey(gid, pid), { range: { offset: start, length: end - start + 1 } });
    if (!obj) fail(404, "not_found");
    return new Response(obj.body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${row.size}`, "Content-Length": String(end - start + 1) } });
  }
  const obj = await env.BUCKET.get(okey(gid, pid));
  if (!obj) fail(404, "not_found");
  ctx.waitUntil(env.DB.batch([
    env.DB.prepare("UPDATE photos SET downloads = downloads + 1 WHERE id = ?").bind(pid),
    env.DB.prepare("UPDATE galleries SET downloads = downloads + 1 WHERE id = ?").bind(gid),
    env.DB.prepare("INSERT INTO events (gallery_id, kind, photo_id, at) VALUES (?, 'dl', ?, ?)").bind(gid, pid, now()),
  ]).catch(() => {}));
  return new Response(obj.body, { headers: { ...headers, "Content-Length": String(obj.size) } });
}

async function createZip(req, env, url, g, v) {
  if (!g.allow_download) fail(403, "download_disabled");
  const body = await readJson(req, 1024 * 1024);
  const { photos, canDl } = await visibleSet(env, g, v);
  const want = body.all ? null : new Set((body.ids || []).map(String));
  const list = photos.filter(ph => canDl(ph) && (!want || want.has(ph.id)));
  if (!list.length) fail(400, "nothing_to_download");
  const chunks = [];
  for (let i = 0; i < list.length; i += ZIP_MAX_FILES) chunks.push(list.slice(i, i + ZIP_MAX_FILES));
  const exp = Math.min(now() + 6 * 3600, g.expires_at || Infinity);
  const out = [];
  for (let k = 0; k < chunks.length; k++) {
    const id = randomId(24);
    const label = chunks.length > 1 ? ` (${k + 1} sur ${chunks.length})` : "";
    await env.DB.prepare("INSERT INTO zip_tickets (id, gallery_id, ids, label, exp) VALUES (?, ?, ?, ?, ?)").bind(id, g.id, JSON.stringify(chunks[k].map(x => x.id)), label, exp).run();
    out.push({ url: `${url.origin}/z/${id}`, count: chunks[k].length, size: chunks[k].reduce((s, x) => s + x.size, 0) });
  }
  return json({ parts: out });
}

async function zipDownload(req, env, ctx, id) {
  const t = await env.DB.prepare("SELECT * FROM zip_tickets WHERE id = ?").bind(id).first();
  if (!t || t.exp < now()) fail(410, "link_expired");
  const g = await gallery(env, "id", t.gallery_id);
  if (isExpired(g)) fail(410, "expired");
  if (!g.allow_download) fail(403, "download_disabled");
  const ids = JSON.parse(t.ids);
  const rows = [];
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT id, name, size, crc32, mtime FROM photos WHERE gallery_id = ? AND status = 'ready' AND id IN (${part.map(() => "?").join(",")})`).bind(g.id, ...part).all();
    rows.push(...r.results);
  }
  const byId = new Map(rows.map(r => [r.id, r]));
  const files = uniqueNames(ids.map(i => byId.get(i)).filter(r => r && r.crc32 != null).map(r => ({ id: r.id, name: r.name, size: r.size, crc: r.crc32, mtime: r.mtime })));
  if (!files.length) fail(404, "not_found");
  const plan = planZip(files);
  const { readable, done } = streamZip(plan, async e => {
    const obj = await env.BUCKET.get(okey(g.id, e.id));
    if (!obj) throw new Error("missing " + e.id);
    return obj.body;
  });
  ctx.waitUntil(done);
  ctx.waitUntil(env.DB.batch([
    env.DB.prepare("UPDATE galleries SET zips = zips + 1, downloads = downloads + ? WHERE id = ?").bind(files.length, g.id),
    env.DB.prepare("INSERT INTO events (gallery_id, kind, n, at) VALUES (?, 'zip', ?, ?)").bind(g.id, files.length, now()),
  ]).catch(() => {}));
  const name = `${cleanName(g.title, "Galerie")} - BIGBEEZARR${t.label || ""}.zip`;
  return new Response(readable, { headers: { "Content-Type": "application/zip", "Content-Disposition": contentDisposition(name), "Cache-Control": "private, no-store" } });
}

// ================= visages =================
async function faceSearch(req, env, g, v, forget) {
  if (!faceLive(env, g)) fail(409, "face_unavailable");
  if (req.headers.get("X-Consent") !== "1") fail(400, "consent_required");
  const type = (req.headers.get("Content-Type") || "").split(";")[0];
  if (type !== "image/jpeg" && type !== "image/png") fail(415, "jpeg_or_png_only");
  if (+req.headers.get("Content-Length") > 5 * 1024 * 1024) fail(413, "image_too_large");
  const ip = await clientKey(env, req);
  await rateLimit(env, `${forget ? "forget" : "search"}:${g.id}:${ip}`, forget ? 5 : 20, 3600);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) fail(413, "image_too_large");
  if (bytes.length < 1000) fail(400, "image_too_small");
  // Le selfie n'est ni écrit en base ni dans R2 : il ne vit que le temps de cette requête.
  const floor = forget ? g.face_threshold : Math.max(70, g.face_threshold - 15);
  const matches = await face.searchByImage(env, g.id, bytes, floor);
  if (forget) {
    const ids = [...new Set(matches.map(x => x.faceId))];
    if (ids.length) {
      await face.deleteFaces(env, g.id, ids);
      for (let i = 0; i < ids.length; i += 90) {
        const part = ids.slice(i, i + 90);
        await env.DB.prepare(`DELETE FROM faces WHERE gallery_id = ? AND face_id IN (${part.map(() => "?").join(",")})`).bind(g.id, ...part).run();
      }
    }
    await env.DB.prepare("INSERT INTO events (gallery_id, kind, n, at) VALUES (?, 'forget', ?, ?)").bind(g.id, ids.length, now()).run();
    return json({ removed: ids.length });
  }
  const { photos } = await visibleSet(env, g, v);
  const visible = new Set(photos.map(x => x.id));
  const best = new Map();
  for (const x of matches) if (visible.has(x.photoId) && (best.get(x.photoId) || 0) < x.similarity) best.set(x.photoId, x.similarity);
  await env.DB.batch([
    env.DB.prepare("UPDATE galleries SET searches = searches + 1 WHERE id = ?").bind(g.id),
    env.DB.prepare("INSERT INTO events (gallery_id, kind, n, at) VALUES (?, 'search', ?, ?)").bind(g.id, best.size, now()),
  ]);
  return json({
    threshold: g.face_threshold, floor,
    matches: [...best].map(([id, s]) => ({ id, s: Math.round(s * 10) / 10 })).sort((a, b) => b.s - a.s),
  });
}

async function indexGallery(req, env, g) {
  if (!face.faceConfigured(env)) fail(501, "face_not_configured");
  if (!g.face_enabled) fail(409, "face_disabled");
  const body = await readJson(req);
  const max = Math.max(1, Math.min(8, +body.max || 4));
  await face.ensureCollection(env, g.id);
  const { results } = await env.DB.prepare(
    "SELECT * FROM photos WHERE gallery_id = ? AND status = 'ready' AND has_preview = 1 AND face_state = 'none' ORDER BY sort, created_at LIMIT ?"
  ).bind(g.id, max).all();
  let indexed = 0, faces = 0, throttled = false;
  for (const ph of results) {
    let obj = await env.BUCKET.get(pkey(g.id, ph.id));
    if (obj && obj.size > 5 * 1024 * 1024) obj = await env.BUCKET.get(tkey(g.id, ph.id));
    if (!obj) { await env.DB.prepare("UPDATE photos SET face_state = 'skipped' WHERE id = ?").bind(ph.id).run(); continue; }
    const bytes = new Uint8Array(await obj.arrayBuffer());
    try {
      const ids = await face.indexFaces(env, g.id, ph.id, bytes);
      const t = now();
      const stmts = ids.map(fid => env.DB.prepare("INSERT OR IGNORE INTO faces (face_id, gallery_id, photo_id, created_at) VALUES (?, ?, ?, ?)").bind(fid, g.id, ph.id, t));
      stmts.push(env.DB.prepare("UPDATE photos SET face_state = 'done', faces = ? WHERE id = ?").bind(ids.length, ph.id));
      await env.DB.batch(stmts);
      indexed++; faces += ids.length;
    } catch (e) {
      if (e instanceof face.AwsError && /Throttl|ProvisionedThroughput|LimitExceeded/.test(e.type)) { throttled = true; break; }
      if (e instanceof face.AwsError && e.status && e.status < 500) {
        await env.DB.prepare("UPDATE photos SET face_state = 'error' WHERE id = ?").bind(ph.id).run();
        continue;
      }
      throw e;
    }
  }
  const until = Math.max(g.face_until || 0, now() + g.face_retention_days * DAY);
  await env.DB.prepare("UPDATE galleries SET face_until = ? WHERE id = ?").bind(until, g.id).run();
  const rem = await env.DB.prepare("SELECT COUNT(*) n FROM photos WHERE gallery_id = ? AND status = 'ready' AND has_preview = 1 AND face_state = 'none'").bind(g.id).first();
  return json({ indexed, faces, remaining: rem.n, throttled, faceUntil: until });
}

async function dropFaceIndex(env, gid) {
  if (face.faceConfigured(env)) await face.deleteCollection(env, gid);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM faces WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("UPDATE photos SET face_state = 'none', faces = 0 WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("UPDATE galleries SET face_until = NULL WHERE id = ?").bind(gid),
  ]);
}

async function dropPhotoFaces(env, ph) {
  const { results } = await env.DB.prepare("SELECT face_id FROM faces WHERE photo_id = ?").bind(ph.id).all();
  if (results.length && face.faceConfigured(env)) await face.deleteFaces(env, ph.gallery_id, results.map(r => r.face_id));
  await env.DB.prepare("DELETE FROM faces WHERE photo_id = ?").bind(ph.id).run();
}

// ================= administration =================
function galleryOut(env, g, extra = {}) {
  const { pass_hash, ...rest } = g;
  return { ...rest, hasPassword: !!pass_hash, link: galleryLink(env, g), faceLive: faceLive(env, g), ...extra };
}

async function overview(env, url) {
  const { results } = await env.DB.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM photos p WHERE p.gallery_id = g.id AND p.status = 'ready') AS n,
      (SELECT COALESCE(SUM(p.size + p.extra_size), 0) FROM photos p WHERE p.gallery_id = g.id) AS bytes,
      (SELECT COUNT(*) FROM faces f WHERE f.gallery_id = g.id) AS nfaces
    FROM galleries g ORDER BY g.created_at DESC`).all();
  const out = [];
  for (const g of results) out.push(galleryOut(env, g, { cover: await coverFor(env, url.origin, g) }));
  const tot = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(size + extra_size), 0) bytes, COALESCE(SUM(downloads), 0) dl FROM photos").first();
  const week = await env.DB.prepare("SELECT kind, COALESCE(SUM(n), 0) n FROM events WHERE at > ? GROUP BY kind").bind(now() - 30 * DAY).all();
  return json({
    galleries: out, totals: { photos: tot.n, bytes: tot.bytes, downloads: tot.dl, last30: Object.fromEntries(week.results.map(r => [r.kind, r.n])) },
    face: face.faceConfigured(env), region: env.AWS_REGION || "ca-central-1",
  });
}

function pickSettings(body, g = {}) {
  const s = {};
  const str = (k, max = 200) => { if (k in body) s[k] = body[k] == null ? null : String(body[k]).trim().slice(0, max) || null; };
  const bool = k => { if (k in body) s[k] = body[k] ? 1 : 0; };
  str("title", 160); str("client", 160); str("event_date", 20); str("face_note", 600);
  if ("kind" in body) { if (!KINDS.has(body.kind)) fail(400, "bad_kind"); s.kind = body.kind; }
  ["listed", "allow_download", "guest_view_all", "delete_after_expiry", "face_enabled"].forEach(bool);
  if ("face_threshold" in body) s.face_threshold = Math.max(80, Math.min(99, +body.face_threshold || 90));
  if ("face_retention_days" in body) s.face_retention_days = Math.max(1, Math.min(365, Math.round(+body.face_retention_days || 30)));
  if ("expires_at" in body) s.expires_at = body.expires_at ? Math.round(+body.expires_at) : null;
  if ("cover_photo" in body) s.cover_photo = body.cover_photo ? String(body.cover_photo) : null;
  if (s.title === null) fail(400, "title_required");
  const kind = s.kind || g.kind;
  if ((s.listed ?? g.listed) && kind !== "event") s.listed = 0;
  return s;
}

async function createGallery(req, env) {
  const body = await readJson(req);
  if (!body.title) fail(400, "title_required");
  const s = pickSettings({ kind: "private", ...body, face_enabled: 0 });
  const t = now();
  const g = { id: randomId(12), slug: randomId(22), created_at: t, updated_at: t, ...s };
  if (body.password) g.pass_hash = await hashPassword(env, String(body.password));
  const cols = Object.keys(g);
  await env.DB.prepare(`INSERT INTO galleries (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).bind(...cols.map(c => g[c])).run();
  return json({ gallery: galleryOut(env, await gallery(env, "id", g.id)) }, 201);
}

async function updateGallery(req, env, g) {
  const body = await readJson(req);
  const s = pickSettings(body, g);
  if ("password" in body) s.pass_hash = body.password ? await hashPassword(env, String(body.password)) : null;
  if (s.face_enabled === 1 && !g.face_enabled) {
    if (!body.face_ack || !String(body.face_note || g.face_note || "").trim()) fail(400, "face_ack_required");
  }
  if (s.face_enabled === 0 && g.face_enabled) await dropFaceIndex(env, g.id);
  if ("face_retention_days" in s && g.face_until) s.face_until = Math.min(g.face_until, now() + s.face_retention_days * DAY);
  s.updated_at = now();
  const cols = Object.keys(s);
  await env.DB.prepare(`UPDATE galleries SET ${cols.map(c => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...cols.map(c => s[c]), g.id).run();
  return json({ gallery: galleryOut(env, await gallery(env, "id", g.id)) });
}

async function relink(env, g) {
  await env.DB.prepare("UPDATE galleries SET slug = ?, updated_at = ? WHERE id = ?").bind(randomId(22), now(), g.id).run();
  return json({ gallery: galleryOut(env, await gallery(env, "id", g.id)) });
}

async function galleryDetail(env, url, g) {
  const { results: photos } = await env.DB.prepare("SELECT * FROM photos WHERE gallery_id = ? ORDER BY sort, created_at").bind(g.id).all();
  const { results: guests } = await env.DB.prepare("SELECT * FROM guests WHERE gallery_id = ? ORDER BY created_at").bind(g.id).all();
  const { results: assign } = await env.DB.prepare("SELECT gp.guest_id, gp.photo_id FROM guest_photos gp JOIN guests g ON g.id = gp.guest_id WHERE g.gallery_id = ?").bind(g.id).all();
  const { results: events } = await env.DB.prepare("SELECT kind, n, at FROM events WHERE gallery_id = ? ORDER BY at DESC LIMIT 40").bind(g.id).all();
  const nf = await env.DB.prepare("SELECT COUNT(*) n FROM faces WHERE gallery_id = ?").bind(g.id).first();
  const sig = await mediaSig(env, g.id);
  const byGuest = {};
  for (const a of assign) (byGuest[a.guest_id] ||= []).push(a.photo_id);
  return json({
    gallery: galleryOut(env, g, { nfaces: nf.n }),
    photos: photos.map(ph => ({ ...ph, t: ph.has_preview ? mediaUrl(url.origin, g, ph, "t", sig) : null })),
    guests: guests.map(x => ({ ...x, link: galleryLink(env, g, x.code), photos: byGuest[x.id] || [] })),
    events, face: face.faceConfigured(env),
  });
}

async function deleteGallery(env, gid) {
  let cursor;
  do {
    const list = await env.BUCKET.list({ prefix: `g/${gid}/`, cursor, limit: 1000 });
    if (list.objects.length) await env.BUCKET.delete(list.objects.map(o => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  if (face.faceConfigured(env)) await face.deleteCollection(env, gid);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM guest_photos WHERE guest_id IN (SELECT id FROM guests WHERE gallery_id = ?)").bind(gid),
    env.DB.prepare("DELETE FROM guests WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("DELETE FROM faces WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("DELETE FROM photos WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("DELETE FROM zip_tickets WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("DELETE FROM events WHERE gallery_id = ?").bind(gid),
    env.DB.prepare("DELETE FROM galleries WHERE id = ?").bind(gid),
  ]);
}

function photoMeta(body) {
  const size = Math.round(+body.size);
  if (!(size > 0) || size > MAX_FILE) fail(400, "bad_size");
  const crc = body.crc32 == null ? null : Math.round(+body.crc32);
  if (crc == null || !(crc >= 0 && crc <= 0xffffffff)) fail(400, "bad_crc");
  return {
    name: cleanName(body.name), mime: String(body.mime || "application/octet-stream").slice(0, 100), size, crc32: crc,
    w: body.w ? Math.round(+body.w) : null, h: body.h ? Math.round(+body.h) : null, mtime: body.mtime ? Math.round(+body.mtime) : null,
  };
}
const uploadPlan = (env, size) => size <= singleMax(env) ? { mode: "single" } : { mode: "multipart", partSize: partSize(env), parts: Math.ceil(size / partSize(env)) };

async function createPhoto(req, env, g) {
  const m = photoMeta(await readJson(req));
  const t = now();
  const max = await env.DB.prepare("SELECT COALESCE(MAX(sort), 0) s FROM photos WHERE gallery_id = ?").bind(g.id).first();
  const id = randomId(14);
  await env.DB.prepare("INSERT INTO photos (id, gallery_id, name, mime, size, crc32, w, h, mtime, sort, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?)")
    .bind(id, g.id, m.name, m.mime, m.size, m.crc32, m.w, m.h, m.mtime, max.s + 1, t, t).run();
  return json({ id, ...uploadPlan(env, m.size) }, 201);
}

async function replacePhoto(req, env, ph) {
  const m = photoMeta(await readJson(req));
  await dropPhotoFaces(env, ph);
  await env.BUCKET.delete([pkey(ph.gallery_id, ph.id), tkey(ph.gallery_id, ph.id)]);
  await env.DB.prepare("UPDATE photos SET name = ?, mime = ?, size = ?, crc32 = ?, w = ?, h = ?, mtime = ?, status = 'uploading', version = version + 1, has_preview = 0, extra_size = 0, face_state = 'none', faces = 0, updated_at = ? WHERE id = ?")
    .bind(m.name, m.mime, m.size, m.crc32, m.w, m.h, m.mtime, now(), ph.id).run();
  return json({ id: ph.id, ...uploadPlan(env, m.size) });
}

async function putOriginal(req, env, ph) {
  if (ph.status !== "uploading") fail(409, "not_uploading");
  const len = +req.headers.get("Content-Length");
  if (len !== ph.size || len > singleMax(env) || !req.body) fail(400, "bad_length");
  await env.BUCKET.put(okey(ph.gallery_id, ph.id), req.body, { httpMetadata: { contentType: ph.mime } });
  return json({ ok: true });
}

async function putRendition(req, env, ph, kind) {
  const len = +req.headers.get("Content-Length");
  const type = (req.headers.get("Content-Type") || "").split(";")[0];
  if (!(len > 0) || len > 12 * 1024 * 1024 || !req.body) fail(400, "bad_length");
  if (!/^image\/(jpeg|webp)$/.test(type)) fail(415, "jpeg_or_webp_only");
  await env.BUCKET.put((kind === "p" ? pkey : tkey)(ph.gallery_id, ph.id), req.body, { httpMetadata: { contentType: type } });
  await env.DB.prepare(`UPDATE photos SET extra_size = extra_size + ?${kind === "p" ? ", has_preview = 1" : ""} WHERE id = ?`).bind(len, ph.id).run();
  return json({ ok: true });
}

async function mpuCreate(env, ph) {
  if (ph.status !== "uploading") fail(409, "not_uploading");
  const up = await env.BUCKET.createMultipartUpload(okey(ph.gallery_id, ph.id), { httpMetadata: { contentType: ph.mime } });
  return json({ uploadId: up.uploadId, partSize: partSize(env), parts: Math.ceil(ph.size / partSize(env)) });
}
async function mpuPart(req, env, ph, uploadId, n) {
  const ps = partSize(env), parts = Math.ceil(ph.size / ps);
  if (!(n >= 1 && n <= parts)) fail(400, "bad_part");
  const want = n < parts ? ps : ph.size - ps * (parts - 1);
  if (+req.headers.get("Content-Length") !== want || !req.body) fail(400, "bad_length");
  const part = await env.BUCKET.resumeMultipartUpload(okey(ph.gallery_id, ph.id), uploadId).uploadPart(n, req.body);
  return json({ partNumber: part.partNumber, etag: part.etag });
}
async function mpuComplete(req, env, ph, uploadId) {
  const { parts } = await readJson(req);
  if (!Array.isArray(parts) || !parts.length) fail(400, "bad_parts");
  await env.BUCKET.resumeMultipartUpload(okey(ph.gallery_id, ph.id), uploadId).complete(parts.map(x => ({ partNumber: +x.partNumber, etag: String(x.etag) })));
  return json({ ok: true });
}

async function photoDone(env, ph) {
  const head = await env.BUCKET.head(okey(ph.gallery_id, ph.id));
  if (!head) fail(409, "original_missing");
  if (head.size !== ph.size) fail(409, "size_mismatch", { stored: head.size, expected: ph.size });
  await env.DB.prepare("UPDATE photos SET status = 'ready', updated_at = ? WHERE id = ?").bind(now(), ph.id).run();
  return json({ ok: true });
}

async function updatePhoto(req, env, ph) {
  const body = await readJson(req);
  if ("allow_all" in body) await env.DB.prepare("UPDATE photos SET allow_all = ? WHERE id = ?").bind(body.allow_all ? 1 : 0, ph.id).run();
  if ("name" in body) await env.DB.prepare("UPDATE photos SET name = ? WHERE id = ?").bind(cleanName(body.name), ph.id).run();
  return json({ ok: true });
}

async function deletePhoto(env, ph) {
  await dropPhotoFaces(env, ph);
  await env.BUCKET.delete([okey(ph.gallery_id, ph.id), pkey(ph.gallery_id, ph.id), tkey(ph.gallery_id, ph.id)]);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM guest_photos WHERE photo_id = ?").bind(ph.id),
    env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(ph.id),
  ]);
}

async function reorder(req, env, g) {
  const { ids } = await readJson(req, 1024 * 1024);
  if (!Array.isArray(ids)) fail(400, "bad_ids");
  const stmts = ids.map((id, i) => env.DB.prepare("UPDATE photos SET sort = ? WHERE id = ? AND gallery_id = ?").bind(i + 1, String(id), g.id));
  for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200));
  return json({ ok: true });
}

async function createGuest(req, env, g) {
  const body = await readJson(req);
  const guest = { id: randomId(12), gallery_id: g.id, name: String(body.name || "").trim().slice(0, 120) || null, code: randomId(10), created_at: now() };
  await env.DB.prepare("INSERT INTO guests (id, gallery_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)").bind(guest.id, guest.gallery_id, guest.name, guest.code, guest.created_at).run();
  return json({ guest: { ...guest, link: galleryLink(env, g, guest.code), photos: [] } }, 201);
}

async function assignGuest(req, env, guest) {
  const { ids } = await readJson(req, 1024 * 1024);
  if (!Array.isArray(ids)) fail(400, "bad_ids");
  const own = await env.DB.prepare("SELECT id FROM photos WHERE gallery_id = ?").bind(guest.gallery_id).all();
  const valid = new Set(own.results.map(r => r.id));
  const stmts = [env.DB.prepare("DELETE FROM guest_photos WHERE guest_id = ?").bind(guest.id)];
  for (const id of new Set(ids.map(String))) if (valid.has(id)) stmts.push(env.DB.prepare("INSERT INTO guest_photos (guest_id, photo_id) VALUES (?, ?)").bind(guest.id, id));
  for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200));
  return json({ ok: true, count: stmts.length - 1 });
}

// ================= tâche quotidienne =================
export async function cleanup(env) {
  const t = now();
  const faceDue = await env.DB.prepare("SELECT id FROM galleries WHERE face_until IS NOT NULL AND face_until <= ?").bind(t).all();
  for (const g of faceDue.results) await dropFaceIndex(env, g.id);
  const gone = await env.DB.prepare("SELECT id FROM galleries WHERE delete_after_expiry = 1 AND expires_at IS NOT NULL AND expires_at <= ?").bind(t).all();
  for (const g of gone.results) await deleteGallery(env, g.id);
  const stale = await env.DB.prepare("SELECT * FROM photos WHERE status = 'uploading' AND updated_at < ?").bind(t - 3 * DAY).all();
  for (const ph of stale.results) await deletePhoto(env, ph);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM zip_tickets WHERE exp < ?").bind(t),
    env.DB.prepare("DELETE FROM attempts WHERE reset_at < ?").bind(t),
    env.DB.prepare("DELETE FROM events WHERE at < ?").bind(t - 400 * DAY),
  ]);
  return { faceIndexesDeleted: faceDue.results.length, galleriesDeleted: gone.results.length, staleUploads: stale.results.length };
}
