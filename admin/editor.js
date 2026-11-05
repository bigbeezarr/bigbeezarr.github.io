// Éditeur de photo de l'administration : recadrage libre ou à proportions fixes, zoom (curseur, pincer, molette),
// déplacement au glisser, rotation de 90°, redressement fin ±15°, miroir, avant/après.
// BBZE.open(source Blob, { title, okLabel, maxSide }) → Promise<HTMLCanvasElement | null> (null = annulé).
// Le résultat est rendu en pleine qualité depuis la source (au plus maxSide px sur le grand côté).
// Modèle : le cadre de recadrage est fixe à l'écran, la photo bouge dessous et le couvre toujours entièrement.
(() => {
"use strict";
const RATIOS = [["orig", "Original"], ["free", "Libre"], ["2:3", "2:3"], ["3:2", "3:2"], ["4:5", "4:5"], ["1:1", "1:1"], ["16:9", "16:9"]];
const ic = d => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const dlg = document.createElement("dialog");
dlg.className = "pe"; dlg.id = "peDlg"; dlg.setAttribute("aria-label", "Modifier la photo");
dlg.innerHTML = `<div class="pe-top"><button class="btn small" type="button" data-a="cancel">Annuler</button><p class="pe-t" id="peT"></p><button class="btn small" type="button" data-a="ba" aria-pressed="false" title="Avant / après (B)">Avant / après</button><button class="btn small primary" type="button" data-a="ok">Valider</button></div>
<div class="pe-stage" id="peS" tabindex="0" aria-label="Photo : glisser pour déplacer, pincer ou molette pour zoomer. Clavier : flèches déplacer, + − zoomer, Alt + flèches taille du cadre (Libre), [ ] tourner, H miroir, B avant/après, R réinitialiser, Entrée valider."><canvas id="peC"></canvas><span class="pe-ba" id="peBa" hidden>Avant</span></div>
<div class="pe-ctl">
  <div class="pe-ratios" role="radiogroup" aria-label="Proportions">${RATIOS.map(([k, l]) => `<button type="button" role="radio" class="chip" data-r="${k}" aria-checked="false">${l}</button>`).join("")}</div>
  <div class="pe-row"><button class="btn small" type="button" data-a="rl" aria-label="Tourner de 90° à gauche ([)">${ic("M4 8a6.5 6.5 0 1 1 1.6 6.6M4 3.5V8h4.5")}<span>90° gauche</span></button><button class="btn small" type="button" data-a="rr" aria-label="Tourner de 90° à droite (])">${ic("M16 8a6.5 6.5 0 1 0-1.6 6.6M16 3.5V8h-4.5")}<span>90° droite</span></button><button class="btn small" type="button" data-a="flip" aria-pressed="false" aria-label="Miroir horizontal (H)">${ic("M10 3v14M7.5 5.5 3 14h4.5zM12.5 5.5 17 14h-4.5z")}<span>Miroir</span></button><button class="btn small" type="button" data-a="reset" aria-label="Réinitialiser (R)">Réinitialiser</button></div>
  <label class="pe-sl"><span>Zoom <b id="peZv">100 %</b></span><input type="range" id="peZ" min="100" max="600" step="1" value="100"></label>
  <label class="pe-sl"><span>Redresser <b id="peAv">0°</b></span><input type="range" id="peA" min="-15" max="15" step="0.1" value="0"></label>
</div>`;
document.body.appendChild(dlg);
const q = s => dlg.querySelector(s), cv = q("#peC"), stage = q("#peS"), ctx = cv.getContext("2d");
let S = null, resolve = null, view = null; // view : bitmap réduit pour l'affichage en direct
const rad = d => d * Math.PI / 180;

function fresh() { return { ratio: "orig", q: 0, a: 0, flip: false, s: 0, cx: 0, cy: 0, f: null, before: false }; }
const theta = () => rad(S.q * 90 + S.a);
const srcWH = () => [S.bmp.width, S.bmp.height];
function ratioVal() {
  const [w, h] = srcWH(); if (S.ratio === "orig") return S.q % 2 ? h / w : w / h;
  if (S.ratio === "free") return S.f ? S.f.w / S.f.h : w / h;
  const [a, b] = S.ratio.split(":").map(Number); return a / b;
}
function box() { const r = stage.getBoundingClientRect(), pad = Math.max(16, Math.min(40, r.width * .05)); return { W: r.width, H: r.height, pad }; }
function fitFrame(r) { const { W, H, pad } = box(), mw = W - 2 * pad, mh = H - 2 * pad; let w = mw, h = w / r; if (h > mh) { h = mh; w = h * r; } return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
// échelle minimale pour que la photo tournée couvre le cadre (autour du centre de la photo)
function coverScale(f) {
  const [w, h] = srcWH(), t = theta(), c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return Math.max((f.w * c + f.h * s) / w, (f.w * s + f.h * c) / h);
}
// garde la photo sous tout le cadre : dans le repère de la photo, chaque axe se corrige séparément
function clamp() {
  const f = S.f, smin = coverScale(f); S.s = Math.max(smin, Math.min(smin * 6, S.s));
  const [w, h] = srcWH(), t = theta(), c = Math.cos(t), s = Math.sin(t), hw = w * S.s / 2, hh = h * S.s / 2;
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [x, y] of [[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]]) {
    const dx = x - S.cx, dy = y - S.cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }
  let du = 0, dv = 0;
  if (umax > hw) du = umax - hw; else if (umin < -hw) du = umin + hw;
  if (vmax > hh) dv = vmax - hh; else if (vmin < -hh) dv = vmin + hh;
  S.cx += du * c - dv * s; S.cy += du * s + dv * c;
}
function layout(keep) {
  const old = S.f; S.f = fitFrame(keep && old ? old.w / old.h : ratioVal());
  if (old && keep) { const k = S.f.w / old.w; S.s *= k; S.cx = S.f.x + (S.cx - old.x) * k; S.cy = S.f.y + (S.cy - old.y) * k; }
  else { S.cx = S.f.x + S.f.w / 2; S.cy = S.f.y + S.f.h / 2; S.s = 0; }
  clamp(); paint();
}
function drawImg(c, k, ox, oy, src) {
  const [w, h] = srcWH(); c.save(); c.translate(ox + S.cx * k, oy + S.cy * k); c.rotate(theta()); c.scale(S.flip ? -1 : 1, 1); c.scale(S.s * k, S.s * k);
  c.drawImage(src, 0, 0, src.width, src.height, -w / 2, -h / 2, w, h); c.restore();
}
function paint() {
  if (!S) return;
  const { W, H } = box(), d = devicePixelRatio || 1;
  if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + "px"; cv.style.height = H + "px"; }
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingQuality = "high";
  q("#peBa").hidden = !S.before;
  if (S.before) { // photo d'origine entière
    const [w, h] = srcWH(), k = Math.min((W - 32) / w, (H - 32) / h); ctx.drawImage(view, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k); return;
  }
  drawImg(ctx, 1, 0, 0, view);
  const f = S.f; ctx.fillStyle = "rgba(0,0,0,.62)";
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(f.x, f.y, f.w, f.h); ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1; ctx.beginPath();
  for (const t of [1 / 3, 2 / 3]) { ctx.moveTo(f.x + f.w * t, f.y); ctx.lineTo(f.x + f.w * t, f.y + f.h); ctx.moveTo(f.x, f.y + f.h * t); ctx.lineTo(f.x + f.w, f.y + f.h * t); }
  ctx.stroke(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(f.x, f.y, f.w, f.h);
  if (S.ratio === "free") { ctx.fillStyle = "#fff"; for (const [x, y] of corners()) ctx.fillRect(x - 6, y - 6, 12, 12); }
  const z = Math.round(S.s / coverScale(f) * 100); q("#peZ").value = z; q("#peZv").textContent = z + " %";
  q("#peA").value = S.a; q("#peAv").textContent = (Math.round(S.a * 10) / 10).toLocaleString("fr-CA") + "°";
  dlg.querySelectorAll("[data-r]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.r === S.ratio)));
  q("[data-a=flip]").setAttribute("aria-pressed", String(S.flip)); q("[data-a=ba]").setAttribute("aria-pressed", String(S.before));
}
const corners = () => { const f = S.f; return [[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]]; };
// zoom autour d'un point de l'écran (le point reste sous le doigt)
function zoomAt(ns, px, py) { const k = ns / S.s; S.cx = px + (S.cx - px) * k; S.cy = py + (S.cy - py) * k; S.s = ns; clamp(); paint(); }
const fc = () => [S.f.x + S.f.w / 2, S.f.y + S.f.h / 2];
function setRatio(r) {
  if (r === "free") { S.ratio = "free"; paint(); return; } // garde le cadre actuel, poignées visibles
  S.ratio = r; const keepS = S.s, keepC = [S.cx, S.cy], oldF = S.f; S.f = fitFrame(ratioVal());
  S.s = keepS * Math.min(S.f.w / oldF.w, S.f.h / oldF.h); S.cx = S.f.x + S.f.w / 2 + (keepC[0] - (oldF.x + oldF.w / 2)); S.cy = S.f.y + S.f.h / 2 + (keepC[1] - (oldF.y + oldF.h / 2)); clamp(); paint();
}
function rotate90(d) { S.q = (S.q + d + 4) % 4; if (S.ratio === "orig" || S.ratio === "free") { S.f = fitFrame(S.ratio === "free" ? S.f.h / S.f.w : ratioVal()); S.cx = S.f.x + S.f.w / 2; S.cy = S.f.y + S.f.h / 2; S.s = 0; } clamp(); paint(); }
function resizeFrame(dx, dy) { // Alt + flèches (mode Libre) : coin bas-droit
  const { W, H } = box(), f = S.f; f.w = Math.max(40, Math.min(W - f.x - 8, f.w + dx)); f.h = Math.max(40, Math.min(H - f.y - 8, f.h + dy)); clamp(); paint();
}
const act = {
  cancel: () => finish(null), ok: () => finish(render()), ba: () => { S.before = !S.before; paint(); },
  rl: () => rotate90(-1), rr: () => rotate90(1), flip: () => { S.flip = !S.flip; paint(); },
  reset: () => { const b = S.bmp; S = { ...fresh(), bmp: b }; layout(false); },
};
dlg.addEventListener("click", e => { const b = e.target.closest("[data-a],[data-r]"); if (!b || !S) return; if (b.dataset.r) setRatio(b.dataset.r); else act[b.dataset.a](); });
q("#peZ").addEventListener("input", e => { const [x, y] = fc(); zoomAt(coverScale(S.f) * e.target.value / 100, x, y); });
q("#peA").addEventListener("input", e => { S.a = +e.target.value; clamp(); paint(); });
dlg.addEventListener("cancel", e => { e.preventDefault(); finish(null); });
dlg.addEventListener("keydown", e => {
  if (!S || e.target.matches("input[type=range]") && e.key.startsWith("Arrow")) return;
  const st = e.shiftKey ? 50 : 10, [x, y] = fc();
  const K = {
    ArrowLeft: () => e.altKey && S.ratio === "free" ? resizeFrame(-st, 0) : (S.cx -= st, clamp(), paint()),
    ArrowRight: () => e.altKey && S.ratio === "free" ? resizeFrame(st, 0) : (S.cx += st, clamp(), paint()),
    ArrowUp: () => e.altKey && S.ratio === "free" ? resizeFrame(0, -st) : (S.cy -= st, clamp(), paint()),
    ArrowDown: () => e.altKey && S.ratio === "free" ? resizeFrame(0, st) : (S.cy += st, clamp(), paint()),
    "+": () => zoomAt(S.s * 1.15, x, y), "=": () => zoomAt(S.s * 1.15, x, y), "-": () => zoomAt(S.s / 1.15, x, y),
    "[": act.rl, "]": act.rr, h: act.flip, H: act.flip, b: act.ba, B: act.ba, r: act.reset, R: act.reset,
    ",": () => { S.a = Math.max(-15, S.a - .5); clamp(); paint(); }, ".": () => { S.a = Math.min(15, S.a + .5); clamp(); paint(); },
  }[e.key];
  if (K && (e.target === stage || !e.target.matches("button,input"))) { e.preventDefault(); K(); }
  else if (e.key === "Enter" && e.target === stage) { e.preventDefault(); act.ok(); }
});
{ // pointeurs : glisser = déplacer, deux doigts = zoom, coin du cadre (Libre) = redimensionner
  const pts = new Map(); let g = null;
  const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener("pointerdown", e => {
    if (!S || S.before) return; try { stage.setPointerCapture(e.pointerId); } catch {} const p = local(e); pts.set(e.pointerId, p);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; g = { pinch: 1, d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s0: S.s, cx0: S.cx, cy0: S.cy, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; return; }
    const ci = S.ratio === "free" ? corners().findIndex(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 24) : -1;
    if (ci >= 0) { const f = S.f, o = corners()[3 - ci]; g = { corner: 1, ox: o[0], oy: o[1] }; return; }
    g = { p, cx: S.cx, cy: S.cy };
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId) || !g) return; const p = local(e); pts.set(e.pointerId, p);
    if (g.pinch) { if (pts.size < 2) return; const [a, b] = [...pts.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      S.s = g.s0; S.cx = g.cx0 + m[0] - g.m[0]; S.cy = g.cy0 + m[1] - g.m[1]; zoomAt(g.s0 * (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1) / g.d0, m[0], m[1]); return; }
    if (g.corner) { const { W, H } = box(), x = Math.max(4, Math.min(W - 4, p[0])), y = Math.max(4, Math.min(H - 4, p[1]));
      const w = Math.abs(x - g.ox), h = Math.abs(y - g.oy); if (w < 40 || h < 40) return;
      S.f = { x: Math.min(x, g.ox), y: Math.min(y, g.oy), w, h }; clamp(); paint(); return; }
    S.cx = g.cx + p[0] - g.p[0]; S.cy = g.cy + p[1] - g.p[1]; clamp(); paint();
  });
  const end = e => { pts.delete(e.pointerId); if (g && g.corner) layout(true); if (!pts.size) g = null; else if (g && g.pinch) g = null; };
  stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  stage.addEventListener("wheel", e => { if (!S) return; e.preventDefault(); const p = local(e); zoomAt(S.s * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), p[0], p[1]); }, { passive: false });
}
addEventListener("resize", () => { if (S && dlg.open) layout(true); });

// rendu final : le cadre en pixels de la source (aucune perte tant que maxSide n'est pas atteint)
function render() {
  const f = S.f, k0 = 1 / S.s, ow = f.w * k0, oh = f.h * k0, lim = Math.min(1, S.max / Math.max(ow, oh)), k = k0 * lim;
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(ow * lim)); c.height = Math.max(1, Math.round(oh * lim));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; drawImg(x, k, -f.x * k, -f.y * k, S.bmp);
  c.edited = S.q || S.a || S.flip || Math.abs(S.s / coverScale(f) - 1) > .001 || S.ratio !== "orig";
  return c;
}
function finish(v) { if (!resolve) return; const r = resolve; resolve = null; dlg.close(); if (view && view !== S.bmp && view.close) view.close(); if (S.bmp.close) S.bmp.close(); S = null; view = null; r(v); }

async function open(blob, o = {}) {
  if (resolve) finish(null);
  let bmp; try { bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { throw new Error("Format illisible par ce navigateur."); }
  const m = Math.max(bmp.width, bmp.height);
  view = m > 2400 ? await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * 2400 / m), resizeHeight: Math.round(bmp.height * 2400 / m), resizeQuality: "high" }) : bmp;
  S = { ...fresh(), bmp, max: o.maxSide || 4096 };
  q("#peT").textContent = o.title || "Modifier la photo"; q("[data-a=ok]").textContent = o.okLabel || "Valider";
  dlg.showModal(); stage.focus();
  return new Promise(r => { resolve = r; requestAnimationFrame(() => layout(false)); });
}
window.BBZE = { open };
})();
