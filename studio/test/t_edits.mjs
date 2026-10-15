// Per-area edits (the viewport pie menu): renders a picture with several edit sets, plans each, and draws them
// side by side at thread width. Usage: node test/t_edits.mjs <image> [sizeMM]
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const svgAtSize = (await import('../src/svgsize.js')).default;
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const [file, sizeArg] = process.argv.slice(2);
const SIZE = +(sizeArg || 80), S = 6;
const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight', 'effects'].forEach(k => delete base[k]);
const svg = /\.svg$/i.test(file), buf = fs.readFileSync(file);
const img = await loadImage(svg ? Buffer.from(svgAtSize(buf.toString('utf8'), 1600)) : buf);
const spec0 = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, removeBg: true, maxColors: 6, blurMM: 0.6 });
const first = E.renderLayer(createCanvas, spec0);
const keys = first.parts.map(p => p.key);
const by = c => keys.find(k => k === 'colour:' + c) || null;
// the darkest colour is the linework, the lightest non-white the highlight
const lum = h => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255); };
const cols = first.parts.map(p => p.color).sort((a, b) => lum(a) - lum(b));
const ink = 'colour:' + cols[0], light = 'colour:' + cols[cols.length - 1];
const sets = [
  ['auto', {}],
  ['ink as Line', { edits: { [ink]: { stitch: 'line' } } }],
  ['white skipped, ink Line', { edits: { [ink]: { stitch: 'line' }, [light]: { stitch: 'skip' } } }],
  ['all Satin', { edits: Object.fromEntries(keys.map(k => [k, { stitch: 'satin' }])) }],
  ['ink Outline', { edits: { [ink]: { stitch: 'outline' } } }],
  ['ink sewn last', { order: keys.filter(k => k !== ink).concat([ink]) }],
  ['sticker edge (satin)', { effects: { stroke: { on: true, width: 1.6, color: '#000001' } } }],
  ['sticker edge (bean)', { effects: { stroke: { on: true, width: 1.6, color: '#000001' } }, edits: { stroke: { stitch: 'line' } } }],
  ['highlight merged into body', { merge: { [cols.length > 3 ? 'colour:' + cols[cols.length - 2] : light]: 'colour:' + cols[Math.floor(cols.length / 2)] } }],
];
console.log(path.basename(file), 'colours', cols.join(' '));
const pics = [];
for (const [label, extra] of sets) {
  const t0 = performance.now();
  const r = E.renderLayer(createCanvas, Object.assign({}, spec0, extra));
  const ms = performance.now() - t0;
  const seq = X.buildSequence([{ name: 'x', result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: APP.eff.minStitch, speed: 700 });
  console.log(label.padEnd(28), Math.round(ms) + 'ms', 'size', r.size.w.toFixed(1) + 'x' + r.size.h.toFixed(1), '| parts', r.parts.map(p => p.key.replace('colour:', '') + (p.sub ? '/' + p.sub : '') + ':' + p.chords.length).join(' '),
    '| ghosts', (r.ghosts || []).map(g => g.key.replace('colour:', '')).join(' ') || '-', '| stitches', seq.stats.stitches, 'jumps', seq.stats.jumps, 'changes', seq.stats.colorChanges);
  pics.push({ label, r, seq });
}
const cw = Math.ceil((SIZE + 14) * S), ch = cw + 24, ncol = 3, out = createCanvas(cw * ncol, ch * Math.ceil(pics.length / ncol)), x = out.getContext('2d');
x.fillStyle = '#f3eee4'; x.fillRect(0, 0, out.width, out.height);
pics.forEach(({ label, r, seq }, k) => {
  const ox = (k % ncol) * cw + cw / 2, oy = Math.floor(k / ncol) * ch + 24 + cw / 2;
  x.lineCap = 'round';
  if (!process.env.NOGHOST) (r.ghosts || []).forEach(g => { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.setLineDash([3, 3]); g.chords.forEach(c => { x.beginPath(); x.moveTo(ox + c[0] * S, oy - c[1] * S); x.lineTo(ox + c[2] * S, oy - c[3] * S); x.stroke(); }); x.setLineDash([]); });
  let prev = null, ti = 0;
  const colOf = i => { const c = (seq.threads[i] || {}).color || '#333333'; return /^#0000/.test(c) ? '#1d1a24' : c; };
  for (const c of seq.cmds) {
    if (c[2] === 'C') { prev = null; ti++; continue; }
    if (c[2] === 'J') { prev = c; continue; }
    if (prev) { x.strokeStyle = colOf(ti); x.lineWidth = 0.36 * S; x.beginPath(); x.moveTo(ox + prev[0] * S, oy - prev[1] * S); x.lineTo(ox + c[0] * S, oy - c[1] * S); x.stroke(); }
    prev = c;
  }
  x.fillStyle = '#222'; x.font = 'bold 15px sans-serif'; x.fillText(label, (k % ncol) * cw + 8, Math.floor(k / ncol) * ch + 18);
});
fs.mkdirSync('test/out/edits', { recursive: true });
const name = 'test/out/edits/' + path.basename(file).replace(/\.[^.]+$/, '') + '.png';
fs.writeFileSync(name, out.toBuffer('image/png'));
console.log('wrote', name);
