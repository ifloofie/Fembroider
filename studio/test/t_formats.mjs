// writes the same design in every machine format and the reference stitch list, for test/check_formats.py
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const svgAtSize = (await import('../src/svgsize.js')).default;
const emoji = JSON.parse(fs.readFileSync('src/emoji.json', 'utf8'));
const text = E.renderLayer(createCanvas, { kind: 'text', text: 'Bowie', family: 'Yellowtail', tail: true, width: 100, colors: { fill: '#b3202f' },
  effects: { stroke: { on: true, width: 1.5, color: '#16233f' }, shadow: { on: true, dx: 1.4, dy: -1.4, color: '#8a8f99' } } });
const e = emoji.find(x => x.code === '1f60e');
const img = await loadImage(Buffer.from(svgAtSize(e.svg, 400)));
const smile = E.renderLayer(createCanvas, { kind: 'raster', source: img, sizeMM: 30, palette: E.parseSvgPalette(e.svg) });
const seq = X.buildSequence([
  { name: 'Bowie', result: text, transform: { x: 0, y: -10, rotation: 0 } },
  { name: 'Smiley', result: smile, transform: { x: 40, y: 32, rotation: 15, mirrorX: true } },
]);
const dir = 'test/out/formats'; fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/T.PES', X.writePES(seq, 'BOWIE'));
fs.writeFileSync(dir + '/T.VP3', X.writeVP3(seq));
fs.writeFileSync(dir + '/T.XXX', X.writeXXX(seq));
fs.writeFileSync(dir + '/T.JEF', X.writeJEF(seq, { auto: true }));
fs.writeFileSync(dir + '/T.EXP', X.writeEXP(seq));
fs.writeFileSync(dir + '/T.INF', X.writeINF(seq, { v1: true }));
fs.writeFileSync(dir + '/T.DST', X.writeDST(seq, 'T'));
// reference: needle-down positions (0.1 mm, y up) per colour
const ref = []; let c = 0;
seq.cmds.forEach(k => { if (k[2] === 'C') c++; else if (k[2] === 'S') ref.push([Math.round(k[0] * 10), Math.round(k[1] * 10), c]); });
fs.writeFileSync(dir + '/ref.json', JSON.stringify({ stitches: ref, colors: seq.threads.map(t => t.color), w: seq.bounds.w, h: seq.bounds.h }));
console.log('written', ref.length, 'stitches', seq.threads.length, 'colours');
// the full command list in 0.1 mm, y down (for a byte-for-byte comparison with pyembroidery's own writers)
const cmds = []; let ux = 0, uy = 0;
seq.cmds.forEach(k => { if (k[2] === 'C') { cmds.push([ux, uy, 'C']); return; } ux = Math.round(k[0] * 10); uy = -Math.round(k[1] * 10); cmds.push([ux, uy, k[2]]); });
fs.writeFileSync(dir + '/cmds.json', JSON.stringify({ cmds, colors: seq.threads.map(t => t.color) }));
