// debug view of the line-art masks: ink grey, mass by class (blue hatch / purple cross / red solid), skeleton branches black
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
const [file, size, crop, ...kv] = process.argv.slice(2);
const img = await loadImage(fs.readFileSync(file));
const spec = { kind: 'raster', source: img, sizeMM: +size, lineArt: true, debugLine: true };
kv.forEach(s => { const [k, v] = s.split('='); spec[k] = isNaN(+v) ? v : +v; });
E.renderLayer(createCanvas, spec);
const L = E.lastLine(), c = createCanvas(L.W, L.H), x = c.getContext('2d'), im = x.createImageData(L.W, L.H);
for (let i = 0; i < L.W * L.H; i++) {
  let col = [255, 255, 255];
  if (L.ink[i]) col = [190, 190, 190];
  if (L.mass[i]) col = [[0,0,0],[120, 160, 255], [200, 120, 230], [240, 90, 90]][L.cls[i]] || [0,255,0];
  im.data.set([...col, 255], i * 4);
}
x.putImageData(im, 0, 0);
x.strokeStyle = '#000'; x.lineWidth = 1;
L.br.forEach(b => { x.beginPath(); b.pts.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); });
const [cx, cy, cw, ch] = crop.split(',').map(Number), o = createCanvas(Math.round(cw * L.W), Math.round(ch * L.H));
o.getContext('2d').drawImage(c, -Math.round(cx * L.W), -Math.round(cy * L.H));
fs.writeFileSync('test/out/line/dbg.png', o.toBuffer('image/png'));
