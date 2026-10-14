// Every bundled font: render a word with stroke, report stitches, gaps and time; plot all.
import { E, createCanvas, plot, FONTS } from './plot.mjs';
const assets = await import('../src/assets.gen.js').catch(() => null);
import fs from 'fs';
const meta = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../src/fonts.json', import.meta.url), 'utf8')).map(f => [f.name, [f.tail ? 1 : 0, f.tilt, f.weight]]));
const word = process.argv[2] || 'Hawks';
const out = [];
for (const fam of Object.keys(FONTS)) {
  const [tail, tilt, wt] = meta[fam];
  const t0 = Date.now();
  const r = E.renderLayer(createCanvas, { kind: 'text', text: word, family: '"' + fam + '"', weight: wt === 400 ? undefined : String(wt), tail: !!tail, tilt, width: 100,
    colors: { fill: '#b3202f' }, effects: { stroke: { on: true, width: 1.5, color: '#16233f' } } });
  const gaps = r.parts.reduce((a, p) => a + (p.gapsMM2 || 0), 0);
  console.log(fam.padEnd(15), `${r.size.w.toFixed(0)}x${r.size.h.toFixed(0)} mm`, String(r.stitchCount).padStart(5), 'st', 'gaps', gaps.toFixed(2), Date.now() - t0, 'ms');
  r.label = fam; out.push(r);
}
plot(out, 'test/out/fonts_' + word + '.png', 3.2, 2);
