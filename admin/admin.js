/* Tableau de bord BIGBEEZARR : galeries, import en masse, réglages d'accès, invités, statistiques. */
(() => {
"use strict";
// Ne jamais s'afficher encadrée dans une autre page (protection contre le détournement de clic).
if (window.top !== window.self) { document.documentElement.style.display = "none"; try { window.top.location = window.location.href; } catch (e) {} }
const API_RAW = String(window.BBZ_API || "").replace(/\/$/, "");
// Seulement une adresse https (ou le serveur local de test) : jamais d'autre protocole.
const API = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(API_RAW) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API_RAW) ? API_RAW : "";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nb = " ";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtBytes = n => { const u = ["o", "Ko", "Mo", "Go", "To"]; let i = 0; while (n >= 1000 && i < 4) { n /= 1000; i++; } return `${n.toLocaleString("fr-CA", { maximumFractionDigits: n < 10 && i ? 1 : 0 })}${nb}${u[i]}`; };
const fmtNum = n => (n || 0).toLocaleString("fr-CA");
const fmtDate = s => { if (!s) return ""; const d = typeof s === "number" ? new Date(s * 1000) : new Date(s + "T12:00:00"); return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }); };
const fmtWhen = s => new Date(s * 1000).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const toDay = s => { if (!s) return ""; const d = new Date(s * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const endOfDay = v => v ? Math.floor(new Date(v + "T23:59:59").getTime() / 1000) : null;
const KIND = { private: "Privée", event: "Événement", restricted: "Restreinte" };
const EV = { view: "Ouverture de la galerie", dl: "Téléchargement d'une photo", zip: "Téléchargement ZIP" };

let toastT;
function toast(msg, bad) { const el = $("#toast"); el.textContent = msg; el.classList.toggle("bad", !!bad); el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 3200); }
const ERR = {
  bad_password: "Mot de passe incorrect.", too_many_attempts: "Trop d'essais. Patientez quelques minutes.", admin_required: "Session expirée, reconnectez-vous.",
  title_required: "Le titre est obligatoire.", size_mismatch: "Le fichier reçu n'a pas la bonne taille. Réessayez.", server_not_configured: "Serveur incomplet : la clé de signature manque.",
  admin_not_configured: "Serveur incomplet : le mot de passe administrateur manque.",
  date_taken: "Cette date est déjà confirmée ou bloquée.", content_not_configured: "Édition du portfolio non reliée à GitHub (GITHUB_TOKEN).", content_changed: "Le contenu a changé entre-temps : rechargez la page.",
  invalid_content: "Contenu refusé par le contrôle.", bad_client: "Client introuvable.",
  github_error: "GitHub a refusé la requête (jeton expiré ou permissions insuffisantes).", name_required: "Le nom est obligatoire.", bad_email: "Adresse courriel invalide.", bad_date: "Date invalide.",
};
const errText = e => (e && ERR[e.code]) || (e && e.net ? "Serveur injoignable. Vérifiez votre connexion." : `Erreur${e && e.code ? " : " + e.code : ""}.`);

const auth = {
  get() { try { const v = JSON.parse(sessionStorage.getItem("bbz-admin")); return v && v.e * 1000 > Date.now() ? v.token : null; } catch { return null; } },
  set(token, ttl) { try { sessionStorage.setItem("bbz-admin", JSON.stringify({ token, e: Math.floor(Date.now() / 1000) + ttl - 60 })); } catch {} },
  clear() { try { sessionStorage.removeItem("bbz-admin"); } catch {} },
};
async function api(path, { method = "GET", body } = {}) {
  const h = {}; const tok = auth.get(); if (tok) h.Authorization = "Bearer " + tok;
  if (body !== undefined) h["Content-Type"] = "application/json";
  let r; try { r = await fetch(API + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { const e = new Error("net"); e.net = true; throw e; }
  let data = null; try { data = await r.json(); } catch {}
  if (r.status === 401 && path !== "/api/admin/login") { auth.clear(); showLogin(); }
  if (!r.ok) { const e = new Error((data && data.error) || "http_" + r.status); e.code = data && data.error; e.status = r.status; e.data = data; throw e; }
  return data;
}
function xhrPut(path, body, type, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", API + path);
    x.setRequestHeader("Authorization", "Bearer " + auth.get());
    if (type) x.setRequestHeader("Content-Type", type);
    x.upload.onprogress = e => onProgress && onProgress(e.loaded);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText || "{}"); } catch {} if (x.status < 300) resolve(d); else { const e = new Error(d.error || "http_" + x.status); e.code = d.error; e.status = x.status; reject(e); } };
    x.onerror = () => { const e = new Error("net"); e.net = true; reject(e); };
    x.send(body);
  });
}
async function retry(fn, n = 3) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || (e.status && e.status < 500 && e.status !== 429)) throw e; await sleep(800 * 2 ** i); } } }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast("Lien copié.");
}

