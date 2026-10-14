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
const placed = [
  { name: 'Bowie', result: text, transform: { x: 0, y: -10, rotation: 0 } },
  { name: 'Smiley', result: smile, transform: { x: 40, y: 32, rotation: 15, mirrorX: true } },
];
const seq = X.buildSequence(placed);
console.log('stats', JSON.stringify(seq.stats), 'bounds', Object.fromEntries(Object.entries(seq.bounds).map(([k, v]) => [k, +v.toFixed(1)])));
console.log('blocks', seq.blocks.map(b => `${b.thread.code} ${b.thread.name} ${b.stitches} [${b.layers}]`).join(' | '));
fs.mkdirSync('test/out/files', { recursive: true });
const alt = (hex, ex) => E.nearestThread(hex, ex).index;
fs.writeFileSync('test/out/files/TEST.EXP', X.writeEXP(seq));
fs.writeFileSync('test/out/files/TEST.INF', X.writeINF(seq));
fs.writeFileSync('test/out/files/TEST.JEF', X.writeJEF(seq, { hoop: 'A', threadAlt: alt }));
fs.writeFileSync('test/out/files/TEST.DST', X.writeDST(seq, 'TEST'));
const pc = createCanvas(200, 120), px = pc.getContext('2d');
X.drawPreview(seq, px, 200, 120, { lineWidth: 1 });
const bmp = X.writeBMP(px.getImageData(0, 0, 200, 120).data, 200, 120);
fs.writeFileSync('test/out/files/TEST.BMP', bmp);
const z = X.zip([{ name: 'EmbF5/TEST.EXP', data: X.writeEXP(seq) }, { name: 'EmbF5/TEST.INF', data: X.writeINF(seq) }, { name: 'EmbF5/TEST.BMP', data: bmp },
  { name: 'TEST_worksheet.txt', data: new TextEncoder().encode(X.worksheet(seq, { title: 'Bowie', machine: 'Bernina Deco 330', hoopName: 'Hoop A (126 x 110 mm)', files: ['EmbF5/TEST.EXP'] })) }]);
fs.writeFileSync('test/out/files/TEST.zip', z);
fs.writeFileSync('test/out/files/expect.json', JSON.stringify({ stitches: seq.stats.stitches, colors: seq.threads.length, bounds: seq.bounds, threads: seq.threads.map(t => t.color) }));
console.log('files written');
