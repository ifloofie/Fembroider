// Flag stripes: split the text fill into bands; check coverage, stitches per band, and plot.
import { E, createCanvas, plot } from './plot.mjs';
const R6 = ['#ff0000', '#ff9805', '#ffe505', '#1a842d', '#386cae', '#540571'];
const TR = ['#65c2c8', '#f999b7', '#ffffff', '#f999b7', '#65c2c8'];
const out = [];
for (const [label, fam, text, cols, dir, w] of [['rainbow h', 'Yellowtail', 'Pride', R6, 'h', 100], ['trans h', 'Lobster', 'Love', TR, 'h', 90],
  ['rainbow v', 'Alfa Slab One', 'LOVE', R6, 'v', 100], ['rainbow d', 'Bebas Neue', 'PRIDE', R6, 'd', 90]]) {
  const r = E.renderLayer(createCanvas, { kind: 'text', text, family: '"' + fam + '"', tail: fam === 'Yellowtail', tilt: fam === 'Yellowtail' ? 7 : 0, width: w,
    colors: { fill: '#000' }, bands: { n: cols.length, dir }, effects: { stroke: { on: true, width: 1.5, color: '#071650' } } });
  r.parts.forEach(p => { if (p.role === 'band') p.color = cols[p.band]; });
  console.log(label.padEnd(10), r.parts.map(p => p.role + (p.band !== undefined ? p.band : '') + ':' + p.chords.length + (p.under ? '/u' + p.under.length : '')).join(' '));
  r.label = label; out.push(r);
}
plot(out, 'test/out/bands.png', 3.4, 2);
