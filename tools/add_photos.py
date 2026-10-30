# Add prepared photos to the site: 1800px WebP (q82) + 16px LQIP, appended to meta.json and to ids[group].
# Rejects near-duplicates of photos already on the site (difference hash distance <= 6) unless --force.
# usage: python3 tools/add_photos.py --img ../site/img/f --group afroteo-2026-nov file1.jpg file2.jpg ...
import argparse, base64, io, json, os
from PIL import Image
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--img', required=True); ap.add_argument('--group', required=True)
ap.add_argument('--force', action='store_true'); ap.add_argument('files', nargs='+')
a = ap.parse_args()
P = lambda *x: os.path.join(BASE, *x)
meta = json.load(open(P('meta.json'))); ids = json.load(open(P('new', 'ids.json')))
hashes = json.load(open(P('hashes.json'))) if os.path.exists(P('hashes.json')) else {}
def dhash(im):
    g = im.convert('L').resize((9, 8), Image.LANCZOS); px = list(g.getdata()); v = 0
    for r in range(8):
        for c in range(8): v = (v << 1) | (px[r * 9 + c] > px[r * 9 + c + 1])
    return v
for k in meta:
    if k not in hashes: hashes[k] = dhash(Image.open(os.path.join(a.img, f'{int(k):03d}.webp')))
def webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()
nxt = max(int(k) for k in meta) + 1
added, rejected = [], []
for f in a.files:
    im = Image.open(f).convert('RGB'); h = dhash(im)
    near = min(((bin(h ^ v).count('1'), k) for k, v in hashes.items()), default=(99, None))
    if near[0] <= 6 and not a.force: rejected.append({'file': f, 'like': int(near[1]), 'dist': near[0]}); continue
    full = im.copy(); full.thumbnail((1800, 1800), Image.LANCZOS)
    q = im.copy(); q.thumbnail((16, 16), Image.LANCZOS)
    i = nxt; nxt += 1
    open(os.path.join(a.img, f'{i:03d}.webp'), 'wb').write(webp(full, 82))
    meta[str(i)] = {'w': full.width, 'h': full.height, 'q': base64.b64encode(webp(q, 50)).decode()}
    hashes[str(i)] = h; added.append(i)
ids.setdefault(a.group, []).extend(added)
json.dump(meta, open(P('meta.json'), 'w')); json.dump(ids, open(P('new', 'ids.json'), 'w')); json.dump(hashes, open(P('hashes.json'), 'w'))
print(json.dumps({'group': a.group, 'added': added, 'rejected': rejected}))
