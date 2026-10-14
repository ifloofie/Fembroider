import base64, json
F = 'node_modules/@fontsource/'
def b64(slug, w):
    return base64.b64encode(open(f'{F}{slug}/files/{slug}-latin-{w}-normal.woff2', 'rb').read()).decode()
design_fonts = [
  # name, slug, weight, style label, swoop by default, slant, filter group  (licence comes from the package)
  ('Yellowtail', 'yellowtail', 400, 'Script', True, 7, 'Script'),
  ('Pacifico', 'pacifico', 400, 'Retro script', True, 6, 'Script'),
  ('Dancing Script', 'dancing-script', 700, 'Casual script', True, 5, 'Script'),
  ('Lobster', 'lobster', 400, 'Bold script', True, 6, 'Script'),
  ('Kaushan Script', 'kaushan-script', 400, 'Brush', True, 6, 'Script'),
  ('Satisfy', 'satisfy', 400, 'Signature', True, 6, 'Script'),
  ('Great Vibes', 'great-vibes', 400, 'Formal script', False, 0, 'Script'),
  ('Damion', 'damion', 400, 'Sport script', True, 7, 'Script'),
  ('Cookie', 'cookie', 400, 'Diner script', True, 5, 'Script'),
  ('Lobster Two', 'lobster-two', 700, 'Bold script', True, 5, 'Script'),
  ('Leckerli One', 'leckerli-one', 400, 'Fat script', True, 5, 'Script'),
  ('Grand Hotel', 'grand-hotel', 400, 'Hotel script', True, 6, 'Script'),
  ('Norican', 'norican', 400, 'Pen script', True, 5, 'Script'),
  ('Mr Dafoe', 'mr-dafoe', 400, 'Brush signature', True, 7, 'Script'),
  ('Rochester', 'rochester', 400, 'Vintage script', True, 4, 'Script'),
  ('Courgette', 'courgette', 400, 'Casual script', True, 4, 'Script'),
  ('Berkshire Swash', 'berkshire-swash', 400, 'Swash serif', False, 0, 'Script'),
  ('Graduate', 'graduate', 400, 'Varsity', False, 0, 'Athletic'),
  ('Oswald', 'oswald', 700, 'Jersey', False, 0, 'Athletic'),
  ('Anton', 'anton', 400, 'Impact', False, 0, 'Athletic'),
  ('Teko', 'teko', 600, 'Squared', False, 0, 'Athletic'),
  ('Russo One', 'russo-one', 400, 'Sport', False, 0, 'Athletic'),
  ('Racing Sans One', 'racing-sans-one', 400, 'Racing italic', False, 3, 'Athletic'),
  ('Fugaz One', 'fugaz-one', 400, 'Sport italic', False, 3, 'Athletic'),
  ('Squada One', 'squada-one', 400, 'Tech squared', False, 0, 'Athletic'),
  ('Black Ops One', 'black-ops-one', 400, 'Stencil', False, 0, 'Athletic'),
  ('Holtwood One SC', 'holtwood-one-sc', 400, 'Wide slab', False, 0, 'Athletic'),
  ('Alfa Slab One', 'alfa-slab-one', 400, 'Slab', False, 0, 'Block'),
  ('Bebas Neue', 'bebas-neue', 400, 'Condensed', False, 0, 'Block'),
  ('Bungee', 'bungee', 400, 'Signage', False, 0, 'Block'),
  ('Archivo Black', 'archivo-black', 400, 'Heavy sans', False, 0, 'Block'),
  ('Staatliches', 'staatliches', 400, 'Poster', False, 0, 'Block'),
  ('Passion One', 'passion-one', 700, 'Heavy', False, 0, 'Block'),
  ('Bowlby One SC', 'bowlby-one-sc', 400, 'Heavy caps', False, 0, 'Block'),
  ('Changa One', 'changa-one', 400, 'Display', False, 0, 'Block'),
  ('Ultra', 'ultra', 400, 'Fat slab', False, 0, 'Block'),
  ('Abril Fatface', 'abril-fatface', 400, 'Didone', False, 0, 'Serif'),
  ('Playfair Display', 'playfair-display', 800, 'Serif', False, 0, 'Serif'),
  ('Cinzel', 'cinzel', 700, 'Roman caps', False, 0, 'Serif'),
  ('Rye', 'rye', 400, 'Western', False, 0, 'Serif'),
  ('UnifrakturMaguntia', 'unifrakturmaguntia', 400, 'Blackletter', False, 0, 'Serif'),
  ('Pirata One', 'pirata-one', 400, 'Modern blackletter', False, 0, 'Serif'),
  ('Titan One', 'titan-one', 400, 'Rounded', False, 0, 'Fun'),
  ('Lilita One', 'lilita-one', 400, 'Chunky', False, 0, 'Fun'),
  ('Fredoka', 'fredoka', 600, 'Rounded', False, 0, 'Fun'),
  ('Baloo 2', 'baloo-2', 800, 'Bubbly', False, 0, 'Fun'),
  ('Comfortaa', 'comfortaa', 700, 'Geometric', False, 0, 'Fun'),
  ('Caveat', 'caveat', 700, 'Handwritten', False, 0, 'Fun'),
  ('Merienda', 'merienda', 700, 'Casual', False, 0, 'Fun'),
  ('Permanent Marker', 'permanent-marker', 400, 'Marker', False, 0, 'Fun'),
]
def licence(slug):
    l = json.load(open(f'{F}{slug}/package.json')).get('license', '')
    return {'OFL-1.1': 'OFL 1.1', 'Apache-2.0': 'Apache 2.0'}.get(l, l)
