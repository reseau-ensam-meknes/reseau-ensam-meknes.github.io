# Polices du site, gardées sur le site lui-même (src/polices) et allégées pour la 3G :
#  - Bricolage Grotesque (titres) : une police variable limitée aux graisses 600 à 750, taille optique fixée à 24 ;
#  - IBM Plex Sans (texte) : une police variable limitée aux graisses 400 à 600 ;
#    toutes deux pour les lettres du français (et des noms en lettres latines), pas tout le latin étendu ;
#  - IBM Plex Sans Arabic : 400, 500, 600, 700, lettres arabes seulement (téléchargée seulement en arabe).
# Sans hinting ni tables inutiles. Licence SIL Open Font License 1.1 (src/polices/OFL.txt) : une version modifiée
# ne garde pas le nom réservé « Plex », d'où les noms « Texte ENSAM » et « Texte ENSAM arabe ».
# Lancer depuis le dossier source (réseau nécessaire, Python avec fonttools et brotli) :
#   pip install fonttools brotli && python3 outils/generer-polices.py
import io, os, re, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
CSS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,750&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'polices')

def plage(s):
    out = []
    for p in s.split(','):
        p = p.strip().replace('U+', '')
        if '-' in p:
            a, b = p.split('-'); out += range(int(a, 16), int(b, 16) + 1)
        else:
            out.append(int(p, 16))
    return out

# Latin : ASCII, lettres accentuées, guillemets, tirets, espaces et ponctuation du français (les mêmes plages que
# unicode-range dans page.html : un autre caractère prend la police du système). L'arabe : lettres, signes, chiffres, isolants bidi
LATIN = 'U+0020-007E, U+00A0, U+00A9, U+00AB, U+00B0, U+00B7, U+00BB, U+00C0-00FF, U+0152-0153, U+2000-200B, U+2010-2011, U+2013-2014, U+2018-2019, U+201C-201D, U+2022, U+2026, U+202F, U+2039-203A, U+20AC, U+2212'
ARABE = 'U+0600-0603, U+060C, U+061B, U+061F, U+0621-063A, U+0640-0652, U+0660-066C, U+0670, U+067E, U+0686, U+06A4, U+06A9, U+06AD, U+06AF, U+06CC, U+200C-200F, U+2066-2069'

def lire(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})).read()

def sources():
    css = lire(CSS).decode()
    out = {}
    for m in re.finditer(r"/\* (\S+) \*/\s*@font-face \{(.*?)\}", css, re.S):
        sous, b = m.group(1), m.group(2)
        fam = re.search(r"font-family: '([^']+)'", b).group(1)
        w = int(re.search(r"font-weight: (\d+)", b).group(1))
        out[(fam, sous, w)] = re.search(r"url\(([^)]+)\)", b).group(1)
    return out

def nommer(f, famille, style):
    nom = f['name']
    nom.names = [n for n in nom.names if n.nameID in (0, 13, 14)]
    for i, v in ((1, famille), (2, 'Regular'), (4, f'{famille} {style}'), (6, (famille + '-' + style).replace(' ', '')), (5, 'Version 1.0 (réseau ENSAM)')):
        nom.setName(v, i, 3, 1, 0x409)
    nom.setName('Sous-ensemble allégé pour le Réseau ENSAM Meknès (outils/generer-polices.py).', 10, 3, 1, 0x409)

def faire(url, sortie, axes, unicodes, famille, style):
    f = TTFont(io.BytesIO(lire(url)))
    o = subset.Options(); o.hinting = False; o.desubroutinize = True; o.notdef_outline = True; o.glyph_names = False
    o.layout_features = ['kern', 'liga', 'ccmp', 'locl', 'mark', 'mkmk', 'calt', 'tnum', 'pnum', 'init', 'medi', 'fina', 'isol', 'rlig']
    o.name_IDs = ['*']; o.name_languages = [0x409]
    s = subset.Subsetter(o); s.populate(unicodes=plage(unicodes)); s.subset(f)
    if axes and 'fvar' in f:
        f = instancer.instantiateVariableFont(f, axes, updateFontNames=False)
    if 'fvar' not in f:
        for t in ('STAT', 'MVAR', 'DSIG'):
            if t in f: del f[t]
    nommer(f, famille, style)
    f.flavor = 'woff2'; f.save(os.path.join(SORTIE, sortie))
    print(sortie, os.path.getsize(os.path.join(SORTIE, sortie)), 'octets')

if __name__ == '__main__':
    os.makedirs(SORTIE, exist_ok=True)
    src = sources()
    faire(src[('Bricolage Grotesque', 'latin', 600)], 'titres.woff2', {'opsz': 24, 'wght': (600, 750)}, LATIN, 'Titres ENSAM', 'Variable')
    faire(src[('IBM Plex Sans', 'latin', 400)], 'texte.woff2', {'wght': (400, 600)}, LATIN, 'Texte ENSAM', 'Variable')
    for w in (400, 500, 600, 700):
        faire(src[('IBM Plex Sans Arabic', 'arabic', w)], f'arabe-{w}.woff2', None, ARABE, 'Texte ENSAM arabe', str(w))
