// Stitch quality harness: renders a corpus and measures coverage, mess, edge angles, pile-up and crossings
// for the fill part, so stitching changes can be compared by numbers. Usage: node test/quality.mjs [tag] [--zoom]
import { E, createCanvas } from './plot.mjs';
import fs from 'fs';
const TAG = process.argv[2] || 'run', ZOOM = process.argv.includes('--zoom');
export const CORPUS = [
  ['Bowie', 'Yellowtail', 7, true, 110], ['Bowie', 'Yellowtail', 7, true, 70], ['Bowie', 'Pacifico', 6, true, 110],
  ['Brooklyn', 'Lobster', 6, true, 120], ['Boogie', 'Dancing Script', 5, true, 110], ['Rebels', 'Kaushan Script', 6, true, 110],
  ['Bobcats', 'Satisfy', 6, true, 110], ['Bella', 'Great Vibes', 0, false, 110], ['BASEBALL', 'Graduate', 0, false, 120],
  ['Rockets', 'Alfa Slab One', 0, false, 120], ['BRAVES', 'Bebas Neue', 0, false, 100], ['Floof', 'Yellowtail', 7, true, 90],
];
function chamfer(mask, W, H) { // inside distance in px (approx Euclidean, 3-4 chamfer / 3)
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? 1e6 : 0;
  const A = 3, B = 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue;
    let v = d[i]; if (x) v = Math.min(v, d[i - 1] + A); if (y) { v = Math.min(v, d[i - W] + A); if (x) v = Math.min(v, d[i - W - 1] + B); if (x < W - 1) v = Math.min(v, d[i - W + 1] + B); } d[i] = v; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue;
    let v = d[i]; if (x < W - 1) v = Math.min(v, d[i + 1] + A); if (y < H - 1) { v = Math.min(v, d[i + W] + A); if (x < W - 1) v = Math.min(v, d[i + W + 1] + B); if (x) v = Math.min(v, d[i + W - 1] + B); } d[i] = v; }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}
