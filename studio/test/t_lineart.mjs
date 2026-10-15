// Line-art mode: renders images as running-stitch line art, plans the sewing, prints metrics and writes a
// side-by-side (source | stitched) picture at true thread width, optionally cropped.
// Usage: node test/t_lineart.mjs <image> [sizeMM] [crop x0,y0,w,h in 0..1] [key=value spec overrides...]
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const svgAtSize = (await import('../src/svgsize.js')).default;
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const [file, sizeArg, cropArg, ...kv] = process.argv.slice(2);
const SIZE = +(sizeArg || 100), S = +(process.env.SCALE || 8);
const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight', 'effects'].forEach(k => delete base[k]);
const svg = /\.svg$/i.test(file), buf = fs.readFileSync(file);
const img = await loadImage(svg ? Buffer.from(svgAtSize(buf.toString('utf8'), 1600)) : buf);
const spec = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, lineArt: true, removeBg: true });
kv.forEach(s => { const [k, v] = s.split('='); spec[k] = isNaN(+v) ? v : +v; });
const t0 = performance.now();
const r = E.renderLayer(createCanvas, spec);
const tR = performance.now() - t0;
const seq = X.buildSequence([{ name: 'x', result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: APP.eff.minStitch, speed: 700 });
const st = r.meta.lineArt;
console.log(path.basename(file), SIZE + 'mm', 'render', Math.round(tR) + 'ms', 'parts', r.parts.map(p => (p.sub || p.kind) + ':' + p.chords.length).join(' '),
  '| stitches', seq.stats.stitches, 'jumps', seq.stats.jumps, 'travels', seq.stats.travels, 'min', seq.stats.minutes.toFixed(1),
  '| runs', st.lines, 'hatchAreas', st.hatchAreas, 'retrace', st.retraceMM.toFixed(0) + 'mm', 'bean', st.beanMM.toFixed(0) + 'mm', 'line', st.runMM.toFixed(0) + 'mm', 'ink', r.parts[0] && r.parts[0].color);
// picture: source and stitches at the same scale
const bd = seq.bounds, w = Math.ceil(bd.w * S) + 20, h = Math.ceil(bd.h * S) + 20;
const out = createCanvas(w * 2, h), x = out.getContext('2d');
x.fillStyle = '#fff'; x.fillRect(0, 0, w * 2, h);
const ar = img.width / img.height, iw = ar >= 1 ? SIZE * S : SIZE * S * ar, ih = ar >= 1 ? SIZE * S / ar : SIZE * S;
x.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
x.save(); x.translate(w, 0);
x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, w, h);
const tx = p => 10 + (p[0] - bd.minX) * S, ty = p => 10 + (bd.maxY - p[1]) * S;
x.lineCap = 'round'; x.lineJoin = 'round';
let prev = null;
for (const c of seq.cmds) {
  if (c[2] === 'C') { prev = null; continue; }
  if (c[2] === 'J') { if (prev && process.env.JUMPS) { x.strokeStyle = 'rgba(220,40,40,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(tx(prev), ty(prev)); x.lineTo(tx(c), ty(c)); x.stroke(); } prev = c; continue; }
  if (prev) { x.strokeStyle = c.travel ? '#3a5fcd' : '#1d1b1a'; x.lineWidth = 0.36 * S; x.beginPath(); x.moveTo(tx(prev), ty(prev)); x.lineTo(tx(c), ty(c)); x.stroke(); }
  prev = c;
}
x.restore();
let canvas = out;
if (cropArg && cropArg !== '-') {
  const [cx, cy, cw, ch] = cropArg.split(',').map(Number), sx = Math.round(cx * w), sy = Math.round(cy * h), sw = Math.round(cw * w), sh = Math.round(ch * h);
  canvas = createCanvas(sw * 2, sh); const y = canvas.getContext('2d');
  y.drawImage(out, sx, sy, sw, sh, 0, 0, sw, sh); y.drawImage(out, w + sx, sy, sw, sh, sw, 0, sw, sh);
}
fs.mkdirSync('test/out/line', { recursive: true });
const name = `test/out/line/${path.basename(file).replace(/\.[^.]+$/, '')}_${SIZE}${cropArg && cropArg !== '-' ? '_crop' : ''}${process.env.TAG ? '_' + process.env.TAG : ''}.png`;
fs.writeFileSync(name, canvas.toBuffer('image/png'));
console.log('wrote', name);
