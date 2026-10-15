// Stitch generator: script text + swash tail -> satin chords (mm units).
// Pure JS, shared by the browser page and the offline test harness.
var StitchEngine = (function () {
  var PX = 10; // mask pixels per millimetre
  var W = 1400, H = 900; // mask size: 140 x 90 mm

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function bez(p0, p1, p2, p3, t) {
    var a = 1 - t;
    return [
      a * a * a * p0[0] + 3 * a * a * t * p1[0] + 3 * a * t * t * p2[0] + t * t * t * p3[0],
      a * a * a * p0[1] + 3 * a * a * t * p1[1] + 3 * a * t * t * p2[1] + t * t * t * p3[1]
    ];
  }

  // ---------- swash tails ("swoops") ----------
  // Each style is a chain of cubic segments in the word's local frame (x right, y down, baseline at `base`),
  // plus a width profile along it. E/u: where and which way the last letter's exit stroke leaves; F/v: the
  // first letter's foot and the way its entry stroke points; xL: the word's left edge; yT: the swoop's line.
  var TAIL_STYLES = ['classic', 'sweep', 'flick', 'bar', 'lead', 'twin'];
  function sampleSegs(segs) {
    var pts = [];
    for (var s = 0; s < segs.length; s++) {
      var g = segs[s];
      for (var i = (s ? 1 : 0); i <= 300; i++) pts.push(bez(g[0], g[1], g[2], g[3], i / 300));
    }
    var len = [0];
    for (var k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    var total = len[len.length - 1] || 1;
    return pts.map(function (p, k) { return [p[0], p[1], len[k] / total]; });
  }
  // thin where it leaves the letter, swelling, then a long taper to a point
  function swellWidth(t, em, peak) {
    var w0 = 0.04 * em, wMax = 0.085 * em;
    if (t < peak) return w0 + (wMax - w0) * Math.sin((t / peak) * Math.PI / 2);
    var r = (t - peak) / (1 - peak);
    return wMax * Math.pow(1 - r, 1.15) + 0.6;
  }
  function tailPaths(style, pr, yT, em) {
    var E = pr.E, u = pr.u, xL = pr.xL, F = pr.F, v = pr.v;
    var span = Math.max(E[0] - xL, 0.6 * em);
    var P0 = [E[0] - u[0] * 3, E[1] - u[1] * 3]; // start just inside the exit stroke's last ink
    var P1 = [E[0] + u[0] * 0.23 * em, E[1] + u[1] * 0.23 * em];
    // the hook off the last letter: out along its exit stroke, round, and back under the word
    var hook = [P0, P1, [E[0] + 0.32 * em, yT], [E[0] - 0.02 * em, yT]];
    var paths = [];
    if (style === 'sweep') {
      // long spear that runs out past the first letter
      paths.push({ segs: [hook, [hook[3], [E[0] - 0.2 * span, yT], [xL + 0.14 * span, yT - 0.03 * em], [xL - 0.10 * em, yT + 0.04 * em]]], w: function (t) { return swellWidth(t, em, 0.32); } });
    } else if (style === 'flick') {
      // back under the word, then curls up in front of the first letter
      var fx = Math.min(F[0], xL + 0.08 * em);
      paths.push({ segs: [hook, [hook[3], [E[0] - 0.3 * span, yT], [fx + 0.35 * em, yT + 0.01 * em], [fx + 0.05 * em, yT]],
        [[fx + 0.05 * em, yT], [fx - 0.17 * em, yT - 0.005 * em], [fx - 0.23 * em, yT - 0.14 * em], [fx - 0.13 * em, yT - 0.25 * em]]],
        w: function (t) {
          var wMax = 0.085 * em, w0 = 0.04 * em;
          if (t < 0.3) return w0 + (wMax - w0) * Math.sin(t / 0.3 * Math.PI / 2);
          if (t < 0.78) return wMax * (1 - 0.4 * (t - 0.3) / 0.48);
          return wMax * 0.6 * Math.pow(1 - (t - 0.78) / 0.22, 0.9) + 0.6;
        } });
    } else if (style === 'bar') {
      // short hook, then a straight bar of even weight under the whole word
      var bh = [P0, [E[0] + u[0] * 0.15 * em, E[1] + u[1] * 0.15 * em], [E[0] + 0.16 * em, yT], [E[0] - 0.06 * em, yT]];
      var xe = xL + 0.02 * em;
      paths.push({ segs: [bh, [bh[3], [bh[3][0] - (bh[3][0] - xe) / 3, yT], [xe + (bh[3][0] - xe) / 3, yT], [xe, yT]]],
        w: function (t) { var w = 0.07 * em; return t < 0.12 ? 0.04 * em + (w - 0.04 * em) * t / 0.12 : t > 0.95 ? w * (1 - (t - 0.95) / 0.05 * 0.7) : w; } });
    } else if (style === 'lead') {
      // starts from the first letter's foot, dips under it and sweeps right, rising out past the last letter
      var Q0 = [F[0] - v[0] * 3, F[1] - v[1] * 3];
      var lh = [Q0, [F[0] + v[0] * 0.1 * em, F[1] + v[1] * 0.1 * em], [F[0] - 0.12 * em, yT + 0.01 * em], [F[0] + 0.1 * em, yT]];
      paths.push({ segs: [lh, [lh[3], [F[0] + 0.45 * span, yT + 0.01 * em], [E[0] - 0.05 * em, yT], [E[0] + 0.24 * em, yT - 0.10 * em]]], w: function (t) { return swellWidth(t, em, 0.28); } });
    } else {
      // classic (and twin): back under the word, ending in a fine point tucked under the first letter
      var xe2 = Math.max(xL + 0.08 * em, Math.min(F[0] + 0.04 * em, xL + 0.3 * em));
      var main = [hook, [hook[3], [E[0] - 0.25 * span, yT + 0.005 * em], [xe2 + 0.3 * em, yT + 0.005 * em], [xe2, yT - 0.02 * em]]];
      paths.push({ segs: main, w: function (t) { return swellWidth(t, em, 0.32); } });
      if (style === 'twin') {
        // a fine pinstripe echoing the swoop below it, over its flat run only
        var d = 0.13 * em;
        paths.push({ segs: [[[E[0] - 0.02 * em, yT + d], [E[0] - 0.25 * span, yT + d + 0.005 * em], [xe2 + 0.3 * em, yT + d + 0.005 * em], [xe2 + 0.12 * em, yT + d - 0.02 * em]]],
          w: function (t) { var w = 0.026 * em; return t < 0.1 ? w * (0.3 + 0.7 * t / 0.1) : t > 0.8 ? w * (1 - (t - 0.8) / 0.2) + 0.6 : w; } });
      }
    }
    return paths.map(function (pth) { return { pts: sampleSegs(pth.segs), w: pth.w }; });
  }

  // Find where the last letter's exit stroke ends: rightmost ink in a band near the baseline,
  // plus the stroke's direction there and the word's left edge and lowest ink.
  function probeWord(createCanvas, wt, family, text, size, tw, base) {
    var c = createCanvas(W, H), ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = wt + size + 'px ' + family;
    var ox = W / 2, oy = H * 0.44;
    ctx.fillText(text, ox - tw / 2, oy + base);
    var d = ctx.getImageData(0, 0, W, H).data;
    var xL = Infinity, bottom = -Infinity, ex = -Infinity, eys = [];
    var y0 = base - 0.35 * size, y1 = base + 0.04 * size;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (d[(y * W + x) * 4] < 128) continue;
      var lx = x - ox, ly = y - oy;
      if (lx < xL) xL = lx;
      if (ly > bottom) bottom = ly;
      if (ly >= y0 && ly <= y1 && lx >= ex - 2) {
        if (lx > ex) ex = lx;
        eys.push([lx, ly]);
      }
    }
    if (!isFinite(ex)) return { E: [tw / 2, base - 0.1 * size], u: [0.95, -0.3], xL: -tw / 2, bottom: base, F: [-tw / 2, base - 0.1 * size], v: [-0.95, 0.3] };
    // several features can reach the same right edge (a k's arm and leg); averaging them
    // lands in the gap between, so take the lowest real ink pixel at the edge
    var ey = -Infinity;
    eys.forEach(function (p) { if (p[0] >= ex - 2 && p[1] > ey) ey = p[1]; });
    function centroid(xa, xb) {
      var sx = 0, sy = 0, n = 0;
      for (var y = Math.floor(oy + y0); y <= Math.ceil(oy + y1); y++) for (var x = Math.floor(ox + xa); x <= Math.ceil(ox + xb); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H || d[(y * W + x) * 4] < 128) continue;
        sx += x - ox; sy += y - oy; n++;
      }
      return n ? [sx / n, sy / n] : null;
    }
    var A = centroid(ex - 0.05 * size, ex), B = centroid(ex - 0.13 * size, ex - 0.06 * size);
    var u = [0.95, -0.3];
    if (A && B) {
      var ux = A[0] - B[0], uy = A[1] - B[1], ul = Math.hypot(ux, uy);
      if (ul > 1) { u = [ux / ul, uy / ul]; }
    }
    if (u[0] < 0.35) { u = [u[0] + 0.6, u[1]]; var l2 = Math.hypot(u[0], u[1]); u = [u[0] / l2, u[1] / l2]; }
    // the first letter's foot: leftmost ink in the same band, and the way its stroke points there
    var fxm = Infinity, fy = -Infinity;
    eys.length = 0;
    for (var y5 = Math.floor(oy + y0); y5 <= Math.ceil(oy + y1); y5++) for (var x5 = 0; x5 < W; x5++) {
      if (d[(y5 * W + x5) * 4] < 128) continue;
      if (x5 - ox < fxm) fxm = x5 - ox;
      break;
    }
    for (var y6 = Math.floor(oy + y0); y6 <= Math.ceil(oy + y1); y6++) {
      var x6 = Math.round(ox + fxm);
      for (var k6 = 0; k6 <= 2; k6++) if (d[(y6 * W + x6 + k6) * 4] >= 128 && y6 - oy > fy) fy = y6 - oy;
    }
    if (!isFinite(fy)) fy = base - 0.1 * size;
    var FA = centroid(fxm, fxm + 0.05 * size), FB = centroid(fxm + 0.06 * size, fxm + 0.13 * size), v = [-0.95, 0.3];
    if (FA && FB) { var vx = FA[0] - FB[0], vy = FA[1] - FB[1], vl = Math.hypot(vx, vy); if (vl > 1) v = [vx / vl, vy / vl]; }
    if (v[0] > -0.35) { v = [v[0] - 0.6, v[1]]; var l3 = Math.hypot(v[0], v[1]); v = [v[0] / l3, v[1] / l3]; }
    return { E: [ex, ey], u: u, xL: xL, bottom: bottom, F: [fxm, fy], v: v };
  }

  function drawMask(createCanvas, family, text, tailStyle, wordMM, weight, tiltDeg, tailWeight) {
    if (tailStyle === true) tailStyle = 'classic';
    var withTail = !!tailStyle && tailStyle !== 'none';
    var c = createCanvas(W, H);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    var wt = weight ? weight + ' ' : '';
    ctx.font = wt + '100px ' + family;
    // fit the word to 92 mm wide, but cap the letter size for short words
    // fit the word to wordMM wide; cap letter size for short words (scaled with the target)
    var size = Math.min(100 * (wordMM * PX) / ctx.measureText(text).width, 452 * wordMM / 92);
    ctx.font = wt + size + 'px ' + family;
    var tw = ctx.measureText(text).width, base = size * 0.12;
    ctx.save();
    ctx.translate(W / 2, H * 0.44);
    ctx.rotate(-(tiltDeg === undefined ? 7 : tiltDeg) * Math.PI / 180);
    ctx.fillText(text, -tw / 2, base);
    var tail = null;
    if (withTail) {
      var pr = probeWord(createCanvas, (weight ? weight + ' ' : '') + '', family, text, size, tw, base);
      var yTail = Math.max(base + 0.15 * size, pr.bottom + 0.15 * size);
      var tk = tailWeight || 1;
      if (tailStyle === 'twin') yTail += 0.02 * size;
      tailPaths(TAIL_STYLES.indexOf(tailStyle) >= 0 ? tailStyle : 'classic', pr, yTail, size).forEach(function (pth) {
        for (var i = 0; i < pth.pts.length; i++) {
          var p = pth.pts[i], r = Math.max(0.6, pth.w(p[2]) * tk) / 2;
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
        }
      });
      tail = { exit: pr.E, dir: pr.u };
    }
    ctx.restore();
    var d = ctx.getImageData(0, 0, W, H).data;
    var m = new Uint8Array(W * H);
    for (var j = 0; j < W * H; j++) m[j] = d[j * 4] > 127 ? 1 : 0;
    return m;
  }

  // Exact Euclidean distance transform (Felzenszwalb), distance to nearest 0 pixel.
  function edt(mask, invert) {
    var INF = 1e20, n = Math.max(W, H);
    var f = new Float64Array(n), dd = new Float64Array(n), z = new Float64Array(n + 1);
    var v = new Int32Array(n), grid = new Float64Array(W * H);
    for (var i = 0; i < W * H; i++) grid[i] = (invert ? !mask[i] : mask[i]) ? INF : 0;
    function pass(len) {
      var k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (var q = 1; q < len; q++) {
        var s;
        do {
          var r = v[k];
          s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r);
        } while (s <= z[k] && --k >= 0);
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (var q2 = 0; q2 < len; q2++) {
        while (z[k + 1] < q2) k++;
        var r2 = v[k]; dd[q2] = (q2 - r2) * (q2 - r2) + f[r2];
      }
    }
    for (var x = 0; x < W; x++) {
      for (var y = 0; y < H; y++) f[y] = grid[y * W + x];
      pass(H);
      for (var y2 = 0; y2 < H; y2++) grid[y2 * W + x] = dd[y2];
    }
    for (var yy = 0; yy < H; yy++) {
      for (var xx = 0; xx < W; xx++) f[xx] = grid[yy * W + xx];
      pass(W);
      for (var x2 = 0; x2 < W; x2++) grid[yy * W + x2] = Math.sqrt(dd[x2]);
    }
    return grid;
  }

  function blur(src, radius, passes) {
    var a = Float32Array.from(src), b = new Float32Array(W * H);
    for (var p = 0; p < passes; p++) {
      for (var y = 0; y < H; y++) {
        var acc = 0, row = y * W;
        for (var x = -radius; x <= radius; x++) acc += a[row + Math.min(W - 1, Math.max(0, x))];
        for (var x1 = 0; x1 < W; x1++) {
          b[row + x1] = acc / (2 * radius + 1);
          acc += a[row + Math.min(W - 1, x1 + radius + 1)] - a[row + Math.max(0, x1 - radius)];
        }
      }
      for (var x3 = 0; x3 < W; x3++) {
        var acc2 = 0;
        for (var y3 = -radius; y3 <= radius; y3++) acc2 += b[Math.min(H - 1, Math.max(0, y3)) * W + x3];
        for (var y4 = 0; y4 < H; y4++) {
          a[y4 * W + x3] = acc2 / (2 * radius + 1);
          acc2 += b[Math.min(H - 1, y4 + radius + 1) * W + x3] - b[Math.max(0, y4 - radius) * W + x3];
        }
      }
    }
    return a;
  }

  // Satin chords: from evenly spaced boundary points, march along the smoothed
  // inward normal until leaving the region. Both edges contribute, so chords interleave.
  function satin(region, spacingMM, maxMM, seed) {
    var rand = rng(seed);
    var soft = blur(region, 4, 2);
    var cand = [];
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var i = y * W + x;
        if (region[i] && (!region[i - 1] || !region[i + 1] || !region[i - W] || !region[i + W])) cand.push(i);
      }
    }
    for (var c = cand.length - 1; c > 0; c--) {
      var j = Math.floor(rand() * (c + 1)), t = cand[c]; cand[c] = cand[j]; cand[j] = t;
    }
    var sp = spacingMM * PX, cell = sp, gw = Math.ceil(W / cell) + 1;
    var hash = new Map(), out = [];
    function near(px, py) {
      var gx = Math.floor(px / cell), gy = Math.floor(py / cell);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var lst = hash.get((gy + oy) * gw + gx + ox);
        if (!lst) continue;
        for (var q = 0; q < lst.length; q += 2) {
          if ((lst[q] - px) * (lst[q] - px) + (lst[q + 1] - py) * (lst[q + 1] - py) < sp * sp) return true;
        }
      }
      return false;
    }
    var maxPx = maxMM * PX;
    for (var k = 0; k < cand.length; k++) {
      var idx = cand[k], cx = idx % W, cy = (idx / W) | 0;
      if (near(cx, cy)) continue;
      var key = Math.floor(cy / cell) * gw + Math.floor(cx / cell);
      if (!hash.has(key)) hash.set(key, []);
      hash.get(key).push(cx, cy);
      var gx = soft[idx + 1] - soft[idx - 1], gy = soft[idx + W] - soft[idx - W];
      var gl = Math.hypot(gx, gy);
      if (gl < 1e-4) continue;
      gx /= gl; gy /= gl;
      var tt = 0.5, ex, ey;
      for (;;) {
        ex = cx + gx * tt; ey = cy + gy * tt;
        var ix = Math.round(ex), iy = Math.round(ey);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H || !region[iy * W + ix] || tt > 400) break;
        tt += 0.5;
      }
      if (tt < 4) continue; // under 0.4 mm: too small to satin
      var n = Math.max(1, Math.ceil(tt / maxPx));
      var stag = (rand() - 0.5) * 0.45; // split satin: staggered cut points
      for (var s = 0; s < n; s++) {
        var t0 = s === 0 ? 0 : Math.min(0.95, Math.max(0.05, (s + stag) / n));
        var t1 = s === n - 1 ? 1 : Math.min(0.95, Math.max(0.05, (s + 1 + stag) / n));
        out.push([
          (cx + gx * tt * t0) / PX, (cy + gy * tt * t0) / PX,
          (cx + gx * tt * t1) / PX, (cy + gy * tt * t1) / PX
        ]);
      }
    }
    return out;
  }

  // Greedy nearest-neighbour sewing order, flipping chords so each starts near the last end.
  function order(chords) {
    var n = chords.length, used = new Uint8Array(n), res = [];
    var cell = 4, map = new Map();
    function key(x, y) { return Math.floor(y / cell) * 10000 + Math.floor(x / cell); }
    for (var i = 0; i < n; i++) {
      var c = chords[i], k = key((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    }
    var cur = 0, px = chords[0][0], py = chords[0][1];
    for (var step = 0; step < n; step++) {
      var best = -1, bd = Infinity;
      var gx = Math.floor(px / cell), gy = Math.floor(py / cell);
      for (var r = 0; r < 40 && best < 0; r++) {
        for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          var lst = map.get((gy + oy) * 10000 + gx + ox);
          if (!lst) continue;
          for (var q = 0; q < lst.length; q++) {
            var id = lst[q];
            if (used[id]) continue;
            var cc = chords[id];
            var d = Math.min((cc[0] - px) ** 2 + (cc[1] - py) ** 2, (cc[2] - px) ** 2 + (cc[3] - py) ** 2);
            if (d < bd) { bd = d; best = id; }
          }
        }
      }
      if (best < 0) {
        for (var z = 0; z < n; z++) if (!used[z]) { best = z; break; }
      }
      used[best] = 1;
      var b = chords[best];
      if ((b[2] - px) ** 2 + (b[3] - py) ** 2 < (b[0] - px) ** 2 + (b[1] - py) ** 2) b = [b[2], b[3], b[0], b[1], b[4]];
      res.push(b); px = b[2]; py = b[3]; cur = best;
    }
    return res;
  }

  // Marching squares: closed contour loops of the mask, in pixel coordinates.
  function traceLoops(mask) {
    // edge midpoints, keyed on a doubled grid: (2x+1, 2y) = top edge of cell (x,y), etc.
    var segs = [];
    var T = function (x, y) { return [2 * x + 1, 2 * y]; };
    var Rr = function (x, y) { return [2 * x + 2, 2 * y + 1]; };
    var Bo = function (x, y) { return [2 * x + 1, 2 * y + 2]; };
    var Le = function (x, y) { return [2 * x, 2 * y + 1]; };
    for (var y = 0; y < H - 1; y++) {
      for (var x = 0; x < W - 1; x++) {
        var i = y * W + x;
        var code = mask[i] * 8 + mask[i + 1] * 4 + mask[i + W + 1] * 2 + mask[i + W];
        if (code === 0 || code === 15) continue;
        switch (code) {
          case 1: case 14: segs.push([Le(x, y), Bo(x, y)]); break;
          case 2: case 13: segs.push([Bo(x, y), Rr(x, y)]); break;
          case 3: case 12: segs.push([Le(x, y), Rr(x, y)]); break;
          case 4: case 11: segs.push([T(x, y), Rr(x, y)]); break;
          case 6: case 9: segs.push([T(x, y), Bo(x, y)]); break;
          case 7: case 8: segs.push([Le(x, y), T(x, y)]); break;
          case 5: segs.push([Le(x, y), T(x, y)]); segs.push([Bo(x, y), Rr(x, y)]); break;
          case 10: segs.push([Le(x, y), Bo(x, y)]); segs.push([T(x, y), Rr(x, y)]); break;
        }
      }
    }
    var key = function (p) { return p[0] * 4096 + p[1]; };
    var at = new Map();
    segs.forEach(function (s, k) {
      [key(s[0]), key(s[1])].forEach(function (kk) {
        if (!at.has(kk)) at.set(kk, []);
        at.get(kk).push(k);
      });
    });
    var used = new Uint8Array(segs.length), loops = [];
    for (var s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      var loop = [segs[s0][0]], cur = segs[s0][1], startKey = key(segs[s0][0]);
      for (var guard = 0; guard < segs.length; guard++) {
        loop.push(cur);
        var ck = key(cur);
        if (ck === startKey) break;
        var nxt = -1, lst = at.get(ck) || [];
        for (var q = 0; q < lst.length; q++) if (!used[lst[q]]) { nxt = lst[q]; break; }
        if (nxt < 0) break;
        used[nxt] = 1;
        var sg = segs[nxt];
        cur = key(sg[0]) === ck ? sg[1] : sg[0];
      }
      if (loop.length > 40) loops.push(loop.map(function (p) { return [p[0] / 2, p[1] / 2]; }));
    }
    return loops;
  }

  function smoothLoop(pts, win, passes) {
    var n = pts.length, a = pts;
    for (var p = 0; p < passes; p++) {
      var b = [];
      for (var i = 0; i < n; i++) {
        var sx = 0, sy = 0;
        for (var k = -win; k <= win; k++) { var q = a[(i + k + n) % n]; sx += q[0]; sy += q[1]; }
        b.push([sx / (2 * win + 1), sy / (2 * win + 1)]);
      }
      a = b;
    }
    return a;
  }

  function resampleLoop(pts, step) {
    var out = [], n = pts.length, carry = 0;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      var t = carry;
      while (t < len) { out.push([a[0] + dx * t / len, a[1] + dy * t / len]); t += step; }
      carry = t - len;
    }
    return out;
  }

  // Continuous zigzag satin along every contour loop: needle alternates between a point
  // `inMM` inside the edge and a point `outMM` outside it, so each loop is one unbroken path.
  function outlineSatin(mask, inMM, outMM, stepMM, dout) {
    var loops = traceLoops(mask), result = [];
    var step = stepMM * PX;
    loops.forEach(function (raw) {
      var pts = resampleLoop(smoothLoop(raw, 5, 3), step);
      var n = pts.length;
      if (n < 8) return;
      var nr = [];
      for (var i = 0; i < n; i++) {
        var a = pts[(i - 2 + n) % n], b = pts[(i + 2) % n];
        var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
        nr.push([-ty / tl, tx / tl]);
      }
      // orient normals outward for the whole loop by majority vote
      var votes = 0;
      for (var j = 0; j < n; j++) {
        var sx = Math.round(pts[j][0] + nr[j][0] * 1.5), sy = Math.round(pts[j][1] + nr[j][1] * 1.5);
        votes += (sx >= 0 && sy >= 0 && sx < W && sy < H && mask[sy * W + sx]) ? -1 : 1;
      }
      var sign = votes >= 0 ? 1 : -1;
      // smooth normals so the outer ends fan evenly on tight curves
      var ns = [];
      for (var k = 0; k < n; k++) {
        var ax = 0, ay = 0;
        for (var m = -6; m <= 6; m++) { var v = nr[(k + m + n) % n]; ax += v[0]; ay += v[1]; }
        var l = Math.hypot(ax, ay) || 1;
        ns.push([sign * ax / l, sign * ay / l]);
      }
      var pen = [];
      var count = n % 2 ? n - 1 : n; // even count so the zigzag closes cleanly
      for (var z = 0; z <= count; z++) {
        var idx = z % count, p = pts[idx], nn = ns[idx];
        var d;
        if (z % 2 === 0) d = -inMM * PX;
        else {
          // walk outward; stop early where the outside distance stops growing (a notch's
          // midline), so rays from the two sides of a notch don't cross into a starburst
          // walking straight out, distance-from-letter grows about as fast as the walk;
          // past a notch's midline it falls behind, which is where we stop
          for (d = 0.5; d < outMM * PX; d += 0.5) {
            var dv = sampleBil(dout, p[0] + nn[0] * d, p[1] + nn[1] * d);
            if (d > 4 && dv < 0.6 * d) break;
          }
        }
        pen.push([(p[0] + nn[0] * d) / PX, (p[1] + nn[1] * d) / PX]);
      }
      var chords = [];
      for (var c = 0; c < pen.length - 1; c++) chords.push([pen[c][0], pen[c][1], pen[c + 1][0], pen[c + 1][1]]);
      var cx = 0;
      pts.forEach(function (p) { cx += p[0]; });
      result.push({ cx: cx / n, chords: chords, pen: pen,
        under: pts.map(function (p, i) { return [(p[0] + ns[i][0] * 4) / PX, (p[1] + ns[i][1] * 4) / PX]; }) });
    });
    // sew loops left to right; each loop is one continuous run
    result.sort(function (a, b) { return a.cx - b.cx; });
    var all = [];
    result.forEach(function (r) { all = all.concat(r.chords); });
    return { chords: all, loops: result.length, sewLoops: result.map(function (r) { return { pen: r.pen, under: r.under }; }) };
  }

  // Centreline satin: seeds on the distance-field ridge, each stitch laid across the stroke
  // along a smoothed line field (structure tensor = doubled-angle averaging), so neighbours stay parallel.
  function ridgeSatin(mask, din, spacingMM, maxMM, seed) {
    var rand = rng(seed);
    var N = W * H;
    var gxx = new Float32Array(N), gxy = new Float32Array(N), gyy = new Float32Array(N), gm = new Float32Array(N);
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var i = y * W + x;
        if (!mask[i]) continue;
        var gx = (din[i + 1] - din[i - 1]) / 2, gy = (din[i + W] - din[i - W]) / 2;
        gm[i] = Math.hypot(gx, gy);
        gxx[i] = gx * gx; gxy[i] = gx * gy; gyy[i] = gy * gy;
      }
    }
    var Jxx = blur(gxx, 7, 2), Jxy = blur(gxy, 7, 2), Jyy = blur(gyy, 7, 2);
    var ridge = [];
    for (var r = W; r < N - W; r++) if (mask[r] && din[r] >= 2 && gm[r] < 0.75) ridge.push(r);
    for (var c = ridge.length - 1; c > 0; c--) {
      var j = Math.floor(rand() * (c + 1)), t = ridge[c]; ridge[c] = ridge[j]; ridge[j] = t;
    }
    var sp = spacingMM * PX, cell = sp, gw = Math.ceil(W / cell) + 1, hash = new Map(), out = [];
    function near(px, py) {
      var hx = Math.floor(px / cell), hy = Math.floor(py / cell);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var lst = hash.get((hy + oy) * gw + hx + ox);
        if (!lst) continue;
        for (var q = 0; q < lst.length; q += 2) {
          if ((lst[q] - px) * (lst[q] - px) + (lst[q + 1] - py) * (lst[q + 1] - py) < sp * sp) return true;
        }
      }
      return false;
    }
    function inside(px, py) {
      var ix = Math.round(px), iy = Math.round(py);
      return ix >= 0 && iy >= 0 && ix < W && iy < H && mask[iy * W + ix] === 1;
    }
    var maxPx = maxMM * PX;
    for (var k = 0; k < ridge.length; k++) {
      var idx = ridge[k], cx = idx % W, cy = (idx / W) | 0;
      if (near(cx, cy)) continue;
      var hk = Math.floor(cy / cell) * gw + Math.floor(cx / cell);
      if (!hash.has(hk)) hash.set(hk, []);
      hash.get(hk).push(cx, cy);
      lay(idx, din[idx] * 1.8 + 3, 0);
    }

    // Neighbour consensus: a coarse line field built from the stitches themselves
    // (doubled-angle sums, so 10 deg and 190 deg agree). Drop stitches that disagree with it.
    var FC = 8, fw = Math.ceil(W / FC), fh = Math.ceil(H / FC);
    function buildField(list) {
      var C = new Float32Array(fw * fh), S = new Float32Array(fw * fh), K = new Float32Array(fw * fh);
      list.forEach(function (ch) {
        var th = Math.atan2(ch[3] - ch[1], ch[2] - ch[0]), c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
        var len = Math.hypot(ch[2] - ch[0], ch[3] - ch[1]), steps = Math.max(1, Math.ceil(len / 0.5));
        for (var q = 0; q <= steps; q++) {
          var gx2 = Math.floor((ch[0] + (ch[2] - ch[0]) * q / steps) * PX / FC), gy2 = Math.floor((ch[1] + (ch[3] - ch[1]) * q / steps) * PX / FC);
          if (gx2 < 0 || gy2 < 0 || gx2 >= fw || gy2 >= fh) continue;
          var fi = gy2 * fw + gx2; C[fi] += c2; S[fi] += s2; K[fi] += 1;
        }
      });
      for (var p = 0; p < 2; p++) {
        var C2 = new Float32Array(fw * fh), S2 = new Float32Array(fw * fh), K2 = new Float32Array(fw * fh);
        for (var yy = 0; yy < fh; yy++) for (var xx = 0; xx < fw; xx++) {
          for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
            var x3 = xx + ox, y3 = yy + oy;
            if (x3 < 0 || y3 < 0 || x3 >= fw || y3 >= fh) continue;
            var a3 = y3 * fw + x3, b3 = yy * fw + xx;
            C2[b3] += C[a3]; S2[b3] += S[a3]; K2[b3] += K[a3];
          }
        }
        C = C2; S = S2; K = K2;
      }
      return function (px, py) {
        var gx3 = Math.min(fw - 1, Math.max(0, Math.floor(px / FC))), gy3 = Math.min(fh - 1, Math.max(0, Math.floor(py / FC)));
        var fi2 = gy3 * fw + gx3;
        return { phi: 0.5 * Math.atan2(S[fi2], C[fi2]), coh: K[fi2] ? Math.hypot(C[fi2], S[fi2]) / K[fi2] : 0, n: K[fi2] };
      };
    }
    function angDiff(a, b) {
      var d = Math.abs(a - b) % Math.PI;
      return Math.min(d, Math.PI - d);
    }
    out = uncross(out, 18);
    var field = buildField(out);
    out = out.filter(function (ch) {
      var f = field((ch[0] + ch[2]) / 2 * PX, (ch[1] + ch[3]) / 2 * PX);
      if (f.n < 6 || f.coh < 0.3) return true;
      return angDiff(Math.atan2(ch[3] - ch[1], ch[2] - ch[0]), f.phi) < 35 * Math.PI / 180;
    });
    field = buildField(out);

    // Coverage pass: rasterise what is stitched, then lay extra across-stroke stitches
    // through any bare patch (junctions and wide bowls where the centreline breaks up).
    var cov = new Uint8Array(N);
    function stamp(x0, y0, x1, y1) {
      var len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len));
      for (var q = 0; q <= steps; q++) {
        var px = Math.round(x0 + (x1 - x0) * q / steps), py = Math.round(y0 + (y1 - y0) * q / steps);
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var xx = px + ox, yy = py + oy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) cov[yy * W + xx] = 1;
        }
      }
    }
    out.forEach(function (c) { stamp(c[0] * PX, c[1] * PX, c[2] * PX, c[3] * PX); });
    var bare = [];
    for (var b = 0; b < N; b++) if (mask[b] && din[b] > 3 && !cov[b]) bare.push(b);
    for (var c2 = bare.length - 1; c2 > 0; c2--) {
      var j2 = Math.floor(rand() * (c2 + 1)), t2s = bare[c2]; bare[c2] = bare[j2]; bare[j2] = t2s;
    }
    var extra = 0;
    for (var e = 0; e < bare.length; e++) {
      if (cov[bare[e]]) continue;
      var before = out.length;
      var bx = bare[e] % W, by = (bare[e] / W) | 0, fb = field(bx, by);
      lay(bare[e], din[bare[e]] * 1.6 + 4, 1, fb.n >= 4 && fb.coh > 0.4 ? fb.phi : undefined);
      for (var o = before; o < out.length; o++) stamp(out[o][0] * PX, out[o][1] * PX, out[o][2] * PX, out[o][3] * PX);
      if (out.length === before) cov[bare[e]] = 1; // too small to stitch; don't retry
      extra += out.length - before;
    }
    out = uncross(out, 18);
    // one more fill-in round for holes the cleanup opened, without re-crossing
    var cov2 = new Uint8Array(N);
    cov = cov2;
    out.forEach(function (c) { stamp(c[0] * PX, c[1] * PX, c[2] * PX, c[3] * PX); });
    field = buildField(out);
    var holes = [];
    for (var h2 = 0; h2 < N; h2++) if (mask[h2] && din[h2] > 3 && !cov[h2]) holes.push(h2);
    for (var e2 = 0; e2 < holes.length; e2++) {
      if (cov[holes[e2]]) continue;
      var hb = out.length, hx = holes[e2] % W, hy = (holes[e2] / W) | 0, fh2 = field(hx, hy);
      lay(holes[e2], din[holes[e2]] * 1.6 + 4, 1, fh2.n >= 4 && fh2.coh > 0.4 ? fh2.phi : undefined);
      var added = out.slice(hb);
      var bad = added.some(function (a) { return crossesAny(a, out.slice(0, hb), 18); });
      if (bad) { out.length = hb; cov[holes[e2]] = 1; continue; }
      added.forEach(function (a) { stamp(a[0] * PX, a[1] * PX, a[2] * PX, a[3] * PX); });
      if (!added.length) cov[holes[e2]] = 1;
    }
    out.extra = extra;
    return out;

    function lay(idx, cap, src, phiOverride) {
      var cx = idx % W, cy = (idx / W) | 0;
      var phi = phiOverride !== undefined ? phiOverride : 0.5 * Math.atan2(2 * Jxy[idx], Jxx[idx] - Jyy[idx]);
      var ax = Math.cos(phi), ay = Math.sin(phi);
      var t1 = 0, t2 = 0;
      while (t1 < cap && inside(cx + ax * (t1 + 0.5), cy + ay * (t1 + 0.5))) t1 += 0.5;
      while (t2 < cap && inside(cx - ax * (t2 + 0.5), cy - ay * (t2 + 0.5))) t2 += 0.5;
      var x0 = cx - ax * t2, y0 = cy - ay * t2, x1 = cx + ax * t1, y1 = cy + ay * t1;
      var L = t1 + t2;
      if (L < 4) return;
      var n = Math.max(1, Math.ceil(L / maxPx)), stag = (rand() - 0.5) * 0.45;
      for (var s = 0; s < n; s++) {
        var u0 = s === 0 ? 0 : Math.min(0.95, Math.max(0.05, (s + stag) / n));
        var u1 = s === n - 1 ? 1 : Math.min(0.95, Math.max(0.05, (s + 1 + stag) / n));
        out.push([(x0 + (x1 - x0) * u0) / PX, (y0 + (y1 - y0) * u0) / PX, (x0 + (x1 - x0) * u1) / PX, (y0 + (y1 - y0) * u1) / PX, src]);
      }
    }
  }

  // Segment crossing test: proper intersection away from the ends, at a real angle.
  function crossPair(a, b, minRad) {
    var rx = a[2] - a[0], ry = a[3] - a[1], sx = b[2] - b[0], sy = b[3] - b[1];
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return false;
    var qx = b[0] - a[0], qy = b[1] - a[1];
    var t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
    if (t < 0.06 || t > 0.94 || u < 0.06 || u > 0.94) return false;
    var d = Math.abs(Math.atan2(ry, rx) - Math.atan2(sy, sx)) % Math.PI;
    return Math.min(d, Math.PI - d) > minRad;
  }
  function crossesAny(a, list, minDeg) {
    var minRad = minDeg * Math.PI / 180;
    var ax0 = Math.min(a[0], a[2]), ax1 = Math.max(a[0], a[2]), ay0 = Math.min(a[1], a[3]), ay1 = Math.max(a[1], a[3]);
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (Math.max(b[0], b[2]) < ax0 || Math.min(b[0], b[2]) > ax1 || Math.max(b[1], b[3]) < ay0 || Math.min(b[1], b[3]) > ay1) continue;
      if (crossPair(a, b, minRad)) return true;
    }
    return false;
  }
  // Remove criss-crossing: repeatedly drop the stitch involved in the most crossings
  // (coverage stitches before centreline ones on ties) until none cross at > minDeg.
  function uncross(list, minDeg) {
    var minRad = minDeg * Math.PI / 180, n = list.length, cell = 2, grid = new Map();
    for (var i = 0; i < n; i++) {
      var c = list[i];
      var x0 = Math.floor(Math.min(c[0], c[2]) / cell), x1 = Math.floor(Math.max(c[0], c[2]) / cell);
      var y0 = Math.floor(Math.min(c[1], c[3]) / cell), y1 = Math.floor(Math.max(c[1], c[3]) / cell);
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
        var k = gy * 100000 + gx;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
    var adj = list.map(function () { return []; }), seen = new Set();
    grid.forEach(function (ids) {
      for (var a = 0; a < ids.length; a++) for (var b = a + 1; b < ids.length; b++) {
        var p = ids[a], q = ids[b], key = p < q ? p * 1e6 + q : q * 1e6 + p;
        if (seen.has(key)) continue;
        seen.add(key);
        if (crossPair(list[p], list[q], minRad)) { adj[p].push(q); adj[q].push(p); }
      }
    });
    var alive = new Uint8Array(n).fill(1), deg = adj.map(function (l) { return l.length; });
    for (;;) {
      var worst = -1, wd = 0;
      for (var j = 0; j < n; j++) {
        if (!alive[j] || deg[j] === 0) continue;
        var score = deg[j] + (list[j][4] === 1 ? 0.5 : 0);
        if (score > wd) { wd = score; worst = j; }
      }
      if (worst < 0) break;
      alive[worst] = 0;
      adj[worst].forEach(function (o) { if (alive[o]) deg[o]--; });
    }
    return list.filter(function (_, idx) { return alive[idx]; });
  }

  // Fill gaps between neighbouring satin stitches (the outside of curves fans open):
  // where consecutive stitches are near-parallel neighbours, add in-between stitches so
  // neither edge spreads wider than `maxGapMM`.
  function densify(chords, maxGapMM) {
    var out = [];
    for (var i = 0; i < chords.length; i++) {
      var a = chords[i];
      out.push(a);
      var b = chords[i + 1];
      if (!b) break;
      // b runs the opposite way in the zigzag; compare it reversed
      var bs = [b[2], b[3]], be = [b[0], b[1]];
      var d0 = Math.hypot(bs[0] - a[0], bs[1] - a[1]), d1 = Math.hypot(be[0] - a[2], be[1] - a[3]);
      var gap = Math.max(d0, d1);
      if (gap <= maxGapMM || gap > 2.2) continue;
      var va = [a[2] - a[0], a[3] - a[1]], vb = [be[0] - bs[0], be[1] - bs[1]];
      var cos = (va[0] * vb[0] + va[1] * vb[1]) / ((Math.hypot(va[0], va[1]) * Math.hypot(vb[0], vb[1])) || 1);
      if (cos < 0.9) continue;
      var k = Math.ceil(gap / maxGapMM) - 1;
      // a fan (one side converging) gets short stitches: they reach only part-way
      // toward the tight side so the needle doesn't pile up in the inside corner
      var fan = Math.min(d0, d1) < 0.45 * gap;
      var outerAtEnd = d1 >= d0;
      for (var j = 1; j <= k; j++) {
        var t = j / (k + 1);
        var sx = a[0] + (bs[0] - a[0]) * t, sy = a[1] + (bs[1] - a[1]) * t;
        var ex = a[2] + (be[0] - a[2]) * t, ey = a[3] + (be[1] - a[3]) * t;
        if (fan) {
          var reach = j % 2 ? 0.55 : 0.75;
          if (outerAtEnd) { sx = ex + (sx - ex) * reach; sy = ey + (sy - ey) * reach; }
          else { ex = sx + (ex - sx) * reach; ey = sy + (ey - sy) * reach; }
        }
        // keep the zigzag continuous: alternate direction
        out.push(j % 2 ? [ex, ey, sx, sy, 2] : [sx, sy, ex, ey, 2]);
      }
      if (k % 2 === 1) {
        // odd number inserted: b must now start where the last insert ended; flip it
        chords[i + 1] = [b[2], b[3], b[0], b[1], b[4]];
      }
    }
    return out;
  }

  // ---------- Stroke decomposition (skeleton -> stroke columns) ----------

  // Zhang-Suen thinning to a one-pixel skeleton.
  function thin(mask) {
    var img = Uint8Array.from(mask), pts = [];
    for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) if (img[y * W + x]) pts.push(y * W + x);
    var changed = true;
    while (changed) {
      changed = false;
      for (var step = 0; step < 2; step++) {
        var del = [];
        for (var k = 0; k < pts.length; k++) {
          var i = pts[k];
          if (!img[i]) continue;
          var p2 = img[i - W], p3 = img[i - W + 1], p4 = img[i + 1], p5 = img[i + W + 1];
          var p6 = img[i + W], p7 = img[i + W - 1], p8 = img[i - 1], p9 = img[i - W - 1];
          var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          var A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (step === 0) { if (p2 && p4 && p6) continue; if (p4 && p6 && p8) continue; }
          else { if (p2 && p4 && p8) continue; if (p2 && p6 && p8) continue; }
          del.push(i);
        }
        for (var d = 0; d < del.length; d++) img[del[d]] = 0;
        if (del.length) changed = true;
      }
      pts = pts.filter(function (q) { return img[q]; });
    }
    return { img: img, pts: pts };
  }

  var NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  function setMask(w, h) { W = w; H = h; NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]; }

  // Skeleton -> graph of branches between junction/end clusters.
  function skeletonGraph(sk) {
    var img = sk.img, pts = sk.pts;
    var deg = new Uint8Array(W * H), isNode = new Uint8Array(W * H);
    pts.forEach(function (i) {
      var c = 0;
      for (var n = 0; n < 8; n++) if (img[i + NB[n]]) c++;
      deg[i] = c;
      if (c !== 2) isNode[i] = 1;
    });
    // cluster adjacent node pixels
    var cluster = new Int32Array(W * H).fill(-1), clusters = [];
    pts.forEach(function (i) {
      if (!isNode[i] || cluster[i] >= 0) return;
      var id = clusters.length, stack = [i], members = [];
      cluster[i] = id;
      while (stack.length) {
        var p = stack.pop(); members.push(p);
        for (var n = 0; n < 8; n++) {
          var q = p + NB[n];
          if (img[q] && isNode[q] && cluster[q] < 0) { cluster[q] = id; stack.push(q); }
        }
      }
      var sx = 0, sy = 0;
      members.forEach(function (m) { sx += m % W; sy += (m / W) | 0; });
      clusters.push({ x: sx / members.length, y: sy / members.length, members: members });
    });
    var visited = new Uint8Array(W * H), branches = [];
    function walk(startNode, first) {
      var path = [startNode, first], prev = startNode, cur = first;
      var startCluster = cluster[startNode];
      while (!isNode[cur]) {
        visited[cur] = 1;
        var next = -1;
        for (var n = 0; n < 8; n++) {
          var q = cur + NB[n];
          if (!img[q] || q === prev) continue;
          if (isNode[q] && !(cluster[q] === startCluster && path.length < 3)) { next = q; break; }
          if (!isNode[q] && !visited[q]) next = q;
        }
        if (next < 0) break;
        path.push(next); prev = cur; cur = next;
      }
      return { a: startCluster, b: isNode[cur] ? cluster[cur] : -1, path: path };
    }
    clusters.forEach(function (cl) {
      cl.members.forEach(function (m) {
        for (var n = 0; n < 8; n++) {
          var q = m + NB[n];
          if (img[q] && !isNode[q] && !visited[q]) branches.push(walk(m, q));
        }
      });
    });
    // pure cycles with no nodes
    pts.forEach(function (i) {
      if (visited[i] || isNode[i]) return;
      var path = [i], prev = -1, cur = i;
      visited[i] = 1;
      for (;;) {
        var next = -1;
        for (var n = 0; n < 8; n++) { var q = cur + NB[n]; if (img[q] && !visited[q] && q !== prev) { next = q; break; } }
        if (next < 0) break;
        visited[next] = 1; path.push(next); prev = cur; cur = next;
      }
      path.push(i);
      branches.push({ a: -1, b: -1, path: path, cycle: true });
    });
    branches.forEach(function (br) {
      br.pts = br.path.map(function (p) { return [p % W, (p / W) | 0]; });
      if (br.a >= 0) br.pts[0] = [clusters[br.a].x, clusters[br.a].y];
      if (br.b >= 0) br.pts[br.pts.length - 1] = [clusters[br.b].x, clusters[br.b].y];
      br.len = polyLen(br.pts);
    });
    return { clusters: clusters, branches: branches };
  }

  function polyLen(p) {
    var l = 0;
    for (var i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return l;
  }
  function sampleBil(field, x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return sampleD(field, x, y);
    var i = y0 * W + x0;
    return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) + (field[i + W] * (1 - fx) + field[i + W + 1] * fx) * fy;
  }
  function sampleD(field, x, y) {
    var ix = Math.min(W - 1, Math.max(0, Math.round(x))), iy = Math.min(H - 1, Math.max(0, Math.round(y)));
    return field[iy * W + ix];
  }

  var CORNER_SCALES = [[8, 62], [20, 88]];
  // Branches -> stroke columns: prune spurs, chain through-strokes at junctions, split at sharp corners.
  function strokeColumns(mask, din) {
    var g = skeletonGraph(thin(mask)), cl = g.clusters, br = g.branches.filter(function (b) { return b.pts.length > 1; });
    function degrees() {
      var d = cl.map(function () { return 0; });
      br.forEach(function (b) { if (b.a >= 0) d[b.a]++; if (b.b >= 0) d[b.b]++; });
      return d;
    }
    for (var pass = 0; pass < 3; pass++) {
      var dg = degrees();
      br = br.filter(function (b) {
        if (b.cycle) return true;
        var freeA = b.a < 0 || dg[b.a] === 1, freeB = b.b < 0 || dg[b.b] === 1;
        if (freeA && freeB) return b.len >= 2;
        if (!freeA && !freeB) return true;
        var j = freeA ? cl[b.b] : cl[b.a];
        return b.len >= sampleD(din, j.x, j.y) * 1.6 + 4; // short branch off a junction = spur toward a corner
      });
    }
    var dgf = degrees();
    // direction leaving a cluster along a branch end
    function leaving(b, atStart) {
      var p = atStart ? b.pts : b.pts.slice().reverse(), o = p[0], acc = 0;
      for (var i = 1; i < p.length; i++) {
        acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (acc >= 18 || i === p.length - 1) {
          var dx = p[i][0] - o[0], dy = p[i][1] - o[1], l = Math.hypot(dx, dy) || 1;
          return [dx / l, dy / l];
        }
      }
      return [1, 0];
    }
    // pair branch ends at each cluster that continue straight through
    var link = new Map(); // key "branch:end" -> [branch, end]
    var ends = cl.map(function () { return []; });
    br.forEach(function (b, bi) {
      if (b.cycle) return;
      if (b.a >= 0) ends[b.a].push([bi, 0]);
      if (b.b >= 0) ends[b.b].push([bi, 1]);
    });
    ends.forEach(function (list, ci) {
      if (list.length < 2) return;
      var maxDev = (list.length === 2 ? 70 : 48) * Math.PI / 180, cands = [];
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        if (list[i][0] === list[j][0]) continue; // a self-loop at one cluster
        var d1 = leaving(br[list[i][0]], list[i][1] === 0), d2 = leaving(br[list[j][0]], list[j][1] === 0);
        var dot = d1[0] * d2[0] + d1[1] * d2[1];
        if (dot < -Math.cos(maxDev)) cands.push([dot, i, j]);
      }
      cands.sort(function (a, b) { return a[0] - b[0]; });
      var used = {};
      cands.forEach(function (c) {
        if (used[c[1]] || used[c[2]]) return;
        used[c[1]] = used[c[2]] = 1;
        var e1 = list[c[1]], e2 = list[c[2]];
        link.set(e1[0] + ':' + e1[1], e2); link.set(e2[0] + ':' + e2[1], e1);
      });
    });
    // walk chains
    var usedB = new Uint8Array(br.length), chains = [];
    function chainFrom(bi, enterEnd) {
      var pts = [], ends2 = [];
      var cur = bi, entry = enterEnd;
      var startCluster = entry === 0 ? br[cur].a : br[cur].b;
      for (var guard = 0; guard < br.length + 1; guard++) {
        usedB[cur] = 1;
        var p = entry === 0 ? br[cur].pts : br[cur].pts.slice().reverse();
        pts = pts.length ? pts.concat(p.slice(1)) : p.slice();
        var exitEnd = 1 - entry, nxt = link.get(cur + ':' + exitEnd);
        if (!nxt || usedB[nxt[0]]) {
          ends2 = [startCluster, exitEnd === 0 ? br[cur].a : br[cur].b];
          break;
        }
        cur = nxt[0]; entry = nxt[1];
      }
      return { pts: pts, ca: ends2[0], cb: ends2[1] };
    }
    br.forEach(function (b, bi) {
      if (usedB[bi]) return;
      if (b.cycle) { usedB[bi] = 1; chains.push({ pts: b.pts.slice(), ca: -1, cb: -1, cycle: true }); return; }
      if (!link.has(bi + ':0')) chains.push(chainFrom(bi, 0));
      else if (!link.has(bi + ':1')) chains.push(chainFrom(bi, 1));
    });
    br.forEach(function (b, bi) { if (!usedB[bi]) chains.push(chainFrom(bi, 0)); }); // closed chains

    // resample + smooth each chain, split at sharp corners, extend free ends and corner ends
    var cols = [];
    chains.forEach(function (ch) {
      var p = resampleOpen(ch.pts, 1);
      if (p.length < 3) return;
      p = smoothOpen(p, 4, 2);
      var freeA = ch.ca < 0 ? !ch.cycle : dgf[ch.ca] === 1, freeB = ch.cb < 0 ? !ch.cycle : dgf[ch.cb] === 1;
      // corner detection
      // corners at two scales: a sharp kink over 0.8 mm, or a cusp the smoothed skeleton rounds off over 2 mm
      var cuts = [], SC = CORNER_SCALES;
      SC.forEach(function (sc) {
        var K = sc[0], thr = sc[1] * Math.PI / 180;
        for (var i = K; i < p.length - K; i++) {
          var ax = p[i][0] - p[i - K][0], ay = p[i][1] - p[i - K][1], bx = p[i + K][0] - p[i][0], by = p[i + K][1] - p[i][1];
          var ang = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1))));
          if (ang <= thr) continue;
          var near = null;
          cuts.forEach(function (c) { if (Math.abs(c.i - i) < K) near = c; });
          if (near) { if (ang > near.a && near.k === K) { near.i = i; near.a = ang; } }
          else cuts.push({ i: i, a: ang, k: K });
        }
      });
      cuts.sort(function (a, b) { return a.i - b.i; });
      var pieces = [], from = 0;
      cuts.forEach(function (c) { pieces.push({ pts: p.slice(from, c.i + 1), a: from === 0 ? 'chain' : 'corner', b: 'corner' }); from = c.i; });
      pieces.push({ pts: p.slice(from), a: from === 0 ? 'chain' : 'corner', b: 'chain' });
      pieces.forEach(function (pc) {
        var q = pc.pts;
        if (q.length < 2) return;
        var extA = pc.a === 'corner' ? 0.9 : (freeA ? 1.05 : 0.35);
        var extB = pc.b === 'corner' ? 0.9 : (freeB ? 1.05 : 0.35);
        q = extend(q, true, sampleD(din, q[0][0], q[0][1]) * extA);
        q = extend(q, false, sampleD(din, q[q.length - 1][0], q[q.length - 1][1]) * extB);
        var minX = Infinity;
        q.forEach(function (pt) { minX = Math.min(minX, pt[0]); });
        cols.push({ pts: q, minX: minX, cycle: ch.cycle && !cuts.length });
      });
    });
    cols.sort(function (a, b) { return a.minX - b.minX; }); // writing order: left to right
    return cols;
  }

  function resampleOpen(pts, step) {
    var out = [pts[0]], carry = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      var t = step - carry;
      while (t <= len) { out.push([a[0] + dx * t / len, a[1] + dy * t / len]); t += step; }
      carry = len - (t - step);
    }
    var last = pts[pts.length - 1];
    if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > 0.3) out.push(last);
    return out;
  }
  function smoothOpen(pts, win, passes) {
    var a = pts, n = pts.length;
    for (var p = 0; p < passes; p++) {
      var b = [];
      for (var i = 0; i < n; i++) {
        var lo = Math.max(0, i - win), hi = Math.min(n - 1, i + win), sx = 0, sy = 0;
        for (var k = lo; k <= hi; k++) { sx += a[k][0]; sy += a[k][1]; }
        b.push([sx / (hi - lo + 1), sy / (hi - lo + 1)]);
      }
      b[0] = a[0]; b[n - 1] = a[n - 1];
      a = b;
    }
    return a;
  }
  function extend(pts, atStart, dist) {
    if (dist < 1 || pts.length < 2) return pts;
    var n = pts.length, k = Math.min(n - 1, 6);
    var e = atStart ? pts[0] : pts[n - 1], f = atStart ? pts[k] : pts[n - 1 - k];
    var dx = e[0] - f[0], dy = e[1] - f[1], l = Math.hypot(dx, dy) || 1;
    var add = [];
    for (var t = 1; t <= dist; t += 1) add.push([e[0] + dx / l * t, e[1] + dy / l * t]);
    return atStart ? add.reverse().concat(pts) : pts.concat(add);
  }

  // Satin along each column: stitches perpendicular to the column's own path,
  // emitted when either edge has advanced ~0.4 mm, with short stitches where the inside edge bunches.
  // Territories: every mask pixel belongs to the column whose centreline is nearest *inside the letter*
  // (geodesic Voronoi by labelled chamfer propagation). Stitches stay in their own territory plus a small
  // overlap, so strokes meet at clean seams instead of crossing at junctions.
  function territories(mask, cols) {
    var N = W * H, lab = new Int32Array(N).fill(-1), dist = new Float32Array(N).fill(1e9);
    cols.forEach(function (col, ci) {
      var p = col.pts;
      for (var i = 0; i < p.length; i++) {
        var a = p[i], b = p[Math.min(p.length - 1, i + 1)], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
        for (var k = 0; k <= n; k++) {
          var x = Math.round(a[0] + (b[0] - a[0]) * k / n), y = Math.round(a[1] + (b[1] - a[1]) * k / n), q = y * W + x;
          if (x < 0 || y < 0 || x >= W || y >= H || !mask[q] || dist[q] === 0) continue;
          dist[q] = 0; lab[q] = ci;
        }
      }
    });
    var R2 = Math.SQRT2;
    for (var pass = 0; pass < 12; pass++) {
      var changed = 0;
      for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
        var i = y * W + x; if (!mask[i]) continue;
        var d = dist[i], l = lab[i];
        if (dist[i - 1] + 1 < d) { d = dist[i - 1] + 1; l = lab[i - 1]; }
        if (dist[i - W] + 1 < d) { d = dist[i - W] + 1; l = lab[i - W]; }
        if (dist[i - W - 1] + R2 < d) { d = dist[i - W - 1] + R2; l = lab[i - W - 1]; }
        if (dist[i - W + 1] + R2 < d) { d = dist[i - W + 1] + R2; l = lab[i - W + 1]; }
        if (d < dist[i]) { dist[i] = d; lab[i] = l; changed++; }
      }
      for (var y2 = H - 2; y2 >= 1; y2--) for (var x2 = W - 2; x2 >= 1; x2--) {
        var j = y2 * W + x2; if (!mask[j]) continue;
        var e = dist[j], m = lab[j];
        if (dist[j + 1] + 1 < e) { e = dist[j + 1] + 1; m = lab[j + 1]; }
        if (dist[j + W] + 1 < e) { e = dist[j + W] + 1; m = lab[j + W]; }
        if (dist[j + W + 1] + R2 < e) { e = dist[j + W + 1] + R2; m = lab[j + W + 1]; }
        if (dist[j + W - 1] + R2 < e) { e = dist[j + W - 1] + R2; m = lab[j + W - 1]; }
        if (e < dist[j]) { dist[j] = e; lab[j] = m; changed++; }
      }
      if (!changed) break;
    }
    return lab;
  }

  function columnSatin(mask, din, cols, maxMM, spacingMM, pullMM, terr) {
    var out = [], maxPx = maxMM * PX, gapPx = (spacingMM || 0.27) * PX, pc = (pullMM || 0) * PX / 2, OV = 0.35 * PX;
    function inside(x, y) {
      var ix = Math.round(x), iy = Math.round(y);
      return ix >= 0 && iy >= 0 && ix < W && iy < H && mask[iy * W + ix] === 1;
    }
    // walk from (x, y) along (dx, dy) until the edge of the letter, or OV into another column's territory
    function reachTo(x, y, dx, dy, cap, ci) {
      var t = 0, foreign = 0;
      while (t < cap) {
        var px = x + dx * (t + 0.5), py = y + dy * (t + 0.5);
        if (!inside(px, py)) break;
        if (terr) {
          var lb = terr[Math.round(py) * W + Math.round(px)];
          if (lb !== ci && lb >= 0) { foreign += 0.5; if (foreign > OV) break; } else foreign = 0;
        }
        t += 0.5;
      }
      return Math.max(0, t - (terr ? Math.max(0, foreign - OV) : 0));
    }
    // carry each column on past its end, straight along its tangent, while the letter (and its own territory) continues:
    // tapered tips and swash ends then get proper satin instead of patch stitches
    function tipExtend(p, ci, atStart) {
      var n = p.length, k = Math.min(n - 1, 10);
      if (n < 3) return p;
      var e = atStart ? p[0] : p[n - 1], f = atStart ? p[k] : p[n - 1 - k];
      var dx = e[0] - f[0], dy = e[1] - f[1], l = Math.hypot(dx, dy) || 1, add = [];
      dx /= l; dy /= l;
      // the rest of this column (away from this end): a loop whose two ends meet must not extend both into the same tip
      var body = [], skip = 40;
      for (var b = atStart ? skip : 0; b < (atStart ? n : n - skip); b += 2) body.push(p[b]);
      var x = e[0], y = e[1];
      for (var t = 1; t <= 70; t++) {
        x += dx; y += dy;
        if (!inside(x, y)) break;
        if (terr) { var lb = terr[Math.round(y) * W + Math.round(x)]; if (lb !== ci && lb >= 0) break; }
        var near = Math.max(4, sampleD(din, x, y) * 1.3), hit = false;
        for (var q = 0; q < body.length && !hit; q++) if (Math.abs(body[q][0] - x) < near && Math.abs(body[q][1] - y) < near && Math.hypot(body[q][0] - x, body[q][1] - y) < near) hit = true;
        if (hit) break;
        // keep to the middle of the tapering tip: re-centre between the two edges, and let the heading follow
        var r1 = reachTo(x, y, -dy, dx, 40, ci), r2 = reachTo(x, y, dy, -dx, 40, ci), sh = (r1 - r2) / 2;
        if (r1 + r2 < 3) break;                      // the tip has closed
        if (Math.abs(sh) > 0.5) {
          var mx2 = x - dy * sh * 0.3, my2 = y + dx * sh * 0.3;
          if (inside(mx2, my2)) {
            var ndx = dx + (-dy) * Math.sign(sh) * 0.08, ndy = dy + dx * Math.sign(sh) * 0.08, nl = Math.hypot(ndx, ndy) || 1;
            dx = ndx / nl; dy = ndy / nl; x = mx2; y = my2;
          }
        }
        add.push([x, y]);
      }
      return atStart ? add.reverse().concat(p) : p.concat(add);
    }
    cols.forEach(function (col, ci) {
      var p = col.pts;
      var wds = p.map(function (q) { return sampleD(din, q[0], q[1]); }).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
      var halfW = wds.length ? wds[Math.floor(wds.length / 2)] : 0;
      // narrow columns need denser satin: thread spreads less across a short stitch, so gaps show sooner
      var colW = 2 * halfW / PX, colGap = gapPx * (colW < 0.9 ? 1.1 : 1); // spacing already follows the real thread width; hairlines open a touch so the needle doesn't perforate a line
      var n0 = p.length, preN = 0, sufN = 0;
      if (terr && !col.cycle) {
        p = tipExtend(p, ci, true); preN = p.length - n0; var n1 = p.length; p = tipExtend(p, ci, false); sufN = p.length - n1;
        if (preN + sufN) p = smoothOpen(p, 5, 2);
        col.pts = p;
      }
      var n = p.length, last = null, flip = false, shortToggle = false;
      for (var i = 0; i < n; i++) {
        var a = p[Math.max(0, i - 6)], b = p[Math.min(n - 1, i + 6)];
        var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
        var nx = -ty / tl, ny = tx / tl, c = p[i];
        if (!inside(c[0], c[1])) continue;
        var tip = i < preN || i >= n - sufN;
        var cap = Math.max(sampleD(din, c[0], c[1]) * 1.35 + 3, terr && tip ? halfW * 1.7 : 0);
        if (terr && terr[Math.round(c[1]) * W + Math.round(c[0])] !== ci) continue;   // this stretch belongs to another stroke
        var t1 = reachTo(c[0], c[1], nx, ny, cap, ci), t2 = reachTo(c[0], c[1], -nx, -ny, cap, ci);
        if (terr) {
          // tight curve: stitches perpendicular to the path meet at the centre of curvature; stop the inner side short of it
          var A = p[Math.max(0, i - 8)], B = p[Math.min(n - 1, i + 8)];
          var ux = c[0] - A[0], uy = c[1] - A[1], vx = B[0] - c[0], vy = B[1] - c[1];
          var crs = ux * vy - uy * vx, la = Math.hypot(ux, uy), lb2 = Math.hypot(vx, vy), lc = Math.hypot(B[0] - A[0], B[1] - A[1]);
          if (Math.abs(crs) > 1e-6 && la > 2 && lb2 > 2) {
            var R = la * lb2 * lc / (2 * Math.abs(crs));          // circumradius through A, c, B
            var inner = R * 0.92;
            // the centre lies on the +normal side when the path turns left (crs > 0 with this normal)
            if (crs > 0) { if (t1 > inner) t1 = Math.max(2, inner); } else { if (t2 > inner) t2 = Math.max(2, inner); }
          }
        }
        var E1 = [c[0] + nx * t1, c[1] + ny * t1], E2 = [c[0] - nx * t2, c[1] - ny * t2];
        if (t1 + t2 < 4) continue;
        if (last) {
          var m1 = Math.hypot(E1[0] - last[0][0], E1[1] - last[0][1]), m2 = Math.hypot(E2[0] - last[1][0], E2[1] - last[1][1]);
          var mc = Math.hypot(c[0] - last[2][0], c[1] - last[2][1]);
          if (Math.max(m1, m2) < colGap && mc < colGap * 1.15) continue;
          var s1 = E1, s2 = E2;
          // short stitch: the side that barely moved stops part-way
          if (Math.min(m1, m2) < colGap * 0.3) {
            shortToggle = !shortToggle;
            var reach = shortToggle ? 0.55 : 0.8;
            if (m1 < m2) s1 = [E2[0] + (E1[0] - E2[0]) * reach, E2[1] + (E1[1] - E2[1]) * reach];
            else s2 = [E1[0] + (E2[0] - E1[0]) * reach, E1[1] + (E2[1] - E1[1]) * reach];
          }
          emit(s1, s2);
        } else emit(E1, E2);
        last = [E1, E2, c];
      }
      function emit(A, B) {
        if (pc > 0) {
          // pull compensation: thread tension narrows satin, so each column is sewn slightly wider
          var ex = B[0] - A[0], ey = B[1] - A[1], el = Math.hypot(ex, ey);
          if (el > 8) { ex /= el; ey /= el; A = [A[0] - ex * pc, A[1] - ey * pc]; B = [B[0] + ex * pc, B[1] + ey * pc]; }
        }
        var x0 = A[0], y0 = A[1], x1 = B[0], y1 = B[1];
        if (flip) { x0 = B[0]; y0 = B[1]; x1 = A[0]; y1 = A[1]; }
        flip = !flip;
        var L = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(L / maxPx)), stag = ((out.length * 0.37) % 1 - 0.5) * 0.45;
        for (var s = 0; s < k; s++) {
          var u0 = s === 0 ? 0 : Math.min(0.95, Math.max(0.05, (s + stag) / k));
          var u1 = s === k - 1 ? 1 : Math.min(0.95, Math.max(0.05, (s + 1 + stag) / k));
          out.push([(x0 + (x1 - x0) * u0) / PX, (y0 + (y1 - y0) * u0) / PX, (x0 + (x1 - x0) * u1) / PX, (y0 + (y1 - y0) * u1) / PX, 0, ci]);
        }
      }
    });
    return out;
  }

  // Overlaps: where stitches of two strokes cross, the later stroke (writing order) stays on top
  // and the one underneath is dropped; crossings within one stroke drop the worst offender.
  function resolveOverlaps(list, minDeg, sameColumnOnly) {
    var minRad = minDeg * Math.PI / 180, n = list.length, cell = 2, grid = new Map();
    for (var i = 0; i < n; i++) {
      var c = list[i];
      var x0 = Math.floor(Math.min(c[0], c[2]) / cell), x1 = Math.floor(Math.max(c[0], c[2]) / cell);
      var y0 = Math.floor(Math.min(c[1], c[3]) / cell), y1 = Math.floor(Math.max(c[1], c[3]) / cell);
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
        var k = gy * 100000 + gx;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
    var pairs = [], seen = new Set();
    grid.forEach(function (ids) {
      for (var a = 0; a < ids.length; a++) for (var b = a + 1; b < ids.length; b++) {
        var p = ids[a], q = ids[b], key = p < q ? p * 1e6 + q : q * 1e6 + p;
        if (seen.has(key)) continue;
        seen.add(key);
        if (crossPair(list[p], list[q], minRad)) pairs.push([p, q]);
      }
    });
    var alive = new Uint8Array(n).fill(1);
    pairs.forEach(function (pq) {
      var cp = list[pq[0]][5], cq = list[pq[1]][5];
      if (cp !== cq && !sameColumnOnly) alive[cp < cq ? pq[0] : pq[1]] = 0;
    });
    var adj = list.map(function () { return []; });
    pairs.forEach(function (pq) {
      if (sameColumnOnly && list[pq[0]][5] !== list[pq[1]][5]) return;   // seam overlaps between strokes are intended
      if (alive[pq[0]] && alive[pq[1]]) { adj[pq[0]].push(pq[1]); adj[pq[1]].push(pq[0]); }
    });
    var deg = adj.map(function (l) { return l.length; });
    for (;;) {
      var worst = -1, wd = 0;
      for (var j = 0; j < n; j++) if (alive[j] && deg[j] > wd) { wd = deg[j]; worst = j; }
      if (worst < 0) break;
      alive[worst] = 0;
      adj[worst].forEach(function (o) { if (alive[o]) deg[o]--; });
    }
    return list.filter(function (_, idx) { return alive[idx]; });
  }

  // Coverage safety net: any bare patch gets across-stroke stitches steered by the
  // neighbours' line field, and only if they cross nothing.
  function fillHoles(mask, din, list, seed) {
    var rand = rng(seed), N = W * H, cov = new Uint8Array(N);
    function stamp(c) {
      var x0 = c[0] * PX, y0 = c[1] * PX, x1 = c[2] * PX, y1 = c[3] * PX;
      var len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len));
      for (var q = 0; q <= steps; q++) {
        var px = Math.round(x0 + (x1 - x0) * q / steps), py = Math.round(y0 + (y1 - y0) * q / steps);
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var xx = px + ox, yy = py + oy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) cov[yy * W + xx] = 1;
        }
      }
    }
    list.forEach(stamp);
    var FC = 8, fw = Math.ceil(W / FC), fh = Math.ceil(H / FC);
    var C = new Float32Array(fw * fh), S = new Float32Array(fw * fh), K = new Float32Array(fw * fh);
    list.forEach(function (ch) {
      var th = Math.atan2(ch[3] - ch[1], ch[2] - ch[0]), c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
      var len = Math.hypot(ch[2] - ch[0], ch[3] - ch[1]), steps = Math.max(1, Math.ceil(len / 0.5));
      for (var q = 0; q <= steps; q++) {
        var gx = Math.floor((ch[0] + (ch[2] - ch[0]) * q / steps) * PX / FC), gy = Math.floor((ch[1] + (ch[3] - ch[1]) * q / steps) * PX / FC);
        if (gx < 0 || gy < 0 || gx >= fw || gy >= fh) continue;
        var fi = gy * fw + gx; C[fi] += c2; S[fi] += s2; K[fi] += 1;
      }
    });
    function fieldAt(px, py) {
      var gx = Math.floor(px / FC), gy = Math.floor(py / FC), cs = 0, ss = 0, kk = 0;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var x = gx + ox, y = gy + oy;
        if (x < 0 || y < 0 || x >= fw || y >= fh) continue;
        var fi = y * fw + x; cs += C[fi]; ss += S[fi]; kk += K[fi];
      }
      return kk ? { phi: 0.5 * Math.atan2(ss, cs), coh: Math.hypot(cs, ss) / kk } : null;
    }
    function inside(x, y) {
      var ix = Math.round(x), iy = Math.round(y);
      return ix >= 0 && iy >= 0 && ix < W && iy < H && mask[iy * W + ix] === 1;
    }
    var bare = [];
    for (var b = 0; b < N; b++) if (mask[b] && din[b] > 3 && !cov[b]) bare.push(b);
    for (var c = bare.length - 1; c > 0; c--) { var j = Math.floor(rand() * (c + 1)), t = bare[c]; bare[c] = bare[j]; bare[j] = t; }
    var added = 0;
    for (var e = 0; e < bare.length; e++) {
      var idx = bare[e];
      if (cov[idx]) continue;
      var cx = idx % W, cy = (idx / W) | 0, f = fieldAt(cx, cy);
      cov[idx] = 1;
      if (!f || f.coh < 0.35) continue;
      var ax = Math.cos(f.phi), ay = Math.sin(f.phi), cap = din[idx] * 1.6 + 4, t1 = 0, t2 = 0;
      while (t1 < cap && inside(cx + ax * (t1 + 0.5), cy + ay * (t1 + 0.5))) t1 += 0.5;
      while (t2 < cap && inside(cx - ax * (t2 + 0.5), cy - ay * (t2 + 0.5))) t2 += 0.5;
      if (t1 + t2 < 4 || t1 + t2 > 70) continue;
      var ch = [(cx - ax * t2) / PX, (cy - ay * t2) / PX, (cx + ax * t1) / PX, (cy + ay * t1) / PX, 1, -1];
      if (crossesAny(ch, list, 18)) continue;
      list.push(ch); stamp(ch); added++;
    }
    return added;
  }

  var LAST = {};
  function strokeFill(mask, din, seed, o) {
    o = o || {};
    var cols = strokeColumns(mask, din);
    if (o.territories !== false) {
      // skeleton noise at crossings leaves tiny columns; let their neighbours' territories absorb them
      var keepCols = cols.filter(function (c) {
        if (c.cycle) return true;
        var L = polyLen(c.pts), w = 0, nS = 0;
        c.pts.forEach(function (q) { var d = sampleD(din, q[0], q[1]); if (d > 0) { w += d; nS++; } });
        w = nS ? 2 * w / nS : 0;
        return L >= Math.max(8, w * 1.2);
      });
      if (keepCols.length) cols = keepCols;
    }
    var terr = o.territories === false ? null : territories(mask, cols);
    var raw = columnSatin(mask, din, cols, o.splitMM || 7, o.spacingMM, o.pullMM, terr);
    var chords = resolveOverlaps(raw, 18, !!terr);
    var keptSet = new Set(chords);
    LAST = { cols: cols, raw: raw.length, dropped: raw.length - chords.length, terr: terr, droppedChords: raw.filter(function (c) { return !keptSet.has(c); }) };
    var holes = fillHoles(mask, din, chords, seed);
    LAST.holes = holes;
    chords.columns = cols.length; chords.holes = holes;
    // centrelines for underlay, kept at least 0.5 mm inside the letter, split where they leave it
    chords.cols = [];
    cols.forEach(function (c, ci) {
      var seg = [];
      c.pts.forEach(function (p) {
        if (sampleD(din, p[0], p[1]) > 5) seg.push([p[0] / PX, p[1] / PX]);
        else { if (seg.length > 1) { seg.ci = ci; chords.cols.push(seg); } seg = []; }
      });
      if (seg.length > 1) { seg.ci = ci; chords.cols.push(seg); }
    });
    return chords;
  }

  // ---------- Per-island coverage check with single-direction fallback ----------

  // 4-connected components of the mask ("islands" of one colour).
  function islands(mask) {
    var lab = new Int32Array(W * H).fill(-1), list = [];
    for (var i = 0; i < W * H; i++) {
      if (!mask[i] || lab[i] >= 0) continue;
      var id = list.length, stack = [i], n = 0, minX = W, maxX = 0, minY = H, maxY = 0;
      lab[i] = id;
      while (stack.length) {
        var p = stack.pop(), x = p % W, y = (p / W) | 0;
        n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0 && mask[p - 1] && lab[p - 1] < 0) { lab[p - 1] = id; stack.push(p - 1); }
        if (x < W - 1 && mask[p + 1] && lab[p + 1] < 0) { lab[p + 1] = id; stack.push(p + 1); }
        if (y > 0 && mask[p - W] && lab[p - W] < 0) { lab[p - W] = id; stack.push(p - W); }
        if (y < H - 1 && mask[p + W] && lab[p + W] < 0) { lab[p + W] = id; stack.push(p + W); }
      }
      list.push({ id: id, area: n, minX: minX, maxX: maxX, minY: minY, maxY: maxY });
    }
    return { lab: lab, list: list };
  }

  function coverageOf(chords) {
    var cov = new Uint8Array(W * H);
    chords.forEach(function (c) {
      var x0 = c[0] * PX, y0 = c[1] * PX, x1 = c[2] * PX, y1 = c[3] * PX;
      var len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len));
      for (var q = 0; q <= steps; q++) {
        var px = Math.round(x0 + (x1 - x0) * q / steps), py = Math.round(y0 + (y1 - y0) * q / steps);
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var xx = px + ox, yy = py + oy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) cov[yy * W + xx] = 1;
        }
      }
    });
    return cov;
  }

  // Single-direction fill for one island: parallel rows 0.4 mm apart, each row's runs
  // become stitches; runs over 7 mm are split with a staggered brick pattern.
  function parallelFill(lab, isl, angle, maxMM, gapMM, pullPx, src, colId) {
    var dx = Math.cos(angle), dy = Math.sin(angle), mx = -dy, my = dx, out = [], pcx = (pullPx || 0) / 2;
    src = src === undefined ? 3 : src; colId = colId === undefined ? -2 : colId;
    var corners = [[isl.minX, isl.minY], [isl.maxX, isl.minY], [isl.minX, isl.maxY], [isl.maxX, isl.maxY]];
    var m0 = Infinity, m1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    corners.forEach(function (c) {
      var pm = c[0] * mx + c[1] * my, pd = c[0] * dx + c[1] * dy;
      m0 = Math.min(m0, pm); m1 = Math.max(m1, pm); d0 = Math.min(d0, pd); d1 = Math.max(d1, pd);
    });
    var rowGap = (gapMM || 0.30) * PX, maxPx = maxMM * PX, piece = 5 * PX, row = 0;
    function inIsl(t, s) {
      var x = Math.round(mx * s + dx * t), y = Math.round(my * s + dy * t);
      return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === isl.id;
    }
    for (var s = m0 + rowGap / 2; s <= m1; s += rowGap, row++) {
      var runs = [], start = null;
      for (var t = d0 - 1; t <= d1 + 1; t += 0.5) {
        var on = inIsl(t, s);
        if (on && start === null) start = t;
        if (!on && start !== null) { runs.push([start, t - 0.5]); start = null; }
      }
      if (start !== null) runs.push([start, d1 + 1]);
      if (row % 2) runs.reverse();
      runs.forEach(function (rn) {
        var a = rn[0], b = rn[1];
        if (b - a < 4) return;
        if (pcx && b - a > 8) { a -= pcx; b += pcx; }
        if (row % 2) { var tmp = a; a = b; b = tmp; }
        var L = Math.abs(b - a), cuts = [0];
        if (L > maxPx) {
          var first = piece * ((row % 3) + 1) / 3;
          for (var cpos = first; cpos < L - 8; cpos += piece) cuts.push(cpos);
        }
        cuts.push(L);
        var sg = b > a ? 1 : -1;
        for (var k = 0; k < cuts.length - 1; k++) {
          var ta = a + sg * cuts[k], tb = a + sg * cuts[k + 1];
          out.push([(mx * s + dx * ta) / PX, (my * s + dy * ta) / PX, (mx * s + dx * tb) / PX, (my * s + dy * tb) / PX, src, colId]);
        }
      });
    }
    return out;
  }

  // Check each island's curved fill. Mode 'patch' (default): cover each bare spot with a small
  // single-direction patch steered by nearby stitches, and only if the island is still bare,
  // replace its fill with single-direction rows. Mode 'whole': go straight to rows. Mode 'off': report only.
  function guardIslands(mask, din, fill, opts) {
    var mode = opts.fillMode || (opts.noFallback ? 'off' : 'patch');
    var isl = islands(mask), lab = isl.lab;
    var keep = fill.slice(), patchCount = {};
    function bareMap(chords) {
      var cov = coverageOf(chords), bare = new Uint8Array(W * H);
      for (var i = 0; i < W * H; i++) if (mask[i] && din[i] > 3.5 && !cov[i]) bare[i] = 1;
      return bare;
    }
    function angleNear(cxp, cyp, rPx, I) {
      var cs = 0, ss = 0;
      keep.forEach(function (c) {
        var mx = (c[0] + c[2]) / 2 * PX, my = (c[1] + c[3]) / 2 * PX;
        if (I && lab[Math.round(my) * W + Math.round(mx)] !== I.id) return;
        if (rPx && Math.hypot(mx - cxp, my - cyp) > rPx) return;
        var th = Math.atan2(c[3] - c[1], c[2] - c[0]), L = Math.hypot(c[2] - c[0], c[3] - c[1]);
        cs += Math.cos(2 * th) * L; ss += Math.sin(2 * th) * L;
      });
      return Math.hypot(cs, ss) > 1e-6 ? 0.5 * Math.atan2(ss, cs) : null;
    }
    if (mode === 'patch') {
      var bare = bareMap(keep), seen = new Uint8Array(W * H), plab = new Int32Array(W * H).fill(-1), blobs = [];
      for (var i = 0; i < W * H; i++) {
        if (!bare[i] || seen[i]) continue;
        var stack = [i], px = [];
        seen[i] = 1;
        while (stack.length) {
          var p = stack.pop(); px.push(p);
          for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
            var q = p + oy * W + ox;
            if (q >= 0 && q < W * H && bare[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
          }
        }
        if (px.length < 4) continue; // under 0.04 mm2: invisible under a 0.46 mm thread
        var id = blobs.length, B = { id: id, minX: W, maxX: 0, minY: H, maxY: 0, sx: 0, sy: 0, n: px.length, isl: lab[px[0]] };
        px.forEach(function (pp) {
          var x = pp % W, y = (pp / W) | 0;
          B.sx += x; B.sy += y;
          for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) {
            var xx = x + dx, yy = y + dy, k = yy * W + xx;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H || !mask[k] || plab[k] >= 0) continue;
            plab[k] = id;
            if (xx < B.minX) B.minX = xx; if (xx > B.maxX) B.maxX = xx;
            if (yy < B.minY) B.minY = yy; if (yy > B.maxY) B.maxY = yy;
          }
        });
        blobs.push(B);
      }
      blobs.forEach(function (B) {
        var ang = angleNear(B.sx / B.n, B.sy / B.n, 25, null);
        if (ang === null) ang = Math.PI / 4;
        var rows = parallelFill(plab, B, ang, 7, opts.tatamiSpacingMM || opts.spacingMM).map(function (c) { c[4] = 4; c[5] = -3; return c; });
        keep = keep.concat(rows);
        patchCount[B.isl] = (patchCount[B.isl] || 0) + 1;
      });
    }
    var cov = coverageOf(keep), report = [];
    isl.list.forEach(function (I) {
      if (I.area < 30) return;
      var interior = 0, bareN = 0;
      for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) {
        var ii = y * W + x;
        if (lab[ii] !== I.id || din[ii] <= 3.5) continue; // the outline covers the outer 0.35 mm
        interior++;
        if (!cov[ii]) bareN++;
      }
      var pct = interior ? bareN / interior : 0;
      var failed = mode !== 'off' && (pct > (opts.maxBare || 0.003) || bareN > 12);
      var entry = { cx: (I.minX + I.maxX) / 2 / PX, area: I.area / (PX * PX), bare: Math.round(pct * 1000) / 10,
        method: failed ? 'fallback' : (patchCount[I.id] ? 'patched' : 'curved'), patches: patchCount[I.id] || 0 };
      if (failed) {
        var ang = angleNear(0, 0, 0, I);
        if (ang === null) ang = Math.PI / 4;
        keep = keep.filter(function (c) {
          var mxp = Math.round((c[0] + c[2]) / 2 * PX), myp = Math.round((c[1] + c[3]) / 2 * PX);
          return !(mxp >= 0 && myp >= 0 && mxp < W && myp < H && lab[myp * W + mxp] === I.id);
        });
        keep = keep.concat(parallelFill(lab, I, ang, 7, opts.tatamiSpacingMM || opts.spacingMM));
        entry.angle = Math.round(ang * 180 / Math.PI);
      }
      report.push(entry);
    });
    report.sort(function (a, b) { return a.cx - b.cx; });
    var gaps = null;
    if (opts.debug) {
      var cov2 = coverageOf(keep);
      gaps = [];
      for (var g = 0; g < W * H; g++) if (mask[g] && din[g] > 3.5 && !cov2[g]) gaps.push([(g % W) / PX, ((g / W) | 0) / PX]);
    }
    return { fill: keep, report: report, gaps: gaps };
  }

  // Full design: red satin fill, navy satin outline on top.
  // Two canvases per size, used alternately (drawMask holds one while probeWord draws on the other).
  var canvasPool = {};
  function pooled(createCanvas) {
    return function (w, h) {
      var key = w + 'x' + h, slot = canvasPool[key];
      if (!slot) slot = canvasPool[key] = { list: [], next: 0 };
      if (slot.list.length < 2) { var c = createCanvas(w, h); slot.list.push(c); slot.next = slot.list.length % 2; return c; }
      var cv = slot.list[slot.next]; slot.next = 1 - slot.next;
      var cx2 = cv.getContext('2d'); cx2.setTransform(1, 0, 0, 1, 0, 0);
      return cv;
    };
  }

  // ======================================================================
  // Generic pipeline: ordered colour masks -> stitch parts, plus effects.
  // All masks share the module canvas (W x H at PX px/mm), y down.
  // ======================================================================

  var THREADS = [null, ["#000000", "Black", "002"], ["#ffffff", "White", "001"], ["#ffff17", "Yellow", "204"], ["#ff6600", "Orange", "203"], ["#2f5933", "Olive Green", "219"], ["#237336", "Green", "226"], ["#65c2c8", "Sky", "217"], ["#ab5a96", "Purple", "208"], ["#f669a0", "Pink", "201"], ["#ff0000", "Red", "225"], ["#b1704e", "Brown", "214"], ["#0b2f84", "Blue", "207"], ["#e4c35d", "Gold", "003"], ["#481a05", "Dark Brown", "205"], ["#ac9cc7", "Pale Violet", "209"], ["#fcf294", "Pale Yellow", "210"], ["#f999b7", "Pale Pink", "211"], ["#fab381", "Peach", "212"], ["#c9a480", "Beige", "213"], ["#970533", "Wine Red", "215"], ["#a0b8cc", "Pale Sky", "216"], ["#7fc21c", "Yellow Green", "218"], ["#e5e5e5", "Silver Gray", "220"], ["#889b9b", "Gray", "221"], ["#98d6bd", "Pale Aqua", "227"], ["#b2e1e3", "Baby Blue", "228"], ["#368ba0", "Powder Blue", "229"], ["#4f83ab", "Bright Blue", "230"], ["#386a91", "Slate Blue", "231"], ["#071650", "Navy Blue", "232"], ["#f999a2", "Salmon Pink", "233"], ["#f9676b", "Coral", "234"], ["#e3311f", "Burnt Orange", "235"], ["#e2a188", "Cinnamon", "236"], ["#b59474", "Umber", "237"], ["#e4cf99", "Blond", "238"], ["#ffcb00", "Sunflower", "239"], ["#e1add4", "Orchid Pink", "240"], ["#c3007e", "Peony Purple", "241"], ["#80004b", "Burgundy", "242"], ["#540571", "Royal Purple", "243"], ["#b10525", "Cardinal Red", "244"], ["#cae0c0", "Opal Green", "245"], ["#899856", "Moss Green", "246"], ["#5c941a", "Meadow Green", "247"], ["#003114", "Dark Green", "248"], ["#5dae94", "Aquamarine", "249"], ["#4cbf8f", "Emerald Green", "250"], ["#007772", "Peacock Green", "251"], ["#595b61", "Dark Gray", "252"], ["#fffff2", "Ivory White", "253"], ["#b15818", "Hazel", "254"], ["#cb8a07", "Toast", "255"], ["#986c80", "Salmon", "256"], ["#98692d", "Cocoa Brown", "257"], ["#4d3419", "Sienna", "258"], ["#4c330b", "Sepia", "259"], ["#33200a", "Dark Sepia", "260"], ["#523a97", "Violet Blue", "261"], ["#0d217e", "Blue Ink", "262"], ["#1e77ac", "Sola Blue", "263"], ["#b2dd53", "Green Dust", "264"], ["#f33689", "Crimson", "265"], ["#de649e", "Floral Pink", "266"], ["#984161", "Wine", "267"], ["#4c5612", "Olive Drab", "268"], ["#4c881f", "Meadow", "269"], ["#e4de79", "Mustard", "270"], ["#cb8a1a", "Yellow Ocher", "271"], ["#cba21c", "Old Gold", "272"], ["#ff9805", "Honey Dew", "273"], ["#fcb257", "Tangerine", "274"], ["#ffe505", "Canary Yellow", "275"], ["#f0331f", "Vermilion", "202"], ["#1a842d", "Bright Green", "206"], ["#386cae", "Ocean Blue", "222"], ["#e3c4b4", "Beige Gray", "223"], ["#e3ac81", "Bamboo", "224"]];   // Janome thread chart: [hex, name, code], index = JEF colour index

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
  function toLab(rgb) {
    var f = function (v) { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
    var r = f(rgb[0]), g = f(rgb[1]), b = f(rgb[2]);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    var h = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var fx = h(x), fy = h(y), fz = h(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  // CIEDE2000 colour difference
  function dE2000(l1, l2) {
    var rad = Math.PI / 180, L1 = l1[0], a1 = l1[1], b1 = l1[2], L2 = l2[0], a2 = l2[1], b2 = l2[2];
    var C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
    var G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
    var a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    var h1p = Math.atan2(b1, a1p) / rad; if (h1p < 0) h1p += 360;
    var h2p = Math.atan2(b2, a2p) / rad; if (h2p < 0) h2p += 360;
    var dLp = L2 - L1, dCp = C2p - C1p, dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
    var Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2, hbp = h1p + h2p;
    if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += hbp < 360 ? 360 : -360; hbp /= 2; }
    var T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
    var dTh = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2)), Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
    var Sl = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
    var Rt = -Math.sin(2 * dTh * rad) * Rc;
    return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
  }
  var THREAD_LAB = null;
  function nearestThread(hex, exclude) {
    if (!THREAD_LAB) THREAD_LAB = THREADS.map(function (t) { return t ? toLab(hexToRgb(t[0])) : null; });
    var c = toLab(hexToRgb(hex)), best = 1, bd = Infinity;
    for (var i = 1; i < THREADS.length; i++) {
      if (i === exclude) continue;
      var d = dE2000(c, THREAD_LAB[i]);
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
  // the SVG's own colours in paint order: fills and strokes (a line drawing is all strokes), as hex, named or rgb()
  var NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', navy: '#000080', gray: '#808080', grey: '#808080',
    darkgray: '#a9a9a9', darkgrey: '#a9a9a9', dimgray: '#696969', dimgrey: '#696969', silver: '#c0c0c0', maroon: '#800000', brown: '#a52a2a', orange: '#ffa500',
    yellow: '#ffff00', purple: '#800080', teal: '#008080', olive: '#808000', gold: '#ffd700', pink: '#ffc0cb', darkred: '#8b0000', darkgreen: '#006400', darkblue: '#00008b' };
  function parseSvgPalette(svg) {
    var out = [], seen = {};
    var re = /(?:fill|stroke)\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)/g, m;
    while ((m = re.exec(svg))) {
      var v = m[1], h = null;
      if (v[0] === '#') h = rgbToHex(hexToRgb(v));
      else if (/^rgb/i.test(v)) { var n = v.match(/\d+/g).map(Number); h = rgbToHex(n); }
      else if (NAMED[v.toLowerCase()]) h = NAMED[v.toLowerCase()];
      if (h && !seen[h]) { seen[h] = 1; out.push(h); }
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
  function tatami(inside, bbox, angle, spacingMM, stitchMM, src, pullPx) {
    var dx = Math.cos(angle), dy = Math.sin(angle), mx = -dy, my = dx, out = [];
    var m0 = Infinity, m1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    [[bbox.minX, bbox.minY], [bbox.maxX, bbox.minY], [bbox.minX, bbox.maxY], [bbox.maxX, bbox.maxY]].forEach(function (c) {
      var pm = c[0] * mx + c[1] * my, pd = c[0] * dx + c[1] * dy;
      m0 = Math.min(m0, pm); m1 = Math.max(m1, pm); d0 = Math.min(d0, pd); d1 = Math.max(d1, pd);
    });
    var gap = spacingMM * PX, piece = stitchMM * PX, OFF = [0, 0.5, 0.25, 0.75];
    function at(t, s) { return inside(Math.round(mx * s + dx * t), Math.round(my * s + dy * t)); }
    // 1. every row's runs (stretches inside the shape)
    var rows = [];
    for (var s = m0 + gap / 2, ri = 0; s <= m1; s += gap, ri++) {
      var runs = [], start = null;
      for (var t = d0 - 1; t <= d1 + 1; t += 0.5) {
        var on = at(t, s);
        if (on && start === null) start = t;
        if (!on && start !== null) { runs.push([start, t - 0.5]); start = null; }
      }
      if (start !== null) runs.push([start, d1 + 1]);
      rows.push({ s: s, i: ri, runs: runs.filter(function (rn) { return rn[1] - rn[0] >= 4; }) });
    }
    // 2. split the shape into regions where each row has exactly one run (boustrophedon cells), so each region
    // sews as one unbroken back-and-forth zigzag instead of hopping across the letter on every row
    function overlaps(a, b) { return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 2; }
    var regions = [], open = [];
    rows.forEach(function (R) {
      var next = [];
      R.runs.forEach(function (rn) {
        var ups = open.filter(function (o) { return overlaps(o.run, rn); }), reg = null;
        if (ups.length === 1 && R.runs.filter(function (r2) { return overlaps(ups[0].run, r2); }).length === 1) reg = ups[0].reg;
        if (!reg) { reg = []; regions.push(reg); }
        reg.push({ s: R.s, i: R.i, run: rn });
        next.push({ reg: reg, run: rn });
      });
      open = next;
    });
    // 3. sew regions nearest-first, each entered from whichever of its four corners is closest
    function pt(s, t) { return [mx * s + dx * t, my * s + dy * t]; }
    function emitRow(r, fwd) {
      var rn = pullPx ? [r.run[0] - pullPx / 2, r.run[1] + pullPx / 2] : r.run; // fabric pulls rows in: start and end them a little wide
      var off = OFF[r.i % 4] * piece, cuts = [rn[0]];
      var k0 = Math.ceil((rn[0] - d0 - off) / piece);
      for (var k = k0; ; k++) {
        var c = d0 + off + k * piece;
        if (c >= rn[1] - 0.35 * piece) break;
        if (c > rn[0] + 0.35 * piece) cuts.push(c);
      }
      cuts.push(rn[1]);
      if (!fwd) cuts.reverse();
      for (var q = 0; q < cuts.length - 1; q++) {
        var a = pt(r.s, cuts[q]), b = pt(r.s, cuts[q + 1]);
        out.push([a[0] / PX, a[1] / PX, b[0] / PX, b[1] / PX, src, -4]);
      }
    }
    var pos = null, left = regions.slice();
    while (left.length) {
      var best = null;
      left.forEach(function (reg, k) {
        var f = reg[0], l = reg[reg.length - 1];
        [[f, 0, true], [f, 1, false], [l, 0, true], [l, 1, false]].forEach(function (o, oi) {
          // nearest entry, but strongly prefer moving right: islands are sewn left to right and should end on their right
          var p0 = pt(o[0].s, o[0].run[o[1]]), d = pos ? Math.hypot(p0[0] - pos[0], p0[1] - pos[1]) + 4 * Math.max(0, pos[0] - p0[0]) : p0[0];
          if (!best || d < best.d) best = { d: d, k: k, fromEnd: oi >= 2, fwd: o[2] };
        });
      });
      var reg = left.splice(best.k, 1)[0], seqRows = best.fromEnd ? reg.slice().reverse() : reg, fwd = best.fwd;
      seqRows.forEach(function (r) { emitRow(r, fwd); fwd = !fwd; });
      var lastR = seqRows[seqRows.length - 1];
      pos = pt(lastR.s, lastR.run[fwd ? 0 : 1]);
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
    var narrow = newMask(), wides = [], fixed = [];
    var WIDE = (opts.satinMaxMM || 7) / 2 * PX;
    // user-set directions: the island under each point is sewn at that angle
    (opts.dirs || []).forEach(function (d) {
      var x = Math.round(d.x), y = Math.round(d.y), id = -1, best = 1e9;
      // a press right at an edge may sit just outside the shape: take the nearest pixel of this colour within 1.2 mm
      for (var r = 0; r <= 12 && id < 0; r += 2) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
        var xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || lab[yy * W + xx] < 0) continue;
        var dd = ox * ox + oy * oy; if (dd < best) { best = dd; id = lab[yy * W + xx]; }
      }
      if (id >= 0) { isl.list[id].dirAngle = d.angle; d.hit = id; }
    });
    isl.list.forEach(function (I) {
      var deep = 0, dmax = 0;
      for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) {
        var i = y * W + x;
        if (lab[i] !== I.id) continue;
        if (din[i] > WIDE) deep++;
        if (din[i] > dmax) dmax = din[i];
      }
      I.wide = I.area > 600 && deep / I.area > 0.12;
      // compact blobs (eyes, dots, short dashes) satin better at one fixed angle across their short axis than
      // along a skeleton, which for a blob is a short, branchy line
      I.blob = !I.wide && I.area > 120 && dmax > 6 && I.area / (Math.PI * dmax * dmax) < 2.4;
      if (opts.satinFill === false) wides.push(I);
      else if (I.dirAngle !== undefined) (I.wide ? wides : fixed).push(I);
      else if (I.wide) wides.push(I);
      else if (I.blob && opts.blobFixed !== false) fixed.push(I);
      else for (var y2 = I.minY; y2 <= I.maxY; y2++) for (var x2 = I.minX; x2 <= I.maxX; x2++) if (lab[y2 * W + x2] === I.id) narrow[y2 * W + x2] = 1;
    });
    var chords = [], under = [], report = [];
    if (countOn(narrow) > 0) {
      var curved = strokeFill(narrow, din, opts.seed || 7, { spacingMM: opts.satinSpacingMM || opts.spacingMM, pullMM: opts.pullCompMM, splitMM: opts.splitMM, territories: opts.territories });
      var guard = guardIslands(narrow, din, curved, opts);
      chords = guard.fill;
      under = satinUnderlay(chords, curved.cols, opts.underlay || 'center');
      report = guard.report.slice();
    }
    var spacing = opts.tatamiSpacingMM || opts.spacingMM || 0.30, umode = opts.underlay || 'center';
    var ulGap = umode === 'none' ? 0 : umode === 'zigzag' ? 1.3 : umode === 'edge' ? 1.8 : 2.5;
    // does the hop from one underlay row to the next stay inside the island? (else it would show on the fabric)
    function segIn(I, a, c) {
      var n = Math.max(2, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) * PX));
      for (var q = 0; q <= n; q++) {
        var x = Math.round((a[0] + (c[0] - a[0]) * q / n) * PX), y = Math.round((a[1] + (c[1] - a[1]) * q / n) * PX);
        if (x < 0 || y < 0 || x >= W || y >= H || lab[y * W + x] !== I.id) return false;
      }
      return true;
    }
    function ulRows(I, ang, gap) {
      var inner = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === I.id && din[y * W + x] > 6; };
      var ul = gap ? tatami(inner, I, ang + Math.PI / 2, gap, 3.5, 5) : [], poly = [];
      ul.forEach(function (c) {
        if (poly.length && (Math.hypot(poly[poly.length - 1][0] - c[0], poly[poly.length - 1][1] - c[1]) > 3 || !segIn(I, poly[poly.length - 1], c))) { under.push(poly); poly = []; }
        if (!poly.length) poly.push([c[0], c[1]]);
        poly.push([c[2], c[3]]);
      });
      if (poly.length > 1) under.push(poly);
    }
    fixed.forEach(function (I) {
      var auto = I.dirAngle === undefined, ang = auto ? principalAngle(lab, I) + Math.PI / 2 : I.dirAngle;
      ulRows(I, ang, ulGap ? Math.max(ulGap, 1.6) : 0);
      chords = chords.concat(parallelFill(lab, I, ang, opts.splitMM || 7, opts.satinSpacingMM || opts.spacingMM || 0.27, (opts.pullCompMM || 0) * PX, 7, -5));
      report.push({ cx: (I.minX + I.maxX) / 2 / PX, area: I.area / (PX * PX), bare: 0, method: auto ? 'satin-fixed' : 'satin-set', angle: Math.round(ang * 180 / Math.PI), patches: 0 });
    });
    wides.forEach(function (I) {
      var ang = I.dirAngle !== undefined ? I.dirAngle : (opts.tatamiAngle !== undefined && opts.tatamiAngle !== null) ? opts.tatamiAngle : principalAngle(lab, I) + (I.wide ? Math.PI / 4 : Math.PI / 2); // strokes and blobs: rows across them, like satin, so mirrored shapes sew mirrored
      var inner = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === I.id && din[y * W + x] > 6; };
      var full = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === I.id; };
      // underlay: sparse rows across the top rows, kept 0.6 mm inside the edge
      var ul = ulGap ? tatami(inner, I, ang + Math.PI / 2, ulGap, 3.5, 5) : [];
      var poly = [];
      ul.forEach(function (c) {
        if (poly.length && (Math.hypot(poly[poly.length - 1][0] - c[0], poly[poly.length - 1][1] - c[1]) > 3 || !segIn(I, poly[poly.length - 1], c))) { under.push(poly); poly = []; }
        if (!poly.length) poly.push([c[0], c[1]]);
        poly.push([c[2], c[3]]);
      });
      if (poly.length > 1) under.push(poly);
      chords = chords.concat(tatami(full, I, ang, spacing, opts.tatamiStitchMM || 3.5, 6, (opts.pullCompMM || 0) * PX));
      report.push({ cx: (I.minX + I.maxX) / 2 / PX, area: I.area / (PX * PX), bare: 0, method: I.dirAngle !== undefined ? 'tatami-set' : 'tatami', angle: Math.round(ang * 180 / Math.PI), patches: 0 });
    });
    var gaps = 0;
    if (opts.debug) {
      var cov = coverageOf(chords);
      for (var g = 0; g < W * H; g++) if (mask[g] && din[g] > 3.5 && !cov[g]) gaps++;
    }
    // tag every stitch with its island (chord[7]) so the sewing order can go island by island, left to right
    function islandAt(px, py) {
      var x = Math.round(px * PX), y = Math.round(py * PX);
      for (var r = 0; r <= 6; r++) for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
        var xx = x + ox, yy = y + oy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && lab[yy * W + xx] >= 0) return lab[yy * W + xx];
      }
      return -1;
    }
    chords.forEach(function (c) {
      while (c.length < 7) c.push(c.length === 6 ? 1 : -1);
      c[7] = islandAt((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
    });
    var underIsl = under.map(function (pl) { var m = pl[Math.floor(pl.length / 2)] || pl[0]; return m ? islandAt(m[0], m[1]) : -1; });
    return { chords: chords, under: under, underIsl: underIsl, report: report, din: din, gaps: gaps };
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

  var LASTNEAR = null;
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
    // line-art check on the sharp picture: how much of the dark ink lies in strokes too thin to fill
    var inkInfo = spec.noHint ? null : (function () {
      var lum = new Float32Array(W * H), vals = [], chroma = 0, nc = 0;
      for (var q = 0; q < W * H; q++) {
        var a = d[q * 4 + 3] / 255; lum[q] = a * (0.299 * d[q * 4] + 0.587 * d[q * 4 + 1] + 0.114 * d[q * 4 + 2]) + (1 - a) * 255;
        if ((q & 7) === 0) { vals.push(lum[q]); if (a > 0.5) { chroma += Math.max(d[q * 4], d[q * 4 + 1], d[q * 4 + 2]) - Math.min(d[q * 4], d[q * 4 + 1], d[q * 4 + 2]); nc++; } }
      }
      vals.sort(function (a, b) { return a - b; });
      var paperL = vals[Math.floor(vals.length * 0.9)] || 255, m = new Uint8Array(W * H), n = 0, sat = 0, ns = 0;
      for (var q2 = 0; q2 < W * H; q2++) if (lum[q2] < 0.55 * paperL) { m[q2] = 1; n++; if ((q2 & 15) === 0) { sat += Math.max(d[q2 * 4], d[q2 * 4 + 1], d[q2 * 4 + 2]) - Math.min(d[q2 * 4], d[q2 * 4 + 1], d[q2 * 4 + 2]); ns++; } }
      var dA = edt(m, false), ridge = 0, thin = 0, inPic = 0;
      for (var q3 = 0; q3 < W * H; q3++) if (d[q3 * 4 + 3] > 128) inPic++;
      for (var hy = 1; hy < H - 1; hy++) for (var hx = 1; hx < W - 1; hx++) {
        var hp = hy * W + hx, v0 = dA[hp]; if (!v0) continue;
        if (v0 >= dA[hp - 1] && v0 >= dA[hp + 1] && v0 >= dA[hp - W] && v0 >= dA[hp + W]) { ridge++; if (v0 <= 4.5) thin++; }
      }
      return { paper: paperL, thin: ridge ? thin / ridge : 0, share: inPic ? n / inPic : 0, sat: ns ? sat / ns : 0, chroma: nc ? chroma / nc : 0 };
    })();
    // palette
    var pal = (spec.palette || []).map(hexToRgb), autoPal = !pal.length, graphic = !autoPal;
    // SVG artwork with a dozen-plus fills (coats of arms, detailed clipart): merge the closest pair of colours until
    // a sewable number of threads remains; pixels then take the remaining nearest colour (paint order is kept)
    var MAXT = spec.maxThreads || 12;
    while (pal.length > MAXT) {
      var bi = 0, bj = 1, bd = Infinity;
      for (var pi = 0; pi < pal.length; pi++) for (var pj = pi + 1; pj < pal.length; pj++) { var dd0 = colDist(pal[pi], pal[pj]); if (dd0 < bd) { bd = dd0; bi = pi; bj = pj; } }
      pal.splice(bj, 1);
    }
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
      var K = Math.max(1, Math.min(10, spec.maxColors || 6));
      pal = samples.length ? kmeans(samples.slice(0, 600), K, 8) : [];
      // Flat graphics (prints, logos, line art) sit within a short distance of a few inks; paintings and photos
      // don't. Graphics keep these crisp colours and are labelled sharp. For paintings, weight each colour bin by the
      // square root of its area, so a small but distinct accent (a blue bridge, a teal bow) can win a thread instead
      // of a third shade of the dominant brown, and smooth before labelling (below).
      var near = [0, 0, 0, 0], all = 0, TH = [30, 45, 60, 80];
      samples.forEach(function (sm) { var bd5 = Infinity; pal.forEach(function (c) { bd5 = Math.min(bd5, colDist(sm, c)); }); all += sm[3]; TH.forEach(function (t, ti) { if (bd5 < t) near[ti] += sm[3]; }); });
      LASTNEAR = near.map(function (v) { return all ? +(v / all).toFixed(3) : 0; });
      graphic = spec.graphic !== undefined ? !!spec.graphic : all > 0 && near[1] / all > 0.87;
      if (!graphic && samples.length) {
        // accent rescue: an area-weighted palette averages away a small but clearly different hue (Monet's blue
        // bridge, a teal bow). Find the worst-matched colour that still covers a real patch of the picture and swap
        // it in for the palette colour that costs least to lose, if the picture as a whole stays about as well matched.
        var errOf = function (P) { var e2 = 0; samples.forEach(function (sm) { var bd6 = Infinity; P.forEach(function (c) { bd6 = Math.min(bd6, colDist(sm, c)); }); e2 += sm[3] * Math.min(bd6, 120) * Math.min(bd6, 120); }); return e2; };
        var total = samples.reduce(function (a7, sm) { return a7 + sm[3]; }, 0);
        for (var acc = 0; acc < 2 && pal.length > 2; acc++) {
          // candidates: badly matched colours, scored by how much of the picture lies close to them
          var poor = samples.slice(0, 1500).filter(function (sm) { var bd7 = Infinity; pal.forEach(function (c) { bd7 = Math.min(bd7, colDist(sm, c)); }); sm.miss = bd7; return bd7 > 70; });
          var cand = null, cs = 0;
          poor.forEach(function (sm) { var mass = 0; poor.forEach(function (o) { if (colDist(o, sm) < 45) mass += o[3]; }); var sc = mass * sm.miss; if (sc > cs) { cs = sc; cand = sm; } });
          if (!cand) break;
          var cw = 0, cm = [0, 0, 0];
          samples.forEach(function (sm) { if (colDist(sm, cand) < 45) { cw += sm[3]; cm[0] += sm[0] * sm[3]; cm[1] += sm[1] * sm[3]; cm[2] += sm[2] * sm[3]; } });
          if (cw < 0.006 * total) break;
          var accent = [cm[0] / cw, cm[1] / cw, cm[2] / cw], base0 = errOf(pal), bestJ = -1, bestE = Infinity;
          for (var j7 = 0; j7 < pal.length; j7++) { if (pal[j7].accent) continue; var trial = pal.slice(); trial[j7] = accent; var e7 = errOf(trial); if (e7 < bestE) { bestE = e7; bestJ = j7; } }
          if (bestJ < 0 || bestE > base0 * 1.25) break;
          accent.accent = true; pal[bestJ] = accent;
        }
      }
      // merge near-duplicates
      var merged = [];
      pal.forEach(function (c2) { if (!merged.some(function (m) { return colDist(m, c2) < 40; })) merged.push(c2); });
      pal = merged;
    }
    // photos: the colours are chosen from the sharp picture (so a two-tone print stays two-tone), then each pixel is
    // labelled from a lightly blurred copy (box blur x2 ~ gaussian, edges clamped, alpha untouched), so brush texture
    // and grain don't break the colour areas into crumbs
    var blurPx = autoPal && !graphic ? Math.round((spec.blurMM === undefined ? 0.6 : spec.blurMM) * PX) : 0;
    if (blurPx > 0) {
      var tmp = new Float32Array(Math.max(dw, dh));
      for (var ch = 0; ch < 3; ch++) for (var bp = 0; bp < 2; bp++) {
        for (var ry = oy; ry < oy + dh; ry++) { // rows
          var acc = 0, row = ry * W;
          for (var rx = -blurPx; rx <= blurPx; rx++) acc += d[(row + ox + Math.min(dw - 1, Math.max(0, rx))) * 4 + ch];
          for (var rx2 = 0; rx2 < dw; rx2++) {
            tmp[rx2] = acc / (2 * blurPx + 1);
            acc += d[(row + ox + Math.min(dw - 1, rx2 + blurPx + 1)) * 4 + ch] - d[(row + ox + Math.max(0, rx2 - blurPx)) * 4 + ch];
          }
          for (rx2 = 0; rx2 < dw; rx2++) d[(row + ox + rx2) * 4 + ch] = tmp[rx2];
        }
        for (var cx2 = ox; cx2 < ox + dw; cx2++) { // columns
          var acc2 = 0;
          for (var cy = -blurPx; cy <= blurPx; cy++) acc2 += d[((oy + Math.min(dh - 1, Math.max(0, cy))) * W + cx2) * 4 + ch];
          for (var cy2 = 0; cy2 < dh; cy2++) {
            tmp[cy2] = acc2 / (2 * blurPx + 1);
            acc2 += d[((oy + Math.min(dh - 1, cy2 + blurPx + 1)) * W + cx2) * 4 + ch] - d[((oy + Math.max(0, cy2 - blurPx)) * W + cx2) * 4 + ch];
          }
          for (cy2 = 0; cy2 < dh; cy2++) d[((oy + cy2) * W + cx2) * 4 + ch] = tmp[cy2];
        }
      }
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
      var top = Math.max.apply(null, cnt), border = 2 * (dw + dh);
      // only a colour that clearly owns the border is background, and only where it reaches the border: the same
      // colour inside the picture (dark clothes in a dark painting) is part of the design
      // paper photographed under uneven light splits into two or three close shades: they count as one background
      var topI = cnt.indexOf(top), isBg = pal.map(function (c, k) { return k === topI || (cnt[k] >= 0.1 * border && colDist(c, pal[topI]) < 70); });
      var bgShare = cnt.reduce(function (a2, n, k) { return a2 + (isBg[k] ? n : 0); }, 0);
      if (bgShare >= 0.45 * border) {
        bgIndex = topI;
        var stk = [];
        var seed = function (q) { if (labels[q] >= 0 && isBg[labels[q]]) { labels[q] = -1; stk.push(q); } };
        for (var bx2 = ox; bx2 < ox + dw; bx2++) { seed(oy * W + bx2); seed((oy + dh - 1) * W + bx2); }
        for (var by2 = oy; by2 < oy + dh; by2++) { seed(by2 * W + ox); seed(by2 * W + ox + dw - 1); }
        while (stk.length) {
          var v0 = stk.pop(), vx0 = v0 % W;
          if (vx0 > 0) seed(v0 - 1); if (vx0 < W - 1) seed(v0 + 1); if (v0 >= W) seed(v0 - W); if (v0 < W * (H - 1)) seed(v0 + W);
        }
        // flat art (a print, a logo on paper): the paper inside closed shapes is paper too
        if (graphic) for (var r6 = 0; r6 < W * H; r6++) if (labels[r6] >= 0 && isBg[labels[r6]]) labels[r6] = -1;
      }
    }
    // Posterized photos are full of filaments thinner than a fill can show (they stitch as one to three stray rows,
    // each costing a jump and a trim). Fold anything narrower than minWidth into its neighbours: an opening per colour.
    if (!spec.palette && !graphic && spec.smooth !== false) {
      var R0 = Math.max(1, Math.round((spec.minWidthMM || 0.9) / 2 * PX)), thin = new Uint8Array(W * H), anyThin = false;
      for (var a3 = 0; a3 < pal.length; a3++) {
        var m3 = newMask(), has3 = false;
        for (var z3 = 0; z3 < W * H; z3++) if (labels[z3] === a3) { m3[z3] = 1; has3 = true; }
        if (!has3) continue;
        var d3 = edt(m3, false), core = newMask();
        for (z3 = 0; z3 < W * H; z3++) if (d3[z3] > R0) core[z3] = 1;
        var opened = dilateMask(core, R0 + 0.5);
        for (z3 = 0; z3 < W * H; z3++) if (m3[z3] && !opened[z3]) { thin[z3] = 1; anyThin = true; }
      }
      // grow the surrounding colours into the removed filaments (several passes, majority of labelled neighbours)
      for (var pass3 = 0; anyThin && pass3 < 3 * R0 + 4; pass3++) {
        var moved = false, next = labels.slice();
        for (var z4 = 0; z4 < W * H; z4++) {
          if (!thin[z4]) continue;
          var t4 = {}, b4 = null, n4 = 0, x4 = z4 % W;
          for (var k4 = 0; k4 < 8; k4++) {
            var u4 = z4 + [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1][k4];
            if (u4 < 0 || u4 >= W * H || thin[u4]) continue;
            if ((x4 === 0 && (k4 === 0 || k4 === 4 || k4 === 6)) || (x4 === W - 1 && (k4 === 1 || k4 === 5 || k4 === 7))) continue;
            var l4 = labels[u4]; t4[l4] = (t4[l4] || 0) + 1;
            if (t4[l4] > n4) { n4 = t4[l4]; b4 = l4; }
          }
          if (b4 !== null) { next[z4] = b4; thin[z4] = 0; moved = true; }
        }
        labels = next;
        if (!moved) break;
      }
    }
    // absorb specks smaller than minArea into their most common neighbour label
    var minArea = Math.round((spec.minAreaMM2 || (graphic ? 0.8 : 2)) * PX * PX); // paintings: bigger specks fold in
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
    // auto-detected palettes pick up blend colours along anti-aliased edges; a colour that only
    // ever forms thin rims (never deeper than 0.5 mm) is an artefact, so fold it into its neighbours
    if (!spec.palette) {
      for (var a = 0; a < pal.length; a++) {
        var am = newMask(), any = false;
        for (var z0 = 0; z0 < W * H; z0++) if (labels[z0] === a) { am[z0] = 1; any = true; }
        if (!any) continue;
        var ad = edt(am, false), deep = 0;
        for (var z1 = 0; z1 < W * H; z1++) if (ad[z1] > 0.5 * PX) { deep = 1; break; }
        if (deep) continue;
        for (var pass2 = 0; pass2 < 8; pass2++) {
          var changed = false;
          for (var z2 = 0; z2 < W * H; z2++) {
            if (labels[z2] !== a) continue;
            var tally = {}, bestL = null, bestN = 0, zx = z2 % W;
            [z2 - 1, z2 + 1, z2 - W, z2 + W, z2 - W - 1, z2 - W + 1, z2 + W - 1, z2 + W + 1].forEach(function (u, ui) {
              if (u < 0 || u >= W * H) return;
              if ((zx === 0 && (ui === 0 || ui === 4 || ui === 6)) || (zx === W - 1 && (ui === 1 || ui === 5 || ui === 7))) return;
              var lu = labels[u]; if (lu === a) return;
              tally[lu] = (tally[lu] || 0) + 1;
              if (tally[lu] > bestN) { bestN = tally[lu]; bestL = lu; }
            });
            if (bestL !== null) { labels[z2] = +bestL; changed = true; }
          }
          if (!changed) break;
        }
      }
    }
    var colours = [];
    pal.forEach(function (c3, idx) {
      var m = newMask(), n = 0;
      for (var z = 0; z < W * H; z++) if (labels[z] === idx) { m[z] = 1; n++; }
      if (n < minArea) return;
      colours.push({ role: 'colour', color: rgbToHex(c3), mask: m, area: n });
    });
    // a photo's colours sit side by side, not on top of each other, so their order is free: the most broken-up
    // colour sews first, because its travel runs can hide under every colour that follows
    if (!spec.palette) {
      colours.forEach(function (c) {
        var seen = new Uint8Array(W * H), n = 0, st = [];
        for (var i = 0; i < W * H; i++) {
          if (!c.mask[i] || seen[i]) continue;
          n++; seen[i] = 1; st.push(i);
          while (st.length) {
            var v = st.pop(), vx = v % W;
            if (vx > 0 && c.mask[v - 1] && !seen[v - 1]) { seen[v - 1] = 1; st.push(v - 1); }
            if (vx < W - 1 && c.mask[v + 1] && !seen[v + 1]) { seen[v + 1] = 1; st.push(v + 1); }
            if (v >= W && c.mask[v - W] && !seen[v - W]) { seen[v - W] = 1; st.push(v - W); }
            if (v < W * (H - 1) && c.mask[v + W] && !seen[v + W]) { seen[v + W] = 1; st.push(v + W); }
          }
        }
        c.pieces = n;
      });
      colours.sort(function (a, b) { return b.pieces - a.pieces || b.area - a.area; });
    }
    return { colours: colours, bgRemoved: bgIndex >= 0 ? rgbToHex(pal[bgIndex]) : null, painting: autoPal && !graphic, near: LASTNEAR, ink: inkInfo };
  }

  // ---------- line art: engravings, ink drawings, woodcuts ----------
  // One thread, the ink colour. Thin ink lines are traced along their centre and sewn as running stitch (a triple
  // "bean" stitch for bold lines), each connected network in one go where retracing a short stretch saves a jump.
  // Shading hatched too finely to trace becomes running-stitch hatching at a sewable spacing, with the original's
  // tone and direction. Solid black areas are filled like any other shape.
  function boxBlurGrid(a, w, h, r) {
    var b = new Float32Array(w * h), o = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0, n = 0;
      for (var k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++; } }
      b[y * w + x] = s / n;
    }
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) {
      var s2 = 0, n2 = 0;
      for (var k2 = -r; k2 <= r; k2++) { var yy = y2 + k2; if (yy >= 0 && yy < h) { s2 += b[yy * w + x2]; n2++; } }
      o[y2 * w + x2] = s2 / n2;
    }
    return o;
  }
  // the paper's brightness around each pixel (local maximum, smoothed), so yellowed or unevenly lit paper isn't ink
  function paperLevel(grey) {
    var B = 4, w = Math.ceil(W / B), h = Math.ceil(H / B), m = new Float32Array(w * h);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var k = ((y / B) | 0) * w + ((x / B) | 0); if (grey[y * W + x] > m[k]) m[k] = grey[y * W + x]; }
    var R = Math.round(5 * PX / B), t = new Float32Array(w * h), u = new Float32Array(w * h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var mx = 0; for (var q = Math.max(0, i - R); q <= Math.min(w - 1, i + R); q++) if (m[j * w + q] > mx) mx = m[j * w + q]; t[j * w + i] = mx; }
    for (var i2 = 0; i2 < w; i2++) for (var j2 = 0; j2 < h; j2++) { var my = 0; for (var q2 = Math.max(0, j2 - R); q2 <= Math.min(h - 1, j2 + R); q2++) if (t[q2 * w + i2] > my) my = t[q2 * w + i2]; u[j2 * w + i2] = my; }
    var sm = boxBlurGrid(boxBlurGrid(u, w, h, 3), w, h, 3);
    // a big black area must not become its own "paper": never darker than most of the page's paper
    var sorted = Array.prototype.slice.call(m).sort(function (a, b) { return a - b; }), p90 = sorted[Math.floor(sorted.length * 0.9)] || 255;
    var out = new Float32Array(W * H);
    for (var y3 = 0; y3 < H; y3++) for (var x3 = 0; x3 < W; x3++) {
      var fx = Math.min(w - 1.001, Math.max(0, x3 / B - 0.5)), fy = Math.min(h - 1.001, Math.max(0, y3 / B - 0.5)), x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
      var x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      var v = (sm[y0 * w + x0] * (1 - ax) + sm[y0 * w + x1] * ax) * (1 - ay) + (sm[y1 * w + x0] * (1 - ax) + sm[y1 * w + x1] * ax) * ay;
      out[y3 * W + x3] = Math.max(v, 0.85 * p90);
    }
    return out;
  }
  // polyline (mm) -> needle points: simplified, then split so no stitch is longer than runMM, and none shorter than ~0.45 mm
  function simplifyDP(p, tol) {
    if (p.length < 3) return p.slice();
    var keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1;
    var st = [[0, p.length - 1]];
    while (st.length) {
      var s = st.pop(), a = p[s[0]], b = p[s[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9, bi = -1, bd = tol;
      for (var i = s[0] + 1; i < s[1]; i++) { var d = Math.abs((p[i][0] - a[0]) * dy - (p[i][1] - a[1]) * dx) / L; if (L < 1e-6) d = Math.hypot(p[i][0] - a[0], p[i][1] - a[1]); if (d > bd) { bd = d; bi = i; } }
      if (bi > 0) { keep[bi] = 1; st.push([s[0], bi], [bi, s[1]]); }
    }
    return p.filter(function (q, i) { return keep[i]; });
  }
  function needlePoints(p, runMM) {
    var q = simplifyDP(p, 0.06), out = [q[0]];
    for (var i = 1; i < q.length; i++) {
      var a = out[out.length - 1], b = q[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.45 && i < q.length - 1) continue;
      var n = Math.max(1, Math.ceil(L / runMM - 0.15));
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    if (out.length > 2 && Math.hypot(out[out.length - 1][0] - out[out.length - 2][0], out[out.length - 1][1] - out[out.length - 2][1]) < 0.3) out.splice(out.length - 2, 1);
    return out;
  }

  var LASTLINE = null;
  function lineArt(createCanvas, spec, marginMM) {
    var src = spec.source, sw = src.width, sh = src.height;
    var sizePx = Math.max(5, spec.sizeMM || 60) * PX, sc = sizePx / Math.max(sw, sh);
    var dw = Math.max(1, Math.round(sw * sc)), dh = Math.max(1, Math.round(sh * sc)), mpx = Math.ceil(marginMM * PX);
    setMask(Math.ceil((dw + 2 * mpx) / 200) * 200, Math.ceil((dh + 2 * mpx) / 200) * 200);
    var cv = createCanvas(W, H), ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
    var d = ctx.getImageData(0, 0, W, H).data, N = W * H;
    var runMM = Math.max(1, Math.min(4, spec.runMM || 2)), thr = spec.inkLevel > 0 ? spec.inkLevel : 0.4;
    var weight = spec.lineWeight || 'auto', shading = spec.shading || 'hatch';

    // 1. darkness against the local paper (transparent = paper)
    var grey = new Float32Array(N);
    for (var i = 0; i < N; i++) { var al = d[i * 4 + 3] / 255; grey[i] = al * (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) + (1 - al) * 255; }
    var paper = paperLevel(grey), dk = new Float32Array(N), ink = newMask(), ir = 0, ig = 0, ib = 0, iw = 0;
    for (var i1 = 0; i1 < N; i1++) {
      var v = Math.max(0, Math.min(1, (paper[i1] - grey[i1]) / Math.max(60, paper[i1])));
      dk[i1] = v; if (v > thr) ink[i1] = 1;
      else if (v > thr * 0.55) ink[i1] = 2; // weak: kept only where it joins strong ink (faint stretches of a line)
      if (v > 0.55 && d[i1 * 4 + 3] > 128) { var wv = v * v; ir += d[i1 * 4] * wv; ig += d[i1 * 4 + 1] * wv; ib += d[i1 * 4 + 2] * wv; iw += wv; }
    }
    var hst = []; for (var h0 = 0; h0 < N; h0++) if (ink[h0] === 1) hst.push(h0);
    while (hst.length) {
      var hp = hst.pop(), hx = hp % W;
      var hn = [hx > 0 ? hp - 1 : -1, hx < W - 1 ? hp + 1 : -1, hp - W, hp + W];
      for (var hk = 0; hk < 4; hk++) { var hq = hn[hk]; if (hq >= 0 && hq < N && ink[hq] === 2) { ink[hq] = 1; hst.push(hq); } }
    }
    for (var h1 = 0; h1 < N; h1++) if (ink[h1] === 2) ink[h1] = 0;
    var inkColour = iw ? rgbToHex([ir / iw, ig / iw, ib / iw]) : '#1a1a1a';
    if (spec.palette && spec.palette.length) { // an SVG's darkest fill is its ink
      var darkest = spec.palette.slice().sort(function (a, b) { var A = hexToRgb(a), Bc = hexToRgb(b); return (A[0] + A[1] + A[2]) - (Bc[0] + Bc[1] + Bc[2]); })[0];
      if (darkest) inkColour = darkest;
    }
    // specks of dust and paper grain
    var isl0 = islands(ink);
    isl0.list.forEach(function (I) { if (I.area >= 12) return; for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) if (isl0.lab[y * W + x] === I.id) ink[y * W + x] = 0; });

    // 2. mass: ink that is wide once gaps under 0.4 mm are closed (solid black, or hatching too fine to trace)
    var closed = spec.closePx ? erodeMask(dilateMask(ink, spec.closePx), spec.closePx) : ink;
    var mass = dilateMask(erodeMask(closed, 5), 5);
    for (var i2 = 0; i2 < N; i2++) if (mass[i2] && !closed[i2]) mass[i2] = 0;
    var tone = blur(dk, 4, 2);
    // classes inside the mass: 3 solid, 2 crosshatch, 1 single hatch; smoothed so areas don't speckle
    var cls = new Uint8Array(N);
    for (var i3 = 0; i3 < N; i3++) if (mass[i3]) cls[i3] = tone[i3] > 0.72 ? 3 : tone[i3] > 0.55 ? 2 : 1;
    if (shading === 'solid') for (var i3b = 0; i3b < N; i3b++) if (mass[i3b]) cls[i3b] = 3;
    // majority vote per pixel (each class's share blurred over ~1.7 mm), one class at a time to keep memory low
    function majority(labels, ks, radius, where) {
      var bestV = new Float32Array(N), bestK = new Uint8Array(N), a = new Float32Array(N);
      ks.forEach(function (k) {
        for (var q = 0; q < N; q++) a[q] = labels[q] === k && where(q) ? 1 : 0;
        var bl = blur(a, radius, 1);
        for (var q2 = 0; q2 < N; q2++) if (bl[q2] > bestV[q2]) { bestV[q2] = bl[q2]; bestK[q2] = k; }
      });
      return bestK;
    }
    var anyMass = false; for (var i4a = 0; i4a < N; i4a++) if (mass[i4a]) { anyMass = true; break; }
    if (anyMass) { var vote = majority(cls, [1, 2, 3], 8, function () { return true; }); for (var i4 = 0; i4 < N; i4++) if (mass[i4] && vote[i4]) cls[i4] = vote[i4]; }
    // small blots are thick bits of line (where strokes meet or swell) or dots: filled solid if dark, else traced
    var mi = islands(mass);
    mi.list.forEach(function (I) {
      if (I.area >= (spec.massMinPx || 800)) return;
      var t = 0;
      for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) if (mi.lab[y * W + x] === I.id) t += tone[y * W + x];
      var dot = I.area >= 150 && t / I.area > 0.6;
      for (var y2 = I.minY; y2 <= I.maxY; y2++) for (var x2 = I.minX; x2 <= I.maxX; x2++) {
        var p2 = y2 * W + x2; if (mi.lab[p2] !== I.id) continue;
        if (dot) cls[p2] = 3; else { cls[p2] = 0; mass[p2] = 0; }
      }
    });
    // hatch direction: the structure tensor of the darkness says which way the original's strokes run
    var t0 = anyMass ? blur(dk, 1, 1) : dk, jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N);
    for (var y5 = 1; y5 < H - 1; y5++) for (var x5 = 1; x5 < W - 1; x5++) {
      var p5 = y5 * W + x5; if (!mass[p5]) continue;
      var gx = t0[p5 + 1] - t0[p5 - 1], gy = t0[p5 + W] - t0[p5 - W];
      jxx[p5] = gx * gx; jyy[p5] = gy * gy; jxy[p5] = gx * gy;
    }
    if (anyMass) { jxx = blur(jxx, 7, 2); jyy = blur(jyy, 7, 2); jxy = blur(jxy, 7, 2); }
    // split hatch areas by direction (6 bins of 30 degrees) so the stitching follows the form like the engraver's did
    var NB6 = 6, bin = new Uint8Array(N);
    for (var i6 = 0; i6 < N; i6++) if (cls[i6] && cls[i6] < 3) {
      var th = 0.5 * Math.atan2(2 * jxy[i6], jxx[i6] - jyy[i6]) + Math.PI / 2; // along the strokes
      th = ((th % Math.PI) + Math.PI) % Math.PI;
      bin[i6] = Math.round(th / (Math.PI / NB6)) % NB6;
    }
    if (anyMass) {
      var bins6 = []; for (var b6 = 0; b6 < NB6; b6++) bins6.push(b6);
      var hatchy = function (q) { return cls[q] && cls[q] < 3; }, bv = majority(bin, bins6, 10, hatchy);
      for (var i7 = 0; i7 < N; i7++) if (hatchy(i7)) bin[i7] = bv[i7];
    }

    var solid = newMask(), nSolid = 0;
    for (var i8 = 0; i8 < N; i8++) if (cls[i8] === 3) { solid[i8] = 1; nSolid++; }
    var gid = 0, hatch = [], hatchMask = newMask(), stats = { hatchAreas: 0, lines: 0, retraceMM: 0, beanMM: 0, runMM: 0 };
    // 3. hatching: per (class, direction) area, rows of running stitch; neighbouring row ends joined along the edge
    if (shading !== 'none' && shading !== 'solid') {
      var lab = new Int32Array(N).fill(-1), areas = [];
      for (var s0 = 0; s0 < N; s0++) {
        if (!cls[s0] || cls[s0] === 3 || lab[s0] >= 0) continue;
        var id = areas.length, key = cls[s0] * 8 + bin[s0], st = [s0], A = { id: id, cls: cls[s0], bin: bin[s0], area: 0, minX: W, maxX: 0, minY: H, maxY: 0, t: 0, xx: 0, yy: 0, xy: 0 };
        lab[s0] = id;
        while (st.length) {
          var p = st.pop(), px = p % W, py = (p / W) | 0;
          A.area++; A.t += tone[p]; A.xx += jxx[p]; A.yy += jyy[p]; A.xy += jxy[p];
          if (px < A.minX) A.minX = px; if (px > A.maxX) A.maxX = px; if (py < A.minY) A.minY = py; if (py > A.maxY) A.maxY = py;
          var nb = [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1];
          for (var z = 0; z < 4; z++) { var q = nb[z]; if (q >= 0 && lab[q] < 0 && cls[q] && cls[q] * 8 + bin[q] === key) { lab[q] = id; st.push(q); } }
        }
        areas.push(A);
      }
      // crumbs under 3 mm² join the neighbouring area they share the most border with: each would cost a jump
      var root = areas.map(function (A, k) { return k; });
      var find = function (k) { while (root[k] !== k) k = root[k] = root[root[k]]; return k; };
      areas.slice().sort(function (a, b) { return a.area - b.area; }).forEach(function (A) {
        if (A.area >= 300) return;
        var cnt = new Map(), me = find(A.id);
        for (var y = A.minY; y <= A.maxY; y++) for (var x = A.minX; x <= A.maxX; x++) {
          var p = y * W + x; if (lab[p] !== A.id) continue;
          var nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W];
          for (var z = 0; z < 4; z++) { var q = nb[z]; if (q < 0 || q >= N || lab[q] < 0) continue; var r = find(lab[q]); if (r !== me) cnt.set(r, (cnt.get(r) || 0) + 1); }
        }
        var best = -1, bc = 0; cnt.forEach(function (c, r) { if (c > bc) { bc = c; best = r; } });
        if (best < 0) return;
        var R = areas[best]; root[me] = best;
        R.area += A.area; R.t += A.t; R.xx += A.xx; R.yy += A.yy; R.xy += A.xy;
        R.minX = Math.min(R.minX, A.minX); R.maxX = Math.max(R.maxX, A.maxX); R.minY = Math.min(R.minY, A.minY); R.maxY = Math.max(R.maxY, A.maxY);
      });
      for (var r0 = 0; r0 < N; r0++) if (lab[r0] >= 0) { lab[r0] = find(lab[r0]); if (areas[lab[r0]].area >= 80) hatchMask[r0] = 1; }
      areas.forEach(function (A) {
        if (find(A.id) !== A.id || A.area < 80) return;
        var tm = A.t / A.area, ang = 0.5 * Math.atan2(2 * A.xy, A.xx - A.yy) + Math.PI / 2;
        var coh = Math.hypot(A.xx - A.yy, 2 * A.xy) / ((A.xx + A.yy) || 1);
        if (coh < 0.12) ang = (A.bin * Math.PI / NB6) || Math.PI / 4;
        var layers = A.cls === 2 ? [ang, ang + Math.PI / 2] : [ang];
        var spacing = Math.max(0.8, Math.min(2.6, 0.36 * layers.length / Math.max(0.12, tm)));
        var inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === A.id; };
        var near = function (xm, ym) { var x = Math.round(xm * PX), y = Math.round(ym * PX); for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) if (inside(x + ox, y + oy)) return true; return false; };
        stats.hatchAreas++;
        layers.forEach(function (a) {
          var rows = tatami(inside, A, a, spacing, runMM, 6), prev = null;
          rows.forEach(function (c) {
            if (prev && (Math.abs(prev[2] - c[0]) > 1e-6 || Math.abs(prev[3] - c[1]) > 1e-6)) {
              var g = Math.hypot(c[0] - prev[2], c[1] - prev[3]);
              if (g <= 1.7 * spacing + 0.4 && near((c[0] + prev[2]) / 2, (c[1] + prev[3]) / 2)) hatch.push([prev[2], prev[3], c[0], c[1], 6, -1, 0, gid]);
              else gid++;
            }
            hatch.push([c[0], c[1], c[2], c[3], 6, -1, 0, gid]); prev = c;
          });
          gid++;
        });
      });
    }

    // 4. lines: what's left of the ink, traced along its centre
    var grownMass = dilateMask(mass, 1), lineMask = newMask();
    for (var i9 = 0; i9 < N; i9++) if (ink[i9] && !grownMass[i9]) lineMask[i9] = 1;
    var isl1 = islands(lineMask);
    isl1.list.forEach(function (I) { if (I.area >= 10) return; for (var y = I.minY; y <= I.maxY; y++) for (var x = I.minX; x <= I.maxX; x++) if (isl1.lab[y * W + x] === I.id) lineMask[y * W + x] = 0; });
    var widthF = edt(lineMask, false), g = skeletonGraph(thin(lineMask)), cl = g.clusters;
    var br = g.branches.filter(function (b) { return b.pts.length > 1; });
    // prune spurs (short twigs the thinning grows toward corners) and lone specks
    for (var pass = 0; pass < 2; pass++) {
      var deg = cl.map(function () { return 0; });
      br.forEach(function (b) { if (b.a >= 0) deg[b.a]++; if (b.b >= 0) deg[b.b]++; });
      br = br.filter(function (b) {
        if (b.cycle) return b.len >= 6;
        var freeA = b.a < 0 || deg[b.a] === 1, freeB = b.b < 0 || deg[b.b] === 1;
        if (freeA && freeB) return b.len >= 8;
        if (!freeA && !freeB) return true;
        var j = freeA ? cl[b.b] : cl[b.a];
        return b.len >= Math.max(4, sampleD(widthF, j.x, j.y) * 1.5);
      });
    }
    // declutter: where lines crowd closer than a thread can keep apart, short strokes that mostly run alongside
    // another line add only clutter and jumps. Longest first, each stroke claims a band 0.6 mm either side.
    if (spec.declutter !== false) {
      var occ = new Uint8Array(N), R0 = 6, dropped = 0;
      br.slice().sort(function (a, b) { return b.len - a.len; }).forEach(function (b) {
        var n = 0, crowd = 0, ends = 8;
        if (b.len < 40) {
          var acc = 0;
          for (var k = 0; k < b.pts.length; k++) {
            if (k) acc += Math.hypot(b.pts[k][0] - b.pts[k - 1][0], b.pts[k][1] - b.pts[k - 1][1]);
            if (acc < ends || b.len - acc < ends) continue;
            n++; if (occ[Math.round(b.pts[k][1]) * W + Math.round(b.pts[k][0])]) crowd++;
          }
          if (n >= 3 && crowd / n > 0.6) { b.drop = true; dropped++; return; }
        }
        b.pts.forEach(function (q) {
          var qx = Math.round(q[0]), qy = Math.round(q[1]);
          for (var oy = -R0; oy <= R0; oy++) for (var ox = -R0; ox <= R0; ox++) {
            if (ox * ox + oy * oy > R0 * R0) continue;
            var xx = qx + ox, yy = qy + oy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) occ[yy * W + xx] = 1;
          }
        });
      });
      br = br.filter(function (b) { return !b.drop; });
      stats.decluttered = dropped;
    }
    // each branch: smoothed centreline in mm, needle points, and how bold the line is
    br.forEach(function (b) {
      var p = b.pts.length > 3 ? smoothOpen(resampleOpen(b.pts, 2), 2, 2) : b.pts;
      b.mm = needlePoints(p.map(function (q) { return [q[0] / PX, q[1] / PX]; }), runMM);
      var wsum = 0; b.pts.forEach(function (q) { wsum += sampleD(widthF, q[0], q[1]); });
      b.width = 2 * wsum / b.pts.length / PX;
      b.bold = weight === 'triple' || (weight === 'auto' && b.width >= 0.65);
    });
    // Euler routing: pair up dead ends that are close along the lines and retrace between them, so each network
    // sews in as few unbroken runs as possible (retracing a short stretch beats a jump and a trim)
    var edges = [], adj = cl.map(function () { return []; }), trails = [];
    br.forEach(function (b, bi) {
      if (b.cycle || b.a < 0 || b.b < 0) { trails.push([{ b: bi, rev: false }]); return; }
      var e = edges.length; edges.push({ u: b.a, v: b.b, b: bi, len: b.len }); adj[b.a].push(e); adj[b.b].push(e);
    });
    var odd = []; adj.forEach(function (l, n) { if (l.length % 2) odd.push(n); });
    var RETRACE = (spec.retraceMM || 6) * PX, pairs = [];
    odd.forEach(function (s) {
      var dist = new Map(), via = new Map(), heap = [[0, s]]; dist.set(s, 0);
      while (heap.length) {
        var bi = 0; for (var h = 1; h < heap.length; h++) if (heap[h][0] < heap[bi][0]) bi = h;
        var top = heap.splice(bi, 1)[0], du = top[0], u = top[1];
        if (du > dist.get(u)) continue;
        if (u !== s && adj[u].length % 2) pairs.push({ a: s, b: u, d: du, via: via, end: u });
        adj[u].forEach(function (e) {
          var E = edges[e], w = E.u === u ? E.v : E.u, nd = du + E.len;
          if (nd <= RETRACE && (!dist.has(w) || nd < dist.get(w))) { dist.set(w, nd); via.set(w, e); heap.push([nd, w]); }
        });
      }
    });
    pairs.sort(function (x, y) { return x.d - y.d; });
    var matched = new Uint8Array(cl.length), nOrig = edges.length;
    pairs.forEach(function (pr) {
      if (matched[pr.a] || matched[pr.b]) return;
      matched[pr.a] = matched[pr.b] = 1;
      for (var n = pr.end; n !== pr.a;) {
        var e = pr.via.get(n), E = edges[e], w = E.u === n ? E.v : E.u;
        var ne = edges.length; edges.push({ u: E.u, v: E.v, b: E.b, len: E.len, dup: true }); adj[E.u].push(ne); adj[E.v].push(ne);
        stats.retraceMM += E.len / PX; n = w;
      }
    });
    // what's still odd is joined by virtual edges (jumps), nearest first, so every network has an Euler circuit
    var still = []; adj.forEach(function (l, n) { if (l.length % 2) still.push(n); });
    var usedS = new Uint8Array(cl.length);
    still.forEach(function (a) {
      if (usedS[a]) return; usedS[a] = 1;
      var best = -1, bd = Infinity;
      still.forEach(function (b) { if (usedS[b]) return; var dd = Math.hypot(cl[a].x - cl[b].x, cl[a].y - cl[b].y); if (dd < bd) { bd = dd; best = b; } });
      if (best < 0) return; usedS[best] = 1;
      var ne = edges.length; edges.push({ u: a, v: best, b: -1, virtual: true }); adj[a].push(ne); adj[best].push(ne);
    });
    var used = new Uint8Array(edges.length), ptr = new Int32Array(cl.length);
    for (var sN = 0; sN < cl.length; sN++) {
      if (ptr[sN] >= adj[sN].length) continue;
      var stack = [{ n: sN, e: -1 }], circ = [];
      while (stack.length) {
        var top2 = stack[stack.length - 1], n2 = top2.n;
        while (ptr[n2] < adj[n2].length && used[adj[n2][ptr[n2]]]) ptr[n2]++;
        if (ptr[n2] < adj[n2].length) { var e2 = adj[n2][ptr[n2]]; used[e2] = 1; var E2 = edges[e2]; stack.push({ n: E2.u === n2 ? E2.v : E2.u, e: e2 }); }
        else circ.push(stack.pop());
      }
      circ.reverse(); // node sequence; circ[k].e = edge taken from circ[k-1] to circ[k]
      var steps = [];
      for (var k8 = 1; k8 < circ.length; k8++) steps.push({ from: circ[k8 - 1].n, to: circ[k8].n, e: circ[k8].e });
      var vk = -1; for (var k9 = 0; k9 < steps.length; k9++) if (edges[steps[k9].e].virtual) { vk = k9; break; }
      if (vk >= 0) steps = steps.slice(vk + 1).concat(steps.slice(0, vk + 1));
      var cur = [];
      steps.forEach(function (stp) {
        var E3 = edges[stp.e];
        if (E3.virtual) { if (cur.length) trails.push(cur); cur = []; return; }
        cur.push({ b: E3.b, rev: br[E3.b].a !== stp.from });
      });
      if (cur.length) trails.push(cur);
    }
    var lines = [], firstPass = new Uint8Array(br.length);
    var minTrail = spec.minRunMM === undefined ? 1.2 : spec.minRunMM;
    trails.forEach(function (tr) {
      var any = false, tl = 0;
      tr.forEach(function (seg) { tl += br[seg.b].len / PX; });
      if (tl < minTrail) { stats.dropped = (stats.dropped || 0) + 1; return; } // a tick shorter than two stitches isn't worth a jump
      tr.forEach(function (seg) {
        var b = br[seg.b], pts = seg.rev ? b.mm.slice().reverse() : b.mm, triple = b.bold && !firstPass[seg.b];
        firstPass[seg.b] = 1;
        for (var k = 1; k < pts.length; k++) {
          var a = pts[k - 1], c = pts[k], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (L < 1e-6) continue;
          lines.push([a[0], a[1], c[0], c[1], 6, -1, 0, gid]);
          if (triple) { lines.push([c[0], c[1], a[0], a[1], 6, -1, 0, gid], [a[0], a[1], c[0], c[1], 6, -1, 0, gid]); stats.beanMM += L; }
          stats.runMM += L; any = true;
        }
      });
      if (any) { gid++; stats.lines++; }
    });
    // the ink box and stitch coverage (for travel routing) include every kind of mark
    var all = newMask();
    for (var i10 = 0; i10 < N; i10++) if (ink[i10] || mass[i10]) all[i10] = 1;
    if (spec.debugLine) LASTLINE = { W: W, H: H, ink: ink, mass: mass, cls: cls, line: lineMask, br: br };
    return { colour: inkColour, ink: all, solid: nSolid > 60 ? solid : null, hatch: hatch, hatchMask: hatchMask, lines: lines, stats: stats };
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
    var colours = [], meta = {}, la = null;

    if (spec.kind === 'text') {
      var extra = 2 * (s1 + s2) + Math.abs(shDX);
      var target = spec.width ? Math.max(20, Math.min(190, spec.width)) : 0;
      var wordMM = target ? Math.max(10, target - extra) / 1.10 : 92;
      var mPx = Math.ceil(marginMM * PX);
      var maskAt = function (wmm) {
        setMask(Math.ceil(((wmm * 1.45 + 24) * PX + 2 * mPx) / 200) * 200, Math.ceil(((wmm * 0.95 + 26) * PX + 2 * mPx) / 200) * 200);
        return drawMask(cc, spec.family || 'sans-serif', spec.text || 'Text', spec.tail === undefined ? 'classic' : spec.tail, wmm, spec.weight, spec.tilt, spec.tailWeight);
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
    } else if (spec.lineArt) {
      la = lineArt(cc, spec, marginMM);
      if (spec.recolor && spec.recolor[0]) la.colour = spec.recolor[0];
      if (la.solid) colours.push({ role: 'colour', color: la.colour, mask: la.solid });
      meta.lineArt = la.stats; meta.painting = false;
    } else {
      var rc = rasterColours(cc, spec, marginMM);
      colours = rc.colours;
      meta.bgRemoved = rc.bgRemoved; meta.painting = !!rc.painting; meta.near = rc.near;
      // line art hint: light paper, and most of the dark ink in strokes thinner than a fill can show (under ~0.9 mm)
      if (rc.ink) {
        meta.thinInk = +rc.ink.thin.toFixed(3); meta.inkShare = +rc.ink.share.toFixed(3);
        meta.lineHint = rc.ink.paper > 170 && rc.ink.thin > 0.6 && rc.ink.share > 0.004 && rc.ink.share < 0.6 && (rc.painting ? rc.ink.sat < 40 && rc.ink.chroma < 30 : colours.length <= 4 || rc.ink.chroma < 30);
      }
      if (spec.recolor) colours.forEach(function (c4, i4) { if (spec.recolor[i4]) c4.color = spec.recolor[i4]; });
    }

    var S = la ? la.ink : unionMasks(colours.map(function (c5) { return c5.mask; }));
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
      splitMM: spec.splitMM, underlay: spec.underlay, territories: spec.territories, satinFill: spec.satinFill, tatamiAngle: spec.tatamiAngleDeg === undefined || spec.tatamiAngleDeg === null ? undefined : spec.tatamiAngleDeg * Math.PI / 180 };

    // user directions are stored in the frame of the artwork's ink (0..1 across its bounding box), so they
    // survive size and effect changes; each applies to one part (colour) and the island under its point
    var ink = { x0: W, y0: H, x1: -1, y1: -1 };
    for (var iy = 0; iy < H; iy++) for (var ix = 0; ix < W; ix++) if (S[iy * W + ix]) { if (ix < ink.x0) ink.x0 = ix; if (ix > ink.x1) ink.x1 = ix; if (iy < ink.y0) ink.y0 = iy; if (iy > ink.y1) ink.y1 = iy; }
    var dirsIn = (spec.dirs || []).map(function (d, k) {
      return { k: k, key: d.key, x: ink.x0 + d.u * (ink.x1 - ink.x0), y: ink.y0 + d.v * (ink.y1 - ink.y0), angle: -d.angle * Math.PI / 180, hit: -1 };
    });
    function partKey(role, color) { return role === 'colour' ? 'colour:' + color : role; }
    function fillPart(role, color, m, aoFn) {
      var key = partKey(role, color);
      fillOpts.dirs = dirsIn.filter(function (d) { return d.key === key; });
      var rf = regionFill(m, fillOpts);
      fillOpts.dirs.forEach(function (d) { if (d.hit >= 0) d.island = key + '#' + d.hit; });
      parts.push({ role: role, color: color, kind: 'fill', chords: rf.chords, under: rf.under, underIsl: rf.underIsl, report: rf.report, gapsPx: rf.gaps, ao: aoFn });
    }
    function outlinePart(role, color, m, width) {
      var ol = outlineSatin(m, 0.35 + (spec.pullCompMM || 0) / 4, Math.max(0.4, width - 0.35), Math.max(0.1, spec.strokeSpacingMM || (spec.satinSpacingMM || 0.27) * 0.75), edt(m, true));
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
    // line art: hatching, then the lines on top, in the same thread as any solid ink
    if (la) {
      if (la.hatch.length) parts.push({ role: 'colour', color: la.colour, kind: 'run', sub: 'hatch', chords: la.hatch, ao: function () { return 0.95; } });
      if (la.lines.length) parts.push({ role: 'colour', color: la.colour, kind: 'run', sub: 'lines', chords: la.lines, ao: function () { return 1; } });
    }
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
      if (p.sub) o.sub = p.sub;
      if (p.band !== undefined) o.band = p.band;
      o.chords = p.chords.map(function (c) {
        var mxm = (c[0] + c[2]) / 2, mym = (c[1] + c[3]) / 2;
        return [c[0] - cx, cy - c[1], c[2] - cx, cy - c[3], c[4] || 0, c[5] === undefined ? -1 : c[5], p.ao(mxm, mym), c[7] === undefined ? -1 : c[7]];
      });
      if (p.under) o.under = p.under.map(function (pl) { return pl.map(T); });
      if (p.underIsl && p.under && p.underIsl.length === p.under.length) o.underIsl = p.underIsl;
      if (p.loops) o.loops = p.loops.map(function (l) { return { pen: l.pen.map(T), under: l.under.map(T) }; });
      if (p.report) o.report = p.report;
      if (p.gapsPx !== undefined) o.gapsMM2 = p.gapsPx / (PX * PX);
      o.thread = nearestThread(p.color);
      o.key = p.role === 'colour' ? 'colour:' + p.color : p.role;
      return o;
    });
    // travel grids: a running stitch may only cross ground that this part or a later part will sew over.
    // Anything else (e.g. black eyes over a finished red face) becomes a jump instead of a visible line.
    var res = 0.4, gw = Math.ceil(W / PX / res), gh = Math.ceil(H / PX / res);
    function gridOf(cover) {
      var dc = edt(cover, false), g = new Uint8Array(gw * gh);
      for (var gj = 0; gj < gh; gj++) for (var gi = 0; gi < gw; gi++) {
        var gx = Math.round((gi + 0.5) * res * PX), gy = Math.round((gj + 0.5) * res * PX);
        g[gj * gw + gi] = (gx < W && gy < H && dc[gy * W + gx] > 1.5) ? 1 : 0;
      }
      return g;
    }
    var cum = newMask(), grids = [];
    for (var pk = parts.length - 1; pk >= 0; pk--) {
      // a running stitch is one thread wide: it hides nothing, so travel never counts on it
      var cv = parts[pk].kind === 'run' ? null : coverageOf(parts[pk].chords);
      if (cv) for (var q9 = 0; q9 < W * H; q9++) if (cv[q9]) cum[q9] = 1;
      grids[pk] = gridOf(cum);
    }
    var grid = grids.length ? grids[0] : gridOf(S2);
    // hatching may travel inside its own shaded areas (a stray line there reads as one more hatch stroke)
    if (la && la.hatch.length) grids = grids.map(function (g0, k) { return parts[k].sub === 'hatch' ? gridOf(dilateMask(la.hatchMask, 2)) : g0; });
    out.forEach(function (o, k) { o.inside = { res: res, x0: -cx, y1: cy, w: gw, h: gh, data: grids[k] }; });
    var stitchCount = out.reduce(function (a, p) { return a + p.chords.length; }, 0);
    var dbg = spec.debugMask ? { W: W, H: H, PX: PX, cx: cx, cy: cy, mask: Uint8Array.from(colours[0].mask), stats: LAST,
      cols: (LAST.cols || []).map(function (c) { return c.pts.map(function (q) { return [q[0] / PX - cx, cy - q[1] / PX]; }); }) } : undefined;
    return {
      debug: dbg,
      parts: out,
      size: { w: maxX - minX, h: maxY - minY },
      inside: { res: res, x0: -cx, y1: cy, w: gw, h: gh, data: grid },
      // the artwork's ink box (result mm, y up), for placing direction handles; and where each direction landed
      frame: { x0: ink.x0 / PX - cx, y1: cy - ink.y0 / PX, w: (ink.x1 - ink.x0) / PX, h: (ink.y1 - ink.y0) / PX },
      dirIslands: dirsIn.map(function (d) { return d.island || null; }),
      stitchCount: stitchCount,
      meta: meta,
      ms: Date.now() - t0
    };
  }
  return { lastLine: function () { return LASTLINE; }, renderLayer: renderLayer, parseSvgPalette: parseSvgPalette, nearestThread: nearestThread, nearestInChart: nearestInChart, THREADS: THREADS, PX: PX };
})();
if (typeof module !== 'undefined') module.exports = StitchEngine;
