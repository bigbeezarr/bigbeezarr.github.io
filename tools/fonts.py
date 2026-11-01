"""Polices hébergées sur le site (au lieu de Google Fonts) : sous-ensemble latin des fontes variables, en WOFF2.
Sources : github.com/google/fonts (licence SIL Open Font License, copie dans fonts/OFL-*.txt).
usage : PYTHONPATH=tools/pyshim python3 tools/fonts.py /chemin/vers/google/fonts
"""
import os, sys, shutil
from fontTools import subset
from fontTools.ttLib import TTFont
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fonts')
# Latin de base, Latin-1, Latin étendu A (wolof : ŋ, ñ, ë...), ponctuation typographique, flèches, ronds, €
U = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x1E9E] + \
    list(range(0x2010, 0x2028)) + list(range(0x2030, 0x203B)) + [0x202F, 0x2044, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x25CF, 0x2032, 0x2033]
JOBS = [
    ('ofl/archivo/Archivo[wdth,wght].ttf', 'archivo.woff2'),
    ('ofl/schibstedgrotesk/SchibstedGrotesk[wght].ttf', 'schibsted.woff2'),
    ('ofl/schibstedgrotesk/SchibstedGrotesk-Italic[wght].ttf', 'schibsted-italic.woff2'),
]
os.makedirs(OUT, exist_ok=True)
for src, dst in JOBS:
    f = TTFont(os.path.join(SRC, src))
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=U); s.subset(f)
    f.flavor = 'woff2'; f.save(os.path.join(OUT, dst))
    print(dst, os.path.getsize(os.path.join(OUT, dst)) // 1024, 'Ko')
shutil.copy(os.path.join(SRC, 'ofl/archivo/OFL.txt'), os.path.join(OUT, 'OFL-Archivo.txt'))
shutil.copy(os.path.join(SRC, 'ofl/schibstedgrotesk/OFL.txt'), os.path.join(OUT, 'OFL-SchibstedGrotesk.txt'))
