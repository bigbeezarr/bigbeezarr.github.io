// Contenu du portfolio : lecture et enregistrement des fichiers content/*.json du dépôt (API GitHub), contrôle identique
// à celui de build.py (une photo du catalogue meta.json sert exactement une fois, aucun numéro inconnu), et ajout de
// photos au site depuis l'administration (ordinateur ou galerie client : c'est la seule voie, toujours explicite).
//
// Chaque enregistrement est UN commit (API « git data ») : plusieurs fichiers changent ensemble ou pas du tout,
// et la mise à jour de la branche refuse tout ce qui n'est pas une avance rapide (conflit = 409, rien n'est écrit).
import { fail, json, readJson } from "./util.js";

export const FILES = { portfolio: "content/portfolio.json", home: "content/home.json", site: "content/site.json" };
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;
const MAX_PHOTO = 3 * 1024 * 1024, LONG_MAX = 1800, LONG_MIN = 300;
const pad = i => String(i).padStart(3, "0");
const oneLine = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);

function gh(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) fail(501, "content_not_configured");
  return { api: env.GITHUB_API || "https://api.github.com", repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || "source", site: env.GITHUB_SITE_BRANCH || "main",
    h: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "bbz-galerie", "X-GitHub-Api-Version": "2022-11-28" } };
}
const bytesB64 = b => { let x = ""; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(x); };
const b64 = s => bytesB64(new TextEncoder().encode(s));
const unb64Bytes = s => Uint8Array.from(atob(String(s).replace(/\s/g, "")), c => c.charCodeAt(0));
const unb64 = s => new TextDecoder().decode(unb64Bytes(s));
async function call(g, method, path, body) {
  const r = await fetch(`${g.api}/repos/${g.repo}/${path}`, { method, headers: body ? { ...g.h, "Content-Type": "application/json" } : g.h, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { r, j };
}
async function readFile(g, path, ref) {
  const { r, j } = await call(g, "GET", `contents/${path}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (!r.ok) fail(502, "github_error", { status: r.status, file: path });
  return { sha: j.sha, text: j.content != null ? (j.encoding === "base64" ? unb64(j.content) : j.content) : null };
}
async function headOf(g, branch) {
  const { r, j } = await call(g, "GET", `git/ref/heads/${encodeURIComponent(branch)}`);
  if (!r.ok) fail(502, "github_error", { status: r.status, branch });
  return j.object.sha;
}
// files : [{ path, text | bytes, expect }] ; expect = sha attendu, null = le fichier ne doit pas exister, undefined = sans contrôle.
async function commitFiles(g, branch, files, message, head) {
  head ||= await headOf(g, branch);
  for (const f of files) {
    if (f.expect === undefined) continue;
    const cur = await readFile(g, f.path, head);
    if ((cur ? cur.sha : null) !== (f.expect || null)) fail(409, "content_changed", { file: f.path });
  }
  const tree = [];
  for (const f of files) {
    const { r, j } = await call(g, "POST", "git/blobs", { content: f.bytes ? bytesB64(f.bytes) : b64(f.text), encoding: "base64" });
    if (!r.ok) fail(502, "github_error", { status: r.status });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: j.sha });
  }
  const c0 = await call(g, "GET", `git/commits/${head}`);
  if (!c0.r.ok) fail(502, "github_error", { status: c0.r.status });
  const t = await call(g, "POST", "git/trees", { base_tree: c0.j.tree.sha, tree });
  if (!t.r.ok) fail(502, "github_error", { status: t.r.status });
  const c = await call(g, "POST", "git/commits", { message, tree: t.j.sha, parents: [head],
    author: { name: "Administration BIGBEEZARR", email: "41898282+github-actions[bot]@users.noreply.github.com" } });
  if (!c.r.ok) fail(502, "github_error", { status: c.r.status });
  const u = await call(g, "PATCH", `git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.j.sha, force: false });
  if (u.r.status === 409 || u.r.status === 422) fail(409, "content_changed"); // la branche a bougé entre-temps
  if (!u.r.ok) fail(502, "github_error", { status: u.r.status });
  return { commit: c.j.sha, shas: Object.fromEntries(files.map((f, k) => [f.path, tree[k].sha])) };
}

// ---------------- lecture ----------------
const parseMeta = text => { try { const m = JSON.parse(text); if (m && typeof m === "object" && !Array.isArray(m)) return m; } catch {} fail(502, "github_error", { file: "meta.json" }); };
export async function getContent(env) {
  const g = gh(env), head = await headOf(g, g.branch), out = {};
  for (const [k, path] of Object.entries(FILES)) {
    const f = await readFile(g, path, head);
    if (!f) fail(502, "github_error", { status: 404, file: path });
    out[k] = { sha: f.sha, data: JSON.parse(f.text) };
  }
  // catalogue des photos : numéro → [largeur, hauteur] (orientation, recadrage de la sélection, numéros inconnus)
  const m = await readFile(g, "meta.json", head);
  out.meta = m ? Object.fromEntries(Object.entries(parseMeta(m.text)).map(([k, v]) => [k, [v.w, v.h]])) : null;
  return json(out);
}

// ---------------- contrôle (le même que build.py, en plus strict sur la forme) ----------------
const isT = v => typeof v === "string" || (v && typeof v === "object" && !Array.isArray(v) && typeof (v.fr ?? "") === "string" && typeof (v.en ?? "") === "string");
const isId = i => Number.isInteger(i) && i >= 0 && i <= 99999;
const err = m => fail(400, "invalid_content", { detail: m });
export const edsOf = p => p.eds || [p];
export const photosOf = p => { const s = new Set(); for (const e of edsOf(p)) { (e.imgs || []).forEach(i => s.add(i)); if (e.feature) s.add(e.feature.img); } if (p.lead) s.add(p.lead.img); return s; };
export function validateContent(file, d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) err("contenu illisible");
  const ids = new Set();
  const imgList = (a, where) => { if (!Array.isArray(a) || a.some(i => !isId(i))) err(`photos invalides : ${where}`); a.forEach(i => { if (ids.has(i)) err(`photo ${i} utilisée deux fois (${where})`); ids.add(i); }); };
  if (file === "portfolio") {
    const pids = new Set();
    if (!Array.isArray(d.chapters) || !d.chapters.length || d.chapters.length > 30) err("chapitres manquants");
    const cids = new Set();
    for (const c of d.chapters) {
      if (!c || !/^[a-z0-9-]{1,40}$/.test(c.id || "") || cids.has(c.id)) err(`identifiant de chapitre invalide : ${c && c.id}`);
      cids.add(c.id);
      if (!isT(c.name)) err(`nom du chapitre ${c.id}`);
      if (!Array.isArray(c.projects)) err(`projets du chapitre ${c.id}`);
      for (const p of c.projects) {
        if (!p || !/^[a-z0-9-]{1,40}$/.test(p.id || "") || pids.has(p.id)) err(`identifiant de projet invalide ou en double : ${p && p.id}`);
        pids.add(p.id);
        if (!isT(p.title)) err(`titre du projet ${p.id}`);
        if (p.hidden != null && typeof p.hidden !== "boolean") err(`« Publié sur le site » du projet ${p.id}`);
        if (p.featured != null && !(Number.isInteger(p.featured) && p.featured >= 1 && p.featured <= 5)) err(`rang « à la une » du projet ${p.id} (1 à 5)`);
        if (p.series && p.series.known != null && !(Number.isInteger(p.series.known) && p.series.known >= 1 && p.series.known <= 100000)) err(`nombre d'éditions connues du projet ${p.id}`);
        if (p.eds != null && (!Array.isArray(p.eds) || !p.eds.length)) err(`éditions du projet ${p.id} : au moins une`);
        if (p.eds && p.imgs) err(`projet ${p.id} : photos à la fois dans le projet et dans ses éditions`);
        edsOf(p).forEach((e, k) => {
          if (!e || typeof e !== "object") err(`édition ${p.id} #${k + 1}`);
          imgList(e.imgs, `${p.title && (p.title.fr || p.title)} · édition ${k + 1}`);
          if (e.feature) { if (!isId(e.feature.img)) err(`photo vedette de ${p.id}`); imgList([e.feature.img], `${p.id} vedette`); }
          if (e !== p && e.hidden != null && typeof e.hidden !== "boolean") err(`« Publiée sur le site » de l'édition ${k + 1} de ${p.id}`);
          for (const t of ["label", "sub"]) if (e[t] != null && !isT(e[t])) err(`${t} de l'édition ${k + 1} de ${p.id}`);
          if (e.year != null && !["string", "number"].includes(typeof e.year)) err(`année de l'édition ${k + 1} de ${p.id}`);
        });
        if (p.lead) { if (!isId(p.lead.img)) err(`photo d'ouverture de ${p.id}`); imgList([p.lead.img], `${p.id} ouverture`); }
        if (!p.hidden && edsOf(p).some(e => !e.hidden) && !edsOf(p).some(e => !e.hidden && ((e.imgs || []).length || e.feature)))
          err(`le projet ${p.id} est publié sans aucune photo publiée : ajoutez des photos ou désactivez « Publié sur le site »`);
        const mine = photosOf(p);
        if (p.cover != null && (!isId(p.cover) || !mine.has(p.cover))) err(`couverture du projet ${p.id} : la photo ${p.cover} n'est pas dans ce projet`);
        if (p.selection != null) {
          if (!Array.isArray(p.selection) || p.selection.length > 8 || p.selection.some(i => !isId(i))) err(`sélection du projet ${p.id} : 8 photos au plus`);
          if (new Set(p.selection).size !== p.selection.length) err(`sélection du projet ${p.id} : photo en double`);
          const out = p.selection.find(i => !mine.has(i)); if (out != null) err(`sélection du projet ${p.id} : la photo ${out} n'est pas dans ce projet`);
        }
        if (p.selFocus != null) {
          if (typeof p.selFocus !== "object" || Array.isArray(p.selFocus)) err(`recadrage de la sélection de ${p.id}`);
          for (const [k, v] of Object.entries(p.selFocus)) if (!/^\d{1,5}$/.test(k) || !mine.has(+k) || typeof v !== "number" || !(v >= 0 && v <= 100)) err(`recadrage de la photo ${k} (${p.id}) : 0 à 100, photo du projet`);
        }
        if (p.homePicks != null) {
          if (typeof p.homePicks !== "object" || Array.isArray(p.homePicks)) err(`photos d'accueil de ${p.id}`);
          for (const [y, l] of Object.entries(p.homePicks)) {
            if (!Array.isArray(l) || l.length > 10 || l.some(i => !isId(i))) err(`photos d'accueil de ${p.id} (${y}) : 10 au plus`);
            const out = l.find(i => !mine.has(i)); if (out != null) err(`photos d'accueil de ${p.id} (${y}) : la photo ${out} n'est pas dans ce projet`);
          }
        }
      }
    }
    if (d.unpublished != null) imgList(d.unpublished, "photos retirées");
    if (d.alt && (typeof d.alt !== "object" || Object.values(d.alt).some(v => !isT(v)))) err("textes alternatifs");
    if ([...JSON.stringify(d)].length > 1500000) err("contenu trop volumineux");
  } else if (file === "home") {
    imgList(d.hero, "accueil (photos d'ouverture)"); imgList(d.about, "accueil (à propos)"); imgList(d.wall, "coups de cœur");
    if (!d.hero.length) err("l'accueil a besoin d'au moins une photo d'ouverture");
    if (!isId(d.me)) err("portrait (me)"); imgList([d.me], "portrait");
    if (d.heroLab != null && (typeof d.heroLab !== "object" || Array.isArray(d.heroLab))) err("légendes des photos d'ouverture");
    if ([...JSON.stringify(d)].length > 300000) err("contenu trop volumineux");
  } else if (file === "site") {
    if (d.email && !EMAIL.test(d.email)) err("courriel du site");
    if (d.api && !/^https:\/\/[a-z0-9.-]+(\/[^\s"'<>]*)?$/i.test(d.api)) err("adresse du serveur");
    if (d.turnstile && !/^[0-9A-Za-z_-]{10,100}$/.test(d.turnstile)) err("clé publique Turnstile");
  } else fail(400, "bad_file");
}
// Chaque photo du catalogue sert exactement une fois : éditions (même masquées), photos retirées, accueil.
export function validateUsage(port, home, metaIds) {
  const where = new Map(), dup = [];
  const add = (i, w) => { if (where.has(i)) dup.push(`photo ${i} utilisée deux fois (${where.get(i)} et ${w})`); else where.set(i, w); };
  for (const c of port.chapters) for (const p of c.projects) {
    const t = typeof p.title === "string" ? p.title : (p.title.fr || p.id);
    edsOf(p).forEach((e, k) => { e.imgs.forEach(i => add(i, `${t}${p.eds ? " · édition " + (k + 1) : ""}`)); if (e.feature) add(e.feature.img, `${t} (vedette)`); });
    if (p.lead) add(p.lead.img, `${t} (ouverture)`);
  }
  (port.unpublished || []).forEach(i => add(i, "photos retirées"));
  home.hero.forEach(i => add(i, "accueil, ouverture")); home.about.forEach(i => add(i, "accueil, à propos")); home.wall.forEach(i => add(i, "coups de cœur")); add(home.me, "portrait");
  if (dup.length) err(dup[0]);
  if (!metaIds) return;
  const unknown = [...where.keys()].find(i => !metaIds.has(i));
  if (unknown != null) err(`photo ${unknown} inconnue : elle n'est pas dans le catalogue (meta.json)`);
  const missing = [...metaIds].filter(i => !where.has(i));
  if (missing.length) err(`photo${missing.length > 1 ? "s" : ""} ${missing.slice(0, 8).join(", ")} plus nulle part : remettez-la dans une édition ou dans « Photos retirées »`);
}

// ---------------- enregistrement ----------------
// { file, data, sha, message } (un fichier) ou { files: [{ file, data, sha }], message } (plusieurs, un seul commit).
export async function putContent(req, env) {
  const g = gh(env);
  const b = await readJson(req, 3 * 1024 * 1024);
  const list = Array.isArray(b.files) ? b.files : [{ file: b.file, data: b.data, sha: b.sha }];
  if (!list.length || list.length > 3) fail(400, "bad_file");
  const seen = new Set();
  for (const f of list) { if (!f || !Object.hasOwn(FILES, f.file) || seen.has(f.file)) fail(400, "bad_file"); seen.add(f.file); validateContent(f.file, f.data); }
  const head = await headOf(g, g.branch);
  const by = Object.fromEntries(list.map(f => [f.file, f.data]));
  if (by.portfolio || by.home) {
    for (const k of ["portfolio", "home"]) if (!by[k]) { const f = await readFile(g, FILES[k], head); if (!f) fail(502, "github_error", { file: FILES[k] }); by[k] = JSON.parse(f.text); validateContent(k, by[k]); }
    const m = await readFile(g, "meta.json", head);
    validateUsage(by.portfolio, by.home, m ? new Set(Object.keys(parseMeta(m.text)).map(Number)) : null);
  }
  const names = list.map(f => FILES[f.file]).join(", ");
  const res = await commitFiles(g, g.branch, list.map(f => ({ path: FILES[f.file], text: JSON.stringify(f.data, null, 1) + "\n", expect: String(f.sha || "") })),
    oneLine(b.message, 120) || `Administration : mise à jour de ${names}`, head);
  const shas = Object.fromEntries(list.map(f => [f.file, res.shas[FILES[f.file]]]));
  return json({ ok: true, sha: shas[list[0].file], shas, commit: res.commit });
}

// ---------------- photos ajoutées au site ----------------
// Dimensions lues dans le fichier lui-même (jamais celles annoncées par le navigateur).
export function imageInfo(b) {
  const s = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length > 30 && s(0, 4) === "RIFF" && s(8, 4) === "WEBP") {
    const k = s(12, 4);
    if (k === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { type: "webp", w: (b[26] | b[27] << 8) & 0x3fff, h: (b[28] | b[29] << 8) & 0x3fff };
    if (k === "VP8L" && b[20] === 0x2f) { const v = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24; return { type: "webp", w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 }; }
    if (k === "VP8X") return { type: "webp", w: 1 + (b[24] | b[25] << 8 | b[26] << 16), h: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const m = b[o + 1], len = b[o + 2] << 8 | b[o + 3];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: "jpeg", h: b[o + 5] << 8 | b[o + 6], w: b[o + 7] << 8 | b[o + 8] };
      o += 2 + len;
    }
  }
  return null;
}
const pyEntry = (i, v) => `"${i}": ${v}`; // même écriture que json.dump de Python (", " et ": ")
const appendEntry = (text, entry) => { const t = text.trimEnd(); if (!t.endsWith("}")) fail(502, "github_error", { file: "catalogue" }); const body = t.slice(0, -1).trimEnd(); return body + (body.endsWith("{") ? "" : ", ") + entry + "}"; };
function hamming(a, b) { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; }

// POST /api/admin/site-photos { data (base64 WebP ou JPEG), lqip, hash, target: { project, ed } | null, force, origin }
export async function addSitePhoto(req, env) {
  const g = gh(env);
  const b = await readJson(req, Math.ceil(MAX_PHOTO * 4 / 3) + 64 * 1024);
  let bytes; try { bytes = unb64Bytes(b.data || ""); } catch { fail(400, "bad_image"); }
  if (!bytes.length) fail(400, "bad_image");
  if (bytes.length > MAX_PHOTO) fail(413, "image_too_large");
  const info = imageInfo(bytes);
  if (!info || !info.w || !info.h) fail(400, "bad_image");
  if (Math.max(info.w, info.h) > LONG_MAX || Math.max(info.w, info.h) < LONG_MIN) fail(400, "bad_dimensions", { w: info.w, h: info.h });
  let lqip = "";
  if (b.lqip) { let q; try { q = unb64Bytes(b.lqip); } catch { fail(400, "bad_image"); } const qi = imageInfo(q); if (q.length > 2048 || !qi || qi.type !== "webp" || Math.max(qi.w, qi.h) > 32) fail(400, "bad_image"); lqip = bytesB64(q); }
  const hash = /^\d{1,20}$/.test(String(b.hash || "")) && BigInt(b.hash) < 1n << 64n ? BigInt(b.hash) : null;
  const target = b.target && typeof b.target === "object" ? { project: String(b.target.project || ""), ed: Number(b.target.ed) } : null;
  const origin = b.origin === "galerie" ? "une galerie client" : "l'ordinateur";

  // 1) catalogue et contenu actuels (branche du pipeline)
  let head = await headOf(g, g.branch);
  const load = async () => {
    const [meta, hashes, port] = [await readFile(g, "meta.json", head), await readFile(g, "hashes.json", head), await readFile(g, FILES.portfolio, head)];
    if (!meta || !port) fail(502, "github_error", { file: "meta.json" });
    return { meta, hashes: hashes || { sha: null, text: "{}" }, port, metaObj: parseMeta(meta.text), portObj: JSON.parse(port.text) };
  };
  let S = await load();
  const place = portObj => {
    if (!target) return { list: (portObj.unpublished ||= []), label: "photos retirées" };
    for (const c of portObj.chapters) for (const p of c.projects) if (p.id === target.project) {
      const e = edsOf(p)[target.ed];
      if (!Number.isInteger(target.ed) || !e) break;
      return { list: e.imgs, label: `${typeof p.title === "string" ? p.title : p.title.fr} · ${p.eds ? "édition " + (target.ed + 1) : "photos"}` };
    }
    fail(400, "bad_target");
  };
  place(S.portObj);
  if (hash != null && !b.force) {
    for (const [, k, v] of S.hashes.text.matchAll(/"(\d+)":\s*(\d+)/g)) {
      const d = hamming(hash, BigInt(v));
      if (d <= 6 && S.metaObj[k]) fail(409, "near_duplicate", { like: +k, dist: d });
    }
  }
  // 2) numéro : le suivant du catalogue ; le fichier pleine taille sur la branche du site sert de verrou
  //    (création seulement : si le numéro est déjà pris là-bas, on passe au suivant). Le site d'abord, le catalogue ensuite :
  //    la publication automatique ne voit jamais un numéro sans son fichier.
  let id = Math.max(0, ...Object.keys(S.metaObj).map(Number)) + 1, path = null;
  const sitePath = i => info.type === "webp" ? `img/f/${pad(i)}.webp` : `img/new/${pad(i)}.jpg`; // JPEG : converti en WebP par build.py
  for (let tries = 0; tries < 12 && !path; tries++, id++) {
    const sh = await headOf(g, g.site);
    if (await readFile(g, `img/f/${pad(id)}.webp`, sh) || await readFile(g, `img/new/${pad(id)}.jpg`, sh)) continue;
    try { await commitFiles(g, g.site, [{ path: sitePath(id), bytes, expect: null }], `Administration : nouvelle photo ${pad(id)} (depuis ${origin})`, sh); path = sitePath(id); break; }
    catch (e) { if (e.code !== "content_changed") throw e; }
  }
  if (!path) fail(409, "content_changed");
  // 3) catalogue (meta.json, hashes.json) et rubrique choisie, en un seul commit ; nouvel essai si la branche a bougé
  for (let tries = 0; ; tries++) {
    if (S.metaObj[id]) fail(409, "content_changed");
    const metaText = appendEntry(S.meta.text, pyEntry(id, `{"w": ${info.w}, "h": ${info.h}, "q": ${JSON.stringify(lqip)}}`));
    const hashText = hash != null ? appendEntry(S.hashes.text, pyEntry(id, hash.toString())) : null;
    const t = place(S.portObj); t.list.push(id);
    validateContent("portfolio", S.portObj);
    const files = [{ path: "meta.json", text: metaText, expect: S.meta.sha }, { path: FILES.portfolio, text: JSON.stringify(S.portObj, null, 1) + "\n", expect: S.port.sha }];
    if (hashText) files.push({ path: "hashes.json", text: hashText, expect: S.hashes.sha });
    try {
      const res = await commitFiles(g, g.branch, files, `Administration : photo ${pad(id)} ajoutée au site (${t.label}, depuis ${origin})`, head);
      return json({ ok: true, id, w: info.w, h: info.h, path, to: t.label, shas: { portfolio: res.shas[FILES.portfolio] }, commit: res.commit }, 201);
    } catch (e) {
      if (e.code !== "content_changed" || tries >= 2) throw e;
      head = await headOf(g, g.branch); S = await load();
    }
  }
}
