/* Galerie client BIGBEEZARR : accès, grille, sélection, téléchargements d'originaux. */
(() => {
"use strict";
// Ne jamais s'afficher encadrée dans une autre page (protection contre le détournement de clic).
if (window.top !== window.self) { document.documentElement.style.display = "none"; try { window.top.location = window.location.href; } catch (e) {} }
const API_RAW = String(window.BBZ_API || "").replace(/\/$/, "");
// Seulement une adresse https (ou le serveur local de test) : jamais d'autre protocole.
const API = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(API_RAW) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API_RAW) ? API_RAW : "";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};
const nb = " ";

const T = {
  fr: {
    "nav.mine": "Mes photos", "nav.portfolio": "Portfolio", "lang": "EN", "lang.aria": "Switch to English",
    "land.kick": "Galerie client", "land.h": "Récupérer mes photos",
    "land.p": "Entrez le lien ou le code reçu après votre séance ou votre événement. Vos photos vous attendent en qualité originale.",
    "land.label": "Lien ou code de la galerie", "land.ph": "Collez votre lien ou votre code", "land.go": "Ouvrir",
    "land.bad": "Ce lien ou ce code ne semble pas valide.",
    "how.1": "Ouvrez votre galerie", "how.1s": "Avec le lien ou le code que je vous ai envoyé.",
    "how.2": "Choisissez", "how.2s": "Parcourez la galerie et sélectionnez vos préférées.",
    "how.3": "Téléchargez", "how.3s": "Une photo, une sélection ou tout, en qualité originale.",
    "ev.h": "Galeries d'événements",
    "not.ready": "Le service de livraison sera disponible très bientôt.",
    "lock.kick": "Galerie protégée", "lock.pw": "Mot de passe", "lock.code": "Code d'accès", "lock.go": "Ouvrir la galerie",
    "msg.back": "Revenir à l'accueil",
    "e.bad_password": "Mot de passe incorrect.", "e.bad_code": "Code d'accès incorrect.",
    "e.too_many_attempts": m => `Trop d'essais. Réessayez dans ${Math.ceil((m || 60) / 60)}${nb}min.`,
    "e.gone.k": "Galerie expirée", "e.gone.h": "Cette galerie n'est plus disponible", "e.gone.p": "Le délai de téléchargement est passé. Écrivez-moi si vous avez encore besoin de vos photos : baeypro@gmail.com.",
    "e.nf.k": "Lien introuvable", "e.nf.h": "Je ne trouve pas cette galerie", "e.nf.p": "Vérifiez le lien reçu, ou demandez-moi un nouveau lien.",
    "e.net": "Connexion impossible pour le moment. Vérifiez votre réseau et réessayez.",
    "dl.all": "Tout télécharger", "select": "Sélectionner", "select.done": "Terminer",
    "tab.all": "Toutes", "tab.mine": "Mes photos",
    "count": (n, s) => `${n} photo${n > 1 ? "s" : ""}${s ? " · " + s : ""}`,
    "until": d => `Disponible jusqu'au ${d}`, "event": "Galerie d'événement", "private": "Galerie privée", "restricted": "Galerie personnelle",
    "hello": n => `Bonjour ${n}`,
    "sel.n": n => `${n} sélectionnée${n > 1 ? "s" : ""}`, "sel.all": "Tout", "sel.dl": "Télécharger", "sel.cancel": "Annuler la sélection",
    "sel.send": "Envoyer au photographe", "tab.picked": "Ma sélection", "empty.picked": "Votre sélection est vide. Touchez « Sélectionner », puis les photos qui vous plaisent.",
    "send.h": "Envoyer ma sélection", "send.p": n => `${n} photo${n > 1 ? "s" : ""} seront transmises au photographe, avec leurs noms de fichiers.`,
    "send.name": "Votre nom", "send.email": "Votre courriel (pour la réponse)", "send.why": "Pour quoi faire ?", "send.note": "Un message (facultatif)",
    "send.why.download": "Les récupérer", "send.why.retouch": "Les faire retoucher", "send.why.print": "Des tirages", "send.why.other": "Autre",
    "send.go": "Envoyer", "send.ok": "Sélection envoyée. Elle reste enregistrée dans ce navigateur.", "send.saved": "Votre sélection est gardée dans ce navigateur.",
    "e.selections_closed": "L'envoi de sélections n'est pas ouvert pour cette galerie.", "e.nothing_selected": "Sélectionnez au moins une photo.",
    "e.archived.k": "Galerie archivée", "e.archived.h": "Cette galerie est archivée", "e.archived.p": "Elle n'est plus consultable en ligne. Écrivez-moi si vous avez besoin de vos photos : baeypro@gmail.com.",
    "lb.dl": "Télécharger l'original", "lb.nodl": "Le téléchargement de cette photo n'est pas ouvert.", "lb.close": "Fermer", "lb.prev": "Photo précédente", "lb.next": "Photo suivante", "lb.sel": "Sélectionner cette photo",
    "zip.h": "Téléchargement en plusieurs parties", "zip.p": "Votre sélection est volumineuse : elle est découpée en archives ZIP. Téléchargez chaque partie.",
    "zip.part": (k, n, c, s) => `Partie ${k} sur ${n} · ${c} photos · ${s}`, "zip.prep": "Préparation de l'archive…", "zip.go": "Le téléchargement commence.",
    "dl.start": "Le téléchargement commence.",
    "e.generic": "Une erreur est survenue. Réessayez dans un instant.",
    "e.download_disabled": "Le téléchargement n'est pas ouvert pour cette galerie.",
    "foot.privacy": "Confidentialité",
    "empty.all": "Cette galerie ne contient pas encore de photos.", "empty.mine": "Aucune photo ne vous est encore attribuée.",
  },
  en: {
    "nav.mine": "My photos", "nav.portfolio": "Portfolio", "lang": "FR", "lang.aria": "Passer en français",
    "land.kick": "Client gallery", "land.h": "Get my photos",
    "land.p": "Enter the link or code you received after your shoot or event. Your photos are waiting in full original quality.",
    "land.label": "Gallery link or code", "land.ph": "Paste your link or code", "land.go": "Open",
    "land.bad": "This link or code doesn't look right.",
    "how.1": "Open your gallery", "how.1s": "With the link or code I sent you.",
    "how.2": "Choose", "how.2s": "Browse the gallery and select the ones you like.",
    "how.3": "Download", "how.3s": "One photo, a selection or everything, in original quality.",
    "ev.h": "Event galleries",
    "not.ready": "The delivery service will be available very soon.",
    "lock.kick": "Protected gallery", "lock.pw": "Password", "lock.code": "Access code", "lock.go": "Open the gallery",
    "msg.back": "Back to start",
    "e.bad_password": "Wrong password.", "e.bad_code": "Wrong access code.",
    "e.too_many_attempts": m => `Too many attempts. Try again in ${Math.ceil((m || 60) / 60)} min.`,
    "e.gone.k": "Gallery expired", "e.gone.h": "This gallery is no longer available", "e.gone.p": "The download window has closed. Email me if you still need your photos: baeypro@gmail.com.",
    "e.nf.k": "Link not found", "e.nf.h": "I can't find this gallery", "e.nf.p": "Check the link you received, or ask me for a new one.",
    "e.net": "Can't connect right now. Check your network and try again.",
    "dl.all": "Download all", "select": "Select", "select.done": "Done",
    "tab.all": "All", "tab.mine": "My photos",
    "count": (n, s) => `${n} photo${n > 1 ? "s" : ""}${s ? " · " + s : ""}`,
    "until": d => `Available until ${d}`, "event": "Event gallery", "private": "Private gallery", "restricted": "Personal gallery",
    "hello": n => `Hi ${n}`,
    "sel.n": n => `${n} selected`, "sel.all": "All", "sel.dl": "Download", "sel.cancel": "Clear selection",
    "sel.send": "Send to the photographer", "tab.picked": "My selection", "empty.picked": "Your selection is empty. Tap “Select”, then the photos you like.",
    "send.h": "Send my selection", "send.p": n => `${n} photo${n > 1 ? "s" : ""} will be sent to the photographer, with their file names.`,
    "send.name": "Your name", "send.email": "Your email (for the reply)", "send.why": "What for?", "send.note": "A message (optional)",
    "send.why.download": "To get them", "send.why.retouch": "Retouching", "send.why.print": "Prints", "send.why.other": "Other",
    "send.go": "Send", "send.ok": "Selection sent. It stays saved in this browser.", "send.saved": "Your selection is kept in this browser.",
    "e.selections_closed": "Sending selections is not open for this gallery.", "e.nothing_selected": "Select at least one photo.",
    "e.archived.k": "Gallery archived", "e.archived.h": "This gallery is archived", "e.archived.p": "It can no longer be viewed online. Email me if you need your photos: baeypro@gmail.com.",
    "lb.dl": "Download original", "lb.nodl": "Downloads aren't open for this photo.", "lb.close": "Close", "lb.prev": "Previous photo", "lb.next": "Next photo", "lb.sel": "Select this photo",
    "zip.h": "Download in several parts", "zip.p": "Your selection is large, so it's split into ZIP archives. Download each part.",
    "zip.part": (k, n, c, s) => `Part ${k} of ${n} · ${c} photos · ${s}`, "zip.prep": "Preparing the archive…", "zip.go": "Your download is starting.",
    "dl.start": "Your download is starting.",
    "e.generic": "Something went wrong. Try again in a moment.",
    "e.download_disabled": "Downloads aren't open for this gallery.",
    "foot.privacy": "Privacy",
    "empty.all": "This gallery has no photos yet.", "empty.mine": "No photos have been assigned to you yet.",
  },
};
let lang = store.get("bbz-lang", (navigator.language || "fr").slice(0, 2)) === "en" ? "en" : "fr";
const t = (k, ...a) => { const v = T[lang][k] ?? T.fr[k] ?? k; return typeof v === "function" ? v(...a) : v; };
const fmtBytes = n => { const u = lang === "fr" ? ["o", "Ko", "Mo", "Go", "To"] : ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (n >= 1000 && i < 4) { n /= 1000; i++; } return `${n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: n < 10 && i ? 1 : 0 })}${nb}${u[i]}`; };
const fmtDate = (d, long) => { try { return new Date(typeof d === "number" ? d * 1000 : d + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: long ? "long" : "short", year: "numeric" }); } catch { return d; } };
function applyLang() {
  document.documentElement.lang = lang;
  $$("[data-t]").forEach(el => { const v = t(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $$("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
  $$("[data-ta]").forEach(el => el.setAttribute("aria-label", t(el.dataset.ta)));
  $("#lang").textContent = t("lang"); $("#lang").setAttribute("aria-label", t("lang.aria"));
  if (S.gallery) { renderHead(); render(); }
}
$("#lang").addEventListener("click", () => { lang = lang === "fr" ? "en" : "fr"; store.set("bbz-lang", lang); applyLang(); });

let toastT;
function toast(msg, bad) { const el = $("#toast"); el.textContent = msg; el.classList.toggle("bad", !!bad); el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 3400); }
function errText(e) {
  const code = e && e.code;
  if (code === "too_many_attempts") return t("e.too_many_attempts", e.data && e.data.retryAfter);
  if (code && T.fr["e." + code]) return t("e." + code);
  if (e && e.net) return t("e.net");
  return t("e.generic");
}

async function api(path, { method = "GET", body, raw, headers = {}, auth = true } = {}) {
  const h = { ...headers };
  if (auth && S.token) h.Authorization = "Bearer " + S.token;
  if (body !== undefined) { h["Content-Type"] = "application/json"; raw = JSON.stringify(body); }
  let r;
  try { r = await fetch(API + path, { method, headers: h, body: raw }); }
  catch { const e = new Error("net"); e.net = true; throw e; }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((data && data.error) || "http_" + r.status); e.code = data && data.error; e.status = r.status; e.data = data; throw e; }
  return data;
}

// ---------------- état ----------------
const S = { slug: null, code: null, token: null, meta: null, gallery: null, guest: null, photos: [], byId: new Map(), view: "all", sel: new Set(), selecting: false, list: [], shown: 0 };
const show = id => ["vLand", "vLock", "vMsg", "vGal"].forEach(v => $("#" + v).hidden = v !== id);

function parseInput(v) {
  v = (v || "").trim();
  try { const u = new URL(v); return { g: u.searchParams.get("g"), c: u.searchParams.get("c") }; } catch {}
  const m = /([A-Za-z0-9]{22})(?:[^A-Za-z0-9]+([A-Za-z0-9]{10}))?/.exec(v);
  return m ? { g: m[1], c: m[2] || null } : { g: null };
}

// ---------------- accueil ----------------
async function landing() {
  show("vLand");
  document.title = `${t("nav.mine")} · BIGBEEZARR`;
  if (!API) { $("#notReady").hidden = false; return; }
  try {
    const { galleries } = await api("/api/public", { auth: false });
    if (!galleries.length) return;
    const list = $("#evList"); list.textContent = "";
    for (const g of galleries) {
      const a = document.createElement("a"); a.className = "ev"; a.href = `?g=${encodeURIComponent(g.slug)}`;
      a.innerHTML = `<figure>${g.cover ? `<img loading="lazy" alt="" src="${String(g.cover.url).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";")}">` : ""}</figure><div><b></b><small></small></div>`;
      a.querySelector("b").textContent = g.title;
      a.querySelector("small").textContent = [g.date && fmtDate(g.date, true), t("count", g.count)].filter(Boolean).join(" · ");
      list.appendChild(a);
    }
    $("#events").hidden = false;
  } catch {}
}
$("#openForm").addEventListener("submit", e => {
  e.preventDefault();
  const r = parseInput($("#openIn").value);
  if (!r.g) { $("#openErr").textContent = t("land.bad"); return; }
  location.search = `?g=${r.g}${r.c ? `&c=${r.c}` : ""}`;
});

// ---------------- galerie ----------------
function message(kind) {
  show("vMsg");
  $("#msgKick").textContent = t(`e.${kind}.k`); $("#msgTitle").textContent = t(`e.${kind}.h`); $("#msgText").textContent = t(`e.${kind}.p`);
}

async function openGallery() {
  if (!API) return landing();
  const saved = ss.get("bbz-g-" + S.slug);
  if (saved && saved.e * 1000 > Date.now() && (!S.code || saved.c === S.code)) S.token = saved.token;
  try { S.meta = await api(`/api/g/${S.slug}`, { auth: false }); }
  catch (e) {
    if (e.status === 410) return message(e.data && e.data.archived ? "archived" : "gone");
    if (e.status === 404) return message("nf");
    show("vMsg"); $("#msgKick").textContent = ""; $("#msgTitle").textContent = t("e.net"); $("#msgText").textContent = ""; return;
  }
  document.title = `${S.meta.title} · BIGBEEZARR`;
  if (S.token && await loadPhotos().then(() => true, () => false)) return;
  if (!S.meta.needsPassword && (!S.meta.needsCode || S.code)) {
    try { await unlock({ code: S.code }); return; } catch (e) { if (e.code !== "bad_code") return message(e.status === 410 ? "gone" : "nf"); }
  }
  lockScreen();
}

function lockScreen(err) {
  show("vLock");
  $("#lockTitle").textContent = S.meta.title;
  $("#lockMeta").textContent = [S.meta.date && fmtDate(S.meta.date, true), t("count", S.meta.count)].filter(Boolean).join(" · ");
  $("#pwField").hidden = !S.meta.needsPassword;
  $("#codeField").hidden = !(S.meta.needsCode && !S.code);
  $("#lockErr").textContent = err || "";
  setTimeout(() => (S.meta.needsPassword ? $("#pwIn") : $("#codeIn")).focus(), 50);
}
$("#lockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.submitter || $("#lockForm button"); btn.disabled = true;
  try { await unlock({ password: $("#pwIn").value, code: S.code || $("#codeIn").value.trim() || undefined }); }
  catch (er) { $("#lockErr").textContent = errText(er); if (er.code === "bad_code") S.code = null, $("#codeField").hidden = !S.meta.needsCode; }
  finally { btn.disabled = false; }
});

async function unlock(body) {
  const r = await api(`/api/g/${S.slug}/unlock`, { method: "POST", body, auth: false });
  S.token = r.token; if (body.code) S.code = body.code;
  ss.set("bbz-g-" + S.slug, { token: r.token, e: r.expiresAt, c: S.code || null });
  await loadPhotos();
}

const selKey = () => "bbz-sel-" + S.slug;
function saveSel() { try { localStorage.setItem(selKey(), JSON.stringify([...S.sel])); } catch {} }
function loadSel() { try { (JSON.parse(localStorage.getItem(selKey()) || "[]") || []).forEach(id => { if (S.byId.has(id)) S.sel.add(id); }); } catch {} }
async function loadPhotos() {
  const r = await api(`/api/g/${S.slug}/photos`);
  S.gallery = r.gallery; S.guest = r.guest; S.photos = r.photos; S.byId = new Map(r.photos.map(p => [p.id, p]));
  loadSel();
  show("vGal");
  renderHead(); render();
  return true;
}

function renderHead() {
  const g = S.gallery, cover = S.meta && S.meta.cover || (S.photos.find(p => p.p) ? { url: S.photos.find(p => p.p).p } : null);
  $("#gCover").hidden = !cover; $("#gHead").classList.toggle("nocover", !cover);
  if (cover && $("#gCoverImg").getAttribute("src") !== cover.url) $("#gCoverImg").src = cover.url;
  $("#gKick").textContent = S.guest ? t("hello", S.guest) : t(g.kind);
  $("#gTitle").textContent = g.title;
  const dl = S.photos.filter(p => p.o), size = S.photos.reduce((s, p) => s + p.size, 0);
  const meta = [g.date && fmtDate(g.date, true), g.client, t("count", S.photos.length, fmtBytes(size)), g.expiresAt && t("until", fmtDate(g.expiresAt, true))].filter(Boolean);
  $("#gMeta").innerHTML = meta.map((m, i) => `${i ? '<span class="dot" aria-hidden="true"></span>' : ""}<span></span>`).join("");
  [...$("#gMeta").querySelectorAll("span:not(.dot)")].forEach((el, i) => el.textContent = meta[i]);
  $("#allBtn").hidden = !dl.length;
  $("#selBtn").hidden = !dl.length && !g.selections;
  $("#selBtn").textContent = S.selecting ? t("select.done") : t("select");
  const hasMine = S.photos.some(p => p.mine);
  $("#tabs").hidden = !(hasMine || S.sel.size);
  $("#tabs [data-view=mine]").hidden = !hasMine;
  $("#tabs [data-view=picked]").hidden = !S.sel.size;
  $$("#tabs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === S.view)));
}

function currentList() {
  if (S.view === "mine") return S.photos.filter(p => p.mine);
  if (S.view === "picked") return S.photos.filter(p => S.sel.has(p.id));
  return S.photos;
}

const CHUNK = 90;
let io;
function render() {
  const grid = $("#grid");
  S.list = currentList(); S.shown = 0; grid.textContent = "";
  grid.classList.toggle("selecting", S.selecting);
  $("#countHint").textContent = S.view === "all" ? "" : t("count", S.list.length);
  $("#emptyMsg").hidden = !!S.list.length;
  if (!S.list.length) $("#emptyMsg").textContent = S.view === "mine" ? t("empty.mine") : S.view === "picked" ? t("empty.picked") : t("empty.all");
  more(); updateSel();
}
function more() {
  const grid = $("#grid"), frag = document.createDocumentFragment();
  const end = Math.min(S.list.length, S.shown + CHUNK);
  for (let i = S.shown; i < end; i++) frag.appendChild(tile(S.list[i], i));
  grid.appendChild(frag); S.shown = end;
}
io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && S.shown < S.list.length) more(); }, { rootMargin: "1200px 0px" });
io.observe($("#more"));

const TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.4 3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.4" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="#fff" stroke-width="1.5"/></svg>';
function tile(p, i) {
  const el = document.createElement("div");
  el.className = "tile" + (S.sel.has(p.id) ? " on" : "");
  el.dataset.id = p.id; el.dataset.i = i;
  el.tabIndex = 0; el.setAttribute("role", "button");
  el.setAttribute("aria-label", p.name);
  const r = p.w && p.h ? p.w / p.h : 1.5;
  el.style.setProperty("--r", r.toFixed(3));
  if (p.t) {
    const img = new Image(); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = p.t;
    img.onload = () => img.classList.add("in"); el.appendChild(img);
  } else {
    const ext = (p.name.split(".").pop() || "").toUpperCase();
    el.insertAdjacentHTML("beforeend", `<span class="ph-raw"><b></b><span></span></span>`);
    el.querySelector(".ph-raw b").textContent = ext.slice(0, 5); el.querySelector(".ph-raw span").textContent = p.name;
  }
  if (p.o || S.gallery.selections) el.insertAdjacentHTML("beforeend", `<span class="sel" aria-hidden="true">${TICK}</span>`);
  if (!p.o) el.insertAdjacentHTML("beforeend", `<span class="lock" aria-hidden="true">${LOCK}</span>`);
  if (p.mine && S.view === "all") el.insertAdjacentHTML("beforeend", `<span class="badge">${t("tab.mine")}</span>`);
  return el;
}
$("#grid").addEventListener("click", e => {
  const el = e.target.closest(".tile"); if (!el) return;
  const p = S.byId.get(el.dataset.id);
  if (S.selecting || e.target.closest(".sel")) { toggle(p); return; }
  openLb(+el.dataset.i);
});
$("#grid").addEventListener("keydown", e => {
  const el = e.target.closest(".tile"); if (!el || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault(); const p = S.byId.get(el.dataset.id);
  if (S.selecting) toggle(p); else openLb(+el.dataset.i);
});
function toggle(p) {
  if (!p || !(p.o || S.gallery.selections)) return;
  S.sel.has(p.id) ? S.sel.delete(p.id) : S.sel.add(p.id);
  const el = $(`.tile[data-id="${p.id}"]`); if (el) el.classList.toggle("on", S.sel.has(p.id));
  saveSel(); updateSel();
}
function updateSel() {
  const n = S.sel.size, dl = [...S.sel].filter(id => S.byId.get(id)?.o), size = dl.reduce((s, id) => s + (S.byId.get(id)?.size || 0), 0);
  $("#selN").innerHTML = `<span></span><small></small>`;
  $("#selN span").textContent = t("sel.n", n); $("#selN small").textContent = dl.length ? fmtBytes(size) : t("send.saved");
  $("#selbar").classList.toggle("show", n > 0 || S.selecting);
  $("#selDl").disabled = !dl.length; $("#selDl").hidden = !S.photos.some(p => p.o);
  $("#selSend").hidden = !(S.gallery && S.gallery.selections); $("#selSend").disabled = !n;
  $("#tabs [data-view=picked]").hidden = !n; if (n && $("#tabs").hidden) $("#tabs").hidden = false;
}
/* the selection stays in this browser: leaving select mode keeps it, the cross clears it */
$("#selBtn").addEventListener("click", () => { S.selecting = !S.selecting; renderHead(); render(); });
$("#selX").addEventListener("click", () => { S.sel.clear(); saveSel(); S.selecting = false; if (S.view === "picked") S.view = "all"; renderHead(); render(); });
$("#selAll").addEventListener("click", () => { S.list.forEach(p => (p.o || S.gallery.selections) && S.sel.add(p.id)); saveSel(); render(); });
$("#selDl").addEventListener("click", () => download([...S.sel].filter(id => S.byId.get(id)?.o)));
$("#selSend").addEventListener("click", () => {
  const d = $("#sendDlg"); $("#sendP").textContent = t("send.p", S.sel.size);
  if (S.guest && !$("#sendName").value) $("#sendName").value = S.guest;
  $("#sendErr").textContent = ""; d.showModal(); setTimeout(() => $("#sendName").focus(), 40);
});
$("#sendForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#sendForm button[type=submit]"); btn.disabled = true; $("#sendErr").textContent = "";
  try {
    await api(`/api/g/${S.slug}/selection`, { method: "POST", body: { ids: [...S.sel], name: $("#sendName").value.trim(), email: $("#sendEmail").value.trim(), purpose: $("#sendWhy").value, note: $("#sendNote").value.trim() } });
    $("#sendDlg").close(); toast(t("send.ok"));
  } catch (er) { $("#sendErr").textContent = errText(er); }
  finally { btn.disabled = false; }
});
$("#allBtn").addEventListener("click", () => download(null));
$$("#tabs button").forEach(b => b.addEventListener("click", () => { S.view = b.dataset.view; renderHead(); render(); window.scrollTo({ top: $("#tools").offsetTop - 60 }); }));

