  // ===================== stitch direction per colour island =====================
  // With the Direction tool, drag across any filled area to set the angle its stitches run at. The direction is
  // stored against that colour (part) and a point in the artwork; the engine applies it to the island under the point.
  function layerXf(L) { return X.makeXform({ x: L.tf.x, y: L.tf.y, rotation: L.tf.rot, mirrorX: L.tf.mx, mirrorY: L.tf.my }); }
  function dirKeyOf(part) { return part.role === 'band' ? 'fill' : (part.key || part.role); }
  function segDist(p, c) {
    var ax = c[0], ay = c[1], bx = c[2], by = c[3], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
    return Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t);
  }
  // the topmost filled part of layer L under a layer-local point (outlines follow their path and are skipped)
  function partAt(L, lp) {
    var r = rt(L.id); if (!r.result) return null;
    var best = null;
    r.result.parts.forEach(function (p) {
      if (p.kind !== 'fill') return;
      for (var i = 0; i < p.chords.length; i++) if (segDist(lp, p.chords[i]) < 0.45) { best = p; break; }
    });
    return best;
  }
  // stitch angle near a point (0–180°, measured like a protractor on the layer)
  function angleNear(part, lp) {
    var cs = 0, sn = 0;
    part.chords.forEach(function (c) {
      var mx = (c[0] + c[2]) / 2, my = (c[1] + c[3]) / 2;
      if (Math.hypot(mx - lp[0], my - lp[1]) > 2) return;
      var a = Math.atan2(c[3] - c[1], c[2] - c[0]), L2 = Math.hypot(c[2] - c[0], c[3] - c[1]);
      cs += Math.cos(2 * a) * L2; sn += Math.sin(2 * a) * L2;
    });
    if (Math.hypot(cs, sn) < 1e-6) return null;
    var deg = 0.5 * Math.atan2(sn, cs) * 180 / Math.PI;
    return Math.round((deg + 180) % 180);
  }
  function dirAnchor(L, d) {
    var f = rt(L.id).result && rt(L.id).result.frame;
    return f ? [f.x0 + d.u * f.w, f.y1 - d.v * f.h] : null;
  }
  function keyColour(L, key) {
    var r = rt(L.id); if (!r.result) return '#888888';
    var p = r.result.parts.filter(function (q) { return dirKeyOf(q) === key; })[0];
    return p ? partColor(L, p) : '#888888';
  }
  function nearestDir(L, lp, maxMM) {
    var best = -1, bd = maxMM;
    (L.dirs || []).forEach(function (d, i) { var a = dirAnchor(L, d); if (!a) return; var dd = Math.hypot(a[0] - lp[0], a[1] - lp[1]); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  function dirPointerDown(hit, e) {
    var L = pickLayer(hit);
    if (!L) return false;
    if (doc.sel !== L.id) selectLayer(L.id);
    if (L.locked) { toast('This layer is locked.'); return true; }
    var lp = layerXf(L).inv(hit);
    if (e.altKey) {
      var k = nearestDir(L, lp, 4);
      if (k >= 0) { L.dirs.splice(k, 1); requestRender(L); commit(); buildGizmo(); refreshToolPanel(); toast('Direction reset to Auto'); }
      else toast('Alt-click an arrow to reset that area to Auto.');
      return true;
    }
    var part = partAt(L, lp);
    if (!part) { toast('Drag across a filled area. Outlines always follow their path.'); return true; }
    gesture = { mode: 'dir', L: L, key: dirKeyOf(part), part: part, a: lp, b: lp, snap: true };
    hideTip();
    return true;
  }
  function dirAngleOf(g) {
    var deg = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) * 180 / Math.PI;
    if (g.snap) deg = Math.round(deg / 15) * 15;
    return Math.round(((deg % 180) + 180) % 180);
  }
  function dirPointerMove(hit, e, cx, cy) {
    gesture.b = layerXf(gesture.L).inv(hit); gesture.snap = !e.shiftKey;
    if (Math.hypot(gesture.b[0] - gesture.a[0], gesture.b[1] - gesture.a[1]) > 0.8) showTip('<b>' + dirAngleOf(gesture) + '°</b> ' + (gesture.snap ? '· snaps to 15°, hold Shift for free angle' : '· free angle'), cx + 16, cy + 16);
    buildGizmo();
  }
  function dirPointerUp() {
    var g = gesture, L = g.L;
    hideTip();
    if (Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) < 1.2) { gesture = null; buildGizmo(); return; }
    var f = rt(L.id).result.frame, ang = dirAngleOf(g);
    var d = { key: g.key, u: +((g.a[0] - f.x0) / Math.max(1e-6, f.w)).toFixed(4), v: +((f.y1 - g.a[1]) / Math.max(1e-6, f.h)).toFixed(4), angle: ang };
    L.dirs = (L.dirs || []).filter(function (o) { var a = dirAnchor(L, o); return !(o.key === d.key && a && Math.hypot(a[0] - g.a[0], a[1] - g.a[1]) < 1.5); });
    L.dirs.push(d);
    gesture = null;
    requestRender(L); commit(); buildGizmo(); refreshToolPanel();
    toast('Stitches set to ' + ang + '° in this area');
  }
  function dirHover(e, hit) {
    var L = hit ? pickLayer(hit) : null;
    if (!L) { hideTip(); return; }
    var lp = layerXf(L).inv(hit), part = partAt(L, lp);
    if (!part) { hideTip(); return; }
    var key = dirKeyOf(part), set = (L.dirs || []).some(function (d) { return d.key === key && rt(L.id).result && rt(L.id).result.dirIslands; });
    var a = angleNear(part, lp), name = threadFor(partColor(L, part)).name;
    showTip('<b>' + esc(name) + '</b> · stitches at ' + (a === null ? '—' : a + '°') + '<br><span>Drag across this area to set its direction' + (set ? ' · Alt-click an arrow to reset' : '') + '</span>', e.clientX + 16, e.clientY + 16);
  }
  // after a render: drop directions that no longer land on anything, and older duplicates on the same island
  function tidyDirs(L, res) {
    if (!L.dirs || !L.dirs.length || !res.dirIslands) return false;
    var seen = {}, keep = [];
    for (var i = L.dirs.length - 1; i >= 0; i--) {
      var isl = res.dirIslands[i];
      if (!isl || seen[isl]) continue;
      seen[isl] = 1; keep.unshift(L.dirs[i]);
    }
    if (keep.length === L.dirs.length) return false;
    var lost = L.dirs.length - keep.length;
    L.dirs = keep;
    toast(lost === 1 ? 'That direction didn’t land on a filled area, or replaced an earlier one in the same area.' : lost + ' directions were merged or no longer land on a filled area.');
    return true;
  }
  function drawDirGizmo(L, z) {
    var xf = layerXf(L), orange = 0xff8a00;
    function seg(a, b, col, op) {
      var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z)]), gizmoMat(col, op));
      l.renderOrder = 12; gizmo.add(l);
    }
    function arrow(lp, deg, len, col) {
      var r = deg * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r), px = -uy, py = ux, h = len / 2, k = len * 0.18;
      var A = [lp[0] - ux * h, lp[1] - uy * h], B = [lp[0] + ux * h, lp[1] + uy * h];
      seg(xf.fwd(A), xf.fwd(B), col);
      [[A, 1], [B, -1]].forEach(function (e) {
        var tip = e[0], s = e[1];
        seg(xf.fwd(tip), xf.fwd([tip[0] + (ux * s + px) * k, tip[1] + (uy * s + py) * k]), col);
        seg(xf.fwd(tip), xf.fwd([tip[0] + (ux * s - px) * k, tip[1] + (uy * s - py) * k]), col);
      });
      var dot = new THREE.Mesh(new THREE.CircleGeometry(len * 0.07, 16), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      var w = xf.fwd(lp); dot.position.set(w[0], w[1], z + 0.1); dot.renderOrder = 12; gizmo.add(dot);
    }
    var len = Math.max(7, handleSize() * 6);
    (L.dirs || []).forEach(function (d) { var a = dirAnchor(L, d); if (a) arrow(a, d.angle, len, orange); });
    if (gesture && gesture.mode === 'dir' && gesture.L === L) {
      seg(xf.fwd(gesture.a), xf.fwd(gesture.b), 0xffffff, 0.9);
      if (Math.hypot(gesture.b[0] - gesture.a[0], gesture.b[1] - gesture.a[1]) > 0.8) arrow(gesture.a, dirAngleOf(gesture), len, 0x00b2ff);
    }
  }
  function dirPanelHtml(L) {
    var list = (L.dirs || []).map(function (d, i) {
      var col = keyColour(L, d.key), t = threadFor(col);
      return '<li><span class="sw" style="background:' + col + '"></span><span class="nm">' + esc(t.name) + '</span>' +
        '<span class="unit" style="width:84px"><input class="field num" style="width:100%" type="number" min="0" max="179" step="1" data-dir-angle="' + i + '" value="' + d.angle + '" aria-label="Angle"><i>°</i></span>' +
        '<button type="button" class="ibtn" data-dir-del="' + i + '" aria-label="Reset to Auto" title="Reset to Auto">×</button></li>';
    }).join('');
    return '<h3>Stitch direction · <span style="font-weight:400">' + esc(L.name) + '</span></h3>' +
      (L.locked ? '<p class="note warn">Locked — unlock it in the layer list to change it.</p>' : '') +
      '<p class="note">Drag across a coloured area to set the angle its stitches run at. Snaps to 15°; hold Shift for any angle. Alt-click an arrow to reset that area to Auto.</p>' +
      (list ? '<ul class="dirlist">' + list + '</ul><div class="btnrow"><button type="button" class="btn sm" data-act="dirs-reset">Reset all to Auto</button></div>'
        : '<p class="note">No areas set yet — everything uses Auto: rows across strokes and small shapes, and at 45° to the long axis of big areas.</p>') +
      (doc.stitch.satin ? '<p class="note">With Experimental › Satin fill on, setting a direction on a narrow stroke sews it at that fixed angle instead of following the stroke.</p>' : '');
  }
