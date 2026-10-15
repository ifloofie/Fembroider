// Embroidery readers: reads every design file in the given folders and prints one JSON line per file
// (stitches, colour blocks, extent in mm, thread colours). Usage: node test/t_read.mjs <dir> [dir...]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = require('../src/readers.js');
for (const dir of process.argv.slice(2)) for (const f of fs.readdirSync(dir).sort()) {
  if (!R.canRead(f)) continue;
  const comp = {}; fs.readdirSync(dir).forEach(g => { if (/\.inf$/i.test(g)) comp[g] = fs.readFileSync(path.join(dir, g)); });
  try {
    const t0 = performance.now(), d = R.read(new Uint8Array(fs.readFileSync(path.join(dir, f))), f, comp);
    const st = d.blocks.reduce((a, b) => a + b.stitches, 0);
    console.log(JSON.stringify({ file: f, st, blocks: d.blocks.length, w: +d.bounds.w.toFixed(1), h: +d.bounds.h.toFixed(1), x0: +d.bounds.x0.toFixed(1), y1: +d.bounds.y1.toFixed(1), cols: d.blocks.map(b => b.color), name: d.name, ms: Math.round(performance.now() - t0) }));
  } catch (e) { console.log(JSON.stringify({ file: f, err: e.message })); }
}
