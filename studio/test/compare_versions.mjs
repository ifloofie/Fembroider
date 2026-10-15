// before/after contact sheet: source | old engine | new engine, with jumps and threads (stress-test report aid)
import { createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NEW = { E: require('../src/engine.js'), X: require('../src/export.js') };
const OLDDIR = process.env.OLD;
const OLD = { E: require(OLDDIR + '/src/engine.js'), X: require(OLDDIR + '/src/export.js') };
const svgAtSize = (await import('../src/svgsize.js')).default;
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const base = Object.assign({}, APP.spec); ['kind','text','family','tail','tailWeight','tilt','width','colors','weight','effects'].forEach(k => delete base[k]);
const files = process.argv[2].split(','), out = process.argv[3];
const CW = 380, CH = 400, sheet = createCanvas(CW * 3, CH * files.length), sx = sheet.getContext('2d');
sx.fillStyle = '#f3efe6'; sx.fillRect(0, 0, sheet.width, sheet.height);
const stats = [];
for (let i = 0; i < files.length; i++) {
  const f = files[i], svg = /\.svg$/.test(f), buf = fs.readFileSync('test/stress_images/' + f);
  const img = await loadImage(svg ? Buffer.from(svgAtSize(buf.toString('utf8'), 900)) : buf);
  const s = Math.min((CW - 20) / img.width, (CH - 40) / img.height);
  sx.drawImage(img, 10, i * CH + 30, img.width * s, img.height * s);
  sx.fillStyle = '#222'; sx.font = '15px sans-serif'; sx.fillText(f, 10, i * CH + 20);
  const row = { f };
  [['before', OLD], ['after', NEW]].forEach(([tag, V], j) => {
    const spec = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: 100, maxColors: 5, removeBg: true });
    if (svg) { const pal = V.E.parseSvgPalette(buf.toString('utf8')); if (pal.length) { spec.palette = pal; delete spec.maxColors; } }
    const r = V.E.renderLayer(createCanvas, spec);
    const parts = r.parts.filter(p => p.chords.length);
    if (!parts.length) { sx.fillText(tag + ': nothing stitched', CW * (j + 1) + 10, i * CH + 20); row[tag] = null; return; }
    const seq = V.X.buildSequence([{ name: 'x', result: Object.assign({}, r, { parts }), transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: 0.3 });
    const c = createCanvas(CW, CH - 30), cx = c.getContext('2d');
    V.X.drawPreview(seq, cx, CW, CH - 30, { margin: 10, background: '#f3efe6', lineWidth: 1.0 });
    sx.drawImage(c, CW * (j + 1), i * CH + 30);
    sx.fillStyle = '#222'; sx.fillText(`${tag}: ${seq.stats.jumps} jumps · ${seq.threads.length} threads · ${seq.stats.stitches.toLocaleString('en-US')} st`, CW * (j + 1) + 10, i * CH + 20);
    row[tag] = { jumps: seq.stats.jumps, threads: seq.threads.length, stitches: seq.stats.stitches };
  });
  stats.push(row);
}
fs.writeFileSync(out, sheet.toBuffer('image/png'));
fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify(stats));
console.log('wrote', out);