ui_fonts = [('IBM Plex Sans', 'ibm-plex-sans', w) for w in (400, 500, 600, 700)] + \
           [('IBM Plex Mono', 'ibm-plex-mono', w) for w in (400, 500)] + \
           [('Saira Extra Condensed', 'saira-extra-condensed', w) for w in (700, 800)]
themes = [
  # name, fill, stroke, stroke2, shadow, fabric
  ('Home', '#b3202f', '#16233f', '#f4f2ee', '#8a8f99', '#ece4d3'),
  ('Road', '#1b2b4d', '#c02a37', '#f4f2ee', '#3a3f48', '#9a9fa6'),
  ('Powder', '#f4f2ee', '#1d3461', '#c8102e', '#5b6b82', '#8fb3d6'),
  ('Dodger', '#005a9c', '#ffffff', '#ef3e42', '#a5acaf', '#f4f4f2'),
  ('Kelly & Gold', '#00703c', '#ffc72c', '#ffffff', '#1f2a1f', '#f2efe6'),
  ('Halloween', '#f26b1d', '#111111', '#7a3b9e', '#3a2a46', '#2a2730'),
  ('Pastel', '#f6a5c0', '#5fb49c', '#ffffff', '#c9b6e4', '#fff7ef'),
  ('Monochrome', '#111111', '#ffffff', '#111111', '#6b6b6b', '#d9d9d9'),
  ('Black & Gold', '#d4af37', '#111111', '#d4af37', '#4a3b12', '#1c1c1c'),
  ('Sunset', '#ff7a00', '#7b2d26', '#ffd166', '#3d1f1b', '#fff1d6'),
  ('Neon', '#ff2e88', '#00e5ff', '#1a1a2e', '#6a00f4', '#14141f'),
  ('Denim', '#e9c46a', '#f4f1de', '#264653', '#1d3557', '#3d5a80'),
]
# Pride colourways: one entry per flag, each with several colourways. Solid colourways carry the flag's colours
# through the fill, outline, second outline, shadow and fabric; "Stripes" sews the fill in flag order.
# Every thread colour is a Janome chart colour (the nearest match to the flag), so the preview is what sews.
T = dict(red='#ff0000', orange='#ff6600', honey='#ff9805', canary='#ffe505', sun='#ffcb00', ocher='#cb8a1a', bgreen='#1a842d',
         ocean='#386cae', royal='#540571', pink='#f669a0', yellow='#ffff17', meadow='#4c881f', sky='#65c2c8', vblue='#523a97',
         black='#000000', sienna='#4d3419', white='#ffffff', ppink='#f999b7', peony='#c3007e', purple='#ab5a96', blue='#0b2f84',
         crimson='#f33689', burnt='#e3311f', peach='#fab381', floral='#de649e', burgundy='#80004b', gray='#889b9b',
         mgreen='#5c941a', gdust='#b2dd53', pviolet='#ac9cc7', silver='#e5e5e5', navy='#071650', dgray='#595b61',
         peacock='#007772', emerald='#4cbf8f', paqua='#98d6bd', psky='#a0b8cc', sola='#1e77ac', bbright='#4f83ab')
