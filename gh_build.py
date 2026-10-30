# Wrap index.html (built by build.py) as the standalone page of bigbeezarr.github.io and refresh og.jpg.
# usage: python3 gh_build.py --site /path/to/main-branch-checkout
import argparse, json, os, re
from PIL import Image, ImageOps
BASE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); a = ap.parse_args()
src = open(os.path.join(BASE, 'index.html')).read()
cut = src.index('<div class="flash"')
head_part = src[:cut].replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230A0A0A'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23F3F1EC' stroke-width='1.8'/%3E%3Cellipse cx='16' cy='16' rx='14' ry='4.6' fill='none' stroke='%23E8141C' stroke-width='2.2' transform='rotate(-18 16 16)'/%3E%3C/svg%3E"
meta = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        f'<link rel="icon" href="{fav}"><link rel="canonical" href="https://bigbeezarr.github.io/"><meta name="theme-color" content="#0A0A0A">'
        '<meta property="og:type" content="website"><meta property="og:url" content="https://bigbeezarr.github.io/">'
        '<meta property="og:title" content="BIGBEEZARR · Mamadou Beye"><meta property="og:description" content="Photographe entre Dakar et Montréal : la nuit, la scène, le sport, la mode et les marques.">'
        '<meta property="og:image" content="https://bigbeezarr.github.io/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
        '<meta name="twitter:card" content="summary_large_image">')
open(os.path.join(a.site, 'index.html'), 'w').write(f'<!doctype html>\n<html lang="fr">\n<head>\n{meta}\n{head_part}</head>\n<body>\n{src[cut:]}\n</body>\n</html>\n')
hero0 = json.loads(re.search(r'"hero":\[(\d+)', src).group(1))
im = Image.open(os.path.join(a.site, 'img', 'f', f'{hero0:03d}.webp')).convert('RGB')
ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.3)).save(os.path.join(a.site, 'og.jpg'), quality=86)
open(os.path.join(a.site, '.nojekyll'), 'w').close()
print('wrote', os.path.join(a.site, 'index.html'), 'og from', hero0)
