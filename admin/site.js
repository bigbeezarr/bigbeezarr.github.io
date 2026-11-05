/* Tableau de bord BIGBEEZARR, suite : réservations, calendrier, clients, sélections reçues, contenu du portfolio, statistiques. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const A = () => window.BBZA;
const esc = s => A().esc(s);
const SECTIONS = { reservations: "vBook", calendrier: "vCal", clients: "vClients", selections: "vSel", portfolio: "vPort", statistiques: "vStats" };
const STATUS = { new: "Nouvelle", discussion: "En discussion", confirmed: "Confirmée", declined: "Refusée", cancelled: "Annulée", done: "Réalisée" };
const STATUS_PILL = { new: "red", discussion: "warn", confirmed: "ok", declined: "", cancelled: "", done: "" };
const TYPES = { soiree: "Soirée / événement", concert: "Concert / scène", sport: "Sport / équipe", marque: "Marque / mode", portrait: "Portrait / artiste", exposition: "Exposition", autre: "Autre" };
const head = (kick, title, extra = "") => `<div class="head"><div><p class="kicker" style="margin:0 0 8px;font-family:var(--font-d);font-weight:700;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text)">${esc(kick)}</p><h1 class="t">${esc(title)}</h1></div><span class="sp"></span>${extra}</div>`;
const money = c => c == null ? "" : (c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = v => { if (v === "" || v == null) return null; const n = Math.round(parseFloat(String(v).replace(",", ".")) * 100); return isNaN(n) ? null : n; };
const notConfigured = (what, how) => `<div class="box warnbox"><p><b>${esc(what)}</b></p><p>${how}</p></div>`;

window.BBZS = {
  has: sec => sec in SECTIONS,
  open: sec => { A().show(SECTIONS[sec]); ({ reservations: bookings, calendrier: cal, clients, selections, portfolio, statistiques: stats })[sec](); },
};

// =============== réservations ===============
let BK = [], CL = [];
async function bookings() {
  const v = $("#vBook");
  v.innerHTML = head("Prestations", "Réservations", `<label class="field" style="min-width:200px"><span>Filtrer</span><select class="input" id="bkF"><option value="">Toutes</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>`) +
    `<p class="hint" style="margin:-8px 0 18px;max-width:70ch">Une demande n'est jamais confirmée automatiquement. Passez-la en « Confirmée » quand la date et le devis sont acceptés : une date déjà confirmée ou bloquée ne peut pas l'être deux fois.</p><div id="bkList" class="glist"></div>`;
  $("#bkF").addEventListener("change", loadBookings);
  try { CL = (await A().api("/api/admin/clients")).clients; } catch { CL = []; }
  loadBookings();
}
async function loadBookings() {
  const st = $("#bkF").value;
  try { BK = (await A().api("/api/admin/bookings" + (st ? "?status=" + st : ""))).bookings; } catch (e) { A().toast(A().errText(e), true); return; }
  const box = $("#bkList"); box.innerHTML = BK.length ? "" : '<p class="hint">Aucune demande pour l\'instant.</p>';
  for (const b of BK) {
    const el = document.createElement("div"); el.className = "box"; el.style.display = "grid"; el.style.gap = "10px";
    el.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
        <div><div class="row" style="gap:8px"><b style="font-family:var(--font-d);font-size:1.1rem">${esc(b.first_name)} ${esc(b.last_name)}</b><span class="pill ${STATUS_PILL[b.status]}">${esc(STATUS[b.status] || b.status)}</span><span class="pill">${esc(TYPES[b.type] || b.type)}</span></div>
        <p class="hint" style="margin:6px 0 0">${b.date ? "Date souhaitée : <b>" + esc(A().fmtDate(b.date)) + "</b> · " : ""}${esc([b.city, b.place].filter(Boolean).join(" · "))}${b.people ? " · " + esc(b.people) + " pers." : ""}${b.duration ? " · " + esc(b.duration) : ""}${b.budget ? " · budget " + esc(b.budget) : ""}</p>
        <p class="hint" style="margin:4px 0 0"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? ` · <a href="tel:${esc(b.phone.replace(/[^+\d]/g, ""))}">${esc(b.phone)}</a>` : ""} · reçue le ${esc(A().fmtWhen(b.created_at))}</p></div></div>
      <p style="margin:0;white-space:pre-wrap"></p>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
        <label class="field"><span>Statut</span><select class="input" data-k="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === b.status ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>Date</span><input class="input" type="date" data-k="date" value="${esc(b.date || "")}"></label>
        <label class="field"><span>Client</span><select class="input" data-k="client_id"><option value="">—</option>${CL.map(c => `<option value="${esc(c.id)}"${c.id === b.client_id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Prix (${esc(b.currency || "CAD")})</span><input class="input" inputmode="decimal" data-k="price" value="${esc(money(b.price_cents))}"></label>
        <label class="field"><span>Acompte</span><input class="input" inputmode="decimal" data-k="deposit" value="${esc(money(b.deposit_cents))}"></label>
      </div>
      <label class="field"><span>Note privée</span><textarea class="input" data-k="note" maxlength="4000"></textarea></label>
      <div class="row"><button class="btn small primary" data-a="save" type="button">Enregistrer</button><a class="btn small" href="mailto:${esc(b.email)}?subject=${encodeURIComponent("Votre demande de prestation · BIGBEEZARR")}">Répondre</a><button class="btn small" data-a="client" type="button">Créer la fiche client</button><span class="sp" style="flex:1"></span><button class="btn small danger" data-a="del" type="button">Supprimer</button></div>`;
    el.querySelector("p[style*=pre-wrap]").textContent = b.description || "";
    el.querySelector("[data-k=note]").value = b.note || "";
    const val = k => el.querySelector(`[data-k=${k}]`).value;
    el.querySelector("[data-a=save]").addEventListener("click", async () => {
      const body = { status: val("status"), date: val("date") || null, client_id: val("client_id") || null, price_cents: cents(val("price")), deposit_cents: cents(val("deposit")), note: val("note") };
      try { await A().api(`/api/admin/bookings/${b.id}`, { method: "PATCH", body }); A().toast("Demande enregistrée."); loadBookings(); }
      catch (e) {
        if (e.code === "date_taken" && confirm(`Le ${A().fmtDate(e.data.date)} est déjà confirmé ou bloqué. Confirmer quand même (double réservation) ?`)) {
          try { await A().api(`/api/admin/bookings/${b.id}`, { method: "PATCH", body: { ...body, force: true } }); A().toast("Enregistré malgré le conflit."); loadBookings(); } catch (e2) { A().toast(A().errText(e2), true); }
        } else if (e.code !== "date_taken") A().toast(A().errText(e), true);
      }
    });
    el.querySelector("[data-a=client]").addEventListener("click", async () => {
      try { const r = await A().api("/api/admin/clients", { method: "POST", body: { name: `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email, email: b.email, phone: b.phone } });
        await A().api(`/api/admin/bookings/${b.id}`, { method: "PATCH", body: { client_id: r.client.id } }); A().toast("Fiche client créée."); CL.push(r.client); loadBookings(); } catch (e) { A().toast(A().errText(e), true); }
    });
    el.querySelector("[data-a=del]").addEventListener("click", async () => { if (!confirm("Supprimer définitivement cette demande ?")) return; try { await A().api(`/api/admin/bookings/${b.id}`, { method: "DELETE" }); loadBookings(); } catch (e) { A().toast(A().errText(e), true); } });
    box.appendChild(el);
  }
}

// =============== calendrier ===============
let calMonth = null;
async function cal() {
  const v = $("#vCal");
  if (!calMonth) { const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
  v.innerHTML = head("Disponibilités", "Calendrier", `<div class="row"><button class="btn small" id="cPrev" type="button" aria-label="Mois précédent">←</button><b id="cM" style="font-family:var(--font-d);min-width:9em;text-align:center"></b><button class="btn small" id="cNext" type="button" aria-label="Mois suivant">→</button></div>`) +
    `<p class="hint" style="margin:-8px 0 16px;max-width:70ch">Touchez un jour pour le bloquer ou le débloquer. Les jours bloqués et les prestations confirmées apparaissent comme « pris » dans le formulaire de réservation du site (sans aucun nom).</p><div class="cal" id="cGrid"></div>`;
  $("#cPrev").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); cal(); });
  $("#cNext").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); cal(); });
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $("#cM").textContent = calMonth.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const start = new Date(y, m, 1 - ((new Date(y, m, 1).getDay() + 6) % 7)), end = new Date(start); end.setDate(end.getDate() + 41);
  let data; try { data = await A().api(`/api/admin/calendar?from=${iso(start)}&to=${iso(end)}`); } catch (e) { A().toast(A().errText(e), true); return; }
  const blocked = new Map(data.blocked.map(b => [b.day, b])), byDay = {};
  data.bookings.forEach(b => (byDay[b.date] ||= []).push(b));
  const g = $("#cGrid"); g.innerHTML = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map(d => `<span class="dh">${d}</span>`).join("");
  const today = iso(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const k = iso(d);
    const b = document.createElement("button"); b.type = "button"; b.className = "d" + (d.getMonth() !== m ? " out" : "") + (k === today ? " today" : "") + (blocked.has(k) ? " blk" : "");
    b.innerHTML = `<b>${d.getDate()}</b>` + (blocked.has(k) ? `<span class="ev">Bloqué${blocked.get(k).note ? " · " + esc(blocked.get(k).note) : ""}</span>` : "") + (byDay[k] || []).sort((a, z) => (z.status === "confirmed") - (a.status === "confirmed")).slice(0, 2).map(x => `<span class="ev ${x.status}">${esc(x.first_name || "")} ${esc((x.last_name || "").slice(0, 1))}. · ${esc(STATUS[x.status])}</span>`).join("") + ((byDay[k] || []).length > 2 ? `<span class="ev more">+${byDay[k].length - 2}</span>` : "");
    b.setAttribute("aria-label", `${d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}${blocked.has(k) ? ", bloqué" : ""}${byDay[k] ? ", " + byDay[k].length + " demande(s)" : ""}`);
    b.addEventListener("click", async () => {
      try {
        if (blocked.has(k)) await A().api(`/api/admin/blocked/${k}`, { method: "DELETE" });
        else { const note = prompt("Bloquer ce jour. Note (facultative) :", ""); if (note === null) return; await A().api(`/api/admin/blocked/${k}`, { method: "PUT", body: { note } }); }
        cal();
      } catch (e) { A().toast(A().errText(e), true); }
    });
    g.appendChild(b);
  }
}

// =============== clients ===============
async function clients(openId) {
  const v = $("#vClients");
  v.innerHTML = head("Fichier", "Clients", `<button class="btn primary" id="clNew" type="button">Nouveau client</button>`) + `<div id="clList" class="glist"></div><div id="clDetail" style="margin-top:22px"></div>`;
  $("#clNew").addEventListener("click", async () => { const name = prompt("Nom du client ou de l'organisation :"); if (!name) return; try { const r = await A().api("/api/admin/clients", { method: "POST", body: { name } }); clients(r.client.id); } catch (e) { A().toast(A().errText(e), true); } });
  try { CL = (await A().api("/api/admin/clients")).clients; } catch (e) { A().toast(A().errText(e), true); return; }
  const box = $("#clList"); box.innerHTML = CL.length ? "" : '<p class="hint">Aucun client. Créez une fiche, ou depuis une demande de réservation.</p>';
  for (const c of CL) {
    const el = document.createElement("div"); el.className = "grow"; el.style.gridTemplateColumns = "minmax(0,1fr) auto"; el.tabIndex = 0;
    el.innerHTML = `<div><b>${esc(c.name)}</b><div class="sub"><span>${esc(c.org || "")}</span><span>${esc(c.email || "")}</span><span>${esc(c.phone || "")}</span><span>${c.galleries} galerie(s) · ${c.bookings} demande(s)</span></div></div><span class="hint">Ouvrir</span>`;
    el.addEventListener("click", () => clientDetail(c.id));
    box.appendChild(el);
  }
  if (openId) clientDetail(openId);
}
async function clientDetail(id) {
  let d; try { d = await A().api(`/api/admin/clients/${id}`); } catch (e) { A().toast(A().errText(e), true); return; }
  const c = d.client, box = $("#clDetail");
  const EV = { view: "Galerie ouverte", dl: "Photo téléchargée", zip: "Archive ZIP téléchargée", selection: "Sélection envoyée" };
  box.innerHTML = `<div class="box" style="display:grid;gap:14px"><h2 class="s">${esc(c.name)}</h2>
    <form class="form" id="clForm" style="max-width:none"><div class="two"><label class="field"><span>Nom</span><input class="input" name="name" required maxlength="120"></label><label class="field"><span>Organisation</span><input class="input" name="org" maxlength="120"></label></div>
    <div class="two"><label class="field"><span>Courriel</span><input class="input" name="email" type="email" maxlength="160"></label><label class="field"><span>Téléphone</span><input class="input" name="phone" maxlength="40"></label></div>
    <label class="field"><span>Notes</span><textarea class="input" name="note" maxlength="4000"></textarea></label>
    <div class="row"><button class="btn small primary" type="submit">Enregistrer</button><span class="sp" style="flex:1"></span><button class="btn small danger" type="button" id="clDel">Supprimer la fiche</button></div></form>
    <div><h2 class="s">Galeries livrées</h2>${d.galleries.length ? `<table class="tbl"><thead><tr><th>Galerie</th><th>Date</th><th>Visites</th><th>Téléchargements</th><th>État</th></tr></thead><tbody>${d.galleries.map(g => `<tr class="click" data-g="${esc(g.id)}"><td>${esc(g.title)}</td><td>${esc(A().fmtDate(g.event_date))}</td><td>${g.views}</td><td>${g.downloads} · ${g.zips} ZIP</td><td>${g.archived_at ? "Archivée" : g.expires_at && g.expires_at * 1000 < Date.now() ? "Expirée" : "En ligne"}</td></tr>`).join("")}</tbody></table>` : '<p class="hint">Aucune galerie reliée. Dans une galerie, onglet Réglages, choisissez ce client.</p>'}</div>
    <div><h2 class="s">Demandes</h2>${d.bookings.length ? d.bookings.map(b => `<p class="hint" style="margin:4px 0">${esc(A().fmtDate(b.date) || "sans date")} · ${esc(TYPES[b.type] || b.type)} · ${esc(STATUS[b.status])}</p>`).join("") : '<p class="hint">Aucune.</p>'}</div>
    <div><h2 class="s">Historique des livraisons</h2><div class="ev-log">${d.history.map(h => `<div><span>${esc(EV[h.kind] || h.kind)} · ${esc(h.title)}${h.n > 1 ? " · " + h.n : ""}</span><span class="hint">${esc(A().fmtWhen(h.at))}</span></div>`).join("") || '<p class="hint">Rien pour l\'instant.</p>'}</div></div></div>`;
  const f = $("#clForm"); ["name", "org", "email", "phone", "note"].forEach(k => f.elements[k].value = c[k] || "");
  f.addEventListener("submit", async e => { e.preventDefault(); const body = Object.fromEntries(["name", "org", "email", "phone", "note"].map(k => [k, f.elements[k].value])); try { await A().api(`/api/admin/clients/${id}`, { method: "PATCH", body }); A().toast("Fiche enregistrée."); clients(id); } catch (er) { A().toast(A().errText(er), true); } });
  $("#clDel").addEventListener("click", async () => { if (!confirm("Supprimer la fiche ? Les galeries et demandes restent, sans client.")) return; try { await A().api(`/api/admin/clients/${id}`, { method: "DELETE" }); clients(); } catch (e) { A().toast(A().errText(e), true); } });
  $$("tr[data-g]", box).forEach(tr => tr.addEventListener("click", () => location.hash = "g/" + tr.dataset.g));
  box.scrollIntoView({ block: "start" });
}

// =============== sélections reçues ===============
async function selections() {
  const v = $("#vSel");
  v.innerHTML = head("Clients", "Sélections reçues") + `<p class="hint" style="margin:-8px 0 16px;max-width:70ch">Les photos choisies par vos clients dans leurs galeries. « Copier les noms » donne la liste des fichiers, à coller dans le filtre de Lightroom (texte, « contient »).</p><div id="sList" class="glist"></div>`;
  let list; try { list = (await A().api("/api/admin/selections")).selections; } catch (e) { A().toast(A().errText(e), true); return; }
  const box = $("#sList"); box.innerHTML = list.length ? "" : '<p class="hint">Aucune sélection reçue.</p>';
  const WHY = { download: "pour les récupérer", retouch: "à retoucher", print: "pour des tirages", other: "autre" };
  for (const s of list) {
    const el = document.createElement("div"); el.className = "box"; el.style.display = "grid"; el.style.gap = "8px";
    el.innerHTML = `<div class="row" style="gap:8px"><b style="font-family:var(--font-d)">${esc(s.title)}</b><span class="pill ${s.status === "new" ? "red" : ""}">${s.status === "new" ? "Nouvelle" : s.status === "seen" ? "Vue" : "Traitée"}</span><span class="pill">${s.ids.length} photo(s) ${esc(WHY[s.purpose] || "")}</span></div>
      <p class="hint" style="margin:0">${esc(s.name || "Sans nom")}${s.email ? ` · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""} · ${esc(A().fmtWhen(s.created_at))}</p>
      <p style="margin:0;white-space:pre-wrap"></p><code style="display:block;max-height:90px;overflow:auto;font-size:.8rem;color:var(--ink-2)"></code>
      <div class="row"><button class="btn small" data-a="copy" type="button">Copier les noms</button><button class="btn small" data-a="seen" type="button">Marquer vue</button><button class="btn small" data-a="done" type="button">Marquer traitée</button></div>`;
    el.querySelector("p[style*=pre-wrap]").textContent = s.note || "";
    el.querySelector("code").textContent = s.names.join(", ");
    el.querySelector("[data-a=copy]").addEventListener("click", () => A().copy(s.names.join("\n")));
    for (const st of ["seen", "done"]) el.querySelector(`[data-a=${st}]`).addEventListener("click", async () => { try { await A().api(`/api/admin/selections/${s.id}`, { method: "PATCH", body: { status: st } }); selections(); } catch (e) { A().toast(A().errText(e), true); } });
    box.appendChild(el);
  }
}

// =============== statistiques ===============
async function stats() {
  const v = $("#vStats");
  v.innerHTML = head("Fréquentation", "Statistiques", `<label class="field"><span>Période</span><select class="input" id="stD"><option value="7">7 jours</option><option value="30" selected>30 jours</option><option value="90">90 jours</option><option value="365">12 mois</option></select></label>`) +
    `<p class="hint" style="margin:-8px 0 16px;max-width:70ch">Comptage anonyme, sans témoin ni adresse IP : une ligne par jour, par page et par type d'appareil. Les visiteurs qui demandent à ne pas être suivis (Global Privacy Control, Do Not Track) ne sont pas comptés.</p><div id="stBody"></div>`;
  $("#stD").addEventListener("change", paint); paint();
  async function paint() {
    let d; try { d = await A().api("/api/admin/stats?days=" + $("#stD").value); } catch (e) { A().toast(A().errText(e), true); return; }
    const tot = d.perDay.reduce((s, x) => s + x.n, 0), max = Math.max(1, ...d.perDay.map(x => x.n));
    const dev = Object.fromEntries(d.devices.map(x => [x.device, x.n])), devT = Math.max(1, d.devices.reduce((s, x) => s + x.n, 0));
    const ev = Object.fromEntries(d.galleries.map(x => [x.kind, x.n])), bk = d.bookings.reduce((s, x) => s + x.n, 0);
    const label = p => p === "/" ? "Accueil" : p.startsWith("/projets/") ? (p === "/projets/" ? "Tous les projets" : "Projet : " + p.split("/")[2]) : p.startsWith("#") ? "Chapitre : " + p.slice(1) : p.startsWith("@") ? ({ "@book-open": "Formulaire ouvert", "@book-sent": "Demande envoyée", "@lightbox": "Visionneuse ouverte", "@mail": "Clic courriel", "@instagram": "Clic Instagram", "@project-page": "Clic page de projet" }[p] || p) : p;
    $("#stBody").innerHTML = `<div class="stats">${[[tot, "pages vues"], [Math.round((dev.mobile || 0) / devT * 100) + " %", "sur téléphone"], [Math.round((dev.tablet || 0) / devT * 100) + " %", "sur tablette"], [bk, "demandes de réservation"], [(ev.dl || 0) + (ev.zip || 0), "téléchargements (galeries)"], [d.selections, "sélections reçues"]].map(([n, s]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(s)}</span></div>`).join("")}</div>
      <div class="box" style="margin-bottom:18px"><h2 class="s">Pages vues par jour</h2>${d.perDay.length ? `<div class="bar2" role="img" aria-label="Pages vues par jour">${d.perDay.map(x => `<i style="height:${(x.n / max * 100).toFixed(1)}%" title="${esc(x.day)} : ${x.n}"></i>`).join("")}</div><p class="hint" style="margin:8px 0 0">${esc(d.perDay[0].day)} → ${esc(d.perDay[d.perDay.length - 1].day)}</p>` : '<p class="hint">Pas encore de données. Le comptage démarre une fois le serveur relié au site.</p>'}</div>
      <div class="box"><h2 class="s">Pages, chapitres et actions</h2><table class="tbl"><tbody>${d.pages.map(x => `<tr><td>${esc(label(x.path))}</td><td style="text-align:right">${x.n}</td></tr>`).join("") || '<tr><td class="hint">Rien pour l\'instant.</td></tr>'}</tbody></table></div>`;
  }
}

// =============== contenu du portfolio ===============
// Rien n'est public par accident : un projet ou une édition créé ici commence « Non publié » ; une photo retirée du site
// va dans « Photos retirées » (content/portfolio.json → unpublished), jamais à la corbeille. Les galeries client ne
// rejoignent le portfolio que par « Ajouter depuis une galerie client », photo par photo.
let C = null, cur = null, dirty = false, sel = new Set();
const LOCAL = {}, LOCALB = {}; // vignettes (et fichiers) des photos envoyées pendant cette visite (pas encore sur le site)
const T2 = (v, l) => v == null ? "" : typeof v === "string" ? v : (v[l] ?? "");
const setT = (obj, k, fr, en) => { if (!fr && !en) { delete obj[k]; return; } obj[k] = fr === en ? fr : { fr, en: en || fr }; };
const projOf = id => { for (const c of C.portfolio.data.chapters) for (const p of c.projects) if (p.id === id) return { c, p }; return null; };
const edsOf = p => p.eds || [p];
const edYear = (p, e) => String(e.year || p.year || "");
const n3 = i => String(i).padStart(3, "0");
const isWide = i => { const m = C.meta && C.meta[i]; return !!m && m[0] > m[1]; };
const photosOf = p => { const s = new Set(); edsOf(p).forEach(e => { e.imgs.forEach(i => s.add(i)); if (e.feature) s.add(e.feature.img); }); if (p.lead) s.add(p.lead.img); return s; };
const unpub = () => (C.portfolio.data.unpublished ||= []);
const badge = on => on ? "" : ' <span class="pill red">Non publié</span>';
// loupe : ouvre la photo en grand (la vignette elle-même garde la sélection au toucher)
const ZOOM_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 12.8 17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const PEN_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6.5h9.5a.5.5 0 0 1 .5.5v9.5M6.5 3.5V13a.5.5 0 0 0 .5.5h9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
function editBtn(i) {
  const b = document.createElement("button"); b.type = "button"; b.className = "pedit"; b.draggable = false; b.innerHTML = PEN_SVG; b.dataset.edit = i;
  b.title = "Modifier la photo"; b.setAttribute("aria-label", `Modifier la photo ${i} (recadrer, tourner, zoomer)`); return b;
}
// loupe + « Modifier la photo » côte à côte (fragment : s'ajoute comme un seul élément)
function zoomBtn(i) { const f = document.createDocumentFragment(); f.append(zoomOnly(i), editBtn(i)); return f; }
function zoomOnly(i) {
  const b = document.createElement("button"); b.type = "button"; b.className = "zoom"; b.draggable = false; b.innerHTML = ZOOM_SVG;
  b.dataset.src = LOCAL[i] || `../img/f/${n3(i)}.webp`; b.dataset.t = `Photo ${n3(i)}`; b.setAttribute("aria-label", `Voir la photo ${i} en grand`);
  const a = C && C.portfolio && (C.portfolio.data.alt || {})[i]; if (a) b.dataset.sub = T2(a, "fr");
  return b;
}
function thumbImg(i) {
  const im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.decoding = "async";
  im.src = LOCAL[i] || `../img/s/${n3(i)}.webp`;
  im.addEventListener("error", () => { if (!im.dataset.f) { im.dataset.f = 1; im.src = `../img/f/${n3(i)}.webp`; } else im.style.visibility = "hidden"; });
  return im;
}

async function portfolio() {
  const v = $("#vPort");
  v.innerHTML = head("Contenu public", "Portfolio", `<div class="row"><span class="hint" id="pState"></span><button class="btn primary" id="pSave" type="button" disabled>Publier les modifications</button></div>`) + '<div id="pBody"><p class="hint">Chargement…</p></div>';
  try { C = await A().api("/api/admin/content"); }
  catch (e) {
    $("#pBody").innerHTML = e.code === "content_not_configured" ? notConfigured("Édition du portfolio pas encore reliée à GitHub.", "Ajoutez au serveur les secrets <code>GITHUB_TOKEN</code> (jeton à accès précis, permission « Contents : Read and write » sur le dépôt seulement) et <code>GITHUB_REPO</code> = <code>bigbeezarr/bigbeezarr.github.io</code>. Voir <code>worker/README.md</code>, section « Portfolio ».") : `<p class="err">${esc(A().errText(e))}</p>`;
    return;
  }
  dirty = false; paintTree(); $("#pSave").addEventListener("click", save);
  window.onbeforeunload = () => dirty ? true : undefined;
}
function mark(file = "portfolio") { C[file].dirty = true; dirty = true; $("#pSave").disabled = false; $("#pState").textContent = "Modifications non publiées"; }
function paintTree() {
  const body = $("#pBody");
  body.innerHTML = `<div class="ptree"><nav class="tree" id="pTree" aria-label="Chapitres et projets"></nav><div id="pEd"><div class="box"><p>Choisissez un projet à gauche. Chaque modification est enregistrée dans le dépôt GitHub du site, puis la publication automatique reconstruit le site (quelques minutes).</p><p class="hint">Un projet ou une édition « Non publié » n'apparaît nulle part sur le site (accueil, pages, plan du site, visionneuse). Les galeries client ne sont jamais publiées d'elles-mêmes.</p><div class="row"><button class="btn small" id="pSite" type="button">Réglages du site</button></div></div></div></div>`;
  const tree = $("#pTree");
  const extra = (key, label, hint) => { const b = document.createElement("button"); b.type = "button"; b.dataset.p = key; b.innerHTML = `${esc(label)}<br><span class="hint">${esc(hint)}</span>`; b.setAttribute("aria-current", String(cur === key)); b.addEventListener("click", () => open(key)); tree.appendChild(b); };
  tree.insertAdjacentHTML("beforeend", `<p class="ch">Site</p>`);
  extra("@home", "Accueil", `${C.home.data.hero.length} en ouverture · ${featList().length} à la une · ${C.home.data.wall.length} coups de cœur`);
  extra("@contact", "Contact", "photo, coordonnées, liens, textes");
  extra("@site", "Réglages du site", "serveur, réservations, pages");
  extra("@unpub", "Photos retirées", `${unpub().length} photo${unpub().length > 1 ? "s" : ""} hors du site`);
  C.portfolio.data.chapters.forEach(c => {
    tree.insertAdjacentHTML("beforeend", `<p class="ch">${esc(T2(c.name, "fr"))}</p>`);
    c.projects.forEach(p => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.p = p.id;
      const n = edsOf(p).reduce((s, e) => s + e.imgs.length, 0), off = p.eds ? p.eds.filter(e => e.hidden).length : 0;
      b.innerHTML = `${esc(T2(p.title, "fr"))}${p.featured ? " ★" : ""}${badge(!p.hidden)}<br><span class="hint">${n} photos${p.eds ? " · " + p.eds.length + " éditions" : ""}${off ? ` · ${off} non publiée${off > 1 ? "s" : ""}` : ""}</span>`;
      b.setAttribute("aria-current", String(cur === p.id));
      b.addEventListener("click", () => open(p.id));
      tree.appendChild(b);
    });
    const nb = document.createElement("button"); nb.type = "button"; nb.className = "add"; nb.textContent = "+ Nouveau projet";
    nb.addEventListener("click", () => newProject(c)); tree.appendChild(nb);
  });
  $("#pSite").addEventListener("click", editSite);
  if (cur) open(cur);
}
function open(key) {
  cur = key; sel.clear();
  $$("#pTree button[data-p]").forEach(b => b.setAttribute("aria-current", String(b.dataset.p === key)));
  if (key === "@home") return editHome();
  if (key === "@unpub") return editUnpub();
  if (key === "@site") return editSite();
  if (key === "@contact") return editContact();
  if (!projOf(key)) { cur = null; return; }
  editProject(key);
  if (matchMedia("(max-width:900px)").matches) $("#pEd").scrollIntoView({ block: "start" });
}
function refreshTree() { const y = $("#pTree") ? $("#pTree").scrollTop : 0; paintTree(); $("#pTree").scrollTop = y; }
function newProject(c) {
  const title = (prompt(`Nouveau projet dans « ${T2(c.name, "fr")} » : titre`) || "").trim(); if (!title) return;
  let id = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "projet";
  const base = id; let k = 2; while (projOf(id)) id = `${base}-${k++}`.slice(0, 40);
  c.projects.push({ id, title, city: "none", place: "", hidden: true, eds: [{ year: String(new Date().getFullYear()), imgs: [], hidden: true }] });
  mark(); cur = id; refreshTree();
  A().toast("Projet créé, non publié. Ajoutez des photos puis activez « Publié sur le site ».");
}

const field = (label, html, w) => `<label class="field"${w ? ' style="grid-column:1/-1"' : ""}><span>${label}</span>${html}</label>`;
const inp = (k, v, attrs = "") => `<input class="input" data-k="${k}" value="${esc(v ?? "")}" ${attrs}>`;
const area = (k, v) => `<textarea class="input" data-k="${k}">${esc(v ?? "")}</textarea>`;
const sw = (k, on, label) => `<label class="switch"><input type="checkbox" role="switch" data-k="${k}"${on ? " checked" : ""}><span class="tr" aria-hidden="true"></span><span>${label}</span></label>`;
function editProject(id) {
  const { p } = projOf(id), s = p.series || {};
  const ed = $("#pEd");
  ed.innerHTML = `<div class="stack">
    <div class="edbox"><div class="row" style="justify-content:space-between"><h2 class="s" style="margin:0">${esc(T2(p.title, "fr"))}<span data-badge>${badge(!p.hidden)}</span></h2>${sw("published", !p.hidden, "Publié sur le site")}</div>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${field("Titre (FR)", inp("title_fr", T2(p.title, "fr"), 'maxlength="120"'))}${field("Titre (EN)", inp("title_en", T2(p.title, "en"), 'maxlength="120"'))}
        ${field("Lieu affiché", inp("place", p.place, 'maxlength="80"'))}${field("Ville", `<select class="input" data-k="city">${[["sn", "Dakar / Sénégal"], ["mtl", "Montréal"], ["mix", "Les deux"], ["none", "Non précisé"]].map(([k, l]) => `<option value="${k}"${p.city === k ? " selected" : ""}>${l}</option>`).join("")}</select>`)}
        ${field("Rôle (FR)", inp("role_fr", T2(p.role, "fr") || "Photographie"))}${field("Rôle (EN)", inp("role_en", T2(p.role, "en") || "Photography"))}
        ${field("Description (FR)", area("sub_fr", T2(p.sub, "fr")), 1)}${field("Description (EN)", area("sub_en", T2(p.sub, "en")), 1)}
        ${field("À la une (rang 1 à 5, vide = non)", inp("featured", p.featured || "", 'type="number" min="1" max="5"'))}${field("Photo de couverture (numéro)", inp("cover", p.cover ?? "", 'type="number" min="0"'))}
      </div>
      <div class="row"><label class="check"><input type="checkbox" data-k="page"${p.page === false ? "" : " checked"}><span>Page de projet dédiée</span></label></div>
    </div>
    <div class="edbox"><h2 class="s" style="margin:0">Liens <span class="hint">(site web, Instagram, réseaux)</span></h2>
      <p class="hint" style="margin:0">Affichés sur l'accueil, à côté de « Page du projet », et dans les informations de la page du projet. 6 au plus, adresses en https:// (pour Instagram ou TikTok, un compte @nom suffit).</p>
      <div id="pLinks"></div>
    </div>
    <div class="edbox"><h2 class="s" style="margin:0">Sélection de la page du projet <span class="hint" id="pSelN"></span></h2>
      <p class="hint" style="margin:0">Les 8 vignettes en tête de la page du projet, dans cet ordre : glissez-les, ou utilisez ← et →. Une photo horizontale y est recadrée en vertical autour du point choisi. Elles peuvent venir d'un autre projet ou des « Photos retirées ».</p>
      <div class="thumbs" id="pSelGrid"></div>
      <div class="row"><button class="btn small" type="button" id="pSelAdd">Ajouter à la sélection…</button><label class="btn small"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden id="pSelFile">Ajouter depuis mon ordinateur</label></div>
    </div>
    <div class="edbox" id="pGrid"></div>
    <div class="edbox" id="pHist"><h2 class="s">Historique de l'événement</h2>
      <p class="hint" style="margin:0">Affiché sous le titre : « ${p.eds ? p.eds.length : 1} édition(s) photographiée(s) sur N ». Laissez vide si le total n'est pas vérifié : rien n'est alors affirmé.</p>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${field("Éditions connues au total", inp("known", s.known ?? "", 'type="number" min="1"'))}${field("Unité", `<select class="input" data-k="unit">${[["", "—"], ["edition", "éditions"], ["soiree", "soirées"], ["saison", "saisons"], ["concert", "concerts"], ["marque", "marques"], ["evenement", "événements"], ["session", "sessions"]].map(([k, l]) => `<option value="${k}"${(s.unit || "") === k ? " selected" : ""}>${l}</option>`).join("")}</select>`)}
        ${field("Précision (FR)", inp("note_fr", T2(s.note, "fr")))}${field("Précision (EN)", inp("note_en", T2(s.note, "en")))}
        ${field("Éditions non photographiées (une par ligne)", area("missed", (s.missed || []).map(m => T2(m.label, "fr")).join("\n")), 1)}
      </div>
      <label class="check"><input type="checkbox" data-k="min"${s.min ? " checked" : ""}><span>Le total est un minimum (« au moins N »)</span></label>
      <label class="check"><input type="checkbox" data-k="verify"${s.verify ? " checked" : ""}><span>Données à vérifier</span></label>
    </div>
    <div id="pEds" class="stack"></div>
    <div class="row"><button class="btn small" id="pAddEd" type="button">Ajouter une édition</button><span class="hint">Une nouvelle édition commence « Non publiée ». Pour enlever des photos du site sans les perdre : sélectionnez-les puis « Retirer du site ».</span></div>
  </div>`;
  $$("[data-k]", ed.firstElementChild.children[0]).concat($$("[data-k]", $("#pHist"))).forEach(el => el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => readProject(p)));
  $("#pAddEd").addEventListener("click", () => {
    if (!p.eds) { p.eds = [{ year: p.year || "", imgs: p.imgs || [] }]; ["feature", "order"].forEach(k => { if (k in p) { p.eds[0][k] = p[k]; delete p[k]; } }); delete p.imgs; }
    p.eds.unshift({ year: String(new Date().getFullYear()), imgs: [], hidden: true }); mark(); paintEds(p); refreshTreeLight();
  });
  linkEditor($("#pLinks"), () => linksOf(p), l => { if (l.length) p.links = l; else delete p.links; delete p.ig; mark(); });
  $("#pSelAdd").addEventListener("click", () => addToSel(p));
  $("#pSelFile").addEventListener("change", async ev => {
    const fs = [...ev.target.files]; ev.target.value = "";
    const room = 8 - (p.selection || []).length; if (fs.length > room) { A().toast(`La sélection compte 8 photos au plus (${8 - room}/8 déjà).`, true); return; }
    const ids = await addFiles(fs.map(f => ({ blob: f, name: f.name })), null, "ordinateur", true); // dans « Photos retirées », puis dans la sélection
    if (ids && ids.length) { (p.selection ||= []).push(...ids); mark(); paintMarks(p); A().toast("Photos ajoutées aux « Photos retirées » et à la sélection. Publiez pour l'enregistrer."); }
  });
  paintEds(p);
}
function refreshTreeLight() { const b = $(`#pTree button[data-p="${CSS.escape(cur)}"]`); if (!b) return; const { p } = projOf(cur); const n = edsOf(p).reduce((s, e) => s + e.imgs.length, 0), off = p.eds ? p.eds.filter(e => e.hidden).length : 0; b.innerHTML = `${esc(T2(p.title, "fr"))}${p.featured ? " ★" : ""}${badge(!p.hidden)}<br><span class="hint">${n} photos${p.eds ? " · " + p.eds.length + " éditions" : ""}${off ? ` · ${off} non publiée${off > 1 ? "s" : ""}` : ""}</span>`; }
function readProject(p) {
  const ed = $("#pEd"), v = k => { const el = $(`[data-k=${k}]`, ed); return el.type === "checkbox" ? el.checked : el.value.trim(); };
  setT(p, "title", v("title_fr"), v("title_en")); p.place = v("place"); p.city = v("city");
  setT(p, "role", v("role_fr"), v("role_en")); if (T2(p.role, "fr") === "Photographie") delete p.role;
  setT(p, "sub", v("sub_fr"), v("sub_en"));
  const f = parseInt(v("featured"), 10), wasF = !!p.featured; if (f >= 1 && f <= 5) p.featured = f; else delete p.featured;
  if (wasF !== !!p.featured) setTimeout(() => paintGrid(p));
  const cv = v("cover"); if (cv !== "" && !isNaN(+cv)) p.cover = +cv; else delete p.cover;
  if (v("page")) delete p.page; else p.page = false;
  if (v("published")) delete p.hidden; else p.hidden = true; if (p.hidden && p.featured) { delete p.featured; renumber(featList()); }
  $("[data-badge]", ed).innerHTML = badge(!p.hidden);
  const known = parseInt(v("known"), 10), unit = v("unit"), missed = v("missed").split("\n").map(x => x.trim()).filter(Boolean);
  const s = {}; if (known > 0) s.known = known; if (unit) s.unit = unit; if (v("min")) s.min = true; if (v("verify")) s.verify = true;
  setT(s, "note", v("note_fr"), v("note_en")); if (missed.length) s.missed = missed.map(label => ({ label }));
  if (Object.keys(s).length) p.series = s; else delete p.series;
  mark(); refreshTreeLight(); paintMarks(p);
}
// repères sur les vignettes : couverture, sélection (8), accueil (10 par année, projets à la une)
function paintMarks(p) {
  const cover = p.cover ?? null, selSet = new Set(p.selection || []);
  $$("#pEds .th").forEach(t => {
    const i = +t.dataset.i, y = t.dataset.y, home = new Set(((p.homePicks || {})[y]) || []);
    t.querySelector(".tags").innerHTML = (cover === i ? '<span class="cov">Couverture</span>' : "") + (selSet.has(i) ? "<span>Sélection</span>" : "") + (home.has(i) ? "<span>Accueil</span>" : "");
  });
  $$("#pEds [data-homen]").forEach(x => { const y = x.dataset.homen; x.textContent = p.featured ? `Accueil ${y} : ${((p.homePicks || {})[y] || []).length}/10` : ""; });
  const n = $("#pSelN"); if (n) n.textContent = `(${(p.selection || []).length}/8)`;
  const g = $("#pSelGrid"); if (!g) return;
  g.textContent = "";
  const S = p.selection || [], mine = photosOf(p);
  const moveTo = (from, to) => { if (to < 0 || to >= S.length || from === to) return; const [m] = S.splice(from, 1); S.splice(to, 0, m); mark(); paintMarks(p); const b = $(`#pSelGrid .th[data-i="${m}"] [data-a=${to < from ? "l" : "r"}]`) || $(`#pSelGrid .th[data-i="${m}"] button`); if (b) b.focus(); };
  S.forEach((i, k) => {
    const t = document.createElement("div"); t.className = "th sel2"; t.dataset.i = i; t.draggable = true; t.appendChild(thumbImg(i)); t.appendChild(zoomBtn(i));
    t.setAttribute("aria-label", `Sélection, position ${k + 1} : photo ${i}${mine.has(i) ? "" : " (hors du projet)"}`);
    t.insertAdjacentHTML("beforeend", `<span class="no">${k + 1} · ${n3(i)}${mine.has(i) ? "" : " · ailleurs"}</span><span class="selnav"><button type="button" class="mini" data-a="l" aria-label="Photo ${i} : une place avant"${k ? "" : " disabled"}>←</button><button type="button" class="mini" data-a="x" aria-label="Retirer la photo ${i} de la sélection">×</button><button type="button" class="mini" data-a="r" aria-label="Photo ${i} : une place après"${k < S.length - 1 ? "" : " disabled"}>→</button></span>`);
    t.querySelector("[data-a=l]").addEventListener("click", () => moveTo(k, k - 1));
    t.querySelector("[data-a=r]").addEventListener("click", () => moveTo(k, k + 1));
    t.querySelector("[data-a=x]").addEventListener("click", () => { S.splice(k, 1); if (p.selFocus) { delete p.selFocus[i]; if (!Object.keys(p.selFocus).length) delete p.selFocus; } if (!S.length) delete p.selection; mark(); paintMarks(p); });
    t.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/x-sel", String(k)); ev.dataTransfer.effectAllowed = "move"; t.classList.add("drag"); });
    t.addEventListener("dragend", () => t.classList.remove("drag"));
    t.addEventListener("dragover", ev => { if (ev.dataTransfer.types.includes("text/x-sel")) { ev.preventDefault(); t.classList.add("over"); } });
    t.addEventListener("dragleave", () => t.classList.remove("over"));
    t.addEventListener("drop", ev => { ev.preventDefault(); t.classList.remove("over"); const from = parseInt(ev.dataTransfer.getData("text/x-sel"), 10); if (!isNaN(from)) moveTo(from, k); });
    if (isWide(i)) {
      const f = (p.selFocus || {})[i] ?? 50;
      t.firstChild.style.objectPosition = `${f}% 50%`;
      t.insertAdjacentHTML("beforeend", `<label class="foc" draggable="false"><span class="vh">Recadrage de la photo ${i} (gauche 0, droite 100)</span><input type="range" min="0" max="100" step="1" value="${f}"></label>`);
      t.querySelector("input").addEventListener("input", ev => { const v = +ev.target.value; (p.selFocus ||= {})[i] = v; if (v === 50) delete p.selFocus[i]; if (!Object.keys(p.selFocus).length) delete p.selFocus; t.firstChild.style.objectPosition = `${v}% 50%`; mark(); });
    }
    g.appendChild(t);
  });
  if (!(p.selection || []).length) g.innerHTML = '<p class="hint" style="margin:0">Aucune sélection choisie : le site prend la première photo de chaque édition.</p>';
}
function paintEds(p) {
  const box = $("#pEds"); box.textContent = "";
  const eds = edsOf(p);
  eds.forEach((e, ei) => {
    const el = document.createElement("div"); el.className = "edbox" + (e.hidden ? " off" : "");
    const named = e.brand ? `Marque ${e.brand}` : e.look ? `Look ${e.look}` : "";
    const y = edYear(p, e);
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="s" style="margin:0">${p.eds ? `Édition ${ei + 1}` : "Photos"}${named ? " · " + esc(named) : ""} <span class="hint">(${e.imgs.length} photos)</span>${p.eds ? badge(!e.hidden) : ""}</h3><div class="row">${p.eds ? sw("published", !e.hidden, "Publiée sur le site") : ""}${p.eds && !e.imgs.length ? '<button class="btn small danger" type="button" data-a="rm">Retirer cette édition vide</button>' : ""}</div></div>
      ${p.eds ? `<div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">${field("Année", inp("year", e.year, 'maxlength="12"'))}${field("Volume / libellé (FR)", inp("label_fr", T2(e.label, "fr"), 'maxlength="80"'))}${field("Libellé (EN)", inp("label_en", T2(e.label, "en"), 'maxlength="80"'))}${field("Lieu", inp("place", e.place, 'maxlength="80"'))}${field("Sous-titre (FR)", inp("sub_fr", T2(e.sub, "fr")), 1)}${field("Sous-titre (EN)", inp("sub_en", T2(e.sub, "en")), 1)}</div>` : ""}
      <label class="check"><input type="checkbox" data-k="fixed"${e.order === "fixed" ? " checked" : ""}><span>Garder mon ordre (sinon, rangement automatique par couleur)</span></label>
      <div class="thumbs" role="list"></div>
      <div class="row"><span class="hint" data-n></span><span class="hint" data-homen="${esc(y)}"></span></div>
      <div class="ptbar" role="group" aria-label="Actions sur les photos sélectionnées">
        <button class="btn small" type="button" data-a="cover">Définir comme couverture</button>
        <button class="btn small" type="button" data-a="sel">Sélection</button>
        ${p.featured ? '<button class="btn small" type="button" data-a="home">Accueil</button>' : ""}
        <button class="btn small" type="button" data-a="move">Déplacer vers…</button>
        <button class="btn small" type="button" data-a="alt">Texte alternatif…</button>
        <button class="btn small danger" type="button" data-a="out">Retirer du site</button>
      </div>
      <div class="row"><label class="btn small"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden data-a="file">Ajouter depuis mon ordinateur</label><button class="btn small" type="button" data-a="gal">Ajouter depuis une galerie client</button></div>`;
    const th = el.querySelector(".thumbs");
    const alt = C.portfolio.data.alt || {};
    const all = (e.feature ? [e.feature.img] : []).concat(e.imgs);
    all.forEach(i => {
      const k = e.imgs.indexOf(i), feat = k < 0;
      const t = document.createElement("div"); t.className = "th" + (sel.has(i) ? " on" : ""); t.draggable = !feat; t.dataset.i = i; t.dataset.y = y; t.setAttribute("role", "listitem"); t.tabIndex = 0;
      t.appendChild(thumbImg(i)); t.appendChild(zoomBtn(i));
      t.insertAdjacentHTML("beforeend", `<span class="no">${n3(i)}${feat ? " · vedette" : ""}</span>${alt[i] ? '<span class="al" title="Texte alternatif rédigé"></span>' : ""}<span class="tags"></span>`);
      t.setAttribute("aria-label", `Photo ${i}${alt[i] ? " : " + T2(alt[i], "fr") : ""}`);
      const toggle = () => { sel.has(i) ? sel.delete(i) : sel.add(i); t.classList.toggle("on", sel.has(i)); t.setAttribute("aria-pressed", String(sel.has(i))); upd(); };
      t.addEventListener("click", toggle);
      t.addEventListener("keydown", ev => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); toggle(); } });
      if (!feat) {
        t.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", String(k)); t.classList.add("drag"); });
        t.addEventListener("dragend", () => t.classList.remove("drag"));
        t.addEventListener("dragover", ev => { ev.preventDefault(); t.classList.add("over"); });
        t.addEventListener("dragleave", () => t.classList.remove("over"));
        t.addEventListener("drop", ev => { ev.preventDefault(); t.classList.remove("over"); const from = +ev.dataTransfer.getData("text/plain"); if (isNaN(from) || from === k) return; const [m] = e.imgs.splice(from, 1); e.imgs.splice(k, 0, m); e.order = "fixed"; mark(); paintEds(p); });
      }
      th.appendChild(t);
    });
    if (!all.length) th.innerHTML = '<p class="hint" style="margin:0">Aucune photo. Ajoutez-en depuis votre ordinateur, une galerie client ou « Photos retirées ».</p>';
    const upd = () => {
      const mine = [...sel].filter(i => all.includes(i)).length;
      el.querySelector("[data-n]").textContent = mine ? `${mine} sélectionnée(s)` : "Touchez des photos pour les sélectionner ; glissez-les pour changer l'ordre.";
      el.querySelectorAll(".ptbar button").forEach(b => { b.disabled = !mine || (b.dataset.a === "cover" && mine !== 1) || (b.dataset.a === "alt" && mine !== 1); });
    };
    upd();
    $$("[data-k]", el).forEach(x => x.addEventListener(x.type === "checkbox" ? "change" : "input", () => {
      const v = k => { const z = $(`[data-k=${k}]`, el); return z ? (z.type === "checkbox" ? z.checked : z.value.trim()) : ""; };
      if (p.eds) { e.year = v("year"); setT(e, "label", v("label_fr"), v("label_en")); if (v("place")) e.place = v("place"); else delete e.place; setT(e, "sub", v("sub_fr"), v("sub_en")); }
      if (v("fixed")) e.order = "fixed"; else delete e.order;
      if (p.eds && x.dataset.k === "published") { if (v("published")) delete e.hidden; else e.hidden = true; mark(); paintEds(p); refreshTreeLight(); return; }
      mark();
    }));
    const mineSel = () => [...sel].filter(i => all.includes(i));
    const on = (a, f) => { const b = el.querySelector(`[data-a=${a}]`); if (b) b.addEventListener("click", f); };
    on("rm", () => { p.eds.splice(ei, 1); mark(); paintEds(p); refreshTreeLight(); });
    on("move", () => moveSel(mineSel()));
    on("alt", () => editAlt(mineSel()[0]));
    on("cover", () => { const [i] = mineSel(); p.cover = i; $("#pEd [data-k=cover]").value = i; mark(); paintMarks(p); A().toast(`Photo ${i} : couverture du projet.`); });
    on("sel", () => {
      const s2 = p.selection ||= [], ids = mineSel(), allIn = ids.every(i => s2.includes(i));
      if (allIn) p.selection = s2.filter(i => !ids.includes(i));
      else { const add = ids.filter(i => !s2.includes(i)); if (s2.length + add.length > 8) { A().toast(`La sélection compte 8 photos au plus (${s2.length}/8 déjà).`, true); return; } s2.push(...add); }
      if (!p.selection.length) delete p.selection;
      Object.keys(p.selFocus || {}).forEach(k => { if (!(p.selection || []).includes(+k)) delete p.selFocus[k]; }); if (p.selFocus && !Object.keys(p.selFocus).length) delete p.selFocus;
      mark(); paintMarks(p);
    });
    on("home", () => {
      const hp = p.homePicks ||= {}, l = hp[y] ||= [], ids = mineSel(), allIn = ids.every(i => l.includes(i));
      if (allIn) hp[y] = l.filter(i => !ids.includes(i));
      else { const add = ids.filter(i => !l.includes(i)); if (l.length + add.length > 10) { A().toast(`L'accueil montre 10 photos au plus pour ${y} (${l.length}/10 déjà).`, true); return; } l.push(...add); }
      if (!hp[y].length) delete hp[y]; if (!Object.keys(hp).length) delete p.homePicks;
      mark(); paintMarks(p);
    });
    on("out", () => {
      const ids = mineSel().filter(i => e.imgs.includes(i));
      if (!ids.length) { A().toast("La photo vedette ne se retire pas d'ici.", true); return; }
      e.imgs = e.imgs.filter(i => !ids.includes(i)); unpub().push(...ids); ids.forEach(i => sel.delete(i));
      prune(); mark(); paintEds(p); refreshTreeLight(); refreshUnpubCount();
      A().toast(`${ids.length} photo${ids.length > 1 ? "s" : ""} retirée${ids.length > 1 ? "s" : ""} du site (dans « Photos retirées »).`);
    });
    el.querySelector("[data-a=file]").addEventListener("change", ev => { const fs = [...ev.target.files]; ev.target.value = ""; addFiles(fs.map(f => ({ blob: f, name: f.name })), { project: p.id, ed: ei }); });
    on("gal", () => fromGallery({ project: p.id, ed: ei }));
    box.appendChild(el);
  });
  paintMarks(p);
  paintGrid(p);
}
function refreshUnpubCount() { const b = $('#pTree button[data-p="@unpub"] .hint'); if (b) b.textContent = `${unpub().length} photo${unpub().length > 1 ? "s" : ""} hors du site`; }
// une référence (couverture, sélection, recadrage, accueil) vers une photo sortie du projet est oubliée
// photos qu'une sélection peut reprendre : toutes celles du portfolio (tout projet, toute édition) et les photos retirées
function poolOf() { const s = new Set(unpub()); C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => photosOf(q).forEach(i => s.add(i)))); return s; }
function prune() {
  const shp = C.portfolio.data.shape;
  if (shp) { const H = C.home.data, used = poolOf(); [...H.hero, ...H.about, ...H.wall, H.me].forEach(i => used.add(i)); for (const k of Object.keys(shp)) if (!used.has(+k)) delete shp[k]; if (!Object.keys(shp).length) delete C.portfolio.data.shape; }
  const szm = C.portfolio.data.size;
  if (szm) { const used = poolOf(); for (const k of Object.keys(szm)) if (!used.has(+k)) delete szm[k]; if (!Object.keys(szm).length) delete C.portfolio.data.size; }
  const HL = C.home.data.heroLab; if (HL) for (const k of Object.keys(HL)) if (!C.home.data.hero.includes(+k)) delete HL[k];
  { const pool = poolOf(); for (const c of C.portfolio.data.chapters) for (const p of c.projects) { if (p.featuredCover != null && !pool.has(p.featuredCover)) delete p.featuredCover; if (p.hidden && p.featured) delete p.featured; } }
  for (const c of C.portfolio.data.chapters) for (const p of c.projects) {
    const mine = photosOf(p);
    if (p.cover != null && !mine.has(p.cover)) delete p.cover;
    if (p.selection) { const pool = poolOf(); p.selection.splice(0, p.selection.length, ...[...new Set(p.selection)].filter(i => pool.has(i)).slice(0, 8)); if (!p.selection.length) delete p.selection; }
    if (p.selFocus) { for (const k of Object.keys(p.selFocus)) if (!(p.selection || []).includes(+k)) delete p.selFocus[k]; if (!Object.keys(p.selFocus).length) delete p.selFocus; }
    if (p.homePicks) { for (const y of Object.keys(p.homePicks)) { p.homePicks[y] = p.homePicks[y].filter(i => mine.has(i)).slice(0, 10); if (!p.homePicks[y].length) delete p.homePicks[y]; } if (!Object.keys(p.homePicks).length) delete p.homePicks; }
  }
}
// destinations : chaque édition de chaque projet (et « Photos retirées »)
function targets(withUnpub) {
  const out = [];
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach((e, k) => out.push({ project: q.id, ed: k, e, label: `${T2(q.title, "fr")}${q.eds ? " · " + [e.brand, e.look ? "Look " + e.look : "", e.year, T2(e.label, "fr")].filter(Boolean).join(" ") : ""}${q.hidden || e.hidden ? " (non publié)" : ""}` }))));
  if (withUnpub) out.push({ unpub: true, label: "Photos retirées (hors du site)" });
  return out;
}
function pickTarget(title, withUnpub, preset) {
  return new Promise(resolve => {
    const d = $("#pickDlg"), list = targets(withUnpub);
    $("#pickT").textContent = title;
    $("#pickS").innerHTML = list.map((t, k) => `<option value="${k}"${preset && t.project === preset.project && t.ed === preset.ed ? " selected" : ""}>${esc(t.label)}</option>`).join("");
    const go = $("#pickGo"), done = v => { go.removeEventListener("click", ok); d.removeEventListener("close", cl); resolve(v); };
    const ok = () => { const t = list[+$("#pickS").value]; d.close(); done(t || null); };
    const cl = () => done(null);
    go.addEventListener("click", ok); d.addEventListener("close", cl, { once: true });
    d.showModal();
  });
}
function detach(ids) {
  const set = new Set(ids);
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach(e => { e.imgs = e.imgs.filter(i => !set.has(i)); })));
  if (C.portfolio.data.unpublished) C.portfolio.data.unpublished = C.portfolio.data.unpublished.filter(i => !set.has(i));
}
async function moveSel(ids, from = "") {
  ids = ids.filter(i => !isFixedSpot(i));
  if (!ids.length) { A().toast("Sélectionnez d'abord des photos (pas la photo vedette).", true); return; }
  const t = await pickTarget(`Déplacer ${ids.length} photo${ids.length > 1 ? "s" : ""} vers…`, from !== "unpub"); if (!t) return;
  detach(ids);
  if (t.unpub) unpub().push(...ids); else t.e.imgs.push(...ids);
  ids.forEach(i => sel.delete(i)); prune(); mark(); refreshTree();
  A().toast(t.unpub ? "Photos retirées du site." : `Déplacées vers ${t.label}.`);
}
const isFixedSpot = i => C.portfolio.data.chapters.some(c => c.projects.some(q => (q.lead && q.lead.img === i) || edsOf(q).some(e => e.feature && e.feature.img === i)));
function editAlt(i) {
  if (i == null) { A().toast("Sélectionnez une seule photo pour écrire son texte alternatif.", true); return; }
  const alt = (C.portfolio.data.alt ||= {}), cur2 = alt[i] || {};
  const fr = prompt(`Photo ${i} : que montre-t-elle ? (FR, une phrase, sans nommer une personne que vous ne connaissez pas)`, T2(cur2, "fr")); if (fr === null) return;
  const en = prompt(`Photo ${i} : same description in English`, T2(cur2, "en")); if (en === null) return;
  if (!fr.trim() && !en.trim()) delete alt[i]; else alt[i] = { fr: fr.trim(), en: (en || fr).trim() };
  mark(); open(cur);
}

// ---------- liens (site web, Instagram, réseaux) : même contrôle que le serveur ----------
const LINK_KINDS = [["site", "Site web"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["facebook", "Facebook"], ["x", "X"], ["autre", "Autre"]];
const LINK_URL = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/?#][^\s"'<>`]*)?$/;
// l'ancien champ « ig » (comptes Instagram) apparaît dans la même liste ; il est converti au premier changement
const linksOf = p => (p.links || []).concat((p.ig || []).map(h => ({ kind: "instagram", label: `Instagram @${h}`, url: `https://www.instagram.com/${h}/` })));
function normUrl(kind, v) {
  v = v.trim(); const h = /^@?([A-Za-z0-9._]{1,30})$/.exec(v);
  if (h && kind === "instagram") return `https://www.instagram.com/${h[1]}/`;
  if (h && kind === "tiktok") return `https://www.tiktok.com/@${h[1]}`;
  if (h && kind === "x") return `https://x.com/${h[1]}`;
  if (/^http:\/\//i.test(v)) return v; // refusé plus bas : on ne change pas un http:// en silence
  if (v && !/^[a-z]+:/i.test(v) && /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#].*)?$/.test(v)) return "https://" + v;
  return v;
}
function linkEditor(box, get, set) {
  let rows = get().map(x => ({ ...x }));
  const commit = () => { const ok = rows.filter(r => r.url && LINK_URL.test(r.url) && r.label.trim() && [...r.label].length <= 40).map(r => ({ kind: r.kind || "autre", label: r.label.trim(), url: r.url })); set(ok); };
  const paint = () => {
    box.innerHTML = rows.map((r, k) => `<div class="lrow" data-k2="${k}"><select class="input" data-f="kind" aria-label="Type du lien ${k + 1}">${LINK_KINDS.map(([v, l]) => `<option value="${v}"${(r.kind || "autre") === v ? " selected" : ""}>${l}</option>`).join("")}</select><input class="input" data-f="label" maxlength="40" placeholder="Libellé affiché" aria-label="Libellé du lien ${k + 1}" value="${esc(r.label || "")}"><input class="input" data-f="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://… ou @compte" aria-label="Adresse du lien ${k + 1}" value="${esc(r.url || "")}"><button class="btn small" type="button" data-f="up" aria-label="Lien ${k + 1} : monter"${k ? "" : " disabled"}>↑</button><button class="btn small danger" type="button" data-f="rm" aria-label="Retirer le lien ${k + 1}">Retirer</button><span class="hint lerr" data-f="err"></span></div>`).join("")
      + `<div class="row"><button class="btn small" type="button" data-f="add"${rows.length >= 6 ? " disabled" : ""}>+ Ajouter un lien</button><span class="hint">${rows.length}/6</span></div>`;
    $$(".lrow", box).forEach(el => {
      const k = +el.dataset.k2, r = rows[k], e = $("[data-f=err]", el);
      const val = () => { e.textContent = !r.url ? "" : !LINK_URL.test(r.url) ? "Adresse refusée : elle doit commencer par https://" : !r.label.trim() ? "Libellé manquant" : ""; el.classList.toggle("bad", !!e.textContent); };
      $("[data-f=kind]", el).addEventListener("change", ev => { const old = LINK_KINDS.find(x => x[0] === (r.kind || "autre"))[1]; r.kind = ev.target.value; if (!r.label || r.label === old || r.label.startsWith(old + " @")) { r.label = LINK_KINDS.find(x => x[0] === r.kind)[1]; $("[data-f=label]", el).value = r.label; } r.url = normUrl(r.kind, r.url || ""); $("[data-f=url]", el).value = r.url; val(); commit(); });
      $("[data-f=label]", el).addEventListener("input", ev => { r.label = ev.target.value; val(); commit(); });
      $("[data-f=url]", el).addEventListener("change", ev => { const raw = ev.target.value.trim(), h = /^@([A-Za-z0-9._]{1,30})$/.exec(raw); r.url = normUrl(r.kind, raw); ev.target.value = r.url; if (h && (r.label === LINK_KINDS.find(x => x[0] === r.kind)[1])) { r.label += " @" + h[1]; $("[data-f=label]", el).value = r.label; } val(); commit(); });
      $("[data-f=up]", el).addEventListener("click", () => { [rows[k - 1], rows[k]] = [rows[k], rows[k - 1]]; commit(); paint(); });
      $("[data-f=rm]", el).addEventListener("click", () => { rows.splice(k, 1); commit(); paint(); });
      val();
    });
    $("[data-f=add]", box).addEventListener("click", () => { rows.push({ kind: "site", label: "Site web", url: "" }); paint(); $(".lrow:last-of-type [data-f=url]", box)?.focus(); });
  };
  paint();
}

// ---------- sélection : ajouter des photos d'ailleurs (autre projet, photos retirées) ----------
function addToSel(p) {
  const d = $("#selDlg"), src = $("#selSrc"), grid = $("#selGrid"), go = $("#selGo"), picked = [];
  const S = p.selection || [], room = () => 8 - S.length - picked.length;
  const list = [{ label: "Photos retirées (hors du site)", ids: () => unpub().slice() }];
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach((e, k) => list.push({ label: `${q.id === p.id ? "Ce projet" : T2(q.title, "fr")}${q.eds ? " · " + [e.brand, e.look ? "Look " + e.look : "", e.year, T2(e.label, "fr")].filter(Boolean).join(" ") : ""}${q.hidden || e.hidden ? " (non publié)" : ""}`, ids: () => (e.feature ? [e.feature.img] : []).concat(e.imgs) }))));
  src.innerHTML = list.map((t, k) => `<option value="${k}">${esc(t.label)}</option>`).join("");
  const upd = () => { go.disabled = !picked.length; $("#selN").textContent = `${picked.length} cochée${picked.length > 1 ? "s" : ""} · place pour ${Math.max(0, room())} de plus (8 au plus)`; };
  const paint = () => {
    grid.textContent = "";
    const ids = list[+src.value].ids();
    ids.forEach(i => {
      const t = document.createElement("button"); t.type = "button"; t.className = "th"; const inSel = S.includes(i);
      t.setAttribute("aria-pressed", String(picked.includes(i))); t.setAttribute("aria-label", `Photo ${i}${inSel ? " (déjà dans la sélection)" : ""}`); t.disabled = inSel;
      if (picked.includes(i)) t.classList.add("on"); if (inSel) t.classList.add("dim");
      t.appendChild(thumbImg(i)); t.insertAdjacentHTML("beforeend", `<span class="no">${n3(i)}${inSel ? " · déjà" : ""}</span>`);
      t.addEventListener("click", () => { const k = picked.indexOf(i); if (k >= 0) picked.splice(k, 1); else { if (room() <= 0) { A().toast("La sélection compte 8 photos au plus.", true); return; } picked.push(i); } t.classList.toggle("on", picked.includes(i)); t.setAttribute("aria-pressed", String(picked.includes(i))); upd(); });
      grid.appendChild(t);
    });
    if (!ids.length) grid.innerHTML = '<p class="hint" style="margin:0">Aucune photo ici.</p>';
  };
  src.onchange = paint; paint(); upd();
  go.onclick = () => { (p.selection ||= []).push(...picked.filter(i => !p.selection.includes(i))); d.close(); mark(); paintMarks(p); A().toast(`${picked.length} photo${picked.length > 1 ? "s" : ""} ajoutée${picked.length > 1 ? "s" : ""} à la sélection.`); };
  d.showModal();
}

// ---------- aperçu de la grille de l'accueil : le même calcul que la page d'accueil (src.html, layoutMosaic) ----------
// et que les pages de projet (assets/projet.js) ; « size » : "s" petite, "l" grande, "xl" pleine largeur
const PAT_D = ["SDS", "SSS", "DSS", "SSD", "SSSS", "SDSS", "SSDS", "DSD", "SS", "SD", "DS", "SSSSS", "DSSS", "SSSD", "SDSD", "S", "D"], PAT_M = ["SS", "SD", "DS", "S", "SSS", "D"];
function mosaicLayout(as, W, zs = []) {
  const mob = W < 640, g = mob ? 6 : W < 1000 ? 8 : 10, T0 = mob ? 210 : W < 1000 ? 270 : 330, pats = mob ? PAT_M : PAT_D, n = as.length;
  const tgt = par => mob ? T0 : T0 * (par ? 0.82 : 1.22), sized = zs.some(Boolean), Z = k => zs[k];
  const rowH = bl => { let A2 = 0, Sg = 0; for (const b of bl) { if (b.t === "S") A2 += b.a; else { const st = 1 / (1 / b.a1 + 1 / b.a2); A2 += st; Sg += st; } } return (W - (bl.length - 1) * g + g * Sg) / A2; };
  const best = [[], []]; best[0][n] = best[1][n] = { cost: 0 };
  for (let i = n - 1; i >= 0; i--) for (const par of [0, 1]) {
    let bb = null;
    if (sized && Z(i) === "xl") { const nx = best[par][i + 1]; best[par][i] = nx ? { cost: nx.cost, r: { xl: 1, need: 1 } } : null; continue; }
    for (const pt of pats) {
      let need = 0; for (const c of pt) need += c === "D" ? 2 : 1; if (i + need > n) continue;
      let k = i; const bl = [];
      for (const c of pt) { if (c === "S") bl.push({ t: "S", a: as[k], k: [k++] }); else { bl.push({ t: "D", a1: as[k], a2: as[k + 1], k: [k, k + 1] }); k += 2; } }
      let zl = 0, zc = 0, bad = false;
      if (sized) for (const b of bl) {
        const z1 = Z(b.k[0]), z2 = b.t === "D" ? Z(b.k[1]) : null;
        if (z1 === "xl" || z2 === "xl" || (b.t === "D" && (z1 === "l" || z2 === "l"))) bad = true;
        if (b.t === "S") { if (z1 === "l") zl = 1; else if (z1 === "s") zc += .5; }
        else if (z1 === "s" && z2 === "s") zc -= .8; else if (z1 === "s" || z2 === "s") zc -= .3;
      }
      if (bad) continue;
      const H = rowH(bl), T = zl ? tgt(par) * 1.4 : tgt(par), dd = Math.log(H / T); let cost = dd * dd * 4;
      for (const b of bl) if (b.t === "D" && (b.a1 < 1 || b.a2 < 1) && !(sized && Z(b.k[0]) === "s" && Z(b.k[1]) === "s")) cost += .4;
      if (H > T * 1.6 || H < T * .6) cost += 12 + dd * dd * 20;
      if (sized) cost += zc;
      const nx = best[1 - par][i + need]; if (!nx) continue;
      if (!bb || cost + nx.cost < bb.cost) bb = { cost: cost + nx.cost, r: { bl, H, need, T } };
    }
    best[par][i] = bb;
  }
  const pos = []; let i = 0, y = 0, par = 0;
  while (i < n) {
    const r = best[par][i].r;
    if (r.xl) { const a = as[i], H = Math.min(W / a, T0 * 2.4), w = a * H; pos[i] = [(W - w) / 2, y, w, H]; y += H + g; i += 1; continue; }
    const T = r.T; let H = r.H, cap = false; if (H > T * 1.7) { H = T * 1.2; cap = true; }
    const out = []; let x = 0;
    for (const b of r.bl) {
      if (b.t === "S") { const w = b.a * H; out.push([b.k[0], x, y, w, H]); x += w + g; }
      else { const st = 1 / (1 / b.a1 + 1 / b.a2), w = (H - g) * st, h1 = w / b.a1; out.push([b.k[0], x, y, w, h1], [b.k[1], x, y + h1 + g, w, H - g - h1]); x += w + g; }
    }
    const off = cap ? Math.max(0, (W - (x - g)) / 2) : 0;
    for (const [k, px, py, w, h] of out) pos[k] = [px + off, py, w, h];
    y += H + g; i += r.need; par = 1 - par;
  }
  return { pos, H: Math.max(0, y - g) };
}
// l'ordre automatique (par couleur) est calculé à la publication : l'aperçu reprend l'ordre du site en ligne,
// les photos qui n'y sont pas encore viennent à la fin
let LIVE = null, liveTried = false;
async function loadLive() {
  if (liveTried) return LIVE; liveTried = true;
  try { const t = await (await fetch("../index.html", { cache: "no-store" })).text(), m = /const DATA = (\{.*?\});\n/s.exec(t); if (m) LIVE = JSON.parse(m[1]); } catch {}
  return LIVE;
}
function liveOrder(page) {
  const o = new Map(); let n = 0;
  if (LIVE) LIVE.chapters.forEach(c => c.projects.forEach(q => ((!page && q.home) || edsOf(q)).forEach(b => b.imgs.forEach(i => o.set(i, n++)))));
  return o;
}
const W_DESK = 1178, W_PHONE = 358; // largeur d'une mosaïque de l'accueil sur un écran de 1280 px et de 390 px
// chaque bloc dit comment enregistrer un nouvel ordre : édition (« order: fixed ») ou année d'un projet à la une (homePicks + homeFixed)
function homeBlocks(p, page) {
  const L = liveOrder(page), ord = (ids, fixed) => fixed ? ids.slice() : ids.slice().sort((a, b) => (L.has(a) ? L.get(a) : 1e6 + ids.indexOf(a)) - (L.has(b) ? L.get(b) : 1e6 + ids.indexOf(b)));
  const eds = edsOf(p).filter(e => !e.hidden || !p.eds);
  const label = e => p.eds ? [e.brand, e.look ? "Look " + e.look : "", e.year, T2(e.label, "fr")].filter(Boolean).join(" · ") : "Photos";
  if (!page && p.featured && C.site.data.projectPages !== false) { // projet à la une : 10 photos par année (homePicks), comme build.py
    const years = [], by = {};
    eds.forEach(e => { const y = edYear(p, e); if (!by[y]) { by[y] = []; years.push(y); } by[y].push(e); });
    let trimmed = false;
    const blocks = years.map(y => {
      const pool = []; by[y].forEach(e => { if (e.feature) pool.push(e.feature.img); pool.push(...e.imgs); });
      const n = Math.min(10, pool.length), want = [...new Set(((p.homePicks || {})[y]) || [])].filter(i => pool.includes(i)).slice(0, n);
      want.push(...pool.filter(i => !want.includes(i)).slice(0, n - want.length)); if (pool.length > want.length) trimmed = true;
      const feats = new Set(by[y].filter(e => e.feature).map(e => e.feature.img)), feat = want.find(i => feats.has(i));
      const imgs = want.filter(i => i !== feat), hand = (p.homeFixed || []).includes(y), edFix = by[y].some(e => e.order === "fixed");
      return { kind: "year", y, want, title: y || "Photos", feat, fixed: hand, imgs: hand ? imgs : edFix ? pool.filter(i => imgs.includes(i)) : ord(imgs), note: `${want.length} sur ${pool.length}` };
    });
    if (trimmed) return blocks;
  }
  return eds.map(e => ({ kind: "ed", e, title: label(e), feat: e.feature ? e.feature.img : null, fixed: e.order === "fixed", imgs: ord(e.imgs, e.order === "fixed"), note: `${e.imgs.length} photos` }));
}
// nouvel ordre d'un bloc : il devient manuel
function setOrder(p, b, imgs) {
  if (b.kind === "ed") { b.e.imgs = imgs; b.e.order = "fixed"; }
  else {
    const hp = (p.homePicks ||= {}); hp[b.y] = [...(b.feat != null ? [b.feat] : []), ...imgs];
    const hf = (p.homeFixed ||= []); if (!hf.includes(b.y)) hf.push(b.y);
  }
  mark();
}
function resetOrder(p, b) {
  if (b.kind === "ed") delete b.e.order;
  else if (p.homeFixed) { p.homeFixed = p.homeFixed.filter(y => y !== b.y); if (!p.homeFixed.length) delete p.homeFixed; }
  mark();
}
const SIZES = [["", "Normale"], ["s", "Petite"], ["l", "Grande"], ["xl", "Pleine largeur"]];
const sizeOf = i => (C.portfolio.data.size || {})[i] || "";
let gridW = W_DESK, gridPage = false, shapeCur = null;
const arOf = (i, page) => { const s = !page && (C.portfolio.data.shape || {})[i], m = C.meta && C.meta[i]; return s ? (s.r === "v" ? 2 / 3 : 3 / 2) : m ? m[0] / m[1] : 1.5; };
// garde la grille à la même hauteur dans la fenêtre pendant qu'on la redessine
function repaintGrid(p) { const g = $("#pGrid"); if (!g) return; const y = g.getBoundingClientRect().top; return paintGrid(p).then(() => { const d = $("#pGrid").getBoundingClientRect().top - y; if (d) scrollBy(0, d); }); }
async function paintGrid(p) {
  const box = $("#pGrid"); if (!box) return;
  const pages = C.site.data.projectPages !== false; if (!pages) gridPage = false;
  box.innerHTML = `<div class="row" style="justify-content:space-between"><h2 class="s" style="margin:0">${gridPage ? "Galeries de la page du projet" : "Grille de l'accueil"}</h2><div class="row" style="gap:8px">${pages ? `<div class="seg" role="group" aria-label="Mosaïque montrée"><button type="button" class="btn small" data-v="home" aria-pressed="${!gridPage}">Accueil</button><button type="button" class="btn small" data-v="page" aria-pressed="${gridPage}">Page du projet</button></div>` : ""}<div class="seg" role="group" aria-label="Largeur de l'aperçu"><button type="button" class="btn small" data-w="${W_DESK}" aria-pressed="${gridW === W_DESK}">Ordinateur</button><button type="button" class="btn small" data-w="${W_PHONE}" aria-pressed="${gridW === W_PHONE}">Téléphone</button></div></div></div>
    <p class="hint" style="margin:0">${gridPage ? "Les photos de chaque édition telles que la page du projet les range (photo d'ouverture à part, au-dessus)." : "Les photos de ce projet telles que l'accueil les range."}${p.hidden ? " (projet non publié : rien n'est affiché sur le site pour l'instant)" : ""} Glissez une photo pour la déplacer (l'ordre devient manuel), ou touchez-la pour choisir sa taille, la déplacer avec ← et →${gridPage ? "" : ", l'afficher en vertical (2:3) ou en horizontal (3:2) et choisir son cadrage"}. La taille vaut pour l'accueil et la page du projet ; la visionneuse montre toujours la photo entière.</p>
    <div id="gShape"></div><div id="gBlocks" class="stack"><p class="hint">Chargement…</p></div>`;
  $$("[data-w]", box).forEach(b => b.addEventListener("click", () => { gridW = +b.dataset.w; paintGrid(p); }));
  $$("[data-v]", box).forEach(b => b.addEventListener("click", () => { gridPage = b.dataset.v === "page"; paintGrid(p); }));
  await loadLive();
  if (!$("#gBlocks") || cur !== p.id) return;
  const host = $("#gBlocks"); host.textContent = "";
  const blocks = homeBlocks(p, gridPage);
  if (!LIVE) host.insertAdjacentHTML("beforeend", '<p class="hint" style="margin:0">Site en ligne injoignable : l\'ordre montré est celui de vos éditions, avant le rangement automatique par couleur.</p>');
  blocks.forEach((b, bi) => {
    const sec = document.createElement("div"); sec.className = "gblock";
    sec.innerHTML = `<div class="row" style="justify-content:space-between;gap:8px"><p class="gtitle" style="margin:0"><b>${esc(b.title)}</b> <span class="hint">${esc(b.note)}${b.feat != null ? ` · photo d'ouverture ${n3(b.feat)} au-dessus, en grand` : ""}</span></p>${b.fixed ? `<span class="row" style="gap:8px"><span class="pill">Ordre manuel</span><button type="button" class="btn small" data-reset>Revenir au rangement par couleur</button></span>` : ""}</div>`;
    const rs = $("[data-reset]", sec); if (rs) rs.addEventListener("click", () => { resetOrder(p, b); repaintGrid(p); A().toast(LIVE ? "Rangement par couleur rétabli (calculé à la publication)." : "Rangement par couleur rétabli."); });
    const frame = document.createElement("div"); frame.className = "gframe" + (gridW === W_PHONE ? " phone" : "");
    const stage = document.createElement("div"); stage.className = "gstage"; stage.style.width = gridW + "px";
    const { pos, H } = mosaicLayout(b.imgs.map(i => arOf(i, gridPage)), gridW, b.imgs.map(sizeOf));
    b.imgs.forEach((i, k) => {
      const [x, y, w, h] = pos[k], t = document.createElement("button"), sh = !gridPage && (C.portfolio.data.shape || {})[i], z = sizeOf(i);
      t.type = "button"; t.className = "gt" + (shapeCur === i ? " on" : "") + (sh ? " forced" : ""); t.dataset.i = i; t.dataset.k = k; t.dataset.b = bi;
      Object.assign(t.style, { left: x.toFixed(1) + "px", top: y.toFixed(1) + "px", width: w.toFixed(1) + "px", height: h.toFixed(1) + "px" });
      t.setAttribute("aria-label", `Photo ${i}, position ${k + 1} sur ${b.imgs.length}${z ? ", taille " + SIZES.find(s => s[0] === z)[1].toLowerCase() : ""}${sh ? (sh.r === "v" ? ", affichée en vertical" : ", affichée en horizontal") : ""} : choisir sa taille, la déplacer`);
      const im = thumbImg(i); if (sh) im.style.objectPosition = `${sh.x ?? 50}% ${sh.y ?? 50}%`; t.appendChild(im);
      t.insertAdjacentHTML("beforeend", `<span class="no">${n3(i)}${sh ? (sh.r === "v" ? " · V" : " · H") : ""}${z ? " · " + { s: "P", l: "G", xl: "PL" }[z] : ""}</span>`);
      t.addEventListener("click", ev => { if (t.dataset.dragged) { delete t.dataset.dragged; ev.preventDefault(); return; } shapeCur = i; paintShape(p); $$(".gt", host).forEach(zz => zz.classList.toggle("on", +zz.dataset.i === i)); });
      t.addEventListener("keydown", ev => { if (shapeCur === i && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) { ev.preventDefault(); nudge(p, ev.key === "ArrowLeft" ? -1 : 1); } });
      dragTile(p, b, t, stage);
      stage.appendChild(t);
    });
    stage.style.height = H.toFixed(1) + "px";
    frame.appendChild(stage); sec.appendChild(frame); host.appendChild(sec);
    const fit = () => { const s = Math.min(1, frame.clientWidth / gridW); stage.style.transform = `scale(${s})`; frame.style.height = (H * s).toFixed(1) + "px"; };
    fit(); new ResizeObserver(fit).observe(frame);
  });
  if (!blocks.some(b => b.imgs.length)) host.insertAdjacentHTML("beforeend", '<p class="hint" style="margin:0">Aucune photo publiée dans ce projet.</p>');
  paintShape(p);
}
// glisser-déposer dans l'aperçu (souris, doigt ou stylet) : la photo prend la place de celle sur laquelle on la lâche
function dragTile(p, b, t, stage) {
  t.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    const x0 = ev.clientX, y0 = ev.clientY, from = +t.dataset.k; let on = false, over = null;
    const move = e => {
      if (!on) { if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return; on = true; t.classList.add("drag"); try { t.setPointerCapture(ev.pointerId); } catch {} }
      e.preventDefault();
      const s = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
      t.style.transform = `translate(${(e.clientX - x0) / s}px, ${(e.clientY - y0) / s}px)`;
      const el = document.elementsFromPoint(e.clientX, e.clientY).find(z => z.classList && z.classList.contains("gt") && z !== t && z.parentNode === stage);
      if (over !== el) { if (over) over.classList.remove("drop"); over = el || null; if (over) over.classList.add("drop"); }
    };
    const up = e => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      if (!on) return;
      t.dataset.dragged = "1"; t.classList.remove("drag"); t.style.transform = ""; if (over) over.classList.remove("drop");
      if (!over || e.type === "pointercancel") return;
      const to = +over.dataset.k, imgs = b.imgs.slice(); imgs.splice(to, 0, imgs.splice(from, 1)[0]);
      shapeCur = +t.dataset.i; setOrder(p, b, imgs); repaintGrid(p);
    };
    addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
}
// ← / → : déplace la photo choisie d'une place dans son bloc
function nudge(p, d) {
  const i = shapeCur, blocks = homeBlocks(p, gridPage), b = blocks.find(x => x.imgs.includes(i)); if (!b) return;
  const k = b.imgs.indexOf(i), to = k + d; if (to < 0 || to >= b.imgs.length) return;
  const imgs = b.imgs.slice(); imgs.splice(to, 0, imgs.splice(k, 1)[0]); setOrder(p, b, imgs);
  repaintGrid(p).then(() => { const el = $(`#gBlocks .gt[data-i="${i}"]`); if (el) el.focus({ preventScroll: true }); });
}
function paintShape(p) {
  const box = $("#gShape"); if (!box) return;
  const i = shapeCur, blocks = homeBlocks(p, gridPage), b = blocks.find(x => x.imgs.includes(i));
  if (i == null || !b) { box.innerHTML = ""; return; }
  const sh = (C.portfolio.data.shape || {})[i], r = sh ? sh.r : "o", m = C.meta && C.meta[i], z = sizeOf(i), k = b.imgs.indexOf(i);
  box.innerHTML = `<div class="shapebox"><div class="shprev ${gridPage ? "o" : r}"><img alt=""></div><div class="stack" style="gap:8px;flex:1;min-width:200px">
    <p style="margin:0"><b>Photo ${n3(i)}</b> <span class="hint">${m ? `${m[0]} × ${m[1]} px, ${m[0] > m[1] ? "horizontale" : m[0] < m[1] ? "verticale" : "carrée"}` : ""} · place ${k + 1} sur ${b.imgs.length}</span></p>
    <div class="row" style="gap:8px"><button type="button" class="btn small" data-mv="-1" aria-label="Déplacer vers la gauche (plus tôt)"${k ? "" : " disabled"}>←</button><button type="button" class="btn small" data-mv="1" aria-label="Déplacer vers la droite (plus tard)"${k < b.imgs.length - 1 ? "" : " disabled"}>→</button>
    <div class="seg" role="radiogroup" aria-label="Taille sur la mosaïque">${SIZES.map(([v, l]) => `<button type="button" class="btn small" role="radio" data-z="${v}" aria-checked="${z === v}">${l}</button>`).join("")}</div></div>
    ${gridPage ? "" : `<div class="seg" role="radiogroup" aria-label="Forme sur l'accueil">${[["o", "Original"], ["v", "Vertical (2:3)"], ["h", "Horizontal (3:2)"]].map(([kk, l]) => `<button type="button" class="btn small" role="radio" data-r="${kk}" aria-checked="${r === kk}">${l}</button>`).join("")}</div>
    <label class="field"><span>Cadrage horizontal : <b data-o="x">${sh ? sh.x ?? 50 : 50}</b> % (gauche 0, droite 100)</span><input type="range" min="0" max="100" step="1" data-a="x" value="${sh ? sh.x ?? 50 : 50}"${sh ? "" : " disabled"}></label>
    <label class="field"><span>Cadrage vertical : <b data-o="y">${sh ? sh.y ?? 50 : 50}</b> % (haut 0, bas 100)</span><input type="range" min="0" max="100" step="1" data-a="y" value="${sh ? sh.y ?? 50 : 50}"${sh ? "" : " disabled"}></label>`}
  </div></div>`;
  const pv = $(".shprev img", box); pv.src = thumbImg(i).src; pv.style.objectPosition = sh && !gridPage ? `${sh.x ?? 50}% ${sh.y ?? 50}%` : ""; if ((gridPage || !sh) && m) $(".shprev", box).style.aspectRatio = `${m[0]} / ${m[1]}`;
  $$("[data-mv]", box).forEach(bt => bt.addEventListener("click", () => nudge(p, +bt.dataset.mv)));
  $$("[data-z]", box).forEach(bt => bt.addEventListener("click", () => {
    const d = C.portfolio.data, v = bt.dataset.z;
    if (!v) { if (d.size) { delete d.size[i]; if (!Object.keys(d.size).length) delete d.size; } } else (d.size ||= {})[i] = v;
    mark(); repaintGrid(p);
  }));
  $$("[data-r]", box).forEach(bt => bt.addEventListener("click", () => {
    const d = C.portfolio.data;
    if (bt.dataset.r === "o") { if (d.shape) { delete d.shape[i]; if (!Object.keys(d.shape).length) delete d.shape; } }
    else { const o = (d.shape ||= {})[i] || {}; d.shape[i] = { r: bt.dataset.r, ...(o.x != null && o.x !== 50 ? { x: o.x } : {}), ...(o.y != null && o.y !== 50 ? { y: o.y } : {}) }; }
    mark(); repaintGrid(p);
  }));
  $$("input[type=range]", box).forEach(el => el.addEventListener("input", () => {
    const s2 = C.portfolio.data.shape && C.portfolio.data.shape[i]; if (!s2) return;
    const a = el.dataset.a, v = +el.value; if (v === 50) delete s2[a]; else s2[a] = v;
    $(`[data-o=${a}]`, box).textContent = v; const pos = `${s2.x ?? 50}% ${s2.y ?? 50}%`; pv.style.objectPosition = pos;
    $$(`#gBlocks .gt[data-i="${i}"] img`).forEach(im => { im.style.objectPosition = pos; }); mark();
  }));
}

// ---------- photos retirées ----------
function editUnpub() {
  const ed = $("#pEd"), list = unpub();
  ed.innerHTML = `<div class="edbox"><h2 class="s" style="margin:0">Photos retirées <span class="hint">(${list.length})</span></h2>
    <p class="hint" style="margin:0">Ces photos restent dans le catalogue du site mais ne sont affichées nulle part. Sélectionnez-les puis « Remettre dans une édition ». Les photos ajoutées sans destination arrivent aussi ici.</p>
    <div class="thumbs" id="uGrid"></div>
    <div class="row"><span class="hint" id="uN"></span></div>
    <div class="ptbar"><button class="btn small primary" type="button" id="uBack">Remettre dans une édition…</button><button class="btn small" type="button" id="uHome">Ajouter aux coups de cœur</button></div>
    <div class="row"><label class="btn small"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden id="uFile">Ajouter depuis mon ordinateur</label><button class="btn small" type="button" id="uGal">Ajouter depuis une galerie client</button></div></div>`;
  const g = $("#uGrid");
  list.forEach(i => {
    const t = document.createElement("div"); t.className = "th" + (sel.has(i) ? " on" : ""); t.dataset.i = i; t.tabIndex = 0; t.setAttribute("role", "button"); t.setAttribute("aria-label", `Photo ${i}`);
    t.appendChild(thumbImg(i)); t.appendChild(zoomBtn(i)); t.insertAdjacentHTML("beforeend", `<span class="no">${n3(i)}</span>`);
    const toggle = () => { sel.has(i) ? sel.delete(i) : sel.add(i); t.classList.toggle("on", sel.has(i)); t.setAttribute("aria-pressed", String(sel.has(i))); upd(); };
    t.addEventListener("click", toggle); t.addEventListener("keydown", ev => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); toggle(); } });
    g.appendChild(t);
  });
  if (!list.length) g.innerHTML = '<p class="hint" style="margin:0">Aucune photo retirée.</p>';
  const upd = () => { const n = [...sel].filter(i => list.includes(i)).length; $("#uN").textContent = n ? `${n} sélectionnée(s)` : ""; $("#uBack").disabled = $("#uHome").disabled = !n; };
  upd();
  $("#uBack").addEventListener("click", () => moveSel([...sel].filter(i => list.includes(i)), "unpub"));
  $("#uHome").addEventListener("click", () => { const ids = [...sel].filter(i => list.includes(i)); detach(ids); C.home.data.wall.push(...ids); sel.clear(); mark(); mark("home"); refreshTree(); A().toast("Ajoutées aux coups de cœur."); });
  $("#uFile").addEventListener("change", ev => { const fs = [...ev.target.files]; ev.target.value = ""; addFiles(fs.map(f => ({ blob: f, name: f.name })), null); });
  $("#uGal").addEventListener("click", () => fromGallery(null));
}

// ---------- accueil : cartes de l'ouverture (hero + heroLab), à la une, coups de cœur (wall) ----------
const onHome = i => { const H = C.home.data; return H.hero.includes(i) || H.wall.includes(i) || H.about.includes(i) || H.me === i; };
// sources d'une photo : « Photos retirées » puis chaque édition (photo vedette comprise)
function photoSources(firstProject) {
  const out = [{ label: "Photos retirées (hors du site)", ids: () => unpub().slice() }], mine = [];
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach(e => {
    const t = { label: `${firstProject === q.id ? "Ce projet" : T2(q.title, "fr")}${q.eds ? " · " + [e.brand, e.look ? "Look " + e.look : "", e.year, T2(e.label, "fr")].filter(Boolean).join(" ") : ""}${q.hidden || e.hidden ? " (non publié)" : ""}`, ids: () => (e.feature ? [e.feature.img] : []).concat(q.lead && edsOf(q)[0] === e ? [q.lead.img] : [], e.imgs) };
    (firstProject === q.id ? mine : out).push(t);
  })));
  return mine.concat(out);
}
// choix d'une photo (une seule) : renvoie un numéro, { files } (depuis l'ordinateur) ou null
function pickPhoto({ title, hint, project, why }) {
  return new Promise(resolve => {
    const d = $("#phDlg"), src = $("#phSrc"), grid = $("#phGrid"), list = photoSources(project);
    $("#phT").textContent = title; $("#phHint").textContent = hint;
    src.innerHTML = list.map((t, k) => `<option value="${k}">${esc(t.label)}</option>`).join("");
    let res = null;
    const paint = () => {
      grid.textContent = "";
      const ids = list[+src.value].ids();
      ids.forEach(i => {
        const t = document.createElement("button"); t.type = "button"; t.className = "th"; const no = why(i);
        t.setAttribute("aria-label", `Photo ${i}${no ? " (" + no + ")" : ""}`); if (no) { t.disabled = true; t.classList.add("dim"); t.title = no; }
        t.appendChild(thumbImg(i)); t.insertAdjacentHTML("beforeend", `<span class="no">${n3(i)}${no ? " · " + esc(no) : ""}</span>`);
        t.addEventListener("click", () => { res = i; d.close(); });
        grid.appendChild(t);
      });
      if (!ids.length) grid.innerHTML = '<p class="hint" style="margin:0">Aucune photo ici.</p>';
    };
    src.onchange = paint; paint();
    const f = $("#phFile"); f.value = ""; f.onchange = () => { res = { files: [...f.files] }; f.value = ""; d.close(); };
    d.addEventListener("close", () => resolve(res), { once: true });
    d.showModal();
  });
}
// photo envoyée depuis l'ordinateur : elle arrive dans « Photos retirées » (les modifications en cours sont gardées)
async function uploadOne(files) {
  const ids = await addFiles(files.slice(0, 1).map(f => ({ blob: f, name: f.name })), null, "ordinateur", true);
  return ids && ids.length ? ids[0] : null;
}
function editHome() {
  const ed = $("#pEd");
  ed.innerHTML = `<div class="stack"><div class="edbox" id="hHero"></div><div class="edbox" id="hFeat"></div><div class="edbox" id="hWall"></div></div>`;
  paintHero(); paintFeat();
  paintList($("#hWall"), "wall", "Coups de cœur", "Le mur de photos de l'accueil (rangé automatiquement par couleur). Une photo retirée va dans « Photos retirées ».");
}
function paintList(box, key, title, hint) {
  const H = C.home.data, list = H[key];
  box.innerHTML = `<h2 class="s" style="margin:0">${title} <span class="hint">(${list.length})</span></h2><p class="hint" style="margin:0">${hint}</p><div class="thumbs"></div>
    <div class="ptbar"><button class="btn small" type="button" data-a="l">← Avant</button><button class="btn small" type="button" data-a="r">Après →</button><button class="btn small danger" type="button" data-a="out">Retirer du site</button></div>
    <div class="row"><label class="field" style="min-width:150px;flex:0 1 180px"><span>Ajouter par numéro</span><input class="input" type="number" min="0" inputmode="numeric" data-a="id"></label><button class="btn small" type="button" data-a="add">Ajouter</button></div>`;
  const g = box.querySelector(".thumbs"), mine = () => [...sel].filter(i => list.includes(i)), again = () => paintList(box, key, title, hint);
  list.forEach((i, k) => {
    const t = document.createElement("div"); t.className = "th" + (sel.has(i) ? " on" : ""); t.dataset.i = i; t.draggable = true; t.tabIndex = 0; t.setAttribute("role", "button"); t.setAttribute("aria-label", `Photo ${i}, position ${k + 1}`);
    t.appendChild(thumbImg(i)); t.appendChild(zoomBtn(i)); t.insertAdjacentHTML("beforeend", `<span class="no">${k + 1} · ${n3(i)}</span>`);
    const toggle = () => { sel.has(i) ? sel.delete(i) : sel.add(i); t.classList.toggle("on", sel.has(i)); upd(); };
    t.addEventListener("click", toggle); t.addEventListener("keydown", ev => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); toggle(); } });
    t.addEventListener("dragstart", ev => ev.dataTransfer.setData("text/plain", String(k)));
    t.addEventListener("dragover", ev => { ev.preventDefault(); t.classList.add("over"); });
    t.addEventListener("dragleave", () => t.classList.remove("over"));
    t.addEventListener("drop", ev => { ev.preventDefault(); const from = +ev.dataTransfer.getData("text/plain"); if (isNaN(from) || from === k) return; const [m] = list.splice(from, 1); list.splice(k, 0, m); mark("home"); again(); });
    g.appendChild(t);
  });
  const upd = () => box.querySelectorAll(".ptbar button").forEach(b => { b.disabled = !mine().length; });
  upd();
  const shift = d => { const ids = new Set(mine()); const order = d < 0 ? list.map((_, k) => k) : list.map((_, k) => list.length - 1 - k); for (const k of order) { const j = k + d; if (ids.has(list[k]) && j >= 0 && j < list.length && !ids.has(list[j])) [list[k], list[j]] = [list[j], list[k]]; } mark("home"); again(); };
  box.querySelector("[data-a=l]").addEventListener("click", () => shift(-1));
  box.querySelector("[data-a=r]").addEventListener("click", () => shift(1));
  box.querySelector("[data-a=out]").addEventListener("click", () => { const ids = mine(); H[key] = list.filter(i => !ids.includes(i)); unpub().push(...ids); ids.forEach(i => sel.delete(i)); mark("home"); mark(); editHome(); refreshUnpubCount(); A().toast("Retirées de l'accueil (dans « Photos retirées »)."); });
  box.querySelector("[data-a=add]").addEventListener("click", () => {
    const i = parseInt(box.querySelector("[data-a=id]").value, 10);
    if (!takeForHome(i)) return;
    H[key].push(i); prune(); mark("home"); mark(); editHome(); refreshUnpubCount();
  });
}
// une photo qui rejoint l'accueil quitte son édition ou « Photos retirées » (chaque photo sert une seule fois)
const homeWhy = i => onHome(i) ? "déjà sur l'accueil" : isFixedSpot(i) ? "photo vedette" : "";
function takeForHome(i, ask = true) {
  if (isNaN(i) || (C.meta && !C.meta[i])) { A().toast("Numéro inconnu : la photo n'est pas dans le catalogue du site.", true); return false; }
  if (onHome(i)) { A().toast(`La photo ${i} est déjà sur l'accueil.`, true); return false; }
  if (isFixedSpot(i)) { A().toast(`La photo ${i} est une photo vedette d'un projet : choisissez-en une autre.`, true); return false; }
  const where = targets(false).find(t => t.e.imgs.includes(i));
  if (ask && where && !confirm(`La photo ${i} est dans « ${where.label} ». La déplacer sur l'accueil ?`)) return false;
  detach([i]); return true;
}
async function heroPhoto(title) {
  const r = await pickPhoto({ title, hint: "La photo quitte son édition ou « Photos retirées » : sur l'accueil, chaque photo n'apparaît qu'une fois. Les photos vedettes des projets ne peuvent pas être prises.", why: homeWhy });
  if (r == null) return null;
  if (typeof r === "object") { const id = await uploadOne(r.files); if (id == null) return null; detach([id]); return id; }
  return takeForHome(r, false) ? r : null;
}
const LAB_MAX = { name: 40, meta: 80 };
function paintHero() {
  const box = $("#hHero"), H = C.home.data, list = H.hero, lab = (H.heroLab ||= {});
  box.innerHTML = `<div class="row" style="justify-content:space-between"><h2 class="s" style="margin:0">Ouverture de l'accueil <span class="hint">(${list.length} cartes)</span></h2><button class="btn small primary" type="button" data-a="add">Ajouter une carte…</button></div>
    <p class="hint" style="margin:0">Les cartes d'artistes en tête de l'accueil, telles qu'elles s'affichent sur le site, dans l'ordre : glissez une photo, ou utilisez ← et →. Le nom (ou sigle) s'inscrit sur la carte ; la légende apparaît dans la visionneuse. Une carte sans nom reste possible (aucune étiquette). La première carte sert aussi d'image de partage. Une photo remplacée ou retirée va dans « Photos retirées ».</p>
    <div class="hcards"></div>`;
  const g = $(".hcards", box), again = () => { paintHero(); refreshUnpubCount(); };
  const setLab = (i, name, fr, en) => { if (name || fr || en) lab[i] = { name, meta: { fr, en } }; else delete lab[i]; mark("home"); };
  list.forEach((i, k) => {
    const L0 = lab[i] || {}, m = (L0.meta || {}), wh = C.meta && C.meta[i];
    const c = document.createElement("div"); c.className = "hc"; c.dataset.k = k;
    c.innerHTML = `<div class="hcfig" draggable="true" style="aspect-ratio:${wh ? wh[0] + " / " + wh[1] : "2 / 3"}" aria-label="Carte ${k + 1}, photo ${i}"><span class="no">${k + 1} · ${n3(i)}</span><span class="card-tag"${L0.name ? "" : " hidden"}></span></div>
      <label class="field"><span>Nom ou sigle <span class="hint" data-c="name"></span></span><input class="input" data-f="name" maxlength="${LAB_MAX.name}" value="${esc(L0.name || "")}" placeholder="Aucune étiquette"></label>
      <label class="field"><span>Légende (FR)</span><input class="input" data-f="fr" maxlength="${LAB_MAX.meta}" value="${esc(m.fr || "")}" placeholder="Concert à Montréal, 2025"></label>
      <label class="field"><span>Légende (EN)</span><input class="input" data-f="en" maxlength="${LAB_MAX.meta}" value="${esc(m.en || "")}" placeholder="Concert in Montréal, 2025"></label>
      <div class="row hcbar"><button class="btn small" type="button" data-a="l" aria-label="Carte ${k + 1} avant"${k ? "" : " disabled"}>←</button><button class="btn small" type="button" data-a="r" aria-label="Carte ${k + 1} après"${k < list.length - 1 ? "" : " disabled"}>→</button><button class="btn small" type="button" data-a="rep">Remplacer…</button><button class="btn small danger" type="button" data-a="rm"${list.length > 1 ? "" : ' disabled title="Il faut au moins une carte"'}>Retirer</button></div>`;
    const fig = $(".hcfig", c); fig.prepend(thumbImg(i)); fig.appendChild(zoomBtn(i)); $(".hcfig img", c).src = LOCAL[i] || `../img/m/${n3(i)}.webp`;
    $(".hcfig img", c).addEventListener("error", function () { if (!this.dataset.f) { this.dataset.f = 1; this.src = `../img/f/${n3(i)}.webp`; } }, { once: true });
    const tag = $(".card-tag", c); tag.textContent = L0.name || "";
    const ins = $$("[data-f]", c), val = f => $(`[data-f=${f}]`, c).value.trim();
    const cnt = () => { $("[data-c=name]", c).textContent = `${[...$("[data-f=name]", c).value].length}/${LAB_MAX.name}`; };
    cnt();
    ins.forEach(x => x.addEventListener("input", () => { setLab(i, val("name"), val("fr"), val("en")); tag.textContent = val("name"); tag.hidden = !val("name"); cnt(); }));
    fig.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", "hero:" + k); c.classList.add("drag"); });
    fig.addEventListener("dragend", () => c.classList.remove("drag"));
    c.addEventListener("dragover", ev => { ev.preventDefault(); c.classList.add("over"); });
    c.addEventListener("dragleave", () => c.classList.remove("over"));
    c.addEventListener("drop", ev => { ev.preventDefault(); c.classList.remove("over"); const s0 = ev.dataTransfer.getData("text/plain"); if (!s0.startsWith("hero:")) return; const from = +s0.slice(5); if (isNaN(from) || from === k) return; const [x] = list.splice(from, 1); list.splice(k, 0, x); mark("home"); setTimeout(again); }); // repeint après la fin du glisser (dragend)
    const move = d => { const j = k + d; if (j < 0 || j >= list.length) return; [list[k], list[j]] = [list[j], list[k]]; mark("home"); again(); requestAnimationFrame(() => { const b = $(`.hc[data-k="${j}"] [data-a=${d < 0 ? "l" : "r"}]`, box); (b && !b.disabled ? b : $(`.hc[data-k="${j}"] [data-a=rep]`, box)).focus(); }); };
    $("[data-a=l]", c).addEventListener("click", () => move(-1));
    $("[data-a=r]", c).addEventListener("click", () => move(1));
    $("[data-a=rm]", c).addEventListener("click", () => {
      if (list.length <= 1) return;
      if (!confirm(`Retirer la carte ${k + 1}${L0.name ? " (" + L0.name + ")" : ""} ? La photo ${i} va dans « Photos retirées ».`)) return;
      list.splice(k, 1); delete lab[i]; unpub().push(i); sel.delete(i); mark("home"); mark(); again(); A().toast(`Carte retirée : photo ${i} dans « Photos retirées ».`);
    });
    $("[data-a=rep]", c).addEventListener("click", async () => {
      const j = await heroPhoto(`Remplacer la photo de la carte ${k + 1}${L0.name ? " · " + L0.name : ""}`); if (j == null) return;
      const at = list.indexOf(i); if (at < 0) return;
      list[at] = j; if (lab[i]) { lab[j] = lab[i]; delete lab[i]; } unpub().push(i); prune(); mark("home"); mark(); again();
      A().toast(`Photo remplacée (nom et légende gardés). L'ancienne photo ${i} est dans « Photos retirées ».`);
    });
    g.appendChild(c);
  });
  $("[data-a=add]", box).addEventListener("click", async () => {
    const j = await heroPhoto("Ajouter une carte à l'ouverture"); if (j == null) return;
    list.push(j); prune(); mark("home"); mark(); again();
    requestAnimationFrame(() => { const n = $(`.hc[data-k="${list.length - 1}"] [data-f=name]`, box); if (n) { n.scrollIntoView({ block: "center" }); n.focus(); } });
    A().toast("Carte ajoutée en dernière position : donnez-lui un nom.");
  });
}
// ---------- à la une : 5 projets au plus (rang « featured »), carte 4:5 comme sur le site ----------
const featList = () => C.portfolio.data.chapters.flatMap(c => c.projects).filter(p => p.featured).sort((a, b) => a.featured - b.featured);
const renumber = l => l.forEach((p, k) => { p.featured = k + 1; });
const defCover = p => { const e0 = edsOf(p).find(e => !e.hidden) || edsOf(p)[0]; return p.cover != null ? p.cover : p.lead ? p.lead.img : e0.feature ? e0.feature.img : e0.imgs[0]; };
const cardCover = p => p.featuredCover != null ? p.featuredCover : defCover(p);
const FT_MAX = { title: 60, sub: 140 };
function defSub(p) {
  const ys = [...new Set(edsOf(p).filter(e => !e.hidden).map(e => String(e.year || p.year || "")).filter(Boolean))].sort();
  const n = edsOf(p).filter(e => !e.hidden).reduce((s, e) => s + e.imgs.length + (e.feature ? 1 : 0), 0);
  return [p.place, ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : ys[0], `${n} photos`].filter(Boolean).join(" · ");
}
function paintFeat() {
  const box = $("#hFeat"), d = C.portfolio.data, list = featList(); renumber(list);
  const free = d.chapters.flatMap(c => c.projects).filter(p => !p.featured && !p.hidden);
  box.innerHTML = `<h2 class="s" style="margin:0">À la une <span class="hint">(${list.length}/5)</span></h2>
    <p class="hint" style="margin:0">Les cartes « À la une » de l'accueil, telles qu'elles s'affichent sur le site, dans l'ordre : glissez une carte, ou utilisez ← et →. Pour chaque carte : la photo (celle du projet par défaut, ou n'importe quelle photo du portfolio, des « Photos retirées » ou de votre ordinateur), son cadrage, et au besoin un autre titre ou sous-titre (vide = titre du projet et ligne automatique). Un projet non publié ne peut pas être à la une.</p>
    <div class="row"><label class="field" style="flex:1 1 240px;max-width:420px"><span>Projet à mettre à la une</span><select class="input" data-a="pick">${free.map(p => `<option value="${esc(p.id)}">${esc(T2(p.title, "fr"))}</option>`).join("")}</select></label><button class="btn small primary" type="button" data-a="add"${list.length >= 5 || !free.length ? " disabled" : ""}>Mettre à la une</button>${list.length >= 5 ? '<span class="hint">5 projets au plus : retirez-en un d\'abord.</span>' : ""}</div>
    <div class="fcards"></div>`;
  const g = $(".fcards", box), again = () => { paintFeat(); refreshTree(); };
  if (!list.length) g.innerHTML = '<p class="hint" style="margin:0">Aucun projet à la une : la section est masquée sur le site.</p>';
  list.forEach((p, k) => {
    const ci = d.chapters.findIndex(c => c.projects.includes(p)), ch = d.chapters[ci], f = p.featuredFocus || {}, i = cardCover(p);
    const c = document.createElement("div"); c.className = "fc"; c.dataset.k = k;
    c.innerHTML = `<div class="fcard" draggable="true" aria-label="Carte ${k + 1} : ${esc(T2(p.title, "fr"))}"><img alt=""><span class="fc-txt"><span class="fc-n">${String(ci + 1).padStart(2, "0")} · ${esc(T2(ch.short || ch.name, "fr"))}</span><span class="fc-t"></span><span class="fc-m"></span><span class="fc-go">Voir le projet</span></span></div>
      <div class="row hcbar"><button class="btn small" type="button" data-a="l" aria-label="Carte ${k + 1} avant"${k ? "" : " disabled"}>←</button><button class="btn small" type="button" data-a="r" aria-label="Carte ${k + 1} après"${k < list.length - 1 ? "" : " disabled"}>→</button><button class="btn small" type="button" data-a="ph">Changer la photo…</button><button class="btn small" type="button" data-edit="${i}">Modifier la photo</button>${p.featuredCover != null ? '<button class="btn small" type="button" data-a="def">Photo du projet</button>' : ""}<button class="btn small danger" type="button" data-a="rm">Retirer</button></div>
      <p class="hint" style="margin:0">Photo ${n3(i)}${p.featuredCover != null ? " (choisie pour la carte)" : " (couverture du projet)"}</p>
      <label class="field"><span>Cadrage horizontal : <b data-o="x">${f.x ?? 50}</b> %</span><input type="range" min="0" max="100" step="1" data-a="x" value="${f.x ?? 50}"></label>
      <label class="field"><span>Cadrage vertical : <b data-o="y">${f.y ?? 50}</b> %</span><input type="range" min="0" max="100" step="1" data-a="y" value="${f.y ?? 50}"></label>
      <label class="field"><span>Titre de la carte (FR)</span><input class="input" data-f="title_fr" maxlength="${FT_MAX.title}" value="${esc(T2(p.featuredTitle, "fr"))}" placeholder="${esc(T2(p.title, "fr"))}"></label>
      <label class="field"><span>Titre de la carte (EN)</span><input class="input" data-f="title_en" maxlength="${FT_MAX.title}" value="${esc(p.featuredTitle && typeof p.featuredTitle === "object" ? p.featuredTitle.en || "" : "")}" placeholder="${esc(T2(p.title, "en"))}"></label>
      <label class="field"><span>Sous-titre (FR)</span><input class="input" data-f="sub_fr" maxlength="${FT_MAX.sub}" value="${esc(T2(p.featuredSub, "fr"))}" placeholder="Automatique : ${esc(defSub(p))}"></label>
      <label class="field"><span>Sous-titre (EN)</span><input class="input" data-f="sub_en" maxlength="${FT_MAX.sub}" value="${esc(p.featuredSub && typeof p.featuredSub === "object" ? p.featuredSub.en || "" : "")}" placeholder="Automatic"></label>`;
    const card = $(".fcard", c), im = $("img", card);
    im.src = LOCAL[i] || `../img/m/${n3(i)}.webp`; im.addEventListener("error", () => { if (!im.dataset.f) { im.dataset.f = 1; im.src = `../img/f/${n3(i)}.webp`; } });
    const pos = () => { const q = p.featuredFocus || {}; im.style.objectPosition = `${q.x ?? 50}% ${q.y ?? 50}%`; };
    const txt = () => { $(".fc-t", card).textContent = T2(p.featuredTitle, "fr") || T2(p.title, "fr"); $(".fc-m", card).textContent = T2(p.featuredSub, "fr") || defSub(p); };
    pos(); txt();
    $$("input[type=range]", c).forEach(el => el.addEventListener("input", () => {
      const q = (p.featuredFocus ||= {}), a = el.dataset.a, v = +el.value; if (v === 50) delete q[a]; else q[a] = v;
      if (!Object.keys(q).length) delete p.featuredFocus; $(`[data-o=${a}]`, c).textContent = v; pos(); mark();
    }));
    const val = k2 => $(`[data-f=${k2}]`, c).value.trim();
    $$("[data-f]", c).forEach(x => x.addEventListener("input", () => { setT(p, "featuredTitle", val("title_fr"), val("title_en")); setT(p, "featuredSub", val("sub_fr"), val("sub_en")); txt(); mark(); }));
    card.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", "feat:" + k); c.classList.add("drag"); });
    card.addEventListener("dragend", () => c.classList.remove("drag"));
    card.addEventListener("click", ev => ev.preventDefault());
    c.addEventListener("dragover", ev => { ev.preventDefault(); c.classList.add("over"); });
    c.addEventListener("dragleave", () => c.classList.remove("over"));
    c.addEventListener("drop", ev => { ev.preventDefault(); c.classList.remove("over"); const s0 = ev.dataTransfer.getData("text/plain"); if (!s0.startsWith("feat:")) return; const from = +s0.slice(5); if (isNaN(from) || from === k) return; const l2 = list.slice(); const [x] = l2.splice(from, 1); l2.splice(k, 0, x); renumber(l2); mark(); setTimeout(again); });
    const move = dd => { const j = k + dd; if (j < 0 || j >= list.length) return; const l2 = list.slice(); [l2[k], l2[j]] = [l2[j], l2[k]]; renumber(l2); mark(); again(); requestAnimationFrame(() => { const b = $(`.fc[data-k="${j}"] [data-a=${dd < 0 ? "l" : "r"}]`, box); (b && !b.disabled ? b : $(`.fc[data-k="${j}"] [data-a=ph]`, box)).focus(); }); };
    $("[data-a=l]", c).addEventListener("click", () => move(-1));
    $("[data-a=r]", c).addEventListener("click", () => move(1));
    $("[data-a=rm]", c).addEventListener("click", () => { for (const x of ["featured", "featuredCover", "featuredFocus", "featuredTitle", "featuredSub"]) delete p[x]; renumber(featList()); mark(); again(); A().toast(`« ${T2(p.title, "fr")} » n'est plus à la une.`); });
    const def = $("[data-a=def]", c); if (def) def.addEventListener("click", () => { delete p.featuredCover; mark(); again(); });
    $("[data-a=ph]", c).addEventListener("click", async () => {
      const pool = poolOf();
      const r = await pickPhoto({ title: `Photo de la carte « ${T2(p.title, "fr")} »`, hint: "La photo reste où elle est (projet, édition ou « Photos retirées ») : elle est seulement montrée sur la carte. Les photos de l'ouverture et des coups de cœur ne peuvent pas être prises.", project: p.id, why: j => pool.has(j) ? "" : "sur l'accueil" });
      if (r == null) return;
      const j = typeof r === "object" ? await uploadOne(r.files) : r; if (j == null) return;
      if (j === defCover(p)) delete p.featuredCover; else p.featuredCover = j;
      delete p.featuredFocus; mark(); again(); A().toast(`Photo ${j} sur la carte (cadrage remis au centre).`);
    });
    g.appendChild(c);
  });
  $("[data-a=add]", box).addEventListener("click", () => {
    const id = $("[data-a=pick]", box).value, o = id && projOf(id); if (!o || featList().length >= 5) return;
    o.p.featured = 99; renumber(featList()); mark(); again(); A().toast(`« ${T2(o.p.title, "fr")} » est à la une (dernière position).`);
  });
}

// ---------- ajout de photos au site : redimensionnement dans le navigateur, envoi au serveur ----------
const canvasOf = (src, w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h); return c; };
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(b); });
async function prepare(blob) {
  let bmp; if (blob instanceof HTMLCanvasElement) bmp = blob; // sortie de l'éditeur
  else try { bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { throw new Error("Format illisible par ce navigateur."); }
  try {
    const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    if (Math.max(w, h) < 300) throw new Error("Photo trop petite (moins de 300 px).");
    const c = canvasOf(bmp, w, h);
    let out = null;
    for (const q of [.82, .74, .66]) { out = await toBlob(c, "image/webp", q); if (!out || out.type !== "image/webp") { out = null; break; } if (out.size <= 3 * 1024 * 1024) break; }
    if (!out) for (const q of [.9, .82, .72]) { out = await toBlob(c, "image/jpeg", q); if (out.size <= 3 * 1024 * 1024) break; } // navigateur sans WebP : converti au moment de la publication
    if (out.size > 3 * 1024 * 1024) throw new Error("Photo trop lourde même compressée (plus de 3 Mo).");
    const qs = 16 / Math.max(w, h), qc = canvasOf(c, Math.max(1, Math.round(w * qs)), Math.max(1, Math.round(h * qs)));
    const qd = qc.toDataURL("image/webp", .5), lqip = qd.startsWith("data:image/webp") ? qd.split(",")[1] : "";
    const hc = canvasOf(c, 9, 8), px = hc.getContext("2d").getImageData(0, 0, 9, 8).data; let hash = 0n;
    const L = k => (px[k * 4] * 299 + px[k * 4 + 1] * 587 + px[k * 4 + 2] * 114) / 1000;
    for (let r = 0; r < 8; r++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | (L(r * 9 + x) > L(r * 9 + x + 1) ? 1n : 0n);
    return { blob: out, data: await blobB64(out), lqip, hash: hash.toString(), w, h };
  } finally { bmp.close && bmp.close(); }
}
let busy = false;
async function addFiles(items, target, origin = "ordinateur", keepDraft = false) {
  if (!items.length) return;
  // keepDraft : la photo va dans « Photos retirées » (rien d'autre ne change côté serveur), les modifications en cours sont gardées
  if (dirty && !keepDraft) { A().toast("Publiez d'abord les modifications en cours : l'ajout de photos enregistre directement sur le site.", true); return; }
  if (busy) { A().toast("Un envoi est déjà en cours.", true); return; }
  busy = true;
  const st = $("#pState"), done = [], errs = []; let skipped = 0;
  try {
    for (const [k, it] of items.entries()) {
      st.textContent = `Photo ${k + 1}/${items.length} : préparation…`;
      let pr; try {
        // chaque photo passe par l'éditeur (recadrer, tourner, zoomer) avant l'envoi ; « Annuler » la laisse de côté
        const src = it.src ? await it.src() : it.blob;
        const cv = it.canvas || (window.BBZE ? await window.BBZE.open(src, { title: `${it.name}${items.length > 1 ? ` (${k + 1}/${items.length})` : ""}`, okLabel: "Envoyer" }) : src);
        if (!cv) { skipped++; continue; }
        pr = await prepare(cv);
      } catch (e) { errs.push(`${it.name} : ${e.message}`); continue; }
      st.textContent = `Photo ${k + 1}/${items.length} : envoi…`;
      const body = { data: pr.data, lqip: pr.lqip, hash: pr.hash, target, origin, ...(it.force ? { force: true } : {}) };
      let r;
      try { r = await A().api("/api/admin/site-photos", { method: "POST", body }); }
      catch (e) {
        if (e.code === "near_duplicate" && confirm(`« ${it.name} » ressemble beaucoup à la photo ${e.data.like} déjà dans le catalogue. L'ajouter quand même ?`)) {
          try { r = await A().api("/api/admin/site-photos", { method: "POST", body: { ...body, force: true } }); } catch (e2) { errs.push(`${it.name} : ${A().errText(e2)}`); continue; }
        } else { if (e.code !== "near_duplicate") errs.push(`${it.name} : ${A().errText(e)}`); continue; }
      }
      // le serveur a ajouté la photo au même endroit : même changement ici, avec la nouvelle version du fichier
      LOCAL[r.id] = URL.createObjectURL(pr.blob); LOCALB[r.id] = pr.blob; (C.meta ||= {})[r.id] = [r.w, r.h];
      if (target) edsOf(projOf(target.project).p)[target.ed].imgs.push(r.id); else unpub().push(r.id);
      C.portfolio.sha = r.shas.portfolio; done.push(r.id);
    }
  } finally { busy = false; }
  if (skipped && !done.length && !errs.length) { st.textContent = ""; return done; }
  st.textContent = done.length ? `${done.length} photo${done.length > 1 ? "s" : ""} ajoutée${done.length > 1 ? "s" : ""} (n° ${done.join(", ")}). Le site se met à jour dans quelques minutes.` : "";
  if (errs.length) A().toast(errs.slice(0, 2).join(" · "), true); else if (done.length) A().toast("Photos ajoutées au site.");
  refreshTree();
  return done;
}
// ---------- modifier une photo du site : nouvelle version sous un nouveau numéro ----------
// Les numéros ne changent jamais de contenu (cache des navigateurs) : la photo modifiée reçoit un nouveau numéro qui
// prend la place de l'ancien partout (éditions, vedette, couverture, sélection, accueil, cartes, contact, textes
// alternatifs, cadrages), et l'ancien va dans « Photos retirées » (restaurable). Un seul enregistrement du contenu.
function swapId(o, n) {
  const d = C.portfolio.data, H = C.home.data;
  const L = a => { if (Array.isArray(a)) a.forEach((x, k) => { if (x === o) a[k] = n; }); };
  const K = m => { if (m && typeof m === "object" && o in m) { m[n] = m[o]; delete m[o]; } };
  d.chapters.forEach(c => c.projects.forEach(p => {
    edsOf(p).forEach(e => { L(e.imgs); if (e.feature && e.feature.img === o) e.feature.img = n; });
    if (p.lead && p.lead.img === o) p.lead.img = n;
    if (p.cover === o) p.cover = n; if (p.featuredCover === o) p.featuredCover = n;
    L(p.selection); K(p.selFocus); Object.values(p.homePicks || {}).forEach(L);
  }));
  L(d.unpublished); K(d.alt); K(d.shape); K(d.size);
  L(H.hero); L(H.about); L(H.wall); K(H.heroLab); K(H.cap);
  if (H.me === o) H.me = n;
}
async function editSitePhoto(i) {
  if (busy) { A().toast("Un envoi est déjà en cours.", true); return; }
  if (dirty) { A().toast("Publiez d'abord les modifications en cours : la photo modifiée est enregistrée directement sur le site.", true); return; }
  let blob = LOCALB[i];
  if (!blob) { const r = await fetch(`../img/f/${n3(i)}.webp`); if (!r.ok) { A().toast(`Fichier de la photo ${i} introuvable (publication en cours ?).`, true); return; } blob = await r.blob(); }
  let cv; try { cv = await window.BBZE.open(blob, { title: `Photo ${n3(i)} · nouvelle version`, okLabel: "Enregistrer", maxSide: 1800 }); } catch (e) { A().toast(e.message, true); return; }
  if (!cv) return;
  if (!cv.edited && !confirm("Aucune modification. Enregistrer quand même une nouvelle version ?")) return;
  const done = await addFiles([{ name: `Photo ${n3(i)}`, canvas: cv, force: true }], null, "retouche", true);
  const n = done && done[0]; if (n == null) return;
  // le serveur a mis la nouvelle version dans « Photos retirées » : elle prend la place de l'ancienne
  C.portfolio.data.unpublished = unpub().filter(x => x !== n);
  swapId(i, n); unpub().push(i); if (C.meta && C.meta[i] == null) C.meta[i] = C.meta[n];
  sel.delete(i); mark("portfolio"); mark("home");
  if (!await save(`Administration : photo ${i} modifiée, remplacée par ${n} (l'ancienne va dans les photos retirées)`)) { refreshTree(); return; }
  refreshTree(); A().toast(`Photo modifiée : n° ${n} remplace ${i} partout. L'ancienne version est dans « Photos retirées ».`);
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-edit]"); if (!b || !C || !$("#vPort") || !$("#vPort").contains(b)) return;
  e.preventDefault(); e.stopPropagation(); editSitePhoto(+b.dataset.edit);
}, true);
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest(".pedit")) e.stopPropagation(); }, true);
async function fromGallery(target) {
  if (dirty) { A().toast("Publiez d'abord les modifications en cours.", true); return; }
  const d = $("#galDlg"), gs = $("#galS"), grid = $("#galGrid"), go = $("#galGo"), picked = new Set();
  let OV; try { OV = await A().api("/api/admin/overview"); } catch (e) { A().toast(A().errText(e), true); return; }
  gs.innerHTML = '<option value="">Choisir une galerie…</option>' + OV.galleries.map(g => `<option value="${esc(g.id)}">${esc(g.title)}${g.client ? " · " + esc(g.client) : ""} (${g.n} photos)</option>`).join("");
  grid.innerHTML = ""; go.disabled = true; $("#galN").textContent = "";
  const upd = () => { go.disabled = !picked.size; $("#galN").textContent = picked.size ? `${picked.size} photo${picked.size > 1 ? "s" : ""} cochée${picked.size > 1 ? "s" : ""}` : ""; };
  gs.onchange = async () => {
    picked.clear(); upd(); grid.innerHTML = gs.value ? '<p class="hint">Chargement…</p>' : "";
    if (!gs.value) return;
    let g; try { g = await A().api("/api/admin/galleries/" + gs.value); } catch (e) { grid.innerHTML = `<p class="err">${esc(A().errText(e))}</p>`; return; }
    grid.textContent = "";
    g.photos.filter(ph => ph.t && ph.status === "ready").forEach(ph => {
      const t = document.createElement("button"); t.type = "button"; t.className = "th"; t.setAttribute("aria-pressed", "false"); t.setAttribute("aria-label", ph.name);
      const im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.src = ph.t; t.appendChild(im);
      t.insertAdjacentHTML("beforeend", `<span class="no">${esc(ph.name.slice(0, 18))}</span>`);
      t.addEventListener("click", () => { picked.has(ph) ? picked.delete(ph) : picked.add(ph); t.classList.toggle("on", picked.has(ph)); t.setAttribute("aria-pressed", String(picked.has(ph))); upd(); });
      grid.appendChild(t);
    });
    if (!grid.children.length) grid.innerHTML = '<p class="hint">Aucune photo avec aperçu dans cette galerie.</p>';
  };
  go.onclick = () => {
    const list = [...picked]; d.close();
    addFiles(list.map(ph => ({ name: ph.name, src: async () => {
      const r = await fetch(A().API + `/api/admin/photos/${encodeURIComponent(ph.id)}/site-source`, { headers: { Authorization: "Bearer " + A().token() } });
      if (!r.ok) throw new Error("aperçu introuvable");
      return r.blob();
    } })), target, "galerie");
  };
  $("#galWhere").textContent = target ? targets(false).find(t => t.project === target.project && t.ed === target.ed).label : "Photos retirées (hors du site)";
  d.showModal();
}

function editSite() {
  cur = "@site"; $$("#pTree button[data-p]").forEach(b => b.setAttribute("aria-current", String(b.dataset.p === "@site")));
  const s = C.site.data, ed = $("#pEd");
  ed.innerHTML = `<div class="edbox"><h2 class="s">Réglages du site</h2><div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
    ${field("Adresse du serveur (vide = automatique)", inp("api", s.api, 'placeholder="https://…"'))}${field("Clé publique Turnstile (facultatif, avec le secret TURNSTILE_SECRET du serveur)", inp("turnstile", s.turnstile, 'placeholder="0x4AAAA…" autocomplete="off"'))}</div>
    <label class="check"><input type="checkbox" data-k="legalOk"${s.legalOk ? " checked" : ""}><span>Les pages Confidentialité et Conditions ont été validées par un juriste (retire la mention « version de travail »)</span></label>
    <label class="check"><input type="checkbox" data-k="projectPages"${s.projectPages !== false ? " checked" : ""}><span>Pages de projet dédiées</span></label>
    <p class="hint" style="margin:0">Types de prestation proposés dans le formulaire : ${(s.booking && s.booking.types || []).map(k => esc(TYPES[k] || k)).join(", ")}.</p>
    <div class="row"><span class="hint">Courriel, téléphone, Instagram, liens du site et textes de la section Contact : tout est dans « Contact ».</span><button class="btn small" type="button" data-a="ct">Ouvrir « Contact »</button></div></div>`;
  $("[data-a=ct]", ed).addEventListener("click", () => open("@contact"));
  $$("[data-k]", ed).forEach(x => x.addEventListener(x.type === "checkbox" ? "change" : "input", () => {
    const v = k => { const z = $(`[data-k=${k}]`, ed); return z.type === "checkbox" ? z.checked : z.value.trim(); };
    s.api = v("api"); s.legalOk = v("legalOk"); s.projectPages = v("projectPages");
    if (v("turnstile")) s.turnstile = v("turnstile"); else delete s.turnstile;
    mark("site");
  }));
}
// ---------- Contact : tout ce que montre la section Contact de l'accueil (photo, coordonnées, liens, textes) ----------
// textes d'origine de src.html (dictionnaire T, clés contact.h et contact.p) : un champ vide garde ce texte
const CT_DEF = { title: { fr: "Parlons de votre projet.", en: "Let’s talk about your project." }, text: { fr: "Soirée, concert, équipe, marque ou shooting : écrivez-moi ou retrouvez-moi sur Instagram. Je vous réponds avec plaisir.", en: "A party, a concert, a team, a brand or a shoot: email me or find me on Instagram. I’d love to hear from you." } };
const CT_MAX = { title: 80, text: 400 };
const SITE_EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/, IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const igHandle = v => String(v || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
const phoneIntl = v => { const d = String(v || "").replace(/[^\d+]/g, ""), n = d.replace(/\D/g, ""); return !n ? "" : d.startsWith("+") ? "+" + n : n.length === 10 ? "+1" + n : n.length === 11 && n[0] === "1" ? "+" + n : "+" + n; };
function contactProbs() {
  const s = C.site.data, out = [], ph = s.phone || "", h = s.phoneHref || "";
  if (!SITE_EMAIL.test(s.email || "")) out.push("courriel de contact invalide");
  if ([...ph].length > 30 || !/^[0-9 +().-]*$/.test(ph) || (ph && !/\d/.test(ph))) out.push("téléphone affiché : chiffres, espaces, + ( ) . - seulement");
  if (h && !/^\+[1-9][0-9]{6,14}$/.test(h)) out.push("téléphone international : + puis 7 à 15 chiffres");
  if (!ph !== !h) out.push("téléphone : les deux formats, ou aucun");
  if ((s.instagram || []).some(x => !IG_RE.test(x))) out.push("compte Instagram invalide");
  for (const k of ["title", "text"]) for (const l of ["fr", "en"]) if ([...(((s.contact || {})[k] || {})[l] || "")].length > CT_MAX[k]) out.push(`${k === "title" ? "titre" : "texte"} Contact (${l}) : ${CT_MAX[k]} caractères au plus`);
  return out;
}
async function mePhoto() {
  const r = await pickPhoto({ title: "Changer la photo de contact", hint: "La photo quitte son édition ou « Photos retirées » : sur le site, chaque photo n'apparaît qu'une fois. L'ancienne photo de contact va dans « Photos retirées ». Les photos de l'accueil et les photos vedettes des projets ne peuvent pas être prises.", why: homeWhy });
  if (r == null) return null;
  if (typeof r === "object") { const id = await uploadOne(r.files); if (id == null) return null; detach([id]); return id; }
  return takeForHome(r, false) ? r : null;
}
function editContact() {
  cur = "@contact"; $$("#pTree button[data-p]").forEach(b => b.setAttribute("aria-current", String(b.dataset.p === "@contact")));
  const s = C.site.data, H = C.home.data, ed = $("#pEd"), ct = () => (s.contact || {});
  const f = H.meFocus || {}, crop = H.meFocus != null, igs = (s.instagram || []).join(" ");
  const tx = (k, l) => esc(((ct()[k] || {})[l]) || "");
  ed.innerHTML = `<div class="stack">
    <div class="edbox"><h2 class="s" style="margin:0">Aperçu de la section Contact</h2><p class="hint" style="margin:0">Telle qu'elle s'affiche en bas de l'accueil (version française ; la version anglaise suit le même modèle). Mise à jour à chaque frappe ; rien n'est en ligne avant « Publier les modifications ».</p>
      <div class="ctp" id="ctPrev" aria-label="Aperçu de la section Contact"><div class="ctp-main"><h3 class="ctp-t" data-p="t"></h3><p class="ctp-p" data-p="p"></p><div class="ctp-ctas"><span class="ctp-btn pri">Demander une date</span><span class="ctp-btn">Écrire un courriel</span></div><dl class="ctp-list" data-p="list"></dl></div><div class="ctp-me"><div class="ctp-card" data-p="card"><img alt=""><span class="card-tag">Mamadou Beye</span></div></div></div></div>
    <div class="edbox"><h2 class="s" style="margin:0">Photo de contact</h2><p class="hint" style="margin:0">La carte portrait à droite de la section. Remplacez-la par n'importe quelle photo du portfolio, des « Photos retirées » ou de votre ordinateur : l'ancienne va dans « Photos retirées ».</p>
      <div class="row"><span class="hint" data-o="me">Photo ${n3(H.me)}</span><button class="btn small primary" type="button" data-a="me">Changer la photo…</button><button class="btn small" type="button" data-edit="${H.me}">Modifier la photo</button></div>
      <label class="check"><input type="checkbox" data-a="crop"${crop ? " checked" : ""}><span>Recadrer en portrait 2:3 (sinon la photo garde ses proportions)</span></label>
      <div class="two" data-o="crop" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px"${crop ? "" : " hidden"}>
        <label class="field"><span>Cadrage horizontal : <b data-o="x">${f.x ?? 50}</b> %</span><input type="range" min="0" max="100" step="1" data-a="x" value="${f.x ?? 50}"></label>
        <label class="field"><span>Cadrage vertical : <b data-o="y">${f.y ?? 50}</b> %</span><input type="range" min="0" max="100" step="1" data-a="y" value="${f.y ?? 50}"></label>
        <label class="field"><span>Zoom : <b data-o="z">${f.z ?? 100}</b> %</span><input type="range" min="100" max="300" step="5" data-a="z" value="${f.z ?? 100}"></label>
      </div></div>
    <div class="edbox"><h2 class="s" style="margin:0">Coordonnées</h2>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${field("Courriel de contact", `<input class="input" data-c="email" type="email" autocomplete="off" maxlength="200" value="${esc(s.email || "")}">`)}
        ${field("Téléphone affiché (vide = pas de téléphone)", `<input class="input" data-c="phone" inputmode="tel" maxlength="30" value="${esc(s.phone || "")}" placeholder="(438) 304-7844">`)}
        ${field("Téléphone, format international (lien d'appel)", `<input class="input" data-c="phoneHref" inputmode="tel" maxlength="16" value="${esc(s.phoneHref || "")}" placeholder="+14383047844">`)}
        ${field("Comptes Instagram (séparés par des espaces, 6 au plus)", `<input class="input" data-c="ig" autocomplete="off" value="${esc(igs)}" placeholder="bigbeezarr beyethekage">`)}
      </div><p class="err" data-o="err" style="margin:0" role="status"></p>
      <h3 class="s" style="margin:8px 0 0">Liens du site</h3><p class="hint" style="margin:0">Sous Instagram dans la section Contact, et en pied de page des pages de projet. 6 au plus.</p><div id="sLinks"></div></div>
    <div class="edbox"><h2 class="s" style="margin:0">Textes de la section</h2><p class="hint" style="margin:0">Un champ vide garde le texte d'origine (affiché en gris).</p>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
        ${field(`Titre (FR) <span class="hint" data-n="title-fr"></span>`, `<input class="input" data-t="title-fr" maxlength="${CT_MAX.title}" value="${tx("title", "fr")}" placeholder="${esc(CT_DEF.title.fr)}">`)}
        ${field(`Titre (EN) <span class="hint" data-n="title-en"></span>`, `<input class="input" data-t="title-en" maxlength="${CT_MAX.title}" value="${tx("title", "en")}" placeholder="${esc(CT_DEF.title.en)}">`)}
        ${field(`Texte (FR) <span class="hint" data-n="text-fr"></span>`, `<textarea class="input" data-t="text-fr" maxlength="${CT_MAX.text}" rows="3" placeholder="${esc(CT_DEF.text.fr)}">${tx("text", "fr")}</textarea>`)}
        ${field(`Texte (EN) <span class="hint" data-n="text-en"></span>`, `<textarea class="input" data-t="text-en" maxlength="${CT_MAX.text}" rows="3" placeholder="${esc(CT_DEF.text.en)}">${tx("text", "en")}</textarea>`)}
      </div></div></div>`;
  const P = k => $(`#ctPrev [data-p=${k}]`), im = $("#ctPrev img");
  const paintImg = () => {
    const i = H.me, m = C.meta && C.meta[i], q = H.meFocus;
    im.onerror = () => { if (!im.dataset.f) { im.dataset.f = 1; im.src = `../img/f/${n3(i)}.webp`; } }; delete im.dataset.f;
    im.src = LOCAL[i] || `../img/m/${n3(i)}.webp`;
    P("card").style.aspectRatio = q ? "2 / 3" : m ? `${m[0]} / ${m[1]}` : "2 / 3";
    const o = q ? `${q.x ?? 50}% ${q.y ?? 50}%` : "50% 50%"; im.style.objectPosition = o; im.style.transformOrigin = o; im.style.scale = q && q.z > 100 ? String(q.z / 100) : "";
    $("[data-o=me]", ed).textContent = `Photo ${n3(i)}`;
  };
  const paintTxt = () => {
    P("t").textContent = (ct().title || {}).fr || CT_DEF.title.fr; P("p").textContent = (ct().text || {}).fr || CT_DEF.text.fr;
    const L = P("list"); L.textContent = "";
    const row = (dt, vals) => { const d = document.createElement("div"); d.innerHTML = `<dt>${esc(dt)}</dt><dd>${vals.map(v => `<span class="ctp-v">${esc(v)}</span>`).join("")}</dd>`; L.appendChild(d); };
    row("E-mail", [s.email || "—"]); if (s.phone) row("Téléphone", [s.phone]); if ((s.instagram || []).length) row("Instagram", s.instagram.map(h => "@" + h)); if ((s.links || []).length) row("Liens", s.links.map(x => x.label));
    $$("[data-n]", ed).forEach(n => { const x = $(`[data-t=${n.dataset.n}]`, ed); n.textContent = `${[...x.value].length}/${x.maxLength}`; });
    $("[data-o=err]", ed).textContent = contactProbs().join(" · ");
  };
  paintImg(); paintTxt();
  linkEditor($("#sLinks"), () => s.links || [], l => { if (l.length) s.links = l; else delete s.links; mark("site"); paintTxt(); });
  // coordonnées
  const ci = k => $(`[data-c=${k}]`, ed);
  let autoHref = !s.phoneHref || s.phoneHref === phoneIntl(s.phone);
  ci("phoneHref").addEventListener("input", () => { autoHref = false; });
  $$("[data-c]", ed).forEach(x => x.addEventListener("input", () => {
    s.email = ci("email").value.trim();
    s.phone = ci("phone").value.trim();
    if (autoHref && x.dataset.c === "phone") ci("phoneHref").value = phoneIntl(s.phone);
    s.phoneHref = ci("phoneHref").value.trim().replace(/[\s().-]/g, "");
    const l = [...new Set(ci("ig").value.split(/[\s,;]+/).map(igHandle).filter(Boolean))];
    if (l.length) s.instagram = l; else delete s.instagram;
    mark("site"); paintTxt();
  }));
  ci("ig").addEventListener("change", () => { ci("ig").value = (s.instagram || []).join(" "); });
  // textes
  $$("[data-t]", ed).forEach(x => x.addEventListener("input", () => {
    const c = {};
    for (const k of ["title", "text"]) { const o = {}; for (const l of ["fr", "en"]) { const v = $(`[data-t=${k}-${l}]`, ed).value.replace(/\s+/g, " ").trim(); if (v) o[l] = v; } if (Object.keys(o).length) c[k] = o; }
    if (Object.keys(c).length) s.contact = c; else delete s.contact;
    mark("site"); paintTxt();
  }));
  // photo et cadrage
  $("[data-a=crop]", ed).addEventListener("change", ev => {
    if (ev.target.checked) H.meFocus = {}; else delete H.meFocus;
    $("[data-o=crop]", ed).hidden = !ev.target.checked; mark("home"); paintImg();
  });
  $$("input[type=range]", ed).forEach(el => el.addEventListener("input", () => {
    const q = (H.meFocus ||= {}), a = el.dataset.a, v = +el.value; if (v === (a === "z" ? 100 : 50)) delete q[a]; else q[a] = v;
    $(`[data-o=${a}]`, ed).textContent = v; mark("home"); paintImg();
  }));
  $("[data-a=me]", ed).addEventListener("click", async () => {
    const j = await mePhoto(); if (j == null) return;
    const old = H.me; H.me = j; unpub().push(old); if (H.meFocus) H.meFocus = {};
    prune(); mark("home"); mark(); refreshUnpubCount(); editContact();
    A().toast(`Photo de contact remplacée (cadrage remis au centre). L'ancienne photo ${old} est dans « Photos retirées ».`);
  });
}
// même contrôle que le serveur et build.py : chaque photo du catalogue sert une seule fois
function check() {
  const d = C.portfolio.data, H = C.home.data, seen = new Map(), probs = [];
  const add = (i, w) => { if (seen.has(i)) probs.push(`photo ${i} en double (${seen.get(i)} et ${w})`); else seen.set(i, w); };
  d.chapters.forEach(c => c.projects.forEach(p => { edsOf(p).forEach(e => { e.imgs.forEach(i => add(i, T2(p.title, "fr"))); if (e.feature) add(e.feature.img, T2(p.title, "fr")); }); if (p.lead) add(p.lead.img, T2(p.title, "fr")); }));
  (d.unpublished || []).forEach(i => add(i, "photos retirées"));
  [...H.hero, ...H.about, ...H.wall, H.me].forEach(i => add(i, "accueil"));
  if (C.meta) { const miss = Object.keys(C.meta).map(Number).filter(i => !seen.has(i)); if (miss.length) probs.push(`photo${miss.length > 1 ? "s" : ""} ${miss.slice(0, 5).join(", ")} plus nulle part`); }
  if (!H.hero.length) probs.push("l'ouverture de l'accueil est vide");
  d.chapters.forEach(c => c.projects.forEach(p => { if (!p.hidden && edsOf(p).some(e => !e.hidden) && !edsOf(p).some(e => !e.hidden && (e.imgs.length || e.feature))) probs.push(`« ${T2(p.title, "fr")} » est publié sans aucune photo publiée`); }));
  const feat = d.chapters.flatMap(c => c.projects).filter(p => p.featured && !p.hidden);
  if (feat.length > 5) probs.push("plus de 5 projets à la une");
  const ranks = d.chapters.flatMap(c => c.projects).filter(p => p.featured).map(p => p.featured); if (new Set(ranks).size !== ranks.length) probs.push("deux projets ont le même rang « à la une »");
  for (const [k, v] of Object.entries(H.heroLab || {})) { if ([...(v.name || "")].length > 40) probs.push(`carte ${k} : nom de 40 caractères au plus`); if (["fr", "en"].some(l => [...((v.meta || {})[l] || "")].length > 80)) probs.push(`carte ${k} : légende de 80 caractères au plus`); }
  probs.push(...contactProbs());
  return probs;
}
async function save(msg) {
  prune();
  const probs = check();
  if (probs.length) { A().toast("À corriger : " + probs.slice(0, 3).join(", "), true); return false; }
  if (!C.portfolio.data.unpublished || !C.portfolio.data.unpublished.length) delete C.portfolio.data.unpublished;
  const files = ["portfolio", "home", "site"].filter(k => C[k].dirty).map(file => ({ file, data: C[file].data, sha: C[file].sha }));
  if (!files.length) return true;
  let ok = false;
  $("#pSave").disabled = true; $("#pState").textContent = "Publication…";
  try {
    const r = await A().api("/api/admin/content", { method: "PUT", body: { files, message: typeof msg === "string" ? msg : `Administration : ${files.map(f => ({ portfolio: "portfolio", home: "accueil", site: "réglages du site" })[f.file]).join(", ")} mis à jour` } });
    for (const f of files) { C[f.file].sha = r.shas[f.file]; C[f.file].dirty = false; }
    ok = true;
    dirty = false; $("#pState").textContent = "Publié. Le site se met à jour dans quelques minutes."; A().toast("Modifications envoyées. Publication en cours.");
  } catch (e) {
    $("#pSave").disabled = false; $("#pState").textContent = "";
    A().toast(e.code === "content_changed" ? "Le contenu a changé entre-temps (par exemple l'ajout automatique de photos). Rechargez la page : vos modifications sont perdues si vous ne les refaites pas." : e.code === "invalid_content" ? "Contenu refusé : " + (e.data && e.data.detail) : A().errText(e), true);
  }
  return ok;
}
})();
