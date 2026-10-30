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
    "id": "soirees", "city": "sn", "name": T("La nuit", "Nightlife"),
    "intro": T("Tout a commencé avec nos sorties entre amis. Très vite, la nuit est devenue mon terrain de prédilection : les pistes pleines, les sourires, la chaleur d'une foule qui danse.",
               "It all started with nights out with my friends. The night soon became my favourite ground: packed dance floors, smiles, the warmth of a crowd in motion."),
    "projects": [
      {"id": "jelani", "title": "Jelani", "city": "sn", "place": "Dakar · Saly",
       "sub": T("Les soirées Jelani, imaginées par Alphizi, qui rythment chaque été au Sénégal, avec des artistes en live.",
                "The Jelani parties, created by Alphizi, the beat of every summer in Senegal, with artists performing live."),
       "credits": [{"k": T("Sur scène", "On stage"), "names": ["Ashs the Best", "Bass Thioung", "Dip Doundou Guiss", "ISS 814", "Jeeba", "Massamba Amadeus"]}],
       "eds": [
         {"year": "2026", "place": "Saly", "sub": T("Coachella Edition, au Mövenpick Resort Lamantin", "Coachella Edition, at the Mövenpick Resort Lamantin"), "imgs": r(29, 41)},
         {"year": "2025", "label": "All White Party", "place": "Saly",
          "sub": T("Le 18 août, au Mövenpick Resort Lamantin", "August 18, at the Mövenpick Resort Lamantin"),
          "imgs": [i for i in ids["jelani25"] if i in (166, 168, 169)]},
         {"year": "2025", "label": "La Croisette",
          "sub": T("Le 26 juillet, avec Jeeba, Bass Thioung et Dip Doundou Guiss en live", "July 26, with Jeeba, Bass Thioung and Dip Doundou Guiss live"),
          "imgs": [i for i in ids["jelani25"] if 160 <= i <= 165] + ids["croisette_add"]},
         {"year": "2024", "label": "All White Party", "place": "Dakar",
          "sub": T("Avec Massamba Amadeus en invité", "With Massamba Amadeus as guest"), "imgs": ids["aw24"]},
         {"year": "2024", "label": "Caribbean Edition", "place": "Dakar",
          "sub": T("Summer Vibes, avec ISS 814 en live", "Summer Vibes, with ISS 814 live"), "imgs": r(16, 28) + ids["carib_add"]},
       ]},
      {"id": "bashment", "title": "The Bashment", "city": "sn", "place": "Dakar",
       "sub": T("Les soirées de King Mouss, qui ont fait souffler un nouveau son et une nouvelle énergie sur la nuit dakaroise.",
                "King Mouss's parties, bringing a new sound and a fresh energy to Dakar nightlife."),
       "eds": [
         {"year": "2025", "sub": T("Vol. 1, 2 et 3", "Vol. 1, 2 and 3"), "imgs": ids["bash25"] + [142] + ids["labase25"]},
         {"year": "2024", "sub": T("Le rendez-vous de chaque semaine", "The weekly gathering"), "imgs": r(66, 73)},
       ]},
      {"id": "whippin", "title": "Tout Whippin", "city": "sn", "place": "Dakar",
       "sub": T("Les soirées signées BDR et Ndeuss.", "The parties signed BDR and Ndeuss."),
       "eds": [
         {"year": "2026", "sub": T("Vol. 1"), "imgs": ids["tw26"]},
         {"year": "2025", "sub": T("Vol. 2, 3 et 4", "Vol. 2, 3 and 4"), "imgs": ids["tw25"]},
         {"year": "2024", "imgs": r(74, 81)},
       ]},
      {"id": "litty", "title": "Litty", "city": "sn", "place": "Dakar",
       "sub": T("Les soirées Litty et leurs éditions Beats N Baddies.", "The Litty nights and their Beats N Baddies editions."),
       "eds": [
         {"year": "2025", "sub": T("Beats N Baddies : Vol. 2 et Pink Party", "Beats N Baddies: Vol. 2 and Pink Party"), "imgs": ids["litty25"]},
         {"year": "2024", "imgs": r(82, 86)},
       ]},
      {"id": "ghetto", "title": "Ghetto Bash", "city": "sn", "place": "Dakar", "year": "2025",
       "sub": T("Trois soirées en 2025 : le Vol. 1, la rencontre Ghetto Bash × The Bashment, puis le Vol. 3.",
                "Three nights in 2025: Vol. 1, the Ghetto Bash × The Bashment night, then Vol. 3."),
       "imgs": ids["ghetto"]},
      {"id": "afrob", "title": "Afro B", "city": "sn", "place": "Dakar", "year": "2026",
       "sub": T("La soirée de DJ Bringuy, pour son tout premier volume.", "DJ Bringuy's party, for its very first volume."), "imgs": ids["afrob"]},
      {"id": "afroteo", "title": "Afroteo", "city": "mtl", "place": "Montréal",
       "sub": T("Les soirées d'Alexis, DJ Xocco et Lucky Summers à Montréal, réunies autour d'un mot d'ordre : United Through Rhythm.",
                "The Montréal nights of Alexis, DJ Xocco and Lucky Summers, gathered around one motto: United Through Rhythm."),
       "eds": [
         {"year": "2026", "sub": T("Édition du 10 avril", "April 10th edition"), "imgs": ids["afro26"]},
         {"year": "2025", "imgs": ids["afro25"]},
       ]},
      {"id": "mabina", "title": "Mabina Nights", "city": "mtl", "place": "Montréal", "year": "2024",
       "sub": T("Des battles de danse qui se terminent en fête, organisés par Yorick.", "Dance battles that turn into a party, hosted by Yorick."), "imgs": r(62, 65)},
    ]
  },
  {
    "id": "sport", "city": "mix", "name": T("Sport"),
    "intro": T("Le sport, je le vis autant que je le photographie. Je joue beaucoup avec mes amis et mon appareil ne me quitte jamais : c'est ainsi que je suis entré dans la photo sportive.",
               "I live sport as much as I photograph it. I play a lot with my friends and my camera never leaves my side: that is how I came to sports photography."),
    "intro2": T("Photographe officiel de La Forge, équipe universitaire de basketball de division 2 à Montréal, depuis 2023. L'équipe a été sacrée deux fois championne de la ligue Prep U.",
                "Official photographer of La Forge, a Division 2 university basketball team in Montréal, since 2023. The team has won the Prep U league title twice."),
    "projects": [
      {"id": "laforge", "title": "La Forge", "city": "mtl", "place": "Montréal",
       "sub": T("Photographe officiel de l'équipe depuis 2023 : les matchs, le banc, les célébrations.", "The team's official photographer since 2023: the games, the bench, the celebrations."),
       "eds": [
         {"year": "2025–2026", "sub": T("Matchs, banc et titre de champion Prep U", "Games, the bench and the Prep U title"),
          "feature": {"img": 143, "fr": "Ahmed Salia Touré, entraîneur principal de La Forge", "en": "Ahmed Salia Touré, head coach of La Forge"},
          "imgs": [42, 46, 49, 56, 57, 58, 59, 60, 61, 50, 51, 52, 53, 54, 55] + ids["lf26"]},
         {"year": "2025–2026", "label": "Media Day",
          "sub": T("Portraits des joueurs, de face et de trois quarts, pour le site de l'équipe", "Player portraits, front and three-quarter, for the team website"),
          "imgs": [43, 44, 45, 47, 48]},
         {"year": "2024–2025", "sub": T("Sous son ancien nom, CS Basketball", "Under its former name, CS Basketball"), "imgs": ids["cs25"] + [152]},
         {"year": "2023–2024", "sub": T("Sous son ancien nom, CS Basketball", "Under its former name, CS Basketball"), "imgs": ids["cs24"]},
       ]},
      {"id": "riseball", "title": "Riseball", "city": "sn", "place": "Dakar",
       "sub": T("Le tournoi de basketball en plein air d'Anna Maria, que j'ai couvert en 2025 et en 2026.", "Anna Maria's outdoor basketball tournament, which I covered in 2025 and 2026."),
       "eds": [
         {"year": "2026", "sub": T("Jour 1, de nuit", "Day 1, at night"), "imgs": ids["riseball"]},
         {"year": "2025", "sub": T("Jours 1 et 2", "Days 1 and 2"), "imgs": ids["rise25"]},
       ]},
      {"id": "ocruns", "title": "OC Runs", "city": "sn", "place": "Dakar",
       "sub": T("Mes propres runs de basket, le soir entre amis.", "My own pickup basketball runs, at night with friends."),
       "eds": [
         {"year": "2026", "sub": T("Run 1"), "imgs": ids["ocruns26"]},
         {"year": "2025", "sub": T("Runs 3 et 4", "Runs 3 and 4"), "imgs": ids["ocruns25"]},
       ]},
      {"id": "jeux", "title": "Jeux Urbains", "city": "mtl", "place": "Montréal", "year": "2026",
       "sub": T("Une semaine de BMX, d'escrime, de taekwondo et de DJ sets, du 17 au 22 mars.", "A week of BMX, fencing, taekwondo and DJ sets, March 17 to 22."),
       "imgs": ids["jeux"]},
    ]
  },
  {
    "id": "scene", "city": "mix", "name": T("Sur scène", "On stage"),
    "intro": T("Concerts et festivals, à Montréal comme à Dakar. Je me place au plus près des artistes pour saisir toute l'intensité d'un live.",
               "Concerts and festivals, in Montréal and in Dakar. I get as close as I can to the artists to catch the full intensity of a live show."),
    "projects": [
      {"id": "vj", "title": "VJ", "city": "mix", "place": "Dakar · Montréal",
       "sub": T("Un artiste, deux scènes : j'ai suivi VJ à Montréal, puis à Dakar.", "One artist, two stages: I followed VJ in Montréal, then in Dakar."),
       "eds": [
         {"year": "2026", "label": "Maggu VJ", "city": "sn", "place": "Dakar", "sub": T("Concert"), "imgs": r(118, 133) + [441]},
         {"year": "2025", "city": "mtl", "place": "Montréal", "sub": T("Concert"), "imgs": [ids["vj262"] if i == 104 else i for i in r(94, 105)]},
       ]},
      {"id": "dlb", "title": "DLB", "city": "sn", "place": "Dakar", "year": "2025",
       "sub": T("Le festival de musique DLB, le 26 juillet 2025 à Dakar : les artistes sur scène et l'énergie du public.",
                "The DLB music festival, July 26, 2025, in Dakar: the artists on stage and the energy of the crowd."),
       "imgs": ids["dlb"]},
      {"id": "canabasse", "title": "Canabasse & Astar", "city": "mtl", "place": "Montréal", "year": "2026",
       "sub": T("Canabasse et Astar en concert à Montréal.", "Canabasse and Astar in concert in Montréal."), "imgs": [4] + r(106, 117)},
      {"id": "ngoundieu", "title": "Ngoundieu & Friends", "city": "mtl", "place": "Montréal",
       "sub": T("Ngoundieu sur scène à Montréal : son concert avec ses invités, puis son passage au concert de Canabasse & Astar.",
                "Ngoundieu on stage in Montréal: his own concert with guests, then his set at the Canabasse & Astar concert."),
       "eds": [
         {"year": "2026", "sub": T("Sur scène au concert de Canabasse & Astar", "On stage at the Canabasse & Astar concert"), "imgs": ids["app26"]},
         {"year": "2025", "sub": T("Ngoundieu & Friends, son concert", "Ngoundieu & Friends, his concert"), "imgs": ids["ngo25"]},
       ]},
      {"id": "ashs", "title": "Ashs the Best", "city": "mtl", "place": "Montréal", "year": "2024",
       "sub": T("Ashs the Best en concert à Montréal. On le retrouve aussi sur scène aux soirées Jelani de 2025 et 2026.",
                "Ashs the Best in concert in Montréal. He also performed at the Jelani parties in 2025 and 2026."), "imgs": r(87, 93) + [ids["ashs199"]]},
    ]
  },
  {
    "id": "editorial", "city": "mix", "name": T("Mode et éditorial", "Fashion & editorial"), "short": T("Mode", "Fashion"),
    "intro": T("J'aime montrer tout ce qui se joue en coulisses d'un défilé ou d'un shooting : le travail, le soin et l'exigence qu'un projet demande.",
               "I love showing everything that happens behind a runway show or a shoot: the work, the care and the craft a project demands."),
    "projects": [
      {"id": "mad", "title": "MAD Festival", "city": "mtl", "place": "Montréal", "year": "2025",
       "sub": T("Quatre jours de mode à Montréal : les défilés, les coulisses, la coiffure et le maquillage, et le public.",
                "Four days of fashion in Montréal: the runway, backstage, hair and makeup, and the crowd."),
       "credits": [{"k": T("Marques", "Brands"), "names": ["1er Mai", "Amesika", "Bleu Ciel", "Collège LaSalle", "Fae and Geist", "Frikiton", "From Us To You",
                    "Gaba Collective", "Guillaume Chaigne", "Hawa B", "La Dame de Feu", "Lakuachimoto", "Mlle Heri", "Né à Montréal", "Nkundi", "Vidalola"]}],
       "imgs": ids["mad"]},
      {"id": "naf", "title": "Jelani · New Africa Fashion", "city": "sn", "place": "Dakar", "year": "2026",
       "sub": T("Le lookbook de l'édition 2026, shooté dans les rues de Dakar. Chaque look présente une création et ses détails.",
                "The 2026 edition lookbook, shot in the streets of Dakar. Each look presents one outfit and its details."),
       "looks": True, "lead": {"img": 144, "credits": NAF_CREDITS},
       "eds": NAF_LOOKS},
      {"id": "marques", "title": T("Marques", "Brands"), "city": "mix", "place": "Dakar · Montréal",
       "sub": T("Les marques qui m'ont confié leur image, de Dakar à Montréal, en shooting comme en événement.",
                "The brands that trusted me with their image, from Dakar to Montréal, on shoots and at events."),
       "eds": [
         {"brand": "Afitone", "year": "2026", "city": "sn", "place": "Dakar", "sub": T("Le tout premier shooting de la marque", "The brand's very first shoot"), "imgs": ids["brands"]["Afitone"]},
         {"brand": "Noblesse", "year": "2026", "label": "World Cup Edition", "city": "sn", "place": "Dakar", "imgs": ids["brands"]["Noblesse 2026"]},
         {"brand": "Breadwinner", "year": "2025", "city": "sn", "place": "Dakar", "sub": T("Shooting du 20 juillet", "July 20 shoot"), "imgs": ids["brands"]["Breadwinner"]},
         {"brand": "Cenabou", "year": "2025", "city": "sn", "place": "Dakar", "sub": T("Shooting du 4 juillet, avec ses coulisses", "July 4 shoot, behind the scenes included"), "imgs": ids["brands"]["Cenabou"]},
         {"brand": "Goût d'Afrique", "year": "2025", "city": "mtl", "place": "Montréal", "sub": T("La table et le lieu", "The food and the venue"), "imgs": ids["brands"]["Goût d'Afrique"]},
         {"brand": "Noblesse", "year": "2025", "city": "mtl", "place": "Montréal", "imgs": ids["brands"]["Noblesse 2025"]},
         {"brand": "Abyma", "year": "2024", "city": "none", "imgs": ids["brands"]["Abyma"]},
         {"brand": "Creativ Yutes", "year": "2024", "city": "none", "imgs": ids["brands"]["Creativ Yutes"]},
         {"brand": "Wanda", "year": "2024", "city": "none", "imgs": ids["brands"]["Wanda"]},
         {"brand": "RL", "year": "2024", "city": "none", "imgs": ids["brands"]["RL"]},
       ]},
    ]
  },
  {
    "id": "projets", "city": "mix", "name": T("Projets d'exposition", "Exhibition projects"), "short": T("Expositions", "Exhibitions"),
    "intro": T("Mes séries personnelles, pensées et construites pour être exposées. Chacune se lit dans son ordre, comme un récit.",
               "My personal series, conceived and built for exhibition. Each one reads in its own order, like a story."),
    "projects": [
      {"id": "salam", "title": "As salam wa al‑‘usra", "city": "none", "place": "", "year": "2025",
       "sub": T("Paix et famille. Mon premier projet éditorial, que j'ai porté comme directeur artistique et photographe.",
                "Peace and family. My first editorial project, which I led as creative director and photographer."),
       "order": "fixed", "imgs": ids["salamX"]},
      {"id": "bourrasque", "title": "La bourrasque de la presqu'île du Cap-Vert", "city": "sn", "place": "Dakar",
       "sub": T("", ""), "order": "fixed", "imgs": ids["bourrasque"]},
      {"id": "meca", "title": "Mécanique passionnelle", "city": "sn", "place": "Dakar · Olympique Club",
       "sub": T("", ""), "order": "fixed", "imgs": ids["meca"][1:]},
    ]
  },
  {
    "id": "entre-deux-villes", "city": "mix", "name": T("Entre deux villes", "Between two cities"), "short": T("Deux villes", "Two cities"),
    "intro": T("Dakar et Montréal, mes deux villes : leurs rues, leurs lumières, leurs horizons.", "Dakar and Montréal, my two cities: their streets, their light, their horizons."),
    "projects": [
      {"id": "rue", "title": T("Rues et paysages", "Streets and landscapes"), "city": "mix", "place": "Dakar · Montréal", "year": "",
       "sub": T("", ""), "imgs": [153, 154, 155, 156, 157, 158] + ids["rue2"]},
    ]
  },
]

