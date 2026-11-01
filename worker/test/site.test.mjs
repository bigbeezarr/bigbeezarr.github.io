// Tests des services du site : réservations, anti-robots, disponibilités, double réservation, clients, archives,
// sélections, statistiques sans témoin, contenu du portfolio (GitHub imité), sécurité.
// Lancer après devserver.mjs (avec GITHUB_*, RESEND_*, TURNSTILE_* pointant vers mock_services.mjs).
import zlib from "node:zlib";
const API = process.env.API || "http://127.0.0.1:8787", MOCK = process.env.MOCK || "http://127.0.0.1:9922";
let ok = 0, bad = 0;
const check = (c, label, extra) => { if (c) { ok++; console.log("  ✓", label); } else { bad++; console.log("  ✗", label, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
let ipN = 1;
async function call(method, path, { token, body, raw, headers = {}, ip } = {}) {
  const h = { "CF-Connecting-IP": ip || "10.0.0.1", ...headers };
  if (token) h.Authorization = "Bearer " + token;
  let b = raw; if (body !== undefined) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await fetch(API + path, { method, headers: h, body: b });
  let data = null; const txt = await r.text(); try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: r.status, data, headers: r.headers };
}
const day = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const A = (await call("POST", "/api/admin/login", { body: { password: "motdepasse-de-test" } })).data.token;
check(!!A, "connexion admin");

console.log("Demande de réservation");
const good = { first_name: "Awa", last_name: "Ndiaye", email: "awa@example.com", phone: "+221 77 000 00 00", type: "soiree", date: day(30), city: "Dakar", place: "Monaco Plage", duration: "4 h", people: 300, budget: "", description: "Soirée de lancement, photos de la foule et des artistes.", lang: "fr", consent: true, elapsed: 12000, website: "", turnstile: "tok-ok" };
const b1 = await call("POST", "/api/booking", { body: good, ip: "10.1.0.1" });
check(b1.status === 201 && b1.data.id, "demande valide enregistrée", b1.data);
check((await call("POST", "/api/booking", { body: { ...good, turnstile: undefined }, ip: "10.1.0.20" })).data.error === "captcha_failed", "Turnstile actif : demande sans vérification refusée");
check((await call("POST", "/api/booking", { body: { ...good, turnstile: "tok-faux" }, ip: "10.1.0.21" })).data.error === "captcha_failed", "Turnstile : jeton refusé par Cloudflare (imité) → refus");
check((await call("POST", "/api/booking", { body: { ...good, consent: false }, ip: "10.1.0.2" })).data.error === "consent_required", "consentement obligatoire");
check((await call("POST", "/api/booking", { body: { ...good, email: "pas-un-courriel" }, ip: "10.1.0.3" })).data.error === "bad_email", "courriel invalide refusé");
check((await call("POST", "/api/booking", { body: { ...good, date: "2020-01-01" }, ip: "10.1.0.4" })).data.error === "bad_date", "date passée refusée");
check((await call("POST", "/api/booking", { body: { ...good, type: "<script>" }, ip: "10.1.0.5" })).data.error === "bad_type", "type inconnu refusé");
check((await call("POST", "/api/booking", { body: { ...good, first_name: "" }, ip: "10.1.0.6" })).data.error === "missing_fields", "champs obligatoires");
const bot = await call("POST", "/api/booking", { body: { ...good, website: "http://spam.example" }, ip: "10.1.0.7" });
const fast = await call("POST", "/api/booking", { body: { ...good, elapsed: 800 }, ip: "10.1.0.8" });
const all1 = (await call("GET", "/api/admin/bookings", { token: A })).data.bookings;
check(bot.status === 202 && fast.status === 202 && all1.length === 1, "robots (champ caché, envoi trop rapide) : réponse polie, rien d'enregistré", all1.length);
let lastSt; for (let i = 0; i < 6; i++) lastSt = (await call("POST", "/api/booking", { body: good, ip: "10.9.9.9" })).status;
check(lastSt === 429, "limite de débit par adresse");
check((await call("POST", "/api/booking", { raw: "x".repeat(20000), headers: { "Content-Type": "application/json" }, ip: "10.1.0.9" })).status === 413, "corps trop gros refusé");
const xss = await call("POST", "/api/booking", { body: { ...good, first_name: "<img src=x onerror=alert(1)>", description: "Test <script>alert(1)</script> injection." }, ip: "10.1.1.1" });
const stored = (await call("GET", "/api/admin/bookings", { token: A })).data.bookings.find(b => b.id === xss.data.id);
check(stored && stored.first_name === "<img src=x onerror=alert(1)>", "le texte est gardé tel quel (échappé à l'affichage, jamais interprété)");
check((await call("GET", "/api/admin/bookings")).status === 401, "liste des demandes fermée sans jeton");
const mails = (await (await fetch(MOCK + "/")).json()).calls.filter(c => c.path === "/emails");
check(mails.length >= 1 && /Awa Ndiaye/.test(mails[0].body) && /"reply_to":"awa@example.com"/.test(mails[0].body), "notification envoyée au photographe, réponse directe au client", mails.length);

console.log("Disponibilités et double réservation");
const av0 = await call("GET", "/api/availability");
check(av0.status === 200 && Array.isArray(av0.data.busy) && !av0.data.busy.includes(good.date), "date libre tant que rien n'est confirmé");
check((await call("PATCH", `/api/admin/bookings/${b1.data.id}`, { token: A, body: { status: "confirmed" } })).status === 200, "demande confirmée");
const av1 = (await call("GET", "/api/availability")).data;
check(av1.busy.includes(good.date) && !JSON.stringify(av1).includes("Awa"), "date confirmée affichée comme prise, sans aucun nom");
const b2 = await call("POST", "/api/booking", { body: { ...good, first_name: "Moussa", email: "m@example.com" }, ip: "10.2.0.1" });
check(b2.status === 201 && b2.data.busy === true, "nouvelle demande sur une date prise : acceptée mais signalée");
const conf2 = await call("PATCH", `/api/admin/bookings/${b2.data.id}`, { token: A, body: { status: "confirmed" } });
check(conf2.status === 409 && conf2.data.error === "date_taken", "double réservation refusée");
check((await call("PATCH", `/api/admin/bookings/${b2.data.id}`, { token: A, body: { status: "confirmed", force: true } })).status === 200, "double réservation possible seulement en forçant");
check((await call("PUT", `/api/admin/blocked/${day(40)}`, { token: A, body: { note: "Voyage" } })).status === 200 && (await call("GET", "/api/availability")).data.busy.includes(day(40)), "jour bloqué = pris");
check((await call("PUT", "/api/admin/blocked/2026-13-45", { token: A, body: {} })).status === 400, "date de blocage invalide refusée");
const calv = (await call("GET", `/api/admin/calendar?from=${day(0)}&to=${day(60)}`, { token: A })).data;
check(calv.bookings.length >= 2 && calv.blocked.length === 1, "calendrier : demandes et jours bloqués");

console.log("Clients, archives, historique");
const C = (await call("POST", "/api/admin/clients", { token: A, body: { name: "La Forge", email: "coach@example.com" } })).data.client;
check(C && C.id, "fiche client créée");
check((await call("POST", "/api/admin/clients", { token: A, body: { name: "X", email: "faux" } })).status === 400, "courriel client invalide refusé");
const G = (await call("POST", "/api/admin/galleries", { token: A, body: { title: "Media Day", kind: "private", allow_download: 1 } })).data.gallery;
const bytes = Buffer.from("fake-jpeg-" + "x".repeat(2000));
const meta = { name: "IMG_0001.jpg", size: bytes.length, mime: "image/jpeg", crc32: zlib.crc32(bytes), w: 100, h: 150 };
const ph = (await call("POST", `/api/admin/galleries/${G.id}/photos`, { token: A, body: meta })).data;
await call("PUT", `/api/admin/photos/${ph.id}/original`, { token: A, raw: bytes, headers: { "Content-Type": "image/jpeg" } });
await call("PUT", `/api/admin/photos/${ph.id}/preview`, { token: A, raw: bytes, headers: { "Content-Type": "image/jpeg" } });
await call("PUT", `/api/admin/photos/${ph.id}/thumb`, { token: A, raw: bytes, headers: { "Content-Type": "image/jpeg" } });
check((await call("POST", `/api/admin/photos/${ph.id}/done`, { token: A, body: {} })).status === 200, "photo de test envoyée");
const up = await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { client_id: C.id } });
check(up.status === 200 && up.data.gallery.clientId === C.id, "galerie reliée au client");
check((await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { client_id: "inexistant" } })).status === 400, "client inconnu refusé");
const un = await call("POST", `/api/g/${G.slug}/unlock`, { body: {} });
const V = un.data.token;
const pl = await call("GET", `/api/g/${G.slug}/photos`, { token: V });
check(pl.status === 200 && pl.data.gallery.selections === true, "galerie ouverte, envoi de sélection disponible");