function fire(url) { const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
async function download(ids) {
  try {
    if (ids && ids.length === 1) { const p = S.byId.get(ids[0]); if (p && p.o) { fire(p.o); toast(t("dl.start")); } return; }
    toast(t("zip.prep"));
    const r = await api(`/api/g/${S.slug}/zip`, { method: "POST", body: ids ? { ids } : { all: true } });
    if (r.parts.length === 1) { fire(r.parts[0].url); toast(t("zip.go")); return; }
    const box = $("#zipParts"); box.textContent = "";
    r.parts.forEach((part, k) => {
      const a = document.createElement("a"); a.className = "btn"; a.href = part.url; a.rel = "noopener";
      a.textContent = t("zip.part", k + 1, r.parts.length, part.count, fmtBytes(part.size));
      a.addEventListener("click", () => a.classList.add("light"));
      box.appendChild(a);
    });
    $("#zipDlg").showModal();
  } catch (e) { toast(errText(e), true); }
}

// ---------------- visionneuse ----------------
let lbI = -1, lbLast = null;
function openLb(i) {
  lbLast = document.activeElement; lbI = i; paintLb();
  const lb = $("#lb"); lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden"; $("#lbX").focus();
}
function closeLb() {
  const lb = $("#lb"); lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = ""; $("#lbImg").removeAttribute("src"); lbI = -1;
  if (lbLast) lbLast.focus();
}
function paintLb() {
  const p = S.list[lbI]; if (!p) return;
  const img = $("#lbImg");
  img.style.opacity = ".001"; img.onload = () => img.style.opacity = "1";
  img.src = p.p || p.t || ""; img.alt = p.name;
  $("#lbName").innerHTML = "<b></b><span></span>";
  $("#lbName b").textContent = `${lbI + 1} / ${S.list.length}`;
  $("#lbName span").textContent = `${p.name} · ${fmtBytes(p.size)}`;
  $("#lbDl").hidden = !p.o; if (p.o) $("#lbDl").href = p.o;
  $("#lbNoDl").hidden = !!p.o; $("#lbSel").hidden = !p.o;
  $("#lbSelTick").setAttribute("opacity", S.sel.has(p.id) ? "1" : "0");
  const nx = S.list[lbI + 1]; if (nx && nx.p) { const pre = new Image(); pre.src = nx.p; }
}
const step = d => { if (lbI < 0) return; lbI = (lbI + d + S.list.length) % S.list.length; paintLb(); };
$("#lbX").addEventListener("click", closeLb);
$("#lbPrev").addEventListener("click", () => step(-1));
$("#lbNext").addEventListener("click", () => step(1));
$("#lbSel").addEventListener("click", () => { toggle(S.list[lbI]); paintLb(); });
$("#lbDl").addEventListener("click", () => toast(t("dl.start")));
document.addEventListener("keydown", e => {
  if (lbI < 0) return;
  if (e.key === "Escape") closeLb(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
});
let sx = null, sy = null;
$("#lbStage").addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
$("#lbStage").addEventListener("pointerup", e => {
  if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  else if (dy > 90) closeLb();
});

// ---------------- fenêtres ----------------
$$("dialog [data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

// ---------------- démarrage ----------------
const q = new URLSearchParams(location.search);
S.slug = q.get("g"); S.code = q.get("c");
applyLang();
if (S.slug && /^[A-Za-z0-9]{22}$/.test(S.slug)) openGallery(); else landing();
})();
