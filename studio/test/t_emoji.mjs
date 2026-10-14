import { E, createCanvas, loadImage, plot } from './plot.mjs';
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/emoji.json', 'utf8'));
const pick = process.argv.slice(2).length ? process.argv.slice(2) : ['1f600', '1f602', '1f60d', '1f60e', '1f92a', '1f621'];
const out = [];
for (const code of pick) {
  const e = all.find(x => x.code === code);
  const svgAtSize = (await import('../src/svgsize.js')).default; const img = await loadImage(Buffer.from(svgAtSize(e.svg, 600)));
  const pal = E.parseSvgPalette(e.svg);
  const r = E.renderLayer(createCanvas, { kind: 'raster', source: img, sizeMM: 60, palette: pal, debug: true,
    effects: { stroke: { on: false } } });
  r.label = `${e.char} ${code}: ${r.size.w.toFixed(0)}x${r.size.h.toFixed(0)} mm, ${r.stitchCount} st, ${r.parts.length} parts, ${r.ms} ms`;
  console.log(r.label, '| palette', pal.join(' '), '|', r.parts.map(p => `${p.color}:${p.chords.length}${p.report ? '[' + p.report.map(q => q.method[0]).join('') + ']' : ''} g${(p.gapsMM2 || 0).toFixed(2)}`).join(' '));
  out.push(r);
}
plot(out, 'test/out/emoji.png', 3.6, 3);
