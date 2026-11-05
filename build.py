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
# cartes de l'ouverture (heroLab) : nom ou sigle (40 caractères), légende fr/en (80), seulement pour des photos de l'ouverture
assert HERO, "l'accueil a besoin d'au moins une photo d'ouverture"
assert isinstance(HERO_LAB, dict), "heroLab"
for k, v in HERO_LAB.items():
    assert re.fullmatch(r'\d{1,5}', k) and int(k) in HERO, f"heroLab : la photo {k} n'est pas dans l'ouverture"
    assert isinstance(v, dict) and set(v) <= {"name", "meta"}, f"heroLab {k}"
    assert isinstance(v.get("name", ""), str) and len(v.get("name", "")) <= 40, f"heroLab {k} : nom de 40 caractères au plus"
    m = v.get("meta", {"fr": "", "en": ""})
    assert isinstance(m, dict) and all(isinstance(m.get(l, ""), str) and len(m.get(l, "")) <= 80 for l in ("fr", "en")), f"heroLab {k} : légende de 80 caractères au plus"
UNPUB = PORT.get("unpublished", [])  # photos retirées du site : gardées au catalogue, jamais affichées
assert isinstance(UNPUB, list) and all(isinstance(i, int) for i in UNPUB), "unpublished"
used = list(UNPUB)
used += HERO + ABOUT + WALL + [ME]
for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            used += e["imgs"]
            if "feature" in e: used.append(e["feature"]["img"])
        if "lead" in p: used.append(p["lead"]["img"])
dups = sorted({i for i in used if used.count(i) > 1})
# ---- sélection (8 au plus, sans doublon) : toute photo du portfolio, même d'un autre projet ou des photos retirées ;
# forme imposée sur la mosaïque de l'accueil (« shape ») ; liens des projets et du site ----
POOL = set(UNPUB)
for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            POOL.update(e["imgs"])
            if "feature" in e: POOL.add(e["feature"]["img"])
        if "lead" in p: POOL.add(p["lead"]["img"])
for c in CHAPTERS:
    for p in c["projects"]:
        s = p.get("selection")
        if s is None: continue
        assert isinstance(s, list) and len(s) <= 8 and len(set(s)) == len(s), f"sélection de {p['id']} : 8 photos au plus, sans doublon"
        assert all(isinstance(i, int) and i in POOL for i in s), f"sélection de {p['id']} : photo inconnue du portfolio"
# ---- projets à la une : 5 au plus, rangs distincts, jamais un projet masqué ; carte (photo, cadrage, titre, sous-titre) ----
def _t_ok(v, n): return (isinstance(v, str) and len(v) <= n) or (isinstance(v, dict) and set(v) <= {"fr", "en"} and all(isinstance(x, str) and len(x) <= n for x in v.values()))
_ranks = [p["featured"] for c in CHAPTERS for p in c["projects"] if p.get("featured")]
assert len(_ranks) <= 5 and len(set(_ranks)) == len(_ranks), "à la une : 5 projets au plus, rangs distincts"
for c in CHAPTERS:
    for p in c["projects"]:
        assert not (p.get("featured") and p.get("hidden")), f"{p['id']} : un projet masqué ne peut pas être à la une"
        if "featuredCover" in p: assert isinstance(p["featuredCover"], int) and p["featuredCover"] in POOL, f"carte à la une de {p['id']} : photo inconnue du portfolio"
        if "featuredFocus" in p:
            f = p["featuredFocus"]; assert isinstance(f, dict) and set(f) <= {"x", "y"} and all(isinstance(v, (int, float)) and 0 <= v <= 100 for v in f.values()), f"cadrage de la carte à la une de {p['id']}"
        if "featuredTitle" in p: assert _t_ok(p["featuredTitle"], 60), f"titre de la carte à la une de {p['id']} : 60 caractères au plus"
        if "featuredSub" in p: assert _t_ok(p["featuredSub"], 140), f"sous-titre de la carte à la une de {p['id']} : 140 caractères au plus"
SHAPE = PORT.get("shape") or {}
assert isinstance(SHAPE, dict), "shape"
for k, v in SHAPE.items():
    assert re.fullmatch(r'\d{1,5}', k) and int(k) in meta, f"forme : photo {k} inconnue"
    assert isinstance(v, dict) and v.get("r") in ("v", "h") and all(isinstance(v.get(x, 50), (int, float)) and 0 <= v.get(x, 50) <= 100 for x in ("x", "y")), f"forme de la photo {k}"
