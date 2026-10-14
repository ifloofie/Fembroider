  // ===================== threads, needles, fabric → stitch parameters =====================
  // The user says what they sew with; every "Auto" stitch parameter follows from it, and the panel explains why.
  var LINES = {}; A.threadLines.forEach(function (l) { LINES[l.id] = l; });
  // width: how wide the thread lies once the needle has pressed it flat (measured from sew-outs, not the
  // nominal diameter). Auto line spacing is derived from it: satin rows overlap their neighbours by ~15%,
  // fill rows by ~5%, so fabric doesn't show between them.
  var WEIGHTS = {
    60: { label: '60 wt', note: 'fine detail, small lettering', width: 0.24, ts: 2.5, min: 0.25, sat: 5.0, split: 5.5, needle: 0 },
    40: { label: '40 wt', note: 'the standard embroidery weight', width: 0.32, ts: 3.0, min: 0.30, sat: 7.0, split: 7.0, needle: 2 },
    30: { label: '30 wt', note: 'bolder, about 30% heavier coverage', width: 0.40, ts: 3.5, min: 0.40, sat: 8.0, split: 8.0, needle: 3 },
    12: { label: '12 wt', note: 'heavy, hand-stitched look', width: 0.62, ts: 4.0, min: 0.80, sat: 10, split: 9.0, needle: 5 }
  };
  var SATIN_OF_WIDTH = 0.85, FILL_OF_WIDTH = 0.95, STROKE_OF_WIDTH = 0.65;
  Object.keys(WEIGHTS).forEach(function (k) { var w = WEIGHTS[k]; w.sp = w.width * SATIN_OF_WIDTH; w.tsp = w.width * FILL_OF_WIDTH; });
  var NEEDLES = ['65/9', '70/10', '75/11', '80/12', '90/14', '100/16'];
  var POINTS = { sharp: 'Sharp', ballpoint: 'Ballpoint', metallic: 'Metallic' };
  var FABRICS = {
    woven: { label: 'Woven cotton / twill', pc: 0.20, sp: 1.00, under: 'normal', point: 'sharp', stab: 'Tear-away, medium weight' },
    light: { label: 'Lightweight woven (shirting, linen)', pc: 0.15, sp: 1.08, under: 'light', point: 'sharp', stab: 'No-show mesh cut-away, or wash-away for sheers' },
    denim: { label: 'Denim / canvas', pc: 0.15, sp: 1.00, under: 'normal', point: 'sharp', needle: 4, stab: 'Tear-away, medium to heavy' },
    knit: { label: 'T-shirt knit (jersey)', pc: 0.35, sp: 1.06, under: 'heavy', point: 'ballpoint', stab: 'Cut-away (no-show mesh), fused to the back' },
    pique: { label: 'Piqué polo', pc: 0.30, sp: 1.00, under: 'heavy', point: 'ballpoint', stab: 'Cut-away, plus water-soluble topping' },
    fleece: { label: 'Fleece / sweatshirt', pc: 0.30, sp: 0.95, under: 'heavy', point: 'ballpoint', stab: 'Cut-away, plus water-soluble topping' },
    towel: { label: 'Towel / terry', pc: 0.30, sp: 0.92, under: 'heavy', point: 'sharp', stab: 'Tear-away, plus water-soluble topping so loops don’t poke through' },
    felt: { label: 'Felt / non-woven', pc: 0.10, sp: 1.05, under: 'light', point: 'sharp', stab: 'Light tear-away, or none' }
  };
  var MATERIAL = {
    rayon: { label: 'Rayon', sp: 1.00, note: 'Highest sheen; not bleach-safe.' },
    poly: { label: 'Polyester', sp: 1.00, note: 'Strong and colourfast; bleach-safe; slightly less sheen than rayon.' },
    cotton: { label: 'Cotton', sp: 1.05, min: 0.05, note: 'Matte; a little more lint, so clean the bobbin area more often.' },
    wool: { label: 'Wool blend', sp: 1.00, note: 'Matte and lofty; use a 100/16 needle and a slow speed.' },
    metallic: { label: 'Metallic', sp: 1.15, minAbs: 0.5, sat: 5.0, split: 5.0, ts: 3.5, needle: 4, note: 'Sew slowly, with a metallic or topstitch needle and looser top tension.' }
  };
  function lineOf() { return LINES[doc.threads.line] || LINES.janome; }
  function layerMaterial(L) { return L && L.thread && L.thread !== 'auto' && MATERIAL[L.thread] ? L.thread : lineOf().material; }
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  function recommend(mat) {
    var T = doc.threads, line = lineOf(), Wt = WEIGHTS[T.weight] || WEIGHTS[40], F = FABRICS[T.fabric] || FABRICS.woven;
    mat = mat || line.material;
    var M = MATERIAL[mat] || MATERIAL.poly, notes = [];
    var sp = Wt.sp * F.sp * M.sp, tsp = Wt.tsp * F.sp * M.sp, min = Math.max(Wt.min, M.minAbs || 0) + (M.min || 0);
    var pc = F.pc + (T.weight <= 30 ? 0.05 : 0), sat = Math.min(Wt.sat, M.sat || 99), split = Math.min(Wt.split, M.split || 99), ts = Math.max(Wt.ts, M.ts || 0);
    var recIdx = Math.max(Wt.needle, F.needle || 0, M.needle || 0), cur = NEEDLES.indexOf(T.needle), d;
    if (cur < 0) cur = 2;
    d = cur - recIdx;
    var recPoint = mat === 'metallic' ? 'metallic' : F.point;
    if (d <= -2) notes.push(['bad', 'Needle ' + T.needle + ' is too small for ' + Wt.label + (mat === 'metallic' ? ' metallic' : '') + ' thread: expect shredding and breaks. Use ' + NEEDLES[recIdx] + '.']);
    else if (d === -1) notes.push(['warn', 'Needle ' + T.needle + ' is one size small for ' + Wt.label + ' thread. Fine for small lettering; slow down if the thread frays. ' + NEEDLES[recIdx] + ' is ideal.']);
    else if (d >= 2) {
      sp *= 1 + 0.03 * (d - 1); tsp *= 1 + 0.03 * (d - 1); min += 0.1 * (d - 1);
      notes.push(['warn', 'Needle ' + T.needle + ' is large for ' + Wt.label + ' thread and leaves bigger holes, so Auto opens the density by ' + Math.round(3 * (d - 1)) + '% and lengthens the shortest stitch. ' + NEEDLES[recIdx] + ' is ideal.']);
    } else notes.push(['ok', 'Needle ' + T.needle + ' suits ' + Wt.label + ' ' + (MATERIAL[mat] || M).label.toLowerCase() + ' on ' + F.label.toLowerCase() + '.']);
    var knitty = T.fabric === 'knit' || T.fabric === 'pique' || T.fabric === 'fleece';
    if (T.point === 'sharp' && knitty) { sp *= 1.03; notes.push(['warn', 'A sharp point can cut knit loops and leave holes or runs. Use a ballpoint; Auto opens the density a little meanwhile.']); }
    else if (T.point === 'ballpoint' && !knitty && mat !== 'metallic') { pc += 0.05; notes.push(['warn', 'A ballpoint deflects on woven fabric, so edges wander slightly. A sharp needle is better; Auto adds 0.05 mm pull compensation.']); }
    if (mat === 'metallic' && T.point !== 'metallic') notes.push(['warn', 'Metallic thread needs a metallic or topstitch needle (long eye) or it will shred.']);
    if (T.point === 'metallic' && mat !== 'metallic') notes.push(['ok', 'A metallic needle works for regular thread too, it just leaves slightly larger holes.']);
    if (T.weight === 12 && cur < 5) notes.push(['bad', '12 wt thread needs a 100/16 needle (or a topstitch 100) to pass through the eye.']);
    // light thread on dark fabric (or the reverse) shows every gap: sew 7% denser
    var fab = lin(doc.fabric), fl = 0.2126 * fab[0] + 0.7152 * fab[1] + 0.0722 * fab[2];
    if (fl < 0.06 || fl > 0.75) { sp *= 0.93; tsp *= 0.93; notes.push(['ok', (fl < 0.06 ? 'Dark' : 'Light') + ' fabric: Auto sews 7% denser so the fabric doesn’t show between rows.']); }
    var under = F.under === 'light' ? 'center' : F.under === 'heavy' ? 'zigzag' : 'edge';
    return { sp: r2(sp), tsp: r2(tsp), osp: r2(sp * STROKE_OF_WIDTH / SATIN_OF_WIDTH), ts: r2(ts), min: r2(min), pc: r2(pc), sat: r2(sat), split: r2(split), underlay: under,
      needle: NEEDLES[recIdx], point: recPoint, width: Wt.width * (mat === 'metallic' ? 0.85 : 1), notes: notes, stab: F.stab, mat: mat };
  }
  var UNDERLAY = { center: 'Centre run', edge: 'Edge run', zigzag: 'Edge + zigzag', none: 'None' };
  function pickSet(k, v) { var s = doc.stitch[k]; return s === null || s === undefined ? v : s; }
  function effStitch(L) {
    var R = recommend(layerMaterial(L)), s = doc.stitch;
    return {
      satinSpacing: pickSet('spacing', R.sp), strokeSpacing: pickSet('strokeSpacing', R.osp), tatamiSpacing: pickSet('tatamiSpacing', R.tsp), tatamiStitch: pickSet('tatamiStitch', R.ts),
      pullComp: pickSet('pullComp', R.pc), minStitch: pickSet('minStitch', R.min), satinMax: pickSet('satinMax', R.sat), split: pickSet('split', R.split),
      underlay: s.underlay && s.underlay !== 'auto' ? s.underlay : R.underlay, tatamiAngle: s.tatamiAngle === undefined ? null : s.tatamiAngle,
      fillMode: s.fillMode || 'patch', R: R
    };
  }
  // nearest thread in the chosen brand's chart (cached), with the JEF index the Janome format needs
  var TCACHE = new Map();
  function threadFor(hex) {
    var line = lineOf(), key = line.id + hex;
    if (!TCACHE.has(key)) {
      var t = E.nearestInChart(line.chart, hex);
      TCACHE.set(key, { hex: t.hex, name: t.name, code: t.code, dE: t.dE, brand: line.brand + (line.id === 'janome' ? '' : ' ' + line.line), index: E.nearestThread(t.hex).index });
    }
    return TCACHE.get(key);
  }
  function snapColour(hex) { return doc.threads.snap ? threadFor(hex).hex : hex; }
  function threadsChanged() {
    shared.uWidth.value = recommend().width;
    doc.layers.forEach(function (L) { recolorLayer(L); requestRender(L); });
    styleHoops(); scheduleSequence(); requestDraw();
  }