R6 = ['red', 'honey', 'canary', 'bgreen', 'ocean', 'royal']
W, K, N = '#f4f4f2', '#1c1c1c', '#2a2730'   # white, black and charcoal fabric
S2, SH = {'stroke2': True}, {'stroke2': True, 'shadow': True}
# flag: (name, flag stripes as shown on the card, note, extra, [(colourway, fill, stroke, stroke2, shadow, fabric, effects, stripes or None)])
flags = [
  ('Rainbow', R6, 'The six-stripe rainbow flag', {}, [
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, R6),
    ('Night stripes', None, 'white', 'dgray', 'dgray', K, {}, R6),
    ('Layered', 'red', 'canary', 'ocean', 'royal', W, SH, None),
    ('Violet', 'royal', 'canary', 'red', 'bgreen', W, S2, None)]),
  ('Progress', R6 + ['white', 'ppink', 'sky', 'sienna', 'black'], 'Progress Pride: the rainbow with a chevron of white, pink, light blue, brown and black', {'chevron': ['white', 'ppink', 'sky', 'sienna', 'black']}, [
    ('Stripes', None, 'white', 'ppink', 'sky', K, SH, R6),
    ('Chevron', 'sky', 'ppink', 'white', 'sienna', K, SH, None),
    ('Rainbow edge', 'white', 'red', 'canary', 'ocean', K, SH, None)]),
  ('Philadelphia', ['black', 'sienna'] + R6, 'Philadelphia\'s eight stripes, adding black and brown', {}, [
    ('Stripes', None, 'white', 'black', 'dgray', '#9a9fa6', {}, ['black', 'sienna'] + R6),
    ('Brown & gold', 'sienna', 'canary', 'black', 'red', W, S2, None)]),
  ('Baker 1978', ['pink', 'red', 'honey', 'yellow', 'meadow', 'sky', 'vblue', 'royal'], 'Gilbert Baker\'s original eight-stripe flag with hot pink and turquoise', {}, [
    ('Stripes', None, 'white', 'navy', 'dgray', '#1b2b4d', {}, ['pink', 'red', 'honey', 'yellow', 'meadow', 'sky', 'vblue', 'royal']),
    ('Hot pink', 'pink', 'sky', 'vblue', 'yellow', W, S2, None)]),
  ('Transgender', ['sky', 'ppink', 'white', 'ppink', 'sky'], 'Light blue, pink and white', {}, [
    ('Pink', 'ppink', 'white', 'sky', 'dgray', '#1d2433', S2, None),
    ('Blue', 'sky', 'white', 'ppink', 'dgray', W, S2, None),
    ('White', 'white', 'ppink', 'sky', 'dgray', '#1d2433', S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['sky', 'ppink', 'white', 'ppink', 'sky'])]),
  ('Lesbian', ['burnt', 'orange', 'peach', 'white', 'floral', 'purple', 'burgundy'], 'The seven-stripe sunset lesbian flag', {}, [
    ('Sunset', 'orange', 'white', 'burgundy', 'floral', '#fff7ef', SH, None),
    ('Rose', 'floral', 'white', 'burnt', 'burgundy', N, S2, None),
    ('Stripes', None, 'black', 'white', 'dgray', '#fff7ef', {}, ['burnt', 'orange', 'peach', 'white', 'floral', 'purple', 'burgundy'])]),
  ('Gay', ['peacock', 'emerald', 'paqua', 'white', 'psky', 'vblue', 'royal'], 'The seven-stripe gay men\'s flag in greens, white and blues', {}, [
    ('Teal', 'emerald', 'white', 'vblue', 'peacock', W, SH, None),
    ('Violet', 'vblue', 'paqua', 'royal', 'peacock', W, S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['peacock', 'emerald', 'paqua', 'white', 'psky', 'vblue', 'royal'])]),
  ('Bisexual', ['peony', 'peony', 'purple', 'blue', 'blue'], 'Magenta, purple and blue in a 2 : 1 : 2 ratio', {}, [
    ('Magenta', 'peony', 'purple', 'blue', 'dgray', W, S2, None),
    ('Blue', 'blue', 'purple', 'peony', 'dgray', W, S2, None),
    ('Purple night', 'purple', 'peony', 'blue', 'dgray', K, S2, None),
    ('Stripes', None, 'white', 'peony', 'dgray', K, {}, ['peony', 'peony', 'purple', 'blue', 'blue'])]),
  ('Pansexual', ['crimson', 'canary', 'sola'], 'Pink, yellow and blue', {}, [
    ('Pink', 'crimson', 'canary', 'sola', 'dgray', W, S2, None),
    ('Yellow', 'canary', 'crimson', 'sola', 'dgray', K, S2, None),
    ('Blue', 'sola', 'canary', 'crimson', 'dgray', W, S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['crimson', 'canary', 'sola'])]),
  ('Omnisexual', ['ppink', 'floral', 'navy', 'ocean', 'psky'], 'Pale pink, pink, deep navy, periwinkle and pale blue', {}, [
    ('Pink', 'floral', 'navy', 'ppink', 'ocean', W, SH, None),
    ('Midnight', 'ppink', 'ocean', 'psky', 'floral', '#1a1633', S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['ppink', 'floral', 'navy', 'ocean', 'psky'])]),
  ('Polysexual', ['crimson', 'emerald', 'sola'], 'Pink, green and blue', {}, [
    ('Pink', 'crimson', 'emerald', 'sola', 'dgray', W, S2, None),
    ('Green', 'emerald', 'sola', 'crimson', 'dgray', K, S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['crimson', 'emerald', 'sola'])]),
  ('Asexual', ['black', 'gray', 'white', 'royal'], 'Black, grey, white and purple', {}, [
    ('Purple', 'royal', 'white', 'black', 'gray', '#a3a3a3', S2, None),
    ('Ace of spades', 'black', 'white', 'royal', 'gray', '#d9d9d9', S2, None),
    ('Grey', 'gray', 'royal', 'white', 'black', K, S2, None),
    ('Stripes', None, 'white', 'royal', 'dgray', N, {}, ['black', 'gray', 'white', 'royal'])]),
  ('Aromantic', ['mgreen', 'gdust', 'white', 'gray', 'black'], 'Green, light green, white, grey and black', {}, [
    ('Green', 'mgreen', 'white', 'black', 'gray', '#d9d9d9', S2, None),
    ('Light green', 'gdust', 'mgreen', 'white', 'gray', K, S2, None),
    ('Stripes', None, 'black', 'white', 'dgray', W, {}, ['mgreen', 'gdust', 'white', 'gray', 'black'])]),
  ('Aroace', ['ocher', 'sun', 'white', 'bbright', 'navy'], 'Orange, yellow, white, blue and navy', {}, [
    ('Sunrise', 'ocher', 'white', 'navy', 'bbright', W, SH, None),
    ('Sky', 'bbright', 'sun', 'white', 'navy', '#203856', S2, None),
    ('Stripes', None, 'navy', 'white', 'dgray', W, {}, ['ocher', 'sun', 'white', 'bbright', 'navy'])]),
  ('Demisexual', ['white', 'white', 'royal', 'silver', 'silver'], 'White, purple and grey with a black chevron', {'chevron': ['black']}, [
    ('Purple', 'royal', 'white', 'black', 'silver', '#d2d2d2', S2, None),
    ('Black', 'black', 'white', 'royal', 'silver', W, S2, None),
    ('Stripes', None, 'black', 'royal', 'dgray', '#d2d2d2', {}, ['white', 'white', 'royal', 'silver', 'silver'])]),
  ('Nonbinary', ['yellow', 'white', 'vblue', 'black'], 'Yellow, white, purple and black', {}, [
    ('Yellow', 'yellow', 'black', 'white', 'vblue', '#9c59d1', S2, None),
    ('Purple', 'vblue', 'yellow', 'black', 'dgray', W, S2, None),
    ('Stripes', None, 'black', 'yellow', 'dgray', W, {}, ['yellow', 'white', 'vblue', 'black'])]),
  ('Genderqueer', ['pviolet', 'white', 'meadow'], 'Lavender, white and green', {}, [
    ('Lavender', 'pviolet', 'meadow', 'white', 'dgray', N, S2, None),
    ('Green', 'meadow', 'white', 'pviolet', 'dgray', W, S2, None),
    ('Stripes', None, 'black', 'white', 'dgray', W, {}, ['pviolet', 'white', 'meadow'])]),
  ('Genderfluid', ['pink', 'white', 'purple', 'black', 'vblue'], 'Pink, white, purple, black and blue', {}, [
    ('Pink', 'pink', 'black', 'white', 'purple', '#2a2f5e', S2, None),
    ('Violet', 'purple', 'white', 'vblue', 'pink', K, S2, None),
    ('Stripes', None, 'black', 'white', 'dgray', W, {}, ['pink', 'white', 'purple', 'black', 'vblue'])]),
  ('Agender', ['black', 'silver', 'white', 'gdust', 'white', 'silver', 'black'], 'Black, grey, white and light green, mirrored', {}, [
    ('Mint', 'gdust', 'black', 'white', 'silver', '#bcc4c7', S2, None),
    ('Black', 'black', 'gdust', 'silver', 'dgray', W, S2, None),
    ('Stripes', None, 'dgray', 'white', 'dgray', W, {}, ['black', 'silver', 'white', 'gdust', 'white', 'silver', 'black'])]),
  ('Intersex', ['canary'], 'Yellow with a purple ring', {'ring': 'royal'}, [
    ('Ring', 'canary', 'royal', 'canary', 'royal', W, S2, None),
    ('Purple', 'royal', 'canary', 'royal', 'dgray', '#ffd800', S2, None)]),
  ('Polyamorous', ['sola', 'crimson', 'royal'], 'Blue, magenta and purple with a gold heart (2022 design)', {'heart': 'sun'}, [
    ('Gold heart', 'sun', 'crimson', 'royal', 'sola', W, SH, None),
    ('Magenta', 'crimson', 'sun', 'sola', 'royal', K, S2, None),
    ('Stripes', None, 'sun', 'white', 'dgray', K, {}, ['sola', 'crimson', 'royal'])]),
]
pride_themes, pride_flags = [], []
for fname, fstripes, note, extra, ways in flags:
    f = {'name': fname, 'stripes': [T[c] for c in fstripes], 'note': note}
    for k, v in extra.items(): f[k] = [T[c] for c in v] if isinstance(v, list) else T[v]
    pride_flags.append(f)
    for wname, fill, st, st2, sh, fab, fx, bands in ways:
        t = {'name': fname + ' · ' + wname, 'group': 'Pride', 'flag': fname, 'way': wname,
             'fill': T[bands[0]] if bands else T[fill], 'stroke': T[st], 'stroke2': T[st2], 'shadow': T[sh], 'fabric': fab}
        if bands: t['bands'] = [T[c] for c in bands]
        if fx: t['fx'] = fx
        pride_themes.append(t)
