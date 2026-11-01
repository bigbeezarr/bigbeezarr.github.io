"""Construit index.html à partir de src.html et du contenu du portfolio.

Le contenu vit dans content/ (une seule source de vérité, modifiable depuis l'administration) :
- content/portfolio.json : chapitres, projets, éditions, textes, crédits, historique des événements ;
- content/home.json      : cartes d'artistes de l'accueil, photos « à propos », mur des coups de cœur, portrait ;
- content/site.json      : coordonnées, adresse du serveur, réglages.
Les dimensions et aperçus des photos sont dans meta.json, leurs couleurs dans colors.json (calculées ici).
"""
import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
IMG = os.environ.get('BBZ_IMG', os.path.join(BASE, 'img', 'f'))
OUT = os.environ.get('BBZ_OUT', os.path.join(BASE, 'index.html'))
CONTENT = os.environ.get('BBZ_CONTENT', os.path.join(BASE, 'content'))
meta = {int(k): v for k, v in json.load(open(os.path.join(BASE, 'meta.json'))).items()}
load = lambda n: json.load(open(os.path.join(CONTENT, n), encoding='utf-8'))
PORT, HOME, SITE = load('portfolio.json'), load('home.json'), load('site.json')
CHAPTERS = PORT['chapters']

# ---- ajouts automatiques hérités (auto.json, ancien format de la tâche planifiée) ----
AUTO_PATH = os.path.join(BASE, 'auto.json')
AUTO = json.load(open(AUTO_PATH)) if os.path.exists(AUTO_PATH) else {}
def find_proj(pid):
    for c in CHAPTERS:
        for p in c["projects"]:
            if p["id"] == pid: return c, p
    raise KeyError(pid)
for np in AUTO.get("projects", []):
    next(c for c in CHAPTERS if c["id"] == np["chapter"])["projects"].append(np["project"])
for ad in AUTO.get("editions", []):
    c, p = find_proj(ad["project"])
    if "eds" not in p:
        first = {"year": p.get("year", ""), "imgs": p.pop("imgs")}
        for k in ("feature", "order"):
            if k in p: first[k] = p.pop(k)
        p["eds"] = [first]
    ed = next((e for e in p["eds"] if str(e.get("year", "")) == str(ad["year"]) and e.get("label") == ad.get("label")), None)
    if ed: ed["imgs"] = ed["imgs"] + ad["imgs"]
    else:
        ed = {k: v for k, v in ad.items() if k in ("year", "label", "sub", "place", "city", "order")}
        ed["imgs"] = list(ad["imgs"]); p["eds"].append(ed)
        p["eds"].sort(key=lambda e: str(e.get("year", "")), reverse=True)

# ---- contrôles : chaque photo publiée sert une seule fois, aucun identifiant inconnu ----
HERO, HERO_LAB, ABOUT, WALL, ME, CAP = HOME["hero"], HOME["heroLab"], HOME["about"], HOME["wall"], HOME["me"], HOME["cap"]
ids_seen = set()
for c in CHAPTERS:
    assert re.fullmatch(r'[a-z0-9-]+', c["id"]), c["id"]
    for p in c["projects"]:
        assert re.fullmatch(r'[a-z0-9-]+', p["id"]) and p["id"] not in ids_seen, p["id"]
        ids_seen.add(p["id"])
used = []
used += HERO + ABOUT + WALL + [ME]
for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            used += e["imgs"]
            if "feature" in e: used.append(e["feature"]["img"])
        if "lead" in p: used.append(p["lead"]["img"])
dups = sorted({i for i in used if used.count(i) > 1})
missing = sorted(set(meta) - set(used))
extra = sorted(set(used) - set(meta))
assert not dups and not missing and not extra, (dups, missing, extra)

# ---- couleur : chaque rubrique est rangée en dégradé (monochromes du clair au sombre, puis un tour de teinte) ----
import colorsys
import numpy as np
from PIL import Image
CPATH = os.path.join(BASE, 'colors.json')
colors = json.load(open(CPATH)) if os.path.exists(CPATH) else {}
for i in meta:
    if str(i) in colors: continue
    im = Image.open(os.path.join(IMG, f'{i:03d}.webp')).convert('RGB').resize((48, 48), Image.BILINEAR)
    a = np.asarray(im, dtype=np.float32) / 255.0
    mx, mn = a.max(2), a.min(2)
    v, c = mx, mx - mn
    s = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0)
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    hp = np.where(c == 0, 0, np.where(mx == r_, ((g_ - b_) / np.maximum(c, 1e-6)) % 6, np.where(mx == g_, (b_ - r_) / np.maximum(c, 1e-6) + 2, (r_ - g_) / np.maximum(c, 1e-6) + 4)))
    hue = hp / 6 * 2 * np.pi
    wgt = s * v
    hx, hy = (np.cos(hue) * wgt).sum(), (np.sin(hue) * wgt).sum()
    H = (np.degrees(np.arctan2(hy, hx)) + 360) % 360
    chroma = float(np.hypot(hx, hy) / max(wgt.size, 1))
    lum = float((0.2126 * r_ + 0.7152 * g_ + 0.0722 * b_).mean())
    avg = a.reshape(-1, 3).mean(0)
    colors[str(i)] = [round(float(H), 1), round(chroma, 4), round(lum, 4), '#%02x%02x%02x' % tuple(int(x * 255) for x in avg)]
json.dump(colors, open(CPATH, 'w'))

