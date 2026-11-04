// Visionneuse plein écran de l'administration : photos des galeries client (aperçus signés 2048 px) et du portfolio.
// BBZV.open([{ src, title, sub }], index) ; clavier (← → Échap + − 0 F), balayage, pincer ou toucher deux fois pour zoomer.
(() => {
"use strict";
const $ = s => document.querySelector(s);
const el = document.createElement("div");
el.className = "vw"; el.id = "vw"; el.hidden = true;
el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Visionneuse");
const ic = d => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
el.innerHTML = `<div class="vw-top"><p class="vw-t" id="vwT" aria-live="polite"></p><button class="vw-b" type="button" id="vwZ" aria-label="Zoom (+ / −)">${ic("M8.6 3a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8.6 3zM12.8 12.8 17 17M6.2 8.6h4.8M8.6 6.2V11")}</button><button class="vw-b" type="button" id="vwF" aria-label="Plein écran (F)">${ic("M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4")}</button><button class="vw-b" type="button" id="vwX" aria-label="Fermer (Échap)">${ic("M5 5l10 10M15 5 5 15")}</button></div>
<div class="vw-stage" id="vwS"><img id="vwI" alt="" draggable="false"></div>
<button class="vw-b vw-nav p" type="button" id="vwP" aria-label="Photo précédente (←)">${ic("M12.5 4.5 7 10l5.5 5.5")}</button><button class="vw-b vw-nav n" type="button" id="vwN" aria-label="Photo suivante (→)">${ic("M7.5 4.5 13 10l-5.5 5.5")}</button>`;
document.body.appendChild(el);
const img = $("#vwI"), st = $("#vwS");
let L = [], k = 0, last = null;
const Z = { z: 1, x: 0, y: 0,
  apply() { img.style.transform = this.z > 1 ? `translate(${this.x.toFixed(1)}px,${this.y.toFixed(1)}px) scale(${this.z.toFixed(3)})` : ""; el.classList.toggle("zoomed", this.z > 1); },
  reset() { this.z = 1; this.x = this.y = 0; this.apply(); },
  at(z, cx, cy) { const r = st.getBoundingClientRect(), ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2), nz = Math.max(1, Math.min(5, z)), f = nz / this.z;
    this.x = ox - (ox - this.x) * f; this.y = oy - (oy - this.y) * f; this.z = nz; if (nz <= 1.01) { this.reset(); return; }
    const mx = r.width * (this.z - 1) / 2, my = r.height * (this.z - 1) / 2; this.x = Math.max(-mx, Math.min(mx, this.x)); this.y = Math.max(-my, Math.min(my, this.y)); this.apply(); } };
function paint() {
  const it = L[k]; Z.reset(); img.classList.remove("on");
  img.onload = () => img.classList.add("on"); img.onerror = () => { if (it.alt && img.src !== new URL(it.alt, location.href).href) img.src = it.alt; };
  img.src = it.src; img.alt = it.title || "";
  $("#vwT").innerHTML = `<b>${k + 1} / ${L.length}</b> <span></span>`; $("#vwT span").textContent = [it.title, it.sub].filter(Boolean).join(" · ");
  $("#vwP").disabled = k === 0; $("#vwN").disabled = k === L.length - 1;
  const nx = L[k + 1]; if (nx) { const pre = new Image(); pre.src = nx.src; }
}
function open(list, i = 0) {
  L = list.filter(x => x && x.src); if (!L.length) return; k = Math.max(0, Math.min(L.length - 1, i));
  last = document.activeElement; el.hidden = false; document.documentElement.style.overflow = "hidden"; paint(); setTimeout(() => $("#vwX").focus(), 20);
}
function close() { if (el.hidden) return; el.hidden = true; img.removeAttribute("src"); document.documentElement.style.overflow = ""; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); if (last && last.focus) last.focus(); }
const go = d => { const n = k + d; if (n < 0 || n >= L.length) return; k = n; paint(); };
const mid = () => { const r = st.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
$("#vwX").addEventListener("click", close); $("#vwP").addEventListener("click", () => go(-1)); $("#vwN").addEventListener("click", () => go(1));
$("#vwZ").addEventListener("click", () => Z.z > 1 ? Z.reset() : Z.at(2.5, ...mid()));
$("#vwF").hidden = !(document.fullscreenEnabled && el.requestFullscreen);
$("#vwF").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : el.requestFullscreen().catch(() => {}));
document.addEventListener("keydown", e => {
  if (el.hidden) return;
  const K = { Escape: () => Z.z > 1 ? Z.reset() : close(), ArrowRight: () => go(1), ArrowLeft: () => go(-1), "+": () => Z.at(Z.z * 1.5, ...mid()), "=": () => Z.at(Z.z * 1.5, ...mid()), "-": () => Z.at(Z.z / 1.5, ...mid()), "0": () => Z.reset(), f: () => $("#vwF").click(), F: () => $("#vwF").click() }[e.key];
  if (K) { e.preventDefault(); e.stopPropagation(); K(); }
  else if (e.key === "Tab") { const f = [...el.querySelectorAll("button:not([disabled]):not([hidden])")]; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
}, true);
{ const pts = new Map(); let g = null, tap = 0;
  st.addEventListener("pointerdown", e => { pts.set(e.pointerId, [e.clientX, e.clientY]); st.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; g = { pinch: 1, d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: Z.z, x0: Z.x, y0: Z.y, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; return; }
    g = { sx: e.clientX, sy: e.clientY, px: Z.x, py: Z.y, moved: false }; });
  st.addEventListener("pointermove", e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (!g) return;
    if (g.pinch) { if (pts.size < 2) return; const [a, b] = [...pts.values()]; Z.z = g.z0; Z.x = g.x0; Z.y = g.y0; Z.at(g.z0 * (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1) / g.d0, g.cx, g.cy); return; }
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy; if (Math.hypot(dx, dy) > 8) g.moved = true;
    if (Z.z > 1) { Z.x = g.px + dx; Z.y = g.py + dy; Z.apply(); } });
  const end = e => { pts.delete(e.pointerId); if (!g) return; const d = g; g = null; if (d.pinch) { if (Z.z < 1.06) Z.reset(); return; }
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy, now = performance.now();
    if (!d.moved) { if (now - tap < 350) { tap = 0; Z.z > 1 ? Z.reset() : Z.at(2.5, e.clientX, e.clientY); } else { tap = now; if (e.target === st) setTimeout(() => { if (tap === now && Z.z === 1) close(); }, 360); } return; }
    if (Z.z > 1) return;
    if (dy > 110 && Math.abs(dy) > Math.abs(dx)) close(); else if (dx < -60) go(1); else if (dx > 60) go(-1); };
  st.addEventListener("pointerup", end); st.addEventListener("pointercancel", end);
  st.addEventListener("wheel", e => { e.preventDefault(); Z.at(Z.z * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), e.clientX, e.clientY); }, { passive: false }); }
window.BBZV = { open, close };
})();
// délégation : toute loupe « .zoom[data-src] » ouvre la visionneuse avec les loupes voisines (même grille)
document.addEventListener("click", e => {
  const z = e.target.closest && e.target.closest(".zoom[data-src]"); if (!z) return;
  e.preventDefault(); e.stopPropagation();
  const box = z.closest(".thumbs,.pgrid") || document, zs = [...box.querySelectorAll(".zoom[data-src]")];
  window.BBZV.open(zs.map(b => ({ src: b.dataset.src, alt: b.dataset.alt, title: b.dataset.t, sub: b.dataset.sub })), zs.indexOf(z));
}, true);
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest(".zoom[data-src]")) e.stopPropagation(); }, true);
