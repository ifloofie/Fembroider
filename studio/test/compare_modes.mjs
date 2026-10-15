// source | mode A | mode B | ... at the same scale, with real thread colours (README / report aid).
// Usage: node test/compare_modes.mjs img sizeMM out.png modes [x,y,w,h]   modes: comma list of flat|painting|line
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight', 'effects'].forEach(k => delete base[k]);
const [file, sizeArg, outFile, modesArg, cropArg] = process.argv.slice(2), SIZE = +sizeArg, S = +(process.env.SCALE || 6), COLS = +(process.env.COLORS || 6);
const img = await loadImage(fs.readFileSync(file));
const MODE = { flat: { graphic: true }, painting: { graphic: false }, line: { lineArt: true } };
const modes = (modesArg || 'flat,painting').split(',');
const seqs = modes.map(m => {
  const spec = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, maxColors: COLS, removeBg: false }, MODE[m]);
  const r = E.renderLayer(createCanvas, spec);
  const seq = X.buildSequence([{ name: 'x', result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: APP.eff.minStitch, speed: 700 });
  console.log(m, 'threads', seq.threads.length, 'stitches', seq.stats.stitches, 'jumps', seq.stats.jumps, 'min', seq.stats.minutes.toFixed(0));
  return seq;
});
const ar = img.width / img.height, wmm = ar >= 1 ? SIZE : SIZE * ar, hmm = ar >= 1 ? SIZE / ar : SIZE;
const w = Math.ceil(wmm * S), h = Math.ceil(hmm * S), n = seqs.length + 1, out = createCanvas(w * n, h), x = out.getContext('2d');
x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
seqs.forEach((seq, k) => {
  x.save(); x.translate(w * (k + 1), 0); x.fillStyle = process.env.BG || '#f4f0e8'; x.fillRect(0, 0, w, h); x.beginPath(); x.rect(0, 0, w, h); x.clip();
  const b = seq.bounds, ox = w / 2 - (b.minX + b.maxX) / 2 * S, oy = h / 2 + (b.minY + b.maxY) / 2 * S;
  const tx = p => ox + p[0] * S, ty = p => oy - p[1] * S;
  x.lineCap = 'round'; x.lineWidth = 0.38 * S;
  let prev = null, ci = 0;
  for (const c of seq.cmds) {
    if (c[2] === 'C') { prev = null; ci++; continue; }
    if (c[2] === 'J') { prev = c; continue; }
    if (prev && prev[2] !== 'J') { x.strokeStyle = seq.threads[ci].color; x.beginPath(); x.moveTo(tx(prev), ty(prev)); x.lineTo(tx(c), ty(c)); x.stroke(); }
    prev = c;
  }
  x.restore();
});
let c2 = out;
if (cropArg) {
  const [cx, cy, cw, ch] = cropArg.split(',').map(Number), sx = Math.round(cx * w), sy = Math.round(cy * h), sw = Math.round(cw * w), sh = Math.round(ch * h);
  c2 = createCanvas(sw * n + 12 * (n - 1), sh); const y = c2.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, c2.width, sh);
  for (let k = 0; k < n; k++) y.drawImage(out, k * w + sx, sy, sw, sh, k * (sw + 12), 0, sw, sh);
} else {
  c2 = createCanvas(w * n + 12 * (n - 1), h); const y = c2.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, c2.width, h);
  for (let k = 0; k < n; k++) y.drawImage(out, k * w, 0, w, h, k * (w + 12), 0, w, h);
}
fs.writeFileSync(outFile, c2.toBuffer('image/png'));
