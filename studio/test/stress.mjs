// Stress sweep: renders fonts, emoji or images with the app's own stitch settings (test/app_spec.json), plans the
// sewing order and scores each design for travel and stitch-quality problems. One JSON line per design.
// Usage: node test/stress.mjs fonts|emoji|images [start] [end]      (images: test/stress_images/*.png|jpg|svg)
import { E, createCanvas, loadImage, FONTS } from './plot.mjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const X = require('../src/export.js');
const svgAtSize = (await import('../src/svgsize.js')).default;
const APP = JSON.parse(fs.readFileSync('test/app_spec.json', 'utf8'));
const [mode, a0, a1] = process.argv.slice(2);
const OUT = 'test/out/stress'; fs.mkdirSync(OUT, { recursive: true });

const base = Object.assign({}, APP.spec); ['kind', 'text', 'family', 'tail', 'tailWeight', 'tilt', 'width', 'colors', 'weight'].forEach(k => delete base[k]);
const TEXT_COLOURS = { fill: '#b3202f', stroke: '#16233f', stroke2: '#f4f2ee', shadow: '#8a8f99' };
const ROLE_OF = { '#000000': 'fill', '#000001': 'stroke', '#000002': 'stroke2', '#000003': 'shadow' };

function seqMetrics(seq) {
  const c = seq.cmds; let x = 0, y = 0, prev = null, col = 0;
  const m = { stitches: 0, jumps: 0, jumpMM: 0, longestJump: 0, backJumps: 0, backMM: 0, worstBack: 0, shortJumps: 0,
    longStitches: 0, tinyStitches: 0, longestStitch: 0, colourChanges: 0, threads: seq.threads.length, travels: seq.stats.travels, minutes: seq.stats.minutes };
  let run = null, first = true; // current jump run (start point); the first jump of a colour is its planned return
  m.returnMM = 0;
  const endRun = () => {
    if (!run) return;
    const dx = x - run[0], d = Math.hypot(x - run[0], y - run[1]);
    m.jumps++; m.jumpMM += d; m.longestJump = Math.max(m.longestJump, d);
    if (first) m.returnMM += Math.max(0, -dx);
    else if (d < 1.5) m.shortJumps++;
    else if (dx < -5) { m.backJumps++; m.backMM += -dx; m.worstBack = Math.max(m.worstBack, -dx); }
    run = null; first = false;
  };
  for (const k of c) {
    if (k[2] === 'C') { endRun(); m.colourChanges++; col++; prev = null; first = true; continue; }
    if (k[2] === 'J') { if (!run) run = [x, y]; x = k[0]; y = k[1]; prev = null; continue; }
    if (run) endRun(); else first = false;
    if (prev) {
      const L = Math.hypot(k[0] - x, k[1] - y);
      if (L > 0.01) { m.stitches++; if (L > 8) m.longStitches++; if (L < 0.25) m.tinyStitches++; m.longestStitch = Math.max(m.longestStitch, L); }
    }
    x = k[0]; y = k[1]; prev = k;
  }
  endRun();
  m.colourRevisits = Math.max(0, m.colourChanges - (new Set(seq.threads.map(t => t.color)).size - 1));
  m.w = seq.bounds.w; m.h = seq.bounds.h;
  for (const k of Object.keys(m)) if (typeof m[k] === 'number') m[k] = +m[k].toFixed(2);
  return m;
}

function run(item, spec, placedColour) {
  const t0 = performance.now();
  let r;
  try { r = E.renderLayer(createCanvas, spec); }
  catch (err) { return { item, error: 'render: ' + (err && err.message || err) }; }
  const tRender = performance.now() - t0;
  const parts = r.parts.map(p => Object.assign({}, p, { color: placedColour ? placedColour(p) : p.color, thread: null }))
    .filter(p => p.chords && p.chords.length);
  if (!parts.length) return { item, error: 'no stitches', tRender: Math.round(tRender) };
  const tiny = r.parts.filter(p => p.chords && p.chords.length && p.chords.length < 8).length;
  let seq;
  const t1 = performance.now();
  try { seq = X.buildSequence([{ name: item, result: Object.assign({}, r, { parts }), transform: { x: 0, y: 0, rotation: 0 } }], { minStitch: APP.eff.minStitch, speed: 700 }); }
  catch (err) { return { item, error: 'sequence: ' + (err && err.message || err) }; }
  const out = Object.assign({ item, tRender: Math.round(tRender), tSeq: Math.round(performance.now() - t1), parts: parts.length, tinyParts: tiny }, seqMetrics(seq));
  return { out, r, seq };
}

