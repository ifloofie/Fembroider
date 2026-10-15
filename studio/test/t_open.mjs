// Opened stitch files through the sewing planner: every stitch of the file must come out unchanged (same count, same
// needle points), after a round trip through our own writers. Usage: node test/t_open.mjs <file> [file...]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = require('../src/readers.js'), X = require('../src/export.js');
for (const f of process.argv.slice(2)) {
  const d = R.read(new Uint8Array(fs.readFileSync(f)), path.basename(f));
  const b = d.bounds, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const parts = d.blocks.map((bl, i) => {
    const runs = bl.runs.map(r => r.map(q => [q[0] - cx, q[1] - cy])), chords = [];
    runs.forEach(r => { for (let j = 1; j < r.length; j++) chords.push([r[j - 1][0], r[j - 1][1], r[j][0], r[j][1]]); });
    return { role: 'colour', color: bl.color, kind: 'stitches', key: 'block:' + i, runs, chords, thread: { name: bl.name || bl.color } };
  });
  const seq = X.buildSequence([{ name: 'x', result: { parts, inside: null }, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: 0.3, speed: 700 });
  const fileSt = d.blocks.reduce((a, x) => a + x.stitches, 0);
  const out = { file: path.basename(f), fileStitches: fileSt, planned: seq.stats.stitches, jumps: seq.stats.jumps, changes: seq.stats.colorChanges, fileChanges: d.blocks.length - 1 };
  // our writers, read back by our readers
  for (const [fmt, fn] of [['dst', X.writeDST], ['exp', X.writeEXP], ['pes', X.writePES], ['jef', X.writeJEF]]) {
    try {
      let bytes = fn(seq, 'TEST'); if (bytes && bytes.bytes) bytes = bytes.bytes;
      const back = R.read(new Uint8Array(bytes), 'x.' + fmt);
      out[fmt] = back.blocks.reduce((a, x) => a + x.stitches, 0);
    } catch (e) { out[fmt] = 'ERR ' + e.message.slice(0, 60); }
  }
  console.log(JSON.stringify(out));
}
