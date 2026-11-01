// Services du site BIGBEEZARR au-delà des galeries : demandes de réservation, disponibilités, clients,
// sélections envoyées depuis une galerie, statistiques sans témoin, contenu du portfolio (via GitHub),
// paiements préparés (Stripe, inactif tant que les clés ne sont pas posées).
import { fail, json, now, randomId, readJson, rateLimit, clientKey, hmac, hex, safeEqual } from "./util.js";

const DAY = 86400;
const TYPES = new Set(["soiree", "concert", "sport", "marque", "portrait", "exposition", "autre"]);
const STATUSES = new Set(["new", "discussion", "confirmed", "declined", "cancelled", "done"]);
const PAY = new Set(["none", "deposit_due", "deposit_paid", "paid", "refunded"]);
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => v == null ? null : (String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) || null);
const oneLine = (v, max) => { const s = str(v, max); return s && s.replace(/[\r\n\t]+/g, " "); };
const today = () => new Date().toISOString().slice(0, 10);
const validDay = d => DAY_RE.test(d) && !isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;

// ---------------- notifications (facultatives) ----------------
// Resend (RESEND_API_KEY + NOTIFY_EMAIL) si posé ; sinon la demande reste visible dans l'administration.
export async function notify(env, subject, text, replyTo) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return false;
  const body = { from: env.NOTIFY_FROM || "BIGBEEZARR <onboarding@resend.dev>", to: [env.NOTIFY_EMAIL], subject: oneLine(subject, 180), text: String(text).slice(0, 20000) };
  if (replyTo && EMAIL.test(replyTo)) body.reply_to = replyTo;
  try {
    const r = await fetch(env.RESEND_ENDPOINT || "https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}

// ---------------- protection anti-robots ----------------
async function turnstileOk(env, token, req) {
  if (!env.TURNSTILE_SECRET) return true; // Turnstile désactivé : piège invisible, délai minimal et limites de débit seulement
  if (!token) return false;
  const form = new FormData(); form.append("secret", env.TURNSTILE_SECRET); form.append("response", String(token).slice(0, 2048));
  const ip = req.headers.get("CF-Connecting-IP"); if (ip) form.append("remoteip", ip);
  try { const r = await fetch(env.TURNSTILE_ENDPOINT || "https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }); const j = await r.json(); return !!j.success; } catch { return false; }
}

// ---------------- demandes de réservation (public) ----------------
export async function createBooking(req, env, ctx) {
  const ip = await clientKey(env, req);
  await rateLimit(env, "book:" + ip, 5, 3600);
  await rateLimit(env, "book:all", 80, 3600);
  const b = await readJson(req, 16 * 1024);
  // Piège : un humain ne remplit jamais le champ caché, et met plus de 3 secondes à remplir le formulaire.
  if (b.website || (+b.elapsed > 0 && +b.elapsed < 3000)) return json({ ok: true }, 202);
  if (!(await turnstileOk(env, b.turnstile, req))) fail(400, "captcha_failed");
  if (b.consent !== true) fail(400, "consent_required");
  const d = {
    first_name: oneLine(b.first_name, 80), last_name: oneLine(b.last_name, 80), email: oneLine(b.email, 160), phone: oneLine(b.phone, 40),
    type: oneLine(b.type, 20), date: oneLine(b.date, 10), city: oneLine(b.city, 80), place: oneLine(b.place, 120), duration: oneLine(b.duration, 60),
    people: b.people === "" || b.people == null ? null : Math.round(+b.people), budget: oneLine(b.budget, 60), description: str(b.description, 4000), lang: b.lang === "en" ? "en" : "fr",
  };
  const missing = ["first_name", "last_name", "email", "type", "description"].filter(k => !d[k]);
  if (missing.length) fail(400, "missing_fields", { fields: missing });
  if (!EMAIL.test(d.email)) fail(400, "bad_email");
  if (!TYPES.has(d.type)) fail(400, "bad_type");
  if (d.phone && !/^[+()\d\s.-]{6,40}$/.test(d.phone)) fail(400, "bad_phone");
  if (d.date && (!validDay(d.date) || d.date < today())) fail(400, "bad_date");
  if (d.people != null && !(d.people >= 1 && d.people <= 100000)) fail(400, "bad_people");
  if (d.description.length < 10) fail(400, "description_too_short");
  const t = now(), id = randomId(14);
  const cols = { id, created_at: t, updated_at: t, status: "new", ...d };
  const k = Object.keys(cols);
  await env.DB.prepare(`INSERT INTO bookings (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).bind(...k.map(x => cols[x])).run();
  const busy = d.date ? await dayTaken(env, d.date, id) : false;
  const lines = [`Nouvelle demande de prestation (${d.type})`, "", `${d.first_name} ${d.last_name} <${d.email}>${d.phone ? " · " + d.phone : ""}`, d.date ? `Date souhaitée : ${d.date}${busy ? " (déjà prise dans le calendrier)" : ""}` : "Date : non précisée",
    [d.city, d.place].filter(Boolean).join(" · "), d.duration ? `Durée : ${d.duration}` : "", d.people ? `Participants : ${d.people}` : "", d.budget ? `Budget : ${d.budget}` : "", "", d.description, "", "Répondre depuis l'administration : /admin/ → Réservations"].filter(x => x !== null);
  ctx.waitUntil(notify(env, `Demande de prestation : ${d.first_name} ${d.last_name}${d.date ? " · " + d.date : ""}`, lines.join("\n"), d.email));
  return json({ ok: true, id, busy }, 201);
}

async function dayTaken(env, day, exceptId = "") {
  const blocked = await env.DB.prepare("SELECT 1 x FROM blocked_days WHERE day = ?").bind(day).first();
  if (blocked) return true;
  const conf = await env.DB.prepare("SELECT 1 x FROM bookings WHERE date = ? AND status = 'confirmed' AND id != ?").bind(day, exceptId).first();
  return !!conf;
}

// Jours pris dans les 13 prochains mois : seulement des dates, jamais un nom.
export async function availability(env) {
  const from = today(), to = new Date(Date.now() + 400 * DAY * 1000).toISOString().slice(0, 10);
  const a = await env.DB.prepare("SELECT day FROM blocked_days WHERE day BETWEEN ? AND ?").bind(from, to).all();
  const b = await env.DB.prepare("SELECT DISTINCT date AS day FROM bookings WHERE status = 'confirmed' AND date BETWEEN ? AND ?").bind(from, to).all();
  const busy = [...new Set([...a.results, ...b.results].map(r => r.day))].sort();
  return json({ busy }, 200, { "Cache-Control": "public, max-age=300" });
}

// ---------------- statistiques sans témoin ----------------
// Un compteur par jour, par page et par type d'appareil. Ni adresse IP, ni identifiant, ni témoin.
const PATHS = [/^\/$/, /^\/projets\/$/, /^\/projets\/[a-z0-9-]{1,40}\/$/, /^\/confidentialite\/$/, /^\/conditions\/$/, /^\/galerie\/$/, /^#(soirees|sport|scene|editorial|projets|entre-deux-villes|index|favs|contact|alaune|reserver)$/,
  /^@(book-open|book-sent|lightbox|mail|instagram|project-page)$/];
export async function hit(req, env) {
  if (req.headers.get("DNT") === "1" || req.headers.get("Sec-GPC") === "1") return new Response(null, { status: 204 });
  const ip = await clientKey(env, req);
  try { await rateLimit(env, "hit:" + ip, 300, 3600); } catch { return new Response(null, { status: 204 }); }
  const b = await readJson(req, 1024);
  const p = String(b.p || "").slice(0, 80), dev = ["mobile", "tablet", "desktop"].includes(b.d) ? b.d : "other";
  if (!PATHS.some(r => r.test(p))) return new Response(null, { status: 204 });
  await env.DB.prepare("INSERT INTO hits (day, path, device, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, device) DO UPDATE SET n = n + 1").bind(today(), p, dev).run();
  return new Response(null, { status: 204 });
}

export async function stats(env, url) {
  const days = Math.max(1, Math.min(400, +url.searchParams.get("days") || 30));
  const from = new Date(Date.now() - (days - 1) * DAY * 1000).toISOString().slice(0, 10), since = now() - days * DAY;
  const perDay = (await env.DB.prepare("SELECT day, SUM(n) n FROM hits WHERE day >= ? AND path NOT LIKE '#%' AND path NOT LIKE '@%' GROUP BY day ORDER BY day").bind(from).all()).results;
  const pages = (await env.DB.prepare("SELECT path, SUM(n) n FROM hits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 40").bind(from).all()).results;
  const devices = (await env.DB.prepare("SELECT device, SUM(n) n FROM hits WHERE day >= ? AND path NOT LIKE '#%' AND path NOT LIKE '@%' GROUP BY device").bind(from).all()).results;
  const bookings = (await env.DB.prepare("SELECT status, COUNT(*) n FROM bookings WHERE created_at >= ? GROUP BY status").bind(since).all()).results;
  const gal = (await env.DB.prepare("SELECT kind, COALESCE(SUM(n), 0) n FROM events WHERE at >= ? GROUP BY kind").bind(since).all()).results;
  const sel = await env.DB.prepare("SELECT COUNT(*) n FROM selections WHERE created_at >= ?").bind(since).first();
  return json({ days, perDay, pages, devices, bookings, galleries: gal, selections: sel.n });
}

// ---------------- administration : réservations, calendrier ----------------
const bookingOut = r => r;
export async function listBookings(env, url) {
  const st = url.searchParams.get("status");
  const q = st && STATUSES.has(st) ? env.DB.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC LIMIT 500").bind(st) : env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500");
  const { results } = await q.all();
  return json({ bookings: results.map(bookingOut) });
}
export async function updateBooking(req, env, id) {
  const bk = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first();
  if (!bk) fail(404, "not_found");
  const b = await readJson(req, 16 * 1024), s = {};
  if ("status" in b) { if (!STATUSES.has(b.status)) fail(400, "bad_status"); s.status = b.status; }
  if ("date" in b) { if (b.date && !validDay(b.date)) fail(400, "bad_date"); s.date = b.date || null; }
  if ("note" in b) s.note = str(b.note, 4000);
  if ("client_id" in b) s.client_id = b.client_id ? String(b.client_id).slice(0, 20) : null;
  for (const k of ["price_cents", "deposit_cents"]) if (k in b) s[k] = b[k] == null || b[k] === "" ? null : Math.max(0, Math.round(+b[k]));
  if ("currency" in b) s.currency = /^[A-Za-z]{3}$/.test(b.currency || "") ? b.currency.toUpperCase() : null;
  if ("pay_status" in b) { if (!PAY.has(b.pay_status)) fail(400, "bad_pay_status"); s.pay_status = b.pay_status; }
  const status = s.status || bk.status, date = "date" in s ? s.date : bk.date;
  // Pas de double réservation : une date déjà confirmée (ou bloquée) ne peut pas être confirmée une seconde fois.
  // Vérifié seulement quand on confirme ou qu'on change la date d'une demande confirmée : modifier le prix ou la note reste possible.
  const confirming = status === "confirmed" && (bk.status !== "confirmed" || date !== bk.date);
  if (confirming && date && !b.force && await dayTaken(env, date, id)) fail(409, "date_taken", { date });
  if (!Object.keys(s).length) return json({ booking: bk });
  s.updated_at = now();
  const k = Object.keys(s);
  await env.DB.prepare(`UPDATE bookings SET ${k.map(x => `${x} = ?`).join(", ")} WHERE id = ?`).bind(...k.map(x => s[x]), id).run();
  return json({ booking: await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first() });
}
export async function deleteBooking(env, id) {
  await env.DB.batch([env.DB.prepare("DELETE FROM payments WHERE booking_id = ?").bind(id), env.DB.prepare("DELETE FROM bookings WHERE id = ?").bind(id)]);
  return json({ ok: true });
}
export async function calendar(env, url) {
  const from = validDay(url.searchParams.get("from") || "") ? url.searchParams.get("from") : today();
  const to = validDay(url.searchParams.get("to") || "") ? url.searchParams.get("to") : new Date(Date.now() + 400 * DAY * 1000).toISOString().slice(0, 10);
  const bookings = (await env.DB.prepare("SELECT id, date, status, first_name, last_name, type, city FROM bookings WHERE date BETWEEN ? AND ? AND status IN ('new','discussion','confirmed') ORDER BY date").bind(from, to).all()).results;
  const blocked = (await env.DB.prepare("SELECT day, note FROM blocked_days WHERE day BETWEEN ? AND ? ORDER BY day").bind(from, to).all()).results;
  return json({ from, to, bookings, blocked });
}
export async function blockDay(req, env, day, on) {
  if (!validDay(day)) fail(400, "bad_date");
  if (!on) { await env.DB.prepare("DELETE FROM blocked_days WHERE day = ?").bind(day).run(); return json({ ok: true }); }
  const b = await readJson(req, 2048).catch(() => ({}));
  await env.DB.prepare("INSERT INTO blocked_days (day, note, created_at) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET note = excluded.note").bind(day, str(b.note, 200), now()).run();
  return json({ ok: true });
}

// ---------------- clients et historique des livraisons ----------------
export async function listClients(env) {
  const { results } = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM gallery_extra x WHERE x.client_id = c.id) AS galleries, (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id) AS bookings FROM clients c ORDER BY c.name COLLATE NOCASE`).all();
  return json({ clients: results });
}
function pickClient(b) {
  const s = {};
  if ("name" in b) { s.name = oneLine(b.name, 120); if (!s.name) fail(400, "name_required"); }
  if ("email" in b) { s.email = oneLine(b.email, 160); if (s.email && !EMAIL.test(s.email)) fail(400, "bad_email"); }
  for (const [k, m] of [["phone", 40], ["org", 120]]) if (k in b) s[k] = oneLine(b[k], m);
  if ("note" in b) s.note = str(b.note, 4000);
  return s;
}
export async function createClient(req, env) {
  const b = await readJson(req, 16 * 1024); if (!b.name) fail(400, "name_required");
  const t = now(), c = { id: randomId(12), created_at: t, updated_at: t, ...pickClient(b) }, k = Object.keys(c);
  await env.DB.prepare(`INSERT INTO clients (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).bind(...k.map(x => c[x])).run();
  return json({ client: c }, 201);
}
export async function clientDetail(env, id) {
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first(); if (!c) fail(404, "not_found");
  const galleries = (await env.DB.prepare("SELECT g.id, g.title, g.event_date, g.expires_at, g.views, g.downloads, g.zips, x.archived_at FROM gallery_extra x JOIN galleries g ON g.id = x.gallery_id WHERE x.client_id = ? ORDER BY g.created_at DESC").bind(id).all()).results;
  const bookings = (await env.DB.prepare("SELECT id, date, status, type, created_at FROM bookings WHERE client_id = ? ORDER BY created_at DESC").bind(id).all()).results;
  const history = (await env.DB.prepare("SELECT e.kind, e.n, e.at, g.title FROM events e JOIN gallery_extra x ON x.gallery_id = e.gallery_id JOIN galleries g ON g.id = e.gallery_id WHERE x.client_id = ? ORDER BY e.at DESC LIMIT 200").bind(id).all()).results;
  return json({ client: c, galleries, bookings, history });
}
export async function updateClient(req, env, id) {
  const c = await env.DB.prepare("SELECT id FROM clients WHERE id = ?").bind(id).first(); if (!c) fail(404, "not_found");
  const s = pickClient(await readJson(req, 16 * 1024)); s.updated_at = now(); const k = Object.keys(s);
  await env.DB.prepare(`UPDATE clients SET ${k.map(x => `${x} = ?`).join(", ")} WHERE id = ?`).bind(...k.map(x => s[x]), id).run();
  return json({ client: await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first() });
}
export async function deleteClient(env, id) {
  await env.DB.batch([env.DB.prepare("UPDATE gallery_extra SET client_id = NULL WHERE client_id = ?").bind(id), env.DB.prepare("UPDATE bookings SET client_id = NULL WHERE client_id = ?").bind(id), env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(id)]);
  return json({ ok: true });
}
export async function extraOf(env, gid) { return await env.DB.prepare("SELECT * FROM gallery_extra WHERE gallery_id = ?").bind(gid).first() || { gallery_id: gid, client_id: null, archived_at: null, selections_open: 1 }; }
export async function setExtra(env, gid, b) {
  const x = await extraOf(env, gid);
  if ("archived" in b) x.archived_at = b.archived ? (x.archived_at || now()) : null;
  if ("client_id" in b) {
    if (b.client_id && !(await env.DB.prepare("SELECT 1 x FROM clients WHERE id = ?").bind(String(b.client_id)).first())) fail(400, "bad_client");
    x.client_id = b.client_id ? String(b.client_id) : null;
  }
  if ("selections_open" in b) x.selections_open = b.selections_open ? 1 : 0;
  await env.DB.prepare("INSERT INTO gallery_extra (gallery_id, client_id, archived_at, selections_open) VALUES (?, ?, ?, ?) ON CONFLICT(gallery_id) DO UPDATE SET client_id = excluded.client_id, archived_at = excluded.archived_at, selections_open = excluded.selections_open")
    .bind(gid, x.client_id, x.archived_at, x.selections_open).run();
  return x;
}

// ---------------- sélections envoyées par les clients ----------------
const PURPOSES = new Set(["download", "retouch", "print", "other"]);
export async function sendSelection(req, env, ctx, g, visibleIds, guest) {
  const x = await extraOf(env, g.id);
  if (!x.selections_open) fail(403, "selections_closed");
  await rateLimit(env, `sel:${g.id}:${await clientKey(env, req)}`, 10, 3600);
  const b = await readJson(req, 128 * 1024);
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String))].filter(i => visibleIds.has(i));
  if (!ids.length) fail(400, "nothing_selected");
  if (ids.length > 2000) fail(400, "too_many");
  const email = oneLine(b.email, 160); if (email && !EMAIL.test(email)) fail(400, "bad_email");
  const s = { id: randomId(14), gallery_id: g.id, guest_id: guest ? guest.id : null, name: oneLine(b.name, 120) || (guest && guest.name) || null, email, note: str(b.note, 2000), purpose: PURPOSES.has(b.purpose) ? b.purpose : "other", ids: JSON.stringify(ids), created_at: now(), status: "new" };
  const k = Object.keys(s);
  await env.DB.prepare(`INSERT INTO selections (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).bind(...k.map(z => s[z])).run();
  await env.DB.prepare("INSERT INTO events (gallery_id, kind, n, at) VALUES (?, 'selection', ?, ?)").bind(g.id, ids.length, now()).run();
  ctx.waitUntil(notify(env, `Sélection reçue : ${g.title} (${ids.length} photo${ids.length > 1 ? "s" : ""})`, `${s.name || "Un visiteur"}${email ? " <" + email + ">" : ""} a sélectionné ${ids.length} photo(s) dans « ${g.title} » (${s.purpose}).\n\n${s.note || ""}\n\nVoir : /admin/ → Sélections`, email));
  return json({ ok: true, id: s.id, count: ids.length }, 201);
}
export async function listSelections(env, url) {
  const gid = url.searchParams.get("gallery");
  const q = gid ? env.DB.prepare("SELECT s.*, g.title FROM selections s JOIN galleries g ON g.id = s.gallery_id WHERE s.gallery_id = ? ORDER BY s.created_at DESC LIMIT 300").bind(gid)
                : env.DB.prepare("SELECT s.*, g.title FROM selections s JOIN galleries g ON g.id = s.gallery_id ORDER BY s.created_at DESC LIMIT 300");
  const { results } = await q.all();
  const out = [];
  for (const s of results) {
    const ids = JSON.parse(s.ids); const names = [];
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90);
      const r = await env.DB.prepare(`SELECT id, name FROM photos WHERE gallery_id = ? AND id IN (${part.map(() => "?").join(",")})`).bind(s.gallery_id, ...part).all();
      const m = new Map(r.results.map(x => [x.id, x.name])); part.forEach(id => names.push(m.get(id) || id));
    }
    out.push({ ...s, ids, names });
  }
  return json({ selections: out });
}
export async function updateSelection(req, env, id) {
  const b = await readJson(req, 2048);
  if (!["new", "seen", "done"].includes(b.status)) fail(400, "bad_status");
  await env.DB.prepare("UPDATE selections SET status = ? WHERE id = ?").bind(b.status, id).run();
  return json({ ok: true });
}

// ---------------- contenu du portfolio (fichiers content/*.json du dépôt, via l'API GitHub) ----------------
// Enregistrer = un commit sur la branche du pipeline ; le workflow « Publier le portfolio » reconstruit le site.
const FILES = { portfolio: "content/portfolio.json", home: "content/home.json", site: "content/site.json" };
function gh(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) fail(501, "content_not_configured");
  return { api: env.GITHUB_API || "https://api.github.com", repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || "source", h: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "bbz-galerie", "X-GitHub-Api-Version": "2022-11-28" } };
}
const b64 = s => { const b = new TextEncoder().encode(s); let x = ""; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(x); };
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), c => c.charCodeAt(0)));
export async function getContent(env) {
  const g = gh(env), out = {};
  for (const [k, path] of Object.entries(FILES)) {
    const r = await fetch(`${g.api}/repos/${g.repo}/contents/${path}?ref=${encodeURIComponent(g.branch)}`, { headers: g.h });
    if (!r.ok) fail(502, "github_error", { status: r.status, file: path });
    const j = await r.json();
    out[k] = { sha: j.sha, data: JSON.parse(j.encoding === "base64" ? unb64(j.content) : j.content) };
  }
  return json(out);
}
export function validateContent(file, d) {
  const isT = v => typeof v === "string" || (v && typeof v === "object" && typeof (v.fr ?? "") === "string" && typeof (v.en ?? "") === "string");
  const ids = new Set(), pids = new Set(), err = m => fail(400, "invalid_content", { detail: m });
  const imgList = (a, where) => { if (!Array.isArray(a) || a.some(i => !Number.isInteger(i) || i < 0 || i > 99999)) err(`photos invalides : ${where}`); a.forEach(i => { if (ids.has(i)) err(`photo ${i} utilisée deux fois (${where})`); ids.add(i); }); };
  if (file === "portfolio") {
    if (!d || !Array.isArray(d.chapters) || !d.chapters.length || d.chapters.length > 30) err("chapitres manquants");
    for (const c of d.chapters) {
      if (!/^[a-z0-9-]{1,40}$/.test(c.id || "")) err(`identifiant de chapitre invalide : ${c.id}`);
      if (!isT(c.name)) err(`nom du chapitre ${c.id}`);
      if (!Array.isArray(c.projects)) err(`projets du chapitre ${c.id}`);
      for (const p of c.projects) {
        if (!/^[a-z0-9-]{1,40}$/.test(p.id || "") || pids.has(p.id)) err(`identifiant de projet invalide ou en double : ${p.id}`);
        pids.add(p.id);
        if (!isT(p.title)) err(`titre du projet ${p.id}`);
        if (p.featured != null && !(Number.isInteger(p.featured) && p.featured >= 1 && p.featured <= 5)) err(`rang « à la une » du projet ${p.id} (1 à 5)`);
        if (p.series && p.series.known != null && !(Number.isInteger(p.series.known) && p.series.known >= 1 && p.series.known <= 100000)) err(`nombre d'éditions connues du projet ${p.id}`);
        const eds = p.eds || [p];
        eds.forEach((e, k) => { imgList(e.imgs, `${p.id} #${k + 1}`); if (e.feature) imgList([e.feature.img], `${p.id} vedette`); });
        if (p.lead) imgList([p.lead.img], `${p.id} ouverture`);
        if (p.cover != null && !Number.isInteger(p.cover)) err(`couverture du projet ${p.id}`);
      }
    }
    if (d.alt && (typeof d.alt !== "object" || Object.values(d.alt).some(v => !isT(v)))) err("textes alternatifs");
    if ([...JSON.stringify(d)].length > 1500000) err("contenu trop volumineux");
  } else if (file === "home") {
    for (const k of ["hero", "about", "wall"]) if (!Array.isArray(d[k])) err(`liste ${k}`);
  } else if (file === "site") {
    if (d.email && !EMAIL.test(d.email)) err("courriel du site");
    if (d.api && !/^https:\/\/[a-z0-9.-]+(\/[^\s"'<>]*)?$/i.test(d.api)) err("adresse du serveur");
    if (d.turnstile && !/^[0-9A-Za-z_-]{10,100}$/.test(d.turnstile)) err("clé publique Turnstile");
  } else fail(400, "bad_file");
}
export async function putContent(req, env) {
  const g = gh(env);
  const b = await readJson(req, 2 * 1024 * 1024);
  if (!FILES[b.file]) fail(400, "bad_file");
  validateContent(b.file, b.data);
  const text = JSON.stringify(b.data, null, 1) + "\n";
  const r = await fetch(`${g.api}/repos/${g.repo}/contents/${FILES[b.file]}`, { method: "PUT", headers: { ...g.h, "Content-Type": "application/json" },
    body: JSON.stringify({ message: oneLine(b.message, 120) || `Administration : mise à jour de ${FILES[b.file]}`, content: b64(text), sha: String(b.sha || ""), branch: g.branch,
      committer: { name: "Administration BIGBEEZARR", email: "41898282+github-actions[bot]@users.noreply.github.com" } }) });
  if (r.status === 409 || r.status === 422) fail(409, "content_changed"); // quelqu'un (ou la tâche planifiée) a modifié le fichier entre-temps
  if (!r.ok) fail(502, "github_error", { status: r.status });
  const j = await r.json();
  return json({ ok: true, sha: j.content && j.content.sha, commit: j.commit && j.commit.sha });
}

// ---------------- paiements (préparés, inactifs sans clé) ----------------
export async function checkout(req, env, url, bookingId) {
  if (!env.STRIPE_SECRET_KEY) fail(501, "payments_not_configured");
  const bk = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(bookingId).first(); if (!bk) fail(404, "not_found");
  const b = await readJson(req, 2048);
  const kind = b.kind === "full" ? "full" : "deposit";
  const amount = kind === "full" ? bk.price_cents : bk.deposit_cents;
  if (!(amount > 0)) fail(400, "amount_not_set");
  const currency = (bk.currency || "CAD").toLowerCase(), pid = randomId(14), site = env.SITE_ORIGIN;
  const form = new URLSearchParams({ mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": currency, "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": kind === "full" ? "Prestation photo BIGBEEZARR" : "Acompte, prestation photo BIGBEEZARR", customer_email: bk.email,
    success_url: `${site}/?paiement=ok`, cancel_url: `${site}/?paiement=annule`, "metadata[payment_id]": pid, "metadata[booking_id]": bk.id });
  const r = await fetch(`${env.STRIPE_API || "https://api.stripe.com"}/v1/checkout/sessions`, { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const j = await r.json(); if (!r.ok) fail(502, "stripe_error", { message: j.error && j.error.message });
  const t = now();
  await env.DB.prepare("INSERT INTO payments (id, booking_id, kind, amount_cents, currency, status, provider, provider_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', 'stripe', ?, ?, ?)").bind(pid, bk.id, kind, amount, currency.toUpperCase(), j.id, t, t).run();
  if (kind === "deposit") await env.DB.prepare("UPDATE bookings SET pay_status = 'deposit_due', updated_at = ? WHERE id = ?").bind(t, bk.id).run();
  return json({ url: j.url, id: pid });
}
// Signature Stripe : en-tête Stripe-Signature « t=…,v1=… », HMAC-SHA256 de « t.corps » avec le secret du webhook, 5 minutes de tolérance.
export async function verifyStripe(env, header, payload, at = now()) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map(x => x.split("=")).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const t = +parts.t; if (!t || Math.abs(at - t) > 300) return false;
  const want = hex(await hmac(env.STRIPE_WEBHOOK_SECRET, `${t}.${payload}`));
  return header.split(",").some(x => x.trim().startsWith("v1=") && safeEqual(x.trim().slice(3), want));
}
export async function stripeWebhook(req, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) fail(501, "payments_not_configured");
  const len = +req.headers.get("Content-Length") || 0; if (len > 256 * 1024) fail(413, "too_large");
  const payload = await req.text();
  if (!(await verifyStripe(env, req.headers.get("Stripe-Signature"), payload))) fail(400, "bad_signature");
  const ev = JSON.parse(payload);
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const s = ev.data && ev.data.object || {}, pid = s.metadata && s.metadata.payment_id;
    const p = pid && await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(pid).first();
    if (p && s.payment_status === "paid") {
      const t = now();
      await env.DB.batch([
        env.DB.prepare("UPDATE payments SET status = 'paid', updated_at = ? WHERE id = ?").bind(t, p.id),
        env.DB.prepare("UPDATE bookings SET pay_status = ?, updated_at = ? WHERE id = ?").bind(p.kind === "full" ? "paid" : "deposit_paid", t, p.booking_id),
      ]);
    }
  }
  return json({ received: true });
}