# taille sur les mosaïques (« size ») : "s" petite, "l" grande, "xl" pleine largeur ; normale = absente
SIZE = PORT.get("size") or {}
assert isinstance(SIZE, dict), "size"
for k, v in SIZE.items():
    assert re.fullmatch(r'\d{1,5}', k) and int(k) in meta, f"taille : photo {k} inconnue"
    assert v in ("s", "l", "xl"), f"taille de la photo {k} : s, l ou xl"
LINK_KINDS = ("site", "instagram", "tiktok", "youtube", "facebook", "x", "autre")
def links_ok(l, where):
    assert isinstance(l, list) and len(l) <= 6, f"liens de {where} : 6 au plus"
    for x in l:
        assert isinstance(x, dict) and isinstance(x.get("label"), str) and 0 < len(x["label"].strip()) <= 40, f"lien de {where} : libellé de 1 à 40 caractères"
        assert isinstance(x.get("url"), str) and re.fullmatch(r'https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/?#][^\s"\'<>`]*)?', x["url"]) and len(x["url"]) <= 300, f"lien de {where} : adresse https:// invalide"
        assert x.get("kind", "autre") in LINK_KINDS, f"lien de {where} : type inconnu"
for c in CHAPTERS:
    for p in c["projects"]:
        if p.get("links") is not None: links_ok(p["links"], p["id"])
if SITE.get("links") is not None: links_ok(SITE["links"], "site")
# ---- section Contact (même contrôle que worker/src/portfolio.js) : courriel, téléphone, comptes Instagram, textes, cadrage du portrait ----
EMAIL_RE = r'[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}'
assert isinstance(SITE.get("email"), str) and re.fullmatch(EMAIL_RE, SITE["email"]), "courriel du site"
PHONE, PHONE_HREF = SITE.get("phone") or "", SITE.get("phoneHref") or ""
assert isinstance(PHONE, str) and len(PHONE) <= 30 and re.fullmatch(r'[0-9 +().-]*', PHONE) and (not PHONE or re.search(r'\d', PHONE)), "téléphone affiché : chiffres, espaces, + ( ) . - (30 au plus)"
assert isinstance(PHONE_HREF, str) and (re.fullmatch(r'\+[1-9][0-9]{6,14}', PHONE_HREF) or not PHONE_HREF), "téléphone international : + puis 7 à 15 chiffres"
assert bool(PHONE) == bool(PHONE_HREF), "téléphone : les deux formats ensemble, ou aucun"
IG = SITE.get("instagram") or []
assert isinstance(IG, list) and len(IG) <= 6 and len(set(IG)) == len(IG) and all(isinstance(h, str) and re.fullmatch(r'[A-Za-z0-9._]{1,30}', h) for h in IG), "comptes Instagram : 6 au plus, lettres, chiffres, . et _"
CT = SITE.get("contact") or {}
CT_MAX = {"title": 80, "text": 400}
assert isinstance(CT, dict) and set(CT) <= set(CT_MAX), "textes de la section Contact"
for k, v in CT.items():
    assert isinstance(v, dict) and set(v) <= {"fr", "en"} and all(isinstance(x, str) and len(x) <= CT_MAX[k] and not re.search(r'[\x00-\x1f\x7f]', x) for x in v.values()), f"texte « {k} » de la section Contact : {CT_MAX[k]} caractères au plus"
ME_FOCUS = HOME.get("meFocus")
if ME_FOCUS is not None:
    assert isinstance(ME_FOCUS, dict) and set(ME_FOCUS) <= {"x", "y", "z"} and all(isinstance(ME_FOCUS.get(a, 50), (int, float)) and 0 <= ME_FOCUS.get(a, 50) <= 100 for a in ("x", "y")) and isinstance(ME_FOCUS.get("z", 100), (int, float)) and 100 <= ME_FOCUS.get("z", 100) <= 300, "cadrage du portrait : x et y de 0 à 100, zoom de 100 à 300"
missing = sorted(set(meta) - set(used))
extra = sorted(set(used) - set(meta))
assert not dups and not missing and not extra, (dups, missing, extra)