function cross(a, b) {
  const rx = a[2] - a[0], ry = a[3] - a[1], sx = b[2] - b[0], sy = b[3] - b[1], den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return false;
  const qx = b[0] - a[0], qy = b[1] - a[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  // ignore crossings within 0.4 mm (4 px) of either stitch's end: those are intended seam overlaps
  const la = Math.hypot(rx, ry), lb = Math.hypot(sx, sy);
  if (t * la < 4 || (1 - t) * la < 4 || u * lb < 4 || (1 - u) * lb < 4) return false;
  const ang = Math.acos(Math.min(1, Math.abs(rx * sx + ry * sy) / (Math.hypot(rx, ry) * Math.hypot(sx, sy))));
  return ang > 18 * Math.PI / 180;
}
export function measure(r) {
  const D = r.debug, { W, H, PX, cx, cy, mask } = D, din = chamfer(mask, W, H);
  const fill = r.parts.find(p => p.role === 'fill') || r.parts.find(p => p.kind === 'fill');
  const toPx = c => [(c[0] + cx) * PX, (cy - c[1]) * PX, (c[2] + cx) * PX, (cy - c[3]) * PX];
  const ch = fill.chords.map(c => ({ p: toPx(c), src: c[4], col: c[5] }));
  const cov = new Uint8Array(W * H), mult = new Uint8Array(W * H);
  let outside = 0, total = 0, shortN = 0;
  const angErr = []; let angW = 0, angSum = 0, angBad = 0;
  const gx = (x, y) => { const i = Math.round(y) * W + Math.round(x); return [din[i + 1] - din[i - 1], din[i + W] - din[i - W]]; };
  ch.forEach((c, k) => {
    const [x0, y0, x1, y1] = c.p, L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L));
    total += L / PX; if (L / PX < 0.4) shortN++;
    const seen = new Set();
    for (let q = 0; q <= n; q++) {
      const px = Math.round(x0 + (x1 - x0) * q / n), py = Math.round(y0 + (y1 - y0) * q / n);
      if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
      if (!mask[py * W + px]) outside += 1 / PX / n * L / PX * 0 + (1 / PX);
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) cov[(py + oy) * W + px + ox] = 1;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const i = (py + oy) * W + px + ox; if (!seen.has(i)) { seen.add(i); if (mult[i] < 255) mult[i]++; } }
    }
    // edge angle: a satin stitch should meet the edge square on
    if (c.src === 0 && L / PX > 1.5) {
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      [[x0 + ux * 3, y0 + uy * 3], [x1 - ux * 3, y1 - uy * 3]].forEach(([ex, ey]) => {
        if (ex < 2 || ey < 2 || ex >= W - 2 || ey >= H - 2) return;
        const g = gx(ex, ey), gl = Math.hypot(g[0], g[1]); if (gl < 0.3) return;
        const a = Math.acos(Math.min(1, Math.abs((g[0] * ux + g[1] * uy) / gl))) * 180 / Math.PI;
        angSum += a; angW++; if (a > 30) angBad++;
      });
    }
  });
  // show-through: draw the top stitches at the thread's real pressed-flat width (2x supersampled) and
  // measure how much of the interior fabric is still visible between them
  const TW = r.threadMM || 0.32, SS = 2, sc = createCanvas(W * SS, H * SS), sx = sc.getContext('2d');
  sx.fillStyle = '#000'; sx.fillRect(0, 0, W * SS, H * SS); sx.strokeStyle = '#fff'; sx.lineCap = 'round'; sx.lineWidth = TW * PX * SS;
  sx.beginPath(); ch.forEach(c => { if (c.src === 5) return; sx.moveTo(c.p[0] * SS, c.p[1] * SS); sx.lineTo(c.p[2] * SS, c.p[3] * SS); }); sx.stroke();
  const img = sx.getImageData(0, 0, W * SS, H * SS).data; let showN = 0, showD = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!mask[i] || din[i] <= 3.5) continue;
    let v = 0; for (let oy = 0; oy < SS; oy++) for (let ox = 0; ox < SS; ox++) v += img[((y * SS + oy) * W * SS + x * SS + ox) * 4];
    showN += 1 - v / (255 * SS * SS); showD++; }
  let interior = 0, bare = 0, pile = 0, covered = 0;
  for (let i = 0; i < W * H; i++) if (mask[i] && din[i] > 3.5) { interior++; if (!cov[i]) bare++; else { covered++; if (mult[i] >= 4) pile++; } }
  // crossings among top stitches (grid)
  const cell = 20, grid = new Map(); let crossN = 0;
  ch.forEach((c, i) => { const xs = [c.p[0], c.p[2]], ys = [c.p[1], c.p[3]];
    for (let gy = Math.floor(Math.min(...ys) / cell); gy <= Math.floor(Math.max(...ys) / cell); gy++) for (let gxx = Math.floor(Math.min(...xs) / cell); gxx <= Math.floor(Math.max(...xs) / cell); gxx++) {
      const k = gy * 10000 + gxx; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  const seenP = new Set();
  grid.forEach(ids => { for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const key = ids[a] * 1e6 + ids[b]; if (seenP.has(key)) continue; seenP.add(key); if (cross(ch[ids[a]].p, ch[ids[b]].p)) crossN++; } });
  const patch = ch.filter(c => c.src === 1 || c.src === 3 || c.src === 4).length;
  return { stitches: ch.length, bare: +(100 * bare / interior).toFixed(2), patch: +(100 * patch / ch.length).toFixed(1), crossings: crossN,
    edgeDeg: +(angSum / Math.max(1, angW)).toFixed(1), edgeBad: +(100 * angBad / Math.max(1, angW)).toFixed(1), pile: +(100 * pile / Math.max(1, covered)).toFixed(1),
    outsideMM: +outside.toFixed(1), show: +(100 * showN / Math.max(1, showD)).toFixed(2), short: shortN, dropped: D.stats.dropped || 0, holes: D.stats.holes || 0 };
}
export function score(m) { // lower is better; weights reflect what shows on fabric
  return +(m.bare * 40 + m.patch * 2 + m.crossings * 0.15 + m.edgeDeg * 0.8 + m.edgeBad * 0.5 + m.pile * 1.0 + m.outsideMM * 0.5 + (m.show || 0) * 4).toFixed(1);
}
export function render(word, fam, tilt, tail, width, extra) {
  return E.renderLayer(createCanvas, Object.assign({ kind: 'text', text: word, family: '"' + fam + '"', weight: fam === 'Dancing Script' ? '700' : undefined, tail, tilt, width,
    colors: { fill: '#b3202f' }, effects: { stroke: { on: true, width: 1.5, color: '#16233f' } }, debugMask: true, fillMode: 'patch' }, extra || {}));
}
export function drawZoom(r, file, box, S) { // box in mm (centered coords): [x0, y0, x1, y1]
  const D = r.debug; S = S || 14; const w = Math.round((box[2] - box[0]) * S), h = Math.round((box[3] - box[1]) * S);
  const c = createCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#f5f1e8'; x.fillRect(0, 0, w, h);
  const X = mx => (mx - box[0]) * S, Y = my => (box[3] - my) * S;
  // mask
  const T = D.stats.terr;
  for (let py = 0; py < D.H; py += 1) for (let px = 0; px < D.W; px += 1) if (D.mask[py * D.W + px]) { const mx = px / D.PX - D.cx, my = D.cy - py / D.PX; if (mx >= box[0] && mx <= box[2] && my >= box[1] && my <= box[3]) {
    x.fillStyle = T && T[py * D.W + px] >= 0 ? `hsl(${(T[py * D.W + px] * 67) % 360},40%,86%)` : '#ddd4c2'; x.fillRect(X(mx), Y(my), S / D.PX + 0.6, S / D.PX + 0.6); } }
  const fill = r.parts.find(p => p.role === 'fill');
  x.lineCap = 'round';
  fill.chords.forEach(c => {
    x.strokeStyle = c[4] === 1 ? '#000' : (c[4] === 3 || c[4] === 4) ? '#555' : `hsl(${(c[5] * 67) % 360},70%,45%)`;
    x.lineWidth = c[4] === 0 ? 0.32 * S : 0.25 * S; x.globalAlpha = 0.85;
    x.beginPath(); x.moveTo(X(c[0]), Y(c[1])); x.lineTo(X(c[2]), Y(c[3])); x.stroke();
  });
  x.globalAlpha = 1; x.strokeStyle = '#ff0033'; x.lineWidth = 2;
  (D.stats.droppedChords || []).forEach(c => { const a = [c[0] / D.PX - D.cx, D.cy - c[1] / D.PX, c[2] / D.PX - D.cx, D.cy - c[3] / D.PX];
    x.beginPath(); x.moveTo(X(a[0]), Y(a[1])); x.lineTo(X(a[2]), Y(a[3])); x.stroke(); });
  x.strokeStyle = '#fff'; x.lineWidth = 1.5;
  D.cols.forEach(pl => { x.beginPath(); pl.forEach((q, i) => i ? x.lineTo(X(q[0]), Y(q[1])) : x.moveTo(X(q[0]), Y(q[1]))); x.stroke(); });
  fs.writeFileSync(file, c.toBuffer('image/png'));
}
if (process.argv[1].endsWith('quality.mjs')) {
  const rows = [], all = [];
  for (const [word, fam, tilt, tail, w] of CORPUS) {
    const t0 = Date.now(), r = render(word, fam, tilt, tail, w), m = measure(r);
    m.ms = Date.now() - t0; m.score = score(m); rows.push([word + ' · ' + fam + ' ' + w, m]); all.push(m.score);
    if (ZOOM && word === 'Bowie' && fam === 'Yellowtail' && w === 110) {
      const b = r.size; drawZoom(r, `test/out/q_${TAG}_B.png`, [-b.w / 2 - 1, -b.h / 2 + 4, -b.w / 2 + 34, b.h / 2 + 1]);
      drawZoom(r, `test/out/q_${TAG}_Bfoot.png`, [-b.w / 2 - 1, -b.h / 2 + 5, -b.w / 2 + 13, -b.h / 2 + 18], 40);
      drawZoom(r, `test/out/q_${TAG}_Bcurl.png`, [-b.w / 2 - 1, b.h / 2 - 16, -b.w / 2 + 11, b.h / 2 - 6], 40);
    }
  }
  const keys = ['score', 'show', 'bare', 'patch', 'crossings', 'edgeDeg', 'edgeBad', 'pile', 'outsideMM', 'short', 'dropped', 'holes', 'stitches', 'ms'];
  console.log('word'.padEnd(34) + keys.map(k => k.padStart(9)).join(''));
  rows.forEach(([n, m]) => console.log(n.padEnd(34) + keys.map(k => String(m[k]).padStart(9)).join('')));
  console.log('TOTAL score', all.reduce((a, b) => a + b, 0).toFixed(1));
  fs.mkdirSync('test/out/quality', { recursive: true });
  fs.writeFileSync(`test/out/quality/${TAG}.json`, JSON.stringify(rows, null, 1));
}