const views = ["vLogin", "vNone", "vList", "vGal", "vBook", "vCal", "vClients", "vSel", "vPort", "vStats"];
const show = id => {
  views.forEach(v => { const el = $("#" + v); if (el) el.hidden = v !== id; });
  $("#logout").hidden = id === "vLogin" || id === "vNone";
  const nav = $("#anav"); if (nav) { nav.hidden = id === "vLogin" || id === "vNone"; $$("#anav a").forEach(a => a.setAttribute("aria-current", String(a.dataset.v === id || (id === "vGal" && a.dataset.v === "vList"))));
    const cur = nav && nav.querySelector('[aria-current="true"]'); if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, cur.offsetLeft - nav.clientWidth / 2 + cur.offsetWidth / 2); }
  window.scrollTo(0, 0);
};
$$("dialog [data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

// ---------------- connexion ----------------
function showLogin() { show("vLogin"); setTimeout(() => $("#loginPw").focus(), 50); }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#loginErr").textContent = "";
  try { const r = await api("/api/admin/login", { method: "POST", body: { password: $("#loginPw").value } }); auth.set(r.token, r.expiresIn); $("#loginPw").value = ""; route(); }
  catch (er) { $("#loginErr").textContent = errText(er); }
});
$("#logout").addEventListener("click", () => { auth.clear(); location.hash = ""; showLogin(); });

// ---------------- liste ----------------
let OV = null;
async function list() {
  show("vList");
  try { OV = await api("/api/admin/overview"); } catch (e) { if (e.status !== 401) toast(errText(e), true); return; }
  const t = OV.totals, l = t.last30 || {};
  $("#stats").innerHTML = [
    [fmtNum(OV.galleries.length), "galeries"], [fmtNum(t.photos), "photos"], [fmtBytes(t.bytes), "stockage utilisé"],
    [fmtNum((l.dl || 0) + (l.zip || 0)), "photos téléchargées (30 j)"], [fmtNum(l.view || 0), "visites (30 j)"],
  ].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
  const box = $("#glist"); box.textContent = "";
  $("#gEmpty").hidden = !!OV.galleries.length;
  for (const g of OV.galleries) {
    const el = document.createElement("div"); el.className = "grow"; el.tabIndex = 0; el.setAttribute("role", "link");
    const expired = g.expires_at && g.expires_at * 1000 < Date.now();
    el.innerHTML = `<div class="cv">${g.cover ? `<img alt="" loading="lazy" src="${esc(g.cover.url)}">` : ""}</div>
      <div style="min-width:0"><div class="row" style="gap:8px"><b>${esc(g.title)}</b><span class="pill">${KIND[g.kind]}</span>${g.hasPassword ? '<span class="pill">Mot de passe</span>' : ""}${expired ? '<span class="pill warn">Expirée</span>' : ""}${g.archived ? '<span class="pill">Archivée</span>' : ""}${g.new_selections ? `<span class="pill red">${g.new_selections} sélection${g.new_selections > 1 ? "s" : ""}</span>` : ""}${g.client_name ? `<span class="pill">${esc(g.client_name)}</span>` : ""}</div>
      <div class="sub"><span>${fmtNum(g.n)} photos · ${fmtBytes(g.bytes)}</span>${g.event_date ? `<span>${fmtDate(g.event_date)}</span>` : ""}<span>${fmtNum(g.views)} visites · ${fmtNum(g.downloads)} téléchargements</span>${g.expires_at ? `<span>${expired ? "Expirée le" : "Expire le"} ${fmtDate(g.expires_at)}</span>` : ""}</div></div>
      <div class="acts row"><button class="btn small" type="button" data-copy>Copier le lien</button></div>`;
    el.querySelector("[data-copy]").addEventListener("click", ev => { ev.stopPropagation(); copy(g.link); });
    const go = () => { location.hash = "g/" + g.id; };
    el.addEventListener("click", go); el.addEventListener("keydown", ev => { if (ev.key === "Enter") go(); });
    box.appendChild(el);
  }
}
$("#newBtn").addEventListener("click", () => { $("#newForm").reset(); $("#newErr").textContent = ""; $("#newDlg").showModal(); });
$("#newGo").addEventListener("click", async () => {
  const f = new FormData($("#newForm"));
  if (!f.get("title").trim()) { $("#newErr").textContent = "Le titre est obligatoire."; return; }
  try {
    const r = await api("/api/admin/galleries", { method: "POST", body: {
      title: f.get("title"), client: f.get("client"), event_date: f.get("event_date") || null, kind: f.get("kind"),
      password: f.get("password") || undefined, expires_at: endOfDay(f.get("expires")), allow_download: 1,
    } });
    $("#newDlg").close(); location.hash = "g/" + r.gallery.id;
  } catch (e) { $("#newErr").textContent = errText(e); }
});

