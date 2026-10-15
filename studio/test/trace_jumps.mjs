// prints every jump of one emoji's sewing plan: colour, from, to, distance (debug aid for the stress sweep)
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const svgAtSize = (await import('../src/svgsize.js')).default;
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight', 'effects'].forEach(k => delete base[k]);
const code = process.argv[2];
let r, e;
if (code.startsWith('img:')) {
  const img = await loadImage(fs.readFileSync(code.slice(4)));
  e = { label: code };
  r = E.renderLayer(createCanvas, Object.assign({}, base, { kind: 'raster', source: img, sizeMM: +(process.env.SIZE || 100), maxColors: +(process.env.COLORS || 5), removeBg: true, minAreaMM2: process.env.MINAREA ? +process.env.MINAREA : undefined, blurMM: process.env.BLUR ? +process.env.BLUR : undefined }));
} else if (code.startsWith('font:')) { // font:Family:Text
  const [, fam, text] = code.split(':'), f = JSON.parse(fs.readFileSync('src/fonts.json', 'utf8')).find(x => x.name === fam);
  e = { label: fam + ' ' + text };
  r = E.renderLayer(createCanvas, Object.assign({}, base, { kind: 'text', text, family: '"' + fam + '"', weight: f.weight === 400 ? undefined : String(f.weight), tail: 'classic', tailWeight: 1, tilt: 0, width: 110, colors: { fill: '#000000' },
    effects: { stroke: { on: true, width: 1.5, color: '#000001' }, stroke2: { on: false }, shadow: { on: false } } }));
} else {
  e = JSON.parse(fs.readFileSync('src/emoji.json', 'utf8')).find(x => x.code === code);
  const img = await loadImage(Buffer.from(svgAtSize(e.svg, 600)));
  r = E.renderLayer(createCanvas, Object.assign({}, base, { kind: 'raster', source: img, sizeMM: 60, palette: E.parseSvgPalette(e.svg) }));
}
r.parts.forEach((p, i) => { const isl = new Set(p.chords.map(c => c[7])); console.log('part', i, p.role || p.kind, p.color, 'chords', p.chords.length, 'islands', isl.size, 'under', (p.under || []).length); });
const seq = X.buildSequence([{ name: e.label, result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: 0.3 });
let x = 0, y = 0, col = 0, run = null, first = true, sinceS = 0;
for (const k of seq.cmds) {
  if (k[2] === 'C') { col++; first = true; continue; }
  if (k[2] === 'J') { if (!run) run = [x, y, sinceS]; x = k[0]; y = k[1]; continue; }
  if (run) { const dx = x - run[0]; console.log(`${first ? 'RETURN' : dx < -5 ? 'BACK  ' : 'jump  '} col ${col} ${seq.threads[col].color} (${run[0].toFixed(1)},${run[1].toFixed(1)}) -> (${x.toFixed(1)},${y.toFixed(1)}) d=${Math.hypot(x - run[0], y - run[1]).toFixed(1)} after ${run[2]} st`); run = null; sinceS = 0; }
  first = false; x = k[0]; y = k[1]; sinceS++;
}
