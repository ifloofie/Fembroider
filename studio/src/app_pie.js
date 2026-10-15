  // ===================== pie menu: click a shape in the view to change how it is sewn =====================
  // The choices fan out round the pointer, like the Sims. Everything here edits the result in place and is kept as
  // small per-area overrides on the layer, so it survives resizing, re-rendering, undo and saving:
  //   L.edits  { key: { stitch: 'satin' | 'fill' | 'line' | 'outline' | 'skip' } }   (absent = Auto)
  //   L.order  [key, …]  sewing order of the layer's colours (empty = automatic)
  //   L.merge  { key: intoKey }  a colour sewn as part of another
  // Keys are the engine's part keys: 'colour:#rrggbb' for a picture's colours, 'fill' / 'stroke' for text and edges.
  var PIE_ICON = {
    stitch: '<path d="M4.5 19.5 16 8"/><path d="M16 8l2.5-2.5a1.4 1.4 0 0 1 2 2L18 10z"/><path d="M4.5 19.5c-1-2.5.5-4.5 3-4s4.5-1 3.5-3.5" stroke-dasharray="2 1.8"/>', colour: ICON.palette, layer: ICON.layers, text: ICON.text, lock: ICON.lock, unlock: ICON.unlock, trash: ICON.trash,
    skip: ICON.eyeOff, sew: ICON.eye,
    dir: '<path d="M5 19 19 5"/><path d="M12 5h7v7"/>',
    order: '<path d="M8 20V4M4 8l4-4 4 4"/><path d="M16 4v16M12 16l4 4 4-4"/>',
    merge: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    edge: '<path d="M12 3.5c4.8 0 8.5 3.4 8.5 8.3S16.8 20.5 12 20.5 3.5 16.7 3.5 11.8 7.2 3.5 12 3.5z" stroke-dasharray="2.6 2.4"/><circle cx="12" cy="12" r="4.5"/>',
    back: '<path d="M14.5 6 8.5 12l6 6"/>', close: '<path d="M7 7l10 10M17 7 7 17"/>',
    auto: '<path d="M12 3.5l2.1 5.3 5.6.4-4.3 3.6 1.4 5.5L12 15.3l-4.8 3 1.4-5.5-4.3-3.6 5.6-.4z"/>',
    satin: '<path d="M4 15 15 4M6.5 17.5 17.5 6.5M9 20 20 9"/>',
    tatami: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17M8 6.5V12M15 6.5V12M11.5 12v5.5M18.5 12v5.5M5 12v5.5"/>',
    lines: '<path d="M3 16c3.5-7 6.5 1.5 9.5-5S18 6.5 21 7"/>',
    outline: '<rect x="4.5" y="4.5" width="15" height="15" rx="5"/>',
    first: '<path d="M6 5h12M7 15l5-5 5 5"/>', earlier: '<path d="M7 14l5-5 5 5"/>', later: '<path d="M7 10l5 5 5-5"/>', last: '<path d="M6 19h12M7 9l5 5 5-5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V4.5h-11v11h4"/>',
    mirror: '<path d="M12 3v18"/><path d="M8.5 7.5 4 12l4.5 4.5zM15.5 7.5 20 12l-4.5 4.5z"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4.5v4h4"/>',
    angle: '<path d="M4 19h16M4 19 15 6"/><path d="M10 19a6 6 0 0 0-1.6-4.1"/>'
  };
  function pic(name) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PIE_ICON[name] || '') + '</svg>'; }
  var STITCH_NAME = { auto: 'Auto', satin: 'Satin', fill: 'Flat fill', line: 'Lines', outline: 'Outline', skip: 'Left out' };
  var pie = null;

  // ---------- reading and writing the overrides ----------
  function areaKey(p) { return p.role === 'band' ? 'fill' : (p.key || p.role); }
  function stitchOfKey(L, key) { return (L.edits && L.edits[key] && L.edits[key].stitch) || 'auto'; }
  function hasAreaEdits(L) { return !!((L.edits && Object.keys(L.edits).length) || (L.order && L.order.length) || (L.merge && Object.keys(L.merge).length)); }
  function setStitch(L, key, how, msg) {
    L.edits = L.edits || {};
    if (how === 'auto') delete L.edits[key]; else L.edits[key] = { stitch: how };
    requestRender(L); commit(); renderPanelSoon();
    if (msg) toast(msg);
  }
  // the layer's colours in the order they sew now (skipped ones keep their place at the end)
  function sewKeys(L) {
    var r = rt(L.id).result, keys = [];
    if (!r) return keys;
    r.parts.forEach(function (p) { if (p.role === 'colour' || p.role === 'fill' || p.role === 'band') { var k = areaKey(p); if (keys.indexOf(k) < 0) keys.push(k); } });
    (r.ghosts || []).forEach(function (g) { if (keys.indexOf(g.key) < 0) keys.push(g.key); });
    return keys;
  }
  function moveKey(L, key, where) {
    var ks = sewKeys(L), i = ks.indexOf(key); if (i < 0) return;
    ks.splice(i, 1);
    var j = where === 'first' ? 0 : where === 'last' ? ks.length : where === 'earlier' ? Math.max(0, i - 1) : Math.min(ks.length, i + 1);
    ks.splice(j, 0, key);
    L.order = ks; requestRender(L); commit(); renderPanelSoon();
    toast(j === 0 ? 'Sewn first in this layer' : j === ks.length - 1 ? 'Sewn last in this layer' : 'Now sewn ' + ordinal(j + 1) + ' of ' + ks.length);
  }
  function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
  // the colour an area shows, and how to change it (picture colours, text fill, stripes, edges)
  function colourSlot(L, part) {
    if (part.role === 'colour') return { cur: partColor(L, part), set: function (h) { L.colors.recolor = L.colors.recolor || {}; L.colors.recolor[part.color] = h; } };
    if (part.role === 'band') return { cur: L.colors.bands[part.band], set: function (h) { L.colors.bands[part.band] = h; doc.theme = ''; } };
    if (L.colors[part.role] !== undefined) return { cur: L.colors[part.role], set: function (h) { L.colors[part.role] = h; doc.theme = ''; } };
    return null;
  }
  function ghostColour(L, g) { return snapColour((L.colors.recolor && L.colors.recolor[g.color]) || (/^colour:/.test(g.key) ? g.color : L.colors[g.key] || g.color)); }

  // ---------- what was clicked ----------
  // the part sewn on top under a layer-local point; or an area that is left out (drawn as a faint outline)
  function pieHit(L, lp) {
    var r = rt(L.id).result; if (!r) return null;
    for (var i = r.parts.length - 1; i >= 0; i--) {
      var p = r.parts[i], tol = p.kind === 'fill' ? 0.45 : 0.75;
      for (var k = 0; k < p.chords.length; k++) if (segDist(lp, p.chords[k]) < tol) return { part: p, key: areaKey(p) };
    }
    var gs = r.ghosts || [];
    for (var j = gs.length - 1; j >= 0; j--) {
      var g = gs[j], G = g.grid;
      if (G) { var gx = Math.floor((lp[0] - G.x0) / G.res), gy = Math.floor((G.y1 - lp[1]) / G.res); if (gx >= 0 && gy >= 0 && gx < G.w && gy < G.h && G.data[gy * G.w + gx]) return { ghost: g, key: g.key }; }
      for (var m = 0; m < g.chords.length; m++) if (segDist(lp, g.chords[m]) < 0.8) return { ghost: g, key: g.key };
    }
    return null;
  }

  // ---------- the rings ----------
  function mainRing() {
    var L = pie.L, t = pie.t, items = [];
    if (L.locked) {
      return { title: L.name, sub: 'Locked', items: [
        { label: 'Unlock', icon: 'unlock', run: function () { L.locked = false; refreshLayerRow(L.id); renderPanel(); refreshToolPanel(); commit(); toast('Unlocked'); } },
        { label: 'Duplicate', icon: 'copy', run: function () { duplicateLayer(); } }] };
    }
    if (!t) return layerRing(true);
    if (t.ghost) {
      var gname = threadFor(ghostColour(L, t.ghost)).name;
      return { title: gname, sub: L.name + ' · left out', swatch: ghostColour(L, t.ghost), items: [
        { label: 'Sew it', icon: 'sew', run: function () { setStitch(L, t.key, 'auto', gname + ' is sewn again'); } },
        { label: 'Sew as…', icon: 'stitch', ring: stitchRing },
        { label: 'Layer', icon: 'layer', ring: function () { return layerRing(false); } }].filter(function (it) { return !(it.ring === stitchRing && (L.type === 'stitches' || (L.type === 'image' && L.p.art === 'line'))); }) };
    }
    var p = t.part, key = t.key, how = stitchOfKey(L, key), lineArt = (L.type === 'image' && L.p.art === 'line') || L.type === 'stitches';
    var slot = colourSlot(L, p), name = threadFor(partColor(L, p)).name;
    var isEdge = key === 'stroke' || key === 'stroke2' || key === 'shadow';
    if (L.type === 'text' && !isEdge) items.push({ label: 'Edit text', icon: 'text', run: editText });
    if (!lineArt) items.push({ label: 'Sew as…', icon: 'stitch', note: STITCH_NAME[how], ring: stitchRing });
    if (p.kind === 'fill' && L.type !== 'stitches' && !isEdge && (how === 'auto' || how === 'fill' || how === 'satin')) items.push({ label: 'Direction…', icon: 'dir', ring: dirRing });
    if (slot) items.push({ label: 'Colour', icon: 'colour', run: function (btn) { recolourArea(L, p, slot); } });
    if (!isEdge && sewKeys(L).length > 1) items.push({ label: 'Sew order…', icon: 'order', ring: orderRing });
    if (p.role === 'colour' && !lineArt && sewKeys(L).filter(function (k) { return /^colour:/.test(k) && k !== key; }).length) items.push({ label: 'Merge into…', icon: 'merge', ring: mergeRing });
    if (!isEdge) items.push({ label: 'Leave out', icon: 'skip', run: function () { setStitch(L, key, 'skip', name + ' left out · click its outline to bring it back'); } });
    if (key === 'stroke') items.push({ label: 'Remove edge', icon: 'edge', run: function () { L.fx.stroke.on = false; requestRender(L); renderPanel(); commit(); toast('Edge removed'); } });
    else if (L.type !== 'stitches' && (L.type !== 'text' || !L.fx.stroke.on)) items.push(edgeItem(L));
    items.push({ label: 'Layer', icon: 'layer', ring: function () { return layerRing(false); } });
    var a = p.kind === 'fill' ? angleNear(p, pie.lp) : null;
    if (L.type === 'stitches') {
      var ks0 = sewKeys(L), fname = p.fileThread && p.fileThread.name && !Object.keys(L.colors.recolor || {}).length ? p.fileThread.name : name;
      return { title: fname, sub: L.name + ' · colour ' + (ks0.indexOf(key) + 1) + ' of ' + ks0.length, swatch: slot ? slot.cur : partColor(L, p), items: items };
    }
    return { title: name, sub: (isEdge ? (key === 'stroke' ? 'Edge' : key === 'stroke2' ? 'Second edge' : 'Shadow') : L.name) + ' · ' + (isEdge && how === 'auto' ? 'Satin' : isEdge && how === 'line' ? 'Bean line' : STITCH_NAME[how]) + (a !== null && how !== 'line' && how !== 'outline' ? ' · ' + a + '°' : ''), swatch: slot ? slot.cur : partColor(L, p), items: items };
  }
  function edgeItem(L) {
    var on = !!L.fx.stroke.on;
    return { label: on ? 'Remove edge' : 'Sticker edge', icon: 'edge', on: on, run: function () {
      L.fx.stroke.on = !on; requestRender(L); renderPanel(); commit();
      toast(on ? 'Edge removed' : 'Satin edge added round the whole design · click it to make it a bean line or change its colour');
    } };
  }
  function stitchRing() {
    var L = pie.L, key = pie.t.key, how = stitchOfKey(L, key), edge = key === 'stroke' || key === 'stroke2';
    var opts = edge ? [['auto', 'Satin', 'satin'], ['line', 'Bean line', 'lines']]
      : [['auto', 'Auto', 'auto'], ['satin', 'Satin', 'satin'], ['fill', 'Flat fill', 'tatami'], ['line', 'Lines', 'lines'], ['outline', 'Outline', 'outline']];
    if (pie.t.ghost) opts = opts.filter(function (o) { return o[0] !== 'auto'; });
    var tips = { auto: 'Satin where it’s narrow, fill where it’s wide', satin: 'Satin columns for narrow shapes (wide areas still fill)', fill: 'Even fill rows everywhere, flat and sturdy',
      line: 'Thin strokes as a running line along their middle (tripled where bold), sewn on top', outline: 'A bean stitch round the edge, the inside left to the fabric' };
    return { title: 'Sew as', sub: STITCH_NAME[how], items: opts.map(function (o) {
      return { label: o[1], icon: o[2], on: how === o[0] && !pie.t.ghost, hint: edge ? '' : tips[o[0]], run: function () { setStitch(L, key, o[0], (o[0] === 'auto' ? 'Back to Auto' : 'Sewn as ' + o[1].toLowerCase())); } };
    }) };
  }
  function dirRing() {
    var L = pie.L, t = pie.t, lp = pie.lp, f = rt(L.id).result.frame, key = t.key;
    var mine = (L.dirs || []).filter(function (d) { return d.key === key; });
    function setAngle(ang) {
      var d = { key: key, u: +((lp[0] - f.x0) / Math.max(1e-6, f.w)).toFixed(4), v: +((f.y1 - lp[1]) / Math.max(1e-6, f.h)).toFixed(4), angle: ang };
      L.dirs = (L.dirs || []).filter(function (o) { var a = dirAnchor(L, o); return !(o.key === key && a && Math.hypot(a[0] - lp[0], a[1] - lp[1]) < 1.5); });
      L.dirs.push(d); requestRender(L); commit(); buildGizmo(); refreshToolPanel();
      toast('Stitches set to ' + ang + '° in this area');
    }
    var items = [0, 45, 90, 135].map(function (a) { return { label: a + '°', icon: 'angle', rot: -a, run: function () { setAngle(a); } }; });
    items.unshift({ label: 'Auto', icon: 'auto', on: !mine.length, run: function () {
      L.dirs = (L.dirs || []).filter(function (d) { return d.key !== key; }); requestRender(L); commit(); buildGizmo(); refreshToolPanel(); toast('Direction back to Auto for this colour');
    } });
    items.push({ label: 'Draw it…', icon: 'dir', run: function () { setTool('direction'); toast('Drag across the area in the direction the stitches should run'); } });
    var a0 = angleNear(t.part, lp);
    return { title: 'Direction', sub: a0 === null ? 'Auto' : 'Now ' + a0 + '°', items: items };
  }
  function orderRing() {
    var L = pie.L, key = pie.t.key, ks = sewKeys(L), i = ks.indexOf(key), n = ks.length;
    return { title: 'Sew order', sub: ordinal(i + 1) + ' of ' + n + ' in this layer', items: [
      { label: 'First', icon: 'first', disabled: i === 0, run: function () { moveKey(L, key, 'first'); } },
      { label: 'Earlier', icon: 'earlier', disabled: i === 0, run: function () { moveKey(L, key, 'earlier'); } },
      { label: 'Later', icon: 'later', disabled: i === n - 1, run: function () { moveKey(L, key, 'later'); } },
      { label: 'Last', icon: 'last', disabled: i === n - 1, run: function () { moveKey(L, key, 'last'); } },
      { label: 'Automatic', icon: 'auto', on: !(L.order && L.order.length), run: function () { L.order = []; requestRender(L); commit(); renderPanelSoon(); toast('Sewing order back to automatic'); } }] };
  }
  function mergeRing() {
    var L = pie.L, key = pie.t.key, r = rt(L.id).result, seen = {}, items = [];
    r.parts.forEach(function (p) {
      var k = areaKey(p); if (p.role !== 'colour' || k === key || seen[k] || items.length >= 7) return; seen[k] = 1;
      var col = partColor(L, p);
      items.push({ label: threadFor(col).name, swatch: col, run: function () {
        L.merge = L.merge || {}; L.merge[key] = k;
        Object.keys(L.merge).forEach(function (s) { if (L.merge[s] === key) L.merge[s] = k; });
        requestRender(L); commit(); renderPanelSoon(); toast('Sewn together with ' + threadFor(col).name + ' · one less thread change');
      } });
    });
    return { title: 'Merge into', sub: 'Sew this area with…', items: items };
  }
  function layerRing(top) {
    var L = pie.L, idx = doc.layers.indexOf(L), items = [];
    if (top && L.type === 'text') items.push({ label: 'Edit text', icon: 'text', run: editText });
    if (top && L.type !== 'stitches') items.push(edgeItem(L));
    items.push({ label: 'Duplicate', icon: 'copy', run: function () { duplicateLayer(); } });
    items.push({ label: 'Mirror', icon: 'mirror', on: !!L.tf.mx, run: function () { L.tf.mx = !L.tf.mx; placeLayer(L); sceneChanged(); refreshToolPanel(); commit(); } });
    if (doc.layers.length > 1) {
      items.push({ label: 'Sew later', icon: 'later', disabled: idx === doc.layers.length - 1, run: function () { moveLayer(L, 1); } });
      items.push({ label: 'Sew earlier', icon: 'earlier', disabled: idx === 0, run: function () { moveLayer(L, -1); } });
    }
    if (hasAreaEdits(L)) items.push({ label: 'Reset areas', icon: 'reset', run: function () { resetAreas(L); } });
    items.push({ label: 'Lock', icon: 'lock', run: function () { L.locked = true; refreshLayerRow(L.id); renderPanel(); refreshToolPanel(); commit(); toast('Locked · click it to unlock'); } });
    items.push({ label: 'Delete', icon: 'trash', danger: true, run: function () { deleteLayer(); } });
    return { title: L.name, sub: top ? 'Layer' : 'Layer actions', items: items };
  }
  function resetAreas(L) { L.edits = {}; L.order = []; L.merge = {}; requestRender(L); commit(); renderPanelSoon(); toast('Every area back to Auto'); }
  function editText() {
    if (ui.accordion) ui.acc.design = 'layer';
    ui.open.layer = true; renderPanel();
    setTimeout(function () { var el = document.querySelector('[data-k="L.p.text"]'); if (el) { el.focus(); el.select(); } }, 30);
  }
  function recolourArea(L, p, slot) {
    var hub = pie.el.querySelector('.pie-hub');
    openThreadPicker(hub, slot.cur, 'Colour', function (hex, final) {
      slot.set(hex); recolorLayer(L); refreshLayerRow(L.id); scheduleSequence();
      if (final) { commit(); renderPanelSoon(); }
    });
    closePie(true);
  }

  // ---------- drawing the menu ----------
  function openPie(cx, cy, L, hit) {
    closePie();
    var lp = layerXf(L).inv(hit);
    pie = { L: L, lp: lp, t: pieHit(L, lp), x: cx, y: cy, stack: [] };
    var el = document.createElement('div');
    el.className = 'pie'; el.setAttribute('role', 'menu');
    pie.el = el;
    $('workspace').appendChild(el);
    ui.pieFocus = pie.t && !pie.t.ghost ? { id: L.id, key: pie.t.key } : null;
    recolorLayer(L);
    showRing(mainRing(), false);
    hideTip();
  }
  function closePie(keepPicker) {
    if (!pie) return;
    var L = pie.L, el = pie.el;
    pie = null;
    el.classList.remove('open'); el.classList.add('closing');
    setTimeout(function () { el.remove(); }, keepPicker ? 400 : 160);
    if (ui.pieFocus) { ui.pieFocus = null; if (L) recolorLayer(L); }
  }
  function showRing(ring, nested) {
    var el = pie.el, n = ring.items.length;
    pie.ring = ring;
    // labels grow outward from their spot on the ring (right-hand ones to the right, left-hand ones to the left), so the
    // ring stays small and pills never collide
    var R = n <= 4 ? 66 : n <= 6 ? 78 : 92, RY = R * 0.95;
    // keep the whole menu on screen; on a phone-width view the pills sit in two columns under the hub instead
    var ws = $('workspace').getBoundingClientRect(), narrow = ws.width < 600, pad = R + 160, rows = Math.ceil(n / 2);
    var x = narrow ? ws.left + ws.width / 2 : Math.max(ws.left + pad, Math.min(ws.right - pad, pie.x));
    var y = narrow ? Math.max(ws.top + 90, Math.min(ws.bottom - 60 - rows * 46, pie.y)) : Math.max(ws.top + RY + 86, Math.min(ws.bottom - RY - 40, pie.y));
    el.classList.toggle('narrow', narrow);
    el.style.left = (x - ws.left) + 'px'; el.style.top = (y - ws.top) + 'px';
    el.setAttribute('aria-label', ring.title);
    var html = '<div class="pie-disc" style="--r:' + (R + 110) + 'px"></div>' +
      '<div class="pie-title" style="--ty:' + (narrow ? -58 : -(RY + 72)) + 'px"><b>' + esc(ring.title) + '</b>' + (ring.sub ? '<span>' + esc(ring.sub) + '</span>' : '') + '</div>';
    ring.items.forEach(function (it, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n, c = Math.cos(a), sn = Math.sin(a), dx = Math.round(c * R), dy = Math.round(sn * RY + (Math.abs(c) <= 0.25 ? Math.sign(sn) * 20 : 0));
      var ax = c > 0.25 ? '-14px' : c < -0.25 ? 'calc(-100% + 14px)' : '-50%';
      if (narrow) { var col = i % 2; c = col ? 1 : -1; ax = col ? '0px' : '-100%'; dx = col ? 6 : -6; dy = 52 + Math.floor(i / 2) * 46; }
      html += '<button type="button" role="menuitem" class="pie-item' + (it.on ? ' on' : '') + (it.danger ? ' danger' : '') + (c < -0.25 ? ' left' : '') + '" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') +
        ' style="--x:' + dx + 'px;--y:' + dy + 'px;--ax:' + ax + ';--d:' + (i * 22) + 'ms"' + (it.hint ? ' title="' + esc(it.hint) + '"' : '') + '>' +
        (it.swatch ? '<span class="sw" style="background:' + it.swatch + '"></span>' : '<span class="pi"' + (it.rot !== undefined ? ' style="transform:rotate(' + it.rot + 'deg)"' : '') + '>' + pic(it.icon) + '</span>') +
        '<span class="pl">' + esc(it.label) + (it.ring ? '<i aria-hidden="true">›</i>' : '') + '</span>' + (i < 9 ? '<kbd>' + (i + 1) + '</kbd>' : '') + '</button>';
    });
    // the hub goes last so it sits on top: the pointer starts over it, not over a pill that is still flying out
    html += '<button type="button" class="pie-hub" aria-label="' + (nested ? 'Back' : 'Close') + '" title="' + (nested ? 'Back (Esc)' : 'Close (Esc)') + '">' +
      (ring.swatch ? '<span class="sw" style="background:' + ring.swatch + '"></span>' : '') + pic(nested ? 'back' : 'close') + '</button>';
    el.classList.remove('open');
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add('open');
    var first = el.querySelector('.pie-item:not([disabled])'); if (first) first.focus({ preventScroll: true });
  }
  function pieActivate(i) {
    if (!pie) return;
    var it = pie.ring.items[i]; if (!it || it.disabled) return;
    if (it.ring) { pie.stack.push(pie.ring); showRing(it.ring(), true); return; }
    var run = it.run; closePie(); run();
  }
  function pieBack() {
    if (!pie) return;
    if (pie.stack.length) { var prev = pie.stack.pop(); showRing(pie.stack.length ? prev : mainRing(), pie.stack.length > 0); }
    else closePie();
  }
  document.addEventListener('click', function (e) {
    if (!pie || !pie.el.contains(e.target)) return;
    var b = e.target.closest('.pie-item'); if (b) { pieActivate(+b.dataset.i); return; }
    if (e.target.closest('.pie-hub')) pieBack();
  });
  // anything outside closes it (the canvas handler closes it too, before starting a gesture)
  document.addEventListener('pointerdown', function (e) { if (pie && !pie.el.contains(e.target) && e.target !== canvas) closePie(); }, true);
  window.addEventListener('keydown', function (e) {
    if (!pie) return;
    var items = Array.prototype.slice.call(pie.el.querySelectorAll('.pie-item:not([disabled])')), i = items.indexOf(document.activeElement);
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); pieBack(); }
    else if (/^[1-9]$/.test(e.key)) { e.preventDefault(); pieActivate(+e.key - 1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); if (items.length) items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); if (items.length) items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') return;
    else return;
    e.stopPropagation();
  }, true);
  // keyboard route in: with a layer selected and the view focused, the context-menu key or Shift+F10 opens it at the layer's centre
  canvas.addEventListener('keydown', function (e) {
    if (ui.stage !== 'design' || !(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
    var L = selLayer(); if (!L) return;
    e.preventDefault();
    var v = new THREE.Vector3(L.tf.x, L.tf.y, 0).project(camera), rc = canvas.getBoundingClientRect();
    openPie(rc.left + (v.x + 1) / 2 * rc.width, rc.top + (1 - v.y) / 2 * rc.height, L, [L.tf.x, L.tf.y]);
  });
  var panelSoonT = null;
  function renderPanelSoon() { clearTimeout(panelSoonT); panelSoonT = setTimeout(function () { if (ui.stage === 'design') renderPanel(); }, 60); }