const results = [];
const emit = o => { results.push(o); };
if (mode === 'fonts') {
  const names = Object.keys(FONTS).slice(+(a0 || 0), a1 ? +a1 : undefined);
  const texts = ['Floof', 'Bowie', 'Wildcats 23', 'MOUNTAIN'];
  for (const name of names) for (const text of texts) {
    const f = JSON.parse(fs.readFileSync('src/fonts.json', 'utf8')).find(x => x.name === name);
    const spec = Object.assign({}, base, { kind: 'text', text, family: '"' + name + '"', weight: f.weight === 400 ? undefined : String(f.weight),
      tail: text === 'Floof' || text === 'Bowie' ? 'classic' : 'none', tailWeight: 1, tilt: 0, width: 110, colors: { fill: '#000000' } });
    const res = run(name + ' · ' + text, spec, p => TEXT_COLOURS[ROLE_OF[p.color] || 'fill'] || p.color);
    emit(res.out || res);
  }
} else if (mode === 'emoji') {
  const all = JSON.parse(fs.readFileSync('src/emoji.json', 'utf8')).filter(e => !/1f3f[b-f]/.test(e.code));
  const list = all.slice(+(a0 || 0), a1 ? +a1 : undefined);
  for (const e of list) {
    const img = await loadImage(Buffer.from(svgAtSize(e.svg, 600)));
    const spec = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: 60, palette: E.parseSvgPalette(e.svg) });
    delete spec.effects;
    const res = run(e.code + ' ' + e.label, spec);
    emit(Object.assign(res.out || res, { group: e.group }));
  }
} else if (mode === 'images') {
  const dir = 'test/stress_images', files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|svg)$/i.test(f)).sort().slice(+(a0 || 0), a1 ? +a1 : undefined);
  const SIZE = +(process.env.SIZE || 100), COLS = +(process.env.COLORS || 5);
  const keep = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f)), svg = /\.svg$/i.test(f);
    let img;
    try { img = await loadImage(svg ? Buffer.from(svgAtSize(buf.toString('utf8'), 900)) : buf); }
    catch (err) { emit({ item: f, error: 'load: ' + err.message }); continue; }
    const spec = Object.assign({}, base, { kind: 'raster', source: img, sizeMM: SIZE, maxColors: COLS, removeBg: true });
    delete spec.effects;
    if (svg) { const pal = E.parseSvgPalette(buf.toString('utf8')); if (pal.length) { spec.palette = pal; delete spec.maxColors; } }
    const res = run(f, spec);
    emit(res.out || res);
    if (res.r) keep.push({ f, r: res.r, seq: res.seq });
  }
  // contact sheet: the stitched result next to each source
  for (const k of keep) {
    const S = 6, bd = k.seq.bounds, w = Math.ceil(bd.w * S) + 40, h = Math.ceil(bd.h * S) + 40;
    const c = createCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#efe7d6'; x.fillRect(0, 0, w, h); x.lineCap = 'round';
    X.drawPreview(k.seq, x, w, h, { margin: 20, background: '#efe7d6', lineWidth: 0.32 * S });
    fs.writeFileSync(`${OUT}/img_${k.f.replace(/\.[^.]+$/, '')}_${SIZE}mm_${COLS}c.png`, c.toBuffer('image/png'));
  }
}
const tag = `${mode}_${a0 || 0}_${a1 || 'end'}` + (mode === 'images' ? `_${process.env.SIZE || 100}mm_${process.env.COLORS || 5}c` : '');
fs.writeFileSync(`${OUT}/${tag}.jsonl`, results.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(tag, results.length, 'designs', results.filter(r => r.error).length, 'errors');
