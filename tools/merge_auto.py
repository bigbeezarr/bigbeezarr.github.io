#!/usr/bin/env python3
"""Ajoute au contenu (content/portfolio.json) les photos décrites dans un fichier d'ajouts, au format de auto.json :

  {"editions": [{"project": "afroteo", "year": "2026", "label": "Vol. 2", "imgs": [439, 440]}],
   "projects": [{"chapter": "scene", "project": {"id": "dlb", "title": "DLB", "year": "2025", "imgs": [441, 442]}}]}

Une édition de même projet, année et libellé qu'une rubrique existante la complète ; sinon une rubrique est créée.
C'est le même fichier que l'administration modifie : les photos ajoutées par la tâche planifiée y sont donc visibles.

  python3 tools/merge_auto.py ajouts.json      # applique un fichier d'ajouts
  python3 tools/merge_auto.py                  # applique auto.json (ancien emplacement) puis le vide
"""
import json, os, re, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = os.path.join(BASE, "content", "portfolio.json")

def merge(port, add):
    chapters = port["chapters"]
    def find(pid):
        for c in chapters:
            for p in c["projects"]:
                if p["id"] == pid: return c, p
        raise SystemExit(f"projet inconnu : {pid}")
    ids = {p["id"] for c in chapters for p in c["projects"]}
    for np in add.get("projects", []):
        pr = np["project"]
        if not re.fullmatch(r"[a-z0-9-]{1,40}", pr.get("id", "")) or pr["id"] in ids: raise SystemExit(f"identifiant de projet invalide ou déjà pris : {pr.get('id')}")
        ch = next((c for c in chapters if c["id"] == np["chapter"]), None)
        if not ch: raise SystemExit(f"chapitre inconnu : {np['chapter']}")
        ch["projects"].append(pr); ids.add(pr["id"])
    for ad in add.get("editions", []):
        _, p = find(ad["project"])
        if "eds" not in p:
            first = {"year": p.get("year", ""), "imgs": p.pop("imgs")}
            for k in ("feature", "order"):
                if k in p: first[k] = p.pop(k)
            p["eds"] = [first]
        ed = next((e for e in p["eds"] if str(e.get("year", "")) == str(ad["year"]) and e.get("label") == ad.get("label")), None)
        if ed: ed["imgs"] = ed["imgs"] + list(ad["imgs"])
        else:
            ed = {k: v for k, v in ad.items() if k in ("year", "label", "sub", "place", "city", "order", "brand")}
            ed["imgs"] = list(ad["imgs"]); p["eds"].append(ed)
            p["eds"].sort(key=lambda e: str(e.get("year", "")), reverse=True)
    seen, dup = set(), set()
    hp = os.path.join(BASE, "content", "home.json")
    if os.path.exists(hp):  # les photos de l'accueil comptent aussi : une photo n'est publiée qu'une fois
        h = json.load(open(hp, encoding="utf-8"))
        for i in h.get("hero", []) + h.get("about", []) + h.get("wall", []) + ([h["me"]] if "me" in h else []): seen.add(i)
    for c in chapters:
        for p in c["projects"]:
            for e in p.get("eds", [p]):
                for i in e["imgs"]:
                    (dup if i in seen else seen).add(i)
    if dup: raise SystemExit(f"photos en double après l'ajout : {sorted(dup)}")
    return port

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "auto.json")
    add = json.load(open(src))
    if not add.get("editions") and not add.get("projects"): print("rien à ajouter"); sys.exit(0)
    port = merge(json.load(open(PORT, encoding="utf-8")), add)
    with open(PORT, "w", encoding="utf-8") as f: json.dump(port, f, ensure_ascii=False, indent=1); f.write("\n")
    if len(sys.argv) == 1: json.dump({"editions": [], "projects": []}, open(src, "w"))
    n = sum(len(e["imgs"]) for e in add.get("editions", [])) + sum(len(x["project"].get("imgs", [])) for x in add.get("projects", []))
    print(f"ajouté : {n} photos, {len(add.get('editions', []))} édition(s), {len(add.get('projects', []))} projet(s)")
