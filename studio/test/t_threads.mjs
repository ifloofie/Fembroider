// Thread-aware parameters: density, pull compensation, underlay type, tatami angle. Plots top stitches + underlay.
import { E, createCanvas } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const X = createRequire(import.meta.url)('../src/export.js');
const sets = [
  ['40wt woven (centre)', { satinSpacingMM: 0.40, tatamiSpacingMM: 0.42, pullCompMM: 0.20, underlay: 'center', splitMM: 7, satinMaxMM: 7, tatamiStitchMM: 3.0 }],
  ['40wt knit (edge+zigzag)', { satinSpacingMM: 0.42, tatamiSpacingMM: 0.44, pullCompMM: 0.40, underlay: 'zigzag', splitMM: 7, satinMaxMM: 7, tatamiStitchMM: 3.0 }],
  ['30wt denim (edge)', { satinSpacingMM: 0.50, tatamiSpacingMM: 0.52, pullCompMM: 0.20, underlay: 'edge', splitMM: 8, satinMaxMM: 8, tatamiStitchMM: 3.5 }],
  ['60wt light, tatami 0°', { satinSpacingMM: 0.30, tatamiSpacingMM: 0.32, pullCompMM: 0.15, underlay: 'center', splitMM: 5.5, satinMaxMM: 5, tatamiStitchMM: 2.5, tatamiAngleDeg: 0 }],
];
const S = 3.4, cw = 520, ch = 300, c = createCanvas(cw * 2, ch * 2), x = c.getContext('2d');
x.fillStyle = '#efe7d6'; x.fillRect(0, 0, c.width, c.height);
sets.forEach(([label, o], k) => {
  const r = E.renderLayer(createCanvas, Object.assign({ kind: 'text', text: 'Hawks', family: '"Alfa Slab One"', tail: false, tilt: 0, width: 110, colors: { fill: '#b3202f' },
    effects: { stroke: { on: true, width: 1.2, color: '#16233f' } } }, o));
  const seq = X.buildSequence([{ name: label, result: r, transform: {} }], { minStitch: o.satinSpacingMM > 0.45 ? 0.4 : 0.3 });
  const fill = r.parts.find(p => p.role === 'fill');
  console.log(label.padEnd(26), 'fill', fill.chords.length, 'underlay paths', fill.under.length, 'stroke', r.parts.find(p => p.role === 'stroke').chords.length, '| stitches', seq.stats.stitches, 'jumps', seq.stats.jumps);
  const ox = (k % 2) * cw + cw / 2, oy = Math.floor(k / 2) * ch + ch / 2;
  x.lineCap = 'round';
  for (const p of r.parts) { x.strokeStyle = p.color; x.lineWidth = 0.35 * S; x.globalAlpha = 0.55;
    for (const s of p.chords) { x.beginPath(); x.moveTo(ox + s[0] * S, oy - s[1] * S); x.lineTo(ox + s[2] * S, oy - s[3] * S); x.stroke(); } }
  x.globalAlpha = 1; x.strokeStyle = '#00a0ff'; x.lineWidth = 1.2;
  for (const pl of fill.under) { x.beginPath(); pl.forEach((q, i) => i ? x.lineTo(ox + q[0] * S, oy - q[1] * S) : x.moveTo(ox + q[0] * S, oy - q[1] * S)); x.stroke(); }
  x.fillStyle = '#333'; x.font = '15px sans-serif'; x.fillText(label, (k % 2) * cw + 8, Math.floor(k / 2) * ch + 20);
});
fs.writeFileSync('test/out/threads.png', c.toBuffer('image/png'));
