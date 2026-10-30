// Test de bout en bout de l'API (banc d'essai local + imitation Rekognition).
// Lancer d'abord : node test/devserver.mjs 8787 <dir> (avec SINGLE_MAX/PART_SIZE petits) et python3 test/mock_rekognition.py 9911
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const API = process.env.API || "http://127.0.0.1:8787";
const SRC = process.argv.slice(2);
let ok = 0, bad = 0;
const check = (cond, label, extra) => { if (cond) { ok++; console.log("  ✓", label); } else { bad++; console.log("  ✗", label, extra ?? ""); } };
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
async function call(method, path, { token, body, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = "Bearer " + token;
  let b = raw;
  if (body !== undefined) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await fetch(path.startsWith("http") ? path : API + path, { method, headers: h, body: b });
  const type = r.headers.get("content-type") || "";
  const data = type.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer());
  return { status: r.status, data, headers: r.headers };
}

async function upload(adminTok, gid, file, { replaceId } = {}) {
  const bytes = fs.readFileSync(file);
  const meta = { name: file.split("/").pop(), size: bytes.length, mime: file.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream", crc32: zlib.crc32(bytes), mtime: Date.now(), w: 1200, h: 1800 };
  const c = replaceId ? await call("POST", `/api/admin/photos/${replaceId}/replace`, { token: adminTok, body: meta }) : await call("POST", `/api/admin/galleries/${gid}/photos`, { token: adminTok, body: meta });
  if (c.status >= 300) throw new Error("create " + JSON.stringify(c.data));
  const id = c.data.id;
  if (c.data.mode === "single") {
    const r = await call("PUT", `/api/admin/photos/${id}/original`, { token: adminTok, raw: bytes, headers: { "Content-Type": meta.mime } });
    if (r.status !== 200) throw new Error("put " + JSON.stringify(r.data));
  } else {
    const m = await call("POST", `/api/admin/photos/${id}/mpu`, { token: adminTok, body: {} });
    const parts = [];
    for (let n = 1; n <= m.data.parts; n++) {
      const chunk = bytes.subarray((n - 1) * m.data.partSize, n * m.data.partSize);
      const r = await call("PUT", `/api/admin/photos/${id}/mpu/${m.data.uploadId}/${n}`, { token: adminTok, raw: chunk });
      if (r.status !== 200) throw new Error("part " + JSON.stringify(r.data));
      parts.push(r.data);
    }
    const r = await call("POST", `/api/admin/photos/${id}/mpu/${m.data.uploadId}/complete`, { token: adminTok, body: { parts } });
    if (r.status !== 200) throw new Error("complete " + JSON.stringify(r.data));
  }
  if (meta.mime === "image/jpeg") {
    await call("PUT", `/api/admin/photos/${id}/preview`, { token: adminTok, raw: bytes, headers: { "Content-Type": "image/jpeg" } });
    await call("PUT", `/api/admin/photos/${id}/thumb`, { token: adminTok, raw: bytes, headers: { "Content-Type": "image/jpeg" } });
  }
  const d = await call("POST", `/api/admin/photos/${id}/done`, { token: adminTok, body: {} });
  if (d.status !== 200) throw new Error("done " + JSON.stringify(d.data));
  return { id, bytes, meta, mode: c.data.mode };
}

console.log("Administration");
check((await call("POST", "/api/admin/login", { body: { password: "faux" } })).status === 401, "mauvais mot de passe refusé");
const A = (await call("POST", "/api/admin/login", { body: { password: "motdepasse-de-test" } })).data.token;
check(!!A, "connexion admin");
check((await call("GET", "/api/admin/overview")).status === 401, "API admin fermée sans jeton");
const cors = await fetch(API + "/api/admin/overview", { method: "OPTIONS", headers: { Origin: "http://localhost:8765", "Access-Control-Request-Method": "GET" } });
check(cors.headers.get("access-control-allow-origin") === "http://localhost:8765", "CORS pour le site");
const corsBad = await fetch(API + "/api/admin/overview", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
check(!corsBad.headers.get("access-control-allow-origin"), "CORS refusé pour un autre site");

const G = (await call("POST", "/api/admin/galleries", { token: A, body: { title: "Test Événement", kind: "event", password: "fete2026", event_date: "2026-10-30", listed: 1 } })).data.gallery;
check(G && G.slug.length === 22 && !("pass_hash" in G) && G.hasPassword, "galerie créée, lien unique, mot de passe masqué");

console.log("Import");
const up = [];
for (const f of SRC) up.push(await upload(A, G.id, f));
check(up.some(u => u.mode === "multipart") && up.some(u => u.mode === "single"), "import simple et en plusieurs parties", up.map(u => u.mode));

console.log("Accès visiteur");
const meta = await call("GET", `/api/g/${G.slug}`);
check(meta.status === 200 && meta.data.needsPassword && meta.data.count === SRC.length && !meta.data.cover, "métadonnées sans couverture tant que verrouillée");
check((await call("GET", `/api/g/${G.slug}/photos`)).status === 401, "photos fermées sans jeton");
check((await call("POST", `/api/g/${G.slug}/unlock`, { body: { password: "nope" } })).status === 401, "mauvais mot de passe de galerie refusé");
const V = (await call("POST", `/api/g/${G.slug}/unlock`, { body: { password: "fete2026" } })).data.token;
const list = await call("GET", `/api/g/${G.slug}/photos`, { token: V });
check(list.status === 200 && list.data.photos.length === SRC.length, "liste des photos");
check((await call("GET", `/api/g/${"x".repeat(22)}/photos`, { token: V })).status === 404, "jeton inutilisable sur une autre galerie");

check(!("client" in meta.data), "nom du client masqué tant que la galerie est verrouillée");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { password: "nouveau2026" } });
check((await call("GET", `/api/g/${G.slug}/photos`, { token: V })).status === 401, "changer le mot de passe ferme les sessions ouvertes");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { password: "fete2026" } });
const V1 = (await call("POST", `/api/g/${G.slug}/unlock`, { body: { password: "fete2026" } })).data.token;
check((await call("GET", `/api/g/${G.slug}/photos`, { token: V1 })).status === 200, "nouvelle session après le nouveau mot de passe");
console.log("Originaux");
for (const u of up) {
  const ph = list.data.photos.find(x => x.id === u.id);
  const r = await call("GET", ph.o);
  check(r.status === 200 && sha(r.data) === sha(u.bytes), `original identique octet par octet : ${u.meta.name}`);
  check((r.headers.get("content-disposition") || "").includes(encodeURIComponent(u.meta.name)), "nom de fichier d'origine");
}
const ph0 = list.data.photos.find(x => x.t), b0 = up.find(u => u.id === ph0.id).bytes;
const rg = await call("GET", ph0.o, { headers: { Range: "bytes=100-1099" } });
check(rg.status === 206 && rg.data.length === 1000 && sha(rg.data) === sha(b0.subarray(100, 1100)), "reprise de téléchargement (Range)");
const forged = ph0.o.replace(/s=[^&]+/, "s=AAAAAAAAAAAAAAAAAAAAAAAA");
check((await call("GET", forged)).status === 403, "URL falsifiée refusée");
const thumb = await call("GET", ph0.t);
check(thumb.status === 200 && thumb.data.length > 1000, "aperçu servi");

