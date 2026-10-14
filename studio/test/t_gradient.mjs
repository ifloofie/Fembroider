// Dithered gradient fills: rows assigned to neighbouring thread colours. Reports rows per colour and runs (jumps proxy).
import { E, createCanvas, plot } from './plot.mjs';
import { createRequire } from 'module';
const X = createRequire(import.meta.url)('../src/export.js');
const R6 = ['#ff0000', '#ff9805', '#ffe505', '#1a842d', '#386cae', '#540571'];
const SUN = ['#ffe505', '#ff6600', '#c3007e'];
const out = [];
for (const [label, fam, text, cols, dir, dither, w] of [
  ['rainbow · diffusion', 'Yellowtail', 'Pride', R6, 'h', 'diffusion', 100], ['sunset · diffusion', 'Alfa Slab One', 'LOVE', SUN, 'v', 'diffusion', 100],
  ['sunset · ordered', 'Alfa Slab One', 'LOVE', SUN, 'v', 'ordered', 100], ['2 colours · diagonal', 'Lobster', 'Gradient', ['#0b2f84', '#f669a0'], 'd', 'diffusion', 110]]) {
  const r = E.renderLayer(createCanvas, { kind: 'text', text, family: '"' + fam + '"', tail: fam === 'Yellowtail', tilt: fam === 'Yellowtail' ? 7 : 0, width: w,
    colors: { fill: '#000' }, bands: { n: cols.length, dir, mode: 'gradient', dither }, effects: { stroke: { on: true, width: 1.2, color: '#16233f' } } });
  r.parts.forEach(p => { if (p.role === 'band') { p.color = cols[p.band]; p.thread = E.nearestThread(p.color); } });
  const seq = X.buildSequence([{ name: label, result: r, transform: {} }]);
  console.log(label.padEnd(22), r.parts.map(p => p.role + (p.band ?? '') + ':' + p.chords.length).join(' '), '| stitches', seq.stats.stitches, 'jumps', seq.stats.jumps, 'travels', seq.stats.travels);
  r.label = label; out.push(r);
}
plot(out, 'test/out/gradient.png', 3.4, 2);
