// Test de bout en bout de l'API (banc d'essai local).
// Lancer d'abord : node test/devserver.mjs 8787 <dir> (avec SINGLE_MAX/PART_SIZE petits)
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

console.log("Expiration et nettoyage");
await call("PATCH", `/api/admin/galleries/${G.id}`, { token: A, body: { expires_at: Math.floor(Date.now() / 1000) - 10 } });
check((await call("GET", `/api/g/${G.slug}`)).status === 410, "galerie expirée : page fermée");
check((await call("GET", ph0.o)).status === 410, "galerie expirée : originaux fermés");
// Tâche quotidienne : sans « supprimer à l'expiration », une galerie expirée garde ses fichiers.
const cron = JSON.parse(execFileSync("curl", ["-s", API.replace(/:(\d+)$/, (_, p) => ":" + (+p + 1))]).toString());
check(cron.galleriesDeleted === 0 && cron.staleUploads === 0, "tâche quotidienne : galerie expirée conservée sans suppression automatique", cron);

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