console.log("ZIP");
const z = await call("POST", `/api/g/${G.slug}/zip`, { token: V1, body: { all: true } });
check(z.status === 200 && z.data.parts.length === 1, "ticket ZIP");
const zr = await call("GET", z.data.parts[0].url);
fs.writeFileSync("/tmp/claude-test.zip", zr.data);
check(+zr.headers.get("content-length") === zr.data.length, "taille du ZIP annoncée exacte");
const py = execFileSync("python3", ["-c", `
import zipfile, hashlib, json
z = zipfile.ZipFile('/tmp/claude-test.zip'); bad = z.testzip()
print(json.dumps({'bad': bad, 'files': {i.filename: hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}, 'stored': all(i.compress_type == 0 for i in z.infolist())}))`]).toString();
const zi = JSON.parse(py);
check(zi.bad === null && zi.stored, "ZIP valide (CRC vérifiés), sans compression");
check(up.every(u => zi.files[u.meta.name] === sha(u.bytes)), "chaque fichier du ZIP identique à l'original");
const zsel = await call("POST", `/api/g/${G.slug}/zip`, { token: V1, body: { ids: [up[0].id] } });
check(zsel.data.parts[0].count === 1, "ZIP d'une sélection");

console.log("Remplacement et suppression");
const rep = await upload(A, G.id, SRC[0], { replaceId: up[1].id });
const list2 = await call("GET", `/api/g/${G.slug}/photos`, { token: V1 });
const repPh = list2.data.photos.find(x => x.id === up[1].id);
check(repPh && repPh.name === rep.meta.name && sha((await call("GET", repPh.o)).data) === sha(rep.bytes), "photo remplacée (même lien, nouveau fichier)");

