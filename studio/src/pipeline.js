  // ======================================================================
  // Generic pipeline: ordered colour masks -> stitch parts, plus effects.
  // All masks share the module canvas (W x H at PX px/mm), y down.
  // ======================================================================

  var THREADS = /*THREADS*/;   // Janome thread chart: [hex, name, code], index = JEF colour index

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return '#' + c.map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }
  // perceptual-ish distance ("redmean")
  function colDist(a, b) {
    var rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }
  function nearestThread(hex) {
    var c = hexToRgb(hex), best = 1, bd = Infinity;
    for (var i = 1; i < THREADS.length; i++) {
      var d = colDist(c, hexToRgb(THREADS[i][0]));
      if (d < bd) { bd = d; best = i; }
    }
    return { index: best, hex: THREADS[best][0], name: THREADS[best][1], code: THREADS[best][2] };
  }

  // nearest colour in any thread chart ([[hex, name, code], ...]); Lab values cached per chart
  var CHART_LAB = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function nearestInChart(chart, hex, exclude) {
    var lab = CHART_LAB && CHART_LAB.get(chart);
    if (!lab) { lab = chart.map(function (t) { return toLab(hexToRgb(t[0])); }); if (CHART_LAB) CHART_LAB.set(chart, lab); }
    var c = toLab(hexToRgb(hex)), best = 0, bd = Infinity;
    for (var i = 0; i < chart.length; i++) { if (i === exclude) continue; var d = dE2000(c, lab[i]); if (d < bd) { bd = d; best = i; } }
    return { index: best, hex: chart[best][0], name: chart[best][1], code: chart[best][2], dE: bd };
  }

  // fill colours in SVG paint order (first appearance), for flat-colour artwork like Twemoji
  function parseSvgPalette(svg) {
    var out = [], seen = {};
    var re = /fill\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g, m;
    while ((m = re.exec(svg))) {
      var h = rgbToHex(hexToRgb(m[1]));
      if (!seen[h]) { seen[h] = 1; out.push(h); }
    }
    return out;
  }

  function newMask() { return new Uint8Array(W * H); }
  function countOn(m) { var n = 0; for (var i = 0; i < m.length; i++) n += m[i]; return n; }
  function dilateMask(m, rPx) {
    var d = edt(m, true), o = newMask();
    for (var i = 0; i < W * H; i++) o[i] = (m[i] || d[i] <= rPx) ? 1 : 0;
    return o;
  }
  function erodeMask(m, rPx) {
    var d = edt(m, false), o = newMask();
    for (var i = 0; i < W * H; i++) o[i] = d[i] > rPx ? 1 : 0;
    return o;
  }
  function shiftMask(m, dx, dy) {
    var o = newMask(); dx = Math.round(dx); dy = Math.round(dy);
    for (var y = 0; y < H; y++) {
      var sy = y - dy; if (sy < 0 || sy >= H) continue;
      for (var x = 0; x < W; x++) { var sx = x - dx; if (sx >= 0 && sx < W && m[sy * W + sx]) o[y * W + x] = 1; }
    }
    return o;
  }
  function unionMasks(list) {
    var o = newMask();
    list.forEach(function (m) { for (var i = 0; i < W * H; i++) if (m[i]) o[i] = 1; });
    return o;
  }

  // ---------- tatami fill for wide shapes ----------
  // Rows `spacing` apart at `angle`; stitches `stitch` long, broken in a 4-row brick pattern so
  // needle holes don't line up. Rows run back and forth so they sew as one continuous zigzag.
  function tatami(inside, bbox, angle, spacingMM, stitchMM, src) {
    var dx = Math.cos(angle), dy = Math.sin(angle), mx = -dy, my = dx, out = [];
    var m0 = Infinity, m1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    [[bbox.minX, bbox.minY], [bbox.maxX, bbox.minY], [bbox.minX, bbox.maxY], [bbox.maxX, bbox.maxY]].forEach(function (c) {
      var pm = c[0] * mx + c[1] * my, pd = c[0] * dx + c[1] * dy;
      m0 = Math.min(m0, pm); m1 = Math.max(m1, pm); d0 = Math.min(d0, pd); d1 = Math.max(d1, pd);
    });
    var gap = spacingMM * PX, piece = stitchMM * PX, OFF = [0, 0.5, 0.25, 0.75], row = 0;
    function at(t, s) { return inside(Math.round(mx * s + dx * t), Math.round(my * s + dy * t)); }
    for (var s = m0 + gap / 2; s <= m1; s += gap, row++) {
      var runs = [], start = null;
      for (var t = d0 - 1; t <= d1 + 1; t += 0.5) {
        var on = at(t, s);
        if (on && start === null) start = t;
        if (!on && start !== null) { runs.push([start, t - 0.5]); start = null; }
      }
      if (start !== null) runs.push([start, d1 + 1]);
      var rev = row % 2 === 1;
      if (rev) runs.reverse();
      runs.forEach(function (rn) {
        if (rn[1] - rn[0] < 4) return;
        // cut points on a global grid along the row so the brick pattern is regular
        var off = OFF[row % 4] * piece, cuts = [rn[0]];
        var k0 = Math.ceil((rn[0] - d0 - off) / piece);
        for (var k = k0; ; k++) {
          var c = d0 + off + k * piece;
          if (c >= rn[1] - 0.35 * piece) break;
          if (c > rn[0] + 0.35 * piece) cuts.push(c);
        }
        cuts.push(rn[1]);
        if (rev) cuts.reverse();
        for (var i = 0; i < cuts.length - 1; i++) {
          var ta = cuts[i], tb = cuts[i + 1];
          out.push([(mx * s + dx * ta) / PX, (my * s + dy * ta) / PX, (mx * s + dx * tb) / PX, (my * s + dy * tb) / PX, src, -4]);
        }
      });
    }
    return out;
  }

  // principal axis of an island (radians), used to lay tatami across the long direction
  function principalAngle(lab, I) {
    var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
    for (var y = I.minY; y <= I.maxY; y += 2) for (var x = I.minX; x <= I.maxX; x += 2) {
      if (lab[y * W + x] !== I.id) continue;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; n++;
    }
    if (n < 4) return 0;
    var mxv = sx / n, myv = sy / n, cxx = sxx / n - mxv * mxv, cyy = syy / n - myv * myv, cxy = sxy / n - mxv * myv;
    return 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  }

  // ---------- fill one colour region ----------
  // Narrow strokes (under ~7 mm) get satin columns along their centrelines; wide shapes get
  // tatami rows with a perpendicular underlay. Satin gaps are patched or fall back per island.
  // Satin underlay chosen per column from its width: centre run for narrow columns, an edge run (both sides,
  // 0.4 mm inside) for medium ones, plus a zigzag for wide columns when the fabric needs more support.
  function satinUnderlay(chords, centres, mode) {
    if (mode === 'none') return [];
    var byCol = {};
    // long satin stitches were split into pieces; join them back into whole column stitches first
    var lastEnd = null;
    chords.forEach(function (c) {
      if (!(c[5] >= 0) || c[4]) { lastEnd = null; return; }
      var col = byCol[c[5]] = byCol[c[5]] || [], tail = col[col.length - 1];
      if (tail && lastEnd && Math.abs(c[0] - lastEnd[0]) < 1e-6 && Math.abs(c[1] - lastEnd[1]) < 1e-6) { tail[2] = c[2]; tail[3] = c[3]; }
      else col.push([c[0], c[1], c[2], c[3]]);
      lastEnd = [c[2], c[3]];
    });
    var out = [], used = {};
    Object.keys(byCol).forEach(function (ci) {
      var list = byCol[ci], L = list.map(function (c) { return Math.hypot(c[2] - c[0], c[3] - c[1]); }).sort(function (a, b) { return a - b; });
      var width = L[Math.floor(L.length / 2)] || 0;
      if (mode === 'center' || width < 2.0 || list.length < 4) return;
      used[ci] = 1;
      // orient every stitch the same way across the column
      var pts = [], prev = null;
      list.forEach(function (c) {
        var a = [c[0], c[1]], b = [c[2], c[3]];
        var l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < Math.max(1.2, width * 0.7)) return;   // skip short (turning) stitches
        if (prev) {
          var keep = Math.hypot(a[0] - prev[0][0], a[1] - prev[0][1]) + Math.hypot(b[0] - prev[1][0], b[1] - prev[1][1]);
          var swap = Math.hypot(b[0] - prev[0][0], b[1] - prev[0][1]) + Math.hypot(a[0] - prev[1][0], a[1] - prev[1][1]);
          if (swap < keep) { var t = a; a = b; b = t; }
        }
        var ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l, ins = Math.min(0.45, l * 0.2);
        pts.push([[a[0] + ux * ins, a[1] + uy * ins], [b[0] - ux * ins, b[1] - uy * ins]]);
        prev = [a, b];
      });
      if (pts.length < 3) { delete used[ci]; return; }
      // split where the column jumps (a stitch dropped by overlap resolution)
      var runs = [[pts[0]]];
      for (var i = 1; i < pts.length; i++) {
        var q = pts[i - 1], r = pts[i];
        if (Math.hypot(r[0][0] - q[0][0], r[0][1] - q[0][1]) > 2.0 || Math.hypot(r[1][0] - q[1][0], r[1][1] - q[1][1]) > 2.0) runs.push([]);
        runs[runs.length - 1].push(r);
      }
      runs.forEach(function (run) {
        if (run.length < 2) return;
        out.push(run.map(function (p) { return p[0]; }).concat(run.slice().reverse().map(function (p) { return p[1]; })));
        if (mode === 'zigzag' && width >= 3) {
          var zz = [], acc = 0, side = 0;
          for (var j = 0; j < run.length; j++) {
            if (j && (acc += Math.hypot(run[j][0][0] - run[j - 1][0][0], run[j][0][1] - run[j - 1][0][1])) < 1.8) continue;
            acc = 0; zz.push(run[j][side]); side = 1 - side;
          }
          if (zz.length > 2) out.push(zz);
        }
      });
    });
    centres.forEach(function (seg) { if (!used[seg.ci]) out.push(seg); });
    return out;
  }

  function regionFill(mask, opts) {
    var din = edt(mask, false), isl = islands(mask), lab = isl.lab;
    var narrow = newMask(), wides = [];
    var WIDE = (opts.satinMaxMM || 7) / 2 * PX;
    isl.list.forEach(function (I) {
      var deep = 0;
      for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) {
        var i = y * W + x;
        if (lab[i] === I.id && din[i] > WIDE) deep++;
      }
      I.wide = I.area > 600 && deep / I.area > 0.12;
      if (I.wide) wides.push(I);
      else for (var y2 = I.minY; y2 <= I.maxY; y2++) for (var x2 = I.minX; x2 <= I.maxX; x2++) if (lab[y2 * W + x2] === I.id) narrow[y2 * W + x2] = 1;
    });
    var chords = [], under = [], report = [];
    if (countOn(narrow) > 0) {
      var curved = strokeFill(narrow, din, opts.seed || 7, { spacingMM: opts.satinSpacingMM || opts.spacingMM, pullMM: opts.pullCompMM, splitMM: opts.splitMM });
      var guard = guardIslands(narrow, din, curved, opts);
      chords = guard.fill;
      under = satinUnderlay(chords, curved.cols, opts.underlay || 'center');
      report = guard.report.slice();
    }
    var spacing = opts.tatamiSpacingMM || opts.spacingMM || 0.4, umode = opts.underlay || 'center';
    var ulGap = umode === 'none' ? 0 : umode === 'zigzag' ? 1.5 : umode === 'edge' ? 2.2 : 3.0;
    wides.forEach(function (I) {
      var ang = (opts.tatamiAngle !== undefined && opts.tatamiAngle !== null) ? opts.tatamiAngle : principalAngle(lab, I) + Math.PI / 4;
      var inner = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === I.id && din[y * W + x] > 6; };
      var full = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === I.id; };
      // underlay: sparse rows across the top rows, kept 0.6 mm inside the edge
      var ul = ulGap ? tatami(inner, I, ang + Math.PI / 2, ulGap, 3.5, 5) : [];
      var poly = [];
      ul.forEach(function (c) {
        if (poly.length && Math.hypot(poly[poly.length - 1][0] - c[0], poly[poly.length - 1][1] - c[1]) > 3) { under.push(poly); poly = []; }
        if (!poly.length) poly.push([c[0], c[1]]);
        poly.push([c[2], c[3]]);
      });
      if (poly.length > 1) under.push(poly);
      chords = chords.concat(tatami(full, I, ang, spacing, opts.tatamiStitchMM || 3.5, 6));
      report.push({ cx: (I.minX + I.maxX) / 2 / PX, area: I.area / (PX * PX), bare: 0, method: 'tatami', angle: Math.round(ang * 180 / Math.PI), patches: 0 });
    });
    var gaps = 0;
    if (opts.debug) {
      var cov = coverageOf(chords);
      for (var g = 0; g < W * H; g++) if (mask[g] && din[g] > 3.5 && !cov[g]) gaps++;
    }
    return { chords: chords, under: under, report: report, din: din, gaps: gaps };
  }

  // ---------- raster sources (emoji, SVG, bitmaps) -> ordered colour masks ----------
  function kmeans(samples, k, iters) {
    // samples: array of [r,g,b,weight]; k-means++ style seeding by spread
    var cents = [samples[0].slice(0, 3)];
    while (cents.length < k) {
      var best = null, bd = -1;
      samples.forEach(function (s) {
        var d = Infinity;
        cents.forEach(function (c) { d = Math.min(d, colDist(s, c)); });
        d *= Math.sqrt(s[3]);
        if (d > bd) { bd = d; best = s; }
      });
      if (!best || bd < 1) break;
      cents.push(best.slice(0, 3));
    }
    for (var it = 0; it < iters; it++) {
      var acc = cents.map(function () { return [0, 0, 0, 0]; });
      samples.forEach(function (s) {
        var bi = 0, bd2 = Infinity;
        cents.forEach(function (c, ci) { var d = colDist(s, c); if (d < bd2) { bd2 = d; bi = ci; } });
        acc[bi][0] += s[0] * s[3]; acc[bi][1] += s[1] * s[3]; acc[bi][2] += s[2] * s[3]; acc[bi][3] += s[3];
      });
      cents = cents.map(function (c, ci) { return acc[ci][3] ? [acc[ci][0] / acc[ci][3], acc[ci][1] / acc[ci][3], acc[ci][2] / acc[ci][3]] : c; });
    }
    return cents;
  }

  function rasterColours(createCanvas, spec, marginMM) {
    var src = spec.source, sw = src.width, sh = src.height;
    var sizePx = Math.max(5, spec.sizeMM || 60) * PX, sc = sizePx / Math.max(sw, sh);
    var dw = Math.max(1, Math.round(sw * sc)), dh = Math.max(1, Math.round(sh * sc));
    var mpx = Math.ceil(marginMM * PX);
    setMask(Math.ceil((dw + 2 * mpx) / 200) * 200, Math.ceil((dh + 2 * mpx) / 200) * 200);
    var c = createCanvas(W, H), ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var ox = Math.round((W - dw) / 2), oy = Math.round((H - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, ox, oy, dw, dh);
    var d = ctx.getImageData(0, 0, W, H).data;
    // palette
    var pal = (spec.palette || []).map(hexToRgb);
    var anyTransparent = false;
    for (var i = 0; i < W * H; i++) {
      var x = i % W, y = (i / W) | 0;
      if (x >= ox && x < ox + dw && y >= oy && y < oy + dh && d[i * 4 + 3] < 128) { anyTransparent = true; break; }
    }
    if (!pal.length) {
      var bins = {};
      for (var p = 0; p < W * H; p += 2) {
        if (d[p * 4 + 3] < 128) continue;
        var key = (d[p * 4] >> 4) * 256 + (d[p * 4 + 1] >> 4) * 16 + (d[p * 4 + 2] >> 4);
        var b = bins[key] || (bins[key] = [0, 0, 0, 0]);
        b[0] += d[p * 4]; b[1] += d[p * 4 + 1]; b[2] += d[p * 4 + 2]; b[3]++;
      }
      var samples = Object.keys(bins).map(function (k) { var b = bins[k]; return [b[0] / b[3], b[1] / b[3], b[2] / b[3], b[3]]; });
      samples.sort(function (a, b) { return b[3] - a[3]; });
      pal = samples.length ? kmeans(samples.slice(0, 600), Math.max(1, Math.min(10, spec.maxColors || 6)), 8) : [];
      // merge near-duplicates
      var merged = [];
      pal.forEach(function (c2) { if (!merged.some(function (m) { return colDist(m, c2) < 40; })) merged.push(c2); });
      pal = merged;
    }
    // label every pixel with its nearest palette colour (-1 = background)
    var labels = new Int8Array(W * H).fill(-1);
    for (var q = 0; q < W * H; q++) {
      if (d[q * 4 + 3] < 128) continue;
      var px = [d[q * 4], d[q * 4 + 1], d[q * 4 + 2]], bi = 0, bd = Infinity;
      for (var k2 = 0; k2 < pal.length; k2++) { var dd = colDist(px, pal[k2]); if (dd < bd) { bd = dd; bi = k2; } }
      labels[q] = bi;
    }
    // remove the background colour of opaque images (the colour that dominates the border)
    var bgIndex = -1;
    if (!anyTransparent && spec.removeBg !== false && pal.length > 1) {
      var cnt = pal.map(function () { return 0; });
      for (var bx = ox; bx < ox + dw; bx++) { cnt[labels[oy * W + bx]]++; cnt[labels[(oy + dh - 1) * W + bx]]++; }
      for (var by = oy; by < oy + dh; by++) { cnt[labels[by * W + ox]]++; cnt[labels[by * W + ox + dw - 1]]++; }
      bgIndex = cnt.indexOf(Math.max.apply(null, cnt));
      for (var r = 0; r < W * H; r++) if (labels[r] === bgIndex) labels[r] = -1;
    }
    // absorb specks smaller than minArea into their most common neighbour label
    var minArea = Math.round((spec.minAreaMM2 || 0.8) * PX * PX);
    var seen = new Uint8Array(W * H);
    for (var s0 = 0; s0 < W * H; s0++) {
      if (seen[s0] || labels[s0] < 0) continue;
      var L = labels[s0], stack = [s0], comp = [], nb = {};
      seen[s0] = 1;
      while (stack.length) {
        var v = stack.pop(); comp.push(v);
        var vx = v % W;
        [v - 1, v + 1, v - W, v + W].forEach(function (u, ui) {
          if (u < 0 || u >= W * H || (ui === 0 && vx === 0) || (ui === 1 && vx === W - 1)) return;
          if (labels[u] === L) { if (!seen[u]) { seen[u] = 1; stack.push(u); } }
          else nb[labels[u]] = (nb[labels[u]] || 0) + 1;
        });
      }
      if (comp.length < minArea) {
        var to = -1, tc = -1;
        Object.keys(nb).forEach(function (kk) { if (nb[kk] > tc) { tc = nb[kk]; to = +kk; } });
        comp.forEach(function (u) { labels[u] = to; });
      }
    }
    var colours = [];
    pal.forEach(function (c3, idx) {
      if (idx === bgIndex) return;
      var m = newMask(), n = 0;
      for (var z = 0; z < W * H; z++) if (labels[z] === idx) { m[z] = 1; n++; }
      if (n < minArea) return;
      colours.push({ role: 'colour', color: rgbToHex(c3), mask: m, area: n });
    });
    if (!spec.palette) colours.sort(function (a, b) { return b.area - a.area; });
    return { colours: colours, bgRemoved: bgIndex >= 0 ? rgbToHex(pal[bgIndex]) : null };
  }

  // ---------- one layer ----------
  // split a fill part into n stripes across the mask (dir 'h' = stacked top to bottom, 'v' = left to right, 'd' = diagonal).
  // Chords are clipped at the stripe edges (plus a small overlap so the seams never gap); underlay is clipped without overlap.
  function bandSplit(part, m, bd) {
    var n = Math.max(2, Math.min(8, bd.n | 0));
    var a = bd.dir === 'v' ? 0 : bd.dir === 'd' ? Math.PI / 4 : Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a);
    var lo = Infinity, hi = -Infinity, ts = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (m[y * W + x]) { var t = (x + 0.5) * ux + (y + 0.5) * uy; ts.push(t); if (t < lo) lo = t; if (t > hi) hi = t; }
    if (!ts.length) return [part];
    // stripe edges halfway between equal widths and equal amounts of ink, so a swash tail or a tall capital
    // doesn't leave a colour with almost nothing to sew
    var bins = new Float64Array(1024), span = Math.max(1e-6, hi - lo);
    ts.forEach(function (t) { bins[Math.min(1023, Math.floor((t - lo) / span * 1024))]++; });
    var edges = bd.edges ? bd.edges.slice() : [], acc = 0, k = 0;
    for (var e = 1; e < n && !bd.edges; e++) {
      var want = ts.length * e / n;
      while (k < 1024 && acc + bins[k] < want) acc += bins[k++];
      var q = lo + span * (k + (bins[k] ? (want - acc) / bins[k] : 0)) / 1024;
      edges.push((0.5 * (lo + span * e / n) + 0.5 * q) / PX);
    }
    var ov = 0.25, out = [];
    function clipSeg(ax, ay, bx, by, b0, b1) {
      var ta = ax * ux + ay * uy, tb = bx * ux + by * uy, s0 = 0, s1 = 1;
      if (Math.abs(tb - ta) < 1e-9) return (ta >= b0 && ta <= b1) ? [0, 1] : null;
      var k0 = (b0 - ta) / (tb - ta), k1 = (b1 - ta) / (tb - ta);
      s0 = Math.max(0, Math.min(k0, k1)); s1 = Math.min(1, Math.max(k0, k1));
      return s1 > s0 ? [s0, s1] : null;
    }
    for (var i = 0; i < n; i++) {
      var e0 = i ? edges[i - 1] : -Infinity, e1 = i < n - 1 ? edges[i] : Infinity;
      var chords = [], under = [];
      part.chords.forEach(function (c) {
        var r = clipSeg(c[0], c[1], c[2], c[3], e0 - ov, e1 + ov);
        if (!r) return;
        if (r[0] === 0 && r[1] === 1) { chords.push(c); return; }
        var nc = c.slice(), dx = c[2] - c[0], dy = c[3] - c[1];
        nc[0] = c[0] + dx * r[0]; nc[1] = c[1] + dy * r[0]; nc[2] = c[0] + dx * r[1]; nc[3] = c[1] + dy * r[1];
        if (Math.hypot(nc[2] - nc[0], nc[3] - nc[1]) >= 0.15) chords.push(nc);
      });
      (part.under || []).forEach(function (pl) {
        var cur = [];
        for (var k = 1; k < pl.length; k++) {
          var A = pl[k - 1], B = pl[k], r = clipSeg(A[0], A[1], B[0], B[1], e0, e1);
          if (!r) { if (cur.length > 1) under.push(cur); cur = []; continue; }
          var P0 = [A[0] + (B[0] - A[0]) * r[0], A[1] + (B[1] - A[1]) * r[0]], P1 = [A[0] + (B[0] - A[0]) * r[1], A[1] + (B[1] - A[1]) * r[1]];
          if (!cur.length) cur.push(P0);
          cur.push(P1);
          if (r[1] < 1) { if (cur.length > 1) under.push(cur); cur = []; }
        }
        if (cur.length > 1) under.push(cur);
      });
      out.push({ role: 'band', band: i, color: '#0000' + (16 + i).toString(16), kind: 'fill', chords: chords, under: under,
        report: i === 0 ? part.report : undefined, gapsPx: i === 0 ? part.gapsPx : 0, ao: part.ao });
    }
    return out;
  }

  // Dithered gradient between n thread colours. Thread can't mix, so each satin row (or tatami row piece) is given one
  // of the two neighbouring colours, in proportion to its place along the gradient: error diffusion along the sewing
  // order, or an ordered (low-discrepancy) threshold. Rows of one colour are then sewn as a satin at double spacing that
  // the next colour fills in, which is how blended satins are digitised by hand.
  function gradientSplit(part, m, bd) {
    var n = Math.max(2, Math.min(8, bd.n | 0));
    var a = bd.dir === 'v' ? 0 : bd.dir === 'd' ? Math.PI / 4 : Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a);
    var lo = Infinity, hi = -Infinity;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (m[y * W + x]) { var t = (x + 0.5) * ux + (y + 0.5) * uy; if (t < lo) lo = t; if (t > hi) hi = t; }
    if (lo > hi) return [part];
    lo /= PX; hi /= PX;
    var span = Math.max(1e-6, hi - lo), pad = (bd.ends === undefined ? 0.06 : bd.ends);
    function val(t) { return Math.max(0, Math.min(1, ((t - lo) / span - pad) / (1 - 2 * pad))) * (n - 1); }
    var proj = function (x, y) { return x * ux + y * uy; };
    // long chords running along the gradient are cut so each piece can take its own colour
    var pieces = [], PIECE = 2.6, OV = 0.15;
    part.chords.forEach(function (c) {
      var ta = proj(c[0], c[1]), tb = proj(c[2], c[3]), k = Math.max(1, Math.ceil(Math.abs(tb - ta) / PIECE));
      var len = Math.hypot(c[2] - c[0], c[3] - c[1]);
      for (var j = 0; j < k; j++) {
        var s0 = j / k, s1 = (j + 1) / k;
        if (k > 1 && len > 0) { var o = OV / len; if (j) s0 -= o; if (j < k - 1) s1 += o; }
        var nc = c.slice(), dx = c[2] - c[0], dy = c[3] - c[1];
        nc[0] = c[0] + dx * s0; nc[1] = c[1] + dy * s0; nc[2] = c[0] + dx * s1; nc[3] = c[1] + dy * s1;
        pieces.push(nc);
      }
    });
    var groups = []; for (var g = 0; g < n; g++) groups.push([]);
    var err = 0, last = null, row = 0, PHI = 0.6180339887;
    pieces.forEach(function (c) {
      var v = val(proj((c[0] + c[2]) / 2, (c[1] + c[3]) / 2)), base = Math.min(n - 2, Math.floor(v)), f = v - base, pick;
      if (last && Math.hypot(c[0] - last[0], c[1] - last[1]) > 1.6 && Math.hypot(c[2] - last[0], c[3] - last[1]) > 1.6) err = 0;
      if (bd.dither === 'ordered') { row++; pick = f > ((row * PHI) % 1) ? 1 : 0; }
      else { pick = f + err >= 0.5 ? 1 : 0; err = f + err - pick; }
      groups[base + pick].push(c);
      last = [c[2], c[3]];
    });
    // within one colour, flip pieces so each starts where the previous ended (blended satin, no jumps)
    groups.forEach(function (list) {
      for (var i = 1; i < list.length; i++) {
        var p = list[i - 1], c = list[i];
        if (Math.hypot(c[2] - p[2], c[3] - p[3]) < Math.hypot(c[0] - p[2], c[1] - p[3])) {
          var f = c.slice(); f[0] = c[2]; f[1] = c[3]; f[2] = c[0]; f[3] = c[1]; list[i] = f;
        }
      }
    });
    // underlay goes under the colour that covers that stretch most
    var edges = []; for (var e = 1; e < n; e++) edges.push(lo + span * (pad + (1 - 2 * pad) * (e - 0.5) / (n - 1)));
    var cut = bandSplit({ chords: [], under: part.under }, m, { n: n, dir: bd.dir, edges: edges });
    return groups.map(function (list, i) {
      return { role: 'band', band: i, color: '#0000' + (16 + i).toString(16), kind: 'fill', chords: list, under: cut[i] ? cut[i].under : [],
        report: i === 0 ? part.report : undefined, gapsPx: i === 0 ? part.gapsPx : 0, ao: part.ao };
    });
  }

  // spec.kind: 'text' | 'raster' (emoji, SVG and bitmaps are pre-loaded drawables)
  // returns parts in sewing order, in mm, centred, y up
  function renderLayer(createCanvas, spec) {
    var t0 = Date.now();
    spec = spec || {};
    var cc = pooled(createCanvas);
    var fx = spec.effects || {};
    var s1 = fx.stroke && fx.stroke.on ? Math.max(0.6, fx.stroke.width || 1.5) : 0;
    var s2 = s1 && fx.stroke2 && fx.stroke2.on ? Math.max(0.6, fx.stroke2.width || 1.5) : 0;
    var shd = fx.shadow && fx.shadow.on ? fx.shadow : null;
    var shDX = shd ? (shd.dx === undefined ? 1.2 : shd.dx) : 0, shDY = shd ? (shd.dy === undefined ? -1.2 : shd.dy) : 0;
    var marginMM = s1 + s2 + Math.max(Math.abs(shDX), Math.abs(shDY)) + 4;
    var colours = [], meta = {};

    if (spec.kind === 'text') {
      var extra = 2 * (s1 + s2) + Math.abs(shDX);
      var target = spec.width ? Math.max(20, Math.min(190, spec.width)) : 0;
      var wordMM = target ? Math.max(10, target - extra) / 1.10 : 92;
      var mPx = Math.ceil(marginMM * PX);
      var maskAt = function (wmm) {
        setMask(Math.ceil(((wmm * 1.45 + 24) * PX + 2 * mPx) / 200) * 200, Math.ceil(((wmm * 0.95 + 26) * PX + 2 * mPx) / 200) * 200);
        return drawMask(cc, spec.family || 'sans-serif', spec.text || 'Text', spec.tail !== false, wmm, spec.weight, spec.tilt);
      };
      var widthOf = function (m) {
        var x0 = W, x1 = -1;
        for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (m[yy * W + xx]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
        return x1 < 0 ? 0 : (x1 - x0 + 1) / PX + extra;
      };
      var mask = maskAt(wordMM);
      if (target) {
        for (var pass = 0; pass < 3; pass++) {
          var got = widthOf(mask);
          if (!got || Math.abs(got - target) < 0.6) break;
          wordMM *= target / got;
          mask = maskAt(wordMM);
        }
      }
      colours.push({ role: 'fill', color: (spec.colors && spec.colors.fill) || '#b3202f', mask: mask });
    } else {
      var rc = rasterColours(cc, spec, marginMM);
      colours = rc.colours;
      meta.bgRemoved = rc.bgRemoved;
      if (spec.recolor) colours.forEach(function (c4, i4) { if (spec.recolor[i4]) c4.color = spec.recolor[i4]; });
    }

    var S = unionMasks(colours.map(function (c5) { return c5.mask; }));
    // each colour reaches 0.4 mm under the colours sewn after it, so they don't gap apart
    for (var ci = 0; ci < colours.length - 1; ci++) {
      var later = unionMasks(colours.slice(ci + 1).map(function (c6) { return c6.mask; }));
      var grown = dilateMask(colours[ci].mask, 0.4 * PX);
      var ext = new Uint8Array(colours[ci].mask);
      for (var e = 0; e < W * H; e++) if (grown[e] && later[e]) ext[e] = 1;
      colours[ci].ext = ext;
    }
    var S1 = s1 ? dilateMask(S, s1 * PX) : S;
    var S2 = s2 ? dilateMask(S1, s2 * PX) : S1;
    var dinS = edt(S, false);
    var parts = [], fillOpts = { fillMode: spec.fillMode || 'patch', spacingMM: spec.spacingMM, satinMaxMM: spec.satinMaxMM, debug: spec.debug, seed: 7,
      satinSpacingMM: spec.satinSpacingMM, tatamiSpacingMM: spec.tatamiSpacingMM, tatamiStitchMM: spec.tatamiStitchMM, pullCompMM: spec.pullCompMM,
      splitMM: spec.splitMM, underlay: spec.underlay, tatamiAngle: spec.tatamiAngleDeg === undefined || spec.tatamiAngleDeg === null ? undefined : spec.tatamiAngleDeg * Math.PI / 180 };

    function fillPart(role, color, m, aoFn) {
      var rf = regionFill(m, fillOpts);
      parts.push({ role: role, color: color, kind: 'fill', chords: rf.chords, under: rf.under, report: rf.report, gapsPx: rf.gaps, ao: aoFn });
    }
    function outlinePart(role, color, m, width) {
      var ol = outlineSatin(m, 0.35 + (spec.pullCompMM || 0) / 4, Math.max(0.4, width - 0.35), Math.max(0.12, (spec.satinSpacingMM || 0.4) / 2), edt(m, true));
      parts.push({ role: role, color: color, kind: 'outline', chords: ol.chords, loops: ol.sewLoops, ao: function () { return 1; } });
    }
    var shadowMask = null;
    if (shd) {
      shadowMask = shiftMask(S2, shDX * PX, -shDY * PX);
      var keep = erodeMask(S2, 0.5 * PX);
      for (var z2 = 0; z2 < W * H; z2++) if (keep[z2]) shadowMask[z2] = 0;
      if (countOn(shadowMask) > 20) fillPart('shadow', shd.color || '#3a3a3a', shadowMask, function () { return 0.9; });
      else shadowMask = null;
    }
    if (s2) outlinePart('stroke2', fx.stroke2.color || '#ffffff', S1, s2);
    colours.forEach(function (c7) {
      fillPart(c7.role, c7.color, c7.ext || c7.mask, function (mx, my) {
        var dmm = sampleD(dinS, mx * PX, my * PX) / PX;
        return s1 ? 0.72 + 0.28 * Math.min(1, Math.max(0, (dmm - 0.3) / 1.6)) : 0.86 + 0.14 * Math.min(1, dmm / 1.2);
      });
    });
    // flag stripes: cut the text fill into bands; each band is its own thread, overlapping its neighbours slightly
    if (spec.kind === 'text' && spec.bands && spec.bands.n > 1) {
      var fi = -1;
      parts.forEach(function (p8, i8) { if (p8.role === 'fill') fi = i8; });
      if (fi >= 0) Array.prototype.splice.apply(parts, [fi, 1].concat(spec.bands.mode === 'gradient'
        ? gradientSplit(parts[fi], colours[0].mask, spec.bands) : bandSplit(parts[fi], colours[0].mask, spec.bands)));
    }
    if (s1) outlinePart('stroke', fx.stroke.color || '#16233f', S, s1);

    // bounds -> centre, flip y, mm
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    parts.forEach(function (p) { p.chords.forEach(function (c) {
      if (c[0] < minX) minX = c[0]; if (c[2] < minX) minX = c[2]; if (c[0] > maxX) maxX = c[0]; if (c[2] > maxX) maxX = c[2];
      if (c[1] < minY) minY = c[1]; if (c[3] < minY) minY = c[3]; if (c[1] > maxY) maxY = c[1]; if (c[3] > maxY) maxY = c[3];
    }); });
    if (minX > maxX) { minX = maxX = minY = maxY = 0; }
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var T = function (p) { return [p[0] - cx, cy - p[1]]; };
    var out = parts.map(function (p, pi) {
      var o = { role: p.role, color: p.color, kind: p.kind, index: pi };
      if (p.band !== undefined) o.band = p.band;
      o.chords = p.chords.map(function (c) {
        var mxm = (c[0] + c[2]) / 2, mym = (c[1] + c[3]) / 2;
        return [c[0] - cx, cy - c[1], c[2] - cx, cy - c[3], c[4] || 0, c[5] === undefined ? -1 : c[5], p.ao(mxm, mym)];
      });
      if (p.under) o.under = p.under.map(function (pl) { return pl.map(T); });
      if (p.loops) o.loops = p.loops.map(function (l) { return { pen: l.pen.map(T), under: l.under.map(T) }; });
      if (p.report) o.report = p.report;
      if (p.gapsPx !== undefined) o.gapsMM2 = p.gapsPx / (PX * PX);
      o.thread = nearestThread(p.color);
      return o;
    });
    // travel grid: where later stitches will cover a running stitch (0.4 mm cells)
    var cover = shadowMask ? unionMasks([S2, shadowMask]) : S2;
    var dc = edt(cover, false), res = 0.4, gw = Math.ceil(W / PX / res), gh = Math.ceil(H / PX / res);
    var grid = new Uint8Array(gw * gh);
    for (var gj = 0; gj < gh; gj++) for (var gi = 0; gi < gw; gi++) {
      var gx = Math.round((gi + 0.5) * res * PX), gy = Math.round((gj + 0.5) * res * PX);
      grid[gj * gw + gi] = (gx < W && gy < H && dc[gy * W + gx] > 1.5) ? 1 : 0;
    }
    var stitchCount = out.reduce(function (a, p) { return a + p.chords.length; }, 0);
    return {
      parts: out,
      size: { w: maxX - minX, h: maxY - minY },
      inside: { res: res, x0: -cx, y1: cy, w: gw, h: gh, data: grid },
      stitchCount: stitchCount,
      meta: meta,
      ms: Date.now() - t0
    };
  }
