# Find photos edited since the last run in the Lightroom export folders (paths are relative to ~/mnt).
# usage: python3 scan_new.py --init        record every current photo as known (no new photos)
#        python3 scan_new.py               write state/new.json with new photos grouped by folder
#        python3 scan_new.py --mark-all    after a successful update, record everything in new.json as known
import os, sys, json, unicodedata
MNT = os.path.expanduser('~/mnt')
ROOTS = [d for d in os.listdir(MNT) if 'lightroom' in d.lower()]
HOME = os.path.join(MNT, next(d for d in ROOTS if d.startswith('Lightroom Saved')), '.bigbeezarr-site')
STATE = os.path.join(HOME, 'state'); os.makedirs(STATE, exist_ok=True)
KNOWN = os.path.join(STATE, 'known.json'); NEW = os.path.join(STATE, 'new.json')
EXT = ('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.heic', '.webp')
SKIP = ['/graphics/', 'friends n family', 'friends and family', 'weddings', 'mariage', 'souvenirs', 'birthday', 'graduation', 'playlist']
def norm(s): return unicodedata.normalize('NFC', s)
def walk():
    for r in ROOTS:
        for d, dirs, files in os.walk(os.path.join(MNT, r)):
            dirs[:] = [x for x in dirs if not x.startswith('.')]
            for f in files:
                if f.lower().endswith(EXT) and not f.startswith('.'):
                    yield norm(os.path.relpath(os.path.join(d, f), MNT))
known = set(json.load(open(KNOWN))) if os.path.exists(KNOWN) else set()
if '--init' in sys.argv:
    allf = sorted(set(walk())); json.dump(allf, open(KNOWN, 'w'), ensure_ascii=False); print('known', len(allf)); sys.exit()
if '--mark-all' in sys.argv:
    n = json.load(open(NEW)); add = [f for g in list(n['new'].values()) + list(n['skipped'].values()) for f in g]
    known |= set(add); json.dump(sorted(known), open(KNOWN, 'w'), ensure_ascii=False); print('marked', len(add), 'known', len(known)); sys.exit()
new, skipped = {}, {}
for f in walk():
    if f in known: continue
    d = os.path.dirname(f); low = '/' + f.lower()
    (skipped if any(s in low for s in SKIP) else new).setdefault(d, []).append(f)
for g in (new, skipped):
    for d in g: g[d].sort()
json.dump({'new': new, 'skipped': skipped}, open(NEW, 'w'), ensure_ascii=False, indent=1)
print('new photos:', sum(map(len, new.values())), 'in', len(new), 'folders; skipped:', sum(map(len, skipped.values())))
for d, fs in sorted(new.items()): print(f'  {len(fs):4d}  {d}')
for d, fs in sorted(skipped.items()): print(f'  skip {len(fs):4d}  {d}')