# Thread charts. Brand palettes come from Ink/Stitch (GPL-3.0, see vendor/inkstitch-palettes); Janome is the JEF chart.
def gpl(fname):
    out = []
    for line in open('vendor/inkstitch-palettes/InkStitch ' + fname + '.gpl', encoding='utf-8'):
        parts = line.strip().split()
        if len(parts) < 5 or not all(p.isdigit() for p in parts[:3]): continue
        r, g, b = (int(v) for v in parts[:3]); code = parts[-1]; name = ' '.join(parts[3:-1])
        out.append(['#%02x%02x%02x' % (r, g, b), name, code])
    return out
jef = json.load(open('src/jef_threads.json'))
thread_lines = [
  # id, brand, line, material, default weight, chart
  ('janome', 'Janome', 'Embroidery thread (JEF chart)', 'poly', 40, [t for t in jef if t]),
  ('isacord', 'Amann', 'Isacord 40', 'poly', 40, gpl('Isacord Polyester')),
  ('isafil', 'Amann', 'Isafil rayon', 'rayon', 40, gpl('Isafil Rayon')),
  ('madeira-rayon', 'Madeira', 'Classic Rayon', 'rayon', 40, gpl('Madeira Rayon')),
  ('madeira-polyneon', 'Madeira', 'Polyneon', 'poly', 40, gpl('Madeira Polyneon')),
  ('madeira-burmilana', 'Madeira', 'Burmilana (wool blend)', 'wool', 12, gpl('Madeira Burmilana')),
  ('sulky-rayon', 'Sulky', 'Rayon', 'rayon', 40, gpl('Sulky Rayon')),
  ('sulky-poly', 'Sulky', 'Polyester', 'poly', 40, gpl('Sulky Polyester')),
  ('ra-rayon', 'Robison-Anton', 'Rayon', 'rayon', 40, gpl('Robison-Anton Rayon')),
  ('ra-poly', 'Robison-Anton', 'Polyester', 'poly', 40, gpl('Robison-Anton Polyester')),
  ('gunold', 'Gunold', 'Poly', 'poly', 40, gpl('Gunold Polyester')),
  ('mettler', 'Mettler', 'Poly Sheen', 'poly', 40, gpl('Mettler Poly Sheen')),
  ('floriani', 'Floriani', 'Polyester', 'poly', 40, gpl('Floriani Polyester')),
  ('marathon', 'Marathon', 'Rayon', 'rayon', 40, gpl('Marathon Rayon')),
  ('brother', 'Brother', 'Embroidery thread', 'poly', 40, gpl('Brother Embroidery')),
  ('gutermann', 'Gütermann', 'Creativ Dekor', 'rayon', 40, gpl('Gutermann Creativ Dekor')),
  ('hemingworth', 'Hemingworth', 'Polyester', 'poly', 40, gpl('Hemingworth')),
  ('glide', 'Fil-Tec', 'Glide', 'poly', 40, gpl('Fil-Tec Glide')),
]
emoji = json.load(open('src/emoji.pack.json'))
out = {
  'fonts': [{'name': n, 'family': n, 'weight': w, 'category': c, 'kind': k, 'tail': t, 'tilt': tl, 'licence': licence(s), 'data': b64(s, w)} for n, s, w, c, t, tl, k in design_fonts],
  'uiFonts': [{'family': n, 'weight': w, 'data': b64(s, w)} for n, s, w in ui_fonts],
  'themes': [{'name': n, 'group': 'Classic', 'fill': f, 'stroke': s, 'stroke2': s2, 'shadow': sh, 'fabric': fab} for n, f, s, s2, sh, fab in themes] + pride_themes,
  'flags': pride_flags,
  'threadLines': [{'id': i, 'brand': b, 'line': l, 'material': m, 'weight': w, 'chart': c} for i, b, l, m, w, c in thread_lines],
  'emoji': [], 'emojiGroups': emoji['groups'], 'emojiPack': emoji['pack'],
}
json.dump([{'name': n, 'slug': sl, 'weight': w, 'kind': k, 'tail': t, 'tilt': tl} for n, sl, w, c, t, tl, k in design_fonts], open('src/fonts.json', 'w'), indent=0)
js = 'var STUDIO_ASSETS = ' + json.dumps(out, separators=(',', ':')) + ';\n' + '''
// the full emoji table ships gzip-compressed; unpack it before the app starts
STUDIO_ASSETS.ready = (function (A) {
  var bin = atob(A.emojiPack), u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  A.emojiPack = null;
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(function (t) {
    var d = JSON.parse(t);
    A.emoji = d.meta.map(function (m, k) {
      return { code: m[0], char: m[1], group: A.emojiGroups[m[2]], label: m[3], tags: m[4], tones: m[5] || null, of: m[6] || null, tone: m[7] || 0, svg: d.svg[k] };
    });
  }).catch(function (e) { console.error('emoji unpack failed', e); });
})(STUDIO_ASSETS);
'''
open('src/assets.gen.js', 'w').write(js)
print('assets.gen.js', len(js), 'bytes;', len(out['fonts']), 'design fonts,', emoji['count'], 'emoji,', len(out['themes']), 'themes')
