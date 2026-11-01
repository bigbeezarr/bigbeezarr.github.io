// Icônes du site à partir du logo existant (globe et anneau rouge) : node tools/icons.js <dossier de sortie>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${pad ? 0 : 7}" fill="#0A0A0A"/><g transform="${pad ? 'translate(16 16) scale(.72) translate(-16 -16)' : ''}"><circle cx="16" cy="16" r="9" fill="none" stroke="#F3F1EC" stroke-width="1.8"/><ellipse cx="16" cy="16" rx="4.2" ry="9" fill="none" stroke="#F3F1EC" stroke-width="1.1" opacity=".55"/><path d="M7 16h18" stroke="#F3F1EC" stroke-width="1.1" opacity=".55"/><ellipse cx="16" cy="16" rx="14" ry="4.6" fill="none" stroke="#E8141C" stroke-width="2.2" transform="rotate(-18 16 16)"/></g></svg>`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'favicon.svg'), mark(false));
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, size, pad] of [['icon-16.png', 16, false], ['icon-32.png', 32, false], ['icon-48.png', 48, false], ['apple-touch-icon.png', 180, true], ['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${mark(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(out, name), omitBackground: !pad, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close(); console.log('ok');
})();
