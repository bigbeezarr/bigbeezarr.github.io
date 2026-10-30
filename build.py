import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
IMG = os.environ.get('BBZ_IMG', os.path.join(BASE, 'img', 'f'))
OUT = os.environ.get('BBZ_OUT', os.path.join(BASE, 'index.html'))
meta = {int(k): v for k, v in json.load(open(os.path.join(BASE, 'meta.json'))).items()}
ids = json.load(open(os.path.join(BASE, 'new', 'ids.json')))

def r(a, b, skip=()):
    return [i for i in range(a, b + 1) if i not in skip]

def T(fr, en=None):
    return {"fr": fr, "en": en if en is not None else fr}

# Jelani New Africa Fashion: one rubric per outfit, credited where the brand is confirmed
NAF_BRAND = {
  "B": ("Selly Raby Kane", None),
  "D": ("Maison Detta", T("Le sac", "The bag")),
  "E": ("Nahyel Concept Store", T("Création Setsy Design", "Designed by Setsy Design")),
  "G": ("Al Gueye", T("Tenue de gauche, signée Naru Goor", "Outfit on the left, signed Naru Goor")),
  "I": ("Sassychic", None),
  "J": ("Galerie Kölö", None),
}
NAF_LOOKS = []
for k, (letter, imgs) in enumerate(sorted(ids["naf_looks"].items())):
    e = {"look": f"{k + 1:02d}", "imgs": imgs, "order": "fixed"}
    if letter in NAF_BRAND:
        e["label"] = NAF_BRAND[letter][0]
        if NAF_BRAND[letter][1]: e["sub"] = NAF_BRAND[letter][1]
    NAF_LOOKS.append(e)
NAF_CREDITS = [
  {"k": T("Tenues", "Outfits"), "v": ["mushei_street", "algueye_dakar", "naru_goor", "sellyrabykane", "nahyelconceptstore", "galeriekolo.design", "papacolab", "af_shal", "sassychicboutiquedakar"], "extra": T("Setsy Design")},
  {"k": T("Sac", "Bag"), "v": ["maisondetta"]},
  {"k": T("Bijoux", "Jewellery"), "v": ["lartisaneshop"]},
]