# ---- photos envoyées en JPEG depuis l'administration (navigateur sans encodeur WebP) : img/new/NNN.jpg → img/f/NNN.webp ;
# aperçu flou (q) vide dans meta.json : calculé ici à partir de la pleine taille (comme tools/add_photos.py) ----
import base64, io
NEW = os.path.join(os.path.dirname(os.path.abspath(IMG)), 'new')
def _webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()
for i in meta:
    f, j = os.path.join(IMG, f'{i:03d}.webp'), os.path.join(NEW, f'{i:03d}.jpg')
    if not os.path.exists(f) and os.path.exists(j):
        from PIL import Image as _I
        im = _I.open(j).convert('RGB'); im.thumbnail((1800, 1800), _I.LANCZOS)
        open(f, 'wb').write(_webp(im, 82)); os.remove(j)
    if not meta[i].get('q'):
        from PIL import Image as _I
        t = _I.open(f).convert('RGB'); t.thumbnail((16, 16), _I.LANCZOS)
        meta[i]['q'] = base64.b64encode(_webp(t, 50)).decode()

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
# ---- éditions non publiées (« hidden ») : retirées partout (accueil, pages, comptes, plan du site, visionneuse) ;
# un projet dont toutes les éditions sont masquées disparaît, une couverture prise dans une édition masquée est oubliée ----
def _vis(p):
    v = set(i for e in p.get("eds", [p]) for i in e["imgs"] + ([e["feature"]["img"]] if e.get("feature") else []))
    return v | ({p["lead"]["img"]} if p.get("lead") else set())
for c in CHAPTERS:
    keep = []
    for p in c["projects"]:
        if p.get("eds") is not None and any(e.get("hidden") for e in p["eds"]):
            p["eds"] = [e for e in p["eds"] if not e.get("hidden")]
            if not p["eds"]: continue
        if p.get("cover") is not None and p["cover"] not in _vis(p): p.pop("cover")
        keep.append(p)
    c["projects"] = keep
FEATURED = [i for i in FEATURED if any(p["id"] == i for c in CHAPTERS for p in c["projects"])]
# ---- projets à la une : l'accueil n'en montre que 10 photos par année, la page du projet les garde toutes ----
# Le choix vient de « homePicks » ({année: [photos]}) ; une photo retirée du projet est ignorée et une année sans choix
# (nouvelle année ajoutée par la tâche planifiée) prend ses premières photos. Chaque photo garde son édition d'origine
# (« from ») pour la légende de la visionneuse. Sans pages de projet, rien n'est réduit : les photos resteraient introuvables.
HOME_N = 10
for c in CHAPTERS:
    for p in c["projects"]:
        picks = p.pop("homePicks", None) or {}
        hfix = p.pop("homeFixed", None) or []  # années dont l'ordre des photos de l'accueil a été rangé à la main
        assert isinstance(hfix, list) and len(hfix) <= 40 and all(isinstance(y, str) and len(y) <= 40 for y in hfix), f"ordre manuel de l'accueil de {p['id']}"
        if p["id"] not in FEATURED or not SITE.get("projectPages", True): continue
        eds = p.get("eds") or [p]
        years_order, by = [], {}
        for k, e in enumerate(eds):
            y = str(e.get("year") or p.get("year") or "")
            if y not in by: by[y] = []; years_order.append(y)
            by[y].append(k)
        blocks, trimmed = [], False
        for y in years_order:
            ks = by[y]
            pool = []
            for k in ks:
                e = eds[k]
                if e.get("feature"): pool.append((e["feature"]["img"], k))
                pool += [(i, k) for i in e["imgs"]]
            src_of = dict(pool)
            n = min(HOME_N, len(pool))
            want = [i for i in dict.fromkeys(picks.get(y) or []) if i in src_of][:n]
            want += [i for i, _ in pool if i not in want][:n - len(want)]
            feat = next((eds[k]["feature"] for k in ks if eds[k].get("feature") and eds[k]["feature"]["img"] in want), None)
            imgs = [i for i in want if not feat or i != feat["img"]]
            if y in hfix: imgs = [i for i in want if i in imgs]
            elif any(eds[k].get("order") == "fixed" for k in ks): imgs = [i for i, _ in pool if i in imgs]
            else: imgs = gradient(imgs)
            b = {"year": y, "imgs": imgs, "from": {str(i): src_of[i] for i in want}, "n": len(pool), "k": ks,
                 "anchor": f"ed-{ks[0] + 1}" if p.get("eds") else "h-all"}
            if feat: b["feature"] = feat
            blocks.append(b)
            trimmed = trimmed or len(pool) > len(want)
        if trimmed: p["home"] = blocks
