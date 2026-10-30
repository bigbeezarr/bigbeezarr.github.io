# Numbered contact sheet of photos (paths relative to ~/mnt), written to .bigbeezarr-site/sheets/<name>.jpg + .json
# usage: python3 sheet.py NAME LISTFILE [H=150] [W=1600]
import sys, os, json
from PIL import Image, ImageDraw, ImageFont, ImageOps
Image.MAX_IMAGE_PIXELS = None
MNT = os.path.expanduser('~/mnt'); OUT = os.path.join(MNT, 'Lightroom Saved Photos', '.bigbeezarr-site', 'sheets'); os.makedirs(OUT, exist_ok=True)
name, lst = sys.argv[1], sys.argv[2]; H = int(sys.argv[3]) if len(sys.argv) > 3 else 150; W = int(sys.argv[4]) if len(sys.argv) > 4 else 1600
files = [l.rstrip('\n') for l in open(lst, encoding='utf-8') if l.strip()]
try: font = ImageFont.load_default(size=22)
except Exception: font = ImageFont.load_default()
ims = []
for k, f in enumerate(files):
    try:
        im = Image.open(os.path.join(MNT, f)); im.draft('RGB', (H * 3, H * 3)); im = ImageOps.exif_transpose(im).convert('RGB')
        ims.append((k, im.resize((max(1, int(im.width * H / im.height)), H))))
    except Exception as e: print('ERR', f, e)
rows, cur, x = [], [], 0
for t in ims:
    if cur and x + t[1].width > W: rows.append(cur); cur, x = [], 0
    cur.append(t); x += t[1].width + 5
if cur: rows.append(cur)
sh = Image.new('RGB', (W, max(1, len(rows)) * (H + 5)), (25, 25, 25)); d = ImageDraw.Draw(sh)
for r, row in enumerate(rows):
    x = 0
    for k, im in row:
        sh.paste(im, (x, r * (H + 5))); d.rectangle([x, r * (H + 5), x + 40, r * (H + 5) + 26], fill=(230, 20, 28)); d.text((x + 4, r * (H + 5) + 1), str(k), fill='white', font=font); x += im.width + 5
sh.save(os.path.join(OUT, name + '.jpg'), quality=78); json.dump(files, open(os.path.join(OUT, name + '.json'), 'w'), ensure_ascii=False)
print(name, len(files), sh.size)