def gradient(ids):
    mono = [i for i in ids if colors[str(i)][1] < 0.035]
    chrom = [i for i in ids if i not in mono]
    mono.sort(key=lambda i: -colors[str(i)][2])
    hs = sorted(chrom, key=lambda i: colors[str(i)][0])
    if len(hs) > 1:
        hv = [colors[str(i)][0] for i in hs]
        gaps = [((hv[(k + 1) % len(hv)] - hv[k]) % 360) for k in range(len(hv))]
        k = max(range(len(gaps)), key=lambda k: gaps[k])
        hs = hs[k + 1:] + hs[:k + 1]
    return mono + hs

for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            if e.get("order") != "fixed": e["imgs"] = gradient(e["imgs"])
ABOUT = gradient(ABOUT)
def scatter(ids):
    # black and white spread evenly among the colour photos, hues stepped so neighbours differ
    mono = sorted([i for i in ids if colors[str(i)][1] < 0.035], key=lambda i: colors[str(i)][2])
    chrom = sorted([i for i in ids if i not in mono], key=lambda i: colors[str(i)][0])
    g = 0.6180339887
    mono = [mono[k] for k in sorted(range(len(mono)), key=lambda k: (k * g) % 1)]
    chrom = [chrom[k] for k in sorted(range(len(chrom)), key=lambda k: (k * g) % 1)]
    N = len(ids); keyed = []
    for k, i in enumerate(chrom): keyed.append(((k + .5) * N / max(1, len(chrom)), i))
    for k, i in enumerate(mono):
        jit = (((i * 2654435761) >> 7) % 1000 / 1000 - .5) * .7
        keyed.append(((k + .5 + jit) * N / max(1, len(mono)), i))
    return [i for _, i in sorted(keyed)]
WALL = scatter(WALL)

# ---- projets à la une (3 à 5, dans l'ordre choisi), pages de projet ----
featured = sorted([p for c in CHAPTERS for p in c["projects"] if p.get("featured") and not p.get("hidden")], key=lambda p: p["featured"])
FEATURED = [p["id"] for p in featured][:5]
for c in CHAPTERS:
    c["projects"] = [p for p in c["projects"] if not p.get("hidden")]
shown = set(HERO + ABOUT + WALL + [ME])
for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            shown.update(e["imgs"])
            if "feature" in e: shown.add(e["feature"]["img"])
        if "lead" in p: shown.add(p["lead"]["img"])

DATA = {
  "hero": HERO, "heroLab": HERO_LAB, "about": ABOUT, "wall": WALL, "me": ME, "cap": CAP, "chapters": CHAPTERS,
  "featured": FEATURED, "pages": bool(SITE.get("projectPages", True)),
  "alt": PORT.get("alt", {}),
  "site": {k: SITE.get(k) for k in ("email", "phone", "phoneHref", "instagram", "api", "booking", "legalOk")},
  "img": {str(i): [meta[i]["w"], meta[i]["h"], meta[i]["q"], colors[str(i)][3]] for i in meta},
  "total": len(shown),
}
os.makedirs(os.path.join(BASE, 'build'), exist_ok=True)
json.dump(DATA, open(os.path.join(BASE, 'build', 'data.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
src = open(os.path.join(BASE, 'src.html')).read()

# ---- texte présent dans le HTML avant le script : moteurs de recherche, aperçus, lecteurs d'écran sans JavaScript ----
import html as _html
def fr_strings(src):
    a = src.index('const T = {'); a = src.index('fr: {', a); b = src.index('\n  en: {', a)
    out = {}
    for k, v in re.findall(r'"([\w.]+)":\s*"((?:[^"\\]|\\.)*)"', src[a:b]):
        out[k] = json.loads('"' + v + '"')
    return out
FR = fr_strings(src)
cut = src.index('<script>\n(() => {')
head, tail = src[:cut], src[cut:]
def fill(m):
    k = m.group(2)
    return m.group(1) + (_html.escape(FR[k], quote=False) if k in FR else '') + m.group(3)
head = re.sub(r'(<[a-z0-9]+[^>]*\sdata-t="([\w.]+)"[^>]*>)(</)', fill, head)
for el, k in (('aboutH', 'about.h'), ('contactH', 'contact.h'), ('featH', 'feat.h')):
    head = head.replace(f'id="{el}"></h2>', f'id="{el}">{_html.escape(FR.get(k, ""), quote=False)}</h2>')
def lab(v): return v if isinstance(v, str) else (v or {}).get('fr', '')
def years(p):
    ys = sorted({str(e.get('year', '')) for e in p.get('eds', [p]) if e.get('year')})
    return ys[0] if len(ys) == 1 else (f"{ys[0][:4]}–{ys[-1][-4:]}" if ys else '')
rows = []
for c in CHAPTERS:
    for p in c['projects']:
        href = f"projets/{p['id']}/" if DATA['pages'] else f"#p-{p['id']}"
        mt = ' · '.join(x for x in (lab(c['name']), p.get('place', ''), years(p)) if x)
        rows.append(f'<li><a href="{href}">{_html.escape(lab(p["title"]))}</a> <span>{_html.escape(mt)}</span></li>')
head = head.replace('<div class="idx" id="idx" role="table"></div>', '<div class="idx" id="idx" role="table"></div>\n      <ul class="idx-static">' + ''.join(rows) + '</ul>')
src = head + tail
out = src.replace('/*__DATA__*/null', json.dumps(DATA, ensure_ascii=False, separators=(',', ':')))
open(OUT, 'w').write(out)
print('ok', len(meta), 'images', len(out) // 1024, 'KB')
