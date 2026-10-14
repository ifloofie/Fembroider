#!/usr/bin/env python3
"""Full emoji table: Twemoji 17 artwork (CC-BY 4.0) + emojibase 17 names/groups/skin tones (MIT).
Writes src/emoji.json (every emoji with its SVG; tests read this) and src/emoji.pack.json (meta + gzip pack)."""
import json, os, gzip, base64, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Twemoji SVGs (github.com/jdecked/twemoji, tag v17.0.3, folder assets/svg) and the emojibase-data@17.0.0 npm package.
# Point these at your copies; the generated src/emoji.json and src/emoji.pack.json are already in the repository.
TW = os.environ.get('TWEMOJI_SVG', os.path.join(ROOT, '..', 'vendor_src', 'twemoji', 'assets', 'svg'))
EB = os.environ.get('EMOJIBASE_DATA', os.path.join(ROOT, '..', 'vendor_src', 'emojibase', 'node_modules', 'emojibase-data'))
data = json.load(open(EB + '/en/data.json'))
GROUPS = {0: 'Smileys & emotion', 1: 'People & body', 3: 'Animals & nature', 4: 'Food & drink', 5: 'Travel & places',
          6: 'Activities', 7: 'Objects', 8: 'Symbols', 9: 'Flags'}
files = set(f[:-4] for f in os.listdir(TW) if f.endswith('.svg'))
def tw(hexcode):
    parts = [p.lower().lstrip('0') or '0' for p in hexcode.split('-')]
    cands = ['-'.join(parts), '-'.join(p for p in parts if p != 'fe0f')]
    for c in cands:
        if c in files: return c
    return None
def svg(code):
    s = open(f'{TW}/{code}.svg', encoding='utf-8').read().strip()
    return re.sub(r'\s+', ' ', s)
out, missing = [], []
def label(s): return s[:1].upper() + s[1:]
for e in sorted(data, key=lambda x: x.get('order', 1e9)):
    g = e.get('group')
    if g not in GROUPS: continue
    code = tw(e['hexcode'])
    if not code: missing.append(e['hexcode']); continue
    item = {'code': code, 'char': e['emoji'], 'group': GROUPS[g], 'label': label(e['label']), 'tags': ' '.join(e.get('tags') or []), 'svg': svg(code)}
    tones = {}
    for s in e.get('skins') or []:
        if isinstance(s.get('tone'), list) and len(set(s['tone'])) > 1: continue  # mixed-tone pairs: offer the single-tone versions
        t = s['tone'][0] if isinstance(s.get('tone'), list) else s.get('tone')
        c = tw(s['hexcode'])
        if c and t and t not in tones: tones[t] = c; out.append({'code': c, 'char': s['emoji'], 'group': GROUPS[g], 'label': label(s['label']), 'tags': '', 'svg': svg(c), 'of': code, 'tone': t})
    if tones: item['tones'] = [tones.get(t) for t in range(1, 6)]
    out.append(item)
# keep bases before their variants for readability
base = [x for x in out if 'of' not in x]; var = [x for x in out if 'of' in x]
allx = base + var
json.dump(allx, open(ROOT + '/src/emoji.json', 'w'), ensure_ascii=False, separators=(',', ':'))
meta = [[x['code'], x['char'], list(GROUPS.values()).index(x['group']), x['label'], x['tags'], x.get('tones'), x.get('of'), x.get('tone')] for x in allx]
blob = json.dumps({'meta': meta, 'svg': [x['svg'] for x in allx]}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
pack = base64.b64encode(gzip.compress(blob, 9)).decode()
json.dump({'groups': list(GROUPS.values()), 'pack': pack, 'count': len(allx), 'bases': len(base)}, open(ROOT + '/src/emoji.pack.json', 'w'))
print('emoji', len(base), 'bases +', len(var), 'skin-tone variants; missing artwork', len(missing), missing[:10], '; raw', len(blob) // 1024, 'KB, packed', len(pack) // 1024, 'KB')
