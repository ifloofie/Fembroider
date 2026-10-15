// contact sheet: source | stitched at several pre-blur levels, with jump counts (image pipeline tuning aid)
import { E, createCanvas, loadImage } from './plot.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const base = Object.assign({}, APP.spec); ['kind','text','family','tail','tailWeight','tilt','width','colors','weight','effects'].forEach(k => delete base[k]);
const files = process.argv[2].split(','), levels = (process.argv[3] || '0,0.4,0.8').split(',').map(Number), out = process.argv[4] || 'test/out/stress/blur_compare.png';
const CW = 420, CH = 420, sheet = createCanvas(CW * (levels.length + 1), CH * files.length), sx = sheet.getContext('2d');
sx.fillStyle = '#efe7d6'; sx.fillRect(0, 0, sheet.width, sheet.height);
for (let i = 0; i < files.length; i++) {
  const img = await loadImage(fs.readFileSync('test/stress_images/' + files[i]));
  const s = Math.min((CW - 20) / img.width, (CH - 40) / img.height);
  sx.drawImage(img, 10, i * CH + 30, img.width * s, img.height * s);
  sx.fillStyle = '#222'; sx.font = '16px sans-serif'; sx.fillText(files[i], 10, i * CH + 20);
  for (let j = 0; j < levels.length; j++) {
    const r = E.renderLayer(createCanvas, Object.assign({}, base, { kind: 'raster', source: img, sizeMM: 100, maxColors: +(process.env.COLORS || 5), removeBg: true, blurMM: levels[j] }));
    const seq = X.buildSequence([{ name: 'x', result: r, transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: 0.3 });
    const c = createCanvas(CW, CH - 30), cx = c.getContext('2d');
    X.drawPreview(seq, cx, CW, CH - 30, { margin: 10, background: '#efe7d6', lineWidth: 1.0 });
    sx.drawImage(c, CW * (j + 1), i * CH + 30);
    sx.fillStyle = '#222'; sx.fillText(`blur ${levels[j]} mm · ${seq.stats.jumps} jumps · ${seq.stats.stitches} st · ${seq.threads.length} col`, CW * (j + 1) + 10, i * CH + 20);
  }
}
fs.writeFileSync(out, sheet.toBuffer('image/png'));
console.log('wrote', out);
