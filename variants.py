# Responsive copies of every photo: img/m (960 px) and img/s (480 px) on the long side, made from img/f (1800 px).
# Only missing or outdated copies are written, so running it at every publish is cheap.
# "Outdated" is decided by content, not by file dates (a fresh git checkout gives every file the same date):
# img/.variants.json keeps a short fingerprint of each img/f photo the copies were made from.
import hashlib, json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image
SIZES = (("m", 960), ("s", 480))
def fingerprint(path):
    with open(path, "rb") as f: return hashlib.sha1(f.read()).hexdigest()[:16]
def _one(args):
    root, name, old = args
    src = os.path.join(root, "f", name); fp = fingerprint(src); made = 0
    im = None
    for d, n in SIZES:
        dst = os.path.join(root, d, name)
        if os.path.exists(dst) and (old == fp or old is None): continue  # None: no record yet, trust the existing copy once
        if im is None: im = Image.open(src); im.load()
        if max(im.size) <= n * 1.05:
            if os.path.exists(dst): os.remove(dst)
            continue
        c = im.copy(); c.thumbnail((n, n), Image.LANCZOS)
        c.save(dst, "WEBP", quality=80 if d == "m" else 76, method=4); made += 1
    return name, fp, made
def ensure(root):
    for d, _ in SIZES: os.makedirs(os.path.join(root, d), exist_ok=True)
    man_path = os.path.join(root, ".variants.json")
    try: man = json.load(open(man_path))
    except Exception: man = {}
    names = sorted(f for f in os.listdir(os.path.join(root, "f")) if f.endswith(".webp"))
    with ProcessPoolExecutor(os.cpu_count() or 2) as ex:
        res = list(ex.map(_one, [(root, n, man.get(n)) for n in names], chunksize=16))
    made = sum(r[2] for r in res)
    json.dump({n: fp for n, fp, _ in res}, open(man_path, "w"), indent=0, sort_keys=True)
    keep = set(names)
    for d, _ in SIZES:  # drop copies of retired photos
        for f in os.listdir(os.path.join(root, d)):
            if f not in keep: os.remove(os.path.join(root, d, f))
    return made
if __name__ == "__main__":
    print("variants", ensure(sys.argv[1] if len(sys.argv) > 1 else "img"))
