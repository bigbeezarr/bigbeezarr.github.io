# Downscale chosen photos to 2400px JPEGs ready to stage: .bigbeezarr-site/prep/<group>/<group>-NN.jpg + map.json
# usage: python3 prep.py GROUP LISTFILE   (one path per line, relative to ~/mnt)
import sys, os, json
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
MNT = os.path.expanduser('~/mnt'); group, lst = sys.argv[1], sys.argv[2]
out = os.path.join(MNT, 'Lightroom Saved Photos', '.bigbeezarr-site', 'prep', group); os.makedirs(out, exist_ok=True)
mp = {}
for k, rel in enumerate([l.rstrip('\n') for l in open(lst, encoding='utf-8') if l.strip()]):
    im = Image.open(os.path.join(MNT, rel)); im.draft('RGB', (2400, 2400)); im = ImageOps.exif_transpose(im).convert('RGB')
    im.thumbnail((2400, 2400), Image.LANCZOS); n = f'{group}-{k:02d}.jpg'; im.save(os.path.join(out, n), quality=92); mp[n] = rel
json.dump(mp, open(os.path.join(out, 'map.json'), 'w'), ensure_ascii=False, indent=0); print(group, len(mp), out)