shown = set(HERO + ABOUT + WALL + [ME])
for c in CHAPTERS:
    for p in c["projects"]:
        for e in p.get("eds", [p]):
            shown.update(e["imgs"])
            if "feature" in e: shown.add(e["feature"]["img"])
        if "lead" in p: shown.add(p["lead"]["img"])

DATA = {
  "hero": HERO, "heroLab": HERO_LAB, "about": ABOUT, "wall": WALL, "me": ME, "cap": CAP, "chapters": CHAPTERS,
  **({"meFocus": ME_FOCUS} if ME_FOCUS is not None else {}),
  "featured": FEATURED, "pages": bool(SITE.get("projectPages", True)),
  "alt": PORT.get("alt", {}),
  "site": {k: SITE.get(k) for k in ("email", "phone", "phoneHref", "instagram", "api", "booking", "legalOk", "turnstile")},
  **({"shape": {k: v for k, v in SHAPE.items() if int(k) in shown}} if any(int(k) in shown for k in SHAPE) else {}),
  **({"size": {k: v for k, v in SIZE.items() if int(k) in shown}} if any(int(k) in shown for k in SIZE) else {}),
  **({"links": SITE["links"]} if SITE.get("links") else {}),
  "img": {str(i): [meta[i]["w"], meta[i]["h"], meta[i]["q"], colors[str(i)][3]] for i in meta},
  "total": len(shown),
}
os.makedirs(os.path.join(BASE, 'build'), exist_ok=True)
json.dump(DATA, open(os.path.join(BASE, 'build', 'data.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
src = open(os.path.join(BASE, 'src.html')).read()

# ---- section Contact : coordonnées de content/site.json, textes remplaçables (site.json « contact », vide = texte d'origine) ----
COPY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.5V3a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
def phone_copy(h):
    m = re.fullmatch(r'\+1(\d{3})(\d{3})(\d{4})', h)
    return f"+1 {m[1]} {m[2]} {m[3]}" if m else h
EM = SITE["email"]
rows_ct = [f'<div><dt data-t="contact.email"></dt><dd><a class="c-val plain" href="mailto:{EM}">{EM}</a><button class="copy" type="button" data-copy="{EM}">{COPY_SVG}<span data-t="copy"></span></button></dd></div>']
if PHONE: rows_ct.append(f'<div><dt data-t="contact.phone"></dt><dd><a class="c-val plain" href="tel:{PHONE_HREF}">{PHONE}</a><button class="copy" type="button" data-copy="{phone_copy(PHONE_HREF)}">{COPY_SVG}<span data-t="copy"></span></button></dd></div>')
if IG: rows_ct.append('<div><dt>Instagram</dt><dd class="ig">' + ''.join(f'<a class="c-val" href="https://www.instagram.com/{h}/" target="_blank" rel="noopener noreferrer">@{h}</a>' for h in IG) + '</dd></div>')
a = src.index('<dl class="c-list">\n') + len('<dl class="c-list">\n'); b = src.index('\n      </dl>', a)
src = src[:a] + '\n'.join('        ' + r for r in rows_ct) + src[b:]
src = src.replace('baeypro@gmail.com', EM)  # courriel des textes (formulaire de réservation) et du bouton « Écrire »
for lang, nxt in (('fr', '\n  en: {'), ('en', '\n};')):
    a = src.index('const T = {'); a = src.index(f'{lang}: {{', a); b = src.index(nxt, a)
    part = src[a:b]
    for k, key in (('title', 'contact.h'), ('text', 'contact.p')):
        v = (CT.get(k) or {}).get(lang, '').strip()
        if v: part = re.sub(r'"' + re.escape(key) + r'":\s*"(?:[^"\\]|\\.)*"', lambda m: f'"{key}": ' + json.dumps(v, ensure_ascii=False).replace('<', '\\u003c'), part, count=1)
    src = src[:a] + part + src[b:]

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
