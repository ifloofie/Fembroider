  // ===================== stitch files: open PES, DST, EXP, JEF, VP3, HUS, XXX, PEC (and zips of them) =====================
  // A stitch file becomes a layer that is sewn exactly as it was digitized. It can be moved, rotated, mirrored and
  // combined with anything else; each colour can be recoloured, left out or sewn earlier or later (pie menu or panel);
  // resizing is limited to ±15%, because scaling finished stitches changes their density.
  var RD = StitchRead;
  var FILE_EXT = /\.(pes|dst|exp|jef|vp3|hus|xxx|pec)$/i, OTHER_EMB = /\.(emb|art|pxf|ofm|sew|pcs|vip|csd|10o|tap|u01|shv|jpx|ksm)$/i;
  var SCALE_MIN = 85, SCALE_MAX = 115;

  function isStitchFile(name) { return FILE_EXT.test(name || '') || OTHER_EMB.test(name || '') || /\.zip$/i.test(name || '') || /\.inf$/i.test(name || ''); }
  function makeStitchLayer(srcId, name) {
    var t = THEME[doc.theme] || A.themes[0], fx = defaultFx(); fx.stroke.on = false;
    return { id: newId(), type: 'stitches', name: name, visible: true, locked: false, thread: 'auto', dirs: [], edits: {}, order: [], merge: {},
      tf: { x: 0, y: 0, rot: 0, mx: false, my: false }, p: { src: srcId, scale: 100 }, colors: themeColors(t), fx: fx };
  }
  // a small picture of the design for the layer list
  function stitchThumb(design) {
    var c = document.createElement('canvas'), S = 96; c.width = c.height = S;
    var x = c.getContext('2d'), b = design.bounds, k = (S - 8) / Math.max(b.w, b.h, 1);
    x.lineWidth = 1; x.lineCap = 'round';
    design.blocks.forEach(function (bl) {
      x.strokeStyle = bl.color; x.beginPath();
      bl.runs.forEach(function (r) { r.forEach(function (q, i) { var px = 4 + (q[0] - b.x0) * k + (S - 8 - b.w * k) / 2, py = 4 + (b.y1 - q[1]) * k + (S - 8 - b.h * k) / 2; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); });
      x.stroke();
    });
    return c.toDataURL('image/png');
  }
  function stitchSource(bytes, name, companions) {
    var design = RD.read(bytes, name, companions);
    return { kind: 'stitches', bytes: bytes, name: name, design: design, thumb: stitchThumb(design) };
  }

  // the layer's result, built straight from the file (no stitch engine): one part per colour block, in mm, centred
  function fileResult(L) {
    var s = SOURCES.get(L.p.src); if (!s || !s.design) return null;
    var d = s.design, b = d.bounds, k = (L.p.scale || 100) / 100, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var T = function (q) { return [(q[0] - cx) * k, (q[1] - cy) * k]; };
    var keys = d.blocks.map(function (bl, i) { return 'block:' + i; }), order = keys.slice();
    if (L.order && L.order.length) {
      var rank = {}; L.order.forEach(function (kk, i) { rank[kk] = i; });
      order.sort(function (a, c) { var ra = rank[a] === undefined ? 1000 + keys.indexOf(a) : rank[a], rc = rank[c] === undefined ? 1000 + keys.indexOf(c) : rank[c]; return ra - rc; });
    }
    var parts = [], ghosts = [], count = 0;
    order.forEach(function (key) {
      var i = keys.indexOf(key), bl = d.blocks[i], runs = bl.runs.map(function (r) { return r.map(T); }), chords = [];
      runs.forEach(function (r) { for (var j = 1; j < r.length; j++) chords.push([r[j - 1][0], r[j - 1][1], r[j][0], r[j][1], 0, -1, 1, -1]); });
      if (stitchOfKey(L, key) === 'skip') {
        var gc = []; for (var g = 0; g < chords.length; g += 4) gc.push(chords[g]);
        var G = { res: 1, x0: -b.w * k / 2 - 1, y1: b.h * k / 2 + 1, w: Math.ceil(b.w * k + 3), h: Math.ceil(b.h * k + 3) };
        G.data = new Uint8Array(G.w * G.h);
        runs.forEach(function (r) { r.forEach(function (q) { var gx = Math.floor((q[0] - G.x0) / G.res), gy = Math.floor((G.y1 - q[1]) / G.res); if (gx >= 0 && gy >= 0 && gx < G.w && gy < G.h) G.data[gy * G.w + gx] = 1; }); });
        ghosts.push({ key: key, color: bl.color, chords: gc, grid: G });
        return;
      }
      count += bl.stitches;
      parts.push({ role: 'colour', color: bl.color, kind: 'stitches', key: key, index: i, runs: runs, chords: chords, thread: E.nearestThread(bl.color),
        fileThread: { name: bl.name, code: bl.code, brand: bl.brand } });
    });
    return { parts: parts, ghosts: ghosts, size: { w: b.w * k, h: b.h * k }, inside: null,
      frame: { x0: -b.w * k / 2, y1: b.h * k / 2, w: b.w * k, h: b.h * k }, stitchCount: count,
      meta: { file: true, format: d.format, noColours: d.noColours, stats: d.stats, designName: d.name }, ms: 0 };
  }

  // ---------- opening ----------
  function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('no inflate'));
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function bytesOf(file) { return file.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function addStitchLayer(bytes, name, companions) {
    var id = 'S' + newId(), src;
    try { src = stitchSource(bytes.slice(), name, companions); }
    catch (e) { toast(e.message); return false; }
    SOURCES.set(id, src);
    var L = makeStitchLayer(id, (name.replace(/^.*\//, '').replace(/\.[^.]+$/, '').trim() || src.design.name || 'Design').slice(0, 60));
    addLayer(L);
    var d = src.design, st = d.blocks.reduce(function (a, x) { return a + x.stitches; }, 0);
    toast('Opened ' + name.replace(/^.*\//, '') + ' · ' + nfmt(st) + ' stitches, ' + d.blocks.length + ' colour' + (d.blocks.length === 1 ? '' : 's') +
      (d.noColours ? ' · this file has no thread colours: click a colour to pick yours' : ''));
    return true;
  }
  // several files at once (an EXP brings its INF colours along); a zip shows the designs it holds
  function importStitchFiles(files) {
    var inf = files.filter(function (f) { return /\.inf$/i.test(f.name); }), rest = files.filter(function (f) { return !/\.inf$/i.test(f.name); });
    if (!rest.length) { toast('An INF file only holds thread colours. Open it together with its EXP file.'); return; }
    Promise.all(inf.map(bytesOf)).then(function (ib) {
      var comp = {}; inf.forEach(function (f, i) { comp[f.name] = ib[i]; });
      rest.forEach(function (f) {
        if (f.size > 40e6) { toast('That file is too large (over 40 MB).'); return; }
        bytesOf(f).then(function (u8) {
          if (/\.zip$/i.test(f.name)) return openZip(u8, f.name);
          addStitchLayer(u8, f.name, comp);
        }).catch(function () { toast('That file could not be read.'); });
      });
    });
  }
  function openZip(u8, zipName) {
    return RD.unzip(u8, inflateRaw).then(function (files) {
      var comp = {}; files.forEach(function (f) { if (/\.inf$/i.test(f.name)) comp[f.name.replace(/^.*\//, '')] = f.data; });
      var designs = RD.designsIn(files);
      if (!designs.length) {
        var emb = files.filter(function (f) { return OTHER_EMB.test(f.name); }).length;
        toast(emb ? 'This zip only has working files Fembroider can’t open (like Wilcom .EMB). Look for a PES, DST, EXP or JEF version.' : 'There are no embroidery designs in ' + zipName + '.');
        return;
      }
      if (designs.length === 1) { addStitchLayer(designs[0].data, designs[0].name.replace(/^.*\//, ''), comp); return; }
      chooseDesign(designs, zipName, comp);
    }, function (e) { toast(e.message || 'This zip file could not be read.'); });
  }
  // a zip with several designs: pick one (or more) from a list with previews
  function chooseDesign(designs, zipName, comp) {
    closePop();
    var p = document.createElement('div');
    p.className = 'float designpop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Designs in ' + zipName);
    var rows = designs.map(function (d, i) {
      var th = '', info = '';
      try { var s = stitchSource(d.data, d.name.replace(/^.*\//, ''), comp); d.src = s; th = '<img alt="" src="' + s.thumb + '">'; var b = s.design.bounds; info = Math.round(b.w) + ' × ' + Math.round(b.h) + ' mm · ' + s.design.blocks.length + ' colour' + (s.design.blocks.length === 1 ? '' : 's'); }
      catch (e) { info = 'can’t be read'; }
      return '<button type="button" class="designrow" data-design="' + i + '"' + (d.src ? '' : ' disabled') + '>' + th + '<span><b>' + esc(d.base) + '</b><small>' + esc(info) + ' · ' + esc(d.formats.join(', ')) + '</small></span></button>';
    }).join('');
    p.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:14px">' + designs.length + ' designs in ' + esc(zipName.replace(/^.*\//, '')) + '</b><button type="button" class="btn sm" data-close>Done</button></div>' +
      '<p class="note">Pick a design to add it. Where a design comes in several formats, the one with the most thread information is used.</p><div class="designlist">' + rows + '</div>';
    document.body.appendChild(p); pop = p;
    p.style.left = Math.max(8, (window.innerWidth - p.offsetWidth) / 2) + 'px'; p.style.top = Math.max(60, (window.innerHeight - p.offsetHeight) / 2) + 'px';
    p.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closePop(); return; }
      var b = e.target.closest('[data-design]'); if (!b || b.disabled) return;
      var d = designs[+b.dataset.design];
      addStitchLayer(d.data, d.name.replace(/^.*\//, ''), comp);
      b.classList.add('added');
    });
    var first = p.querySelector('[data-design]:not([disabled])'); if (first) first.focus();
  }

  // ---------- the panel for a stitch-file layer ----------
  function stitchFileHtml(L) {
    var s = SOURCES.get(L.p.src) || {}, d = s.design, r = rt(L.id).result;
    if (!d) return sec('layer', 'image', 'Stitch file', '', '<p class="note err">The file for this layer is missing.</p>');
    var locked = L.locked ? '<p class="note warn">This layer is locked. Unlock it in the list to edit it.</p>' : '';
    var st = d.blocks.reduce(function (a, x) { return a + x.stitches; }, 0), k = (L.p.scale || 100) / 100;
    var head = '<div style="display:flex;gap:12px;align-items:center"><img alt="" src="' + s.thumb + '" style="width:64px;height:64px;border-radius:8px;background:var(--panel-2)"><div style="min-width:0">' +
      '<div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.name) + '</div>' +
      '<div class="note" style="margin:2px 0 0">' + esc(d.format) + ' · ' + nfmt(st) + ' stitches · ' + Math.round(d.bounds.w * k) + ' × ' + Math.round(d.bounds.h * k) + ' mm</div></div></div>';
    // colours in sewing order (left-out ones included, so they can be brought back)
    var ks = sewKeys(L), rows = ks.map(function (key, n) {
      var i = +key.split(':')[1], bl = d.blocks[i]; if (!bl) return '';
      var cur = snapColour((L.colors.recolor && L.colors.recolor[bl.color]) || bl.color), off = stitchOfKey(L, key) === 'skip';
      var orig = bl.name ? esc(bl.name) + (bl.code ? ' <small>' + esc(bl.code) + '</small>' : '') : threadLabel(cur);
      return '<li class="blockrow' + (off ? ' off' : '') + '"><span class="num">' + (n + 1) + '</span>' +
        '<button type="button" class="swatchbtn' + (off ? ' skipped' : '') + '" data-recolor="' + bl.color + '" aria-label="Recolour colour ' + (n + 1) + '"><span class="sw" style="background:' + cur + '"></span><span class="nm">' + orig + '</span></button>' +
        '<span class="st">' + nfmt(bl.stitches) + '</span>' +
        '<button type="button" class="ibtn" data-block-skip="' + key + '" aria-pressed="' + String(!off) + '" title="' + (off ? 'Sew this colour' : 'Leave this colour out') + '" aria-label="' + (off ? 'Sew' : 'Leave out') + ' colour ' + (n + 1) + '">' + ic(off ? 'eyeOff' : 'eye') + '</button></li>';
    }).join('');
    return sec('layer', 'image', 'Stitch file', esc(d.format), locked + head +
      rangeRow('Size', 'L.p.scale', SCALE_MIN, SCALE_MAX, 1, 0, ' %', { disabled: L.locked }) +
      '<p class="note">Sewn exactly as it was digitized. Resizing is limited to ±15%: beyond that the stitches would sit too far apart or pile up.</p>' +
      '<div class="lab" style="font-size:13.5px;margin-top:6px">Colours in sewing order</div><ul class="blocklist">' + rows + '</ul>' +
      (d.noColours ? '<p class="note">This ' + esc(d.format) + ' file doesn’t store thread colours, so these are placeholders. Click a colour to choose your thread.</p>' : '') +
      '<p class="note">Click a shape in the view to change its colour, leave it out or sew it earlier or later.</p>' +
      (hasAreaEdits(L) || Object.keys(L.colors.recolor || {}).length ? '<div class="btnrow">' + (Object.keys(L.colors.recolor || {}).length ? '<button type="button" class="btn sm" data-act="reset-colours">Reset colours</button>' : '') + (hasAreaEdits(L) ? '<button type="button" class="btn sm" data-act="reset-areas">Reset order &amp; colours left out</button>' : '') + '</div>' : ''));
  }
  // resizing a stitch file: clamp, and say why
  function scaleStitchLayer(L, f) {
    var want = (L.p.scale || 100) * f, got = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(want)));
    if (Math.abs(want - got) > 0.6) toast('Stitch files can only be resized by up to 15%: more would spoil the stitch density. Look for the design in the size you need.');
    L.p.scale = got;
  }