console.log("Sélections");
const s1 = await call("POST", `/api/g/${G.slug}/selection`, { token: V, body: { ids: [ph.id, "inconnu"], name: "Coach", email: "coach@example.com", purpose: "retouch", note: "Retouche de la peau" } });
check(s1.status === 201 && s1.data.count === 1, "sélection reçue (les photos inconnues sont ignorées)", s1.data);
check((await call("POST", `/api/g/${G.slug}/selection`, { body: { ids: [ph.id] } })).status === 401, "sélection impossible sans accès à la galerie");
const sl = (await call("GET", "/api/admin/selections", { token: A })).data.selections;
check(sl.length === 1 && sl[0].names[0] === "IMG_0001.jpg" && sl[0].purpose === "retouch", "administration : noms de fichiers prêts pour Lightroom");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { selections_open: false } });
check((await call("POST", `/api/g/${G.slug}/selection`, { token: V, body: { ids: [ph.id] } })).data.error === "selections_closed", "envoi fermé quand le photographe le désactive");
const cd = (await call("GET", `/api/admin/clients/${C.id}`, { token: A })).data;
check(cd.galleries.length === 1 && cd.history.some(h => h.kind === "view") && cd.history.some(h => h.kind === "selection"), "historique des livraisons du client", cd.history.map(h => h.kind));
const oUrl = pl.data.photos[0].o;
const zipPart = (await call("POST", `/api/g/${G.slug}/zip`, { token: V, body: { all: true } })).data.parts[0];
check(oUrl && (await fetch(oUrl)).status === 200 && (await fetch(zipPart.url)).status === 200, "avant l'archivage : téléchargement et ZIP fonctionnent");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { archived: true } });
check((await fetch(oUrl)).status === 410 && (await fetch(zipPart.url)).status === 410, "archivée : les liens de téléchargement et de ZIP déjà émis sont fermés");
const arch = await call("GET", `/api/g/${G.slug}`);
check(arch.status === 410 && arch.data.archived === true, "galerie archivée : fermée aux visiteurs");
check((await call("GET", `/api/g/${G.slug}/photos`, { token: V })).status === 410, "archivée : photos fermées même avec un ancien jeton");
const ov = (await call("GET", "/api/admin/overview", { token: A })).data.galleries.find(g => g.id === G.id);
check(ov.archived && ov.client_name === "La Forge", "tableau de bord : archivée et client affichés");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { archived: false } });
check((await call("GET", `/api/g/${G.slug}`)).status === 200, "désarchivée : de nouveau ouverte, fichiers intacts");

