// source | flat-art fill | line art, same scale, optional crop (report aid). Usage: node test/compare_line.mjs img sizeMM out.png [x,y,w,h]
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight', 'effects'].forEach(k => delete base[k]);
const [file, sizeArg, outFile, cropArg] = process.argv.slice(2), SIZE = +sizeArg, S = +(process.env.SCALE || 6);
const img = await loadImage(fs.readFileSync(file));
const runs = [Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, maxColors: 5, removeBg: true }),
  Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, lineArt: true })].map(spec => {
  const r = E.renderLayer(createCanvas, spec);
  return X.buildSequence([{ name: 'x', result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: APP.eff.minStitch, speed: 700 });
});
const ar = img.width / img.height, wmm = ar >= 1 ? SIZE : SIZE * ar, hmm = ar >= 1 ? SIZE / ar : SIZE;
const w = Math.ceil(wmm * S), h = Math.ceil(hmm * S), out = createCanvas(w * 3, h), x = out.getContext('2d');
x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
// the engine centres each design on its stitches: line the panels up on each design's own bounds against the
// source's dark-ink box
const px = x.getImageData(0, 0, w, h).data; let x0 = w, x1 = 0, y0 = h, y1 = 0;
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = (j * w + i) * 4; if (px[q] + px[q + 1] + px[q + 2] < 3 * 120) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } }
runs.forEach((seq, k) => {
  x.save(); x.translate(w * (k + 1), 0); x.fillStyle = '#f4f0e8'; x.fillRect(0, 0, w, h);
  x.beginPath(); x.rect(0, 0, w, h); x.clip();
  const b = seq.bounds, ox = (x0 + x1) / 2 - (b.minX + b.maxX) / 2 * S, oy = (y0 + y1) / 2 + (b.minY + b.maxY) / 2 * S;
  const tx = p => ox + p[0] * S, ty = p => oy - p[1] * S;
  let ci = 0;
  x.lineCap = 'round'; x.lineWidth = 0.38 * S;
  let prev = null;
  for (const c of seq.cmds) {
    if (c[2] === 'C') { prev = null; ci++; continue; }
    if (c[2] === 'J') { prev = c; continue; }
    if (prev && prev[2] !== 'J') { x.strokeStyle = seq.threads[ci].color; x.beginPath(); x.moveTo(tx(prev), ty(prev)); x.lineTo(tx(c), ty(c)); x.stroke(); }
    prev = c;
  }
  x.restore();
  console.log(['flat', 'line'][k], 'threads', seq.threads.length, 'stitches', seq.stats.stitches, 'jumps', seq.stats.jumps, 'min', seq.stats.minutes.toFixed(0));
});
let c2 = out;
if (cropArg) {
  const [cx, cy, cw, ch] = cropArg.split(',').map(Number), sx = Math.round(cx * w), sy = Math.round(cy * h), sw = Math.round(cw * w), sh = Math.round(ch * h);
  c2 = createCanvas(sw * 3 + 24, sh); const y = c2.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, c2.width, sh);
  for (let k = 0; k < 3; k++) y.drawImage(out, k * w + sx, sy, sw, sh, k * (sw + 12), 0, sw, sh);
}
fs.writeFileSync(outFile, c2.toBuffer('image/png'));
