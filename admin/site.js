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
const PAY = { none: "—", deposit_due: "Acompte demandé", deposit_paid: "Acompte payé", paid: "Payé", refunded: "Remboursé" };
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
        <div><div class="row" style="gap:8px"><b style="font-family:var(--font-d);font-size:1.1rem">${esc(b.first_name)} ${esc(b.last_name)}</b><span class="pill ${STATUS_PILL[b.status]}">${esc(STATUS[b.status] || b.status)}</span><span class="pill">${esc(TYPES[b.type] || b.type)}</span>${b.pay_status !== "none" ? `<span class="pill">${esc(PAY[b.pay_status])}</span>` : ""}</div>
        <p class="hint" style="margin:6px 0 0">${b.date ? "Date souhaitée : <b>" + esc(A().fmtDate(b.date)) + "</b> · " : ""}${esc([b.city, b.place].filter(Boolean).join(" · "))}${b.people ? " · " + esc(b.people) + " pers." : ""}${b.duration ? " · " + esc(b.duration) : ""}${b.budget ? " · budget " + esc(b.budget) : ""}</p>
        <p class="hint" style="margin:4px 0 0"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? ` · <a href="tel:${esc(b.phone.replace(/[^+\d]/g, ""))}">${esc(b.phone)}</a>` : ""} · reçue le ${esc(A().fmtWhen(b.created_at))}</p></div></div>
      <p style="margin:0;white-space:pre-wrap"></p>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
        <label class="field"><span>Statut</span><select class="input" data-k="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === b.status ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>Date</span><input class="input" type="date" data-k="date" value="${esc(b.date || "")}"></label>
        <label class="field"><span>Client</span><select class="input" data-k="client_id"><option value="">—</option>${CL.map(c => `<option value="${esc(c.id)}"${c.id === b.client_id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Prix (${esc(b.currency || "CAD")})</span><input class="input" inputmode="decimal" data-k="price" value="${esc(money(b.price_cents))}"></label>
        <label class="field"><span>Acompte</span><input class="input" inputmode="decimal" data-k="deposit" value="${esc(money(b.deposit_cents))}"></label>
        <label class="field"><span>Paiement</span><select class="input" data-k="pay_status">${Object.entries(PAY).map(([k, l]) => `<option value="${k}"${k === b.pay_status ? " selected" : ""}>${k === "none" ? "Aucun" : l}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span>Note privée</span><textarea class="input" data-k="note" maxlength="4000"></textarea></label>
      <div class="row"><button class="btn small primary" data-a="save" type="button">Enregistrer</button><a class="btn small" href="mailto:${esc(b.email)}?subject=${encodeURIComponent("Votre demande de prestation · BIGBEEZARR")}">Répondre</a><button class="btn small" data-a="client" type="button">Créer la fiche client</button><button class="btn small" data-a="pay" type="button">Lien de paiement</button><span class="sp" style="flex:1"></span><button class="btn small danger" data-a="del" type="button">Supprimer</button></div>`;
    el.querySelector("p[style*=pre-wrap]").textContent = b.description || "";
    el.querySelector("[data-k=note]").value = b.note || "";
    const val = k => el.querySelector(`[data-k=${k}]`).value;
    el.querySelector("[data-a=save]").addEventListener("click", async () => {
      const body = { status: val("status"), date: val("date") || null, client_id: val("client_id") || null, price_cents: cents(val("price")), deposit_cents: cents(val("deposit")), pay_status: val("pay_status"), note: val("note") };
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
    el.querySelector("[data-a=pay]").addEventListener("click", async () => {
      const kind = confirm("OK : lien pour l'acompte. Annuler : lien pour le montant total.") ? "deposit" : "full";
      try { const r = await A().api(`/api/admin/bookings/${b.id}/checkout`, { method: "POST", body: { kind } }); A().copy(r.url); A().toast("Lien de paiement copié."); }
      catch (e) { A().toast(e.code === "payments_not_configured" ? "Paiement en ligne non configuré (clés Stripe absentes). Voir worker/README.md." : e.code === "amount_not_set" ? "Indiquez d'abord le prix ou l'acompte, puis enregistrez." : A().errText(e), true); }
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
  const EV = { view: "Galerie ouverte", dl: "Photo téléchargée", zip: "Archive ZIP téléchargée", search: "Recherche par visage", forget: "Visage effacé", selection: "Sélection envoyée" };
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
let C = null, cur = null, dirty = false, sel = new Set();
const T2 = (v, l) => v == null ? "" : typeof v === "string" ? (l === "fr" ? v : v) : (v[l] ?? "");
const setT = (obj, k, fr, en) => { if (!fr && !en) { delete obj[k]; return; } obj[k] = fr === en ? fr : { fr, en: en || fr }; };
const projOf = id => { for (const c of C.portfolio.data.chapters) for (const p of c.projects) if (p.id === id) return { c, p }; return null; };
const edsOf = p => p.eds || [p];
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
  body.innerHTML = `<div class="ptree"><nav class="tree" id="pTree" aria-label="Chapitres et projets"></nav><div id="pEd"><div class="box"><p>Choisissez un projet à gauche. Chaque modification est enregistrée dans le dépôt GitHub du site, puis la publication automatique reconstruit le site (quelques minutes).</p><p class="hint">Réglages généraux : coordonnées, types de prestation, validation des pages légales.</p><button class="btn small" id="pSite" type="button">Réglages du site</button></div></div></div>`;
  const tree = $("#pTree");
  C.portfolio.data.chapters.forEach(c => {
    tree.insertAdjacentHTML("beforeend", `<p class="ch">${esc(T2(c.name, "fr"))}</p>`);
    c.projects.forEach(p => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.p = p.id;
      const n = edsOf(p).reduce((s, e) => s + e.imgs.length, 0);
      b.innerHTML = `${esc(T2(p.title, "fr"))}${p.featured ? " ★" : ""}${p.hidden ? " (masqué)" : ""}<br><span class="hint">${n} photos${p.eds ? " · " + p.eds.length + " éditions" : ""}</span>`;
      b.setAttribute("aria-current", String(cur === p.id));
      b.addEventListener("click", () => editProject(p.id));
      tree.appendChild(b);
    });
  });
  $("#pSite").addEventListener("click", editSite);
  if (cur) editProject(cur);
}
const field = (label, html, w) => `<label class="field"${w ? ' style="grid-column:1/-1"' : ""}><span>${label}</span>${html}</label>`;
const inp = (k, v, attrs = "") => `<input class="input" data-k="${k}" value="${esc(v ?? "")}" ${attrs}>`;
const area = (k, v) => `<textarea class="input" data-k="${k}">${esc(v ?? "")}</textarea>`;
function editProject(id) {
  cur = id; sel.clear();
  $$("#pTree button").forEach(b => b.setAttribute("aria-current", String(b.dataset.p === id)));
  const { p } = projOf(id), s = p.series || {};
  const ed = $("#pEd");
  ed.innerHTML = `<div class="stack">
    <div class="edbox"><h2 class="s">${esc(T2(p.title, "fr"))}</h2>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${field("Titre (FR)", inp("title_fr", T2(p.title, "fr"), 'maxlength="120"'))}${field("Titre (EN)", inp("title_en", T2(p.title, "en"), 'maxlength="120"'))}
        ${field("Lieu affiché", inp("place", p.place, 'maxlength="80"'))}${field("Ville", `<select class="input" data-k="city">${[["sn", "Dakar / Sénégal"], ["mtl", "Montréal"], ["mix", "Les deux"], ["none", "Non précisé"]].map(([k, l]) => `<option value="${k}"${p.city === k ? " selected" : ""}>${l}</option>`).join("")}</select>`)}
        ${field("Rôle (FR)", inp("role_fr", T2(p.role, "fr") || "Photographie"))}${field("Rôle (EN)", inp("role_en", T2(p.role, "en") || "Photography"))}
        ${field("Description (FR)", area("sub_fr", T2(p.sub, "fr")), 1)}${field("Description (EN)", area("sub_en", T2(p.sub, "en")), 1)}
        ${field("À la une (rang 1 à 5, vide = non)", inp("featured", p.featured || "", 'type="number" min="1" max="5"'))}${field("Photo de couverture (numéro)", inp("cover", p.cover ?? "", 'type="number" min="0"'))}
        ${field("Instagram (comptes séparés par des virgules)", inp("ig", (p.ig || []).join(", ")), 1)}
      </div>
      <div class="row"><label class="check"><input type="checkbox" data-k="page"${p.page === false ? "" : " checked"}><span>Page de projet dédiée</span></label><label class="check"><input type="checkbox" data-k="hidden"${p.hidden ? " checked" : ""}><span>Masquer ce projet du site</span></label></div>
    </div>
    <div class="edbox"><h2 class="s">Historique de l'événement</h2>
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
    <div class="row"><button class="btn small" id="pAddEd" type="button">Ajouter une édition</button><span class="hint">Pour retirer une photo du site, déplacez-la vers une autre édition ou masquez le projet : chaque photo publiée doit appartenir à une rubrique.</span></div>
  </div>`;
  $$("[data-k]", ed).forEach(el => el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => readProject(p)));
  $("#pAddEd").addEventListener("click", () => {
    if (!p.eds) { p.eds = [{ year: p.year || "", imgs: p.imgs || [] }]; ["imgs", "feature", "order"].forEach(k => { if (k in p) { if (k !== "imgs") p.eds[0][k] = p[k]; delete p[k]; } }); }
    p.eds.unshift({ year: String(new Date().getFullYear()), imgs: [] }); mark(); paintEds(p);
  });
  paintEds(p);
}
function readProject(p) {
  const ed = $("#pEd"), v = k => { const el = $(`[data-k=${k}]`, ed); return el.type === "checkbox" ? el.checked : el.value.trim(); };
  setT(p, "title", v("title_fr"), v("title_en")); p.place = v("place"); p.city = v("city");
  setT(p, "role", v("role_fr"), v("role_en")); if (T2(p.role, "fr") === "Photographie") delete p.role;
  setT(p, "sub", v("sub_fr"), v("sub_en"));
  const f = parseInt(v("featured"), 10); if (f >= 1 && f <= 5) p.featured = f; else delete p.featured;
  const cv = v("cover"); if (cv !== "" && !isNaN(+cv)) p.cover = +cv; else delete p.cover;
  const ig = v("ig").split(/[,\s]+/).map(h => h.replace(/^@/, "")).filter(h => /^[A-Za-z0-9._]{1,30}$/.test(h)); if (ig.length) p.ig = ig; else delete p.ig;
  if (v("page")) delete p.page; else p.page = false;
  if (v("hidden")) p.hidden = true; else delete p.hidden;
  const known = parseInt(v("known"), 10), unit = v("unit"), missed = v("missed").split("\n").map(x => x.trim()).filter(Boolean);
  const s = {}; if (known > 0) s.known = known; if (unit) s.unit = unit; if (v("min")) s.min = true; if (v("verify")) s.verify = true;
  setT(s, "note", v("note_fr"), v("note_en")); if (missed.length) s.missed = missed.map(label => ({ label }));
  if (Object.keys(s).length) p.series = s; else delete p.series;
  mark();
}
function paintEds(p) {
  const box = $("#pEds"); box.textContent = "";
  const eds = edsOf(p);
  eds.forEach((e, ei) => {
    const el = document.createElement("div"); el.className = "edbox";
    const named = e.brand ? `Marque ${e.brand}` : e.look ? `Look ${e.look}` : "";
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="s" style="margin:0">${p.eds ? `Édition ${ei + 1}` : "Photos"}${named ? " · " + esc(named) : ""} <span class="hint">(${e.imgs.length} photos)</span></h3>${p.eds && !e.imgs.length ? '<button class="btn small danger" type="button" data-a="rm">Retirer cette édition vide</button>' : ""}</div>
      ${p.eds ? `<div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">${field("Année", inp("year", e.year, 'maxlength="12"'))}${field("Volume / libellé (FR)", inp("label_fr", T2(e.label, "fr"), 'maxlength="80"'))}${field("Libellé (EN)", inp("label_en", T2(e.label, "en"), 'maxlength="80"'))}${field("Lieu", inp("place", e.place, 'maxlength="80"'))}${field("Sous-titre (FR)", inp("sub_fr", T2(e.sub, "fr")), 1)}${field("Sous-titre (EN)", inp("sub_en", T2(e.sub, "en")), 1)}</div>` : ""}
      <label class="check"><input type="checkbox" data-k="fixed"${e.order === "fixed" ? " checked" : ""}><span>Garder mon ordre (sinon, rangement automatique par couleur)</span></label>
      <div class="thumbs" role="list"></div>
      <div class="row"><span class="hint" data-n></span><button class="btn small" type="button" data-a="move">Déplacer la sélection vers…</button><button class="btn small" type="button" data-a="alt">Texte alternatif…</button></div>`;
    const th = el.querySelector(".thumbs");
    const alt = C.portfolio.data.alt || {};
    e.imgs.forEach((i, k) => {
      const t = document.createElement("div"); t.className = "th" + (sel.has(i) ? " on" : ""); t.draggable = true; t.dataset.i = i; t.setAttribute("role", "listitem"); t.tabIndex = 0;
      t.innerHTML = `<img alt="" loading="lazy" src="../img/s/${String(i).padStart(3, "0")}.webp"><span class="no">${String(i).padStart(3, "0")}</span>${alt[i] ? '<span class="al" title="Texte alternatif rédigé"></span>' : ""}`;
      t.firstChild.addEventListener("error", ev => { const im = ev.target; if (!im.dataset.f) { im.dataset.f = 1; im.src = `../img/f/${String(i).padStart(3, "0")}.webp`; } }, { once: true });
      t.setAttribute("aria-label", `Photo ${i}${alt[i] ? " : " + T2(alt[i], "fr") : ""}`);
      t.addEventListener("click", () => { sel.has(i) ? sel.delete(i) : sel.add(i); t.classList.toggle("on", sel.has(i)); upd(); });
      t.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", String(k)); t.classList.add("drag"); });
      t.addEventListener("dragend", () => t.classList.remove("drag"));
      t.addEventListener("dragover", ev => { ev.preventDefault(); t.classList.add("over"); });
      t.addEventListener("dragleave", () => t.classList.remove("over"));
      t.addEventListener("drop", ev => { ev.preventDefault(); t.classList.remove("over"); const from = +ev.dataTransfer.getData("text/plain"); if (isNaN(from) || from === k) return; const [m] = e.imgs.splice(from, 1); e.imgs.splice(k, 0, m); e.order = "fixed"; mark(); paintEds(p); });
      th.appendChild(t);
    });
    const upd = () => { el.querySelector("[data-n]").textContent = sel.size ? `${sel.size} sélectionnée(s)` : "Touchez des photos pour les sélectionner ; glissez-les pour changer l'ordre."; };
    upd();
    $$("[data-k]", el).forEach(x => x.addEventListener(x.type === "checkbox" ? "change" : "input", () => {
      const v = k => { const z = $(`[data-k=${k}]`, el); return z ? (z.type === "checkbox" ? z.checked : z.value.trim()) : ""; };
      if (p.eds) { e.year = v("year"); setT(e, "label", v("label_fr"), v("label_en")); if (v("place")) e.place = v("place"); else delete e.place; setT(e, "sub", v("sub_fr"), v("sub_en")); }
      if (v("fixed")) e.order = "fixed"; else delete e.order;
      mark();
    }));
    const rm = el.querySelector("[data-a=rm]"); if (rm) rm.addEventListener("click", () => { p.eds.splice(ei, 1); mark(); paintEds(p); });
    el.querySelector("[data-a=move]").addEventListener("click", () => moveSel(p));
    el.querySelector("[data-a=alt]").addEventListener("click", () => editAlt());
    box.appendChild(el);
  });
}
function moveSel(p) {
  if (!sel.size) { A().toast("Sélectionnez d'abord des photos.", true); return; }
  const targets = [];
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach((e, k) => targets.push({ q, e, label: `${T2(q.title, "fr")}${q.eds ? " · " + (e.brand || (e.look ? "Look " + e.look : "")) + " " + (e.year || "") + " " + T2(e.label, "fr") : ""}` }))));
  const pick = prompt("Déplacer vers (numéro) :\n" + targets.map((x, k) => `${k + 1}. ${x.label}`).join("\n"));
  const t = targets[(+pick || 0) - 1]; if (!t) return;
  C.portfolio.data.chapters.forEach(c => c.projects.forEach(q => edsOf(q).forEach(e => { e.imgs = e.imgs.filter(i => !sel.has(i)); })));
  t.e.imgs.push(...sel); sel.clear(); mark(); editProject(cur);
}
function editAlt() {
  if (sel.size !== 1) { A().toast("Sélectionnez une seule photo pour écrire son texte alternatif.", true); return; }
  const i = [...sel][0], alt = (C.portfolio.data.alt ||= {}), cur2 = alt[i] || {};
  const fr = prompt(`Photo ${i} : que montre-t-elle ? (FR, une phrase, sans nommer une personne que vous ne connaissez pas)`, T2(cur2, "fr")); if (fr === null) return;
  const en = prompt(`Photo ${i} : same description in English`, T2(cur2, "en")); if (en === null) return;
  if (!fr.trim() && !en.trim()) delete alt[i]; else alt[i] = { fr: fr.trim(), en: (en || fr).trim() };
  mark(); editProject(cur);
}
function editSite() {
  const s = C.site.data, ed = $("#pEd");
  ed.innerHTML = `<div class="edbox"><h2 class="s">Réglages du site</h2><div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
    ${field("Courriel de contact", inp("email", s.email, 'type="email"'))}${field("Téléphone affiché", inp("phone", s.phone))}${field("Téléphone (format international)", inp("phoneHref", s.phoneHref))}${field("Adresse du serveur (vide = automatique)", inp("api", s.api, 'placeholder="https://…"'))}${field("Clé publique Turnstile (facultatif, avec le secret TURNSTILE_SECRET du serveur)", inp("turnstile", s.turnstile, 'placeholder="0x4AAAA…" autocomplete="off"'))}</div>
    <label class="check"><input type="checkbox" data-k="legalOk"${s.legalOk ? " checked" : ""}><span>Les pages Confidentialité et Conditions ont été validées par un juriste (retire la mention « version de travail »)</span></label>
    <label class="check"><input type="checkbox" data-k="projectPages"${s.projectPages !== false ? " checked" : ""}><span>Pages de projet dédiées</span></label>
    <p class="hint" style="margin:0">Types de prestation proposés dans le formulaire : ${(s.booking && s.booking.types || []).map(k => esc(TYPES[k] || k)).join(", ")}.</p></div>`;
  $$("[data-k]", ed).forEach(x => x.addEventListener(x.type === "checkbox" ? "change" : "input", () => {
    const v = k => { const z = $(`[data-k=${k}]`, ed); return z.type === "checkbox" ? z.checked : z.value.trim(); };
    s.email = v("email"); s.phone = v("phone"); s.phoneHref = v("phoneHref"); s.api = v("api"); s.legalOk = v("legalOk"); s.projectPages = v("projectPages");
    if (v("turnstile")) s.turnstile = v("turnstile"); else delete s.turnstile;
    mark("site");
  }));
}
function check(d) {
  const seen = new Set(), probs = [];
  d.chapters.forEach(c => c.projects.forEach(p => edsOf(p).forEach(e => e.imgs.forEach(i => { if (seen.has(i)) probs.push(`photo ${i} en double`); seen.add(i); }))));
  const feat = d.chapters.flatMap(c => c.projects).filter(p => p.featured && !p.hidden);
  if (feat.length > 5) probs.push("plus de 5 projets à la une");
  return probs;
}
async function save() {
  const probs = check(C.portfolio.data);
  if (probs.length) { A().toast("À corriger : " + probs.slice(0, 3).join(", "), true); return; }
  $("#pSave").disabled = true; $("#pState").textContent = "Publication…";
  try {
    if (C.portfolio.dirty) { const r = await A().api("/api/admin/content", { method: "PUT", body: { file: "portfolio", data: C.portfolio.data, sha: C.portfolio.sha, message: "Administration : portfolio mis à jour" } }); C.portfolio.sha = r.sha; C.portfolio.dirty = false; }
    if (C.site.dirty) { const r2 = await A().api("/api/admin/content", { method: "PUT", body: { file: "site", data: C.site.data, sha: C.site.sha, message: "Administration : réglages du site" } }); C.site.sha = r2.sha; C.site.dirty = false; }
    dirty = false; $("#pState").textContent = "Publié. Le site se met à jour dans quelques minutes."; A().toast("Modifications envoyées. Publication en cours.");
  } catch (e) {
    $("#pSave").disabled = false; $("#pState").textContent = "";
    A().toast(e.code === "content_changed" ? "Le contenu a changé entre-temps (par exemple l'ajout automatique de photos). Rechargez la page : vos modifications sont perdues si vous ne les refaites pas." : e.code === "invalid_content" ? "Contenu refusé : " + (e.data && e.data.detail) : A().errText(e), true);
  }
}
})();
