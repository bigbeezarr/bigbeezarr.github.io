# Wrap index.html (built by build.py) as the standalone page of bigbeezarr.github.io, then write the static pages
# (projects, 404, legal), icons, fonts, robots.txt, sitemap.xml, security headers and og.jpg.
# usage: python3 gh_build.py --site /path/to/main-branch-checkout
import argparse, base64, datetime, hashlib, json, os, re, shutil, sys
from PIL import Image, ImageOps
BASE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); a = ap.parse_args()
sys.path.insert(0, BASE)
import variants, pages
ORIGIN = pages.ORIGIN
SITE = json.load(open(os.path.join(BASE, 'content', 'site.json'), encoding='utf-8'))
print('responsive copies made:', variants.ensure(os.path.join(a.site, 'img')))

# ---- fichiers fixes : polices, feuilles et scripts des pages statiques, icônes ----
for d in ('fonts', 'assets'):
    dst = os.path.join(a.site, d); os.makedirs(dst, exist_ok=True)
    for f in os.listdir(os.path.join(BASE, d)):
        p = os.path.join(BASE, d, f)
        if os.path.isfile(p): shutil.copy(p, os.path.join(dst, f))
open(os.path.join(a.site, 'assets', 'fonts.css'), 'w').write(
    '@font-face{font-family:"Archivo";src:url(../fonts/archivo.woff2) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}\n'
    '@font-face{font-family:"Schibsted Grotesk";src:url(../fonts/schibsted.woff2) format("woff2");font-weight:400 800;font-style:normal;font-display:swap}\n'
    '@font-face{font-family:"Schibsted Grotesk";src:url(../fonts/schibsted-italic.woff2) format("woff2");font-weight:400 800;font-style:italic;font-display:swap}\n')
ICONS = os.path.join(BASE, 'assets', 'icons')
for f in ('favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'):
    shutil.copy(os.path.join(ICONS, f), os.path.join(a.site, f))
shutil.rmtree(os.path.join(a.site, 'assets', 'icons'), ignore_errors=True)
json.dump({"name": "BIGBEEZARR · Mamadou Beye", "short_name": "BIGBEEZARR", "lang": "fr", "start_url": "/", "scope": "/", "display": "standalone",
           "background_color": "#0A0A0A", "theme_color": "#0A0A0A",
           "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
          open(os.path.join(a.site, 'site.webmanifest'), 'w'), ensure_ascii=False)

# ---- page d'accueil ----
src = open(os.path.join(BASE, 'index.html')).read()
cut = src.index('<a class="skip"')
head_part = src[:cut].replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
title = re.search(r'<title>(.*?)</title>', head_part).group(1)
desc = re.search(r'<meta name="description" content="([^"]*)"', head_part).group(1)
meta = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<link rel="icon" href="favicon.ico" sizes="32x32"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="manifest" href="site.webmanifest">'
        f'<link rel="canonical" href="{ORIGIN}/"><meta name="theme-color" content="#0A0A0A">'
        '<meta property="og:type" content="website"><meta property="og:site_name" content="BIGBEEZARR"><meta property="og:locale" content="fr_CA"><meta property="og:locale:alternate" content="en_CA">'
        f'<meta property="og:url" content="{ORIGIN}/"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">'
        f'<meta property="og:image" content="{ORIGIN}/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="BIGBEEZARR, photographe entre Dakar et Montréal">'
        f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="{ORIGIN}/og.jpg">'
        '<meta name="referrer" content="strict-origin-when-cross-origin">')
ld = json.dumps([
    {"@context": "https://schema.org", "@type": "Person", "@id": f"{ORIGIN}/#mamadou", "name": "Mamadou Beye", "alternateName": "BIGBEEZARR",
     "jobTitle": "Photographe", "url": f"{ORIGIN}/", "image": f"{ORIGIN}/og.jpg", "email": f"mailto:{SITE['email']}",
     "workLocation": [{"@type": "Place", "name": "Dakar"}, {"@type": "Place", "name": "Montréal"}],
     "sameAs": [f"https://www.instagram.com/{h}/" for h in SITE.get('instagram', [])]},
    {"@context": "https://schema.org", "@type": "WebSite", "name": "BIGBEEZARR", "url": f"{ORIGIN}/", "inLanguage": ["fr", "en"], "author": {"@id": f"{ORIGIN}/#mamadou"}}], ensure_ascii=False)
body = src[cut:]
html = f'<!doctype html>\n<html lang="fr">\n<head>\n{meta}\n__CSP__\n{head_part}<script type="application/ld+json">{ld}</script>\n</head>\n<body>\n{body}\n</body>\n</html>\n'
# Content-Security-Policy : seuls les scripts en ligne de cette page (par empreinte) peuvent s'exécuter ; les envois réseau
# ne vont qu'au site lui-même et au serveur des galeries (Cloudflare Workers, ou l'adresse fixée dans content/site.json).
hashes = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(m.encode()).digest()).decode() + "'"
                 for m in re.findall(r'<script>(.*?)</script>', html, re.S)})