// ---------------- galerie ----------------
let G = null, P = [], GUESTS = [], picking = false, pickSel = new Set(), tab = "photos";
async function openGallery(id, keepTab) {
  show("vGal");
  if (!keepTab) { tab = "photos"; picking = false; pickSel.clear(); }
  await refresh(id);
  selectTab(tab);
}
async function refresh(id = G && G.id) {
  let d; try { d = await api("/api/admin/galleries/" + id); } catch (e) { if (e.status === 404) location.hash = ""; else if (e.status !== 401) toast(errText(e), true); return; }
  G = d.gallery; P = d.photos; GUESTS = d.guests; G.events = d.events;
  paintHead(); paintPhotos(); paintSettings(); paintGuests(); paintStats();
}
function paintHead() {
  $("#gTitle").textContent = G.title;
  const ready = P.filter(p => p.status === "ready");
  $("#gSub").textContent = [G.client, G.event_date && fmtDate(G.event_date), `${fmtNum(ready.length)} photos · ${fmtBytes(P.reduce((s, p) => s + p.size + p.extra_size, 0))}`].filter(Boolean).join(" · ");
  $("#gPills").innerHTML = `<span class="pill">${KIND[G.kind]}</span>${G.hasPassword ? '<span class="pill">Mot de passe</span>' : ""}${G.allow_download ? "" : '<span class="pill warn">Téléchargement fermé</span>'}${G.expires_at ? `<span class="pill">Expire le ${fmtDate(G.expires_at)}</span>` : ""}`;
  $("#gLink").textContent = G.link; $("#openLink").href = G.link;
  $("#tabGuests").hidden = G.kind !== "restricted" && !GUESTS.length;
}
$("#copyLink").addEventListener("click", () => copy(G.link));
$("#relink").addEventListener("click", async () => {
  if (!confirm("Créer un nouveau lien ? L'ancien cessera immédiatement de fonctionner.")) return;
  try { await api(`/api/admin/galleries/${G.id}/relink`, { method: "POST", body: {} }); await refresh(); toast("Nouveau lien créé."); } catch (e) { toast(errText(e), true); }
});
$("#backBtn").addEventListener("click", () => { location.hash = ""; });
$$("#atabs button").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.tab)));
function selectTab(name) { tab = name; $$("#atabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name))); $$("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== name); }