console.log("Statistiques sans témoin");
await call("POST", "/api/hit", { raw: JSON.stringify({ p: "/", d: "mobile" }), headers: { "Content-Type": "text/plain" } });
await call("POST", "/api/hit", { raw: JSON.stringify({ p: "/projets/bashment/", d: "desktop" }), headers: { "Content-Type": "text/plain" } });
await call("POST", "/api/hit", { raw: JSON.stringify({ p: "/", d: "mobile" }), headers: { "Content-Type": "text/plain", "Sec-GPC": "1" } });
await call("POST", "/api/hit", { raw: JSON.stringify({ p: "/wp-admin/<x>", d: "mobile" }), headers: { "Content-Type": "text/plain" } });
await call("POST", "/api/hit", { raw: JSON.stringify({ p: "@book-open", d: "tablet" }), headers: { "Content-Type": "text/plain" } });
const st = (await call("GET", "/api/admin/stats?days=7", { token: A })).data;
const total = st.perDay.reduce((s, x) => s + x.n, 0);
check(total === 2 && st.pages.some(p => p.path === "/projets/bashment/") && st.pages.some(p => p.path === "@book-open"), "pages comptées ; Global Privacy Control respecté ; adresses inconnues ignorées", st);
check(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(JSON.stringify(st)) && !/"ip"/i.test(JSON.stringify(st)), "aucune adresse IP dans les statistiques");

