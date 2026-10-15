// Stitch exporter: placed layers -> sewing sequence -> machine files (EXP+INF+BMP, JEF, DST) -> ZIP.
// Units: world millimetres, y up, origin = hoop centre. Machine files use 0.1 mm.
var StitchExport = (function () {
  'use strict';

  var MIN_STITCH = 0.3;  // mm: closer needle points are dropped (thread-break risk)
  var TRAVEL = 2.0;      // mm: shorter moves are sewn straight
  var RUN_LEN = 2.5;     // mm: running stitch length for underlay and hidden travel
  var LOCK = 0.5;        // mm: tie-in / tie-off stitch length

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  // ---------- placement ----------
  function makeXform(t) {
    var r = (t.rotation || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    var fx = t.mirrorX ? -1 : 1, fy = t.mirrorY ? -1 : 1, tx = t.x || 0, ty = t.y || 0;
    return {
      fwd: function (p) { var x = p[0] * fx, y = p[1] * fy; return [c * x - s * y + tx, s * x + c * y + ty]; },
      inv: function (p) { var x = p[0] - tx, y = p[1] - ty; return [(c * x + s * y) * fx, (-s * x + c * y) * fy]; }
    };
  }

  // ---------- helpers ----------
  function resample(poly, step, closed) {
    var pts = poly.slice(); if (closed) pts.push(poly[0]);
    var out = [pts[0]], carry = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = dist(a, b), t = step - carry;
      while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; }
      carry = L - (t - step);
    }
    if (dist(out[out.length - 1], pts[pts.length - 1]) > 0.5) out.push(pts[pts.length - 1]);
    return out;
  }
  // consecutive chords -> needle runs (zigzag satin and tatami rows continue; gaps start a new run)
  function chordRuns(chords) {
    var runs = [], run = [];
    chords.forEach(function (c) {
      var a = [c[0], c[1]], b = [c[2], c[3]];
      if (run.length && dist(a, run[run.length - 1]) <= 1.2) run.push(b);
      else { if (run.length > 1) runs.push(run); run = [a, b]; }
    });
    if (run.length > 1) runs.push(run);
    return runs;
  }
  // nearest-neighbour order for running paths; open paths may run either way, and closed loops (an island's edge
  // underlay) start and end at the vertex nearest the needle instead of wherever the outline happened to begin
  // an edge underlay comes back to within a stitch or two of where it began
  function isLoop(p) {
    if (p.length < 6) return false;
    var gap = dist(p[0], p[p.length - 1]), len = 0;
    for (var i = 1; i < p.length; i++) len += dist(p[i - 1], p[i]);
    return gap < 3 && len > 6 * gap + 4;
  }
  function nnOrder(paths, from) {
    var left = paths.slice(), res = [], cur = from || null;
    while (left.length) {
      var bi = 0, flip = false, rot = 0, bd = Infinity;
      left.forEach(function (p, i) {
        if (!cur) { var d = p[0][0]; if (d < bd) { bd = d; bi = i; flip = false; rot = 0; } return; }
        if (isLoop(p)) {
          for (var k = 0; k < p.length - 1; k++) { var dk = dist(cur, p[k]); if (dk < bd) { bd = dk; bi = i; flip = false; rot = k; } }
          return;
        }
        var d0 = dist(cur, p[0]), d1 = dist(cur, p[p.length - 1]);
        if (d0 < bd) { bd = d0; bi = i; flip = false; rot = 0; }
        if (d1 < bd) { bd = d1; bi = i; flip = true; rot = 0; }
      });
      var p = left.splice(bi, 1)[0];
      if (rot) p = dist(p[0], p[p.length - 1]) < 0.05 ? p.slice(rot, p.length - 1).concat(p.slice(0, rot + 1)) : p.slice(rot).concat(p.slice(0, rot + 1));
      if (flip) p = p.slice().reverse();
      res.push(p); cur = p[p.length - 1];
    }
    return res;
  }

  // ---------- travel routing inside the shape that will cover it ----------
  function Router(inside, xf) {
    var g = inside, W = g.w, Hh = g.h;
    function cellOf(pl) { return [Math.floor((pl[0] - g.x0) / g.res), Math.floor((g.y1 - pl[1]) / g.res)]; }
    function isIn(pw) {
      var c = cellOf(xf.inv(pw));
      return c[0] >= 0 && c[1] >= 0 && c[0] < W && c[1] < Hh && g.data[c[1] * W + c[0]] === 1;
    }
    function lineIn(a, b) {
      var L = dist(a, b), n = Math.max(1, Math.ceil(L / 0.25));
      for (var k = 0; k <= n; k++) {
        var t = k / n;
        if (t * L < 0.8 || (1 - t) * L < 0.8) continue; // stitch ends sit on the shape's edge
        if (!isIn([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
      }
      return true;
    }
    function nearestCell(pw) {
      var c0 = cellOf(xf.inv(pw));
      for (var r = 0; r < 8; r++) {
        var best = null, bd = Infinity;
        for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) {
          var i = c0[0] + di, j = c0[1] + dj;
          if (i < 0 || j < 0 || i >= W || j >= Hh || g.data[j * W + i] !== 1) continue;
          var d2 = di * di + dj * dj; if (d2 < bd) { bd = d2; best = j * W + i; }
        }
        if (best !== null) return best;
      }
      return null;
    }
    function cellWorld(k) { return xf.fwd([g.x0 + (k % W + 0.5) * g.res, g.y1 - (Math.floor(k / W) + 0.5) * g.res]); }
    return {
      route: function (a, b, maxD) {
        if (dist(a, b) > (maxD || 160)) return null; // long runs are fine: they only cross ground that will be sewn over
        if (lineIn(a, b)) return [b];
        var ca = nearestCell(a), cb = nearestCell(b);
        if (ca === null || cb === null) return null;
        var prev = new Map(); prev.set(ca, -1);
        var q = [ca], head = 0, found = false;
        while (head < q.length) {
          var k = q[head++];
          if (k === cb) { found = true; break; }
          var ki = k % W, kj = Math.floor(k / W);
          for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
            if (!di && !dj) continue;
            var ni = ki + di, nj = kj + dj;
            if (ni < 0 || nj < 0 || ni >= W || nj >= Hh) continue;
            var nk = nj * W + ni;
            if (g.data[nk] !== 1 || prev.has(nk)) continue;
            prev.set(nk, k); q.push(nk);
          }
          if (q.length > 60000) break;
        }
        if (!found) return null;
        var cells = [], k2 = cb;
        while (k2 !== -1) { cells.push(k2); k2 = prev.get(k2); }
        var pts = [a].concat(cells.reverse().map(cellWorld)).concat([b]);
        var out = [], i = 0;
        while (i < pts.length - 1) {
          var j = pts.length - 1;
          while (j > i + 1 && !lineIn(pts[i], pts[j])) j--;
          out.push(pts[j]); i = j;
        }
        var total = 0, prv = a;
        out.forEach(function (p) { total += dist(prv, p); prv = p; });
        // a route through a curly script word can be a few times the straight distance; it still beats a jump,
        // because the ground it runs over gets covered by the fill
        return total > 4.5 * dist(a, b) + 30 ? null : out;
      }
    };
  }

  // ---------- sequence builder ----------
  function Seq() {
    this.cmds = [];       // [x, y, type] type: 'S' stitch, 'J' jump, 'C' colour change
    this.last = null; this.prevDir = null;
    this.n = { stitches: 0, jumps: 0, travels: 0, colors: 0 };
    this.router = null;
  }
  Seq.prototype.add = function (t, p) { this.cmds.push([p[0], p[1], t]); if (t === 'S') this.n.stitches++; if (t === 'J') this.n.jumps++; };
  Seq.prototype.stitch = function (p, force) {
    if (this.last && !force && dist(p, this.last) < MIN_STITCH) return;
    if (this.last && dist(p, this.last) > 7) {           // split anything unusually long
      var n = Math.ceil(dist(p, this.last) / 7), a = this.last;
      for (var k = 1; k < n; k++) this.add('S', [a[0] + (p[0] - a[0]) * k / n, a[1] + (p[1] - a[1]) * k / n]);
    }
    this.add('S', p); this.last = p;
  };
  Seq.prototype.lock = function (at, toward) {
    var dx = toward[0] - at[0], dy = toward[1] - at[1], L = Math.hypot(dx, dy) || 1;
    var u = [at[0] + dx / L * LOCK, at[1] + dy / L * LOCK];
    for (var k = 0; k < 2; k++) { this.stitch(u, true); this.stitch(at, true); }
  };
  Seq.prototype.moveTo = function (p, next) {
    if (!this.last) { this.add('J', p); this.last = p; this.stitch(p, true); this.lock(p, next); return; }
    var d = dist(p, this.last);
    if (d <= (this.travelMax != null ? this.travelMax : TRAVEL)) { this.stitch(p); return; }
    var route = this.router ? this.router.route(this.last, p, this.routeMax) : null;
    if (route) {
      var self = this;
      route.forEach(function (tgt) {
        var a = self.last, n = Math.max(1, Math.ceil(dist(a, tgt) / RUN_LEN));
        for (var k = 1; k <= n; k++) { self.stitch([a[0] + (tgt[0] - a[0]) * k / n, a[1] + (tgt[1] - a[1]) * k / n]); if (self.cmds.length) self.cmds[self.cmds.length - 1].travel = 1; }
      });
      this.n.travels++;
      return;
    }
    this.lock(this.last, this.prevDir || p);             // tie off before the jump
    this.add('J', p); this.last = p; this.stitch(p, true); this.lock(p, next);
  };
  Seq.prototype.path = function (pts) {
    if (!pts.length) return;
    this.moveTo(pts[0], pts[1] || pts[0]);
    for (var i = 1; i < pts.length; i++) { this.prevDir = this.last; this.stitch(pts[i]); }
    this.prevDir = pts.length > 1 ? pts[pts.length - 2] : pts[0];
  };
  Seq.prototype.endBlock = function () { if (this.last && !this.rawEnd) this.lock(this.last, this.prevDir || this.last); };
  // a run from an opened stitch file, sewn exactly: no locks added (the file has its own tie-ins and tie-offs), no
  // stitches dropped; only a stitch longer than a machine can make in one step (12 mm) is split
  Seq.prototype.raw = function (pts) {
    if (!pts.length) return;
    var p0 = pts[0];
    if (!this.last || dist(this.last, p0) > 0.05) { this.add('J', p0); this.last = p0; this.add('S', p0); }
    for (var i = 1; i < pts.length; i++) {
      var a = this.last, p = pts[i], d = dist(a, p);
      if (d > 12) { var n = Math.ceil(d / 12); for (var k = 1; k < n; k++) this.add('S', [a[0] + (p[0] - a[0]) * k / n, a[1] + (p[1] - a[1]) * k / n]); }
      this.add('S', p); this.last = p;
    }
    this.prevDir = pts.length > 1 ? pts[pts.length - 2] : null;
  };

  // placed: [{ result, transform, name }] in sewing order (first sews first)
  // split a fill part into its islands (chord[7], tagged by the engine), each with the underlay runs that lie in
  // it, sorted by where they sit across the hoop (x after the layer's transform)
  function fillGroups(part, W) {
    var by = {}, list = [];
    part.chords.forEach(function (c) {
      var k = c[7] === undefined ? -1 : c[7], g = by[k];
      if (!g) { g = by[k] = { chords: [], under: [], sx: 0, n: 0, lx: 0, ly: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; list.push(g); }
      g.chords.push(c);
      var mx = (c[0] + c[2]) / 2, my = (c[1] + c[3]) / 2, w = W([mx, my]);
      g.sx += w[0]; g.n++; g.lx += mx; g.ly += my;
      g.x0 = Math.min(g.x0, c[0], c[2]); g.x1 = Math.max(g.x1, c[0], c[2]); g.y0 = Math.min(g.y0, c[1], c[3]); g.y1 = Math.max(g.y1, c[1], c[3]);
    });
    list.forEach(function (g) { g.x = g.sx / g.n; g.lx /= g.n; g.ly /= g.n; });
    var tags = part.underIsl && part.under && part.underIsl.length === part.under.length ? part.underIsl : null;
    (part.under || []).forEach(function (pl, ui) {
      if (!pl.length) return;
      if (tags && by[tags[ui]]) { by[tags[ui]].under.push(pl); return; }
      var m = pl[Math.floor(pl.length / 2)], best = null, bd = Infinity;
      list.forEach(function (g) {
        var inside = m[0] >= g.x0 - 1 && m[0] <= g.x1 + 1 && m[1] >= g.y0 - 1 && m[1] <= g.y1 + 1;
        var d = Math.hypot(m[0] - g.lx, m[1] - g.ly) + (inside ? 0 : 1e4);
        if (d < bd) { bd = d; best = g; }
      });
      if (best) best.under.push(pl);
      else { var g0 = { chords: [], under: [pl], x: W(m)[0] }; list.push(g0); }
    });
    list.forEach(function (g) {
      var a = g.chords[0], z = g.chords[g.chords.length - 1];
      g.x0 = Infinity; g.x1 = -Infinity;
      g.chords.forEach(function (c) { var p = W([c[0], c[1]]), q = W([c[2], c[3]]); g.x0 = Math.min(g.x0, p[0], q[0]); g.x1 = Math.max(g.x1, p[0], q[0]); });
      g.under.forEach(function (pl) { pl.forEach(function (q) { var w = W(q); g.x0 = Math.min(g.x0, w[0]); g.x1 = Math.max(g.x1, w[0]); }); });
      g.ends = a ? [W([a[0], a[1]]), W([z[2], z[3]])] : [W(g.under[0][0]), W(g.under[0][0])];
    });
    return list;
  }
  // Order islands for one colour so the needle sweeps left to right: an island may start only once every island
  // lying wholly to its left is done (nothing is left behind to jump back to), and among those the nearest entry
  // wins, with going left penalised. An island can be sewn in reverse, so islands stacked above each other snake.
  var SW_BACK = 6, SW_LEAVE = 6, SW_LOOK_MAX = 40; // mm-weights for going left / leaving islands behind; lookahead up to 40 islands
  function sweepOrder(items, from) {
    var left = items.slice(), out = [], pos = from;
    function options(pos, pool) {
      var res = [];
      pool.forEach(function (it, i) {
        if (pool.some(function (o) { return o !== it && o.x1 < it.x0 - 0.5; })) return;
        [0, 1].forEach(function (rev) {
          if (rev && !it.reversible) return;
          var e = it.near && pos ? it.near(pos) : it.ends[rev], x = it.near && pos ? e : it.ends[1 - rev];
          var cost = pos ? Math.hypot(e[0] - pos[0], e[1] - pos[1]) + SW_BACK * Math.max(0, pos[0] - e[0]) : e[0];
          // and don't finish to the right of islands that are still waiting: that forces a jump back later
          pool.forEach(function (o) { if (o !== it && o.x1 < x[0]) cost += SW_LEAVE * (x[0] - o.x1); });
          res.push({ i: i, rev: rev, cost: cost, exit: x });
        });
      });
      return res;
    }
    while (left.length) {
      var opts = options(pos, left), best = null;
      opts.forEach(function (o) {
        var total = o.cost;
        if (left.length > 1 && left.length <= SW_LOOK_MAX) {   // one step of lookahead: where does this choice leave the next move?
          var rest = left.slice(0, o.i).concat(left.slice(o.i + 1)), nx = options(o.exit, rest), m = Infinity;
          nx.forEach(function (q) { if (q.cost < m) m = q.cost; });
          if (m < Infinity) total += m;
        }
        if (!best || total < best.total) best = { i: o.i, rev: o.rev, total: total };
      });
      if (!best) best = { i: 0, rev: 0 };
      var it = left.splice(best.i, 1)[0];
      out.push({ item: it, rev: best.rev });
      pos = it.near && pos ? it.near(pos) : it.ends[1 - best.rev];
    }
    return out;
  }
  // underlay runs inside one island, swept left to right like the islands themselves (loops start at their
  // vertex nearest the needle, open runs may go either way)
  function sweepPaths(paths, from, then) {
    if (paths.length < 3) return nnOrder(paths, from);
    // plan the sweep both ways (left to right, and mirrored) and keep the one with less travel: from the needle to
    // the first run, between runs, and from the last run to where the fill starts
    var flipX = function (q) { return [-q[0], q[1]]; };
    var a = sweepPaths0(paths, from);
    var b = sweepPaths0(paths.map(function (p) { return p.map(flipX); }), from ? flipX(from) : null).map(function (p) { return p.map(flipX); });
    function travel(plan) {
      var t = 0, at = from;
      // reaching the first run usually means a jump (and a trim), and going left breaks the sweep; the way back to
      // the fill start runs hidden inside the island, so it costs plain distance
      plan.forEach(function (p, i) { if (at) t += i ? dist(at, p[0]) : 3 * dist(at, p[0]) + SW_BACK * Math.max(0, at[0] - p[0][0]); at = p[p.length - 1]; });
      if (then && at) t += dist(at, then);
      return t;
    }
    return travel(b) < travel(a) ? b : a;
  }
  function sweepPaths0(paths, from) {
    var items = paths.map(function (p) {
      var x0 = Infinity, x1 = -Infinity; p.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); });
      var it = { p: p, x0: x0, x1: x1, ends: [p[0], p[p.length - 1]], reversible: true };
      if (isLoop(p)) { it.near = function (pos) { var bk = 0, bd = Infinity; for (var k = 0; k < p.length - 1; k++) { var d = dist(p[k], pos); if (d < bd) { bd = d; bk = k; } } return p[bk]; }; it.reversible = false; }
      return it;
    });
    var out = [], cur = from;
    sweepOrder(items, from).forEach(function (o) {
      var p = o.item.p;
      if (o.item.near && cur) { var one = nnOrder([p], cur)[0]; out.push(one); cur = one[one.length - 1]; return; }
      if (o.rev) p = p.slice().reverse();
      out.push(p); cur = p[p.length - 1];
    });
    return out;
  }
  // chords that follow on exactly (line art keeps its runs apart: a gap means lift, not a stitch across the paper)
  function exactRuns(chords) {
    var runs = [], run = [];
    chords.forEach(function (c) {
      var a = [c[0], c[1]], b = [c[2], c[3]];
      if (run.length && dist(a, run[run.length - 1]) <= 0.02) run.push(b);
      else { if (run.length > 1) runs.push(run); run = [a, b]; }
    });
    if (run.length > 1) runs.push(run);
    return runs;
  }
  // many short runs (an engraving has thousands): nearest next run, going left penalised, found through a grid
  function greedyRuns(items, from) {
    var CELL = 5, grid = new Map(), out = [], left = items.length;
    function key(i, j) { return i * 100003 + j; }
    items.forEach(function (it, n) {
      it.n = n;
      [0, 1].forEach(function (end) {
        var e = it.ends[end], k = key(Math.floor(e[0] / CELL), Math.floor(e[1] / CELL));
        if (!grid.has(k)) grid.set(k, []); grid.get(k).push([n, end]);
      });
    });
    var used = new Uint8Array(items.length), pos = from;
    if (!pos) { var mx = Infinity; items.forEach(function (it) { [0, 1].forEach(function (e) { if (it.ends[e][0] < mx) { mx = it.ends[e][0]; pos = [it.ends[e][0] - 1, it.ends[e][1]]; } }); }); }
    while (left) {
      var ci = Math.floor(pos[0] / CELL), cj = Math.floor(pos[1] / CELL), best = null;
      for (var r = 0; r < 400; r++) {
        if (best && (r - 1) * CELL > best.cost) break;
        for (var di = -r; di <= r; di++) for (var dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          var list = grid.get(key(ci + di, cj + dj)); if (!list) continue;
          for (var q = 0; q < list.length; q++) {
            var n = list[q][0], end = list[q][1]; if (used[n]) continue;
            var e = items[n].ends[end], cost = dist(pos, e) + 1.5 * Math.max(0, pos[0] - e[0]);
            if (!best || cost < best.cost) best = { n: n, rev: end === 1, cost: cost };
          }
        }
      }
      if (!best) { for (var z = 0; z < items.length; z++) if (!used[z]) { best = { n: z, rev: false }; break; } }
      used[best.n] = 1; left--;
      out.push({ item: items[best.n], rev: best.rev });
      pos = items[best.n].ends[best.rev ? 0 : 1];
    }
    return out;
  }
  function reverseChords(cs) { return cs.slice().reverse().map(function (c) { var d = c.slice(); d[0] = c[2]; d[1] = c[3]; d[2] = c[0]; d[3] = c[1]; return d; }); }
  function buildSequence(placed, opts) {
    opts = opts || {};
    // thread / needle dependent limits (defaults suit 40 wt on a 75/11 needle)
    MIN_STITCH = opts.minStitch || 0.3; RUN_LEN = opts.runLen || 2.5; LOCK = opts.lock || 0.5;
    var seq = new Seq(), threads = [], blocks = [], curColor = null, block = null;
    placed.forEach(function (L) {
      var xf = makeXform(L.transform || {});
      var W = function (p) { return xf.fwd(p); };
      L.result.parts.forEach(function (part) {
        if (!part.chords.length && !(part.loops && part.loops.length) && !(part.runs && part.runs.length)) return;
        if (part.color !== curColor) {
          if (curColor !== null) { seq.endBlock(); seq.add('C', seq.last || [0, 0]); seq.n.colors++; seq.last = null; }
          curColor = part.color;
          threads.push({ color: part.color, thread: part.thread, name: (part.thread && part.thread.name) || part.color });
          block = { color: part.color, thread: part.thread, layers: [], stitches: 0, start: seq.n.stitches };
          blocks.push(block);
        }
        if (block.layers.indexOf(L.name) < 0) block.layers.push(L.name);
        var grid0 = part.inside || L.result.inside;
        seq.router = grid0 ? Router(grid0, xf) : null;
        seq.rawEnd = part.kind === 'stitches';
        if (part.kind === 'stitches') {
          part.runs.forEach(function (r) { seq.raw(r.map(W)); });
        } else if (part.kind === 'outline') {
          // outlines letter by letter from left to right across the hoop
          // closed loops can start anywhere: each starts (and so ends) at its point nearest the needle
          sweepOrder((part.loops || []).filter(function (lp) { return lp.pen.length > 2; }).map(function (lp) {
            var x0 = Infinity, x1 = -Infinity, pw = lp.pen.map(W); pw.forEach(function (w) { x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]); });
            var near = function (pos) { var bk = 0, bd = Infinity; for (var k = 0; k < pw.length - 1; k += 2) { var d = dist(pw[k], pos); if (d < bd) { bd = d; bk = k; } } return pw[bk]; };
            return { lp: lp, x0: x0, x1: x1, ends: [pw[0], pw[0]], near: near };
          }), seq.last).map(function (o) { return o.item.lp; }).forEach(function (lp) {
            if (seq.last && lp.pen.length > 2 && (lp.pen.length - 1) % 2 === 0 && lp.under.length >= lp.pen.length - 1) {
              var pw = lp.pen.map(W), bk = 0, bd = Infinity;
              for (var k = 0; k < pw.length - 1; k += 2) { var d = dist(pw[k], seq.last); if (d < bd) { bd = d; bk = k; } }
              if (bk) lp = { pen: lp.pen.slice(bk).concat(lp.pen.slice(1, bk + 1)), under: lp.under.slice(bk).concat(lp.under.slice(0, bk)) };
            }
            seq.path(resample(lp.under, 2.0, true).map(W));
            seq.path(lp.pen.map(W));
          });
        } else if (part.kind === 'run') {
          // line art and hatching: every group is one unbroken run, already in sewing order; runs are joined by a
          // stitch only when they nearly touch, otherwise by a hidden route or a jump, never a line across the paper
          var rg = fillGroups(part, W); rg.forEach(function (g) { g.reversible = true; });
          seq.travelMax = 0.8; seq.routeMax = 5; if (part.sub !== 'hatch') seq.router = null;
          (rg.length > 60 ? greedyRuns(rg, seq.last) : sweepOrder(rg, seq.last)).forEach(function (o) {
            exactRuns(o.rev ? reverseChords(o.item.chords) : o.item.chords).forEach(function (r) { seq.path(r.map(W)); });
          });
          seq.travelMax = null; seq.routeMax = null;
        } else {
          // island by island, left to right across the hoop: each island's underlay, then its top stitching.
          // The needle only moves on to the right within a colour and comes back left at the colour change.
          var gs = fillGroups(part, W); gs.forEach(function (g) { g.reversible = true; });
          sweepOrder(gs, seq.last).forEach(function (o) {
            var g = o.item;
            if (o.rev) g = { chords: reverseChords(g.chords), under: g.under };
            var under = g.under.filter(function (pl) { return pl.length > 1; }).map(function (pl) { return resample(pl, RUN_LEN).map(W); });
            var fillStart = g.chords.length ? W([g.chords[0][0], g.chords[0][1]]) : null;
            sweepPaths(under, seq.last, fillStart).forEach(function (p) { seq.path(p); });
            var scatter = g.chords.filter(function (c) { return c[4] === 1 || c[4] === 4; });
            var main = g.chords.filter(function (c) { return !(c[4] === 1 || c[4] === 4); });
            nnOrder(chordRuns(scatter).map(function (r) { return r.map(W); }), seq.last).forEach(function (p) { seq.path(p); });
            chordRuns(main).forEach(function (r) { seq.path(r.map(W)); });
          });
        }
        block.stitches = seq.n.stitches - block.start;
      });
    });
    seq.endBlock();
    // bounds
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    seq.cmds.forEach(function (c) { if (c[2] === 'C') return; minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    if (!isFinite(minX)) { minX = maxX = minY = maxY = 0; }
    var spm = opts.speed || 600;
    return {
      cmds: seq.cmds, threads: threads, blocks: blocks,
      stats: { stitches: seq.n.stitches, jumps: seq.n.jumps, travels: seq.n.travels, colorChanges: seq.n.colors,
        minutes: seq.n.stitches / spm + seq.n.colors * 0.5 },
      bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY }
    };
  }

  // ---------- encoders ----------
  // convert to integer 0.1 mm absolute positions; split moves to the format's limit
  function units(seq, maxD) {
    var out = [], ux = 0, uy = 0;
    seq.cmds.forEach(function (c) {
      var tx = Math.round(c[0] * 10), ty = Math.round(c[1] * 10);
      if (c[2] === 'C') { out.push([0, 0, 'C']); return; }
      var dx = tx - ux, dy = ty - uy;
      var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxD));
      var px = ux, py = uy;
      for (var k = 1; k <= n; k++) {
        var nx = ux + Math.round(dx * k / n), ny = uy + Math.round(dy * k / n);
        out.push([nx - px, ny - py, c[2]]); px = nx; py = ny;
      }
      ux = tx; uy = ty;
    });
    return out;
  }
  function Bytes() { this.a = []; }
  Bytes.prototype.u8 = function (v) { this.a.push(v & 255); };
  Bytes.prototype.i8 = function (v) { this.a.push(v & 255); };
  Bytes.prototype.u16le = function (v) { this.u8(v); this.u8(v >> 8); };
  Bytes.prototype.u16be = function (v) { this.u8(v >> 8); this.u8(v); };
  Bytes.prototype.u32le = function (v) { this.u8(v); this.u8(v >> 8); this.u8(v >> 16); this.u8(v >> 24); };
  Bytes.prototype.u32be = function (v) { this.u8(v >> 24); this.u8(v >> 16); this.u8(v >> 8); this.u8(v); };
  Bytes.prototype.str = function (s) { for (var i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  Bytes.prototype.out = function () { return new Uint8Array(this.a); };

  // Melco / Bernina EXP: signed byte pairs (y up), 0x80 escapes commands
  function writeEXP(seq) {
    var b = new Bytes();
    var cmds = seq.cmds, last = null;
    for (var q = cmds.length - 1; q >= 0 && !last; q--) if (cmds[q][2] !== 'C') last = cmds[q];
    // finish with the needle back at the hoop centre, as the designs on Bernina cards do
    var home = last && (Math.abs(last[0]) > 0.05 || Math.abs(last[1]) > 0.05) ? { cmds: cmds.concat([[0, 0, 'J']]) } : seq;
    units(home, 127).forEach(function (u) {
      if (u[2] === 'C') { b.u8(0x80); b.u8(0x01); b.u8(0); b.u8(0); return; }
      if (u[2] === 'J') { b.u8(0x80); b.u8(0x04); }
      b.i8(u[0]); b.i8(u[1]);
    });
    return b.out();
  }

  // Bernina INF (EXP+ colour file), version 2 as found on Deco 330 cards: big-endian colour records, then a
  // "JANOMEB2" block for the Janome-built Deco machines holding the Janome hoop code and the 40 x 58 picture
  // shown on the machine's design key. The block's other bytes are constant across every card file we've seen.
  var INF_B2_HEAD = '000009300000000109284a414e4f4d454232001a0000000000020000000000000928a4aa57400000000000000000000000000000000000000000';
  var INF_B2_TAIL = '00000000280000003a000000280000000000000000000000';
  var INF_HOOP_AT = 25, ICON_W = 40, ICON_H = 58;
  function hexBytes(h) { var a = []; for (var i = 0; i < h.length; i += 2) a.push(parseInt(h.substr(i, 2), 16)); return a; }
  // machine design-key picture: each thread's darkness (0 = empty, up to 12 = darkest), design fitted and centred
  function infIcon(seq) {
    var g = new Uint8Array(ICON_W * ICON_H), bd = seq.bounds;
    var sc = Math.min(36 / Math.max(1, bd.w), 46 / Math.max(1, bd.h)), cx = 19.5, cy = 28.5, mx = bd.minX + bd.w / 2, my = bd.minY + bd.h / 2;
    var shade = seq.threads.map(function (t) {
      var r = parseInt(t.color.slice(1, 3), 16), gg = parseInt(t.color.slice(3, 5), 16), b = parseInt(t.color.slice(5, 7), 16);
      return Math.max(1, Math.min(12, Math.round(15 * (1 - (r + gg + b) / 765) + 1)));
    });
    var ci = 0, prev = null;
    seq.cmds.forEach(function (c) {
      if (c[2] === 'C') { ci++; prev = null; return; }
      if (c[2] === 'S' && prev) {
        var n = Math.max(1, Math.ceil(Math.hypot(c[0] - prev[0], c[1] - prev[1]) * sc * 2));
        for (var k = 0; k <= n; k++) {
          var x = Math.floor(cx + ((prev[0] + (c[0] - prev[0]) * k / n) - mx) * sc + 0.5), y = Math.floor(cy - ((prev[1] + (c[1] - prev[1]) * k / n) - my) * sc + 0.5);
          if (x >= 0 && y >= 0 && x < ICON_W && y < ICON_H) g[y * ICON_W + x] = shade[ci] || 11;
        }
      }
      prev = c;
    });
    return g;
  }
  var INF_HOOP = { A: 3, B: 2, C: 1 }; // Janome hoop codes: 3 = 126 x 110, 2 = 140 x 200, 1 = 50 x 50
  function writeINF(seq, opts) {
    opts = opts || {};
    var b = new Bytes(), recs = [];
    seq.threads.forEach(function (t, i) {
      var r = parseInt(t.color.slice(1, 3), 16), g = parseInt(t.color.slice(3, 5), 16), bl = parseInt(t.color.slice(5, 7), 16);
      var desc = (t.thread && t.thread.name) || 'Thread', chart = (t.thread && ((t.thread.brand || 'Janome') + ' ' + t.thread.code)) || 'Custom';
      desc = desc.replace(/[^\x20-\x7e]/g, '?'); chart = chart.replace(/[^\x20-\x7e]/g, '?');
      var rb = new Bytes();
      rb.u16be(11 + desc.length + chart.length); rb.u16be(i + 1); rb.u8(r); rb.u8(g); rb.u8(bl); rb.u16be(i + 1);
      rb.str(desc); rb.u8(0); rb.str(chart); rb.u8(0);
      recs.push(rb.a);
    });
    var body = recs.reduce(function (a, r) { return a + r.length; }, 0);
    if (opts.v1) { // plain version 1 (BERNINA 5 / 7 / 8 / 9 Series, bernette): 0-based record numbers, no Janome block
      b.u32be(1); b.u32be(8); b.u32be(4 + body); b.u32be(seq.threads.length);
      recs.forEach(function (r, i) { r[2] = (i >> 8) & 255; r[3] = i & 255; r.forEach(function (v) { b.u8(v); }); });
      return b.out();
    }
    b.u32be(2); b.u32be(12); b.u32be(20 + body); b.u32be(8 + body); b.u32be(seq.threads.length);
    recs.forEach(function (r) { r.forEach(function (v) { b.u8(v); }); });
    var head = hexBytes(INF_B2_HEAD);
    head[INF_HOOP_AT] = INF_HOOP[opts.hoop] !== undefined ? INF_HOOP[opts.hoop] : (opts.hoopCode !== undefined ? opts.hoopCode : 2);
    head.forEach(function (v) { b.u8(v); });
    infIcon(seq).forEach(function (v) { b.u8(v); });
    hexBytes(INF_B2_TAIL).forEach(function (v) { b.u8(v); });
    return b.out();
  }

  var JEF_HOOP = { A: 3, B: 2, C: 1 };
  function writeJEF(seq, opts) {
    var u = units(seq, 127), b = new Bytes();
    // colour indices into the Janome chart; neighbours that map to the same index take the next nearest
    var palette = [], last = -1;
    seq.threads.forEach(function (t) {
      var idx = t.thread ? t.thread.index : 1;
      if (idx === last && opts.threadAlt) idx = opts.threadAlt(t.color, idx);
      palette.push(idx); last = idx;
    });
    var nColors = palette.length, points = 1;
    u.forEach(function (c) { points += c[2] === 'S' ? 1 : 2; });
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var date = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    b.u32le(0x74 + nColors * 8); b.u32le(0x14); b.str(date); b.u8(0); b.u8(0);
    // hoop code: the Deco's letter, or (for Janome / Elna machines) the smallest classic Janome hoop the design fits
    var bw = seq.bounds.w * 10, bh = seq.bounds.h * 10;
    var auto = bw < 500 && bh < 500 ? 1 : bw < 1260 && bh < 1100 ? 3 : bw < 1400 && bh < 2000 ? 2 : bw < 2000 && bh < 2000 ? 4 : 0;
    b.u32le(nColors); b.u32le(points); b.u32le(opts.auto ? auto : JEF_HOOP[opts.hoop] !== undefined ? JEF_HOOP[opts.hoop] : 3);
    var bd = seq.bounds, L = Math.round(-bd.minX * 10), T = Math.round(bd.maxY * 10), R = Math.round(bd.maxX * 10), Bm = Math.round(-bd.minY * 10);
    b.u32le(L); b.u32le(T); b.u32le(R); b.u32le(Bm);
    [[550, 550], [250, 250], [700, 1000], [700, 1000]].forEach(function (h) {
      var e = [h[0] - L, h[1] - T, h[0] - R, h[1] - Bm];
      if (Math.min.apply(null, e) >= 0) e.forEach(function (v) { b.u32le(v); });
      else for (var k = 0; k < 4; k++) b.u32le(-1);
    });
    palette.forEach(function (p) { b.u32le(p); });
    palette.forEach(function () { b.u32le(0x0D); });
    u.forEach(function (c) {
      if (c[2] === 'C') { b.u8(0x80); b.u8(0x01); b.i8(0); b.i8(0); return; }
      if (c[2] === 'J') { b.u8(0x80); b.u8(0x02); }
      b.i8(c[0]); b.i8(c[1]);
    });
    b.u8(0x80); b.u8(0x10);
    return b.out();
  }

  function dstRecord(x, y, type) {
    var b0 = 0, b1 = 0, b2 = 0, bit = function (n) { return 1 << n; };
    if (type === 'C') return [0, 0, 0xC3];
    if (type === 'E') return [0, 0, 0xF3];
    if (type === 'J') b2 |= bit(7);
    b2 |= bit(0) | bit(1);
    if (x > 40) { b2 |= bit(2); x -= 81; } if (x < -40) { b2 |= bit(3); x += 81; }
    if (x > 13) { b1 |= bit(2); x -= 27; } if (x < -13) { b1 |= bit(3); x += 27; }
    if (x > 4) { b0 |= bit(2); x -= 9; } if (x < -4) { b0 |= bit(3); x += 9; }
    if (x > 1) { b1 |= bit(0); x -= 3; } if (x < -1) { b1 |= bit(1); x += 3; }
    if (x > 0) { b0 |= bit(0); x -= 1; } if (x < 0) { b0 |= bit(1); x += 1; }
    if (y > 40) { b2 |= bit(5); y -= 81; } if (y < -40) { b2 |= bit(4); y += 81; }
    if (y > 13) { b1 |= bit(5); y -= 27; } if (y < -13) { b1 |= bit(4); y += 27; }
    if (y > 4) { b0 |= bit(5); y -= 9; } if (y < -4) { b0 |= bit(4); y += 9; }
    if (y > 1) { b1 |= bit(7); y -= 3; } if (y < -1) { b1 |= bit(6); y += 3; }
    if (y > 0) { b0 |= bit(7); y -= 1; } if (y < 0) { b0 |= bit(6); y += 1; }
    if (x !== 0 || y !== 0) throw new Error('DST move out of range');
    return [b0, b1, b2];
  }
  function writeDST(seq, name) {
    var u = units(seq, 121), b = new Bytes(), bd = seq.bounds, lastC = seq.cmds.filter(function (c) { return c[2] !== 'C'; }).pop() || [0, 0];
    var padL = function (s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; };
    var padR = function (s, n) { s = String(s); while (s.length < n) s += ' '; return s.slice(0, n); };
    var sgn = function (v) { return (v >= 0 ? '+' : '-') + padL(Math.abs(v), 5); };
    b.str('LA:' + padR(name || 'Untitled', 16) + '\r');
    b.str('ST:' + padL(u.filter(function (c) { return c[2] === 'S'; }).length, 7) + '\r');
    b.str('CO:' + padL(seq.stats.colorChanges, 3) + '\r');
    b.str('+X:' + padL(Math.abs(Math.round(bd.maxX * 10)), 5) + '\r');
    b.str('-X:' + padL(Math.abs(Math.round(bd.minX * 10)), 5) + '\r');
    b.str('+Y:' + padL(Math.abs(Math.round(bd.maxY * 10)), 5) + '\r');
    b.str('-Y:' + padL(Math.abs(Math.round(bd.minY * 10)), 5) + '\r');
    b.str('AX:' + sgn(Math.round(lastC[0] * 10)) + '\r');
    b.str('AY:' + sgn(Math.round(lastC[1] * 10)) + '\r');
    b.str('MX:+' + padL(0, 5) + '\r'); b.str('MY:+' + padL(0, 5) + '\r'); b.str('PD:******\r');
    b.u8(0x1A);
    while (b.a.length < 512) b.u8(0x20);
    u.forEach(function (c) { dstRecord(c[0], c[1], c[2]).forEach(function (v) { b.u8(v); }); });
    dstRecord(0, 0, 'E').forEach(function (v) { b.u8(v); });
    return b.out();
  }

  // ---------- PES / VP3 / XXX (layouts follow pyembroidery's writers, which these files are checked against) ----------
  // absolute positions in 0.1 mm with y pointing DOWN (the convention of these formats), moves split to maxD
  function points(seq, maxD) {
    var out = [], x = 0, y = 0;
    units(seq, maxD).forEach(function (u) {
      if (u[2] === 'C') { out.push([x, y, 'C']); return; }
      x += u[0]; y -= u[1]; out.push([x, y, u[2]]);
    });
    out.push([x, y, 'E']);
    return out;
  }
  function extents(pts) {
    var e = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(function (p) { if (p[0] < e[0]) e[0] = p[0]; if (p[1] < e[1]) e[1] = p[1]; if (p[0] > e[2]) e[2] = p[0]; if (p[1] > e[3]) e[3] = p[1]; });
    if (e[0] === Infinity) e = [0, 0, 0, 0];
    return e;
  }
  function rgbOf(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function f32le(b, v) { var a = new Uint8Array(new Float32Array([v]).buffer); for (var i = 0; i < 4; i++) b.u8(a[i]); }
  function i16le(b, v) { b.u16le(v & 0xFFFF); }
  function patch32le(b, at, v) { b.a[at] = v & 255; b.a[at + 1] = (v >> 8) & 255; b.a[at + 2] = (v >> 16) & 255; b.a[at + 3] = (v >>> 24) & 255; }
  function patch32be(b, at, v) { b.a[at] = (v >>> 24) & 255; b.a[at + 1] = (v >> 16) & 255; b.a[at + 2] = (v >> 8) & 255; b.a[at + 3] = v & 255; }

  // Brother's 64-colour PEC palette (index 0 unused)
  var PEC_RGB = [null, [14, 31, 124], [10, 85, 163], [0, 135, 119], [75, 107, 175], [237, 23, 31], [209, 92, 0], [145, 54, 151], [228, 154, 203], [145, 95, 172], [158, 214, 125],
    [232, 169, 0], [254, 186, 53], [255, 255, 0], [112, 188, 31], [186, 152, 0], [168, 168, 168], [125, 111, 0], [255, 255, 179], [79, 85, 86], [0, 0, 0], [11, 61, 145], [119, 1, 118],
    [41, 49, 51], [42, 19, 1], [246, 74, 138], [178, 118, 36], [252, 187, 197], [254, 55, 15], [240, 240, 240], [106, 28, 138], [168, 221, 196], [37, 132, 187], [254, 179, 67],
    [255, 243, 107], [208, 166, 96], [209, 84, 0], [102, 186, 73], [19, 74, 70], [135, 135, 135], [216, 204, 198], [67, 86, 7], [253, 217, 222], [249, 147, 188], [0, 56, 34],
    [178, 175, 212], [104, 106, 176], [239, 227, 185], [247, 56, 102], [181, 75, 100], [19, 43, 26], [199, 1, 86], [254, 158, 50], [168, 222, 235], [0, 103, 62], [78, 41, 144],
    [47, 126, 32], [255, 204, 204], [255, 217, 17], [9, 91, 166], [240, 249, 112], [227, 243, 91], [255, 153, 0], [255, 240, 141], [255, 200, 200]];
  function redMean(a, b) {
    var rm = Math.round((a[0] + b[0]) / 2), r = a[0] - b[0], g = a[1] - b[1], bl = a[2] - b[2];
    return (((512 + rm) * r * r) >> 8) + 4 * g * g + (((767 - rm) * bl * bl) >> 8);
  }
  // perceptual colour distance (CIE76 in Lab): a near-black purple goes to Black, not to a dark olive that happens to
  // be closer in RGB
  var LABC = {};
  function lab(c) {
    var k = c[0] + ',' + c[1] + ',' + c[2]; if (LABC[k]) return LABC[k];
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var r = f(c[0]), g = f(c[1]), bl = f(c[2]);
    var x = (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * bl, z = (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883;
    var h = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var fx = h(x), fy = h(y), fz = h(z);
    return (LABC[k] = [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]);
  }
  function dE(a, b) { var A = lab(a), B = lab(b); return (A[0] - B[0]) * (A[0] - B[0]) + (A[1] - B[1]) * (A[1] - B[1]) + (A[2] - B[2]) * (A[2] - B[2]); }
  function nearestIn(rgb, list) {
    var best = null, bd = Infinity;
    list.forEach(function (c, i) { if (!c) return; var d = dE(rgb, c); if (d <= bd) { bd = d; best = i; } });
    return best;
  }
  // each distinct thread colour takes its own nearest palette entry, so two close colours stay distinct on screen
  function pecPalette(seq) {
    var pal = PEC_RGB.slice(), chart = PEC_RGB.map(function () { return null; }), uniq = [];
    seq.threads.forEach(function (t) { if (uniq.indexOf(t.color) < 0) uniq.push(t.color); });
    // closest pairs choose first, so a near-exact match is never taken by a colour that only loosely resembles it
    var pairs = [];
    uniq.forEach(function (hex, u) { pal.forEach(function (c, i) { if (c) pairs.push([dE(rgbOf(hex), c), u, i]); }); });
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    var done = {};
    pairs.forEach(function (p) { if (done[p[1]] || !pal[p[2]]) return; done[p[1]] = true; pal[p[2]] = null; chart[p[2]] = rgbOf(uniq[p[1]]); });
    return seq.threads.map(function (t) { return nearestIn(rgbOf(t.color), chart) || 20; });
  }
  var PEC_BLANK = '000000000000f0ffffffff0f080000000010040000000020' + '020000000040'.repeat(32) + '040000000020080000000010f0ffffffff0f000000000000';
  function pecIcon(pts, ext, buffer) {
    var g = hexBytes(PEC_BLANK), dw = (ext[2] - ext[0]) || 1, dh = (ext[3] - ext[1]) || 1;
    var sc = Math.min((48 - buffer) / dw, (38 - buffer) / dh), tx = -(ext[0] + ext[2]) / 2 * sc + 24, ty = -(ext[1] + ext[3]) / 2 * sc + 19;
    pts.forEach(function (p) {
      var x = Math.floor(p[0] * sc + tx), y = Math.floor(p[1] * sc + ty), i = y * 6 + (x >> 3);
      if (x >= 0 && y >= 0 && i < g.length) g[i] |= 1 << (x % 8);
    });
    return g;
  }
  function pecValue(b, v, long, flag) {
    if (!long && v > -64 && v < 63) { b.u8(v & 0x7F); return; }
    v = (v & 0x0FFF) | 0x8000 | ((flag || 0) << 8);
    b.u8(v >> 8); b.u8(v);
  }
  function writePEC(b, seq, pts, name) {
    var ext = extents(pts), pal = pecPalette(seq);
    b.str('LA:' + (String(name || 'Untitled').slice(0, 8) + '                ').slice(0, 16) + '\r');
    for (var i = 0; i < 12; i++) b.u8(0x20);
    b.u8(0xFF); b.u8(0x00); b.u8(6); b.u8(38);
    for (i = 0; i < 12; i++) b.u8(0x20);
    b.u8(pal.length - 1); pal.forEach(function (p) { b.u8(p); });
    for (i = pal.length; i < 463; i++) b.u8(0x20);
    var start = b.a.length;
    b.u8(0); b.u8(0); b.u8(0); b.u8(0); b.u8(0); b.u8(0x31); b.u8(0xFF); b.u8(0xF0);
    b.u16le(Math.round(ext[2] - ext[0])); b.u16le(Math.round(ext[3] - ext[1])); b.u16le(0x1E0); b.u16le(0x1B0);
    var jumping = true, init = true, two = true, x = 0, y = 0;
    pts.forEach(function (p) {
      var dx = p[0] - x, dy = p[1] - y; x = p[0]; y = p[1];
      if (p[2] === 'S') {
        if (jumping) { if (dx !== 0 && dy !== 0) { pecValue(b, 0); pecValue(b, 0); } jumping = false; }
        pecValue(b, dx); pecValue(b, dy);
      } else if (p[2] === 'J') {
        jumping = true;
        var fl = init ? 0x10 : 0x20; // first move is a plain jump; later ones are trim-jumps
        pecValue(b, dx, true, fl); pecValue(b, dy, true, fl);
      } else if (p[2] === 'C') {
        if (jumping) { pecValue(b, 0); pecValue(b, 0); jumping = false; }
        b.u8(0xFE); b.u8(0xB0); b.u8(two ? 2 : 1); two = !two;
      } else if (p[2] === 'E') { b.u8(0xFF); }
      init = false;
    });
    var len = b.a.length - start;
    b.a[start + 2] = len & 255; b.a[start + 3] = (len >> 8) & 255; b.a[start + 4] = (len >> 16) & 255;
    // thumbnails: the whole design, then one per colour
    pecIcon(pts.filter(function (p) { return p[2] === 'S'; }), ext, 4).forEach(function (v) { b.u8(v); });
    var block = [];
    pts.forEach(function (p) {
      if (p[2] === 'C' || p[2] === 'E') { pecIcon(block, ext, 5).forEach(function (v) { b.u8(v); }); block = []; return; }
      if (p[2] === 'S') block.push(p);
    });
  }
  // PES version 1 with one CEmbOne/CSewSeg block (the design as PE-Design sees it), then the PEC block the machine sews
  function writePES(seq, name) {
    var pts = points(seq, 2047), ext = extents(pts), b = new Bytes();
    var pal = seq.threads.map(function (t) { return nearestIn(rgbOf(t.color), PEC_RGB) || 20; });
    b.str('#PES0001');
    var pecAt = b.a.length; b.u32le(0);
    var any = pts.some(function (p) { return p[2] === 'S'; });
    b.u16le(1); b.u16le(1); b.u16le(any ? 1 : 0);
    if (!any) { b.u16le(0); b.u16le(0); }
    else {
      b.u16le(0xFFFF); b.u16le(0);
      b.u16le(7); b.str('CEmbOne');
      for (var i = 0; i < 8; i++) b.u16le(0);
      var w = ext[2] - ext[0], h = ext[3] - ext[1];
      [1, 0, 0, 1, 350 + 650 - w / 2, 100 + h + 900 - h / 2].forEach(function (v) { f32le(b, v); });
      b.u16le(1); b.u16le(0); b.u16le(0); b.u16le(Math.trunc(w)); b.u16le(Math.trunc(h));
      for (i = 0; i < 8; i++) b.u8(0);
      var secAt = b.a.length; b.u16le(0);
      b.u16le(0xFFFF); b.u16le(0);
      b.u16le(7); b.str('CSewSeg');
      // command blocks: runs of stitches, jumps (start and end point) and colour changes
      var segs = [], ci = 0, sx = 0, sy = 0, k = 0;
      while (k < pts.length) {
        var t = pts[k][2], j = k; while (j < pts.length && pts[j][2] === t) j++;
        if (t === 'S') { segs.push({ flag: 0, col: pal[ci], pts: pts.slice(k, j).map(function (p) { return [p[0], p[1]]; }) }); sx = pts[j - 1][0]; sy = pts[j - 1][1]; }
        else if (t === 'J') segs.push({ flag: 1, col: pal[ci], pts: [[sx, sy], [pts[j - 1][0], pts[j - 1][1]]] });
        else if (t === 'C') ci = Math.min(ci + (j - k), pal.length - 1);
        k = j;
      }
      var log = [], prev = -1;
      segs.forEach(function (s, n) {
        if (n) b.u16le(0x8003);
        if (s.col !== prev) { log.push([n, s.col]); prev = s.col; }
        b.u16le(s.flag); b.u16le(s.col); b.u16le(s.pts.length);
        s.pts.forEach(function (p) { i16le(b, Math.trunc(p[0] - ext[0])); i16le(b, Math.trunc(p[1] - ext[3])); });
      });
      b.u16le(log.length); log.forEach(function (l) { b.u16le(l[0]); b.u16le(l[1]); });
      b.a[secAt] = segs.length & 255; b.a[secAt + 1] = (segs.length >> 8) & 255;
      b.u16le(0); b.u16le(0);
    }
    patch32le(b, pecAt, b.a.length);
    writePEC(b, seq, pts, name);
    return b.out();
  }

  // VSM VP3 (PFAFF / Husqvarna Viking): one design, one block per colour, big-endian, UTF-16 strings
  function vp3Str16(b, s) { b.u16be(s.length * 2); for (var i = 0; i < s.length; i++) b.u16be(s.charCodeAt(i)); }
  function vp3Str8(b, s) { s = String(s).replace(/[^\x20-\x7e]/g, '?'); b.u16be(s.length); b.str(s); }
  function i32be(b, v) { b.u32be(Math.trunc(v) | 0); }
  function writeVP3(seq) {
    var pts = points(seq, 255), b = new Bytes(), ext = extents(pts);
    var made = 'Produced by     Software Ltd';
    b.str('%vsm%'); b.u8(0); vp3Str16(b, made);
    b.u8(0); b.u8(2); b.u8(0); var fileAt = b.a.length; b.u32be(0);
    vp3Str16(b, '');
    // colour blocks start at each colour change
    var blocks = [], cur = [], ti = 0;
    pts.forEach(function (p) { if (p[2] === 'C') { blocks.push({ pts: cur, t: seq.threads[ti++] }); cur = [p]; } else cur.push(p); });
    blocks.push({ pts: cur, t: seq.threads[ti] || seq.threads[seq.threads.length - 1] });
    i32be(b, ext[2] * 100); i32be(b, ext[1] * -100); i32be(b, ext[0] * 100); i32be(b, ext[3] * -100);
    b.u32be(pts.length - 1); b.u8(0); b.u8(blocks.length); b.u8(12); b.u8(0); b.u8(1);
    // design block
    b.u8(0); b.u8(3); b.u8(0); var desAt = b.a.length; b.u32be(0);
    var w = ext[2] - ext[0], h = ext[3] - ext[1], hw = w / 2, hh = h / 2, cx = ext[2] - hw, cy = ext[3] - hh;
    i32be(b, Math.trunc(cx) * 100); i32be(b, Math.trunc(cy) * -100); b.u8(0); b.u8(0); b.u8(0);
    i32be(b, Math.trunc(hw) * -100); i32be(b, Math.trunc(hw) * 100); i32be(b, Math.trunc(hh) * -100); i32be(b, Math.trunc(hh) * 100);
    i32be(b, Math.trunc(w) * 100); i32be(b, Math.trunc(h) * 100);
    vp3Str16(b, ''); b.u8(0x64); b.u8(0x64); b.u32be(4096); b.u32be(0); b.u32be(0); b.u32be(4096);
    b.str('xxPP'); b.u8(1); b.u8(0); vp3Str16(b, made);
    b.u16be(blocks.length);
    blocks.forEach(function (blk, n) {
      var s = blk.pts, t = blk.t || { color: '#000000' };
      b.u8(0); b.u8(5); b.u8(0); var blkAt = b.a.length; b.u32be(0);
      var f = s.length ? [s[0][0], s[0][1]] : [0, 0], l = s.length ? [s[s.length - 1][0], s[s.length - 1][1]] : [0, 0];
      if (n === 0) f = [0, 0];
      i32be(b, Math.trunc(f[0] - cx) * 100); i32be(b, Math.trunc(-(f[1] - cy)) * 100);
      var rgb = rgbOf(t.color);
      b.u8(1); b.u8(0); b.u8(rgb[0]); b.u8(rgb[1]); b.u8(rgb[2]); b.u8(0); b.u8(0); b.u8(0); b.u8(5); b.u8(0x28);
      vp3Str8(b, t.thread ? String(t.thread.code) : ''); vp3Str8(b, t.thread ? t.thread.name : t.color); vp3Str8(b, t.thread ? (t.thread.brand || '') : '');
      i32be(b, Math.trunc(l[0] - f[0]) * 100); i32be(b, Math.trunc(-(l[1] - f[1])) * 100);
      b.u8(0); b.u8(1); b.u8(0); var stAt = b.a.length; b.u32be(0);
      b.u8(0x0A); b.u8(0xF6); b.u8(0);
      var lx = f[0], ly = f[1];
      for (var i = 0; i < s.length; i++) {
        var p = s[i];
        if (p[2] === 'E') { b.u8(0x80); b.u8(0x03); break; }
        if (p[2] !== 'S') continue; // VP3 has no jump command: the next stitch is a long move
        var dx = p[0] - lx, dy = p[1] - ly; lx += dx; ly += dy;
        if (dx >= -127 && dx <= 127 && dy >= -127 && dy <= 127) { b.u8(dx); b.u8(dy); }
        else { b.u8(0x80); b.u8(0x01); b.u16be(dx & 0xFFFF); b.u16be(dy & 0xFFFF); b.u8(0x80); b.u8(0x02); }
      }
      patch32be(b, stAt, b.a.length - stAt - 4);
      b.u8(0);
      patch32be(b, blkAt, b.a.length - blkAt - 4);
    });
    patch32be(b, desAt, b.a.length - desAt - 4);
    patch32be(b, fileAt, b.a.length - fileAt - 4);
    return b.out();
  }

  // Singer XXX: little-endian header, byte-pair stitches (y up), 0x7F escapes jumps and colour changes
  function writeXXX(seq) {
    var pts = points(seq, 124), b = new Bytes(), ext = extents(pts), last = pts[pts.length - 1], i;
    for (i = 0; i < 0x17; i++) b.u8(0);
    b.u32le(pts.length - 1);
    for (i = 0; i < 0x0C; i++) b.u8(0);
    b.u32le(seq.threads.length); b.u16le(0);
    i16le(b, Math.trunc(ext[2] - ext[0])); i16le(b, Math.trunc(ext[3] - ext[1]));
    i16le(b, last[0]); i16le(b, -last[1]); i16le(b, -ext[0]); i16le(b, ext[3]);
    for (i = 0; i < 0x42; i++) b.u8(0);
    b.u16le(0); b.u16le(0);
    for (i = 0; i < 0x73; i++) b.u8(0);
    b.u16le(0x20);
    for (i = 0; i < 8; i++) b.u8(0);
    var endAt = b.a.length; b.u32le(0);
    var x = 0, y = 0;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i], dx = p[0] - x, dy = p[1] - y; x = p[0]; y = p[1];
      if (p[2] === 'E') break;
      if (p[2] === 'C') { b.u8(0x7F); b.u8(0x08); b.u8(dx); b.u8(-dy); continue; }
      if (p[2] === 'J') { b.u8(0x7F); b.u8(0x01); b.u8(dx); b.u8(-dy); continue; }
      if (dx > -124 && dx < 124 && dy > -124 && dy < 124) { b.u8(dx); b.u8(-dy); }
      else { b.u8(0x7D); i16le(b, dx); i16le(b, -dy); }
    }
    patch32le(b, endAt, b.a.length);
    b.u8(0x7F); b.u8(0x7F); b.u8(0x02); b.u8(0x14);
    b.u8(0); b.u8(0);
    seq.threads.forEach(function (t) { var c = rgbOf(t.color); b.u8(0); b.u8(c[0]); b.u8(c[1]); b.u8(c[2]); });
    for (i = seq.threads.length; i < 21; i++) b.u32le(0);
    b.u32le(0xFFFFFF00); b.u8(0); b.u8(1);
    return b.out();
  }

  // 24-bit BMP from RGBA pixels (bottom-up rows, 4-byte row padding)
  function writeBMP(rgba, w, h) {
    var row = Math.ceil(w * 3 / 4) * 4, size = 54 + row * h, b = new Bytes();
    b.str('BM'); b.u32le(size); b.u32le(0); b.u32le(54);
    b.u32le(40); b.u32le(w); b.u32le(h); b.u16le(1); b.u16le(24); b.u32le(0); b.u32le(row * h); b.u32le(2835); b.u32le(2835); b.u32le(0); b.u32le(0);
    for (var y = h - 1; y >= 0; y--) {
      for (var x = 0; x < w; x++) { var i = (y * w + x) * 4; b.u8(rgba[i + 2]); b.u8(rgba[i + 1]); b.u8(rgba[i]); }
      for (var p = w * 3; p < row; p++) b.u8(0);
    }
    return b.out();
  }

  // draw the sequence (for the BMP preview and the worksheet image)
  function drawPreview(seq, ctx, w, h, opts) {
    opts = opts || {};
    var bd = seq.bounds, m = opts.margin || 6;
    var s = Math.min((w - 2 * m) / Math.max(1, bd.w), (h - 2 * m) / Math.max(1, bd.h));
    var ox = w / 2 - (bd.minX + bd.w / 2) * s, oy = h / 2 + (bd.minY + bd.h / 2) * s;
    ctx.fillStyle = opts.background || '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = Math.max(1, opts.lineWidth || 0.45 * s); ctx.lineCap = 'round';
    var ci = 0, prev = null;
    ctx.strokeStyle = seq.threads[0] ? seq.threads[0].color : '#000';
    seq.cmds.forEach(function (c) {
      if (c[2] === 'C') { ci++; ctx.strokeStyle = seq.threads[ci] ? seq.threads[ci].color : '#000'; prev = null; return; }
      var p = [ox + c[0] * s, oy - c[1] * s];
      if (c[2] === 'S' && prev) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
      prev = p;
    });
  }

  // ---------- ZIP (stored, no compression) ----------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    // files: [{ name, data: Uint8Array }]
    var out = new Bytes(), central = new Bytes(), d = new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = f.name, crc = crc32(f.data), off = out.a.length;
      out.u32le(0x04034b50); out.u16le(20); out.u16le(0); out.u16le(0); out.u16le(dosTime); out.u16le(dosDate);
      out.u32le(crc); out.u32le(f.data.length); out.u32le(f.data.length); out.u16le(name.length); out.u16le(0); out.str(name);
      for (var i = 0; i < f.data.length; i++) out.a.push(f.data[i]);
      central.u32le(0x02014b50); central.u16le(20); central.u16le(20); central.u16le(0); central.u16le(0); central.u16le(dosTime); central.u16le(dosDate);
      central.u32le(crc); central.u32le(f.data.length); central.u32le(f.data.length); central.u16le(name.length);
      central.u16le(0); central.u16le(0); central.u16le(0); central.u16le(0); central.u32le(0); central.u32le(off); central.str(name);
    });
    var cOff = out.a.length;
    central.a.forEach(function (v) { out.a.push(v); });
    out.u32le(0x06054b50); out.u16le(0); out.u16le(0); out.u16le(files.length); out.u16le(files.length);
    out.u32le(central.a.length); out.u32le(cOff); out.u16le(0);
    return out.out();
  }

  function cardName(n) {
    var b = String(n || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 8);
    return b || 'DESIGN';
  }

  function worksheet(seq, info) {
    var L = [], bd = seq.bounds;
    L.push(info.title + ' - stitch-out worksheet');
    L.push('='.repeat(L[0].length));
    L.push('');
    L.push('Machine       ' + info.machine);
    L.push('Hoop          ' + info.hoopName);
    L.push('Size          ' + bd.w.toFixed(1) + ' x ' + bd.h.toFixed(1) + ' mm');
    L.push('Stitches      ' + seq.stats.stitches.toLocaleString('en-US'));
    L.push('Colours       ' + seq.threads.length + ' (' + seq.stats.colorChanges + ' colour change' + (seq.stats.colorChanges === 1 ? '' : 's') + ')');
    L.push('Jumps         ' + seq.stats.jumps + (info.trims ? ' (the machine trims at colour changes; snip any loose connecting threads)' : ' (snip the connecting threads; the machine has no trimmer)'));
    var spm = info.spm || 600;
    L.push('Est. time     about ' + Math.ceil(seq.stats.minutes) + ' minutes at ' + spm + ' stitches/min');
    if (info.materials && info.materials.length) { L.push(''); L.push('MATERIALS'); info.materials.forEach(function (m) { L.push('  ' + m); }); }
    L.push('');
    L.push('COLOUR SEQUENCE');
    seq.blocks.forEach(function (b, i) {
      L.push('  ' + (i + 1) + '. ' + (b.thread ? (b.thread.brand || 'Janome') + ' ' + b.thread.code + ' ' + b.thread.name : b.color) + '  (' + b.color + ')  ' +
        b.stitches.toLocaleString('en-US') + ' stitches  - ' + b.layers.join(', '));
    });
    L.push('');
    L.push('FILES');
    (info.files || []).forEach(function (f) { L.push('  ' + f); });
    L.push('');
    if (info.load && info.load.length) {
      L.push('LOADING (' + info.machine + ')');
      L.push('  ' + info.load.join(' ').replace(/^To sew: /, ''));
      L.push(info.trims ? '  The machine trims the thread at colour changes; snip any loose connecting threads.' : '  The machine has no trimmer: snip the connecting threads after sewing.');
    } else if (info.machineId === 'eoc06') {
      L.push('LOADING (' + info.machine + ')');
      L.push('  Copy the DST file to a FAT32 USB stick (or send it over Wi-Fi) and open it on the machine.');
      L.push('  Fit the ' + info.hoopName + '. The machine stops at each colour change and trims the thread itself.');
    } else {
      L.push('LOADING (Deco 330)');
      L.push('  Format the card in the machine first; it creates a folder named EmbF5.');
      L.push('  Copy the EXP, INF and BMP files straight into EmbF5 (no subfolders), then select ' + info.hoopName + '.');
      L.push('  If the design will not load, delete the BMP and try again.');
    }
    return L.join('\r\n') + '\r\n';
  }

  return {
    buildSequence: buildSequence, makeXform: makeXform,
    writeEXP: writeEXP, writeINF: writeINF, writeJEF: writeJEF, writeDST: writeDST, writeBMP: writeBMP,
    writePES: writePES, writeVP3: writeVP3, writeXXX: writeXXX,
    drawPreview: drawPreview, zip: zip, crc32: crc32, cardName: cardName, worksheet: worksheet
  };
})();
if (typeof module !== 'undefined') module.exports = StitchExport;
