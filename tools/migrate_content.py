"""Migration unique : sort les données du portfolio de build.py (code Python) vers content/*.json.

Exécute l'ancien build.py jusqu'au contrôle des images (résolution des listes d'ids, ajouts auto.json,
retraits), puis écrit content/portfolio.json et content/home.json. Rejouable sur une version plus récente
de build.py : python3 tools/migrate_content.py <chemin de l'ancien build.py>
"""
import json, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
legacy = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'build.py')
src = open(legacy, encoding='utf-8').read()
cut = src.index('# ---- colour:')
ns = {'__file__': os.path.join(BASE, 'build.py'), '__name__': 'legacy'}
exec(compile(src[:cut], legacy, 'exec'), ns)
chapters = ns['CHAPTERS']
for c in chapters:
    for p in c['projects']:
        for e in p.get('eds', [p]):
            e['imgs'] = [int(i) for i in e['imgs']]
home = {
    'hero': [int(i) for i in ns['HERO']],
    'heroLab': {str(k): v for k, v in ns['HERO_LAB'].items()},
    'about': [int(i) for i in ns['ABOUT']],
    'wall': [int(i) for i in ns['WALL']],
    'me': int(ns['ME']),
    'cap': {str(k): v for k, v in ns['CAP'].items()},
}
os.makedirs(os.path.join(BASE, 'content'), exist_ok=True)
json.dump({'chapters': chapters}, open(os.path.join(BASE, 'content', 'portfolio.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(home, open(os.path.join(BASE, 'content', 'home.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(len(e['imgs']) for c in chapters for p in c['projects'] for e in p.get('eds', [p]))
print('ok', len(chapters), 'chapitres', sum(len(c['projects']) for c in chapters), 'projets', n, 'photos dans les rubriques')
