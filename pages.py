"""Pages statiques : une page par projet (/projets/<id>/), la liste des projets, la page 404, les pages légales.

Appelé par gh_build.py après build.py. Les textes viennent de build/data.json (même contenu que la page d'accueil),
les pages légales de content/legal/*.html. Aucun style ni script en ligne : la politique de sécurité (CSP) des pages
n'autorise que les fichiers du site.
"""
import html, json, os, re
from PIL import Image, ImageOps

ORIGIN = "https://bigbeezarr.github.io"
E = lambda s: html.escape(str(s or ""), quote=True)
def T(v, lang):
    if v is None: return ""
    if isinstance(v, str): return v
    return v.get(lang) if v.get(lang) is not None else v.get("fr", "")
def both(v, tag="span"):
    fr, en = T(v, "fr"), T(v, "en")
    if fr == en: return E(fr)
    return f'<{tag} data-l="fr">{E(fr)}</{tag}><{tag} data-l="en" lang="en">{E(en)}</{tag}>'
def bi(fr, en, tag="span"):
    return E(fr) if fr == en else f'<{tag} data-l="fr">{E(fr)}</{tag}><{tag} data-l="en" lang="en">{E(en)}</{tag}>'
pad = lambda i: f"{int(i):03d}"
SITE_DIR = None  # set by build(): used to pick a size that exists (small photos have no 480 or 960 copy)
def vsrc(up, i, pref):
    for k in ([pref] + [x for x in ("s", "m", "f") if x != pref]):
        if SITE_DIR is None or os.path.exists(os.path.join(SITE_DIR, "img", k, f"{pad(i)}.webp")): return f"{up}img/{k}/{pad(i)}.webp"
    return f"{up}img/f/{pad(i)}.webp"
def eds_of(p): return p.get("eds") or [{"year": p.get("year", ""), "imgs": p.get("imgs", []), "feature": p.get("feature"), "single": True}]
def ed_imgs(e): return ([e["feature"]["img"]] if e.get("feature") else []) + list(e["imgs"])
def years(p):
    ys = sorted({str(e.get("year", "")) for e in eds_of(p) if e.get("year")})
    if not ys: return ""
    a, b = ys[0][:4], ys[-1][-4:]
    return a if a == b else f"{a}–{b}"
def count(p): return sum(len(ed_imgs(e)) for e in eds_of(p)) + (1 if p.get("lead") else 0)
UNIT = {"soiree": ("soirée", "soirées", 1, "night", "nights"), "edition": ("édition", "éditions", 1, "edition", "editions"), "saison": ("saison", "saisons", 1, "season", "seasons"),
        "session": ("session", "sessions", 1, "session", "sessions"), "marque": ("marque", "marques", 1, "brand", "brands"), "concert": ("concert", "concerts", 0, "concert", "concerts"),
        "evenement": ("événement", "événements", 0, "event", "events")}
def coverage(p, lang):
    s = p.get("series")
    if not s or p.get("looks"): return ""
    eds = eds_of(p)
    n = len({e.get("year") for e in eds}) if s.get("unit") == "saison" else len(eds)
    if not s.get("known") and n < 2: return ""
    u = UNIT.get(s.get("unit"), UNIT["edition"]); note = f" · {E(T(s.get('note'), lang))}" if s.get("note") else ""
    if lang == "fr":
        tot = f" sur {'au moins ' if s.get('min') else ''}{s['known']}" if s.get("known") else ""
        return f"<b>{n} {u[1] if n > 1 else u[0]}</b> photographié{'e' if u[2] else ''}{'s' if n > 1 else ''}{tot}{note}"
    tot = f" out of {'at least ' if s.get('min') else ''}{s['known']}" if s.get("known") else ""
    return f"<b>{n} {u[4] if n > 1 else u[3]}</b> photographed{tot}{note}"
