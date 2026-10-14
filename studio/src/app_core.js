  // ===================== core: assets, theme, worker, document, history, scheduling =====================
  var A = STUDIO_ASSETS, E = StitchEngine, X = StitchExport;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FONT = {}; A.fonts.forEach(function (f) { FONT[f.name] = f; });
  var EMOJI = {}; A.emoji.forEach(function (e) { EMOJI[e.code] = e; });
  var THEME = {}; A.themes.forEach(function (t) { THEME[t.name] = t; });
  // Supported machines (picked from the top bar, like a printer in Cura). Each brings its hoops (sewing fields in mm,
  // width x height as the hoop sits on the machine), the file set it reads and how it handles colours and jumps.
  var MACHINES = {
    deco330: { id: 'deco330', name: 'Bernina Deco 330', format: 'EXP+', files: 'EXP + INF + BMP', folder: 'EmbF5', media: 'memory card', trims: false, spm: 600, defaultHoop: 'A',
      blurb: 'Single needle · no trimmer · EXP+ on a memory card',
      hoops: { A: { name: 'Hoop A', label: 'Hoop A', field: [126, 110], open: 14, r: 12 }, B: { name: 'Hoop B', label: 'Hoop B', field: [140, 200], open: 14, r: 14 }, C: { name: 'Free-arm hoop C', label: 'C · free-arm', field: [50, 50], open: 10, r: 8 } } },
    eoc06: { id: 'eoc06', name: 'Poolin EOC06', format: 'DST', files: 'DST', folder: '', media: 'USB stick', trims: true, spm: 800, defaultHoop: 'L',
      blurb: 'Single needle · trims after each colour · DST on a USB stick or Wi-Fi',
      hoops: { S: { name: '14 × 14 cm hoop', label: '14 × 14', field: [140, 140], open: 16, r: 12 }, M: { name: '20 × 20 cm hoop', label: '20 × 20', field: [200, 200], open: 16, r: 14 }, L: { name: '20 × 28 cm hoop', label: '20 × 28', field: [200, 280], open: 16, r: 16 } } }
  };
  var HOOPS = MACHINES.deco330.hoops; // the current machine's hoops (switched with the machine)
  function machine() { return MACHINES[doc.machine] || MACHINES.deco330; }
  var PLATE = [330, 380];

  function b64ToBuf(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function lin(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (c) { return Math.pow(c, 2.2); });
  }
  function emojiDataUrl(e) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(e.svg); }

  // ---------- fonts: page (for previews) ----------
  var fontsReady = (function () {
    var list = A.uiFonts.concat(A.fonts.map(function (f) { return { family: f.family, weight: f.weight, data: f.data }; }));
    return Promise.all(list.map(function (f) {
      try {
        var face = new FontFace(f.family, b64ToBuf(f.data), { weight: String(f.weight) });
        document.fonts.add(face);
        return face.load().catch(function () {});
      } catch (e) { return Promise.resolve(); }
    }));
  })();

  // ---------- light / dark / system ----------
  var themePref = 'system';
  try { themePref = localStorage.getItem('stitch.theme') || 'system'; } catch (e) {}
  var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark() { return themePref === 'dark' || (themePref === 'system' && darkMQ && darkMQ.matches); }
  function applyTheme() {
    var root = document.documentElement;
    if (themePref === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', themePref);
    document.querySelectorAll('.themeseg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === themePref)); });
    if (typeof onSceneTheme === 'function') onSceneTheme();
  }
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', function () { if (themePref === 'system') applyTheme(); });

  // ---------- stitch generation: background worker with main-thread fallback ----------
  var Gen = (function () {
    var worker = null, seq = 0, pending = new Map(), fontsSent = null;
    var glue = [
      'var Q = Promise.resolve();',
      'self.onmessage = function (e) { var m = e.data; Q = Q.then(function () { return handle(m); }); };',
      'function handle(m) {',
      '  try {',
      '    if (m.type === "fonts") {',
      '      return Promise.all(m.fonts.map(function (f) { var ff = new FontFace(f.family, f.buffer, { weight: String(f.weight) }); self.fonts.add(ff); return ff.load(); }))',
      '        .then(function () { self.postMessage({ id: m.id, result: true }); }, function (err) { self.postMessage({ id: m.id, error: String(err) }); });',
      '    }',
      '    if (m.type === "render") {',
      '      var spec = m.spec; if (m.bitmap) spec.source = m.bitmap;',
      '      var r = StitchEngine.renderLayer(function (w, h) { return new OffscreenCanvas(w, h); }, spec);',
      '      self.postMessage({ id: m.id, result: r });',
      '    }',
      '  } catch (err) { self.postMessage({ id: m.id, error: String(err && err.stack || err) }); }',
      '}'
    ].join('\n');
    function start() {
      try {
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof ENGINE_SOURCE === 'undefined') return;
        var url = URL.createObjectURL(new Blob([ENGINE_SOURCE + '\n' + glue], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = function (e) {
          var m = e.data, p = pending.get(m.id);
          if (!p) return;
          pending.delete(m.id);
          if (m.error) p.reject(new Error(m.error)); else p.resolve(m.result);
        };
        worker.onerror = function () { worker = null; pending.forEach(function (p) { p.reject(new Error('worker failed')); }); pending.clear(); };
      } catch (e) { worker = null; }
    }
    function call(msg) {
      return new Promise(function (resolve, reject) {
        var id = ++seq; msg.id = id; pending.set(id, { resolve: resolve, reject: reject });
        worker.postMessage(msg);
      });
    }
    function mainCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    start();
    if (worker) {
      fontsSent = call({ type: 'fonts', fonts: A.fonts.map(function (f) { return { family: f.family, weight: f.weight, buffer: b64ToBuf(f.data) }; }) })
        .catch(function () { worker = null; });
    }
    return {
      usingWorker: function () { return !!worker; },
      render: function (spec, bitmap) {
        if (worker && (!bitmap || (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap))) {
          return fontsSent.then(function () {
            if (!worker) throw new Error('worker unavailable');
            return call({ type: 'render', spec: spec, bitmap: bitmap || null });
          }).catch(function (err) {
            if (worker) throw err;
            return fontsReady.then(function () { var s = Object.assign({}, spec); if (bitmap) s.source = bitmap; return E.renderLayer(mainCanvas, s); });
          });
        }
        return fontsReady.then(function () {
          return new Promise(function (res) { setTimeout(res, 16); });
        }).then(function () { var s = Object.assign({}, spec); if (bitmap) s.source = bitmap; return E.renderLayer(mainCanvas, s); });
      }
    };
  })();

  // ---------- document ----------
  var uid = 1;
  function newId() { return 'L' + (uid++) + '_' + Math.random().toString(36).slice(2, 6); }
  var doc = {
    machine: 'deco330', hoop: 'A', theme: 'Home', fabric: THEME.Home.fabric, layers: [], sel: null,
    stitch: { v: 2, fillMode: 'patch', satin: false, spacing: null, strokeSpacing: null, tatamiSpacing: null, tatamiStitch: null, pullComp: null, minStitch: null, satinMax: null, split: null, underlay: 'auto', tatamiAngle: null },
    threads: { line: 'janome', weight: 40, needle: '75/11', point: 'sharp', fabric: 'woven', snap: true },
    cardName: '', formats: { jef: true, dst: true, sheet: true }
  };
  var ui = {
    stage: 'design', tool: 'move', view: '3d', ortho: false, allHoops: false, fidelity: 2, light: 'raking',
    twist: 18, sharp: 55, spec: 45, copies: 1, bench: false, sew: 1, playing: false, speed: 1, snap: true,
    applyThemeAll: true, open: { experimental: false, perf: false }
  };
  var RT = new Map();          // layer id -> runtime { result, key, busy, want, group, mesh, mat, preview }
  var SOURCES = new Map();     // source id -> { kind: 'svg'|'bitmap', svg, bitmap, name, thumb }
  var CACHE = new Map();       // render key -> result (small LRU)
  function rt(id) { if (!RT.has(id)) RT.set(id, { result: null, key: null, busy: false, want: null, preview: 1, error: null }); return RT.get(id); }
  function layerById(id) { for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].id === id) return doc.layers[i]; return null; }
  function selLayer() { return doc.sel ? layerById(doc.sel) : null; }

  function defaultFx(theme) {
    return { stroke: { on: true, width: 1.5 }, stroke2: { on: false, width: 1.5 }, shadow: { on: false, dist: 1.8, angle: -45 }, stripes: { on: false, mode: 'solid', dir: 'h', dither: 'diffusion' } };
  }
  function themeColors(t) { return { fill: t.fill, stroke: t.stroke, stroke2: t.stroke2, shadow: t.shadow, bands: t.bands ? t.bands.slice() : null, recolor: {} }; }
  // older saved designs predate stripes
  function normaliseLayer(L) {
    L.fx.stripes = L.fx.stripes || { on: false, dir: 'h' };
    var st = L.fx.stripes;
    st.mode = st.on ? (st.mode && st.mode !== 'solid' ? st.mode : 'stripes') : 'solid';
    st.dither = st.dither || 'diffusion'; st.dir = st.dir || 'h';
    if (L.colors.bands === undefined) L.colors.bands = null;
    L.thread = L.thread === 'auto' || THREADTYPE[L.thread] ? L.thread : 'auto';
    if (!Array.isArray(L.dirs)) L.dirs = [];
    if (L.type === 'text') {
      if (typeof L.p.tail !== 'string') L.p.tail = L.p.tail ? 'classic' : 'none'; // saved before swoop styles
      if (!(L.p.tailWeight > 0)) L.p.tailWeight = 1;
    }
    return L;
  }
  // thread materials: preview sheen and the PBR bake (roughness / metallic)
  var THREADTYPE = {
    rayon: { code: 0, label: 'Rayon', rough: 0.32, metal: 0 },
    poly: { code: 1, label: 'Poly', rough: 0.42, metal: 0 },
    cotton: { code: 2, label: 'Cotton', rough: 0.72, metal: 0 },
    wool: { code: 2, label: 'Wool', rough: 0.8, metal: 0 },
    metallic: { code: 3, label: 'Metal', rough: 0.26, metal: 1 }
  };
  function hasStripes(L) { return L.type === 'text' && L.fx.stripes && L.fx.stripes.on && L.colors.bands && L.colors.bands.length > 1; }
  function makeTextLayer(text, fontName) {
    var f = FONT[fontName] || A.fonts[0], t = THEME[doc.theme] || A.themes[0], fx = defaultFx();
    fx.stripes.on = !!t.bands; fx.stripes.mode = t.bands ? 'stripes' : 'solid';
    if (t.fx) Object.keys(t.fx).forEach(function (k) { fx[k].on = true; });
    return { id: newId(), type: 'text', name: text, visible: true, locked: false, thread: 'auto', dirs: [],
      tf: { x: 0, y: 0, rot: 0, mx: false, my: false },
      p: { text: text, font: f.name, tail: f.tail ? 'classic' : 'none', tailWeight: 1, tilt: f.tilt, width: 0 },
      colors: themeColors(t), fx: fx };
  }
  function makeEmojiLayer(code) {
    var e = EMOJI[code], t = THEME[doc.theme] || A.themes[0];
    var fx = defaultFx(); fx.stroke.on = false;
    return { id: newId(), type: 'emoji', name: e.char + ' ' + (e.label || e.group), visible: true, locked: false, thread: 'auto', dirs: [],
      tf: { x: 0, y: 0, rot: 0, mx: false, my: false }, p: { code: code, size: 45 },
      colors: themeColors(t), fx: fx };
  }
  function makeImageLayer(srcId, name, sizeMM) {
    var t = THEME[doc.theme] || A.themes[0];
    var fx = defaultFx(); fx.stroke.on = false;
    return { id: newId(), type: 'image', name: name, visible: true, locked: false, thread: 'auto', dirs: [],
      tf: { x: 0, y: 0, rot: 0, mx: false, my: false }, p: { src: srcId, size: sizeMM, maxColors: 5, removeBg: true, palette: 'svg' },
      colors: themeColors(t), fx: fx };
  }

  // ---------- history (undo / redo) ----------
  var hist = { past: [], future: [], cur: null };
  function snapshot() { return JSON.stringify({ machine: doc.machine, hoop: doc.hoop, theme: doc.theme, fabric: doc.fabric, layers: doc.layers, sel: doc.sel, stitch: doc.stitch, threads: doc.threads, cardName: doc.cardName, formats: doc.formats }); }
  function commit() {
    var s = snapshot();
    if (s === hist.cur) return;
    if (hist.cur !== null) { hist.past.push(hist.cur); if (hist.past.length > 100) hist.past.shift(); }
    hist.future = []; hist.cur = s;
    updateUndo(); persist();
  }
  function restore(s) {
    var o = JSON.parse(s);
    var was = doc.machine;
    Object.keys(o).forEach(function (k) { doc[k] = o[k]; });
    if (!doc.machine) doc.machine = 'deco330';
    if (doc.machine !== was) machineChanged();
    hist.cur = s;
    syncScene(); renderAll(); updateUndo(); persist();
  }
  function undo() { if (!hist.past.length) return; hist.future.push(hist.cur); restore(hist.past.pop()); toast('Undone'); }
  function redo() { if (!hist.future.length) return; hist.past.push(hist.cur); restore(hist.future.pop()); toast('Redone'); }
  function updateUndo() { $('undoBtn').disabled = !hist.past.length; $('redoBtn').disabled = !hist.future.length; }

  // ---------- render specs & scheduling ----------
  function effectsSpec(L) {
    var fx = L.fx, rad = (fx.shadow.angle || 0) * Math.PI / 180;
    return {
      stroke: { on: !!fx.stroke.on, width: fx.stroke.width, color: '#000001' },
      stroke2: { on: !!(fx.stroke.on && fx.stroke2.on), width: fx.stroke2.width, color: '#000002' },
      shadow: { on: !!fx.shadow.on, dx: +(fx.shadow.dist * Math.cos(rad)).toFixed(2), dy: +(fx.shadow.dist * Math.sin(rad)).toFixed(2), color: '#000003' }
    };
  }
  function specOf(L) {
    var e = effStitch(L);
    var base = { fillMode: e.fillMode, spacingMM: e.tatamiSpacing, satinSpacingMM: e.satinSpacing, strokeSpacingMM: e.strokeSpacing, satinFill: !!doc.stitch.satin, tatamiSpacingMM: e.tatamiSpacing, tatamiStitchMM: e.tatamiStitch,
      pullCompMM: e.pullComp, satinMaxMM: e.satinMax, splitMM: e.split, underlay: e.underlay, tatamiAngleDeg: e.tatamiAngle, threadMM: e.R.width, effects: effectsSpec(L),
      dirs: (L.dirs || []).map(function (d) { return { key: d.key, u: d.u, v: d.v, angle: d.angle }; }) };
    if (L.type === 'text') {
      var f = FONT[L.p.font] || A.fonts[0];
      return Object.assign(base, { kind: 'text', text: L.p.text || ' ', family: '"' + f.family + '"', weight: f.weight === 400 ? undefined : String(f.weight),
        tail: L.p.tail || 'none', tailWeight: L.p.tailWeight || 1, tilt: L.p.tilt, width: L.p.width || 0, colors: { fill: '#000000' },
        bands: hasStripes(L) ? { n: L.colors.bands.length, dir: L.fx.stripes.dir || 'h', mode: L.fx.stripes.mode === 'gradient' ? 'gradient' : 'stripes',
          dither: L.fx.stripes.mode === 'gradient' ? L.fx.stripes.dither : undefined } : undefined });
    }
    if (L.type === 'emoji') {
      var e = EMOJI[L.p.code];
      return Object.assign(base, { kind: 'raster', sizeMM: L.p.size, palette: E.parseSvgPalette(e.svg), srcKey: 'emoji:' + L.p.code });
    }
    var src = SOURCES.get(L.p.src) || {};
    var o = Object.assign(base, { kind: 'raster', sizeMM: L.p.size, maxColors: L.p.maxColors, removeBg: !!L.p.removeBg, srcKey: 'src:' + L.p.src });
    // SVGs keep their own flat fills (in paint order) unless the user asks for automatic colour reduction
    if (src.kind === 'svg' && L.p.palette !== 'auto') {
      if (!src.palette) { try { src.palette = E.parseSvgPalette(src.svg); } catch (e) { src.palette = []; } }
      if (src.palette.length) { o.palette = src.palette; delete o.maxColors; }
    }
    return o;
  }
  function keyOf(spec) { return JSON.stringify(spec); }

  // a raster source rasterised at the size this render needs
  var BITMAPS = new Map();
  function svgBitmap(svg, px) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([svgAtSize(svg, px)], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        var done = function (b) { URL.revokeObjectURL(url); resolve(b); };
        if (window.createImageBitmap) createImageBitmap(img).then(done, function () { done(img); });
        else done(img);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This SVG could not be drawn.')); };
      img.src = url;
    });
  }
  function bitmapFor(L) {
    var px = Math.min(2600, Math.max(200, Math.round(L.p.size * 10)));
    if (L.type === 'emoji') {
      var k = 'e:' + L.p.code + ':' + px;
      if (!BITMAPS.has(k)) BITMAPS.set(k, svgBitmap(EMOJI[L.p.code].svg, px));
      return BITMAPS.get(k);
    }
    var s = SOURCES.get(L.p.src);
    if (!s) return Promise.reject(new Error('Image source missing'));
    if (s.kind === 'svg') {
      var k2 = 's:' + L.p.src + ':' + px;
      if (!BITMAPS.has(k2)) BITMAPS.set(k2, svgBitmap(s.svg, px));
      return BITMAPS.get(k2);
    }
    return Promise.resolve(s.bitmap);
  }

  function requestRender(L) {
    var r = rt(L.id), spec = specOf(L), key = keyOf(spec);
    if (r.key === key && r.result) return;
    if (CACHE.has(key)) { applyResult(L, CACHE.get(key), key); return; }
    r.want = { spec: spec, key: key };
    if (!r.busy) pump(L.id);
    updateBusy();
  }
  function pump(id) {
    var L = layerById(id), r = rt(id);
    if (!L || !r.want) { r.busy = false; updateBusy(); return; }
    var job = r.want; r.want = null; r.busy = true;
    updateBusy(); refreshLayerRow(id);
    var pre = L.type === 'text' ? Promise.resolve(null) : bitmapFor(L);
    pre.then(function (bm) { return Gen.render(job.spec, bm); }).then(function (res) {
      CACHE.set(job.key, res);
      if (CACHE.size > 40) CACHE.delete(CACHE.keys().next().value);
      var L2 = layerById(id);
      if (L2 && keyOf(specOf(L2)) === job.key) applyResult(L2, res, job.key);
      r.error = null;
    }).catch(function (err) {
      r.error = err && err.message || String(err);
      toast('Could not stitch this layer: ' + r.error.split('\n')[0]);
    }).then(function () {
      r.busy = false;
      if (r.want) pump(id); else { updateBusy(); refreshLayerRow(id); }
    });
  }
  function applyResult(L, res, key) {
    var r = rt(L.id);
    if (tidyDirs(L, res)) { commit(); requestRender(L); }
    r.result = res; r.key = key; r.preview = 1;
    buildLayerMesh(L);
    sceneChanged();
    refreshLayerRow(L.id);
    if (doc.sel === L.id) refreshToolPanel();
    scheduleSequence();
  }
  function renderAllLayers() { doc.layers.forEach(requestRender); }
  function anyBusy() { var n = 0; RT.forEach(function (r) { if (r.busy || r.want) n++; }); return n; }
  function updateBusy() {
    var n = anyBusy();
    $('busyChip').hidden = !n;
    $('busyText').textContent = n === 1 ? 'Stitching 1 layer…' : 'Stitching ' + n + ' layers…';
  }

  // colour of a part after layer colours and recolouring
  // colour of a part, snapped to the chosen thread chart when "match my threads" is on
  function partColor(L, part) { return snapColour(rawPartColor(L, part)); }
  function rawPartColor(L, part) {
    if (part.role === 'fill') return L.colors.fill;
    if (part.role === 'band') return (L.colors.bands && L.colors.bands[part.band]) || L.colors.fill;
    if (part.role === 'stroke') return L.colors.stroke;
    if (part.role === 'stroke2') return L.colors.stroke2;
    if (part.role === 'shadow') return L.colors.shadow;
    return (L.colors.recolor && L.colors.recolor[part.color]) || part.color;
  }
  function layerSize(L) { var r = rt(L.id); return r.result ? { w: r.result.size.w * r.preview, h: r.result.size.h * r.preview } : null; }
  function layerCorners(L) {
    var s = layerSize(L); if (!s) return null;
    var xf = X.makeXform({ x: L.tf.x, y: L.tf.y, rotation: L.tf.rot, mirrorX: L.tf.mx, mirrorY: L.tf.my });
    return [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]].map(xf.fwd);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
