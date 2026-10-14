import { E, createCanvas, loadImage, plot } from './plot.mjs';
import fs from 'fs';
const svgAtSize = (await import('../src/svgsize.js')).default;
const out = [];
// 1) generic SVG, no palette given: auto-detect colours (stroke-only path included)
const svg = fs.readFileSync('test/sample_logo.svg', 'utf8');
let img = await loadImage(Buffer.from(svgAtSize(svg, 900)));
let r = E.renderLayer(createCanvas, { kind: 'raster', source: img, sizeMM: 100, maxColors: 6, debug: true });
r.label = `SVG auto: ${r.parts.map(p => p.color).join(' ')} · ${r.stitchCount} st`;
console.log(r.label, r.parts.map(p => p.report.map(q => q.method[0]).join('')).join('|'));
out.push(r);
// 2) same SVG with the parsed paint-order palette
r = E.renderLayer(createCanvas, { kind: 'raster', source: img, sizeMM: 100, palette: E.parseSvgPalette(svg), debug: true });
r.label = `SVG paint order: ${r.parts.map(p => p.color).join(' ')} · ${r.stitchCount} st`;
console.log(r.label); out.push(r);
// 3) opaque bitmap (an emoji flattened onto white at 120 px, then upscaled): background removal + k-means
const all = JSON.parse(fs.readFileSync('src/emoji.json', 'utf8'));
const e = all.find(x => x.code === '1f60e');
const em = await loadImage(Buffer.from(svgAtSize(e.svg, 120)));
const bmp = createCanvas(160, 140), bx = bmp.getContext('2d');
bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, 160, 140); bx.drawImage(em, 20, 10);
// add JPEG-like noise so palette detection has to cope
const id = bx.getImageData(0, 0, 160, 140);
for (let i = 0; i < id.data.length; i += 4) for (let k = 0; k < 3; k++) id.data[i + k] = Math.max(0, Math.min(255, id.data[i + k] + (Math.random() * 16 - 8)));
bx.putImageData(id, 0, 0);
fs.writeFileSync('test/out/bitmap_in.png', bmp.toBuffer('image/png'));
const bimg = await loadImage(fs.readFileSync('test/out/bitmap_in.png'));
r = E.renderLayer(createCanvas, { kind: 'raster', source: bimg, sizeMM: 70, maxColors: 5, debug: true });
r.label = `Bitmap: bg removed ${r.meta.bgRemoved} · ${r.parts.map(p => p.color).join(' ')}`;
console.log(r.label, r.stitchCount, 'st');
out.push(r);
plot(out, 'test/out/import.png', 3.2, 3);
