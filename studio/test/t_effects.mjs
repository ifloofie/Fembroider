import { E, createCanvas, plot } from './plot.mjs';
const base = { kind: 'text', text: 'Bowie', family: 'Yellowtail', tail: true, colors: { fill: '#b3202f' } };
const variants = [
  ['fill only', {}],
  ['stroke 1.5', { stroke: { on: true, width: 1.5, color: '#16233f' } }],
  ['stroke + 2nd stroke', { stroke: { on: true, width: 1.4, color: '#ffffff' }, stroke2: { on: true, width: 1.6, color: '#16233f' } }],
  ['stroke + shadow', { stroke: { on: true, width: 1.5, color: '#16233f' }, shadow: { on: true, dx: 1.6, dy: -1.6, color: '#8a8f99' } }],
  ['all three', { stroke: { on: true, width: 1.2, color: '#f4f2ee' }, stroke2: { on: true, width: 1.4, color: '#1d3461' }, shadow: { on: true, dx: 2, dy: -2, color: '#d48700' } }],
];
const out = [];
for (const [label, effects] of variants) {
  const r = E.renderLayer(createCanvas, { ...base, effects, debug: true });
  r.label = `${label}: ${r.size.w.toFixed(0)}x${r.size.h.toFixed(0)} mm, ${r.stitchCount} st, ${r.ms} ms`;
  console.log(r.label, r.parts.map(p => `${p.role}/${p.kind}:${p.chords.length}${p.gapsMM2 !== undefined ? ' gaps ' + p.gapsMM2.toFixed(2) : ''}`).join(' | '));
  out.push(r);
}
plot(out, 'test/out/effects.png', 3.4, 2);