// photos
const TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.4 3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function paintPhotos() {
  const grid = $("#pgrid"); grid.textContent = ""; grid.classList.toggle("picking", picking);
  const assigned = new Map(); GUESTS.forEach(g => g.photos.forEach(id => assigned.set(id, (assigned.get(id) || 0) + 1)));
  const frag = document.createDocumentFragment();
  for (const p of P) {
    const el = document.createElement("div"); el.className = "pt" + (pickSel.has(p.id) ? " on" : ""); el.dataset.id = p.id; el.title = `${p.name} · ${fmtBytes(p.size)}`;
    const ext = (p.name.split(".").pop() || "").toUpperCase();
    el.innerHTML = (p.t ? `<img alt="" loading="lazy" src="${esc(p.t)}">` : `<span class="raw"><b>${esc(ext.slice(0, 5))}</b>${esc(p.name)}</span>`) + `<span class="ck">${TICK}</span><span class="tags"></span>`;
    const tags = [];
    if (p.status !== "ready") tags.push("Import inachevé");
    if (G.cover_photo === p.id) tags.push('<span class="cov">Couverture</span>');
    if (p.downloads) tags.push(`${p.downloads} ↓`);
    if (G.kind === "restricted" && p.allow_all) tags.push("Pour tous");
    if (G.kind === "restricted" && assigned.get(p.id)) tags.push(`${assigned.get(p.id)} invité${assigned.get(p.id) > 1 ? "s" : ""}`);
    el.querySelector(".tags").innerHTML = tags.map(x => x.startsWith("<") ? x : `<span>${esc(x)}</span>`).join("");
    frag.appendChild(el);
  }
  grid.appendChild(frag);
  $("#pCount").textContent = `${fmtNum(P.length)} fichier${P.length > 1 ? "s" : ""}`;
  $("#pPick").textContent = picking ? "Terminer" : "Sélectionner";
  $("#pActs").hidden = !picking;
  $("#pSelN").textContent = `${pickSel.size} sélectionnée${pickSel.size > 1 ? "s" : ""}`;
  $("#pOpenAll").hidden = $("#pAssign").hidden = G.kind !== "restricted";
  $("#pReplace").disabled = pickSel.size !== 1; $("#pCover").disabled = pickSel.size !== 1;
  ["#pDel", "#pOpenAll", "#pAssign"].forEach(s => $(s).disabled = !pickSel.size);
}
$("#pgrid").addEventListener("click", e => {
  const el = e.target.closest(".pt"); if (!el) return;
  if (!picking) { picking = true; }
  pickSel.has(el.dataset.id) ? pickSel.delete(el.dataset.id) : pickSel.add(el.dataset.id);
  paintPhotos();
});
$("#pPick").addEventListener("click", () => { picking = !picking; if (!picking) pickSel.clear(); paintPhotos(); });
$("#pAll").addEventListener("click", () => { P.forEach(p => pickSel.add(p.id)); paintPhotos(); });
$("#pDel").addEventListener("click", async () => {
  const ids = [...pickSel]; if (!ids.length || !confirm(`Supprimer définitivement ${ids.length} photo${ids.length > 1 ? "s" : ""} (originaux compris) ?`)) return;
  for (const id of ids) { try { await api("/api/admin/photos/" + id, { method: "DELETE" }); } catch (e) { toast(errText(e), true); break; } }
  pickSel.clear(); await refresh(); toast("Photos supprimées.");
});
$("#pCover").addEventListener("click", async () => { await saveGallery({ cover_photo: [...pickSel][0] }); toast("Couverture définie."); });
$("#pOpenAll").addEventListener("click", async () => {
  const ids = [...pickSel], on = !P.find(p => p.id === ids[0]).allow_all;
  for (const id of ids) await api("/api/admin/photos/" + id, { method: "PATCH", body: { allow_all: on } });
  await refresh(); toast(on ? "Téléchargeables par tous les invités." : "Réservées aux invités attribués.");
});
$("#pReplace").addEventListener("click", () => $("#inReplace").click());
$("#inReplace").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) enqueue([f], [...pickSel][0]); });
$("#pAssign").addEventListener("click", () => {
  if (!GUESTS.length) { toast("Ajoutez d'abord un invité (onglet Invités)."); selectTab("guests"); return; }
  $("#asP").textContent = `${pickSel.size} photo${pickSel.size > 1 ? "s" : ""} sélectionnée${pickSel.size > 1 ? "s" : ""}. Choisissez l'invité :`;
  const box = $("#asList"); box.textContent = "";
  for (const g of GUESTS) {
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<b style="flex:1">${esc(g.name || "Invité")}</b><span class="hint">${g.photos.length} attribuée${g.photos.length > 1 ? "s" : ""}</span>`;
    const add = document.createElement("button"); add.className = "btn small primary"; add.type = "button"; add.textContent = "Ajouter";
    const set = document.createElement("button"); set.className = "btn small"; set.type = "button"; set.textContent = "Remplacer par la sélection";
    add.onclick = () => assign(g, [...new Set([...g.photos, ...pickSel])]);
    set.onclick = () => assign(g, [...pickSel]);
    row.append(add, set); box.appendChild(row);
  }
  $("#assignDlg").showModal();
});
async function assign(g, ids) {
  try { await api(`/api/admin/guests/${g.id}/photos`, { method: "PUT", body: { ids } }); $("#assignDlg").close(); await refresh(); toast(`${ids.length} photo${ids.length > 1 ? "s" : ""} pour ${g.name || "l'invité"}.`); }
  catch (e) { toast(errText(e), true); }
}

// ---------------- import ----------------
const RAW = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|pef|srw|3fr|iiq|rwl|x3f|mrw|kdc|erf|mef|mos)$/i;
const IMG = /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/i;
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", dng: "image/x-adobe-dng" };
const accept = f => !f.name.startsWith(".") && (IMG.test(f.name) || RAW.test(f.name));
const mimeOf = f => f.type || MIME[(f.name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
async function crc32(file) {
  let c = 0xffffffff;
  const r = file.stream().getReader();
  for (;;) {
    const { done, value } = await r.read(); if (done) break;
    for (let i = 0; i < value.length; i++) c = CRC[(c ^ value[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
// Aperçu caché dans les fichiers RAW : le plus grand JPEG embarqué qui se décode.
async function embeddedJpeg(file) {
  if (file.size > 400 * 1024 * 1024) return null;
  const b = new Uint8Array(await file.arrayBuffer());
  const soi = [], eoi = [];
  for (let i = 0; i < b.length - 3; i++) {
    if (b[i] !== 0xff) continue;
    const m = b[i + 1];
    if (m === 0xd8 && b[i + 2] === 0xff && (b[i + 3] === 0xe0 || b[i + 3] === 0xe1 || b[i + 3] === 0xdb || b[i + 3] === 0xc4 || b[i + 3] === 0xc0 || b[i + 3] === 0xdd)) soi.push(i);
    else if (m === 0xd9) eoi.push(i);
  }
  const segs = [];
  for (let a = 0, e0 = 0; a < soi.length; a++) {
    const s = soi[a];
    while (e0 < eoi.length && eoi[e0] < s) e0++;
    let depth = 0, si = a + 1, ei = e0;
    for (; ei < eoi.length; ei++) { while (si < soi.length && soi[si] < eoi[ei]) { depth++; si++; } if (depth === 0) break; depth--; }
    if (ei < eoi.length && eoi[ei] - s > 40 * 1024) segs.push([s, eoi[ei] + 2]);
  }
  segs.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  for (const [s, e] of segs.slice(0, 4)) {
    try { return await createImageBitmap(new Blob([b.subarray(s, e)], { type: "image/jpeg" }), { imageOrientation: "from-image" }); } catch {}
  }
  return null;
}
function canvasBlob(bmp, max, q) {
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, w, h);
  return new Promise(r => c.toBlob(r, "image/jpeg", q));
}
async function previews(file) {
  let bmp = null;
  if (RAW.test(file.name)) bmp = await embeddedJpeg(file).catch(() => null);
  else { try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { bmp = null; } }
  if (!bmp) return null;
  try { return { w: bmp.width, h: bmp.height, preview: await canvasBlob(bmp, 2048, .86), thumb: await canvasBlob(bmp, 640, .8) }; }
  finally { bmp.close && bmp.close(); }
}

const Q = { items: [], active: 0, max: 3, prep: Promise.resolve(), gid: null, refreshT: null };
function enqueue(files, replaceId) {
  const list = [...files].filter(accept);
  const skipped = files.length - list.length;
  if (!list.length) { toast("Aucune photo reconnue dans cette sélection.", true); return; }
  for (const file of list) Q.items.push({ file, gid: G.id, replaceId, state: "wait", sent: 0, msg: "En attente" });
  if (skipped) toast(`${skipped} fichier${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""} (pas des photos).`);
  paintQueue(); pump();
}
function pump() {
  while (Q.active < Q.max) {
    const it = Q.items.find(x => x.state === "wait"); if (!it) break;
    Q.active++; it.state = "run";
    upload(it).then(() => { it.state = "ok"; it.msg = "Terminé"; }, e => { it.state = "err"; it.msg = errText(e); console.error(e); })
      .finally(() => { Q.active--; paintQueue(); scheduleRefresh(it.gid); pump(); });
  }
  paintQueue();
}
function scheduleRefresh(gid) { clearTimeout(Q.refreshT); Q.refreshT = setTimeout(() => { if (G && G.id === gid) refresh(); }, 900); }
async function upload(it) {
  const f = it.file;
  // Préparation une à la fois : CRC-32 de l'original et aperçus (le fichier source n'est jamais modifié).
  let meta, pv;
  const prep = Q.prep.then(async () => {
    it.msg = "Analyse"; paintQueue();
    const crc = await crc32(f);
    pv = await previews(f);
    meta = { name: f.name, size: f.size, mime: mimeOf(f), crc32: crc, w: pv ? pv.w : null, h: pv ? pv.h : null, mtime: f.lastModified };
  });
  Q.prep = prep.catch(() => {}); await prep;
  const c = it.replaceId ? await retry(() => api(`/api/admin/photos/${it.replaceId}/replace`, { method: "POST", body: meta })) : await retry(() => api(`/api/admin/galleries/${it.gid}/photos`, { method: "POST", body: meta }));
  const id = c.id;
  it.msg = "Envoi";
  if (c.mode === "single") {
    await retry(() => xhrPut(`/api/admin/photos/${id}/original`, f, meta.mime, n => { it.sent = n; paintQueueSoon(); }));
  } else {
    const m = await retry(() => api(`/api/admin/photos/${id}/mpu`, { method: "POST", body: {} }));
    const parts = [];
    for (let n = 1; n <= m.parts; n++) {
      const blob = f.slice((n - 1) * m.partSize, Math.min(f.size, n * m.partSize));
      const base = (n - 1) * m.partSize;
      parts.push(await retry(() => xhrPut(`/api/admin/photos/${id}/mpu/${m.uploadId}/${n}`, blob, "application/octet-stream", k => { it.sent = base + k; paintQueueSoon(); }), 4));
    }
    await retry(() => api(`/api/admin/photos/${id}/mpu/${m.uploadId}/complete`, { method: "POST", body: { parts } }));
  }
  it.sent = f.size;
  if (pv) {
    await retry(() => xhrPut(`/api/admin/photos/${id}/preview`, pv.preview, "image/jpeg"));
    await retry(() => xhrPut(`/api/admin/photos/${id}/thumb`, pv.thumb, "image/jpeg"));
  }
  await retry(() => api(`/api/admin/photos/${id}/done`, { method: "POST", body: {} }));
}
let pqT = 0;
function paintQueueSoon() { if (!pqT) pqT = requestAnimationFrame(() => { pqT = 0; paintQueue(); }); }
function paintQueue() {
  const items = Q.items; $("#queue").hidden = !items.length; if (!items.length) return;
  const total = items.reduce((s, x) => s + x.file.size, 0), sent = items.reduce((s, x) => s + (x.state === "ok" ? x.file.size : x.sent), 0);
  const ok = items.filter(x => x.state === "ok").length, err = items.filter(x => x.state === "err").length, busy = items.some(x => x.state === "wait" || x.state === "run");
  $("#qTitle").textContent = busy ? `Import : ${ok} / ${items.length} · ${fmtBytes(sent)} sur ${fmtBytes(total)}` : `Import terminé : ${ok} photo${ok > 1 ? "s" : ""}${err ? `, ${err} échec${err > 1 ? "s" : ""}` : ""}`;
  $("#qSpin").hidden = !busy; $("#qBar").style.width = `${total ? (sent / total * 100).toFixed(1) : 0}%`;
  $("#qRetry").hidden = !err || busy;
  if (!$("#qList").hidden) $("#qList").innerHTML = items.map(x => `<div class="qi ${x.state}"><span>${esc(x.file.name)}</span><span class="hint">${fmtBytes(x.file.size)}</span><span class="st">${x.state === "run" && x.msg === "Envoi" ? Math.round(x.sent / x.file.size * 100) + " %" : esc(x.msg)}</span></div>`).join("");
}
$("#qToggle").addEventListener("click", () => { $("#qList").hidden = !$("#qList").hidden; $("#qToggle").textContent = $("#qList").hidden ? "Détails" : "Masquer"; paintQueue(); });
$("#qRetry").addEventListener("click", () => { Q.items.forEach(x => { if (x.state === "err") { x.state = "wait"; x.sent = 0; x.msg = "En attente"; } }); pump(); });
window.addEventListener("beforeunload", e => { if (Q.items.some(x => x.state === "wait" || x.state === "run")) { e.preventDefault(); e.returnValue = ""; } });

$("#pickFiles").addEventListener("click", () => $("#inFiles").click());
$("#pickDir").addEventListener("click", () => $("#inDir").click());
$("#inFiles").addEventListener("change", e => { enqueue(e.target.files); e.target.value = ""; });
$("#inDir").addEventListener("change", e => { enqueue(e.target.files); e.target.value = ""; });
const drop = $("#drop");
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", async e => {
  e.preventDefault();
  const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!items.length) { enqueue(e.dataTransfer.files); return; }
  const files = [];
  const walk = async entry => {
    if (entry.isFile) files.push(await new Promise((res, rej) => entry.file(res, rej)));
    else if (entry.isDirectory) {
      const r = entry.createReader();
      for (;;) { const batch = await new Promise((res, rej) => r.readEntries(res, rej)); if (!batch.length) break; for (const x of batch) await walk(x); }
    }
  };
  for (const it of items) await walk(it);
  enqueue(files);
});

// ---------------- réglages ----------------
function paintSettings() {
  const f = $("#setForm");
  f.title.value = G.title || ""; f.client.value = G.client || ""; f.event_date.value = G.event_date || ""; f.expires.value = toDay(G.expires_at);
  f.querySelector(`[name=kind][value=${G.kind}]`).checked = true;
  f.password.value = ""; $("#pwState").textContent = G.hasPassword ? "Un mot de passe est actif." : "Aucun mot de passe : le lien suffit.";
  $("#clearPw").hidden = !G.hasPassword;
  f.allow_download.checked = !!G.allow_download; f.listed.checked = !!G.listed; f.guest_view_all.checked = !!G.guest_view_all; f.delete_after_expiry.checked = !!G.delete_after_expiry;
  f.selections_open.checked = G.selectionsOpen !== false; f.archived.checked = !!G.archived;
  api("/api/admin/clients").then(r => {
    f.client_id.innerHTML = '<option value="">Aucun</option>' + r.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    f.client_id.value = G.clientId || "";
  }).catch(() => {});
  syncKind();
}
function syncKind() { const k = $("#setForm").querySelector("[name=kind]:checked").value; $("#rowListed").hidden = k !== "event"; $("#rowViewAll").hidden = k !== "restricted"; }
$$("#setForm [name=kind]").forEach(r => r.addEventListener("change", syncKind));
async function saveGallery(body) {
  try { const r = await api("/api/admin/galleries/" + G.id, { method: "PATCH", body }); G = { ...G, ...r.gallery }; await refresh(); return true; }
  catch (e) { toast(errText(e), true); return false; }
}
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target;
  const body = {
    title: f.title.value, client: f.client.value, event_date: f.event_date.value || null, expires_at: endOfDay(f.expires.value),
    kind: f.querySelector("[name=kind]:checked").value, allow_download: f.allow_download.checked, listed: f.listed.checked,
    guest_view_all: f.guest_view_all.checked, delete_after_expiry: f.delete_after_expiry.checked,
    selections_open: f.selections_open.checked, archived: f.archived.checked, client_id: f.client_id.value || null,
  };
  if (f.password.value) body.password = f.password.value;
  if (await saveGallery(body)) toast("Réglages enregistrés.");
});
$("#clearPw").addEventListener("click", async () => { if (await saveGallery({ password: null })) toast("Mot de passe retiré."); });
$("#delGal").addEventListener("click", async () => {
  if (!confirm(`Supprimer « ${G.title} » et tous ses fichiers ? C'est définitif.`)) return;
  try { await api("/api/admin/galleries/" + G.id, { method: "DELETE" }); location.hash = ""; toast("Galerie supprimée."); } catch (e) { toast(errText(e), true); }
});

// ---------------- invités ----------------
function paintGuests() {
  const box = $("#guestList"); box.textContent = "";
  if (!GUESTS.length) { box.innerHTML = '<p class="hint">Aucun invité.</p>'; return; }
  for (const g of GUESTS) {
    const el = document.createElement("div"); el.className = "guest";
    el.innerHTML = `<div style="min-width:0"><b>${esc(g.name || "Invité")}</b> <span class="hint">· ${g.photos.length} photo${g.photos.length > 1 ? "s" : ""} attribuée${g.photos.length > 1 ? "s" : ""}</span><code>${esc(g.link)}</code></div><div class="row"></div>`;
    const acts = el.querySelector(".row");
    const mk = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small " + cls; b.textContent = label; b.onclick = fn; acts.appendChild(b); };
    mk("Copier le lien", "", () => copy(g.link));
    mk("Voir ses photos", "ghost", () => { picking = true; pickSel = new Set(g.photos); selectTab("photos"); paintPhotos(); });
    mk("Retirer", "danger", async () => { if (!confirm(`Retirer ${g.name || "cet invité"} ? Son lien cessera de fonctionner.`)) return; await api("/api/admin/guests/" + g.id, { method: "DELETE" }); refresh(); });
    box.appendChild(el);
  }
}
$("#guestForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { const r = await api(`/api/admin/galleries/${G.id}/guests`, { method: "POST", body: { name: e.target.name.value } }); e.target.reset(); await refresh(); copy(r.guest.link); }
  catch (er) { toast(errText(er), true); }
});