def ed_title(p, e):
    t = T(p["title"], "fr"); te = T(p["title"], "en")
    parts_fr = [t] + [x for x in (e.get("brand"), str(e.get("year") or ""), T(e.get("label"), "fr")) if x]
    parts_en = [te] + [x for x in (e.get("brand"), str(e.get("year") or ""), T(e.get("label"), "en")) if x]
    if e.get("look"): parts_fr = [t, f"Look {e['look']}"] + ([T(e.get('label'), 'fr')] if e.get('label') else []); parts_en = [te, f"Look {e['look']}"] + ([T(e.get('label'), 'en')] if e.get('label') else [])
    return {"fr": " · ".join(parts_fr), "en": " · ".join(parts_en)}
LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="4.6" ry="10" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/><path d="M6 16h20" stroke="currentColor" stroke-width="1.2" opacity=".55"/><ellipse cx="16" cy="16" rx="15" ry="5" fill="none" stroke="#E8141C" stroke-width="1.8" transform="rotate(-18 16 16)"/></svg>'
CSP_TPL = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' __API__; manifest-src 'self'; "
           "base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests")
CSP = CSP_TPL.replace("__API__", "https://*.workers.dev")  # remplacé dans build() par l'adresse du serveur si elle est fixée
def head(up, title, desc, path, og, extra=""):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{ORIGIN}{path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="BIGBEEZARR"><meta property="og:locale" content="fr_CA"><meta property="og:locale:alternate" content="en_CA">
<meta property="og:url" content="{ORIGIN}{path}"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{ORIGIN}{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{E(title)}"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{ORIGIN}{og}">
<link rel="icon" href="{up}favicon.ico" sizes="32x32"><link rel="icon" href="{up}favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="{up}apple-touch-icon.png"><link rel="manifest" href="{up}site.webmanifest">
<meta name="theme-color" content="#0A0A0A">
<link rel="preload" href="{up}fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{up}assets/projet.css">
{extra}</head>'''
def bar(up, back_href, back_fr, back_en):
    return f'''<a class="skip" href="#contenu"><span data-l="fr">Aller au contenu</span><span data-l="en" lang="en">Skip to content</span></a>
<header class="bar"><div class="wrap bar-in"><a class="logo" href="{up}" aria-label="BIGBEEZARR, accueil">{LOGO}<span>BIGBEEZARR</span></a>
<div class="bar-act"><a class="back" href="{back_href}">← <span>{bi(back_fr, back_en)}</span></a><button class="lang" id="lang" type="button">EN</button></div></div></header>'''
def foot(up, email):
    return f'''<footer class="wrap foot"><span>© 2026 BIGBEEZARR · Mamadou Beye</span><nav aria-label="Pied de page"><a href="{up}">{bi("Accueil", "Home")}</a><a href="{up}projets/">{bi("Tous les projets", "All projects")}</a><a href="mailto:{E(email)}">{E(email)}</a><a href="{up}confidentialite/">{bi("Confidentialité", "Privacy")}</a><a href="{up}conditions/">{bi("Conditions d’utilisation", "Terms of use")}</a></nav></footer>'''
LIGHTBOX = '''<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Visionneuse / Viewer" hidden>
<div class="lb-stage" id="lbStage"><div class="lb-img" id="lbImg"><img class="lb-full" id="lbFull" alt="" draggable="false"></div></div>
<button class="lb-btn lb-close" id="lbClose" type="button" aria-label="Fermer / Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
<button class="lb-btn lb-zoom" id="lbZoom" type="button" aria-label="Zoom (+ / −)"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12.8 12.8 17 17M6.2 8.6h4.8M8.6 6.2V11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>
<button class="lb-btn lb-fs" id="lbFs" type="button" aria-label="Plein écran / Full screen (F)" hidden><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<button class="lb-btn lb-prev" id="lbPrev" type="button" aria-label="Photo précédente / Previous"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<button class="lb-btn lb-next" id="lbNext" type="button" aria-label="Photo suivante / Next"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<div class="lb-bar"><span class="lb-title" id="lbTitle"></span><span class="lb-count" id="lbCount"></span></div>
</div>'''

def card(up, p, c, D):
    e0 = eds_of(p)[0]
    cov = p.get("cover") if p.get("cover") is not None else (p["lead"]["img"] if p.get("lead") else (e0["feature"]["img"] if e0.get("feature") else e0["imgs"][0]))
    w, h = D["img"][str(cov)][:2]
    meta_fr = coverage(p, "fr") or E(" · ".join(x for x in (p.get("place", ""), years(p), f"{count(p)} photos") if x))
    meta_en = coverage(p, "en") or E(" · ".join(x for x in (p.get("place", ""), years(p), f"{count(p)} photos") if x))
    meta = meta_fr if meta_fr == meta_en else f'<span data-l="fr">{meta_fr}</span><span data-l="en" lang="en">{meta_en}</span>'
    return (f'<a class="fcard" href="{up}projets/{p["id"]}/" data-cover="{cov}"><img data-i="{cov}" src="{vsrc(up, cov, "s")}" sizes="(max-width:620px) 92vw, 24vw" width="{w}" height="{h}" alt="" loading="lazy" decoding="async">'
            f'<span class="fc-txt"><span class="fc-t">{both(p["title"])}</span><span class="fc-m">{meta}</span></span></a>')

def project_page(site, D, c, ci, p, NCH, all_projects, SITE):
    up = "../../"
    pid = p["id"]; path = f"/projets/{pid}/"
    title_fr, title_en = T(p["title"], "fr"), T(p["title"], "en")
    eds = eds_of(p)
    e0 = eds[0]
    cov = p.get("cover") if p.get("cover") is not None else (p["lead"]["img"] if p.get("lead") else (e0["feature"]["img"] if e0.get("feature") else e0["imgs"][0]))
    sub = p.get("sub") or c.get("intro")
    desc = re.sub(r"\s+", " ", T(sub, "fr")).strip()
    if len(desc) > 158: desc = desc[:155].rsplit(" ", 1)[0] + "…"
    place = p.get("place") or ""
    page_title = f"{title_fr} · BIGBEEZARR, photographe" + (f" à {place}" if place and "·" not in place else (" à Dakar et Montréal" if "·" in place else ""))
    # image de partage 1200 x 630
    os.makedirs(os.path.join(site, "projets", pid), exist_ok=True)
    im = Image.open(os.path.join(site, "img", "f", f"{pad(cov)}.webp")).convert("RGB")
    ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.36)).save(os.path.join(site, "projets", pid, "og.jpg"), quality=84, optimize=True)
    imgs = {}
    def use(i): imgs[str(i)] = D["img"][str(i)]
    use(cov)
    # données pour le script : éditions dans l'ordre de la page, textes alternatifs
    pd_eds = []
    sections = []
    for k, e in enumerate(eds):
        ids = ed_imgs(e)
        for i in ids: use(i)
        t = ed_title(p, e)
        pd_eds.append({"t": t, "imgs": ids})
        if e.get("single"):
            sections.append(f'<div class="gallery" data-imgs="{",".join(map(str, ids))}"></div>')
            continue
        name = e.get("brand") or (f"Look {e['look']}" if e.get("look") else str(e.get("year") or ""))
        lab = both(e.get("label")) if e.get("label") and not e.get("look") else (both(e.get("label")) if e.get("look") and e.get("label") else "")
        extra = " · ".join(x for x in ((str(e.get("year")) if e.get("brand") else ""), (e.get("place") if e.get("place") and e.get("place") != place else "")) if x)
        n_fr, n_en = f"{len(ids)} photo{'s' if len(ids) > 1 else ''}", f"{len(ids)} photo{'s' if len(ids) > 1 else ''}"
        sub_e = f'<p class="ed-sub">{both(e.get("sub"))}</p>' if e.get("sub") else ""
        sections.append(f'<section class="ed" id="ed-{k + 1}" aria-label="{E(t["fr"])}"><header class="ed-head"><h3 class="ed-year">{E(name)}</h3>'
                        f'{f"<span class=ed-label>{lab}</span>" if lab else ""}<span class="ed-n">{E(extra + " · " if extra else "")}{bi(n_fr, n_en)}</span>{sub_e}</header>'
                        f'<div class="gallery" data-imgs="{",".join(map(str, ids))}"></div></section>')
    if p.get("lead"):
        use(p["lead"]["img"])
    # sélection : la première photo de chaque édition (ou les premières photos), 8 au plus
    sel = list(p.get("selection") or [])
    if not sel:
        if len(eds) > 1:
            for e in eds:
                ids = ed_imgs(e)
                if ids: sel.append(ids[0])
        else:
            sel = ed_imgs(eds[0])[:8]
    sel = [i for i in sel if str(i) in D["img"]][:8]
    sel_html = "".join(f'<figure class="s ph-sel" data-cover="{i}"><button class="ph-open" type="button" data-i="{i}"><img data-i="{i}" src="{vsrc(up, i, "s")}" sizes="(max-width:620px) 50vw, 22vw" alt="" loading="lazy" decoding="async"></button></figure>' for i in sel)
    for i in sel: use(i)
    # faits
    role = p.get("role") or {"fr": "Photographie", "en": "Photography"}
    facts = [f'<div><dt>{bi("Rôle", "Role")}</dt><dd>{both(role)}</dd></div>']
    if place: facts.append(f'<div><dt>{bi("Lieu", "Place")}</dt><dd>{E(place)}</dd></div>')
    ys = years(p) or str(p.get("year") or "")
    if ys: facts.append(f'<div><dt>{bi("Années", "Years")}</dt><dd>{E(ys)}</dd></div>')
    for r in p.get("credits") or []:
        facts.append(f'<div><dt>{both(r["k"])}</dt><dd class="chips">{"".join(f"<span>{both(n)}</span>" for n in r["names"])}</dd></div>')
    if p.get("lead"):
        for r in p["lead"].get("credits") or []:
            facts.append(f'<div><dt>{both(r["k"])}</dt><dd>{" ".join(f"<a href=\"https://www.instagram.com/{E(h)}/\" rel=\"noopener noreferrer\" target=\"_blank\">@{E(h)}</a>" for h in r["v"])}{(" · " + both(r["extra"])) if r.get("extra") else ""}</dd></div>')
    if p.get("ig"):
        facts.append(f'<div><dt>Instagram</dt><dd>{" ".join(f"<a href=\"https://www.instagram.com/{E(h)}/\" rel=\"noopener noreferrer\" target=\"_blank\">@{E(h)}</a>" for h in p["ig"])}</dd></div>')
    cov_fr, cov_en = coverage(p, "fr"), coverage(p, "en")
    cov_html = (f'<p class="p-cov"><span data-l="fr">{cov_fr}</span><span data-l="en" lang="en">{cov_en}</span></p>' if cov_fr else "")
    w, h = D["img"][str(cov)][:2]
    rel = [o for o in all_projects if o[1]["id"] != pid and o[0]["id"] == c["id"]][:4]
    if len(rel) < 3:
        rel += [o for o in all_projects if o[1]["id"] != pid and o not in rel and o[1]["id"] in D.get("featured", [])][:4 - len(rel)]
    for (rc, rp) in rel:
        e0r = eds_of(rp)[0]; rcov = rp.get("cover") if rp.get("cover") is not None else (rp["lead"]["img"] if rp.get("lead") else (e0r["feature"]["img"] if e0r.get("feature") else e0r["imgs"][0])); use(rcov)
    rel_html = "".join(card(up, rp, rc, D) for rc, rp in rel)
    ld = {"@context": "https://schema.org", "@type": "ImageGallery", "name": title_fr, "description": desc, "url": ORIGIN + path, "image": f"{ORIGIN}{path}og.jpg",
          "inLanguage": "fr", "numberOfItems": count(p),
          "author": {"@type": "Person", "name": "Mamadou Beye", "alternateName": "BIGBEEZARR", "url": ORIGIN + "/"},
          "isPartOf": {"@type": "WebSite", "name": "BIGBEEZARR", "url": ORIGIN + "/"}}
    if place: ld["contentLocation"] = {"@type": "Place", "name": place}
    if ys: ld["temporalCoverage"] = ys.replace("–", "/")
    pdata = {"id": pid, "base": up, "img": imgs, "eds": pd_eds, "alt": {k: v for k, v in (D.get("alt") or {}).items() if k in imgs}}
    chap_fr, chap_en = T(c["name"], "fr"), T(c["name"], "en")
    n_ph = count(p)
    page = head(up, page_title, desc, path, f"{path}og.jpg", f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n') + f'''
<body>
{bar(up, f"{up}#{c['id']}", chap_fr, chap_en)}
<main id="contenu" tabindex="-1">
<section class="wrap p-hero">
<p class="kick">{bi(f"Chapitre {ci + 1:02d} / {NCH:02d} · {chap_fr}", f"Chapter {ci + 1:02d} / {NCH:02d} · {chap_en}")}</p>
<h1 class="p-h1">{both(p["title"])}</h1>
<p class="p-meta"><span class="dot" data-c="{E(p.get("city", "none"))}"></span>{E(" · ".join(x for x in (place, ys, f"{n_ph} photo" + ("s" if n_ph > 1 else "")) if x))}</p>
{cov_html}
<div class="p-grid"><p class="p-desc">{both(sub)}</p><dl class="facts">{"".join(facts)}</dl></div>
<figure class="cover" data-cover="{cov}"><img data-i="{cov}" src="{vsrc(up, cov, "m")}" sizes="(max-width:1680px) 100vw, 1680px" width="{w}" height="{h}" alt="" fetchpriority="high" decoding="async"></figure>
</section>
<section class="sec wrap" aria-labelledby="h-sel"><h2 class="h2" id="h-sel">{bi("Sélection", "Selection")}</h2><div class="sel">{sel_html}</div></section>
<section class="sec wrap" aria-labelledby="h-all"><h2 class="h2" id="h-all">{bi(f"Toutes les photos ({n_ph})", f"All photos ({n_ph})")}</h2>{"".join(sections)}</section>
{f'<section class="sec wrap" aria-labelledby="h-rel"><h2 class="h2" id="h-rel">{bi("Autres projets", "More projects")}</h2><div class="rel">{rel_html}</div></section>' if rel_html else ""}
<section class="sec wrap" aria-labelledby="h-cta"><h2 class="h2" id="h-cta">{bi("Un projet en tête ?", "Have a project in mind?")}</h2>
<p class="p-desc">{bi("Soirée, concert, équipe, marque ou shooting : écrivez-moi, je vous réponds avec plaisir.", "A party, a concert, a team, a brand or a shoot: write to me, I’d love to hear from you.")}</p>
<div class="cta"><a class="btn primary" href="{up}#reserver">{bi("Demander une date", "Request a date")}</a><a class="btn" href="mailto:{E(SITE.get("email", ""))}">{bi("Écrire un courriel", "Send an email")}</a><a class="btn" href="{up}projets/">{bi("Tous les projets", "All projects")}</a></div></section>
</main>
{foot(up, SITE.get("email", ""))}
{LIGHTBOX}
<script type="application/json" id="pdata">{json.dumps(pdata, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}</script>
<script src="{up}assets/projet.js"></script>
</body>
</html>
'''
    open(os.path.join(site, "projets", pid, "index.html"), "w", encoding="utf-8").write(page)
    return path

def projects_index(site, D, all_projects, SITE):
    up = "../"
    used = {}
    cards = []
    for c, p in all_projects:
        e0 = eds_of(p)[0]
        cov = p.get("cover") if p.get("cover") is not None else (p["lead"]["img"] if p.get("lead") else (e0["feature"]["img"] if e0.get("feature") else e0["imgs"][0]))
        used[str(cov)] = D["img"][str(cov)]
        cards.append(card(up, p, c, D))
    pdata = {"id": "_", "base": up, "img": used, "eds": [], "alt": {}}
    title = "Tous les projets · BIGBEEZARR, photographe à Dakar et Montréal"
    desc = f"Les {len(all_projects)} projets photo de BIGBEEZARR (Mamadou Beye) : soirées, sport, concerts, mode, marques et projets d’exposition, à Dakar et à Montréal."
    page = head(up, title, desc, "/projets/", "/og.jpg") + f'''
<body>
{bar(up, up, "Accueil", "Home")}
<main id="contenu" tabindex="-1">
<section class="wrap p-hero"><p class="kick">BIGBEEZARR · Mamadou Beye</p><h1 class="p-h1">{bi("Tous les projets", "All projects")}</h1>
<p class="p-meta">{bi(f"{len(all_projects)} projets · {D['total']} photos · Dakar et Montréal", f"{len(all_projects)} projects · {D['total']} photos · Dakar and Montréal")}</p></section>
<section class="sec wrap"><div class="rel">{"".join(cards)}</div></section>
</main>
{foot(up, SITE.get("email", ""))}
{LIGHTBOX}
<script type="application/json" id="pdata">{json.dumps(pdata, ensure_ascii=False, separators=(",", ":"))}</script>
<script src="{up}assets/projet.js"></script>
</body>
</html>
'''
    os.makedirs(os.path.join(site, "projets"), exist_ok=True)
    open(os.path.join(site, "projets", "index.html"), "w", encoding="utf-8").write(page)

def simple_page(site, folder, title, desc, body_html, back=("Accueil", "Home"), noindex=False):
    """Page de texte (404, légal) avec l'en-tête et le pied du site. folder='' pour la racine."""
    depth = len([x for x in folder.split("/") if x])
    up = "../" * depth if depth else ""
    path = "/" + (folder.strip("/") + "/" if folder else "")
    extra = '<meta name="robots" content="noindex">\n' if noindex else ""
    page = head(up or "./", title, desc, path if folder else "/404.html", "/og.jpg", extra) + f'''
<body>
{bar(up or "./", up or "./", back[0], back[1])}
<main id="contenu" tabindex="-1">
{body_html}
</main>
{foot(up or "./", "baeypro@gmail.com")}
<script type="application/json" id="pdata">{{"id":"_","base":"{up or "/"}","img":{{}},"eds":[],"alt":{{}}}}</script>
{LIGHTBOX}
<script src="{up or "./"}assets/projet.js"></script>
</body>
</html>
'''
    return page

def build(site, base):
    global SITE_DIR
    SITE_DIR = site
    D = json.load(open(os.path.join(base, "build", "data.json"), encoding="utf-8"))
    SITE = json.load(open(os.path.join(base, "content", "site.json"), encoding="utf-8"))
    global CSP  # même règle que la page d'accueil : seule l'adresse du serveur fixée dans les réglages, sinon workers.dev
    m = re.match(r"https://[^/\s\"']+", (SITE.get("api") or "").strip())
    CSP = CSP_TPL.replace("__API__", m.group(0) if m else "https://*.workers.dev")
    NCH = len(D["chapters"])
    all_projects = [(c, p) for c in D["chapters"] for p in c["projects"]]
    paths = []
    if D.get("pages", True):
        for ci, c in enumerate(D["chapters"]):
            for p in c["projects"]:
                if p.get("page") is False: continue
                paths.append(project_page(site, D, c, ci, p, NCH, all_projects, SITE))
        projects_index(site, D, all_projects, SITE)
        paths.append("/projets/")
    return paths
