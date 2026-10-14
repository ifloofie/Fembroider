  // ===================== interface: panels, tools, pickers, input =====================
  var ICON = {
    layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    emoji: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 10h.01M15 10h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    fx: '<path d="M4 20 14 10"/><path d="m16 3 1.2 2.8L20 7l-2.8 1.2L16 11l-1.2-2.8L12 7l2.8-1.2z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.4-1.2-1.7-1.2-3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><path d="M7.5 11h.01M10 7h.01M15 7.5h.01"/>',
    hoop: '<rect x="3" y="4" width="18" height="16" rx="5"/><rect x="7" y="8" width="10" height="8" rx="2"/>',
    fill: '<path d="M4 6l4 12 4-12 4 12 4-12"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    sheen: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6M9 8h3"/>',
    machine: '<path d="M4 18h16M6 18V8a3 3 0 0 1 3-3h9v5h-6v8"/><path d="M15 10v3"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    card: '<path d="M7 3h8l4 4v14H7z"/><path d="M10 3v4M13 3v4"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  function ic(name, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  var nfmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  function fmtTime(min) {
    if (!isFinite(min)) return '—';
    var m = Math.max(1, Math.ceil(min));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  }
  function threadLabel(hex) { var t = threadFor(hex); return t ? esc(t.name) + ' <small>' + esc(t.code) + '</small>' : esc(String(hex)); }

  // ---------- generic bindings: data-k is a path into the selected layer (L.), the document (doc.) or view settings (ui.) ----------
  function rootOf(k) { var h = k.split('.')[0]; return h === 'L' ? selLayer() : h === 'doc' ? doc : ui; }
  function getPath(k) { var o = rootOf(k), ps = k.split('.').slice(1); for (var i = 0; o && i < ps.length; i++) o = o[ps[i]]; return o; }
  function setPath(k, v) {
    var o = rootOf(k), ps = k.split('.').slice(1);
    if (!o) return;
    for (var i = 0; i < ps.length - 1; i++) o = o[ps[i]];
    o[ps[ps.length - 1]] = v;
  }
  function fmtOut(el, v) {
    var dp = +(el.dataset.dp || 0), u = el.dataset.unit || '';
    return (v === 0 && el.dataset.zero) ? el.dataset.zero : (+v).toFixed(dp) + u;
  }
  var renderTimers = new Map(), allTimer = null;
  function debounceRender(L, ms) {
    clearTimeout(renderTimers.get(L.id));
    renderTimers.set(L.id, setTimeout(function () { renderTimers.delete(L.id); if (layerById(L.id)) requestRender(L); }, ms || 260));
  }
  function applyPath(k) {
    var L = selLayer();
    if (k.indexOf('L.') === 0 && !L) return;
    if (k.indexOf('L.colors') === 0) { recolorLayer(L); refreshLayerRow(L.id); scheduleSequence(); return; }
    if (k.indexOf('L.tf') === 0) { placeLayer(L); sceneChanged(); refreshToolPanel(); return; }
    if (k === 'L.name') { L.customName = true; refreshLayerRow(L.id); return; }
    if (k === 'L.p.text') { if (!L.customName) L.name = L.p.text || 'Text'; refreshLayerRow(L.id); }
    if (k === 'L.fx.stripes.mode') {
      L.fx.stripes.on = L.fx.stripes.mode !== 'solid';
      if (L.fx.stripes.on && !(L.colors.bands && L.colors.bands.length > 1)) L.colors.bands = L.fx.stripes.mode === 'gradient' ? [L.colors.fill, L.colors.stroke2 !== L.colors.fill ? L.colors.stroke2 : '#ffffff'] : THEME['Rainbow · Stripes'].bands.slice();
    }
    if (k === 'L.thread') { recolorLayer(L); requestRender(L); renderPanelSoon(); return; }
    if (k.indexOf('L.fx.stripes') === 0) doc.theme = '';
    if (k.indexOf('L.') === 0) { debounceRender(L); return; }
    if (k.indexOf('doc.stitch') === 0) { clearTimeout(allTimer); allTimer = setTimeout(renderAllLayers, 300); return; }
    if (k.indexOf('doc.threads') === 0) {
      if (k === 'doc.threads.line') doc.threads.weight = lineOf().weight;
      clearTimeout(allTimer); allTimer = setTimeout(threadsChanged, 120);
      if (k !== 'doc.threads.snap') renderPanelSoon();
      return;
    }
    if (k === 'doc.fabric') { styleHoops(); clearTimeout(allTimer); allTimer = setTimeout(threadsChanged, 400); return; }
    if (k === 'doc.hoop') { styleHoops(); updateFit(); goTo(ui.view === 'custom' ? '3d' : ui.view); return; }
    if (k === 'doc.cardName') { var cn = $('cardNote'); if (cn) cn.textContent = exportName(); updateAction(); return; }
    if (k.indexOf('doc.formats') === 0) { updateAction(); return; }
    if (k === 'ui.allHoops') { styleHoops(); return; }
    if (k === 'ui.copies') { rebuildCopies(); scheduleShadow(); goTo(ui.view === 'custom' ? '3d' : ui.view); return; }
    if (k === 'ui.fidelity') { resize(); }
    applyLook();
  }
  function readCtl(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') {
      if (el.value === '' && el.dataset.empty !== undefined) return +el.dataset.empty;
      var v = parseFloat(el.value);
      if (!isFinite(v)) return null;
      if (el.type === 'number' && el.dataset.clamp) { var mn = parseFloat(el.min), mx = parseFloat(el.max); if (isFinite(mn)) v = Math.max(mn, v); if (isFinite(mx)) v = Math.min(mx, v); }
      return v;
    }
    if (el.dataset.upper) return el.value.toUpperCase();
    return el.value;
  }
  var rpTimer = null;
  function renderPanelSoon() { clearTimeout(rpTimer); rpTimer = setTimeout(renderPanel, 30); }
  function onCtlInput(e) {
    var el = e.target, k = el.dataset && el.dataset.k;
    if (!k) return;
    var v = readCtl(el);
    if (v === null) return;
    if (el.type === 'number' && el.dataset.live === undefined) return;   // numeric fields apply on Enter / blur
    setPath(k, v);
    var out = el.parentNode.querySelector('output');
    if (out) out.textContent = fmtOut(out, v);
    if (el.dataset.eff) { var chip = el.parentNode.querySelector('.autochip'); if (chip) chip.setAttribute('aria-pressed', 'false'); }
    applyPath(k);
  }
  function onCtlChange(e) {
    var el = e.target, k = el.dataset && el.dataset.k;
    if (!k) return;
    var v = readCtl(el);
    if (v === null) { refreshValues(); return; }
    setPath(k, v);
    applyPath(k);
    if (el.type === 'checkbox' && el.dataset.rerender !== undefined) renderPanel();
    if (el.type === 'number') refreshValues();
    commit();
  }
  function onSegClick(btn) {
    var k = btn.dataset.set, raw = btn.dataset.v, v = raw;
    if (raw === 'true' || raw === 'false') v = raw === 'true'; else if (raw !== '' && !isNaN(+raw)) v = +raw;
    setPath(k, v);
    btn.parentNode.querySelectorAll('[data-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    applyPath(k);
    if (btn.dataset.rerender !== undefined) renderPanel();
    if (k.indexOf('L.') === 0 || k.indexOf('doc.') === 0) commit();
  }
  // refresh control values in place (after undo, drags, numeric edits) without rebuilding the panel
  function refreshValues() {
    document.querySelectorAll('#panelBody [data-k], #toolpanel [data-k]').forEach(function (el) {
      if (el === document.activeElement) return;
      var v = getPath(el.dataset.k);
      if (el.dataset.eff) { v = effStitch(selLayer())[el.dataset.eff]; if (v === null) return; }
      if (v === undefined || v === null) return;
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'number' && el.dataset.empty !== undefined && v === +el.dataset.empty) el.value = '';
      else if (el.type === 'number' && el.dataset.dp) el.value = (+v).toFixed(+el.dataset.dp);
      else el.value = v;
      var out = el.parentNode.querySelector('output');
      if (out) out.textContent = fmtOut(out, v);
    });
    var sz = $('tpSize'); if (sz) { var L = selLayer(), s = L && layerSize(L); sz.textContent = s ? s.w.toFixed(1) + ' × ' + s.h.toFixed(1) + ' mm' : '—'; }
  }

  // ---------- small HTML builders ----------
  function sec(id, icon, title, meta, body) {
    var open = ui.open[id] !== false;
    return '<details class="sec" data-sec="' + id + '"' + (open ? ' open' : '') + '><summary>' + ic(icon) + '<span>' + esc(title) + '</span>' +
      (meta ? '<span class="meta">' + meta + '</span>' : '') + ic('chev', 'chev') + '</summary><div class="sec-body">' + body + '</div></details>';
  }
  var fid = 0;
  function row(label, ctl, id) { return '<div class="row">' + (id ? '<label for="' + id + '">' + label + '</label>' : '<span class="lab">' + label + '</span>') + ctl + '</div>'; }
  function range(k, min, max, step, dp, unit, opts) {
    opts = opts || {};
    var id = 'f' + (++fid), v = getPath(k);
    return [id, '<div class="ctl"><input type="range" id="' + id + '" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"' + (opts.disabled ? ' disabled' : '') + '>' +
      '<output data-dp="' + dp + '" data-unit="' + (unit || '') + '"' + (opts.zero ? ' data-zero="' + opts.zero + '"' : '') + '>' + (v === 0 && opts.zero ? opts.zero : (+v).toFixed(dp) + (unit || '')) + '</output></div>'];
  }
  function rangeRow(label, k, min, max, step, dp, unit, opts) { var r = range(k, min, max, step, dp, unit, opts); return row(label, r[1], r[0]); }
  function seg(k, options, opts) {
    opts = opts || {};
    var cur = getPath(k);
    return '<div class="seg" role="group"' + (opts.label ? ' aria-label="' + esc(opts.label) + '"' : '') + '>' + options.map(function (o) {
      return '<button type="button" data-set="' + k + '" data-v="' + o[0] + '" aria-pressed="' + String(cur === o[0]) + '"' + (opts.rerender ? ' data-rerender' : '') +
        (opts.disabled ? ' disabled' : '') + (o[3] ? ' title="' + esc(o[3]) + '"' : '') + '>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function check(k, label, opts) {
    opts = opts || {};
    var id = 'f' + (++fid);
    return '<div class="row"><label for="' + id + '">' + label + '</label><div class="ctl"><input type="checkbox" id="' + id + '" data-k="' + k + '"' + (getPath(k) ? ' checked' : '') +
      (opts.rerender ? ' data-rerender' : '') + (opts.disabled ? ' disabled' : '') + '></div></div>';
  }
  function swatch(k, title, hex, opts) {
    opts = opts || {};
    return '<button type="button" class="swatchbtn" data-color="' + k + '" data-title="' + esc(title) + '"' + (opts.disabled ? ' disabled' : '') +
      ' aria-label="' + esc(title) + ' colour"><span class="sw" style="background:' + hex + '"></span><span class="nm">' + threadLabel(hex) + '</span></button>';
  }

  // ---------- stage switching ----------
  var STAGES = { design: 'Design', stitch: 'Stitch settings', export: 'Export' };
  function setStage(s) {
    if (!STAGES[s]) return;
    var was = ui.stage;
    ui.stage = s;
    document.querySelectorAll('.stages [data-stage]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.stage === s)); b.tabIndex = b.dataset.stage === s ? 0 : -1; });
    $('panel').setAttribute('aria-labelledby', 'tab-' + s);
    $('panelTitle').textContent = STAGES[s];
    $('playbar').hidden = s !== 'stitch';
    if (s !== 'stitch') { ui.playing = false; ui.bench = false; if (ui.sew < 1) { ui.sew = 1; applySew(); } refreshPlay(); }
    $('hint').textContent = s === 'design'
      ? 'Drag a layer to move it · Right-drag or drag empty space: orbit · Middle or Shift-drag: pan · Scroll: zoom'
      : 'Right-drag or drag: orbit · Middle or Shift-drag: pan · Scroll: zoom · Double-click: reset view';
    closePop();
    rebuildCopies(); buildGizmo(); scheduleShadow();
    renderPanel(); refreshToolPanel(); updateAction();
    if (was !== s && ui.copies > 1 && (was === 'stitch' || s === 'stitch')) goTo(ui.view === 'custom' ? '3d' : ui.view);
  }

  function renderPanel() {
    var body = $('panelBody'), ae = document.activeElement, key = null, s0 = null, s1 = null, scroll = body.scrollTop;
    if (ae && body.contains(ae)) { key = ae.dataset.k ? '[data-k="' + ae.dataset.k + '"]' : ae.id ? '#' + ae.id : null; try { s0 = ae.selectionStart; s1 = ae.selectionEnd; } catch (e) {} }
    fid = 0;
    body.innerHTML = ui.stage === 'design' ? designHtml() : ui.stage === 'stitch' ? stitchHtml() : exportHtml();
    body.scrollTop = scroll;
    if (key) { var el = body.querySelector(key); if (el) { el.focus({ preventScroll: true }); try { if (s0 !== null) el.setSelectionRange(s0, s1); } catch (e) {} } }
    var n = doc.layers.length;
    $('panelSub').textContent = ui.stage === 'design' ? n + (n === 1 ? ' layer' : ' layers') : ui.stage === 'stitch' ? 'Fill, preview & display' : machine().name + ' · ' + machine().format;
    if (ui.stage === 'stitch') updatePerf();
    applyTips(body);
  }
  function renderAll() {
    document.querySelectorAll('.tools [data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === ui.tool)); });
    renderPanel(); refreshToolPanel(); updateFit(); styleHoops(); updateAction(); buildGizmo();
  }

  // ---------- DESIGN stage ----------
  function layerColours(L) {
    var r = rt(L.id), out = [];
    if (r.result) r.result.parts.forEach(function (p) { var c = partColor(L, p); if (out.indexOf(c) < 0) out.push(c); });
    else if (L.type === 'text') out.push(L.colors.fill);
    return out;
  }
  function thumbHtml(L) {
    if (L.type === 'text') { var f = FONT[L.p.font] || A.fonts[0]; return '<span style="font-family:\'' + f.family + '\';font-weight:' + f.weight + ';font-size:15px;color:' + L.colors.fill + '">Aa</span>'; }
    if (L.type === 'emoji') return '<img alt="" src="' + emojiDataUrl(EMOJI[L.p.code]) + '">';
    var s = SOURCES.get(L.p.src); return s && s.thumb ? '<img alt="" src="' + s.thumb + '">' : ic('image');
  }
  function layerRowHtml(L) {
    var r = rt(L.id), sel = doc.sel === L.id, busy = r.busy || r.want;
    var dots = layerColours(L).slice(0, 8).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('');
    var meta = busy ? '<span class="spin" aria-label="Stitching"></span> stitching…' : r.error ? '<span style="color:var(--bad)">error</span>' : r.result ? dots + '&nbsp;' + nfmt(r.result.stitchCount) + ' st' : '…';
    var kind = L.type === 'text' ? 'Text' : L.type === 'emoji' ? 'Emoji' : 'Image';
    return '<li class="layer' + (L.visible ? '' : ' hiddenL') + '" role="option" aria-selected="' + sel + '" data-id="' + L.id + '" draggable="true" tabindex="' + (sel ? 0 : -1) + '" aria-label="' + esc(kind + ': ' + L.name) + '">' +
      '<span class="grip" title="Drag to change the sewing order">' + ic('grip') + '</span>' +
      '<span class="thumb">' + thumbHtml(L) + '</span>' +
      '<span class="lname"><b>' + esc(L.name) + '</b><span>' + meta + '</span></span>' +
      '<button type="button" class="ibtn" data-act="vis" aria-pressed="' + String(!L.visible) + '" aria-label="' + (L.visible ? 'Hide' : 'Show') + ' ' + esc(L.name) + '" title="' + (L.visible ? 'Hide' : 'Show') + '">' + ic(L.visible ? 'eye' : 'eyeOff') + '</button>' +
      '<button type="button" class="ibtn" data-act="lock" aria-pressed="' + String(!!L.locked) + '" aria-label="' + (L.locked ? 'Unlock' : 'Lock') + ' ' + esc(L.name) + '" title="' + (L.locked ? 'Unlock' : 'Lock') + '">' + ic(L.locked ? 'lock' : 'unlock') + '</button></li>';
  }
  function layersHtml() {
    var add = '<div class="addrow"><button type="button" class="btn" data-act="add-text">' + ic('text') + 'Text</button><button type="button" class="btn" data-act="add-emoji">' + ic('emoji') + 'Emoji</button><button type="button" class="btn" data-act="add-image">' + ic('image') + 'Import</button></div>';
    if (!doc.layers.length) return add + '<p class="note">No layers yet. Add some text or an emoji, or import an SVG or picture — you can also drop a file anywhere on the plate.</p>';
    var L = selLayer(), idx = L ? doc.layers.indexOf(L) : -1;
    return add + '<ul class="layers" id="layerList" role="listbox" aria-label="Layers, top first">' + doc.layers.slice().reverse().map(layerRowHtml).join('') + '</ul>' +
      '<div class="btnrow four">' +
      '<button type="button" class="btn sm" data-act="raise"' + (idx < 0 || idx === doc.layers.length - 1 ? ' disabled' : '') + ' title="Sew later (Alt+↑)">' + ic('up') + 'Raise</button>' +
      '<button type="button" class="btn sm" data-act="lower"' + (idx <= 0 ? ' disabled' : '') + ' title="Sew earlier (Alt+↓)">' + ic('down') + 'Lower</button>' +
      '<button type="button" class="btn sm" data-act="duplicate"' + (L ? '' : ' disabled') + '>Duplicate</button>' +
      '<button type="button" class="btn sm" data-act="delete"' + (L ? '' : ' disabled') + '>' + ic('trash') + 'Delete</button></div>' +
      '<p class="note">The bottom layer sews first. Double-click a name to rename it.</p>';
  }
  function recolorHtml(L) {
    var r = rt(L.id);
    if (!r.result) return '<p class="note">Colours appear once the layer is stitched.</p>';
    var seen = {}, rows = '';
    r.result.parts.forEach(function (p) {
      if (p.role !== 'colour' || seen[p.color]) return;
      seen[p.color] = 1;
      var cur = partColor(L, p);
      rows += '<button type="button" class="swatchbtn" data-recolor="' + p.color + '" data-title="Recolour" aria-label="Recolour ' + p.color + '"><span class="sw" style="background:' + cur + '"></span><span class="nm">' + threadLabel(cur) + '</span></button>';
    });
    var any = Object.keys(L.colors.recolor || {}).length;
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' + rows + '</div>' +
      (r.result.meta && r.result.meta.bgRemoved ? '<p class="note">Background ' + r.result.meta.bgRemoved + ' removed.</p>' : '') +
      (any ? '<div class="btnrow"><button type="button" class="btn sm" data-act="reset-colours">Reset colours</button></div>' : '');
  }
  // swoop (swash tail) styles, each with a small drawing of its shape
  var SWOOPS = [
    ['none', 'None', ''],
    ['classic', 'Classic', 'M30 6c4-1 6 1 5 4s-4 4-8 4C20 14 10 15 4 17'],
    ['sweep', 'Long sweep', 'M30 6c4-1 6 1 5 4s-4 4-8 4C18 15 8 17 1 20'],
    ['flick', 'Flick', 'M30 6c4-1 6 1 5 4s-4 4-8 4C20 15 12 16 7 17c-4 1-5-2-3-6'],
    ['bar', 'Bar', 'M30 7c3 0 4 2 3 4s-3 3-6 3H5'],
    ['lead', 'Lead-in', 'M8 6c-2 4-5 9-2 10s14-1 29-6'],
    ['twin', 'Twin', 'M30 6c4-1 6 1 5 4s-4 4-8 4C20 14 10 15 4 17', 'M28 18C21 18 13 19 8 20']
  ];
  function swoopHtml(L) {
    var cur = L.p.tail || 'none', dis = L.locked ? ' disabled' : '';
    var tiles = SWOOPS.map(function (s) {
      var paths = s.slice(2).filter(Boolean).map(function (d, i) { return '<path d="' + d + '"' + (i ? ' stroke-width="1"' : '') + '/>'; }).join('');
      var art = s[0] === 'none' ? '<svg viewBox="0 0 40 22" aria-hidden="true"><path d="M6 17h28" stroke-dasharray="2 3" stroke-width="1"/></svg>' : '<svg viewBox="0 0 40 22" aria-hidden="true">' + paths + '</svg>';
      return '<button type="button" class="swoop" data-set="L.p.tail" data-v="' + s[0] + '" data-rerender aria-pressed="' + String(cur === s[0]) + '"' + dis + '>' + art + '<span>' + s[1] + '</span></button>';
    }).join('');
    return '<div class="row swooprow"><span class="lab">Swoop</span><div class="swoops" role="group" aria-label="Swoop style">' + tiles + '</div></div>' +
      (cur !== 'none' ? rangeRow('Swoop weight', 'L.p.tailWeight', 0.6, 1.6, 0.05, 2, '×', { disabled: L.locked }) : '');
  }
  function selectedHtml(L) {
    if (!L) return '';
    var locked = L.locked ? '<p class="note warn">This layer is locked. Unlock it in the list to edit it.</p>' : '';
    if (L.type === 'text') {
      var f = FONT[L.p.font] || A.fonts[0], sample = (L.p.text || 'Text').slice(0, 12);
      var kinds = ['All', 'Script', 'Athletic', 'Block', 'Serif', 'Fun'];
      if (kinds.indexOf(ui.fontKind) < 0) ui.fontKind = f.kind || 'All';
      var chips = '<div class="fkinds" role="group" aria-label="Font style">' + kinds.map(function (k) {
        var n = k === 'All' ? A.fonts.length : A.fonts.filter(function (g) { return g.kind === k; }).length;
        return '<button type="button" data-set="ui.fontKind" data-v="' + k + '" data-rerender aria-pressed="' + String(ui.fontKind === k) + '">' + k + ' <small>' + n + '</small></button>';
      }).join('') + '</div>';
      var fonts = chips + '<div class="fontlist" role="group" aria-label="Font">' + A.fonts.filter(function (g) { return ui.fontKind === 'All' || g.kind === ui.fontKind || g.name === f.name; }).map(function (g) {
        return '<button type="button" class="fontcard" data-act="font" data-v="' + esc(g.name) + '" aria-pressed="' + String(g.name === f.name) + '"><span class="smp" style="font-family:\'' + g.family + '\';font-weight:' + g.weight + '">' + esc(sample) + '</span><span class="fn">' + esc(g.name) + ' · ' + esc(g.category) + '</span></button>';
      }).join('') + '</div>';
      var wid = 'f' + (++fid);
      return sec('layer', 'text', 'Text', esc(f.name), locked +
        '<input class="field big" data-k="L.p.text" maxlength="40" value="' + esc(L.p.text) + '" aria-label="Text" style="font-family:\'' + f.family + '\';font-weight:' + f.weight + '"' + (L.locked ? ' disabled' : '') + '>' +
        fonts +
        '<p class="note">' + A.fonts.length + ' open-source fonts (SIL OFL 1.1 / Apache 2.0). Script fonts join up and suit a swoop; heavy Athletic and Block faces sew cleanest at small sizes.</p>' +
        swoopHtml(L) +
        rangeRow('Slant', 'L.p.tilt', 0, 14, 1, 0, '°') +
        row('Width', '<div class="ctl"><div class="unit" style="width:120px"><input class="field num" style="width:100%" type="number" id="' + wid + '" data-k="L.p.width" data-empty="0" data-clamp min="20" max="190" step="1" placeholder="auto" value="' + (L.p.width || '') + '"><i>mm</i></div><span class="note">blank = natural</span></div>', wid) +
        fillHtml(L) + threadHtml(L));
    }
    if (L.type === 'emoji') {
      var e = EMOJI[L.p.code];
      return sec('layer', 'emoji', 'Emoji', esc(e.group), locked +
        '<div style="display:flex;gap:12px;align-items:center"><img alt="" src="' + emojiDataUrl(e) + '" style="width:56px;height:56px"><button type="button" class="btn" data-act="change-emoji"' + (L.locked ? ' disabled' : '') + '>Change emoji…</button></div>' +
        rangeRow('Size', 'L.p.size', 15, 120, 1, 0, ' mm') + threadHtml(L) +
        '<div class="lab" style="font-size:13.5px">Thread colours</div><div id="recolorBox">' + recolorHtml(L) + '</div>');
    }
    var s = SOURCES.get(L.p.src) || {}, isSvg = s.kind === 'svg';
    var kind = isSvg ? 'SVG' : 'Picture' + (s.bitmap ? ' · ' + s.bitmap.width + ' × ' + s.bitmap.height + ' px' : '');
    return sec('layer', 'image', 'Imported art', esc(kind), locked +
      '<div style="display:flex;gap:12px;align-items:center">' + (s.thumb ? '<img alt="" src="' + s.thumb + '" style="width:56px;height:56px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff">' : '') +
      '<div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.name || L.name) + '</b><span class="note">' + kind + '</span></div></div>' +
      rangeRow('Size', 'L.p.size', 15, 190, 1, 0, ' mm') + threadHtml(L) +
      (isSvg ? row('Colours', seg('L.p.palette', [['svg', 'From SVG fills'], ['auto', 'Reduce']], { rerender: true, label: 'Colour source' })) : '') +
      (!isSvg || L.p.palette === 'auto' ? rangeRow('Max colours', 'L.p.maxColors', 2, 8, 1, 0, '') : '') +
      check('L.p.removeBg', 'Remove background', {}) +
      '<p class="note">Thin details under about 0.6 mm are merged into neighbouring colours so every area can be stitched.</p>' +
      '<div class="lab" style="font-size:13.5px">Thread colours</div><div id="recolorBox">' + recolorHtml(L) + '</div>');
  }
  function effectsHtml(L) {
    if (!L) return '';
    var fx = L.fx, dis = L.locked;
    var dirs = [[-45, '↘'], [-135, '↙'], [45, '↗'], [135, '↖']];
    return sec('effects', 'fx', 'Stroke & shadow', [fx.stroke.on ? 'stroke' : '', fx.stroke.on && fx.stroke2.on ? '2nd stroke' : '', fx.shadow.on ? 'shadow' : ''].filter(Boolean).join(' · ') || 'none',
      check('L.fx.stroke.on', '<b>Outline stroke</b>', { rerender: true, disabled: dis }) +
      (fx.stroke.on ? rangeRow('Width', 'L.fx.stroke.width', 0.8, 4, 0.1, 1, ' mm', { disabled: dis }) + row('Colour', swatch('L.colors.stroke', 'Stroke', L.colors.stroke, { disabled: dis })) + autoRange('Stroke spacing', 'strokeSpacing', 0.12, 0.8, 0.01, 2, ' mm', 'all outlines') : '') +
      check('L.fx.stroke2.on', '<b>Second stroke</b>', { rerender: true, disabled: dis || !fx.stroke.on }) +
      (fx.stroke.on && fx.stroke2.on ? rangeRow('Width', 'L.fx.stroke2.width', 0.8, 4, 0.1, 1, ' mm', { disabled: dis }) + row('Colour', swatch('L.colors.stroke2', 'Second stroke', L.colors.stroke2, { disabled: dis })) : '') +
      check('L.fx.shadow.on', '<b>Drop shadow</b>', { rerender: true, disabled: dis }) +
      (fx.shadow.on ? rangeRow('Distance', 'L.fx.shadow.dist', 0.6, 4, 0.1, 1, ' mm', { disabled: dis }) +
        row('Direction', seg('L.fx.shadow.angle', dirs.map(function (d) { return [d[0], d[1], '', 'Shadow toward ' + d[1]]; }), { label: 'Shadow direction', disabled: dis })) +
        row('Colour', swatch('L.colors.shadow', 'Shadow', L.colors.shadow, { disabled: dis })) : '') +
      '<p class="note">Sewing order: shadow, second stroke, fill, then the outline stroke on top.</p>');
  }
  // solid fill, flag stripes, or a dithered gradient between thread colours
  function fillHtml(L) {
    var st = L.fx.stripes, dis = L.locked, mode = hasStripes(L) ? st.mode : 'solid';
    var head = row('Fill', seg('L.fx.stripes.mode', [['solid', 'Solid'], ['stripes', 'Stripes'], ['gradient', 'Gradient']], { rerender: true, label: 'Fill style', disabled: dis }));
    if (mode === 'solid') return head + row('Fill colour', swatch('L.colors.fill', 'Fill', L.colors.fill, { disabled: dis }));
    var b = L.colors.bands, word = mode === 'gradient' ? 'Colour' : 'Stripe';
    return head +
      '<div class="lab" style="font-size:12.5px;color:var(--muted)">' + (mode === 'gradient' ? 'Gradient colours, first to last' : 'Stripe threads, first stripe first') + '</div>' +
      '<div class="bandrow" role="group" aria-label="' + word + ' threads">' + b.map(function (c, i) {
        var t = threadFor(c);
        return '<button type="button" class="bandsw" data-band="' + i + '" style="background:' + c + '"' + (dis ? ' disabled' : '') + ' title="' + word + ' ' + (i + 1) + ': ' + esc(t.name) + ' ' + t.code + '" aria-label="' + word + ' ' + (i + 1) + ', ' + esc(t.name) + ' ' + t.code + '"></button>';
      }).join('') + '</div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="band-remove"' + (dis || b.length <= 2 ? ' disabled' : '') + '>− ' + word + '</button>' +
      '<button type="button" class="btn sm" data-act="band-add"' + (dis || b.length >= 8 ? ' disabled' : '') + '>+ ' + word + '</button>' +
      '<button type="button" class="btn sm" data-act="band-reverse"' + (dis ? ' disabled' : '') + '>Reverse</button></div>' +
      row('Direction', seg('L.fx.stripes.dir', [['h', 'Across'], ['v', 'Down'], ['d', 'Diagonal']], { label: 'Direction', disabled: dis })) +
      (mode === 'gradient'
        ? row('Dither', seg('L.fx.stripes.dither', [['diffusion', 'Diffusion', '', 'Error diffusion along the sewing order: smoothest blend'], ['ordered', 'Ordered', '', 'Even, regular mix of rows']], { label: 'Dither method', disabled: dis })) +
          '<p class="note">Thread can’t mix, so each satin row is sewn in one of the two nearest colours, in proportion to where it sits along the gradient. Each colour sews as a satin at double spacing that the next colour fills in. Expect one colour change per colour and a few more jumps to snip.</p>'
        : '<p class="note">Each stripe is its own thread with a 0.25 mm overlap at the seams. Stripes that use the same thread are sewn together, so the trans flag needs 3 colour changes, not 5.</p>');
  }
  function threadHtml(L) {
    var id = 'f' + (++fid), opts = [['auto', 'Same as thread line (' + MATERIAL[lineOf().material].label + ')'], ['rayon', 'Rayon'], ['poly', 'Polyester'], ['cotton', 'Cotton'], ['wool', 'Wool blend'], ['metallic', 'Metallic']];
    return row('Thread', '<select class="field" id="' + id + '" data-k="L.thread"' + (L.locked ? ' disabled' : '') + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === (L.thread || 'auto') ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>', id) +
      (layerMaterial(L) === 'metallic' ? '<p class="note">Metallic: Auto opens the density 15%, keeps satins under 5 mm and lengthens the shortest stitch. Sew slowly with a metallic needle.</p>' : '');
  }
  function flagSwatch(f, cls) {
    var stripes = '<span class="fstripes">' + f.stripes.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>';
    var extra = f.chevron ? '<span class="fchev">' + f.chevron.map(function (c, i) { return '<i style="background:' + c + ';left:' + (-30 + i * 9) + '%;z-index:' + (10 - i) + '"></i>'; }).join('') + '</span>'
      : f.ring ? '<span class="fring" style="border-color:' + f.ring + '"></span>'
      : f.heart ? '<span class="fheart" style="color:' + f.heart + '">♥</span>' : '';
    return '<span class="' + (cls || 'fl') + '" aria-hidden="true">' + stripes + extra + '</span>';
  }
  function themeCard(t) {
    var sw = '<span class="strip">' + (t.bands
      ? '<i style="background:' + t.fabric + '"></i><i class="bands" style="flex:3">' + t.bands.map(function (c) { return '<b style="background:' + c + '"></b>'; }).join('') + '</i>'
      : '<i style="background:' + t.fabric + '"></i><i style="background:' + t.fill + ';flex:2"></i>') +
      '<i style="background:' + t.stroke + '"></i><i style="background:' + t.stroke2 + '"></i><i style="background:' + t.shadow + '"></i></span>';
    var label = t.group === 'Pride' ? t.way : t.name;
    return '<button type="button" class="theme" data-act="theme" data-v="' + esc(t.name) + '" aria-pressed="' + String(doc.theme === t.name) + '" aria-label="' + esc(t.name) + ' colourway">' + sw + '<span class="tn">' + esc(label) + '</span></button>';
  }
  var FLAG = {}; A.flags.forEach(function (f) { FLAG[f.name] = f; });
  function themesHtml() {
    var cur = THEME[doc.theme];
    if (!ui.themeGroup) ui.themeGroup = cur && cur.group === 'Pride' ? 'Pride' : 'Classic';
    if (!ui.prideFlag) ui.prideFlag = cur && cur.flag ? cur.flag : 'Rainbow';
    var body;
    if (ui.themeGroup === 'Pride') {
      var f = FLAG[ui.prideFlag] || A.flags[0];
      body = '<div class="flags" role="group" aria-label="Pride flags">' + A.flags.map(function (g) {
        return '<button type="button" class="flagcard" data-act="flag" data-v="' + esc(g.name) + '" aria-pressed="' + String(g.name === f.name) + '" title="' + esc(g.note) + '">' + flagSwatch(g) + '<span class="tn">' + esc(g.name) + '</span></button>';
      }).join('') + '</div>' +
        '<div class="flaghead">' + flagSwatch(f, 'fl big') + '<div><b>' + esc(f.name) + '</b><span class="note">' + esc(f.note) + '</span></div></div>' +
        '<div class="themes" role="group" aria-label="' + esc(f.name) + ' colourways">' + A.themes.filter(function (t) { return t.flag === f.name; }).map(themeCard).join('') + '</div>' +
        '<p class="note">Solid colourways carry the flag through the fill, outline, second outline and shadow; Stripes sews the fill in flag order. You can switch any text to a dithered Gradient of the same colours in its Fill settings. Every colour is a Janome thread, so the preview matches the sewn piece.</p>';
    } else {
      body = '<div class="themes" role="group" aria-label="Classic colourways">' + A.themes.filter(function (t) { return t.group === 'Classic'; }).map(themeCard).join('') + '</div>' +
        '<p class="note">A colourway recolours the fill, strokes and shadow of every layer and sets the fabric.</p>';
    }
    return sec('colourway', 'palette', 'Colourway', esc(doc.theme || 'Custom'),
      seg('ui.themeGroup', [['Classic', 'Classic', A.themes.filter(function (t) { return t.group === 'Classic'; }).length + ' themes'], ['Pride', 'Pride', A.flags.length + ' flags']], { rerender: true, label: 'Colourway group' }) +
      body +
      row('Fabric', '<div class="ctl"><input type="color" id="fabricInput" data-k="doc.fabric" value="' + doc.fabric + '" style="width:44px;height:32px;border:0;background:none;padding:0"><span class="val" style="text-align:left">' + doc.fabric + '</span></div>', 'fabricInput'));
  }
  function hoopHtml() {
    return sec('hoop', 'hoop', 'Hoop', esc(HOOPS[doc.hoop].field.join(' × ') + ' mm'),
      seg('doc.hoop', Object.keys(HOOPS).map(function (k) { return [k, HOOPS[k].label, HOOPS[k].field.join('×')]; }), { label: 'Hoop' }) +
      check('ui.allHoops', 'Show the other hoops') +
      '<p class="note">' + esc(machine().name) + ' hoops. Change the machine from the button at the top left.</p>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="centre-all"' + (doc.layers.length ? '' : ' disabled') + '>Centre design in hoop</button></div>');
  }
  function designHtml() {
    var L = selLayer();
    return sec('layers', 'layers', 'Layers', doc.layers.length ? String(doc.layers.length) : '', layersHtml()) +
      selectedHtml(L) + effectsHtml(L) + themesHtml() + hoopHtml();
  }

  // ---------- STITCH stage ----------
  // ---- thread, needle & fabric; Direction / Density / Satin & fill with Auto values that follow them ----
  var EFF = { spacing: 'satinSpacing', strokeSpacing: 'strokeSpacing', tatamiSpacing: 'tatamiSpacing', tatamiStitch: 'tatamiStitch', pullComp: 'pullComp', minStitch: 'minStitch', satinMax: 'satinMax', split: 'split', tatamiAngle: 'tatamiAngle' };
  function autoRange(label, key, min, max, step, dp, unit, hint) {
    var e = effStitch(selLayer()), v = e[EFF[key]], isAuto = doc.stitch[key] === null || doc.stitch[key] === undefined, id = 'f' + (++fid);
    var shown = v === null ? 45 : v;
    return '<div class="row"><label for="' + id + '">' + label + (hint ? '<small class="hint2">' + hint + '</small>' : '') + '</label><div class="ctl">' +
      '<button type="button" class="autochip" data-auto="' + key + '" aria-pressed="' + isAuto + '" title="' + (isAuto ? 'Auto: follows your thread, needle and fabric' : 'Custom value. Click to return to Auto') + '">Auto</button>' +
      '<input type="range" id="' + id + '" data-k="doc.stitch.' + key + '" data-eff="' + EFF[key] + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + shown + '">' +
      '<output data-dp="' + dp + '" data-unit="' + unit + '">' + (v === null ? 'auto' : (+v).toFixed(dp) + unit) + '</output></div></div>';
  }
  function threadSectionHtml() {
    var T = doc.threads, line = lineOf(), R = recommend(), metalLayers = doc.layers.filter(function (L) { return layerMaterial(L) === 'metallic'; }).length;
    var lines = A.threadLines.map(function (l) { return '<option value="' + l.id + '"' + (l.id === T.line ? ' selected' : '') + '>' + esc(l.brand + ' · ' + l.line) + ' (' + l.chart.length + ')</option>'; }).join('');
    var lid = 'f' + (++fid), nid = 'f' + (++fid), fid2 = 'f' + (++fid);
    var notes = R.notes.slice();
    if (metalLayers && line.material !== 'metallic' && T.point !== 'metallic') notes.push(['warn', metalLayers + (metalLayers === 1 ? ' layer uses' : ' layers use') + ' metallic thread: switch to a metallic needle for those colours.']);
    var recNeedle = T.needle !== R.needle || T.point !== R.point;
    return sec('threads', 'machine', 'Thread, needle & fabric', esc(line.brand + ' · ' + T.weight + ' wt'),
      row('Thread line', '<select class="field" id="' + lid + '" data-k="doc.threads.line">' + lines + '</select>', lid) +
      row('Weight', seg('doc.threads.weight', [[60, '60', 'fine'], [40, '40', 'std'], [30, '30', 'bold'], [12, '12', 'heavy']], { label: 'Thread weight', rerender: true })) +
      '<p class="note">' + esc(MATERIAL[line.material].label) + ', ' + esc(WEIGHTS[T.weight].label) + ': ' + esc(WEIGHTS[T.weight].note) + '. ' + esc(MATERIAL[line.material].note) + '</p>' +
      check('doc.threads.snap', 'Match colours to this chart', { rerender: true }) +
      row('Needle size', '<select class="field" id="' + nid + '" data-k="doc.threads.needle">' + NEEDLES.map(function (n) { return '<option' + (n === T.needle ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>', nid) +
      row('Needle point', seg('doc.threads.point', Object.keys(POINTS).map(function (k) { return [k, POINTS[k]]; }), { label: 'Needle point', rerender: true })) +
      row('Fabric', '<select class="field" id="' + fid2 + '" data-k="doc.threads.fabric">' + Object.keys(FABRICS).map(function (k) { return '<option value="' + k + '"' + (k === T.fabric ? ' selected' : '') + '>' + esc(FABRICS[k].label) + '</option>'; }).join('') + '</select>', fid2) +
      '<div class="reccard"><dl class="kv"><dt>Recommended needle</dt><dd>' + R.needle + ' ' + POINTS[R.point].toLowerCase() + '</dd><dt>Backing</dt><dd style="font-family:var(--font-ui);font-size:12.5px;max-width:190px">' + esc(R.stab) + '</dd>' +
      '<dt>Bobbin</dt><dd style="font-family:var(--font-ui);font-size:12.5px">60–90 wt bobbin thread</dd><dt>Thread lies</dt><dd>' + R.width.toFixed(2) + ' mm wide</dd><dt>Auto density</dt><dd>' + R.sp.toFixed(2) + ' / ' + R.tsp.toFixed(2) + ' mm</dd><dt>Auto pull comp.</dt><dd>' + R.pc.toFixed(2) + ' mm</dd><dt>Auto underlay</dt><dd style="font-family:var(--font-ui);font-size:12.5px">' + UNDERLAY[R.underlay] + '</dd></dl>' +
      '<ul class="tnotes">' + notes.map(function (n) { return '<li class="' + n[0] + '">' + esc(n[1]) + '</li>'; }).join('') + '</ul>' +
      (recNeedle ? '<div class="btnrow"><button type="button" class="btn sm" data-act="use-rec-needle">Use ' + R.needle + ' ' + POINTS[R.point].toLowerCase() + '</button></div>' : '') + '</div>');
  }
  // Cura-style grouping: the settings that matter every time first, then Experimental and Diagnostics folded away
  function underlaySelect() {
    var R = recommend(), uid = 'f' + (++fid), cur = doc.stitch.underlay || 'auto';
    return row('Underlay', '<select class="field" id="' + uid + '" data-k="doc.stitch.underlay">' + [['auto', 'Auto (' + UNDERLAY[R.underlay].toLowerCase() + ')'], ['center', UNDERLAY.center], ['edge', UNDERLAY.edge], ['zigzag', UNDERLAY.zigzag], ['none', UNDERLAY.none]].map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>', uid);
  }
  function qualityHtml() {
    return sec('density', 'fill', 'Quality', '',
      autoRange('Fill spacing', 'tatamiSpacing', 0.18, 1.0, 0.01, 2, ' mm', 'row to row') +
      autoRange('Stroke spacing', 'strokeSpacing', 0.12, 0.8, 0.01, 2, ' mm', 'outlines') +
      autoRange('Pull compensation', 'pullComp', 0, 0.8, 0.01, 2, ' mm', 'edges sewn wider') +
      autoRange('Shortest stitch', 'minStitch', 0.2, 1.2, 0.05, 2, ' mm', 'shorter is merged') +
      '<p class="note">Smaller spacing is denser. Auto follows the thread weight, the fabric (knits and terry need different coverage) and the needle (a big needle leaves bigger holes).</p>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="stitch-auto">Reset everything to Auto</button></div>');
  }
  function infillHtml() {
    return sec('infill', 'fx', 'Infill', doc.stitch.tatamiAngle === null || doc.stitch.tatamiAngle === undefined ? 'auto' : doc.stitch.tatamiAngle + '°',
      autoRange('Fill angle', 'tatamiAngle', 0, 180, 5, 0, '°', 'all areas') +
      autoRange('Stitch length', 'tatamiStitch', 2, 5, 0.1, 1, ' mm', 'along a row') +
      underlaySelect() +
      '<p class="note">Auto runs rows across strokes and small shapes, and at 45° to the long axis of big areas, which hides the row breaks best. Each area sews in one unbroken back-and-forth pass before moving on.</p>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="tool-direction">Set direction per area… (D)</button></div>');
  }
  function experimentalHtml() {
    var on = !!doc.stitch.satin;
    return sec('experimental', 'flask', 'Experimental', on ? 'satin fill on' : '',
      check('doc.stitch.satin', '<b>Satin fill</b><small class="hint2">curved columns in strokes</small>', { rerender: true }) +
      '<p class="note">Sews narrow strokes as satin columns that turn with the letter, instead of fill rows. It looks glossier when it works, but complex joins (like the loops of a script B) can still leave gaps, crossings or bunching.</p>' +
      (on ? autoRange('Satin spacing', 'spacing', 0.15, 0.95, 0.01, 2, ' mm', 'row to row') +
        autoRange('Satin up to', 'satinMax', 4, 12, 0.5, 1, ' mm', 'wider becomes fill') +
        autoRange('Split satin over', 'split', 4, 12, 0.5, 1, ' mm', 'long stitches') +
        row('Gap repair', seg('doc.stitch.fillMode', [['patch', 'Patch', '', 'Patch small missed spots'], ['whole', 'Re-fill', '', 'Refill the whole island in one direction'], ['off', 'Off']], { label: 'Gap repair' })) : ''));
  }
  function stitchHtml() {
    var rep = doc.layers.map(function (L) {
      var r = rt(L.id); if (!r.result) return '';
      var gaps = r.result.parts.reduce(function (a, p) { return a + (p.gapsMM2 || 0); }, 0);
      return '<dt>' + esc(L.name) + '</dt><dd>' + nfmt(r.result.stitchCount) + ' st · ' + (gaps > 0.05 ? gaps.toFixed(1) + ' mm² gaps' : 'no gaps') + '</dd>';
    }).join('');
    return threadSectionHtml() + qualityHtml() + infillHtml() + experimentalHtml() +
      sec('look', 'sheen', 'Preview', '',
        row('Play speed', seg('ui.speed', [[1, '1×'], [4, '4×'], [16, '16×']], { label: 'Playback speed' })) +
        row('Lighting', seg('ui.light', [['top', 'Top'], ['raking', 'Raking'], ['soft', 'Soft']], { label: 'Lighting' })) +
        row('Fidelity', seg('ui.fidelity', [[0, 'Low', 'flat'], [1, 'Med', 'round'], [2, 'High', 'twist'], [3, 'Ultra', 'plies']], { label: 'Fidelity' })) +
        rangeRow('Twist', 'ui.twist', 8, 30, 1, 0, ' /in') +
        rangeRow('Sheen sharpness', 'ui.sharp', 10, 120, 1, 0, '') +
        rangeRow('Sheen strength', 'ui.spec', 0, 100, 1, 0, '%') +
        '<p class="note">Play at the bottom of the view shows the needle path layer by layer, in sewing order.</p>') +
      sec('perf', 'gauge', 'Diagnostics', '',
        row('Stress test', seg('ui.copies', [[1, '1×'], [4, '4×'], [9, '9×'], [16, '16×']], { label: 'Copies' })) +
        '<div style="display:flex;align-items:end;justify-content:space-between;gap:12px"><div class="fps" id="fpsBig">—<small>fps</small></div>' +
        '<button type="button" class="btn" data-act="bench" aria-pressed="' + ui.bench + '">' + (ui.bench ? 'Stop benchmark' : 'Run benchmark') + '</button></div>' +
        '<dl class="kv" id="perfKv"></dl>' +
        '<p class="note">Rendering is on demand: the view only redraws when something moves. The benchmark spins the camera to measure sustained frame rate.</p>' +
        (rep ? '<h4 class="subh">Layers</h4><dl class="kv">' + rep + '</dl>' : ''));
  }
  function updatePerf() {
    var kv = $('perfKv'); if (!kv) return;
    var inst = 0; doc.layers.forEach(function (L) { var r = rt(L.id); if (L.visible && r.count) inst += r.count; });
    inst *= Math.max(1, effCopies());
    var ft = frames.length ? frames.reduce(function (a, b) { return a + b; }, 0) / frames.length : 0;
    $('fpsBig').innerHTML = (ui.bench && ft ? Math.round(1000 / ft) : '—') + '<small>fps</small>';
    kv.innerHTML = '<dt>Frame time</dt><dd>' + (ui.bench && ft ? ft.toFixed(1) + ' ms' : 'idle') + '</dd>' +
      '<dt>Stitches drawn</dt><dd>' + nfmt(inst) + '</dd><dt>Triangles</dt><dd>' + nfmt(inst * threadTemplate().userData.tris) + '</dd>' +
      '<dt>Draw calls</dt><dd>' + (ui.calls || 0) + '</dd><dt>Resolution</dt><dd>' + (ui.resText || '—') + '</dd>' +
      '<dt>Stitch generator</dt><dd>' + (Gen.usingWorker() ? 'background' : 'main thread') + '</dd>' +
      '<dt>GPU</dt><dd style="font-size:11.5px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(GPU_NAME) + '">' + esc(GPU_NAME) + '</dd>';
  }
  setInterval(function () { if (ui.stage === 'stitch') updatePerf(); }, 500);
  function applyLook() {
    if ((shared.uLevel.value >= 3) !== (ui.fidelity >= 3)) { doc.layers.forEach(function (L) { if (rt(L.id).result) buildLayerMesh(L); }); if (ui.copies > 1) rebuildCopies(); } // swap stitch geometry
    shared.uLevel.value = ui.fidelity;
    shared.uTwist.value = ui.twist / 25.4;
    shared.uSharp.value = ui.sharp;
    var Lt = LIGHTS[ui.light] || LIGHTS.raking;
    shared.uLight.value.fromArray(Lt.dir).normalize();
    plateMat.uniforms.uLight.value.copy(shared.uLight.value);
    shared.uSpec.value = ui.spec / 100 * Lt.spec;
    scheduleShadow(); requestDraw();
  }
  function refreshPlay() {
    var b = $('playBtn'); b.textContent = ui.playing ? 'Pause' : 'Play';
    b.setAttribute('aria-pressed', String(ui.playing));
  }

  // ---------- fit check & action panel ----------
  function designBounds() {
    var b = null;
    doc.layers.forEach(function (L) {
      if (!L.visible) return; var c = layerCorners(L); if (!c) return;
      b = b || { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      c.forEach(function (p) { b.minX = Math.min(b.minX, p[0]); b.maxX = Math.max(b.maxX, p[0]); b.minY = Math.min(b.minY, p[1]); b.maxY = Math.max(b.maxY, p[1]); });
    });
    return b;
  }
  var fitState = { ok: false, empty: true, text: '' };
  function updateFit() {
    var chip = $('fitChip'), b = designBounds(), H = HOOPS[doc.hoop];
    if (!b) { fitState = { ok: false, empty: true, text: 'Add a layer to begin' }; chip.className = 'chip na'; $('fitText').textContent = fitState.text; updateAction(); return; }
    var hx = H.field[0] / 2, hy = H.field[1] / 2, w = b.maxX - b.minX, h = b.maxY - b.minY;
    var over = Math.max(b.maxX - hx, -hx - b.minX, b.maxY - hy, -hy - b.minY);
    if (over > 0.05) {
      var alt = Object.keys(HOOPS).filter(function (k) { return k !== doc.hoop && w <= HOOPS[k].field[0] && h <= HOOPS[k].field[1]; })[0];
      fitState = { ok: false, empty: false, w: w, h: h, over: over,
        text: (w > H.field[0] || h > H.field[1] ? 'Too big for ' + H.name + ' by ' + Math.max(w - H.field[0], h - H.field[1]).toFixed(1) + ' mm' : 'Outside the sewing field by ' + over.toFixed(1) + ' mm') + (alt ? ' · fits ' + HOOPS[alt].name : '') };
      chip.className = 'chip out';
    } else {
      fitState = { ok: true, empty: false, w: w, h: h, text: 'Fits ' + H.name + ' · ' + w.toFixed(0) + ' × ' + h.toFixed(0) + ' mm' };
      chip.className = 'chip';
    }
    $('fitText').textContent = fitState.text;
    updateAction();
  }
  function updateAction() {
    var btn = $('actionBtn'), main = $('estMain'), sub = $('estSub'), busy = anyBusy();
    if (!doc.layers.length) { main.textContent = 'Nothing to stitch yet'; sub.textContent = 'Add text, an emoji or an image'; }
    else if (busy || seqStale || !lastSeq) { main.textContent = busy ? 'Stitching…' : 'Planning the sewing path…'; sub.textContent = fitState.text || ''; }
    else {
      var st = lastSeq.stats;
      main.textContent = '≈ ' + fmtTime(st.minutes) + ' · ' + lastSeq.threads.length + (lastSeq.threads.length === 1 ? ' colour' : ' colours');
      sub.textContent = nfmt(st.stitches) + ' stitches · ' + st.jumps + (st.jumps === 1 ? ' jump' : ' jumps');
    }
    if (ui.stage === 'design') { btn.textContent = 'Next: Stitch settings'; btn.disabled = !doc.layers.length; }
    else if (ui.stage === 'stitch') { btn.textContent = 'Next: Export'; btn.disabled = !doc.layers.length; }
    else { btn.textContent = machine().media === 'memory card' ? 'Save card files' : 'Save machine files'; btn.disabled = !canExport(); }
  }
  function canExport() { return !!(doc.layers.length && fitState.ok && lastSeq && !seqStale && !anyBusy()); }

  // ---------- tool panel (beside the tool bar) ----------
  function toolPanelHtml(L) {
    var dis = L.locked ? ' disabled' : '';
    if (ui.tool === 'direction') return dirPanelHtml(L);
    var head = '<h3>' + { move: 'Move', rotate: 'Rotate', scale: 'Scale', mirror: 'Mirror' }[ui.tool] + ' · <span style="font-weight:400">' + esc(L.name) + '</span></h3>';
    var lock = L.locked ? '<p class="note warn">Locked — unlock it in the layer list to transform it.</p>' : '';
    var num = function (k, label, unit, dp, step) { return '<label style="display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)">' + label + '<span class="unit"><input class="field num" style="width:100%" type="number" step="' + (step || 0.5) + '" data-k="' + k + '" data-dp="' + dp + '" value="' + (+getPath(k)).toFixed(dp) + '"' + dis + '><i>' + unit + '</i></span></label>'; };
    if (ui.tool === 'move') return head + lock + '<div class="grid2">' + num('L.tf.x', 'X', 'mm', 1) + num('L.tf.y', 'Y', 'mm', 1) + '</div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="centre-layer"' + dis + '>Centre in hoop</button></div>' +
      '<p class="note">Drag the layer, or use the arrow keys (Shift = 10 mm). Positions are from the hoop centre.</p>';
    if (ui.tool === 'rotate') return head + lock + '<div class="grid2">' + num('L.tf.rot', 'Angle', '°', 0, 1) + '<span></span></div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-rot="-90"' + dis + '>−90°</button><button type="button" class="btn sm" data-rot="-15"' + dis + '>−15°</button><button type="button" class="btn sm" data-rot="15"' + dis + '>+15°</button><button type="button" class="btn sm" data-rot="90"' + dis + '>+90°</button></div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-rot="0"' + dis + '>Reset</button></div>' +
      '<p class="note">Drag the round handle. It snaps to 15°; hold Shift to rotate freely.</p>';
    if (ui.tool === 'scale') return head + lock + '<div class="kv"><dt>Size</dt><dd id="tpSize">—</dd></div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-scale="0.9"' + dis + '>−10%</button><button type="button" class="btn sm" data-scale="1.1"' + dis + '>+10%</button><button type="button" class="btn sm" data-scale="fit"' + dis + '>Fit to hoop</button></div>' +
      '<p class="note">Drag a corner handle. Stitches are regenerated at the new size, so density and pull stay correct.</p>';
    return head + lock + '<div class="btnrow"><button type="button" class="btn" data-act="flip-x" aria-pressed="' + !!L.tf.mx + '"' + dis + '>Flip horizontal</button><button type="button" class="btn" data-act="flip-y" aria-pressed="' + !!L.tf.my + '"' + dis + '>Flip vertical</button></div>' +
      '<p class="note">Mirrors the sewing path too. Useful for designs sewn on the back of sheer fabric.</p>';
  }
  function refreshToolPanel() {
    var tp = $('toolpanel'), L = selLayer(), show = ui.stage === 'design' && !!L;
    tp.hidden = !show;
    if (!show) { tp.dataset.sig = ''; $('workspace').classList.remove('tp-open'); return; }
    var sig = ui.tool + '|' + L.id + '|' + L.locked + '|' + L.name + '|' + L.tf.mx + L.tf.my + '|' + JSON.stringify(L.dirs || []);
    var typing = tp.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (tp.dataset.sig !== sig && !typing) { tp.innerHTML = toolPanelHtml(L); tp.dataset.sig = sig; applyTips(tp); }
    $('workspace').classList.toggle('tp-open', show);
    refreshValues();
  }

  // ---------- layer operations ----------
  function selectLayer(id) {
    doc.sel = id;
    buildGizmo();
    if (ui.stage === 'design') renderPanel();
    refreshToolPanel();
  }
  function refreshLayerRow(id) {
    var li = document.querySelector('#layerList [data-id="' + id + '"]'), L = layerById(id);
    if (li && L) { var tmp = document.createElement('ul'); tmp.innerHTML = layerRowHtml(L); li.replaceWith(tmp.firstChild); }
    if (L && doc.sel === id) { var box = $('recolorBox'); if (box) box.innerHTML = recolorHtml(L); }
    updateAction();
  }
  function addLayer(L) {
    var n = doc.layers.length;
    if (n) { var H = HOOPS[doc.hoop]; L.tf.y = Math.max(-H.field[1] / 2 + 15, Math.min(H.field[1] / 2 - 15, [0, 30, -30][n % 3])); }
    doc.layers.push(L); doc.sel = L.id;
    requestRender(L);
    if (ui.stage !== 'design') setStage('design'); else renderPanel();
    refreshToolPanel(); sceneChanged(); commit();
  }
  function addText() {
    var L = makeTextLayer('Text', (selLayer() && selLayer().type === 'text') ? selLayer().p.font : A.fonts[0].name);
    addLayer(L);
    setTimeout(function () { var el = document.querySelector('[data-k="L.p.text"]'); if (el) { el.focus(); el.select(); } }, 30);
  }
  function duplicateLayer() {
    var L = selLayer(); if (!L) return;
    var c = JSON.parse(JSON.stringify(L));
    c.id = newId(); c.tf.x += 8; c.tf.y -= 8; c.locked = false;
    if (L.customName) c.name = L.name + ' copy';
    doc.layers.splice(doc.layers.indexOf(L) + 1, 0, c); doc.sel = c.id;
    requestRender(c); renderPanel(); refreshToolPanel(); doc.layers.forEach(placeLayer); sceneChanged(); commit();
  }
  function deleteLayer() {
    var L = selLayer(); if (!L) return;
    var i = doc.layers.indexOf(L), r = rt(L.id);
    doc.layers.splice(i, 1);
    if (r.group) layerRoot.remove(r.group);
    RT.delete(L.id);
    doc.sel = doc.layers.length ? doc.layers[Math.min(i, doc.layers.length - 1)].id : null;
    doc.layers.forEach(placeLayer);
    renderPanel(); refreshToolPanel(); sceneChanged(); applySew(); commit();
    toast('Deleted “' + L.name + '” · Ctrl+Z to undo');
  }
  function moveLayer(L, delta) {
    var i = doc.layers.indexOf(L), j = Math.max(0, Math.min(doc.layers.length - 1, i + delta));
    if (i === j) return;
    doc.layers.splice(i, 1); doc.layers.splice(j, 0, L);
    doc.layers.forEach(placeLayer); renderPanel(); sceneChanged(); applySew(); commit();
  }
  function scaleLayerBy(L, f) {
    var r = rt(L.id); if (!r.result || L.locked) return;
    if (L.type === 'text') L.p.width = Math.round(Math.max(20, Math.min(190, r.result.size.w * f)));
    else L.p.size = Math.round(Math.max(10, Math.min(200, L.p.size * f)) * 2) / 2;
    r.preview = f;
    requestRender(L);
    if (!r.busy && !r.want) r.preview = 1;
    placeLayer(L); sceneChanged(); refreshValues(); commit();
  }
  function fitToHoop(L) {
    var s = layerSize(L), c = layerCorners(L); if (!s || !c) return;
    var H = HOOPS[doc.hoop], xs = c.map(function (p) { return p[0]; }), ys = c.map(function (p) { return p[1]; });
    var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    var f = Math.min(H.field[0] * 0.92 / bw, H.field[1] * 0.92 / bh);
    L.tf.x = 0; L.tf.y = 0; placeLayer(L);
    scaleLayerBy(L, f);
  }
  function centreAll() {
    var b = designBounds(); if (!b) return;
    var dx = -(b.minX + b.maxX) / 2, dy = -(b.minY + b.maxY) / 2;
    doc.layers.forEach(function (L) { if (L.locked) return; L.tf.x = +(L.tf.x + dx).toFixed(1); L.tf.y = +(L.tf.y + dy).toFixed(1); placeLayer(L); });
    sceneChanged(); refreshValues(); commit();
  }
  function applyThemeTo(name) {
    var t = THEME[name]; if (!t) return;
    doc.theme = name; doc.fabric = t.fabric;
    doc.layers.forEach(function (L) {
      normaliseLayer(L);
      L.colors.fill = t.fill; L.colors.stroke = t.stroke; L.colors.stroke2 = t.stroke2; L.colors.shadow = t.shadow;
      L.colors.bands = t.bands ? t.bands.slice() : null;
      if (L.type === 'text') {
        var grad = L.fx.stripes.on && L.fx.stripes.mode === 'gradient';
        L.fx.stripes.on = !!t.bands; L.fx.stripes.mode = t.bands ? (grad ? 'gradient' : 'stripes') : 'solid';
        // Pride colourways are designed around their outlines, so they set the effects exactly
        if (t.group === 'Pride') { L.fx.stroke.on = true; L.fx.stroke2.on = !!(t.fx && t.fx.stroke2); L.fx.shadow.on = !!(t.fx && t.fx.shadow); }
        else if (t.fx) Object.keys(t.fx).forEach(function (k) { L.fx[k].on = true; if (k === 'stroke2') L.fx.stroke.on = true; });
      }
      recolorLayer(L); requestRender(L);
    });
    styleHoops(); renderPanel(); scheduleSequence(); commit();
  }

  // ---------- machine & hoop dropdown (top bar), like Cura's printer selector ----------
  function machineChanged() {
    HOOPS = machine().hoops;
    if (!HOOPS[doc.hoop]) doc.hoop = machine().defaultHoop;
    buildHoops(); styleHoops(); updateFit(); scheduleSequence();
  }
  function bestHoop(m) { // the smallest hoop of machine m that fits the current design, else the largest
    var b = designBounds(), keys = Object.keys(m.hoops).sort(function (a, c) { return m.hoops[a].field[0] * m.hoops[a].field[1] - m.hoops[c].field[0] * m.hoops[c].field[1]; });
    if (!b) return m.defaultHoop;
    var bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    for (var i = 0; i < keys.length; i++) { var f = m.hoops[keys[i]].field; if (bw <= f[0] - 2 && bh <= f[1] - 2) return keys[i]; }
    return keys[keys.length - 1];
  }
  var recentMachines = (function () {
    try { var r = JSON.parse(localStorage.getItem('stitch.recentMachines') || '[]'); return Array.isArray(r) ? r.filter(function (id) { return typeof id === 'string' && MACHINES[id]; }).slice(0, 5) : []; } catch (e) { return []; }
  })();
  function rememberMachine(id) {
    recentMachines = [id].concat(recentMachines.filter(function (x) { return x !== id; })).slice(0, 5);
    try { localStorage.setItem('stitch.recentMachines', JSON.stringify(recentMachines)); } catch (e) {}
  }
  function setMachine(id) {
    if (!MACHINES[id] || id === doc.machine) return;
    doc.machine = id; doc.hoop = bestHoop(MACHINES[id]); rememberMachine(id);
    machineChanged(); renderPanel(); commit();
    toast(MACHINES[id].name + ' · ' + HOOPS[doc.hoop].name);
  }
  function setHoop(k) { if (!HOOPS[k]) return; doc.hoop = k; styleHoops(); updateFit(); goTo(ui.view === 'custom' ? '3d' : ui.view); renderPanel(); commit(); }

  // machine picker: search across the whole catalogue, filter by type, recent machines first, then brand by brand
  ui.machineFilter = 'all';
  var MFILTERS = [['all', 'All'], ['home', 'Home'], ['multi', 'Multi-needle'], ['comm', 'Commercial']];
  function machineMatchesFilter(m) {
    var f = ui.machineFilter;
    return f === 'all' || (f === 'home' && (m.kind === 'C' || m.kind === 'E')) || (f === 'multi' && m.kind === 'M') || (f === 'comm' && (m.kind === 'P' || m.kind === 'H'));
  }
  function machineItem(id, full) {
    var m = MACHINES[id], k = StitchMachines.KINDS[m.kind];
    var detail = (m.aka ? m.aka + ' · ' : '') + k + (typeof m.needles !== 'number' || m.needles > 1 ? ' · ' + m.needles + ' needles' : '') +
      (m.heads && m.heads !== 1 ? ' · ' + m.heads + ' heads' : '') + (m.cur ? '' : ' · discontinued');
    return '<button type="button" class="mitem" role="menuitemradio" data-machine="' + id + '" aria-checked="' + String(id === doc.machine) + '"><span class="ck"></span><b>' + esc(full ? m.name : m.model) +
      '</b><span class="tag">' + esc(m.format) + ' · ' + m.max[0] + '×' + m.max[1] + '</span><small>' + esc(detail) + '</small></button>';
  }
  function machineListHtml(q) {
    var all = StitchMachines.search(q), ids = all.filter(function (id) { return machineMatchesFilter(MACHINES[id]); }), widened = false;
    // a search that finds nothing of the chosen type shows matches of every type rather than an empty list
    if (!ids.length && all.length && String(q || '').trim()) { ids = all; widened = true; }
    if (!ids.length) return '<p class="mempty">No machines match <b>' + esc(q || MFILTERS.filter(function (f) { return f[0] === ui.machineFilter; })[0][1]) + '</b>. Try a model number such as PE800, a brand, or a file format such as PES.</p>';
    var html = '', searching = !!String(q || '').trim();
    var fname = MFILTERS.filter(function (f) { return f[0] === ui.machineFilter; })[0][1].toLowerCase();
    if (widened) html += '<p class="mcount">No ' + esc(fname) + ' machines match. Showing ' + ids.length + ' of every type.</p>';
    else if (searching) html += '<p class="mcount">' + ids.length + (ids.length === 1 ? ' machine' : ' machines') + '</p>';
    else {
      var rec = [doc.machine].concat(recentMachines.filter(function (id) { return id !== doc.machine; })).filter(function (id) { return machineMatchesFilter(MACHINES[id]); }).slice(0, 5);
      if (rec.length) html += '<h5 class="mbrand">Recent</h5>' + rec.map(function (id) { return machineItem(id, true); }).join('');
    }
    StitchMachines.BRANDS.forEach(function (b) {
      var group = ids.filter(function (id) { return MACHINES[id].brand === b; });
      if (group.length) html += '<h5 class="mbrand">' + esc(b) + '</h5>' + group.map(function (id) { return machineItem(id, false); }).join('');
    });
    return html;
  }
  function hoopListHtml() {
    var M = machine();
    return '<h4>Hoop · ' + esc(M.name) + '</h4><div class="mhoops">' + Object.keys(HOOPS).map(function (k) {
      var H = HOOPS[k];
      return '<button type="button" class="mitem" role="menuitemradio" data-hoopk="' + k + '" aria-checked="' + String(k === doc.hoop) + '"><span class="ck"></span><b>' + esc(H.name) + '</b><span class="tag">' + H.field[0] + ' × ' + H.field[1] + ' mm</span></button>';
    }).join('') + '</div>' + (M.ver ? '' : '<p class="mhint">These are the standard hoops for this machine’s sewing field. Check your manual for the exact set.</p>');
  }
  function openMachinePop() {
    closePop();
    var btn = $('machineBtn'), r = btn.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'machinepop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Machine and hoop');
    p.innerHTML = '<div class="msearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<input type="search" id="mSearch" placeholder="Search ' + StitchMachines.ORDER.length + ' machines: brand, model or format" aria-label="Search machines" autocomplete="off" spellcheck="false"></div>' +
      '<div class="mfilters" role="group" aria-label="Machine type">' + MFILTERS.map(function (f) { return '<button type="button" data-mfilter="' + f[0] + '" aria-pressed="' + String(f[0] === ui.machineFilter) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="mlist" id="mList">' + machineListHtml('') + '</div><div class="msep"></div><div id="mHoops">' + hoopListHtml() + '</div>';
    document.body.appendChild(p);
    var top = r.bottom + 6;
    p.style.left = Math.max(12, Math.min(window.innerWidth - p.offsetWidth - 12, r.left)) + 'px'; p.style.top = top + 'px';
    p.style.maxHeight = (window.innerHeight - top - 12) + 'px';
    pop = p; btn.setAttribute('aria-expanded', 'true');
    var input = $('mSearch'), list = $('mList');
    function refresh() { list.innerHTML = machineListHtml(input.value); list.scrollTop = 0; }
    input.addEventListener('input', refresh);
    p.addEventListener('click', function (e) {
      var m = e.target.closest('[data-machine]'), h = e.target.closest('[data-hoopk]'), f = e.target.closest('[data-mfilter]');
      if (f) { ui.machineFilter = f.dataset.mfilter; p.querySelectorAll('[data-mfilter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); }); refresh(); return; }
      if (m) { setMachine(m.dataset.machine); closePop(); btn.focus(); }
      else if (h) { setHoop(h.dataset.hoopk); closePop(); btn.focus(); }
    });
    // arrow keys move through the results; Enter in the search box picks the first match
    p.addEventListener('keydown', function (e) {
      e.stopPropagation(); // keys typed here never reach the canvas shortcuts (undo, nudge, delete)
      if (e.key === 'Escape') { closePop(); btn.focus(); return; }
      var items = Array.prototype.slice.call(p.querySelectorAll('.mitem')), at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        if (e.target === input) { if (e.key === 'ArrowDown') items[0].focus(); return; }
        var n = at + (e.key === 'ArrowDown' ? 1 : -1);
        if (n < 0) input.focus(); else items[Math.min(items.length - 1, n)].focus();
      } else if (e.key === 'Enter' && e.target === input) {
        e.preventDefault(); var first = list.querySelector('[data-machine]'); if (first) first.click();
      }
    });
    input.focus();
  }
  $('machineBtn').addEventListener('click', function (e) { e.stopPropagation(); if (pop && pop.classList.contains('machinepop')) closePop(); else openMachinePop(); });

  // ---------- popovers: thread picker, emoji picker ----------
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } var mb = document.getElementById('machineBtn'); if (mb) mb.setAttribute('aria-expanded', 'false'); var m = document.querySelector('.scrim'); if (m) m.remove(); }
  function openThreadPicker(anchor, cur, title, onPick) {
    closePop();
    var p = document.createElement('div');
    p.className = 'float threadpop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', title + ' thread');
    var line = lineOf(), near = threadFor(cur);
    p.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:14px">' + esc(title) + ' thread</b><button type="button" class="btn sm" data-close>Done</button></div>' +
      '<div class="note">' + esc(line.brand + ' ' + line.line) + ' · ' + line.chart.length + ' colours</div>' +
      '<input class="field" id="tpSearch" placeholder="Search name or number" aria-label="Search threads">' +
      '<div class="tgrid" role="group" aria-label="' + esc(line.brand + ' ' + line.line) + ' chart">' + line.chart.map(function (t) {
        return '<button type="button" data-hex="' + t[0] + '" data-q="' + esc((t[1] + ' ' + t[2]).toLowerCase()) + '" style="background:' + t[0] + '" title="' + esc(t[2] + ' ' + t[1]) + '" aria-label="' + esc(t[1] + ' ' + t[2]) + '" aria-pressed="' + String(near.code === t[2] && near.hex === t[0]) + '"></button>';
      }).join('') + '</div>' +
      '<div class="row"><label for="tpCustom">Custom colour</label><div class="ctl"><input type="color" id="tpCustom" value="' + cur + '" style="width:44px;height:30px;border:0;background:none;padding:0"><span class="note" id="tpNear">≈ ' + esc(near.name + ' ' + near.code) + '</span></div></div>' +
      '<p class="note">' + (doc.threads.snap ? 'Colours snap to this chart, so the preview shows the thread you will sew.' : 'Colours are kept as picked; the worksheet lists the nearest thread.') + ' Change the brand in Stitch › Thread.</p>';
    document.body.appendChild(p); pop = p;
    var r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
    var left = Math.min(window.innerWidth - pw - 8, Math.max(8, r.right - pw)), top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hex]');
      if (b) { onPick(b.dataset.hex, true); p.querySelectorAll('[data-hex]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('tpCustom').value = b.dataset.hex; $('tpNear').textContent = '≈ ' + b.title; return; }
      if (e.target.closest('[data-close]')) { closePop(); anchor.focus(); }
    });
    var ci = $('tpCustom');
    ci.addEventListener('input', function () { onPick(ci.value, false); var n = threadFor(ci.value); $('tpNear').textContent = '≈ ' + n.name + ' ' + n.code; });
    $('tpSearch').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      p.querySelectorAll('.tgrid [data-q]').forEach(function (b) { b.hidden = !!q && b.dataset.q.indexOf(q) < 0; });
    });
    ci.addEventListener('change', function () { onPick(ci.value, true); });
    var first = p.querySelector('[aria-pressed="true"]') || p.querySelector('[data-hex]'); if (first) first.focus();
  }
  // ---- emoji picker: the full Unicode table (Twemoji artwork), by group, with search and skin tones ----
  var EM_BASES = A.emoji.filter(function (e) { return !e.of; });
  var EM_URL = {};
  function emUrl(e) { return EM_URL[e.code] || (EM_URL[e.code] = emojiDataUrl(e)); }
  var TONES = [['#ffc83d', 'Default'], ['#f7dece', 'Light'], ['#f3d2a2', 'Medium-light'], ['#d5ab88', 'Medium'], ['#af7e57', 'Medium-dark'], ['#7c533e', 'Dark']];
  function emToned(e) { var t = ui.emojiTone || 0; return t && e.tones && e.tones[t - 1] && EMOJI[e.tones[t - 1]] ? EMOJI[e.tones[t - 1]] : e; }
  function openEmojiPicker(onPick) {
    closePop();
    if (!A.emoji.length) { toast('The emoji table didn’t load in this browser.'); return; }
    var groups = A.emojiGroups, s = document.createElement('div');
    if (ui.emojiGroup === undefined) ui.emojiGroup = 0;
    s.className = 'scrim';
    s.innerHTML = '<div class="modal emodal" role="dialog" aria-modal="true" aria-labelledby="emTitle"><header><h2 id="emTitle">Choose an emoji</h2><button type="button" class="btn sm" data-close>Close</button></header>' +
      '<div class="etools"><input class="field" type="search" id="emSearch" placeholder="Search ' + nfmt(EM_BASES.length) + ' emoji: heart, cat, soccer…" aria-label="Search emoji" autocomplete="off">' +
      '<div class="etones" role="group" aria-label="Skin tone">' + TONES.map(function (t, i) { return '<button type="button" data-tone="' + i + '" aria-pressed="' + String((ui.emojiTone || 0) === i) + '" title="' + t[1] + ' skin tone" aria-label="' + t[1] + ' skin tone"><i style="background:' + t[0] + '"></i></button>'; }).join('') + '</div></div>' +
      '<div class="etabs" role="tablist">' + groups.map(function (g, i) {
        var first = EM_BASES.filter(function (e) { return e.group === g; })[0];
        return '<button type="button" role="tab" data-group="' + i + '" aria-selected="' + String(ui.emojiGroup === i) + '" title="' + esc(g) + '"><img alt="" src="' + (first ? emUrl(first) : '') + '"><span>' + esc(g) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mbody" id="emBody"></div><div class="credit">Emoji artwork from Twemoji 17 © Twitter, Inc. and other contributors (CC-BY 4.0). Names from emojibase (MIT).</div></div>';
    document.body.appendChild(s);
    var body = s.querySelector('#emBody'), search = s.querySelector('#emSearch'), timer = 0;
    function tile(e) { var t = emToned(e); return '<button type="button" data-code="' + t.code + '" title="' + esc(t.label) + '" aria-label="' + esc(t.label) + '"><img alt="" src="' + emUrl(t) + '" loading="lazy"></button>'; }
    function draw() {
      var q = search.value.trim().toLowerCase(), list;
      if (q) {
        var words = q.split(/\s+/);
        list = EM_BASES.filter(function (e) { var hay = (e.label + ' ' + e.tags + ' ' + e.group).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) >= 0; }); });
        body.innerHTML = list.length ? '<h3>' + nfmt(list.length) + ' match' + (list.length === 1 ? '' : 'es') + (list.length > 600 ? ' · showing the first 600' : '') + '</h3><div class="egrid">' + list.slice(0, 600).map(tile).join('') + '</div>'
          : '<p class="note">No emoji match “' + esc(q) + '”.</p>';
      } else {
        var g = groups[ui.emojiGroup] || groups[0];
        list = EM_BASES.filter(function (e) { return e.group === g; });
        body.innerHTML = '<h3>' + esc(g) + ' · ' + list.length + '</h3><div class="egrid">' + list.map(tile).join('') + '</div>';
      }
      body.scrollTop = 0;
    }
    draw();
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(draw, 120); });
    s.addEventListener('keydown', function (e) { if (e.key === 'Escape') { s.remove(); } });
    s.addEventListener('click', function (e) {
      if (e.target === s || e.target.closest('[data-close]')) { s.remove(); return; }
      var tb = e.target.closest('[data-group]');
      if (tb) { ui.emojiGroup = +tb.dataset.group; search.value = ''; s.querySelectorAll('[data-group]').forEach(function (b) { b.setAttribute('aria-selected', String(b === tb)); }); draw(); return; }
      var tn = e.target.closest('[data-tone]');
      if (tn) { ui.emojiTone = +tn.dataset.tone; s.querySelectorAll('[data-tone]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === tn)); }); draw(); return; }
      var b = e.target.closest('[data-code]');
      if (b) { s.remove(); onPick(b.dataset.code); }
    });
    search.focus();
  }

  // ---------- import ----------
  function defaultArtSize() { var H = HOOPS[doc.hoop]; return Math.round(Math.min(70, Math.min(H.field[0], H.field[1]) * 0.7)); }
  function importFile(file) {
    if (!file) return;
    var isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name), name = (file.name || 'Image').replace(/\.[^.]+$/, '') || 'Image';
    if (file.size > 40e6) { toast('That file is too large (over 40 MB).'); return; }
    if (!isSvg && !/^image\//.test(file.type)) { toast('Import an SVG, PNG, JPEG, WebP, GIF or BMP file.'); return; }
    var id = 'S' + newId();
    if (isSvg) {
      file.text().then(function (svg) {
        if (!/<svg[\s>]/i.test(svg)) throw new Error('not an SVG');
        SOURCES.set(id, { kind: 'svg', svg: svg, name: file.name, thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) });
        return svgBitmap(svg, 64);
      }).then(function () {
        addLayer(makeImageLayer(id, name, defaultArtSize()));
        toast('Imported ' + file.name + ' — colours come from its fills');
      }).catch(function () { SOURCES.delete(id); toast('That SVG could not be read.'); });
      return;
    }
    createImageBitmap(file).then(function (bm) {
      var mx = Math.max(bm.width, bm.height);
      if (mx <= 2400) return bm;
      var k = 2400 / mx;
      return createImageBitmap(bm, { resizeWidth: Math.round(bm.width * k), resizeHeight: Math.round(bm.height * k), resizeQuality: 'high' });
    }).then(function (bm) {
      SOURCES.set(id, { kind: 'bitmap', bitmap: bm, name: file.name, thumb: URL.createObjectURL(file) });
      addLayer(makeImageLayer(id, name, defaultArtSize()));
      toast('Imported ' + file.name + ' — reducing to ' + 5 + ' thread colours');
    }).catch(function () { toast('That picture could not be read.'); });
  }

  // ---------- event wiring ----------
  function onUiClick(e) {
    var t = e.target;
    var setB = t.closest('[data-set]'); if (setB && !setB.disabled) { onSegClick(setB); return; }
    var col = t.closest('[data-color]');
    if (col && !col.disabled) {
      var k = col.dataset.color;
      openThreadPicker(col, getPath(k), col.dataset.title, function (hex, final) {
        setPath(k, hex); applyPath(k);
        col.querySelector('.sw').style.background = hex; col.querySelector('.nm').innerHTML = threadLabel(hex);
        if (k.indexOf('L.colors') === 0) doc.theme = '';
        if (final) commit();
      });
      return;
    }
    var rc = t.closest('[data-recolor]');
    if (rc) {
      var L0 = selLayer(), orig = rc.dataset.recolor;
      openThreadPicker(rc, (L0.colors.recolor && L0.colors.recolor[orig]) || orig, 'Recolour', function (hex, final) {
        L0.colors.recolor = L0.colors.recolor || {}; L0.colors.recolor[orig] = hex;
        recolorLayer(L0); refreshLayerRow(L0.id); scheduleSequence();
        if (final) commit();
      });
      return;
    }
    var chipEl = t.closest('[data-auto]');
    if (chipEl) { doc.stitch[chipEl.dataset.auto] = null; applyPath('doc.stitch.' + chipEl.dataset.auto); renderPanel(); commit(); return; }
    var band = t.closest('[data-band]');
    if (band && !band.disabled) {
      var LB = selLayer(), bi = +band.dataset.band;
      openThreadPicker(band, LB.colors.bands[bi], 'Stripe ' + (bi + 1), function (hex, final) {
        LB.colors.bands[bi] = hex; band.style.background = hex; doc.theme = '';
        recolorLayer(LB); refreshLayerRow(LB.id); scheduleSequence();
        if (final) commit();
      });
      return;
    }
    var dd = t.closest('[data-dir-del]');
    if (dd) { var Ld = selLayer(); Ld.dirs.splice(+dd.dataset.dirDel, 1); requestRender(Ld); commit(); buildGizmo(); refreshToolPanel(); return; }
    var rot = t.closest('[data-rot]');
    if (rot) { var L1 = selLayer(); if (!L1 || L1.locked) return; var d = +rot.dataset.rot; L1.tf.rot = d === 0 ? 0 : ((L1.tf.rot + d + 540) % 360) - 180; placeLayer(L1); sceneChanged(); refreshValues(); commit(); return; }
    var sc = t.closest('[data-scale]');
    if (sc) { var L2 = selLayer(); if (!L2) return; if (sc.dataset.scale === 'fit') fitToHoop(L2); else scaleLayerBy(L2, +sc.dataset.scale); return; }
    var li = t.closest('.layer');
    var act = t.closest('[data-act]');
    if (act && !act.disabled) {
      var a = act.dataset.act, L = li ? layerById(li.dataset.id) : selLayer();
      switch (a) {
        case 'vis': L.visible = !L.visible; placeLayer(L); refreshLayerRow(L.id); sceneChanged(); applySew(); commit(); return;
        case 'lock': L.locked = !L.locked; refreshLayerRow(L.id); if (L.id === doc.sel) { renderPanel(); refreshToolPanel(); } commit(); return;
        case 'add-text': addText(); return;
        case 'add-emoji': openEmojiPicker(function (code) { addLayer(makeEmojiLayer(code)); }); return;
        case 'add-image': $('fileInput').click(); return;
        case 'raise': if (L) moveLayer(L, 1); return;
        case 'lower': if (L) moveLayer(L, -1); return;
        case 'duplicate': duplicateLayer(); return;
        case 'delete': deleteLayer(); return;
        case 'font': {
          var f = FONT[act.dataset.v], prev = FONT[L.p.font];
          L.p.font = f.name; L.p.tilt = f.tilt;
          if (!f.tail) L.p.tail = 'none'; else if (prev && !prev.tail && L.p.tail === 'none') L.p.tail = 'classic';
          requestRender(L); renderPanel(); commit(); return;
        }
        case 'change-emoji': openEmojiPicker(function (code) { L.p.code = code; L.colors.recolor = {}; L.name = EMOJI[code].char + ' ' + EMOJI[code].label; requestRender(L); renderPanel(); commit(); }); return;
        case 'reset-colours': L.colors.recolor = {}; recolorLayer(L); refreshLayerRow(L.id); renderPanel(); scheduleSequence(); commit(); return;
        case 'theme': applyThemeTo(act.dataset.v); return;
        case 'flag': ui.prideFlag = act.dataset.v; applyThemeTo(A.themes.filter(function (t) { return t.flag === act.dataset.v; })[0].name); return;
        case 'band-add': L.colors.bands.push(L.colors.bands[L.colors.bands.length - 1]); doc.theme = ''; requestRender(L); renderPanel(); commit(); return;
        case 'band-remove': L.colors.bands.pop(); doc.theme = ''; requestRender(L); renderPanel(); commit(); return;
        case 'band-reverse': L.colors.bands.reverse(); doc.theme = ''; recolorLayer(L); refreshLayerRow(L.id); scheduleSequence(); renderPanel(); commit(); return;
        case 'centre-all': centreAll(); return;
        case 'centre-layer': L.tf.x = 0; L.tf.y = 0; placeLayer(L); sceneChanged(); refreshValues(); commit(); return;
        case 'flip-x': L.tf.mx = !L.tf.mx; placeLayer(L); sceneChanged(); refreshToolPanel(); commit(); return;
        case 'flip-y': L.tf.my = !L.tf.my; placeLayer(L); sceneChanged(); refreshToolPanel(); commit(); return;
        case 'bench': ui.bench = !ui.bench; frames.length = 0; act.textContent = ui.bench ? 'Stop benchmark' : 'Run benchmark'; act.setAttribute('aria-pressed', String(ui.bench)); requestDraw(); return;
        case 'goto-design': setStage('design'); return;
        case 'save-zip': saveCardZip(); return;
        case 'save-png': savePreviewPng(); return;
        case 'write-card': writeToCard(); return;
        case 'bake': bakeAndSave(); return;
        case 'tool-direction': setTool('direction'); return;
        case 'dirs-reset': L.dirs = []; requestRender(L); commit(); buildGizmo(); refreshToolPanel(); toast('All areas back to Auto direction'); return;
        case 'use-rec-needle': { var Rn = recommend(); doc.threads.needle = Rn.needle; doc.threads.point = Rn.point; threadsChanged(); renderPanel(); commit(); return; }
        case 'stitch-auto': ['spacing', 'strokeSpacing', 'tatamiSpacing', 'tatamiStitch', 'pullComp', 'minStitch', 'satinMax', 'split', 'tatamiAngle'].forEach(function (q) { doc.stitch[q] = null; }); doc.stitch.underlay = 'auto'; renderAllLayers(); renderPanel(); commit(); return;
        case 'save-single': saveSingle(act.dataset.v); return;
      }
    }
    if (li && !t.closest('button') && !t.closest('input')) { if (doc.sel !== li.dataset.id) selectLayer(li.dataset.id); }
  }
  $('toolpanel').addEventListener('change', function (e) {
    var el = e.target; if (!el.dataset || el.dataset.dirAngle === undefined) return;
    var L = selLayer(), v = parseFloat(el.value); if (!L || !isFinite(v)) return;
    L.dirs[+el.dataset.dirAngle].angle = Math.round(((v % 180) + 180) % 180);
    requestRender(L); commit(); buildGizmo();
  });
  [$('panelBody'), $('toolpanel')].forEach(function (el) {
    el.addEventListener('click', onUiClick);
    el.addEventListener('input', onCtlInput);
    el.addEventListener('change', onCtlChange);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('input.field')) { e.target.blur(); }
    });
  });
  $('panelBody').addEventListener('toggle', function (e) { var d = e.target; if (d.dataset && d.dataset.sec) ui.open[d.dataset.sec] = d.open; }, true);
  // rename on double-click
  $('panelBody').addEventListener('dblclick', function (e) {
    var b = e.target.closest('.layer .lname b'); if (!b) return;
    var L = layerById(b.closest('.layer').dataset.id); if (!L) return;
    var inp = document.createElement('input');
    inp.className = 'field'; inp.value = L.name; inp.maxLength = 40; inp.style.height = '28px'; inp.setAttribute('aria-label', 'Layer name');
    b.replaceWith(inp); inp.focus(); inp.select();
    var done = false, finish = function (save) {
      if (done) return; done = true;
      if (save && inp.value.trim() && inp.value.trim() !== L.name) { L.name = inp.value.trim(); L.customName = true; commit(); }
      refreshLayerRow(L.id); refreshToolPanel();
    };
    inp.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
  });
  // drag to reorder (the list shows the top layer first)
  var dragId = null;
  $('panelBody').addEventListener('dragstart', function (e) {
    var li = e.target.closest && e.target.closest('.layer'); if (!li) return;
    dragId = li.dataset.id; e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
  });
  $('panelBody').addEventListener('dragover', function (e) {
    var li = e.target.closest && e.target.closest('.layer'); if (!li || !dragId) return;
    e.preventDefault();
    document.querySelectorAll('.layer.drop-before, .layer.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
    var r = li.getBoundingClientRect(); li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  $('panelBody').addEventListener('drop', function (e) {
    var li = e.target.closest && e.target.closest('.layer'); if (!li || !dragId) return;
    e.preventDefault();
    var before = li.classList.contains('drop-before'), V = doc.layers.slice().reverse(), from = V.findIndex(function (L) { return L.id === dragId; });
    var moving = V.splice(from, 1)[0], to = V.findIndex(function (L) { return L.id === li.dataset.id; });
    if (moving && to >= 0) {
      V.splice(before ? to : to + 1, 0, moving);
      doc.layers = V.reverse();
      doc.layers.forEach(placeLayer); renderPanel(); sceneChanged(); applySew(); commit();
    }
    dragId = null;
  });
  $('panelBody').addEventListener('dragend', function () { dragId = null; document.querySelectorAll('.layer.drop-before, .layer.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); }); });
  // keyboard within the layer list
  $('panelBody').addEventListener('keydown', function (e) {
    var li = e.target.closest && e.target.closest('.layer'); if (!li || e.target !== li) return;
    var V = doc.layers.slice().reverse(), i = V.findIndex(function (L) { return L.id === li.dataset.id; });
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      var n = V[Math.max(0, Math.min(V.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (n) { selectLayer(n.id); var el = document.querySelector('#layerList [data-id="' + n.id + '"]'); if (el) el.focus(); }
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLayer(li.dataset.id); }
  });

  // tools, stages, header
  document.querySelectorAll('.tools [data-tool]').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });
  function setTool(t) {
    ui.tool = t; hideTip();
    document.querySelectorAll('.tools [data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    if (ui.stage !== 'design') setStage('design');
    buildGizmo(); refreshToolPanel();
  }
  document.querySelector('.tools').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add],[data-act]'); if (!b) return;
    if (b.dataset.add === 'text') addText();
    else if (b.dataset.add === 'emoji') openEmojiPicker(function (code) { addLayer(makeEmojiLayer(code)); });
    else if (b.dataset.add === 'image') $('fileInput').click();
    else if (b.dataset.act === 'duplicate') duplicateLayer();
    else if (b.dataset.act === 'delete') deleteLayer();
  });
  document.querySelectorAll('.stages [data-stage]').forEach(function (b) {
    b.addEventListener('click', function () { setStage(b.dataset.stage); });
    b.addEventListener('keydown', function (e) {
      var order = ['design', 'stitch', 'export'], i = order.indexOf(ui.stage);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setStage(n); document.querySelector('[data-stage="' + n + '"]').focus(); }
    });
  });
  $('actionBtn').addEventListener('click', function () {
    if (ui.stage === 'design') setStage('stitch');
    else if (ui.stage === 'stitch') setStage('export');
    else saveCardZip();
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  document.querySelectorAll('.themeseg button').forEach(function (b) {
    b.addEventListener('click', function () { themePref = b.dataset.theme; try { localStorage.setItem('stitch.theme', themePref); } catch (e) {} applyTheme(); });
  });
  document.querySelectorAll('.viewbar [data-view]').forEach(function (b) { b.addEventListener('click', function () { goTo(b.dataset.view); }); });
  $('orthoBtn').addEventListener('click', function () { ui.ortho = !ui.ortho; $('orthoBtn').setAttribute('aria-pressed', String(ui.ortho)); requestDraw(); });
  $('frameBtn').addEventListener('click', function () { goTo(ui.view === 'custom' ? '3d' : ui.view); });
  $('playBtn').addEventListener('click', function () {
    if (!ui.playing && ui.sew >= 1) ui.sew = 0;
    ui.playing = !ui.playing; refreshPlay(); applySew();
  });
  $('sewSlider').addEventListener('input', function () { ui.playing = false; refreshPlay(); ui.sew = $('sewSlider').value / 1000; applySew(); });
  $('fileInput').addEventListener('change', function () { var f = $('fileInput').files[0]; $('fileInput').value = ''; importFile(f); });
  // drag & drop files onto the window
  var dragDepth = 0;
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { dragDepth++; $('drophint').hidden = false; } });
  window.addEventListener('dragleave', function () { if (dragDepth > 0 && --dragDepth === 0) $('drophint').hidden = true; });
  window.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    dragDepth = 0; $('drophint').hidden = true;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); importFile(e.dataTransfer.files[0]); }
  });
  document.addEventListener('pointerdown', function (e) { if (pop && !pop.contains(e.target) && !e.target.closest('[data-color],[data-recolor],[data-band],#machineBtn')) closePop(); }, true);

  // ---------- keyboard shortcuts ----------
  var nudgeTimer = null;
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (document.querySelector('.scrim') || pop) { closePop(); return; }
      if (!typing && doc.sel) { doc.sel = null; buildGizmo(); renderPanel(); refreshToolPanel(); }
      return;
    }
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { if (typing && !e.shiftKey && t.dataset && t.dataset.k) return; e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (typing || document.querySelector('.scrim')) return;
    if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateLayer(); return; }
    if (mod || (e.altKey && !/Arrow/.test(e.key))) return;
    var L = selLayer();
    if (e.altKey && L && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveLayer(L, e.key === 'ArrowUp' ? 1 : -1); return; }
    if (/^Arrow/.test(e.key) && L && !L.locked && ui.stage === 'design' && !(t.closest && t.closest('.layer, .seg, .stages'))) {
      e.preventDefault();
      var st = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') L.tf.x -= st; if (e.key === 'ArrowRight') L.tf.x += st;
      if (e.key === 'ArrowUp') L.tf.y += st; if (e.key === 'ArrowDown') L.tf.y -= st;
      L.tf.x = +L.tf.x.toFixed(1); L.tf.y = +L.tf.y.toFixed(1);
      placeLayer(L); sceneChanged(); refreshValues();
      clearTimeout(nudgeTimer); nudgeTimer = setTimeout(commit, 500);
      return;
    }
    var k = e.key.toLowerCase();
    if (k === 'v') setTool('move'); else if (k === 'r') setTool('rotate'); else if (k === 's') setTool('scale'); else if (k === 'm') setTool('mirror'); else if (k === 'd') setTool('direction');
    else if (k === 't') { e.preventDefault(); addText(); }
    else if (k === 'e') openEmojiPicker(function (code) { addLayer(makeEmojiLayer(code)); });
    else if (k === 'i') $('fileInput').click();
    else if ((e.key === 'Delete' || e.key === 'Backspace') && L) { e.preventDefault(); deleteLayer(); }
    else if (k === '1') setStage('design'); else if (k === '2') setStage('stitch'); else if (k === '3') setStage('export');
    else if (k === 'f') goTo(ui.view === 'custom' ? '3d' : ui.view);
  });

  // ---------- viewport pointer input: select, move, rotate, scale, orbit, pan, zoom ----------
  function pickLayer(pt) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
      var L = doc.layers[i]; if (!L.visible) continue;
      var s = layerSize(L); if (!s) continue;
      var q = X.makeXform({ x: L.tf.x, y: L.tf.y, rotation: L.tf.rot, mirrorX: L.tf.mx, mirrorY: L.tf.my }).inv(pt);
      if (Math.abs(q[0]) <= s.w / 2 + 1 && Math.abs(q[1]) <= s.h / 2 + 1) return L;
    }
    return null;
  }
  function handleAt(L, pt) {
    var hs = handleSize();
    if (ui.tool === 'rotate') {
      var R = rotateRadius(L), d = Math.hypot(pt[0] - L.tf.x, pt[1] - L.tf.y);
      if (Math.abs(d - R) < hs * 1.8) return 'rotate';
    }
    if (ui.tool === 'scale') {
      var c = layerCorners(L);
      if (c && c.some(function (p) { return Math.hypot(p[0] - pt[0], p[1] - pt[1]) < hs * 2.2; })) return 'scale';
    }
    return null;
  }
  var pointers = new Map(), gesture = null;
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    canvas.focus({ preventScroll: true }); closePop();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    anim = null;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      if (gesture && gesture.L) endEdit();
      gesture = { mode: 'pinch', d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
      return;
    }
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { gesture = { mode: 'pan' }; e.preventDefault(); return; }
    if (e.button === 2) { gesture = { mode: 'orbit' }; return; }
    var hit = planeHit(e.clientX, e.clientY);
    if (ui.stage === 'design' && hit) {
      var S = selLayer();
      if (S && S.visible && !S.locked) {
        var h = handleAt(S, hit);
        if (h === 'rotate') { gesture = { mode: 'rotate', L: S, a0: Math.atan2(hit[1] - S.tf.y, hit[0] - S.tf.x), rot0: S.tf.rot }; return; }
        if (h === 'scale') { gesture = { mode: 'scale', L: S, d0: Math.max(1, Math.hypot(hit[0] - S.tf.x, hit[1] - S.tf.y)) }; return; }
      }
      if (ui.tool === 'direction' && e.button === 0 && dirPointerDown(hit, e)) return;
      var P = pickLayer(hit);
      if (P) {
        if (doc.sel !== P.id) selectLayer(P.id);
        if (!P.locked) { gesture = { mode: 'move', L: P, hx: hit[0], hy: hit[1], ox: P.tf.x, oy: P.tf.y }; canvas.className = 'cur-move'; }
        else gesture = { mode: 'orbit' };
        return;
      }
    }
    gesture = { mode: 'orbit', click: e.button === 0, sx: e.clientX, sy: e.clientY };
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && ui.stage === 'design') {
        var hit0 = planeHit(e.clientX, e.clientY), S0 = selLayer(), cls = '';
        if (ui.tool === 'direction') { cls = hit0 && pickLayer(hit0) ? 'cur-dir' : ''; dirHover(e, hit0); }
        else if (hit0) { var hh = S0 && !S0.locked && S0.visible ? handleAt(S0, hit0) : null; cls = hh === 'rotate' ? 'cur-rotate' : hh === 'scale' ? 'cur-scale' : pickLayer(hit0) ? 'cur-move' : ''; }
        if (canvas.className !== cls) canvas.className = cls;
      }
      return;
    }
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!gesture) return;
    if (gesture.mode === 'pinch' && pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      if (gesture.d > 0 && d > 0) zoomAt(gesture.d / d, mx, my);
      pan(mx - gesture.mx, my - gesture.my);
      gesture.d = d; gesture.mx = mx; gesture.my = my; markCustomView();
    } else if (gesture.mode === 'pan') { pan(dx, dy); markCustomView(); }
    else if (gesture.mode === 'orbit') {
      if (gesture.click && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 4) gesture.click = false;
      cam.theta -= dx * 0.006;
      cam.phi = Math.min(1.5, Math.max(0.0015, cam.phi - dy * 0.006));
      markCustomView();
    } else if (gesture.mode === 'dir') {
      var hd = planeHit(e.clientX, e.clientY); if (hd) dirPointerMove(hd, e, e.clientX, e.clientY);
      return;
    } else {
      var hit = planeHit(e.clientX, e.clientY), L = gesture.L;
      if (!hit) return;
      if (gesture.mode === 'move') {
        L.tf.x = Math.round((gesture.ox + hit[0] - gesture.hx) * 2) / 2;
        L.tf.y = Math.round((gesture.oy + hit[1] - gesture.hy) * 2) / 2;
        gesture.changed = true;
      } else if (gesture.mode === 'rotate') {
        var a = Math.atan2(hit[1] - L.tf.y, hit[0] - L.tf.x), deg = gesture.rot0 + (a - gesture.a0) * 180 / Math.PI;
        if (!e.shiftKey) deg = Math.round(deg / 15) * 15; else deg = Math.round(deg);
        L.tf.rot = ((deg % 360) + 540) % 360 - 180;
        gesture.changed = true;
      } else if (gesture.mode === 'scale') {
        var r = rt(L.id), f = Math.hypot(hit[0] - L.tf.x, hit[1] - L.tf.y) / gesture.d0;
        var base = r.result ? Math.max(r.result.size.w, r.result.size.h) : 50;
        f = Math.max(10 / base, Math.min(200 / base, f));
        r.preview = f; gesture.changed = true;
      }
      placeLayer(L); sceneChanged(); refreshValues();
    }
    requestDraw();
  });
  function endEdit() {
    var g = gesture; if (!g || !g.L) return;
    if (g.mode === 'scale' && g.changed) { var r = rt(g.L.id), f = r.preview; r.preview = 1; scaleLayerBy(g.L, f); }
    else if (g.changed) commit();
    canvas.className = '';
  }
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (gesture && gesture.mode === 'dir') { dirPointerUp(); return; }
      if (gesture && gesture.L) endEdit();
      else if (gesture && gesture.mode === 'orbit' && gesture.click && ui.stage === 'design' && doc.sel) { doc.sel = null; buildGizmo(); renderPanel(); refreshToolPanel(); }
      gesture = null;
    } else if (gesture && gesture.mode === 'pinch') gesture = { mode: 'orbit' };
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); anim = null;
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(dy * 0.0012), e.clientX, e.clientY);
    markCustomView(); requestDraw();
  }, { passive: false });
  canvas.addEventListener('dblclick', function (e) { var h = planeHit(e.clientX, e.clientY); if (!(ui.stage === 'design' && h && pickLayer(h))) goTo('3d'); });

  function sceneChanged() {
    rebuildCopies(); scheduleShadow(); buildGizmo(); updateFit(); scheduleSequence(); requestDraw();
  }
