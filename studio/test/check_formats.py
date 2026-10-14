# reads the files written by t_formats.mjs back with pyembroidery and compares them with the reference stitches
import json, sys, pyembroidery as P
d = 'test/out/formats/'
ref = json.load(open(d + 'ref.json'))
R = ref['stitches']
def hexc(t): return '#%06x' % (t.color & 0xFFFFFF)
ok = True
for f in ['T.PES', 'T.VP3', 'T.XXX', 'T.JEF', 'T.EXP', 'T.DST']:
    p = P.read(d + f)
    S = []; col = 0
    for x, y, cmd in p.stitches:
        c = cmd & P.COMMAND_MASK
        if c == P.COLOR_CHANGE: col += 1
        elif c == P.STITCH: S.append((round(x), round(-y), col))
    # positions are relative to wherever the format starts, so compare against the first stitch
    ox, oy = R[0][0] - S[0][0], R[0][1] - S[0][1]
    # VP3/XXX/PES may add a leading or trailing tie-in stitch; match by the sequence of needle-down points
    exp = [(x, y) for x, y, _ in R]; got = [(x + ox, y + oy) for x, y, _ in S]
    gset = got
    n = min(len(exp), len(got)); diff = sum(1 for i in range(n) if abs(exp[i][0] - got[i][0]) > 1 or abs(exp[i][1] - got[i][1]) > 1)
    cols = [hexc(t) for t in p.threadlist]
    colOk = f in ('T.DST', 'T.EXP') or (len(cols) >= len(ref['colors']))
    exact = f in ('T.VP3', 'T.XXX')
    if exact: colOk = colOk and cols[:len(ref['colors'])] == ref['colors']
    good = diff == 0 and abs(len(exp) - len(got)) <= 2 and colOk
    ok &= good
    ext = p.bounds()
    print('%-6s %s stitches %d/%d  mismatched %d  colours %d %s  size %.1f x %.1f mm (ref %.1f x %.1f)' % (f, 'OK ' if good else 'BAD', len(got), len(exp), diff, len(cols), 'exact' if exact else '', (ext[2]-ext[0])/10, (ext[3]-ext[1])/10, ref['w'], ref['h']))
inf = P.read(d + 'T.INF')
print('INF   ', [hexc(t) for t in inf.threadlist] == ref['colors'] and 'OK  colours match' or 'BAD')
sys.exit(0 if ok else 1)
