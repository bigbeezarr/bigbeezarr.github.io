# Responsive copies of every photo: img/m (960 px) and img/s (480 px) on the long side, made from img/f (1800 px).
# Only missing or outdated copies are written, so running it at every publish is cheap.
import os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image
SIZES = (("m", 960), ("s", 480))
def _one(args):
    root, name = args
    src = os.path.join(root, "f", name); made = 0
    st = os.stat(src).st_mtime
    im = None
    for d, n in SIZES:
        dst = os.path.join(root, d, name)
        if os.path.exists(dst) and os.stat(dst).st_mtime >= st: continue
        if im is None: im = Image.open(src); im.load()
        if max(im.size) <= n * 1.05:
            if os.path.exists(dst): os.remove(dst)
            continue
        c = im.copy(); c.thumbnail((n, n), Image.LANCZOS)
        c.save(dst, "WEBP", quality=80 if d == "m" else 76, method=4); made += 1
    return made
def ensure(root):
    for d, _ in SIZES: os.makedirs(os.path.join(root, d), exist_ok=True)
    names = sorted(f for f in os.listdir(os.path.join(root, "f")) if f.endswith(".webp"))
    with ProcessPoolExecutor(os.cpu_count() or 2) as ex: made = sum(ex.map(_one, [(root, n) for n in names], chunksize=16))
    keep = set(names)
    for d, _ in SIZES:  # drop copies of retired photos
        for f in os.listdir(os.path.join(root, d)):
            if f not in keep: os.remove(os.path.join(root, d, f))
    return made
if __name__ == "__main__":
    print("variants", ensure(sys.argv[1] if len(sys.argv) > 1 else "img"))