api = (SITE.get('api') or '').rstrip('/')
api_origin = re.match(r'https://[^/]+', api).group(0) if re.match(r'https://[^/]+', api) else ''
# Adresse du serveur fixée dans les réglages : seule cette origine est permise ; sinon, n'importe quel sous-domaine workers.dev
# (l'adresse exacte n'est connue qu'après le premier déploiement du serveur, dans galerie/config.js).
connect = f"'self' {api_origin}" if api_origin else "'self' https://*.workers.dev"
csp = ("default-src 'none'; script-src " + " ".join(hashes) + "; style-src 'self' 'unsafe-inline'; "
       f"font-src 'self'; img-src 'self' data: blob:; connect-src {connect}; manifest-src 'self'; "
       "base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests")
html = html.replace('__CSP__', f'<meta http-equiv="Content-Security-Policy" content="{csp}">')
open(os.path.join(a.site, 'index.html'), 'w').write(html)

# ---- pages statiques ----
paths = ['/'] + pages.build(a.site, BASE)
LEGAL = os.path.join(BASE, 'content', 'legal')
if os.path.isdir(LEGAL):
    for f in sorted(os.listdir(LEGAL)):
        if not f.endswith('.html'): continue
        slug = f[:-5]
        raw = open(os.path.join(LEGAL, f), encoding='utf-8').read()
        t = re.search(r'<!--\s*title:\s*(.*?)\s*-->', raw); d = re.search(r'<!--\s*description:\s*(.*?)\s*-->', raw)
        body_html = raw
        if not SITE.get('legalOk'):
            body_html = ('<div class="wrap draft" role="note"><p><b>Version de travail.</b> Ce texte doit être relu et validé par un juriste avant d’être considéré comme définitif.</p></div>\n' + body_html)
        os.makedirs(os.path.join(a.site, slug), exist_ok=True)
        open(os.path.join(a.site, slug, 'index.html'), 'w', encoding='utf-8').write(
            pages.simple_page(a.site, slug, t.group(1) if t else slug, d.group(1) if d else '', body_html))
        paths.append(f'/{slug}/')
nf = open(os.path.join(BASE, 'content', '404.html'), encoding='utf-8').read() if os.path.exists(os.path.join(BASE, 'content', '404.html')) else '<section class="wrap p-hero"><h1 class="p-h1">404</h1></section>'
page404 = pages.simple_page(a.site, '', 'Page introuvable · BIGBEEZARR', 'Cette page n’existe pas ou plus.', nf, noindex=True)
page404 = re.sub(r'(href|src)="\./', r'\1="/', page404)  # chemins absolus : la page 404 s'affiche à n'importe quelle adresse
open(os.path.join(a.site, '404.html'), 'w', encoding='utf-8').write(page404)

# ---- référencement : robots.txt et plan du site (les pages privées n'y figurent pas ; robots.txt n'est pas une protection) ----
open(os.path.join(a.site, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nSitemap: {ORIGIN}/sitemap.xml\n')
# lastmod honnête : la date ne change que si la page a changé (empreinte gardée dans .build-pages.json sur le site).
today = datetime.date.today().isoformat()
state_path = os.path.join(a.site, '.build-pages.json')
try: state = json.load(open(state_path))
except Exception: state = {}
new_state = {}
for p in paths:
    f = os.path.join(a.site, p.strip('/'), 'index.html') if p != '/' else os.path.join(a.site, 'index.html')
    h = hashlib.sha256(re.sub(r"'sha256-[^']+'", '', open(f, encoding='utf-8').read()).encode()).hexdigest()[:16] if os.path.exists(f) else ''
    old_h, old_d = (state.get(p) or ['', ''])
    new_state[p] = [h, old_d if (h == old_h and old_d) else today]
json.dump(new_state, open(state_path, 'w'), indent=0, sort_keys=True)
urls = "".join(f'<url><loc>{ORIGIN}{p}</loc><lastmod>{new_state[p][1]}</lastmod></url>' for p in paths)
open(os.path.join(a.site, 'sitemap.xml'), 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
hero0 = json.loads(re.search(r'"hero":\[(\d+)', src).group(1))
im = Image.open(os.path.join(a.site, 'img', 'f', f'{hero0:03d}.webp')).convert('RGB')
ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.3)).save(os.path.join(a.site, 'og.jpg'), quality=86)
open(os.path.join(a.site, '.nojekyll'), 'w').close()
# En-têtes de sécurité, prêts pour un hébergeur qui lit _headers (Cloudflare Pages, Netlify) ; GitHub Pages l'ignore.
open(os.path.join(a.site, '_headers'), 'w').write("""/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
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
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
""")
os.makedirs(os.path.join(a.site, '.well-known'), exist_ok=True)
open(os.path.join(a.site, '.well-known', 'security.txt'), 'w').write(
    f"Contact: mailto:{SITE['email']}\nExpires: 2027-10-30T00:00:00.000Z\nPreferred-Languages: fr, en\nCanonical: {ORIGIN}/.well-known/security.txt\n")
print('wrote', os.path.join(a.site, 'index.html'), '+', len(paths) - 1, 'pages, og from', hero0)
