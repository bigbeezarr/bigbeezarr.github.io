// Smoke test of the built standalone page: no script errors, every photo tile present, no broken images.
// usage: node tools/smoke.js /abs/path/to/site   (the folder with index.html and img/f)
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 900) { scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); } });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ tiles: document.querySelectorAll('.ph-open').length, broken: [...document.querySelectorAll('.ph img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')) }));
  console.log(JSON.stringify({ ...r, errors: errs }));
  await b.close();
  process.exit(errs.length || r.broken.length ? 1 : 0);
})();