console.log("Galerie restreinte");
const R = (await call("POST", "/api/admin/galleries", { token: A, body: { title: "Client restreint", kind: "restricted" } })).data.gallery;
const r1 = await upload(A, R.id, SRC[0]), r2 = await upload(A, R.id, SRC[0]);
const guest = (await call("POST", `/api/admin/galleries/${R.id}/guests`, { token: A, body: { name: "Awa" } })).data.guest;
await call("PUT", `/api/admin/guests/${guest.id}/photos`, { token: A, body: { ids: [r1.id] } });
check((await call("POST", `/api/g/${R.slug}/unlock`, { body: {} })).status === 401, "code invité obligatoire");
const VG = (await call("POST", `/api/g/${R.slug}/unlock`, { body: { code: guest.code } })).data.token;
const rl = (await call("GET", `/api/g/${R.slug}/photos`, { token: VG })).data.photos;
const a1 = rl.find(x => x.id === r1.id), a2 = rl.find(x => x.id === r2.id);
check(a1.o && !a2.o && a1.mine, "seule la photo attribuée est téléchargeable");
check((await call("GET", a1.o.replace(`/${r1.id}?`, `/${r2.id}?`))).status === 403, "impossible de détourner le lien vers une photo non attribuée");
const rz = await call("POST", `/api/g/${R.slug}/zip`, { token: VG, body: { all: true } });
check(rz.data.parts[0].count === 1, "le ZIP ne contient que les photos autorisées");

