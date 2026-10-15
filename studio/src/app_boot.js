  // ===================== start =====================
  function boot() {
    applyPalette();
    restoreWorkingCopy().then(function (restored) {
      if (doc.machine !== 'deco330') machineChanged();
      if (!restored) {
        var L = makeTextLayer('Welcome', 'Yellowtail');
        L.p.width = 110;
        doc.layers.push(L); doc.sel = L.id;
        project.name = 'Welcome';
      }
      hist.cur = snapshot(); updateUndo();
      project.savedKey = restored && restored.savedKey ? restored.savedKey : docKey();
      project.autoKey = restored ? docKey() : null;
      updateProjectUi();
      applyTheme(); applyLook(); shared.uWidth.value = recommend().width;
      resize();
      setStage('design');
      renderAllLayers();
      goTo('3d', true);
      requestAnimationFrame(tick);
      if (restored) toast('Restored “' + project.name + '”' + (project.autosavedAt ? ' from ' + when(project.autosavedAt) : ''));
      exposeTestHooks();
    });
  }
  boot();
  // test hooks (read-only peeks for the automated UI tests)
  function exposeTestHooks() { window.__studio = { doc: doc, ui: ui, rt: rt, seq: function () { return lastSeq; }, stale: function () { return seqStale || anyBusy() > 0; }, fit: function () { return fitState; },
    cam: cam, draw: requestDraw, bake: function (o) { var b = bakePBR(o || ui.bake); return { res: b.res, mm: b.mm, names: b.names }; }, lastBake: function () { return lastBake; },
    eff: function () { return effStitch(selLayer()); }, spec: function () { return specOf(selLayer()); }, worksheet: function () { return lastSeq ? worksheetText(lastSeq, []) : ''; },
    screen: function (x, y) { placeCamera(); var v = new THREE.Vector3(x, y, 0).project(camera), r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    corners: function () { var L = selLayer(); return L ? layerCorners(L) : null; }, makeFiles: function () { return lastSeq ? makeFiles(lastSeq) : null; },
    project: function () { return { name: project.name, dirty: isDirty(), file: project.file, autosavedAt: project.autosavedAt, versions: project.versions, prefs: APREFS }; },
    encodeProject: encodeProject, decodeProject: decodeProject }; }