console.log("Contenu du portfolio (GitHub imité)");
const cg = await call("GET", "/api/admin/content", { token: A });
check(cg.status === 200 && cg.data.portfolio.data.chapters[0].id === "soirees", "lecture des fichiers de contenu");
const port = cg.data.portfolio.data; port.alt = { "1": { fr: "La foule danse", en: "The crowd dances" } };
const put = await call("PUT", "/api/admin/content", { token: A, body: { file: "portfolio", data: port, sha: cg.data.portfolio.sha } });
check(put.status === 200 && put.data.sha, "enregistrement = commit sur la branche du pipeline", put.data);
check((await call("PUT", "/api/admin/content", { token: A, body: { file: "portfolio", data: port, sha: cg.data.portfolio.sha } })).data.error === "content_changed", "conflit détecté si le fichier a changé entre-temps");
const dup = JSON.parse(JSON.stringify(port)), dp = dup.chapters[0].projects[0], de = (dp.eds || [dp])[0]; de.imgs.push(de.imgs[0]);
check((await call("PUT", "/api/admin/content", { token: A, body: { file: "portfolio", data: dup, sha: put.data.sha } })).data.error === "invalid_content", "photo en double refusée");
const badId = JSON.parse(JSON.stringify(port)); badId.chapters[0].projects[0].id = "../evil";
check((await call("PUT", "/api/admin/content", { token: A, body: { file: "portfolio", data: badId, sha: put.data.sha } })).data.error === "invalid_content", "identifiant dangereux refusé");
check((await call("PUT", "/api/admin/content", { token: A, body: { file: "../../.github/workflows/x", data: {}, sha: "" } })).data.error === "bad_file", "seuls les trois fichiers de contenu sont modifiables");
const site = cg.data.site.data; site.api = "javascript:alert(1)";
check((await call("PUT", "/api/admin/content", { token: A, body: { file: "site", data: site, sha: cg.data.site.sha } })).data.error === "invalid_content", "adresse de serveur non https refusée");
check((await call("GET", "/api/admin/content")).status === 401, "contenu fermé sans jeton admin");
const ghCalls = (await (await fetch(MOCK + "/")).json()).calls.filter(c => c.path.includes("/contents/"));
check(ghCalls.every(c => c.auth.startsWith("Bearer gh_test")), "le jeton GitHub reste côté serveur");

console.log("Prix et changement de date");
const pr = await call("PATCH", `/api/admin/bookings/${b1.data.id}`, { token: A, body: { price_cents: 50000, deposit_cents: 15000, currency: "CAD" } });
check(pr.status === 200 && pr.data.booking.price_cents === 50000, "prix modifiable sur une demande déjà confirmée", pr.data);
check((await call("PATCH", `/api/admin/bookings/${b2.data.id}`, { token: A, body: { date: day(40) } })).data.error === "date_taken", "déplacer une demande confirmée vers un jour pris : refusé");

console.log(`\n${ok} réussis, ${bad} échoués`);
process.exit(bad ? 1 : 0);