// ---------------- statistiques ----------------
function paintStats() {
  $("#gStats").innerHTML = [[G.views, "visites"], [G.downloads, "photos téléchargées"], [G.zips, "archives ZIP"]]
    .map(([n, s]) => `<div class="stat"><b>${fmtNum(n)}</b><span>${s}</span></div>`).join("");
  $("#evLog").innerHTML = (G.events || []).map(e => `<div><span>${esc(EV[e.kind] || e.kind)}${e.kind === "zip" ? ` · ${e.n}` : ""}</span><span class="hint">${fmtWhen(e.at)}</span></div>`).join("") || '<p class="hint">Rien pour l\'instant.</p>';
  const top = P.filter(p => p.downloads).sort((a, b) => b.downloads - a.downloads).slice(0, 10);
  $("#topLog").innerHTML = top.map(p => `<div><span>${esc(p.name)}</span><span class="hint">${fmtNum(p.downloads)}</span></div>`).join("") || '<p class="hint">Aucun téléchargement direct pour l\'instant.</p>';
}

// ---------------- navigation ----------------
function route() {
  if (!API) { show("vNone"); return; }
  if (!auth.get()) { showLogin(); return; }
  const m = /^#g\/([A-Za-z0-9]+)/.exec(location.hash);
  if (m) { openGallery(m[1], G && G.id === m[1]); return; }
  const sec = location.hash.slice(1);
  if (window.BBZS && window.BBZS.has(sec)) { window.BBZS.open(sec); return; }
  list();
}
window.addEventListener("hashchange", route);
/* outils partagés avec admin/site.js (réservations, calendrier, clients, sélections, portfolio, statistiques) */
window.BBZA = { api, toast, esc, errText, show, fmtDate, fmtWhen, fmtNum, fmtBytes, copy, API, ERR };
route();
})();
