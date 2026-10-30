# Wrap index.html (built by build.py) as the standalone page of bigbeezarr.github.io and refresh og.jpg.
# usage: python3 gh_build.py --site /path/to/main-branch-checkout
import argparse, base64, hashlib, json, os, re, sys
from PIL import Image, ImageOps
BASE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); a = ap.parse_args()
sys.path.insert(0, BASE)
import variants
print('responsive copies made:', variants.ensure(os.path.join(a.site, 'img')))
src = open(os.path.join(BASE, 'index.html')).read()
cut = src.index('<div class="flash"')
head_part = src[:cut].replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230A0A0A'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23F3F1EC' stroke-width='1.8'/%3E%3Cellipse cx='16' cy='16' rx='14' ry='4.6' fill='none' stroke='%23E8141C' stroke-width='2.2' transform='rotate(-18 16 16)'/%3E%3C/svg%3E"
meta = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        f'<link rel="icon" href="{fav}"><link rel="canonical" href="https://bigbeezarr.github.io/"><meta name="theme-color" content="#0A0A0A">'
        '<meta property="og:type" content="website"><meta property="og:url" content="https://bigbeezarr.github.io/">'
        '<meta property="og:title" content="BIGBEEZARR · Mamadou Beye"><meta property="og:description" content="Photographe entre Dakar et Montréal : la nuit, la scène, le sport, la mode et les marques.">'
        '<meta property="og:image" content="https://bigbeezarr.github.io/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
        '<meta name="twitter:card" content="summary_large_image"><meta name="referrer" content="strict-origin-when-cross-origin">')
ld = json.dumps({"@context": "https://schema.org", "@type": "Person", "name": "Mamadou Beye", "alternateName": "BIGBEEZARR",
                 "jobTitle": "Photographe", "url": "https://bigbeezarr.github.io/", "image": "https://bigbeezarr.github.io/og.jpg",
                 "workLocation": [{"@type": "Place", "name": "Dakar"}, {"@type": "Place", "name": "Montréal"}],
                 "sameAs": ["https://www.instagram.com/bigbeezarr/", "https://www.instagram.com/beyethekage/"]}, ensure_ascii=False)
body = src[cut:]
html = f'<!doctype html>\n<html lang="fr">\n<head>\n{meta}\n__CSP__\n{head_part}<script type="application/ld+json">{ld}</script>\n</head>\n<body>\n{body}\n</body>\n</html>\n'
# Content-Security-Policy: only this page's own inline scripts (by hash) may run; no plugins, no base or form hijack.
hashes = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(m.encode()).digest()).decode() + "'"
                 for m in re.findall(r'<script>(.*?)</script>', html, re.S)})
csp = ("default-src 'none'; script-src " + " ".join(hashes) + "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; "
       "base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests")
html = html.replace('__CSP__', f'<meta http-equiv="Content-Security-Policy" content="{csp}">')
open(os.path.join(a.site, 'index.html'), 'w').write(html)
open(os.path.join(a.site, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /galerie/\nSitemap: https://bigbeezarr.github.io/sitemap.xml\n')
open(os.path.join(a.site, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://bigbeezarr.github.io/</loc></url></urlset>\n')
hero0 = json.loads(re.search(r'"hero":\[(\d+)', src).group(1))
im = Image.open(os.path.join(a.site, 'img', 'f', f'{hero0:03d}.webp')).convert('RGB')
ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.3)).save(os.path.join(a.site, 'og.jpg'), quality=86)
open(os.path.join(a.site, '.nojekyll'), 'w').close()
# Security headers, ready for a host that reads a _headers file (Cloudflare Pages, Netlify); GitHub Pages ignores it.
open(os.path.join(a.site, '_headers'), 'w').write("""/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(self), gyroscope=(self), magnetometer=()
/admin/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
/galerie/*
  X-Robots-Tag: noindex
/img/*
  Cache-Control: public, max-age=2592000
""")
os.makedirs(os.path.join(a.site, '.well-known'), exist_ok=True)
open(os.path.join(a.site, '.well-known', 'security.txt'), 'w').write(
    "Contact: mailto:baeypro@gmail.com\nExpires: 2027-10-30T00:00:00.000Z\nPreferred-Languages: fr, en\nCanonical: https://bigbeezarr.github.io/.well-known/security.txt\n")
print('wrote', os.path.join(a.site, 'index.html'), 'og from', hero0)