console.log("Reconnaissance faciale (imitation)");
const J = up.find(u => u.meta.mime === "image/jpeg" && u.id !== up[1].id), RAWF = up.find(u => u.meta.mime !== "image/jpeg");
check((await call("POST", `/api/g/${G.slug}/faces/search`, { token: V1, raw: J.bytes, headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } })).status === 409, "recherche fermée tant que désactivée");
check((await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { face_enabled: 1 } })).status === 400, "activation refusée sans attestation de consentement");
const en = await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { face_enabled: 1, face_ack: true, face_note: "Test local", face_threshold: 92 } });
check(en.status === 200 && en.data.gallery.face_enabled === 1, "activation avec attestation");
let ix, rounds = 0;
do { ix = await call("POST", `/api/admin/galleries/${G.id}/faces/index`, { token: A, body: { max: 2 } }); rounds++; } while (ix.status === 200 && ix.data.remaining > 0 && rounds < 10);
check(ix.status === 200 && ix.data.remaining === 0, "indexation par lots", ix.data);
const V2 = (await call("POST", `/api/g/${G.slug}/unlock`, { body: { password: "fete2026" } })).data.token;
check((await call("POST", `/api/g/${G.slug}/faces/search`, { token: V2, raw: J.bytes, headers: { "Content-Type": "image/jpeg" } })).status === 400, "consentement exigé");
const fs1 = await call("POST", `/api/g/${G.slug}/faces/search`, { token: V2, raw: J.bytes, headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } });
check(fs1.status === 200 && fs1.data.matches[0] && fs1.data.matches[0].id === J.id && fs1.data.matches[0].s === 100, "la bonne photo arrive en tête", fs1.data);
const noface = await call("POST", `/api/g/${G.slug}/faces/search`, { token: V2, raw: Buffer.alloc(1500, 1), headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } });
check(noface.status === 422 && noface.data.error === "no_face", "message clair si aucun visage");
const badimg = await call("POST", `/api/g/${G.slug}/faces/search`, { token: V2, raw: RAWF.bytes.subarray(0, 4000), headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } });
check(badimg.status === 415 && badimg.data.error === "bad_image", "image illisible : message clair");
const fg = await call("POST", `/api/g/${G.slug}/faces/forget`, { token: V2, raw: J.bytes, headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } });
check(fg.status === 200 && fg.data.removed >= 1, "« effacer mon visage » retire l'index");
const fs2 = await call("POST", `/api/g/${G.slug}/faces/search`, { token: V2, raw: J.bytes, headers: { "Content-Type": "image/jpeg", "X-Consent": "1" } });
check(!fs2.data.matches.some(m => m.id === J.id && m.s === 100), "plus retrouvé après effacement");
const mock = await (await fetch("http://127.0.0.1:9911/")).json();
check(mock.calls.length > 0 && mock.calls.every(c => c.signed), "toutes les requêtes AWS signées SigV4 (région Canada)");
check(!fs.readdirSync(process.env.DATA + "/r2").some(n => n.includes("selfie")) && (await call("GET", "/api/admin/overview", { token: A })).status === 200, "aucun selfie stocké");

console.log("Expiration et nettoyage");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { face_retention_days: 1 } });
const det = (await call("GET", `/api/admin/galleries/${G.id}`, { token: A })).data;
check(det.gallery.nfaces > 0 && det.gallery.face_until, "index présent avec date d'effacement");
// Simule la fin de conservation : on avance face_until dans la base via l'API admin (rétention 1 jour), puis on lance la tâche.
execFileSync("node", ["--no-warnings", "-e", `const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(${JSON.stringify(process.env.DATA + "/db.sqlite")});d.prepare("UPDATE galleries SET face_until=1 WHERE id=?").run(${JSON.stringify(G.id)});`]);
const cron = JSON.parse(execFileSync("curl", ["-s", API.replace(/:(\d+)$/, (_, p) => ":" + (+p + 1))]).toString());
check(cron.faceIndexesDeleted === 1, "tâche quotidienne : index des visages effacé à échéance", cron);
const det2 = (await call("GET", `/api/admin/galleries/${G.id}`, { token: A })).data;
check(det2.gallery.nfaces === 0 && !det2.gallery.face_until, "plus aucun visage en base");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { expires_at: Math.floor(Date.now() / 1000) - 10 } });
check((await call("GET", `/api/g/${G.slug}`)).status === 410, "galerie expirée : page fermée");
check((await call("GET", ph0.o)).status === 410, "galerie expirée : originaux fermés");

console.log("Limites et suppression");
let last;
for (let i = 0; i < 11; i++) last = await call("POST", `/api/g/${R.slug}/unlock`, { body: { code: "mauvais" } });
check(last.status === 429, "trop d'essais : blocage temporaire");
const ov = (await call("GET", "/api/admin/overview", { token: A })).data;
check(ov.galleries.length === 2 && ov.totals.bytes > 0, "tableau de bord : galeries et stockage");
await call("DELETE", `/api/admin/galleries/${R.id}`, { token: A });
check(!fs.readdirSync(process.env.DATA + "/r2").some(n => decodeURIComponent(n).startsWith(`g/${R.id}/`)), "suppression : fichiers effacés du stockage");

console.log(`\n${ok} réussis, ${bad} échoués`);
process.exit(bad ? 1 : 0);