# city keys: sn = Dakar & Saly (Sénégal), mtl = Montréal, mix = both, none = not specified
# A project either has "imgs" (one shoot) or "eds" (one rubric per year, newest first).
CHAPTERS = [
  {
    "id": "soirees", "city": "sn", "name": T("Soirées", "Nights"),
    "intro": T("J'ai commencé en photographiant nos sorties entre amis. Prendre les gens en photo en soirée est vite devenu un de mes domaines principaux.",
               "I started taking pictures whenever my friends and I went out. Photographing people at events quickly became one of my main fields."),
    "projects": [
      {"id": "jelani", "title": "Jelani", "city": "sn", "place": "Dakar · Saly",
       "sub": T("Les soirées Jelani d'Alphizi, chaque été au Sénégal.", "Alphizi's Jelani parties, every summer in Senegal."),
       "eds": [
         {"year": "2026", "place": "Saly", "sub": T("Coachella Edition, au Mövenpick Resort Lamantin", "Coachella Edition, at the Mövenpick Resort Lamantin"), "imgs": r(29, 41)},
         {"year": "2025", "place": "Dakar · Saly",
          "sub": T("Summer Vibes, avec l'All White Party au Mövenpick Resort Lamantin, à Saly",
                   "Summer Vibes, including the All White Party at the Mövenpick Resort Lamantin in Saly"),
          "imgs": ids["jelani25"]},
         {"year": "2024", "place": "Dakar", "sub": T("Summer Vibes, édition caribéenne", "Summer Vibes, Caribbean edition"), "imgs": r(16, 28)},
       ]},
      {"id": "bashment", "title": "The Bashment", "city": "sn", "place": "Dakar",
       "sub": T("Les soirées de King Mouss : une nouvelle musique et une nouvelle vibe dans la nuit dakaroise.",
                "King Mouss's parties: a new sound and a new wave in Dakar nightlife."),
       "eds": [
         {"year": "2025", "sub": T("Vol. 1, 2 et 3", "Vol. 1, 2 and 3"), "imgs": ids["bash25"] + [142] + ids["labase25"]},
         {"year": "2024", "sub": T("Chaque semaine", "Every week"), "imgs": r(66, 73)},
       ]},
      {"id": "whippin", "title": "Tout Whippin", "city": "sn", "place": "Dakar",
       "sub": T("Les soirées de BDR et Ndeuss.", "BDR and Ndeuss's parties."),
       "eds": [
         {"year": "2026", "sub": T("Vol. 1"), "imgs": ids["tw26"]},
         {"year": "2025", "sub": T("Vol. 2, 3 et 4", "Vol. 2, 3 and 4"), "imgs": ids["tw25"]},
         {"year": "2024", "imgs": r(74, 81)},
       ]},
      {"id": "litty", "title": "Litty", "city": "sn", "place": "Dakar",
       "sub": T("Soirée.", "Night party."),
       "eds": [
         {"year": "2025", "sub": T("Beats N Baddies : Vol. 2 et Pink Party", "Beats N Baddies: Vol. 2 and Pink Party"), "imgs": ids["litty25"]},
         {"year": "2024", "imgs": r(82, 86)},
       ]},
      {"id": "ghetto", "title": "Ghetto Bash", "city": "sn", "place": "Dakar", "year": "2025",
       "sub": T("Vol. 1, Ghetto Bash × The Bashment et Vol. 3", "Vol. 1, Ghetto Bash × The Bashment and Vol. 3"),
       "imgs": ids["ghetto"]},
      {"id": "afrob", "title": "Afro B", "city": "sn", "place": "Dakar", "year": "2026",
       "sub": T("La soirée de DJ Bringuy, Vol. 1", "DJ Bringuy's party, Vol. 1"), "imgs": ids["afrob"]},
      {"id": "afroteo", "title": "Afroteo", "city": "mtl", "place": "Montréal",
       "sub": T("Les soirées d'Alexis, DJ Xocco et Lucky Summers à Montréal. United Through Rhythm.",
                "The Montréal nights hosted by Alexis, DJ Xocco and Lucky Summers. United Through Rhythm."),
       "eds": [
         {"year": "2026", "sub": T("Édition du 10 avril", "April 10th edition"), "imgs": ids["afro26"]},
         {"year": "2025", "imgs": ids["afro25"]},
       ]},
      {"id": "mabina", "title": "Mabina Nights", "city": "mtl", "place": "Montréal", "year": "2024",
       "sub": T("Battles de danse et soirée, organisées par Yorick", "Dance battles and partying, hosted by Yorick"), "imgs": r(62, 65)},
    ]
  },
  {
    "id": "sport", "city": "mix", "name": T("Sport"),
    "intro": T("Le sport, c'est ma passion, et j'en pratique beaucoup avec mes amis. Partout où je vais, je prends des photos. C'est comme ça que je suis arrivé à la photo sportive.",
               "I'm a sports lover at heart and I play a lot with my friends. Wherever I go, I take pictures. That's how I ended up in sports photography."),
    "intro2": T("Photographe officiel de La Forge, équipe universitaire de basketball de division 2 à Montréal, depuis 2023. L'équipe a remporté deux fois le championnat de la ligue Prep U.",
                "Official team photographer for La Forge, a Division 2 university basketball team in Montréal, since 2023. The team has won the Prep U league championship twice."),
    "projects": [
      {"id": "laforge", "title": "La Forge", "city": "mtl", "place": "Montréal",
       "sub": T("Photographe officiel de l'équipe depuis 2023.", "Official team photographer since 2023."),
       "eds": [
         {"year": "2025–2026", "sub": T("Matchs, banc et titre de champion Prep U", "Games, the bench and the Prep U championship"),
          "feature": {"img": 143, "fr": "Ahmed Salia Touré, entraîneur principal de La Forge", "en": "Ahmed Salia Touré, head coach of La Forge"},
          "imgs": [42, 46, 49, 56, 57, 58, 59, 60, 61, 50, 51, 52, 53, 54, 55] + ids["lf26"]},
         {"year": "2025–2026", "label": "Media Day",
          "sub": T("Portraits des joueurs, de face et de trois quarts, pour le site de l'équipe", "Player portraits, front and three-quarter, for the team website"),
          "imgs": [43, 44, 45, 47, 48]},
         {"year": "2024–2025", "sub": T("Sous son ancien nom, CS Basketball", "Under its former name, CS Basketball"), "imgs": ids["cs25"] + [152]},
         {"year": "2023–2024", "sub": T("Sous son ancien nom, CS Basketball", "Under its former name, CS Basketball"), "imgs": ids["cs24"]},
       ]},
      {"id": "riseball", "title": "Riseball", "city": "sn", "place": "Dakar",
       "sub": T("Le tournoi de basketball en plein air d'Anna Maria, en 2025 et 2026.", "Anna Maria's outdoor basketball tournament, in 2025 and 2026."),
       "eds": [
         {"year": "2026", "sub": T("Jour 1, de nuit", "Day 1, at night"), "imgs": ids["riseball"]},
         {"year": "2025", "sub": T("Jours 1 et 2", "Days 1 and 2"), "imgs": ids["rise25"]},
       ]},
      {"id": "ocruns", "title": "OC Runs", "city": "sn", "place": "Dakar",
       "sub": T("Mes runs de basket perso, le soir, entre amis.", "My own pickup basketball runs, at night with friends."),
       "eds": [
         {"year": "2026", "sub": T("Run 1"), "imgs": ids["ocruns26"]},
         {"year": "2025", "sub": T("Runs 3 et 4", "Runs 3 and 4"), "imgs": ids["ocruns25"]},
       ]},
      {"id": "jeux", "title": "Jeux Urbains", "city": "mtl", "place": "Montréal", "year": "2026",
       "sub": T("BMX, escrime, taekwondo et DJ sets, du 17 au 22 mars", "BMX, fencing, taekwondo and DJ sets, March 17–22"),
       "imgs": ids["jeux"]},
    ]
  },
  {
    "id": "scene", "city": "mix", "name": T("Scène", "Stage"),
    "intro": T("Concerts à Montréal et à Dakar.", "Concerts in Montréal and Dakar."),
    "projects": [
      {"id": "vj", "title": "VJ", "city": "mix", "place": "Dakar · Montréal",
       "sub": T("Le même artiste, sur scène dans mes deux villes.", "The same artist, on stage in both my cities."),
       "eds": [
         {"year": "2026", "label": "Maggu VJ", "city": "sn", "place": "Dakar", "sub": T("Concert"), "imgs": r(118, 133)},
         {"year": "2025", "city": "mtl", "place": "Montréal", "sub": T("Concert"), "imgs": r(94, 105)},
       ]},
      {"id": "canabasse", "title": "Canabasse & Astar", "city": "mtl", "place": "Montréal", "year": "2026",
       "sub": T("Concert"), "imgs": [4] + r(106, 117)},
      {"id": "ashs", "title": "Ashs the Best", "city": "mtl", "place": "Montréal", "year": "2024",
       "sub": T("Concert"), "imgs": r(87, 93)},
    ]
  },
  {
    "id": "editorial", "city": "mix", "name": T("Éditorial et mode", "Editorial & fashion"), "short": T("Éditorial", "Editorial"),
    "intro": T("J'aime montrer tout le travail derrière un événement ou une séance photo, parce que ça montre l'effort investi dans un projet.",
               "I love showing the work behind an event or a shoot, because it shows how much effort went into a project."),
    "projects": [
      {"id": "mad", "title": "MAD Festival", "city": "mtl", "place": "Montréal", "year": "2025",
       "sub": T("Défilés, backstage, coiffure et maquillage, public, pendant quatre jours", "Runway shows, backstage, hair and makeup, and the crowd, over four days"),
       "imgs": ids["mad"]},
      {"id": "naf", "title": "Jelani · New Africa Fashion", "city": "sn", "place": "Dakar", "year": "2026",
       "sub": T("Lookbook et shoot créatif pour l'édition 2026, dans les rues de Dakar. Les photos sont groupées par tenue.",
                "Lookbook and creative fashion shoot for the 2026 edition, in the streets of Dakar. Photos are grouped by outfit."),
       "looks": True, "lead": {"img": 144, "credits": NAF_CREDITS},
       "eds": NAF_LOOKS},
    ]
  },
  {
    "id": "projets", "city": "mix", "name": T("Projets d'exposition", "Exhibition projects"), "short": T("Projets", "Projects"),
    "intro": T("Mes séries personnelles, pensées et montées pour l'exposition. Chaque série est montrée dans son ordre.",
               "My personal series, conceived and edited for exhibition. Each series is shown in its own order."),
    "projects": [
      {"id": "salam", "title": "As salam wa al‑‘usra", "city": "none", "place": "", "year": "2025",
       "sub": T("Paix et famille. Mon premier projet éditorial, comme directeur artistique et photographe.",
                "Peace and family. My first editorial project, as creative director and photographer."),
       "order": "fixed", "imgs": ids["salamX"]},
      {"id": "bourrasque", "title": "La bourrasque de la presqu'île du Cap-Vert", "city": "sn", "place": "Dakar",
       "sub": T("", ""), "order": "fixed", "imgs": ids["bourrasque"]},
      {"id": "meca", "title": "Mécanique passionnelle", "city": "sn", "place": "Dakar · Olympique Club",
       "sub": T("", ""), "order": "fixed", "imgs": ids["meca"][1:]},
    ]
  },
  {
    "id": "entre-deux-villes", "city": "mix", "name": T("Entre deux villes", "Between two cities"), "short": T("Deux villes", "Two cities"),
    "intro": T("La rue, les paysages et les portraits, à Dakar comme à Montréal.", "Street, landscapes and portraits, in Dakar and in Montréal."),
    "projects": [
      {"id": "rue", "title": T("Rue, paysages, portraits", "Street, landscapes, portraits"), "city": "mix", "place": "Dakar · Montréal", "year": "",
       "sub": T("", ""), "imgs": [145, 146, 147, 148, 149, 151, 153, 154, 155, 156, 157, 158]},
    ]
  },
]

