// Shared helpers for engine tests: register fonts, plot parts.
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export const E = require('../src/engine.js');
export { createCanvas, loadImage };
const F = new URL('../node_modules/@fontsource/', import.meta.url).pathname;
export const FONTS = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../src/fonts.json', import.meta.url), 'utf8')).map(f => [f.name, [f.slug, f.weight]]));
for (const [fam, [slug, w]] of Object.entries(FONTS)) {
  const file = `${F}${slug}/files/${slug}-latin-${w}-normal.woff2`;
  if (fs.existsSync(file)) GlobalFonts.registerFromPath(file, fam);
}
export function plot(results, file, S = 4, cols = 3) {
  const cw = 480, ch = 300;
  const rows = Math.ceil(results.length / cols);
  const c = createCanvas(cw * cols, ch * rows), x = c.getContext('2d');
  x.fillStyle = '#efe7d6'; x.fillRect(0, 0, c.width, c.height);
  results.forEach((r, k) => {
    const ox = (k % cols) * cw + cw / 2, oy = Math.floor(k / cols) * ch + ch / 2 + 10;
    x.lineCap = 'round';
    for (const p of r.parts) {
      x.strokeStyle = p.color; x.lineWidth = (r.threadMM || 0.30) * S;
      for (const s of p.chords) { x.beginPath(); x.moveTo(ox + s[0] * S, oy - s[1] * S); x.lineTo(ox + s[2] * S, oy - s[3] * S); x.stroke(); }
    }
    x.fillStyle = '#333'; x.font = '14px sans-serif';
    x.fillText(r.label || '', (k % cols) * cw + 8, Math.floor(k / cols) * ch + 18);
  });
  fs.writeFileSync(file, c.toBuffer('image/png'));
}
