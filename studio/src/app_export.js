  // ===================== export: sewing plan, machine files, saving =====================
  var lastSeq = null, seqStale = true, seqTimer = null;
  function placedLayers() {
    return doc.layers.filter(function (L) { return L.visible && rt(L.id).result; }).map(function (L) {
      var r = rt(L.id);
      var parts = [], byColour = {};
      r.result.parts.forEach(function (p) {
        var c = partColor(L, p);
        // stripes that share a thread (trans, bisexual, agender…) sew together: fewer colour changes
        if (p.role === 'band' && byColour[c]) { var m = byColour[c]; m.chords = m.chords.concat(p.chords); m.under = (m.under || []).concat(p.under || []); return; }
        var q = Object.assign({}, p, { color: c, thread: threadFor(c) });
        if (p.role === 'band') byColour[c] = q;
        parts.push(q);
      });
      return { name: L.name, result: Object.assign({}, r.result, { parts: parts }),
        transform: { x: L.tf.x, y: L.tf.y, rotation: L.tf.rot, mirrorX: !!L.tf.mx, mirrorY: !!L.tf.my } };
    });
  }
  function scheduleSequence() {
    seqStale = true; clearTimeout(seqTimer);
    seqTimer = setTimeout(runSequence, 380);
    updateAction();
  }
  function runSequence() {
    if (anyBusy()) { seqTimer = setTimeout(runSequence, 300); return; }
    var pl = placedLayers();
    try { lastSeq = pl.length ? X.buildSequence(pl, { minStitch: effStitch(null).minStitch, speed: machine().spm }) : null; }
    catch (err) { lastSeq = null; console.error(err); toast('Could not plan the sewing path: ' + (err && err.message || err)); }
    seqStale = false;
    updateAction();
    if (ui.stage === 'export') renderPanel();
  }

  function exportName() {
    var t = doc.layers.filter(function (L) { return L.type === 'text'; })[0];
    return X.cardName(doc.cardName || (t ? t.p.text : '') || 'DESIGN');
  }
  var desktop = window.stitchDesktop || null;
  var DL = null;
  try {
    if (!desktop && window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then(function (d) { DL = d; if (ui.stage === 'export') renderPanel(); }, function () {});
    }
  } catch (e) {}

  function exportHtml() {
    var name = exportName(), H = HOOPS[doc.hoop], s = lastSeq, ready = canExport();
    var cid = 'f' + (++fid);
    var M = machine(), deco = M.id === 'deco330';
    var machine_ = sec('machine', 'machine', 'Machine & files', esc(M.format),
      '<dl class="kv"><dt>Machine</dt><dd>' + esc(M.name) + '</dd><dt>Format</dt><dd>' + esc(M.files) + '</dd>' + (M.folder ? '<dt>Card folder</dt><dd>' + esc(M.folder) + '</dd>' : '<dt>Copy to</dt><dd>' + esc(M.media) + '</dd>') + '<dt>Hoop</dt><dd>' + esc(H.name) + '</dd></dl>' +
      row('File name', '<div class="ctl"><input class="field" id="' + cid + '" data-k="doc.cardName" data-upper maxlength="8" placeholder="' + esc(name) + '" value="' + esc(doc.cardName) + '" style="font-family:var(--font-data);text-transform:uppercase"></div>', cid) +
      '<p class="note">Up to 8 letters, digits or underscores — the machine shows this name. ' + (deco ? 'Files: <b style="font-family:var(--font-data)"><span id="cardNote">' + esc(name) + '</span>.EXP</b>, .INF and .BMP.' : 'File: <b style="font-family:var(--font-data)"><span id="cardNote">' + esc(name) + '</span>.DST</b>.') + ' Pick another machine from the top bar.</p>' +
      '<div class="lab" style="font-size:13.5px;font-weight:600">Also include</div>' +
      (deco ? '' : check('doc.formats.exp', 'Bernina EXP+ (Deco 330)')) + check('doc.formats.jef', 'Janome JEF') + (deco ? check('doc.formats.dst', 'Tajima DST') : '') + check('doc.formats.sheet', 'Worksheet (colour sequence)'));
    var fit = fitState.empty ? '<p class="note">Add a layer in Design first.</p>' :
      '<div style="display:flex;align-items:center;gap:10px"><span class="pill ' + (fitState.ok ? 'good' : 'bad') + '">' + (fitState.ok ? 'Fits' : 'Does not fit') + '</span><span style="font-size:13.5px">' + esc(fitState.text) + '</span></div>' +
      (fitState.ok ? '' : '<p class="note err">The needle must stay inside the sewing field. Move or shrink the design, or pick a bigger hoop.</p><div class="btnrow"><button type="button" class="btn sm" data-act="goto-design">Back to Design</button></div>');
    var hoop = sec('fit', 'hoop', 'Hoop check', esc(H.field.join(' × ') + ' mm'), fit);
    if (!s || seqStale) {
      var waiting = doc.layers.length ? '<p class="note">' + (anyBusy() ? 'Stitching layers…' : 'Planning the sewing path…') + '</p>' : '<p class="note">Nothing to export yet.</p>';
      return machine_ + hoop + sec('seq', 'list', 'Colour sequence', '', waiting) + bakeHtml();
    }
    var seqList = '<ol class="seqlist">' + s.blocks.map(function (b) {
      var t = b.thread;
      return '<li><span class="sw" style="background:' + b.color + '"></span><span style="min-width:0"><b>' + (t ? esc(t.name) + ' · ' + t.code : b.color) + '</b><small>' + esc(b.layers.join(', ')) + '</small></span><span class="ct">' + nfmt(b.stitches) + '</span></li>';
    }).join('') + '</ol>' + (s.threads.length > 1 || s.stats.jumps ? '<p class="note">' + (M.trims ? 'The ' + esc(M.name) + ' stops at each colour change and trims the thread itself. Within a colour the needle works left to right; check the ' + s.stats.jumps + ' jumps and snip any loose ones after sewing.'
      : 'The ' + esc(M.name) + ' stops at each colour change. It has no trimmer: within a colour the needle works left to right, so snip the ' + s.stats.jumps + ' jump threads after sewing.') + '</p>' : '');
    var sum = '<dl class="kv"><dt>Stitches</dt><dd>' + nfmt(s.stats.stitches) + '</dd><dt>Colours</dt><dd>' + s.threads.length + '</dd><dt>Colour changes</dt><dd>' + s.stats.colorChanges + '</dd>' +
      '<dt>Jumps</dt><dd>' + s.stats.jumps + '</dd><dt>Hidden travel runs</dt><dd>' + s.stats.travels + '</dd><dt>Design size</dt><dd>' + s.bounds.w.toFixed(1) + ' × ' + s.bounds.h.toFixed(1) + ' mm</dd>' +
      '<dt>Sewing time</dt><dd>≈ ' + fmtTime(s.stats.minutes) + '</dd></dl>';
    var dis = ready ? '' : ' disabled';
    var save = sec('save', 'save', 'Save', '',
      '<button type="button" class="btn primary big" data-act="save-zip"' + dis + '>' + ic('save') + 'Save ' + (deco ? 'card' : 'machine') + ' files (.zip)</button>' +
      (desktop && desktop.writeCard ? '<button type="button" class="btn big" data-act="write-card"' + dis + '>' + ic('card') + 'Write to ' + esc(M.media) + '…</button>' : '') +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="save-png"' + dis + '>Preview image (.png)</button>' +
      '<button type="button" class="btn sm" data-act="save-single" data-v="worksheet"' + dis + '>Worksheet (.txt)</button></div>' +
      (deco ? '<p class="note">To sew: format the card in the machine (it creates the <b>EmbF5</b> folder), copy the three files from the zip’s EmbF5 folder straight into it, then insert the card and choose ' + esc(H.name) + '.</p>'
        : '<p class="note">To sew: copy <b>' + esc(name) + '.DST</b> to a FAT32 USB stick (or send it over Wi-Fi), open it on the ' + esc(M.name) + ' and fit the ' + esc(H.name) + '.</p>') +
      (!desktop && !DL ? '<p class="note">If your browser blocks the download, open this page in a normal browser tab.</p>' : ''));
    return machine_ + hoop + sec('seq', 'list', 'Colour sequence', s.blocks.length + ' block' + (s.blocks.length === 1 ? '' : 's'), seqList) + sec('summary', 'report', 'Summary', '', sum) + save + bakeHtml();
  }

  function canvasRGBA(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); draw(x); return { canvas: c, data: x.getImageData(0, 0, w, h).data };
  }
  function makeFiles(seq) {
    var name = exportName(), H = HOOPS[doc.hoop], files = [], listed = [];
    var bmp = canvasRGBA(160, 120, function (x) { X.drawPreview(seq, x, 160, 120, { lineWidth: 1 }); });
    var deco = doc.machine === 'deco330', other = 'Other machines/';
    // the chosen machine's files first (Deco: EmbF5 folder; Poolin: the DST at the top of the zip / stick)
    if (deco) {
      files.push({ name: 'EmbF5/' + name + '.EXP', data: X.writeEXP(seq) });
      files.push({ name: 'EmbF5/' + name + '.INF', data: X.writeINF(seq, { hoop: doc.hoop }) });
      files.push({ name: 'EmbF5/' + name + '.BMP', data: X.writeBMP(bmp.data, 160, 120) });
    } else {
      files.push({ name: name + '.DST', data: X.writeDST(seq, name), primary: true });
      if (doc.formats.exp) {
        var decoHoop = H.field[0] <= 126 && H.field[1] <= 110 ? 'A' : 'B';
        files.push({ name: other + 'EmbF5/' + name + '.EXP', data: X.writeEXP(seq) });
        files.push({ name: other + 'EmbF5/' + name + '.INF', data: X.writeINF(seq, { hoop: decoHoop }) });
        files.push({ name: other + 'EmbF5/' + name + '.BMP', data: X.writeBMP(bmp.data, 160, 120) });
      }
    }
    if (doc.formats.jef) files.push({ name: other + name + '.JEF', data: X.writeJEF(seq, { hoop: deco ? doc.hoop : 'B', threadAlt: function (hex, ex) { return E.nearestThread(hex, ex).index; } }) });
    if (deco && doc.formats.dst) files.push({ name: other + name + '.DST', data: X.writeDST(seq, name) });
    files.forEach(function (f) { listed.push(f.name); });
    if (doc.formats.sheet) files.push({ name: name + '_worksheet.txt', data: new TextEncoder().encode(worksheetText(seq, listed)) });
    return { name: name, files: files };
  }
  function worksheetText(seq, listed) {
    var H = HOOPS[doc.hoop], title = doc.layers.map(function (L) { return L.name; }).join(' + ').slice(0, 60) || exportName();
    var line = lineOf(), R = recommend(), T = doc.threads;
    var mats = ['Thread    ' + line.brand + ' ' + line.line + ', ' + T.weight + ' wt' + (T.snap ? ' (colours matched to this chart)' : ''),
      'Bobbin    60 or 90 wt bobbin thread', 'Needle    ' + T.needle + ' ' + POINTS[T.point].toLowerCase() + (T.needle !== R.needle || T.point !== R.point ? '  (recommended: ' + R.needle + ' ' + POINTS[R.point].toLowerCase() + ')' : ''),
      'Fabric    ' + FABRICS[T.fabric].label, 'Backing   ' + R.stab];
    return X.worksheet(seq, { title: title, machine: machine().name, machineId: machine().id, trims: machine().trims, hoopName: H.name + ' (' + H.field[0] + ' x ' + H.field[1] + ' mm)', files: listed, materials: mats });
  }
  function previewPngBlob(seq) {
    var w = 1400, h = Math.round(1400 * Math.max(0.35, Math.min(1.4, (seq.bounds.h + 24) / (seq.bounds.w + 24))));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    X.drawPreview(seq, c.getContext('2d'), w, h, { margin: 60, background: doc.fabric });
    return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/png'); });
  }

  // save through the desktop shell, the artifact's download prompt, or a plain browser download
  function saveBytes(filename, data, mime) {
    if (desktop && desktop.saveFile) return desktop.saveFile(filename, data instanceof Blob ? null : data, mime).then(function (r) { return r || { ok: true }; });
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    if (DL) {
      return DL.save({ filename: filename, data: blob }).then(function () { return { ok: true }; }, function (err) {
        if (err && err.code === 'declined') return { canceled: true };
        if (err && (err.code === 'rate_limited')) return { error: 'Another save is waiting for your answer.' };
        if (err && (err.code === 'unavailable' || err.code === 'not_granted' || err.code === 'capability_disabled' || err.code === 'capability_removed')) { DL = null; return anchorSave(filename, blob); }
        return { error: (err && err.message) || 'The save did not go through.' };
      });
    }
    return anchorSave(filename, blob);
  }
  function anchorSave(filename, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    return Promise.resolve({ ok: true });
  }
  function report(r, what) {
    if (!r) return;
    if (r.canceled) toast('Save cancelled');
    else if (r.error) toast(r.error);
    else toast(what + (r.path ? ' → ' + r.path : ''));
  }
  function guardExport() {
    if (canExport()) return true;
    toast(fitState.ok ? 'Wait for stitching to finish, then try again.' : 'The design does not fit the hoop: ' + fitState.text);
    return false;
  }
  function saveCardZip() {
    if (!guardExport()) return;
    var out = makeFiles(lastSeq);
    previewPngBlob(lastSeq).then(function (png) { return png ? png.arrayBuffer() : null; }).then(function (buf) {
      if (buf) out.files.push({ name: out.name + '_preview.png', data: new Uint8Array(buf) });
      return saveBytes(out.name + '.zip', X.zip(out.files), 'application/zip');
    }).then(function (r) { report(r, 'Saved ' + out.name + '.zip'); }).catch(function (err) { toast('Save failed: ' + (err && err.message || err)); });
  }
  function savePreviewPng() {
    if (!guardExport()) return;
    var name = exportName();
    previewPngBlob(lastSeq).then(function (b) {
      if (desktop) return b.arrayBuffer().then(function (buf) { return saveBytes(name + '_preview.png', new Uint8Array(buf), 'image/png'); });
      return saveBytes(name + '_preview.png', b, 'image/png');
    }).then(function (r) { report(r, 'Saved the preview'); }).catch(function (err) { toast('Save failed: ' + (err && err.message || err)); });
  }
  function saveSingle(kind) {
    if (!guardExport()) return;
    var out = makeFiles(lastSeq);
    if (kind === 'worksheet') saveBytes(out.name + '_worksheet.txt', new TextEncoder().encode(worksheetText(lastSeq, out.files.map(function (f) { return f.name; }))), 'text/plain').then(function (r) { report(r, 'Saved the worksheet'); });
  }
  function writeToCard() {
    if (!guardExport() || !desktop || !desktop.writeCard) return;
    var out = makeFiles(lastSeq);
    var deco = doc.machine === 'deco330';
    var card = deco ? out.files.filter(function (f) { return f.name.indexOf('EmbF5/') === 0; }).map(function (f) { return { name: f.name.slice(6), data: f.data }; })
      : out.files.filter(function (f) { return f.primary; }).map(function (f) { return { name: f.name, data: f.data }; });
    desktop.writeCard(card, deco ? 'EmbF5' : '').then(function (r) { report(r, 'Written to the card'); }, function (err) { toast('Could not write to the card: ' + (err && err.message || err)); });
  }

  // ---------- PBR texture bake (Substance Painter and other PBR tools) ----------
  // The same instanced thread ribbons are drawn top-down with an orthographic camera and bake shaders that write
  // albedo, a tangent-space normal, height / roughness / metallic and ambient occlusion. Depth testing keeps the
  // top-most thread. Then the CPU downsamples, adds the fabric (or an opacity mask for decals) and contact shadows.
  ui.bake = { res: 2048, bg: 'decal', normal: 'gl' };
  var lastBake = null, baking = false;
  function bakeHtml() {
    var dis = !doc.layers.length || baking ? ' disabled' : '';
    var thumbs = lastBake ? '<div class="bakethumbs">' + lastBake.previews.map(function (p) { return '<figure><img alt="" src="' + p.url + '"><figcaption>' + esc(p.label) + '</figcaption></figure>'; }).join('') + '</div>' +
      '<p class="note">Last bake: ' + lastBake.res + ' px, ' + lastBake.mm.toFixed(1) + ' mm square (' + (lastBake.res / lastBake.mm).toFixed(1) + ' px/mm).</p>' : '';
    return sec('bake', 'sheen', 'PBR texture bake', 'Substance Painter',
      row('Resolution', seg('ui.bake.res', [[1024, '1K'], [2048, '2K'], [4096, '4K']], { label: 'Texture resolution' })) +
      row('Background', seg('ui.bake.bg', [['decal', 'None', 'alpha'], ['fabric', 'Fabric', 'twill']], { label: 'Background' })) +
      row('Normal map', seg('ui.bake.normal', [['gl', 'OpenGL'], ['dx', 'DirectX']], { label: 'Normal map format' })) +
      '<button type="button" class="btn big" data-act="bake"' + dis + '>' + ic('save') + (baking ? 'Baking…' : 'Bake PBR maps (.zip)') + '</button>' + thumbs +
      '<p class="note">Base colour, normal, roughness, metallic, height and ambient occlusion' + '. With no background, every map has an alpha channel (transparent where there is no thread, with padded edges) plus a separate Opacity map. Files are named so Substance Painter assigns them automatically. Roughness and metallic come from each layer’s thread type. Substance uses OpenGL normals by default.</p>');
  }
  var bakeMat = null;
  function makeBakeMat() {
    var fs = [
      'uniform float uMode; uniform float uZMax; uniform float uFlipY;',
      'varying vec3 vW; varying vec3 vT; varying vec3 vS; varying vec2 vUV; varying float vLen; varying float vAO; varying float vSeed; varying vec3 vCol; varying float vMat;',
      'uniform float uTwist;',
      'void main(){',
      '  vec3 T = normalize(vT); vec3 S = normalize(vS - T * dot(vS, T)); vec3 N0 = normalize(cross(T, S)); if (N0.z < 0.0) N0 = -N0;',
      '  float vv = clamp(vUV.y, -1.0, 1.0);',
      '  vec3 N = normalize(N0 * sqrt(max(1.0 - vv * vv * 0.9, 0.0)) + S * vv * 0.95);',
      '  float ph = vUV.x * vLen * uTwist + vv * 0.6 + vSeed, tw = sin(6.2832 * ph);',
      '  N = normalize(N + T * 0.28 * cos(6.2832 * ph));',
      '  float k = clamp(0.22 / vLen, 0.02, 0.35), e = smoothstep(0.0, k, vUV.x) * smoothstep(1.0, 1.0 - k, vUV.x);',
      '  float metal = step(2.5, vMat);',
      '  float rough = vMat < 0.5 ? 0.32 : vMat < 1.5 ? 0.42 : vMat < 2.5 ? 0.72 : 0.26;',
      '  rough = clamp(rough + 0.05 * tw + 0.1 * (1.0 - e), 0.04, 1.0);',
      '  vec3 albedo = vCol * (0.9 + 0.1 * (0.5 + 0.5 * tw));',
      '  float ao = clamp(vAO * mix(0.72, 1.0, e) * (1.0 - 0.22 * vv * vv), 0.0, 1.0);',
      '  if (uMode < 0.5) gl_FragColor = vec4(pow(albedo, vec3(1.0 / 2.2)), 1.0);',
      '  else if (uMode < 1.5) { vec3 n = N; n.y *= uFlipY; gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }',
      '  else if (uMode < 2.5) gl_FragColor = vec4(clamp(vW.z / uZMax, 0.0, 1.0), rough, metal, 1.0);',
      '  else gl_FragColor = vec4(ao, ao, ao, 1.0);',
      '}'
    ].join('\n');
    return new THREE.ShaderMaterial({ vertexShader: threadVS, fragmentShader: fs, side: THREE.DoubleSide,
      uniforms: Object.assign({}, shared, { uMode: { value: 0 }, uZMax: { value: 3 }, uFlipY: { value: 1 } }) });
  }
  function bakePBR(o) {
    var b = designBounds(); if (!b) throw new Error('Nothing to bake');
    var margin = 3, mm = Math.max(b.maxX - b.minX, b.maxY - b.minY) + 2 * margin, cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    var maxT = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    var res = Math.min(o.res, maxT), ss = res * 2 <= Math.min(maxT, 4096) ? 2 : 1, sz = res * ss;
    var half = mm / 2, bc = new THREE.OrthographicCamera(cx - half, cx + half, cy + half, cy - half, 0.1, 200);
    bc.position.set(0, 0, 100); bc.up.set(0, 1, 0); bc.lookAt(0, 0, 0);
    bc.left = cx - half; bc.right = cx + half; bc.top = cy + half; bc.bottom = cy - half;
    bc.position.set(0, 0, 100); bc.updateProjectionMatrix();
    // the camera looks down -z from (0,0,100); its frustum spans the design
    bc.left = -half + cx; bc.right = half + cx; bc.top = half + cy; bc.bottom = -half + cy; bc.updateProjectionMatrix();
    var zmax = 0.6; doc.layers.forEach(function (L, i) { var r = rt(L.id); if (r.result) zmax = Math.max(zmax, i * 0.22 + r.result.parts.length * 0.14 + 0.6); });
    if (!bakeMat) bakeMat = makeBakeMat();
    bakeMat.uniforms.uZMax.value = zmax; bakeMat.uniforms.uFlipY.value = o.normal === 'dx' ? -1 : 1;
    // isolate the threads
    var hidden = [], keepSew = ui.sew;
    scene.children.forEach(function (c) { if (c !== layerRoot && c.visible && !c.isLight) { c.visible = false; hidden.push(c); } });
    var rootPos = layerRoot.position.clone(); layerRoot.position.set(0, 0, 0);
    ui.sew = 1; applySew();
    var target = new THREE.WebGLRenderTarget(sz, sz, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true });
    var oldClear = renderer.getClearColor(new THREE.Color()), oldAlpha = renderer.getClearAlpha(), oldPR = renderer.getPixelRatio();
    var passes = [];
    try {
      scene.overrideMaterial = bakeMat;
      [0, 1, 2, 3].forEach(function (mode) {
        bakeMat.uniforms.uMode.value = mode;
        renderer.setRenderTarget(target);
        renderer.setClearColor(mode === 1 ? 0x8080ff : 0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, bc);
        var buf = new Uint8Array(sz * sz * 4);
        renderer.readRenderTargetPixels(target, 0, 0, sz, sz, buf);
        passes.push(buf);
      });
    } finally {
      scene.overrideMaterial = null;
      renderer.setRenderTarget(null); renderer.setClearColor(oldClear, oldAlpha);
      target.dispose();
      hidden.forEach(function (c) { c.visible = true; }); layerRoot.position.copy(rootPos);
      ui.sew = keepSew; applySew(); requestDraw();
    }
    return finishBake(passes, sz, ss, res, mm, cx - half, cy + half, o);
  }
  function finishBake(P, sz, ss, res, mm, x0, y1, o) {
    var N = res * res, k2 = ss * ss, fabric = o.bg === 'fabric', pxmm = res / mm;
    var cov = new Float32Array(N), col = new Float32Array(N * 3), nrm = new Float32Array(N * 3), hgt = new Float32Array(N),
      rgh = new Float32Array(N), met = new Float32Array(N), ao = new Float32Array(N);
    // downsample (and flip: GL rows start at the bottom)
    for (var y = 0; y < res; y++) for (var x = 0; x < res; x++) {
      var o2 = y * res + x, c = 0, r = 0, g = 0, bl = 0, nx = 0, ny = 0, nz = 0, h = 0, ro = 0, me = 0, a = 0;
      for (var sy = 0; sy < ss; sy++) for (var sx = 0; sx < ss; sx++) {
        var gy = sz - 1 - (y * ss + sy), i = (gy * sz + x * ss + sx) * 4;
        if (!P[0][i + 3]) continue;
        c++; r += P[0][i]; g += P[0][i + 1]; bl += P[0][i + 2];
        nx += P[1][i] / 127.5 - 1; ny += P[1][i + 1] / 127.5 - 1; nz += P[1][i + 2] / 127.5 - 1;
        h += P[2][i]; ro += P[2][i + 1]; me += P[2][i + 2]; a += P[3][i];
      }
      cov[o2] = c / k2;
      if (c) { col[o2 * 3] = r / c; col[o2 * 3 + 1] = g / c; col[o2 * 3 + 2] = bl / c; nrm[o2 * 3] = nx / c; nrm[o2 * 3 + 1] = ny / c; nrm[o2 * 3 + 2] = nz / c;
        hgt[o2] = h / c / 255; rgh[o2] = ro / c / 255; met[o2] = me / c / 255; ao[o2] = a / c / 255; }
    }
    // contact shadow: blurred height minus height darkens what sits below neighbouring thread
    var hc = document.createElement('canvas'); hc.width = hc.height = res;
    var hx = hc.getContext('2d'), hid = hx.createImageData(res, res);
    for (var j = 0; j < N; j++) { var v = Math.round(hgt[j] * cov[j] * 255); hid.data[j * 4] = hid.data[j * 4 + 1] = hid.data[j * 4 + 2] = v; hid.data[j * 4 + 3] = 255; }
    hx.putImageData(hid, 0, 0);
    var bc2 = document.createElement('canvas'); bc2.width = bc2.height = res;
    var bx = bc2.getContext('2d'); bx.filter = 'blur(' + Math.max(1, 0.7 * pxmm).toFixed(1) + 'px)'; bx.drawImage(hc, 0, 0);
    var blur = bx.getImageData(0, 0, res, res).data;
    var fab = fabric ? lin(doc.fabric).map(function (v) { return Math.pow(v, 1 / 2.2) * 255; }) : null, fabSRGB = hexBytes(doc.fabric);
    var maps = {}, names = ['BaseColor', 'Normal', 'Roughness', 'Metallic', 'Height', 'AmbientOcclusion'].concat(fabric ? [] : ['Opacity']);
    names.forEach(function (n) { maps[n] = new Uint8ClampedArray(N * 4); });
    // edge padding: empty pixels take the values of the nearest stitched pixel (up to 16 px), so filtering and
    // mipmaps never pull a dark fringe in from behind the alpha
    var src = new Int32Array(N).fill(-1), dist = new Uint8Array(N), queue = new Int32Array(N), qh = 0, qt = 0;
    if (!fabric) {
      for (var z = 0; z < N; z++) if (cov[z] > 0) { src[z] = z; queue[qt++] = z; }
      while (qh < qt) {
        var cur = queue[qh++], cx2 = cur % res, d2 = dist[cur] + 1; if (d2 > 16) continue;
        [cx2 > 0 ? cur - 1 : -1, cx2 < res - 1 ? cur + 1 : -1, cur - res, cur + res].forEach(function (nb) {
          if (nb < 0 || nb >= N || src[nb] >= 0) return; src[nb] = src[cur]; dist[nb] = d2; queue[qt++] = nb;
        });
      }
    }
    // close pinholes between threads (an empty pixel mostly surrounded by stitching), so the decal has no
    // see-through specks inside the fill; outer edges are untouched
    if (!fabric) {
      var closed = Float32Array.from(cov);
      for (var pass = 0; pass < 2; pass++) {
        var base = Float32Array.from(closed);
        for (var yy = 1; yy < res - 1; yy++) for (var xx = 1; xx < res - 1; xx++) {
          var qq = yy * res + xx; if (base[qq] >= 0.999) continue;
          var n8 = 0;
          for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if ((ox || oy) && base[qq + oy * res + ox] > 0.5) n8++;
          if (n8 >= 6) closed[qq] = 1;
        }
      }
      for (var cq = 0; cq < N; cq++) if (closed[cq] > cov[cq] && src[cq] >= 0) { cov[cq] = closed[cq]; }
    }
    for (var q = 0; q < N; q++) {
      if (!fabric) { writeTransparent(q); continue; }
      var px = q % res, py = Math.floor(q / res), wx = x0 + (px + 0.5) / pxmm, wy = y1 - (py + 0.5) / pxmm, cv = cov[q];
      var contact = 1 - Math.min(0.55, Math.max(0, blur[q * 4] / 255 - hgt[q] * cv) * 2.2);
      // fabric (twill) or empty background
      var t = (wx + wy) / 0.75, tw = 0.5 + 0.5 * Math.sin(6.2832 * t), dtw = Math.cos(6.2832 * t);
      var bgC = fabric ? [fab[0] * (0.93 + 0.07 * tw), fab[1] * (0.93 + 0.07 * tw), fab[2] * (0.93 + 0.07 * tw)] : fabSRGB;
      var bgN = fabric ? [-0.18 * dtw, -0.18 * dtw * (o.normal === 'dx' ? -1 : 1), 1] : [0, 0, 1];
      var bgR = fabric ? 0.86 : 0.9, bgH = fabric ? 0.02 * tw : 0, bgA = fabric ? contact : 1;
      var mix = function (a, bb) { return a * cv + bb * (1 - cv); };
      var BC = maps.BaseColor, NM = maps.Normal, i4 = q * 4;
      if (fabric || cv > 0) {
        BC[i4] = cv ? mix(col[q * 3], bgC[0]) : bgC[0]; BC[i4 + 1] = cv ? mix(col[q * 3 + 1], bgC[1]) : bgC[1]; BC[i4 + 2] = cv ? mix(col[q * 3 + 2], bgC[2]) : bgC[2];
      } else { BC[i4] = bgC[0]; BC[i4 + 1] = bgC[1]; BC[i4 + 2] = bgC[2]; }
      var nx = mix(nrm[q * 3], bgN[0]), ny = mix(nrm[q * 3 + 1], bgN[1]), nz = mix(nrm[q * 3 + 2], bgN[2]), nl = Math.hypot(nx, ny, nz) || 1;
      NM[i4] = (nx / nl * 0.5 + 0.5) * 255; NM[i4 + 1] = (ny / nl * 0.5 + 0.5) * 255; NM[i4 + 2] = (nz / nl * 0.5 + 0.5) * 255;
      var grey = function (m, v) { m[i4] = m[i4 + 1] = m[i4 + 2] = v * 255; m[i4 + 3] = 255; };
      grey(maps.Roughness, mix(rgh[q], bgR)); grey(maps.Metallic, met[q] * cv);
      grey(maps.Height, fabric ? mix(hgt[q] * 0.95 + 0.05, bgH) : hgt[q] * cv);
      grey(maps.AmbientOcclusion, mix(ao[q] * (0.75 + 0.25 * contact), bgA));
      if (!fabric) grey(maps.Opacity, cv);
      BC[i4 + 3] = 255; NM[i4 + 3] = 255;
    }
    function writeTransparent(q) {
      var i4 = q * 4, a = Math.round(cov[q] * 255), sq = src[q], has = sq >= 0;
      var contact = 1 - Math.min(0.55, Math.max(0, blur[q * 4] / 255 - hgt[q] * cov[q]) * 2.2);
      var BC = maps.BaseColor, NM = maps.Normal;
      BC[i4] = has ? col[sq * 3] : 128; BC[i4 + 1] = has ? col[sq * 3 + 1] : 128; BC[i4 + 2] = has ? col[sq * 3 + 2] : 128;
      var nx = has ? nrm[sq * 3] : 0, ny = has ? nrm[sq * 3 + 1] : 0, nz = has ? nrm[sq * 3 + 2] : 1, nl = Math.hypot(nx, ny, nz) || 1;
      NM[i4] = (nx / nl * 0.5 + 0.5) * 255; NM[i4 + 1] = (ny / nl * 0.5 + 0.5) * 255; NM[i4 + 2] = (nz / nl * 0.5 + 0.5) * 255;
      var grey = function (m, v) { m[i4] = m[i4 + 1] = m[i4 + 2] = v * 255; m[i4 + 3] = a; };
      grey(maps.Roughness, has ? rgh[sq] : 0.5); grey(maps.Metallic, has ? met[sq] : 0);
      grey(maps.Height, has ? hgt[sq] : 0); grey(maps.AmbientOcclusion, has ? ao[sq] * (0.75 + 0.25 * contact) : 1);
      grey(maps.Opacity, cov[q]); maps.Opacity[i4 + 3] = 255;
      BC[i4 + 3] = a; NM[i4 + 3] = a;
    }
    return { maps: maps, names: names, res: res, mm: mm, pxmm: pxmm, alpha: !fabric };
  }
  function hexBytes(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  // PNG writer: canvas.toBlob premultiplies alpha and throws away the colour behind transparent pixels,
  // so maps with alpha are encoded directly (zlib via CompressionStream, 'Sub' row filter).
  function encodePNG(rgba, w, h, kind) {
    var ch = { rgba: 4, rgb: 3, ga: 2, g: 1 }[kind], ct = { rgba: 6, rgb: 2, ga: 4, g: 0 }[kind], pick = { rgba: [0, 1, 2, 3], rgb: [0, 1, 2], ga: [0, 3], g: [0] }[kind];
    var stride = w * ch + 1, raw = new Uint8Array(stride * h);
    for (var y = 0; y < h; y++) {
      var o = y * stride, si = y * w * 4; raw[o] = 1;
      for (var x = 0; x < w; x++) for (var c = 0; c < ch; c++) {
        var v = rgba[si + x * 4 + pick[c]], left = x ? rgba[si + (x - 1) * 4 + pick[c]] : 0;
        raw[o + 1 + x * ch + c] = (v - left) & 255;
      }
    }
    var cs = new CompressionStream('deflate');
    return new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer().then(function (z) {
      z = new Uint8Array(z);
      var parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
      function chunk(type, data) {
        var c = new Uint8Array(12 + data.length), dv = new DataView(c.buffer);
        dv.setUint32(0, data.length);
        for (var i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
        c.set(data, 8);
        dv.setUint32(8 + data.length, X.crc32(c.subarray(4, 8 + data.length)));
        parts.push(c);
      }
      var ih = new Uint8Array(13), dv = new DataView(ih.buffer);
      dv.setUint32(0, w); dv.setUint32(4, h); ih[8] = 8; ih[9] = ct; ih[10] = 0; ih[11] = 0; ih[12] = 0;
      chunk('IHDR', ih); chunk('IDAT', z); chunk('IEND', new Uint8Array(0));
      var n = parts.reduce(function (a, p) { return a + p.length; }, 0), out = new Uint8Array(n), off = 0;
      parts.forEach(function (p) { out.set(p, off); off += p.length; });
      return out;
    });
  }
  function mapPng(arr, res, kind) {
    var c = document.createElement('canvas'); c.width = c.height = res;
    var x = c.getContext('2d'), id = x.createImageData(res, res); id.data.set(arr); x.putImageData(id, 0, 0);
    var t = document.createElement('canvas'); t.width = t.height = 96; t.getContext('2d').drawImage(c, 0, 0, 96, 96);
    var thumb = t.toDataURL('image/png');
    if (typeof CompressionStream !== 'undefined') return encodePNG(arr, res, res, kind).then(function (data) { return { data: data, thumb: thumb }; });
    return new Promise(function (ok) { c.toBlob(function (b) { b.arrayBuffer().then(function (buf) { ok({ data: new Uint8Array(buf), thumb: thumb }); }); }, 'image/png'); });
  }
  function bakeReadme(bk, name) {
    return [name + ' - PBR texture set', '', 'Size        ' + bk.mm.toFixed(1) + ' x ' + bk.mm.toFixed(1) + ' mm (' + bk.res + ' px, ' + bk.pxmm.toFixed(2) + ' px/mm)',
      'Normals     ' + (ui.bake.normal === 'dx' ? 'DirectX (green down)' : 'OpenGL (green up, the Substance Painter default)'),
      'Background  ' + (ui.bake.bg === 'fabric' ? 'twill fabric in ' + doc.fabric : 'none - every map is transparent outside the stitching (alpha = thread coverage)'), '',
      'SUBSTANCE PAINTER',
      '  1. File > Import resources, add all the PNGs as "texture", import into the project.',
      '  2. Add a Fill layer. Drag each map into its channel: Base Color, Normal, Roughness, Metallic, Height, AO.',
      '     (With Base Color/Height/Rough/Metal/Normal enabled on the layer; enable Height in the texture set if needed.)',
      '  3. Set the fill projection to Planar (or UV) and scale it so the patch is ' + bk.mm.toFixed(0) + ' mm across on your model.',
      ui.bake.bg === 'fabric' ? '  4. The fabric is baked in; use the whole square as a patch.' : '  4. Right-click the layer > Add black mask, then add a Fill to the mask with the Opacity map so only the stitching shows.\r\n     (Engines and tools that read Base Color alpha as opacity can use the BaseColor PNG alone.)',
      '', 'Height is relative (0 = fabric). In Substance, start with a height force around 0.3-0.6.',
      'Generated by Stitch Studio.'].join('\r\n') + '\r\n';
  }
  function bakeAndSave() {
    if (baking || !doc.layers.length) return;
    if (anyBusy()) { toast('Wait for stitching to finish, then bake.'); return; }
    baking = true; renderPanel(); toast('Baking ' + ui.bake.res + ' px texture maps…');
    setTimeout(function () {
      var bk, name = exportName();
      try { bk = bakePBR(ui.bake); }
      catch (err) { baking = false; renderPanel(); toast('Bake failed: ' + (err && err.message || err)); return; }
      var files = [], previews = [];
      bk.names.reduce(function (pr, n) {
        var kind = n === 'BaseColor' || n === 'Normal' ? (bk.alpha ? 'rgba' : 'rgb') : n === 'Opacity' ? 'g' : (bk.alpha ? 'ga' : 'g');
        return pr.then(function () { return mapPng(bk.maps[n], bk.res, kind).then(function (r) {
          var fn = name + '_' + (n === 'Normal' ? (ui.bake.normal === 'dx' ? 'Normal_DirectX' : 'Normal_OpenGL') : n) + '.png';
          files.push({ name: name + '_PBR/' + fn, data: r.data }); previews.push({ label: n === 'AmbientOcclusion' ? 'AO' : n === 'BaseColor' ? 'Base colour' : n, url: r.thumb });
        }); });
      }, Promise.resolve()).then(function () {
        files.push({ name: name + '_PBR/README.txt', data: new TextEncoder().encode(bakeReadme(bk, name)) });
        lastBake = { previews: previews, res: bk.res, mm: bk.mm, files: files };
        baking = false; renderPanel();
        return saveBytes(name + '_PBR_' + bk.res + '.zip', X.zip(files), 'application/zip');
      }).then(function (r) { report(r, 'Saved ' + name + '_PBR_' + bk.res + '.zip'); }).catch(function (err) { baking = false; renderPanel(); toast('Bake failed: ' + (err && err.message || err)); });
    }, 30);
  }

  // ---------- remember the design between visits (this browser only) ----------
  var persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      try {
        var srcs = {}, size = 0;
        doc.layers.forEach(function (L) {
          if (L.type !== 'image') return;
          var s = SOURCES.get(L.p.src);
          if (s && s.kind === 'svg' && !srcs[L.p.src] && size + s.svg.length < 1500000) { srcs[L.p.src] = { svg: s.svg, name: s.name }; size += s.svg.length; }
        });
        localStorage.setItem('stitch.doc.v1', JSON.stringify({ doc: JSON.parse(snapshot()), sources: srcs }));
      } catch (e) {}
    }, 400);
  }
  function loadSaved() {
    try {
      var raw = localStorage.getItem('stitch.doc.v1'); if (!raw) return false;
      var o = JSON.parse(raw), d = o.doc;
      if (!d || !Array.isArray(d.layers)) return false;
      Object.keys(o.sources || {}).forEach(function (id) { var s = o.sources[id]; SOURCES.set(id, { kind: 'svg', svg: s.svg, name: s.name, thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg) }); });
      d.layers.forEach(normaliseLayer);
      if (!d.stitch || d.stitch.v !== 2) d.stitch = Object.assign({}, doc.stitch, { fillMode: (d.stitch && d.stitch.fillMode) || 'patch' });
      d.threads = Object.assign({}, doc.threads, d.threads || {});
      if (!LINES[d.threads.line]) d.threads.line = 'janome';
      d.layers = d.layers.filter(function (L) {
        if (L.type === 'text') return !!FONT[L.p.font];
        if (L.type === 'emoji') return !!EMOJI[L.p.code];
        return SOURCES.has(L.p.src);
      });
      if (!d.layers.length) return false;
      if (!MACHINES[d.machine]) d.machine = 'deco330';
      if (!MACHINES[d.machine].hoops[d.hoop]) d.hoop = MACHINES[d.machine].defaultHoop;
      Object.keys(d).forEach(function (k) { doc[k] = d[k]; });
      if (!layerById(doc.sel)) doc.sel = doc.layers[doc.layers.length - 1].id;
      return true;
    } catch (e) { return false; }
  }

  // ===================== start =====================
  function boot() {
    var restored = loadSaved();
    if (doc.machine !== 'deco330') machineChanged();
    if (!restored) {
      var L = makeTextLayer('Bowie', 'Yellowtail');
      L.p.width = 110;
      doc.layers.push(L); doc.sel = L.id;
    }
    hist.cur = snapshot(); updateUndo();
    applyTheme(); applyLook(); shared.uWidth.value = recommend().width;
    resize();
    setStage('design');
    renderAllLayers();
    goTo('3d', true);
    requestAnimationFrame(tick);
    if (restored) toast('Restored your last design');
  }
  boot();
  // test hooks (read-only peeks for the automated UI tests)
  window.__studio = { doc: doc, ui: ui, rt: rt, seq: function () { return lastSeq; }, stale: function () { return seqStale || anyBusy() > 0; }, fit: function () { return fitState; },
    cam: cam, draw: requestDraw, bake: function (o) { var b = bakePBR(o || ui.bake); return { res: b.res, mm: b.mm, names: b.names }; }, lastBake: function () { return lastBake; },
    eff: function () { return effStitch(selLayer()); }, spec: function () { return specOf(selLayer()); }, worksheet: function () { return lastSeq ? worksheetText(lastSeq, []) : ''; },
    screen: function (x, y) { placeCamera(); var v = new THREE.Vector3(x, y, 0).project(camera), r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    corners: function () { var L = selLayer(); return L ? layerCorners(L) : null; }, makeFiles: function () { return lastSeq ? makeFiles(lastSeq) : null; } };