H = ids["heroNew"]
C = ids["celebs"]; K = ids["cards2"]; Q = ids["cards3"]
S4 = ids["cards4"]
HERO = [H[0], C[1], Q["Tiakola"], S4["ISS 814"], Q["Mia Guissé"], 167, 3, Q["Massamba Amadeus"], S4["Jeeba"], K["Astar"], H[2], S4["Ashs the Best"], K["Dudu"], Q["Zepeck"], 465,
        Q["Bass Thioung"], S4["Dip Doundou Guiss"], H[3], Q["Ada Boy"], Q["Babacar Ossoko"], K["VJ"], Q["Ndakhte"], Q["Pape Djibril Ndiaye"], Q["Abba No Stress"], Q["Jean Jacques Boissy"]]
ME = 159
WALL = [2, 6, 7, 145, 146, 147, 148, 149, 151] + ids["wall"]
CAP = {228: "Collège LaSalle", 229: "Bleu Ciel", 230: "Bleu Ciel", 231: "1er Mai", 232: "Frikiton", 234: "Amesika", 235: "Nkundi", 236: "Né à Montréal"}
DK26 = T("Dakar 2026")
HERO_LAB = {
  H[0]: {"name": "SDM", "meta": T("Concert à Montréal, 2025", "Concert in Montréal, 2025")},
  C[1]: {"name": "Wally Seck", "meta": DK26},
  Q["Tiakola"]: {"name": "Tiakola", "meta": T("MAD Festival, Montréal 2025")},
  Q["Mia Guissé"]: {"name": "Mia Guissé", "meta": T("Concert de Maggu VJ, Dakar 2026", "Maggu VJ concert, Dakar 2026")},
  167: {"name": "Alphizi", "meta": T("Créateur des soirées Jelani, Dakar 2025", "Creator of the Jelani parties, Dakar 2025")},
  3: {"name": "Uncle Waffles", "meta": T("")},
  Q["Massamba Amadeus"]: {"name": "Massamba Amadeus", "meta": T("Festival DLB, Dakar 2025", "DLB festival, Dakar 2025")},
  K["Astar"]: {"name": "Astar", "meta": T("Concert Canabasse & Astar, Montréal 2026")},
  H[2]: {"name": "Youssef Swatts", "meta": T("Concert à Montréal, 2025", "Concert in Montréal, 2025")},
  K["Dudu"]: {"name": "Dudu fait des vidéos", "meta": T("Soirée Jelani, Dakar 2025", "Jelani party, Dakar 2025")},
  Q["Zepeck"]: {"name": "Zepeck", "meta": T("MAD Festival, Montréal 2025")},
  465: {"name": "Diariatou Sow", "meta": T("Shooting Cenabou, Dakar 2025", "Cenabou shoot, Dakar 2025")},
  Q["Bass Thioung"]: {"name": "Bass Thioung", "meta": T("Concert de Maggu VJ, Dakar 2026", "Maggu VJ concert, Dakar 2026")},
  H[3]: {"name": "Canabasse", "meta": T("5AM in MTL, Montréal 2026")},
  Q["Ada Boy"]: {"name": "Ada Boy", "meta": DK26},
  Q["Babacar Ossoko"]: {"name": "Babacar Ossoko", "meta": T("OC Runs, Dakar 2026")},
  K["VJ"]: {"name": "VJ", "meta": T("Concert de Maggu VJ, Dakar 2026", "Maggu VJ concert, Dakar 2026")},
  Q["Ndakhte"]: {"name": "Ndakhte", "meta": DK26},
  Q["Pape Djibril Ndiaye"]: {"name": "Pape Djibril Ndiaye", "meta": T("Shooting Cenabou, Dakar 2025", "Cenabou shoot, Dakar 2025")},
  Q["Abba No Stress"]: {"name": "Abba No Stress", "meta": DK26},
  Q["Jean Jacques Boissy"]: {"name": "Jean Jacques Boissy", "meta": T("OC Runs, Dakar 2025")},
  S4["ISS 814"]: {"name": "ISS 814", "meta": T("Jelani Caribbean Edition, Dakar 2024")},
  S4["Jeeba"]: {"name": "Jeeba", "meta": T("Jelani La Croisette, Dakar 2025")},
  S4["Ashs the Best"]: {"name": "Ashs the Best", "meta": T("Concert à Montréal, 2024", "Concert in Montréal, 2024")},
  S4["Dip Doundou Guiss"]: {"name": "Dip Doundou Guiss", "meta": T("Jelani La Croisette, Dakar 2025")},
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

DATA = {
  "hero": HERO, "heroLab": {str(k): v for k, v in HERO_LAB.items()}, "about": ABOUT, "wall": WALL, "me": ME, "cap": {str(k): v for k, v in CAP.items()}, "chapters": CHAPTERS,
  "img": {str(i): [meta[i]["w"], meta[i]["h"], meta[i]["q"], colors[str(i)][3]] for i in meta},
  "total": len(meta),
}
src = open(os.path.join(BASE, 'src.html')).read()
out = src.replace('/*__DATA__*/null', json.dumps(DATA, ensure_ascii=False, separators=(',', ':')))
open(OUT, 'w').write(out)
print('ok', len(meta), 'images', len(out) // 1024, 'KB')