H = ids["heroNew"]
C = ids["celebs"]
HERO = [H[0], H[1], C[0], 3, C[1], H[2], C[2], H[3]]
ME = 159
WALL = [2, 6, 7] + ids["wall"]
HERO_LAB = {
  H[0]: {"name": "SDM", "meta": T("Concert à Montréal, 2025", "Concert in Montréal, 2025")},
  H[1]: {"name": "Adja", "meta": T("Photos de presse, Montréal 2025", "Press shots, Montréal 2025")},
  H[2]: {"name": "Youssef Swatts", "meta": T("Concert à Montréal, 2025", "Concert in Montréal, 2025")},
  H[3]: {"name": "Canabasse", "meta": T("5AM in MTL, Montréal 2026")},
  C[0]: {"name": "Dudu fait des vidéos", "meta": T("Jelani · New Africa Fashion, Dakar 2026")},
  3: {"name": "Uncle Waffles", "meta": T("")},
  C[1]: {"name": "Wally Seck", "meta": T("Dakar 2026")},
  C[2]: {"name": "Mia Guissé", "meta": T("Concert de Maggu VJ, Dakar 2026", "Maggu VJ concert, Dakar 2026")},
}
ABOUT = [11, 12, 13, 14, 15]

# ---- automatic additions (written by the scheduled update, see AUTOMATION.md) ----
AUTO_PATH = os.path.join(BASE, 'auto.json')
AUTO = json.load(open(AUTO_PATH)) if os.path.exists(AUTO_PATH) else {}
def find_proj(pid):
    for c in CHAPTERS:
        for p in c["projects"]:
            if p["id"] == pid: return c, p
    raise KeyError(pid)
