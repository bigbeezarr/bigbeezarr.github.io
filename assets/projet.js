/* Page de projet BIGBEEZARR : mosaïques justifiées, visionneuse plein écran (clavier, balayage, zoom), langue FR/EN. */
(() => {
  "use strict";
  const D = JSON.parse(document.getElementById("pdata").textContent);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, BASE = D.base || "../../";
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const pad = n => String(n).padStart(3, "0");
  const motion = store.get("bbz-motion", ""), calm = () => motion === "reduce" || (motion !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (motion === "reduce") root.classList.add("calm");

  /* langue : la même préférence que la page d'accueil */
  let lang = store.get("bbz-lang", (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en") === "en" ? "en" : "fr";
  const tr = (fr, en) => lang === "fr" ? fr : en;
  function applyLang() {
    root.lang = lang;
    const b = $("#lang"); b.textContent = lang === "fr" ? "EN" : "FR"; b.setAttribute("aria-label", tr("Switch to English", "Passer en français"));
    $$(".ph-open").forEach(labelTile);
    if (LB.open) LB.caption();
  }
  $("#lang").addEventListener("click", () => { lang = lang === "fr" ? "en" : "fr"; store.set("bbz-lang", lang); applyLang(); });

  /* images : trois tailles (480, 960, 1800 px), la plus petite qui suffit à l'écran */
  const VAR = [["s", 480], ["m", 960]], DPR = Math.min(2, window.devicePixelRatio || 1);
  function srcsetOf(i) {
    const [w, h] = D.img[i], L = Math.max(w, h), out = [];
    for (const [k, n] of VAR) if (L > n * 1.05) out.push(`${BASE}img/${k}/${pad(i)}.webp ${Math.round(w * n / L)}w`);
    out.push(`${BASE}img/f/${pad(i)}.webp ${w}w`); return out.join(", ");
  }
  const SEQ = [], ctx = {};
  D.eds.forEach(e => e.imgs.forEach((i, k) => { SEQ.push(i); ctx[i] = { e, n: k + 1, k: e.imgs.length }; }));
  const altOf = i => { const a = D.alt && D.alt[i], c = ctx[i], t = lang === "fr" ? c.e.t.fr : c.e.t.en; return a ? `${a[lang] || a.fr} · ${t}` : tr(`${t}, photo ${c.n} sur ${c.k}`, `${t}, photo ${c.n} of ${c.k}`); };
  function labelTile(b) { const i = +b.dataset.i, a = altOf(i); b.querySelector("img").alt = a; b.setAttribute("aria-label", tr("Agrandir : ", "Enlarge: ") + a); }
  function tile(i) {
    const [w, h, q, col] = D.img[i];
    const f = document.createElement("figure"); f.className = "ph";
    f.style.backgroundColor = col; f.style.backgroundImage = `url(data:image/webp;base64,${q})`;
    const b = document.createElement("button"); b.type = "button"; b.className = "ph-open"; b.dataset.i = i;
    const im = document.createElement("img"); im.width = w; im.height = h; im.loading = "lazy"; im.decoding = "async"; im.draggable = false;
    im.srcset = srcsetOf(i); im.className = "loading"; im.addEventListener("load", () => im.classList.remove("loading"), { once: true });
    b.appendChild(im); f.appendChild(b); labelTile(b);
    return f;
  }

  /* mosaïque : rangées choisies ensemble (programmation dynamique), chaque rangée remplit la largeur, aucune photo isolée */
  const PAT_D = ["SDS", "SSS", "DSS", "SSD", "SSSS", "SDSS", "SSDS", "DSD", "SS", "SD", "DS", "SSSSS", "DSSS", "SSSD", "SDSD", "S", "D"], PAT_M = ["SS", "SD", "DS", "S", "SSS", "D"];
  function rowHeight(bl, W, g) { let A = 0, Sg = 0; for (const b of bl) { if (b.t === "S") A += b.a; else { const st = 1 / (1 / b.a1 + 1 / b.a2); A += st; Sg += st; } } return (W - (bl.length - 1) * g + g * Sg) / A; }
  function layout(m) {
    const W = m.el.clientWidth; if (!W || Math.abs(W - m.w) < 1) return; m.w = W;
    const mob = W < 640, g = mob ? 6 : W < 1000 ? 8 : 10, T0 = mob ? 210 : W < 1000 ? 270 : 330, pats = mob ? PAT_M : PAT_D, t = m.t, n = t.length;
    const tgt = par => mob ? T0 : T0 * (par ? .82 : 1.22);
    const best = [[], []]; best[0][n] = best[1][n] = { c: 0 };
    for (let i = n - 1; i >= 0; i--) for (const par of [0, 1]) {
      let bb = null;
      for (const p of pats) {
        let need = 0; for (const c of p) need += c === "D" ? 2 : 1; if (i + need > n) continue;
        let k = i; const bl = [];
        for (const c of p) { if (c === "S") bl.push({ t: "S", a: t[k].a, k: [k++] }); else { bl.push({ t: "D", a1: t[k].a, a2: t[k + 1].a, k: [k, k + 1] }); k += 2; } }
        const H = rowHeight(bl, W, g), T = tgt(par), d = Math.log(H / T); let c = d * d * 4;
        for (const b of bl) if (b.t === "D" && (b.a1 < 1 || b.a2 < 1)) c += .4;
        if (H > T * 1.6 || H < T * .6) c += 12 + d * d * 20;
        const nx = best[1 - par][i + need]; if (!nx) continue;
        if (!bb || c + nx.c < bb.c) bb = { c: c + nx.c, r: { bl, H, need } };
      }
      best[par][i] = bb;
    }
    let i = 0, y = 0, par = 0;
    while (i < n) {
      const r = best[par][i].r, T = tgt(par); let H = r.H, cap = false; if (H > T * 1.7) { H = T * 1.2; cap = true; }
      const out = []; let x = 0;
      for (const b of r.bl) {
        if (b.t === "S") { const w = b.a * H; out.push([b.k[0], x, y, w, H]); x += w + g; }
        else { const st = 1 / (1 / b.a1 + 1 / b.a2), w = (H - g) * st, h1 = w / b.a1; out.push([b.k[0], x, y, w, h1], [b.k[1], x, y + h1 + g, w, H - g - h1]); x += w + g; }
      }
      const off = cap ? Math.max(0, (W - (x - g)) / 2) : 0;
      for (const [k, px, py, w, h] of out) Object.assign(t[k].f.style, { left: (px + off).toFixed(1) + "px", top: py.toFixed(1) + "px", width: w.toFixed(1) + "px", height: h.toFixed(1) + "px" });
      y += H + g; i += r.need; par = 1 - par;
    }
    m.el.style.height = Math.max(0, y - g).toFixed(1) + "px";
  }
  const mosaics = $$(".gallery[data-imgs]").map(el => {
    const ids = el.dataset.imgs.split(",").map(Number);
    const m = { el, w: 0, t: ids.map(i => { const f = tile(i); el.appendChild(f); return { i, f, a: D.img[i][0] / D.img[i][1] }; }) };
    return m;
  });
  const ro = new ResizeObserver(es => es.forEach(e => { const m = mosaics.find(x => x.el === e.target); if (m) layout(m); }));
  mosaics.forEach(m => ro.observe(m.el));
  /* les cartes « autres projets » et la couverture prennent leurs images ici (pas d'attribut style : la CSP l'interdit) */
  $$("[data-cover]").forEach(el => { const i = +el.dataset.cover, [, , q, col] = D.img[i] || []; if (q) { el.style.backgroundColor = col; el.style.backgroundImage = `url(data:image/webp;base64,${q})`; } });
  $$("img[data-i]").forEach(im => { const i = +im.dataset.i; if (D.img[i]) { im.srcset = srcsetOf(i); } });

  /* visionneuse */
  const lb = $("#lb"), lbImg = $("#lbImg"), lbFull = $("#lbFull");
  const Z = { z: 1, x: 0, y: 0,
    apply() { lbFull.style.transform = this.z > 1 ? `translate(${this.x.toFixed(1)}px,${this.y.toFixed(1)}px) scale(${this.z.toFixed(3)})` : ""; lb.classList.toggle("zoomed", this.z > 1); },
    reset() { this.z = 1; this.x = this.y = 0; this.apply(); },
    at(z, cx, cy) { const r = lbImg.getBoundingClientRect(), ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2), nz = Math.max(1, Math.min(4, z)), k = nz / this.z;
      this.x = ox - (ox - this.x) * k; this.y = oy - (oy - this.y) * k; this.z = nz; if (nz <= 1.01) { this.z = 1; this.x = this.y = 0; }
      const mx = r.width * (this.z - 1) / 2, my = r.height * (this.z - 1) / 2; this.x = Math.max(-mx, Math.min(mx, this.x)); this.y = Math.max(-my, Math.min(my, this.y)); this.apply(); } };
  const LB = { open: false, pos: 0, last: null,
    fit() { const [w, h] = D.img[SEQ[this.pos]], vw = innerWidth, vh = innerHeight, px = vw < 700 ? 0 : 72, top = vw < 700 ? 64 : 70, bot = 64;
      const s = Math.min((vw - px * 2) / w, (vh - top - bot) / h), W = w * s, H = h * s; Object.assign(lbImg.style, { width: W + "px", height: H + "px", left: (vw - W) / 2 + "px", top: top + (vh - top - bot - H) / 2 + "px" }); },
    show(pos) { this.pos = pos; if (!this.open) { this.last = document.activeElement; this.open = true; lb.hidden = false; root.style.overflow = "hidden"; } this.load(); setTimeout(() => $("#lbClose").focus({ preventScroll: true }), 30); },
    load() { const i = SEQ[this.pos], [, , q, col] = D.img[i]; Z.reset(); this.fit();
      lbImg.style.backgroundColor = col; lbImg.style.backgroundImage = `url(data:image/webp;base64,${q})`;
      lbFull.classList.remove("on"); lbFull.src = `${BASE}img/f/${pad(i)}.webp`; lbFull.decode().catch(() => {}).then(() => { if (SEQ[this.pos] === i) lbFull.classList.add("on"); });
      this.caption(); $("#lbPrev").disabled = this.pos === 0; $("#lbNext").disabled = this.pos === SEQ.length - 1;
      const nx = SEQ[this.pos + 1]; if (nx != null) { const im = new Image(); im.src = `${BASE}img/f/${pad(nx)}.webp`; } },
    caption() { const i = SEQ[this.pos], c = ctx[i]; $("#lbTitle").textContent = lang === "fr" ? c.e.t.fr : c.e.t.en; { const cn = $("#lbCount"); cn.textContent = ""; const b = document.createElement("b"); b.textContent = pad(this.pos + 1); cn.append(b, ` / ${pad(SEQ.length)}`); } lbFull.alt = altOf(i); },
    go(d) { const np = this.pos + d; if (np < 0 || np >= SEQ.length) return; this.pos = np; this.load(); },
    hide() { if (!this.open) return; this.open = false; lb.hidden = true; root.style.overflow = ""; lbFull.removeAttribute("src"); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); if (this.last && this.last.focus) this.last.focus({ preventScroll: true }); } };
  document.addEventListener("click", e => { const b = e.target.closest(".ph-open"); if (!b) return; e.preventDefault(); LB.show(SEQ.indexOf(+b.dataset.i)); });
  $("#lbClose").addEventListener("click", () => LB.hide());
  $("#lbPrev").addEventListener("click", () => LB.go(-1));
  $("#lbNext").addEventListener("click", () => LB.go(1));
  $("#lbZoom").addEventListener("click", () => { const r = lbImg.getBoundingClientRect(); if (Z.z > 1) Z.reset(); else Z.at(2.5, r.left + r.width / 2, r.top + r.height / 2); });
  const fs = $("#lbFs"); fs.hidden = !(document.fullscreenEnabled && lb.requestFullscreen);
  fs.addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else lb.requestFullscreen().catch(() => {}); });
  document.addEventListener("fullscreenchange", () => { if (LB.open) LB.fit(); });
  addEventListener("resize", () => { if (LB.open) LB.fit(); });
  document.addEventListener("keydown", e => {
    if (!LB.open) return;
    if (e.key === "Escape") { e.preventDefault(); if (Z.z > 1) Z.reset(); else LB.hide(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); LB.go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); LB.go(-1); }
    else if (e.key === "+" || e.key === "=") { const r = lbImg.getBoundingClientRect(); Z.at(Z.z * 1.5, r.left + r.width / 2, r.top + r.height / 2); }
    else if (e.key === "-") { const r = lbImg.getBoundingClientRect(); Z.at(Z.z / 1.5, r.left + r.width / 2, r.top + r.height / 2); }
    else if (e.key === "0") Z.reset();
    else if ((e.key === "f" || e.key === "F") && !fs.hidden) fs.click();
    else if (e.key === "Tab") { const f = $$("#lb button:not([disabled])").filter(b => b.offsetParent !== null); const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  });
  /* gestes : balayer pour changer de photo, vers le bas pour fermer, pincer ou toucher deux fois pour zoomer */
  { const st = $("#lbStage"), pts = new Map(); let g = null, lastTap = null;
    const mid = () => { const a = [...pts.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
    st.addEventListener("pointerdown", e => { if (!LB.open) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); st.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const m = mid(); g = { pinch: true, d0: m.d, z0: Z.z, x0z: Z.x, y0z: Z.y, mx: m.x, my: m.y }; return; }
      g = { x0: e.clientX, y0: e.clientY, px: Z.x, py: Z.y, moved: false }; });
    st.addEventListener("pointermove", e => { if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (!g) return;
      if (g.pinch) { if (pts.size < 2) return; const m = mid(); Z.z = g.z0; Z.x = g.x0z; Z.y = g.y0z; Z.at(g.z0 * m.d / g.d0, g.mx, g.my); return; }
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0; if (Math.hypot(dx, dy) > 8) g.moved = true;
      if (Z.z > 1) { Z.x = g.px + dx; Z.y = g.py + dy; Z.apply(); } else if (g.moved && !calm()) lbImg.style.transform = `translate(${dx}px,${Math.max(0, dy) * .6}px)`; });
    const end = e => { pts.delete(e.pointerId); if (!g) return; const d = g; g = null; lbImg.style.transform = "";
      if (d.pinch) { if (Z.z < 1.06) Z.reset(); return; }
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0, now = performance.now(), r = lbImg.getBoundingClientRect(), on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!d.moved) { if (lastTap && now - lastTap < 360 && on) { lastTap = null; if (Z.z > 1) Z.reset(); else Z.at(2.5, e.clientX, e.clientY); return; } lastTap = now; if (!on) LB.hide(); return; }
      if (Z.z > 1) return;
      if (dy > 110 && Math.abs(dy) > Math.abs(dx)) LB.hide(); else if (dx < -60) LB.go(1); else if (dx > 60) LB.go(-1); };
    st.addEventListener("pointerup", end); st.addEventListener("pointercancel", end);
    st.addEventListener("wheel", e => { if (!LB.open) return; e.preventDefault(); Z.at(Z.z * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), e.clientX, e.clientY); }, { passive: false }); }
  /* statistiques sans témoin (comme la page d'accueil) : rien si le visiteur demande à ne pas être suivi */
  if (!(navigator.globalPrivacyControl === true || navigator.doNotTrack === "1")) {
    fetch(BASE + "galerie/config.js", { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(js => {
      const m = /BBZ_API\s*=\s*"(https:\/\/[^"\s]+)"/.exec(js); if (!m) return;
      const d = matchMedia("(pointer:coarse)").matches ? (Math.min(screen.width, screen.height) >= 700 ? "tablet" : "mobile") : "desktop";
      try { navigator.sendBeacon(m[1].replace(/\/+$/, "") + "/api/hit", JSON.stringify({ p: location.pathname, d })); } catch (e) {}
    }).catch(() => {});
  }
  applyLang();
})();