for np in AUTO.get("projects", []):
    ch = next(c for c in CHAPTERS if c["id"] == np["chapter"])
    ch["projects"].append(np["project"])
for ad in AUTO.get("editions", []):
    c, p = find_proj(ad["project"])
    if "eds" not in p:
        first = {"year": p.get("year", ""), "imgs": p.pop("imgs")}
        if "feature" in p: first["feature"] = p.pop("feature")
        if "order" in p: first["order"] = p.pop("order")
        p["eds"] = [first]
    ed = next((e for e in p["eds"] if str(e.get("year", "")) == str(ad["year"]) and e.get("label") == ad.get("label")), None)
    if ed: ed["imgs"] = ed["imgs"] + ad["imgs"]
    else:
        ed = {k: v for k, v in ad.items() if k in ("year", "label", "sub", "place", "city", "order")}
        ed["imgs"] = list(ad["imgs"]); p["eds"].append(ed)
        p["eds"].sort(key=lambda e: str(e.get("year", "")), reverse=True)

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

# ---- colour: each rubric is ordered as a gradient (monochrome light to dark, then a continuous hue sweep) ----
import os, colorsys
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
WALL = gradient(WALL)

DATA = {
  "hero": HERO, "heroLab": {str(k): v for k, v in HERO_LAB.items()}, "about": ABOUT, "wall": WALL, "me": ME, "chapters": CHAPTERS,
  "img": {str(i): [meta[i]["w"], meta[i]["h"], meta[i]["q"], colors[str(i)][3]] for i in meta},
  "total": len(meta),
}
src = open(os.path.join(BASE, 'src.html')).read()
out = src.replace('/*__DATA__*/null', json.dumps(DATA, ensure_ascii=False, separators=(',', ':')))
open(OUT, 'w').write(out)
print('ok', len(meta), 'images', len(out) // 1024, 'KB')
