  // ===================== projects: new, open, save, autosave, version history =====================
  // A project file (.fembroider) is gzip-compressed JSON: the design (the same state undo keeps), the project's name
  // and every imported picture or SVG it uses, so it opens on any computer. Autosave keeps the working copy, and a
  // version history, in this browser's (or the desktop app's) own storage, so closing the window loses nothing.
  var PROJECT_EXT = 'fembroider', PROJECT_FORMAT = 1, VERSION_EVERY = 5 * 60e3, VERSION_KEEP = 20;
  var project = { name: 'Untitled project', file: null, savedKey: null, savedAt: 0, autoKey: null, autosavedAt: 0, versionAt: 0, versions: 0, quietAt: 0 };
  var APREFS = (function () {
    var d = { mode: 'change', versions: true, toFile: false };
    try {
      var o = JSON.parse(localStorage.getItem('stitch.autosave') || '{}');
      if (['off', 'change', '1', '5'].indexOf(o.mode) >= 0) d.mode = o.mode;
      if (typeof o.versions === 'boolean') d.versions = o.versions;
      if (typeof o.toFile === 'boolean') d.toFile = o.toFile;
    } catch (e) {}
    return d;
  })();
  function savePrefs() { try { localStorage.setItem('stitch.autosave', JSON.stringify(APREFS)); } catch (e) {} }
  var AUTOSAVE_LABEL = { off: 'Off', change: 'After each change', '1': 'Every minute', '5': 'Every 5 minutes' };

  // what counts as a change worth saving (selecting a layer doesn't)
  function docKey() { var o = JSON.parse(snapshot()); delete o.sel; return JSON.stringify(o) + '|' + project.name; }
  function isDirty() { return project.savedKey !== null && docKey() !== project.savedKey; }
  function markSaved() { project.savedKey = docKey(); project.savedAt = Date.now(); updateProjectUi(); }
  function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function when(t) {
    if (!t) return '';
    var d = new Date(t), now = new Date();
    return d.toDateString() === now.toDateString() ? hhmm(t) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + hhmm(t);
  }

  // ---------- bytes ----------
  function b64(buf) {
    var u = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(str) { var bin = atob(str), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function gzip(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(u8);
    return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function gunzipMaybe(u8) {
    if (!(u8[0] === 0x1f && u8[1] === 0x8b)) return Promise.resolve(u8);
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser cannot unpack compressed projects.'));
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  // a picture's original bytes (older autosaves kept only the decoded picture: re-encode it as PNG once)
  function sourceBlob(s) {
    if (s.blob) return Promise.resolve(s.blob);
    if (s.kind === 'stitches') return Promise.resolve(s.blob = new Blob([s.bytes], { type: 'application/octet-stream' }));
    if (s.kind === 'svg') return Promise.resolve(new Blob([s.svg], { type: 'image/svg+xml' }));
    var c = document.createElement('canvas'); c.width = s.bitmap.width; c.height = s.bitmap.height;
    c.getContext('2d').drawImage(s.bitmap, 0, 0);
    return new Promise(function (res) { c.toBlob(function (b) { s.blob = b; s.mime = 'image/png'; res(b); }, 'image/png'); });
  }
  function usedSources(d) {
    var ids = [];
    d.layers.forEach(function (L) { if ((L.type === 'image' || L.type === 'stitches') && ids.indexOf(L.p.src) < 0 && SOURCES.has(L.p.src)) ids.push(L.p.src); });
    return ids;
  }
  // a stored source back into a live one
  function liveSource(o) {
    if (!o || typeof o !== 'object') return Promise.reject(new Error('missing picture'));
    if (o.kind === 'stitches') {
      var bin = o.blob instanceof Blob ? o.blob.arrayBuffer().then(function (b) { return new Uint8Array(b); }) : typeof o.b64 === 'string' ? Promise.resolve(unb64(o.b64)) : null;
      if (!bin) return Promise.reject(new Error('missing stitch file'));
      return bin.then(function (u8) { return stitchSource(new Uint8Array(u8), String(o.name || 'design.dst')); });
    }
    if (o.kind === 'svg' && typeof o.svg === 'string' && /<svg[\s>]/i.test(o.svg))
      return Promise.resolve({ kind: 'svg', svg: o.svg, name: String(o.name || 'artwork.svg'), thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.svg) });
    var mime = /^image\/[\w.+-]+$/.test(o.mime || '') ? o.mime : 'image/png';
    var blob = o.blob instanceof Blob ? o.blob : typeof o.b64 === 'string' ? new Blob([unb64(o.b64)], { type: mime }) : null;
    if (!blob) return Promise.reject(new Error('missing picture'));
    return pictureBitmap(blob).then(function (bm) { return { kind: 'bitmap', bitmap: bm, blob: blob, mime: mime, name: String(o.name || 'picture'), thumb: URL.createObjectURL(blob) }; });
  }
  function adoptSources(map) {
    var ids = Object.keys(map || {}).filter(function (id) { return /^[\w-]{1,80}$/.test(id); });
    return Promise.all(ids.map(function (id) {
      return liveSource(map[id]).then(function (s) { SOURCES.set(id, s); }, function () { /* that layer is dropped below */ });
    }));
  }

  // ---------- project files ----------
  function encodeProject() {
    var d = JSON.parse(snapshot()), ids = usedSources(d);
    return Promise.all(ids.map(function (id) {
      var s = SOURCES.get(id);
      if (s.kind === 'svg') return { kind: 'svg', name: s.name, svg: s.svg };
      if (s.kind === 'stitches') return { kind: 'stitches', name: s.name, b64: b64(s.bytes) };
      return sourceBlob(s).then(function (b) { return b.arrayBuffer(); }).then(function (buf) { return { kind: 'bitmap', name: s.name, mime: s.mime || 'image/png', b64: b64(buf) }; });
    })).then(function (list) {
      var o = { app: 'Fembroider', format: PROJECT_FORMAT, name: project.name, saved: new Date().toISOString(), doc: d, sources: {} };
      ids.forEach(function (id, i) { o.sources[id] = list[i]; });
      return gzip(new TextEncoder().encode(JSON.stringify(o)));
    });
  }
  function decodeProject(u8) {
    return gunzipMaybe(u8).then(function (raw) {
      var o = JSON.parse(new TextDecoder().decode(raw));
      if (!o || typeof o !== 'object') throw new Error('not a project');
      if (!o.doc && Array.isArray(o.layers)) o = { doc: o, sources: {} };          // a bare design
      if (!o.doc || !Array.isArray(o.doc.layers)) throw new Error('not a project');
      if (o.format > PROJECT_FORMAT) throw new Error('made by a newer Fembroider');
      return o;
    });
  }
  // check everything that came from a file or storage before it reaches the document (it ends up in markup)
  function cleanDoc(d) {
    if (!d || !Array.isArray(d.layers)) return null;
    d.layers = d.layers.filter(function (L) {
      if (!L || typeof L !== 'object' || !L.p || !L.tf || typeof L.id !== 'string' || !/^[\w-]{1,80}$/.test(L.id)) return false;
      L.name = String(L.name || 'Layer').slice(0, 120);
      if (!L.fx) L.fx = defaultFx();
      try { normaliseLayer(L); } catch (e) { return false; }
      if (L.type === 'text') return !!FONT[L.p.font];
      if (L.type === 'emoji') return !!EMOJI[L.p.code];
      return (L.type === 'image' || L.type === 'stitches') && SOURCES.has(L.p.src);
    });
    d.fabric = safeHex(d.fabric, doc.fabric);
    if (typeof d.theme !== 'string' || (d.theme && !THEME[d.theme])) d.theme = '';
    if (typeof d.cardName !== 'string' || !/^[A-Z0-9_]{0,8}$/i.test(d.cardName)) d.cardName = '';
    if (!d.stitch || d.stitch.v !== 2) d.stitch = Object.assign({}, doc.stitch, { fillMode: (d.stitch && d.stitch.fillMode) || 'patch' });
    d.threads = Object.assign({}, doc.threads, d.threads || {});
    if (!LINES[d.threads.line]) d.threads.line = 'janome';
    if (typeof d.machine !== 'string' || !Object.prototype.hasOwnProperty.call(MACHINES, d.machine)) d.machine = 'deco330';
    if (typeof d.hoop !== 'string' || !Object.prototype.hasOwnProperty.call(MACHINES[d.machine].hoops, d.hoop)) d.hoop = MACHINES[d.machine].defaultHoop;
    var fm = {}; Object.keys(doc.formats).forEach(function (k) { fm[k] = d.formats && typeof d.formats[k] === 'boolean' ? d.formats[k] : doc.formats[k]; }); d.formats = fm;
    var keep = {}; ['machine', 'hoop', 'theme', 'fabric', 'layers', 'sel', 'stitch', 'threads', 'cardName', 'formats'].forEach(function (k) { keep[k] = d[k]; });
    if (typeof keep.sel !== 'string' || !keep.layers.some(function (L) { return L.id === keep.sel; })) keep.sel = keep.layers.length ? keep.layers[keep.layers.length - 1].id : null;
    return keep;
  }
  function cleanName(n) { n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80); return n || 'Untitled project'; }
  // swap the whole document (open, new, restore): the old layers leave the scene, undo starts afresh
  function replaceDocument(d, name, file) {
    var was = doc.machine;
    RT.forEach(function (r) { if (r.group) layerRoot.remove(r.group); });
    RT.clear();
    Object.keys(d).forEach(function (k) { doc[k] = d[k]; });
    project.name = cleanName(name); project.file = file || null;
    machineChanged();
    hist.past = []; hist.future = []; hist.cur = snapshot(); updateUndo();
    ui.sew = 1; ui.playing = false;
    syncScene(); renderAll(); applySew();
    if (doc.machine !== was || !doc.layers.length) goTo(ui.view === 'custom' ? '3d' : ui.view, true);
    project.savedKey = docKey(); project.autoKey = null;
    updateProjectUi();
  }
  function loadProjectObject(o, fileInfo) {
    return adoptSources(o.sources).then(function () {
      var d = cleanDoc(o.doc);
      if (!d) throw new Error('not a project');
      var dropped = o.doc.layers.length - d.layers.length;
      replaceDocument(d, o.name || (fileInfo && fileInfo.name), fileInfo && fileInfo.file);
      project.savedAt = Date.now();
      autosave(true);
      toast('Opened “' + project.name + '”' + (dropped > 0 ? ' · ' + dropped + ' layer' + (dropped === 1 ? '' : 's') + ' could not be read' : ''));
    });
  }

  // ---------- storage: IndexedDB (the working copy, pictures, versions) ----------
  var IDB = (function () {
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('No storage in this browser')); return; }
        var rq;
        try { rq = indexedDB.open('fembroider', 1); } catch (e) { rej(e); return; }
        rq.onupgradeneeded = function () {
          var db = rq.result;
          db.createObjectStore('kv'); db.createObjectStore('sources');
          db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
        rq.onblocked = function () { rej(new Error('Storage is busy in another window')); };
      });
      dbp.catch(function () { dbp = null; });
      return dbp;
    }
    function run(stores, mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(stores, mode), out = {};
          fn(t, out);
          t.oncomplete = function () { res(out.v); };
          t.onerror = t.onabort = function () { rej(t.error || new Error('Storage failed')); };
        });
      });
    }
    function req(r, out) { r.onsuccess = function () { out.v = r.result; }; }
    return {
      get: function (store, key) { return run([store], 'readonly', function (t, out) { req(t.objectStore(store).get(key), out); }); },
      put: function (store, val, key) { return run([store], 'readwrite', function (t, out) { req(key === undefined ? t.objectStore(store).put(val) : t.objectStore(store).put(val, key), out); }); },
      del: function (store, key) { return run([store], 'readwrite', function (t) { t.objectStore(store).delete(key); }); },
      all: function (store) { return run([store], 'readonly', function (t, out) { req(t.objectStore(store).getAll(), out); }); },
      keys: function (store) { return run([store], 'readonly', function (t, out) { req(t.objectStore(store).getAllKeys(), out); }); }
    };
  })();
  var storedSources = {};          // source ids already in storage (pictures never change once imported)
  function storeSources(d) {
    return usedSources(d).filter(function (id) { return !storedSources[id]; }).reduce(function (p, id) {
      return p.then(function () {
        var s = SOURCES.get(id);
        var rec = s.kind === 'svg' ? Promise.resolve({ kind: 'svg', name: s.name, svg: s.svg }) : s.kind === 'stitches' ? sourceBlob(s).then(function (b) { return { kind: 'stitches', name: s.name, blob: b }; }) : sourceBlob(s).then(function (b) { return { kind: 'bitmap', name: s.name, mime: s.mime || 'image/png', blob: b }; });
        return rec.then(function (r) { return IDB.put('sources', r, id); }).then(function () { storedSources[id] = 1; });
      });
    }, Promise.resolve());
  }
  function fetchSources(d) {
    var need = d.layers.filter(function (L) { return (L.type === 'image' || L.type === 'stitches') && !SOURCES.has(L.p.src); }).map(function (L) { return L.p.src; });
    return Promise.all(need.map(function (id) {
      return IDB.get('sources', id).then(function (o) { return o ? liveSource(o).then(function (s) { SOURCES.set(id, s); storedSources[id] = 1; }) : null; }).catch(function () {});
    }));
  }
  function writeCurrent() {
    var d = JSON.parse(snapshot());
    return storeSources(d).then(function () {
      return IDB.put('kv', { name: project.name, doc: d, time: Date.now(), file: project.file, savedKey: project.savedKey }, 'current');
    });
  }
  function writeVersion(reason) {
    var d = JSON.parse(snapshot());
    if (!d.layers.length) return Promise.resolve();
    return storeSources(d).then(function () {
      return IDB.put('versions', { time: Date.now(), name: project.name, reason: reason || 'Autosave', doc: d, layers: d.layers.length });
    }).then(function () {
      project.versionAt = Date.now();
      return IDB.all('versions');
    }).then(function (list) {
      list.sort(function (a, b) { return b.time - a.time; });
      var drop = list.slice(VERSION_KEEP);
      project.versions = Math.min(list.length, VERSION_KEEP);
      return Promise.all(drop.map(function (v) { return IDB.del('versions', v.id); })).then(function () { if (drop.length) return pruneSources(); });
    });
  }
  // pictures no longer used by the working copy or any version
  function pruneSources() {
    return Promise.all([IDB.get('kv', 'current'), IDB.all('versions'), IDB.keys('sources')]).then(function (r) {
      var used = {};
      [r[0]].concat(r[1] || []).forEach(function (v) { if (v && v.doc) v.doc.layers.forEach(function (L) { if (L.type === 'image') used[L.p.src] = 1; }); });
      usedSources(doc).forEach(function (id) { used[id] = 1; });
      return Promise.all((r[2] || []).filter(function (k) { return !used[k]; }).map(function (k) { delete storedSources[k]; return IDB.del('sources', k); }));
    });
  }

  // ---------- autosave ----------
  var autoTimer = null, autoInterval = null, autoBusy = null;
  function persist() {                       // called after every change (commit, undo, redo)
    updateProjectUi();
    if (APREFS.mode === 'change') { clearTimeout(autoTimer); autoTimer = setTimeout(function () { autosave(); }, 900); }
  }
  function scheduleAutosave() {
    clearInterval(autoInterval); autoInterval = null;
    if (APREFS.mode === '1' || APREFS.mode === '5') autoInterval = setInterval(function () { autosave(); }, (+APREFS.mode) * 60e3);
  }
  // force: write even when autosave is off (after open / new, so a reload shows what's on screen)
  function autosave(force) {
    if (APREFS.mode === 'off' && !force) return Promise.resolve();
    if (autoBusy) return autoBusy.then(function () { return autosave(force); });
    var key = docKey();
    if (key === project.autoKey && !force) return Promise.resolve();
    autoBusy = writeCurrent().then(function () {
      project.autoKey = key; project.autosavedAt = Date.now();
      try { localStorage.removeItem('stitch.doc.v1'); } catch (e) {}   // the old single-slot save, now superseded
      if (APREFS.versions && APREFS.mode !== 'off' && Date.now() - project.versionAt >= VERSION_EVERY) return writeVersion('Autosave');
    }).then(function () {
      // desktop: keep the project file itself up to date too, at most every 20 s
      if (APREFS.toFile && desktop && desktop.saveProject && project.file && isDirty() && Date.now() - project.quietAt > 20e3) {
        project.quietAt = Date.now();
        return saveProject(false, true);
      }
    }).catch(function (err) { console.warn('Autosave failed', err); project.autoError = String(err && err.message || err); })
      .then(function () { autoBusy = null; updateProjectUi(); });
    return autoBusy;
  }
  // restore the working copy at start-up (or the old single-slot save from before projects existed)
  function restoreWorkingCopy() {
    if (APREFS.mode === 'off') return Promise.resolve(false);
    return IDB.get('kv', 'current').then(function (cur) {
      if (!cur || !cur.doc) return false;
      return fetchSources(cur.doc).then(function () {
        var d = cleanDoc(cur.doc);
        if (!d || !d.layers.length) return false;
        Object.keys(d).forEach(function (k) { doc[k] = d[k]; });
        project.name = cleanName(cur.name); project.file = typeof cur.file === 'string' ? cur.file : null;
        project.autosavedAt = cur.time || 0;
        return { savedKey: typeof cur.savedKey === 'string' ? cur.savedKey : null };
      });
    }).catch(function () { return false; }).then(function (r) {
      if (r) return r;
      return loadSaved() ? { savedKey: null } : false;
    }).then(function (r) {
      return IDB.all('versions').then(function (v) { project.versions = (v || []).length; if (v && v.length) project.versionAt = Math.max.apply(null, v.map(function (x) { return x.time; })); }, function () {}).then(function () { return r; });
    });
  }
  // the pre-0.15 save: one design in localStorage, SVG pictures only
  function loadSaved() {
    try {
      var raw = localStorage.getItem('stitch.doc.v1'); if (!raw) return false;
      var o = JSON.parse(raw);
      Object.keys(o.sources || {}).forEach(function (id) { var s = o.sources[id]; if (s && typeof s.svg === 'string') SOURCES.set(id, { kind: 'svg', svg: s.svg, name: String(s.name || 'artwork.svg'), thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg) }); });
      var d = cleanDoc(o.doc);
      if (!d || !d.layers.length) return false;
      Object.keys(d).forEach(function (k) { doc[k] = d[k]; });
      return true;
    } catch (e) { return false; }
  }

  // ---------- commands ----------
  function fileBase() { return project.name.replace(/[^\w .()\-]/g, '').trim().slice(0, 60) || 'Untitled project'; }
  function saveProject(saveAs, quiet) {
    return encodeProject().then(function (bytes) {
      if (desktop && desktop.saveProject) {
        return desktop.saveProject(project.name, bytes, saveAs).then(function (r) {
          if (!r || r.canceled) { if (!quiet) toast('Save cancelled'); return; }
          if (r.error) { toast(r.error); return; }
          // a project saved under a new file name takes that name
          if (r.name && (saveAs || !project.file)) project.name = cleanName(r.name);
          project.file = r.file || project.file;
          markSaved(); autosave(true);
          if (!quiet) toast('Saved ' + (r.file || project.name));
        });
      }
      return saveBytes(fileBase() + '.' + PROJECT_EXT, new Blob([bytes], { type: 'application/octet-stream' }), 'application/octet-stream').then(function (r) {
        if (!r || r.canceled) { toast('Save cancelled'); return; }
        if (r.error) { toast(r.error); return; }
        markSaved(); autosave(true);
        toast('Downloaded ' + fileBase() + '.' + PROJECT_EXT + ' · open it again with Project › Open');
      });
    }).catch(function (err) { toast('Could not save the project: ' + (err && err.message || err)); });
  }
  // before the design on screen is replaced: keep it as a version, or ask if nothing else would keep it
  function beforeReplace(reason) {
    if (!doc.layers.length) return Promise.resolve(true);
    if (APREFS.versions) return writeVersion(reason).then(function () { return true; }, function () { return confirmBox('Replace the design on screen?', 'It has unsaved changes and could not be kept in Version history.', 'Replace'); });
    if (!isDirty()) return Promise.resolve(true);
    return confirmBox('Replace the design on screen?', 'It has changes that are not saved to a file. Turn on Version history in the Project menu to keep a copy automatically.', 'Replace without saving');
  }
  function newProject() {
    return beforeReplace('Before new project').then(function (ok) {
      if (!ok) return;
      var d = cleanDoc({ machine: doc.machine, hoop: doc.hoop, theme: 'Home', fabric: THEME.Home.fabric, layers: [], sel: null, stitch: null, threads: doc.threads, cardName: '', formats: doc.formats });
      d.stitch = { v: 2, fillMode: 'patch', satin: false, spacing: null, strokeSpacing: null, tatamiSpacing: null, tatamiStitch: null, pullComp: null, minStitch: null, satinMax: null, split: null, underlay: 'auto', tatamiAngle: null };
      if (desktop && desktop.newProject) desktop.newProject();
      replaceDocument(d, 'Untitled project', null);
      autosave(true);
      setStage('design');
      toast('New project' + (APREFS.versions ? ' · the previous design is in Version history' : ''));
    });
  }
  function openProject(recent) {
    closePop();
    if (desktop && desktop.openProject) {
      return beforeReplace('Before opening another project').then(function (ok) {
        if (!ok) return;
        return desktop.openProject(recent).then(function (r) {
          if (!r || r.canceled) return;
          if (r.error) { toast(r.error); return; }
          return decodeProject(new Uint8Array(r.data)).then(function (o) { return loadProjectObject(o, r); });
        });
      }).catch(projectError);
    }
    $('projectInput').click();
  }
  function openProjectFile(file) {
    if (!file) return;
    if (file.size > 400e6) { toast('That file is too large to be a project.'); return; }
    beforeReplace('Before opening ' + file.name).then(function (ok) {
      if (!ok) return;
      return file.arrayBuffer().then(function (b) { return decodeProject(new Uint8Array(b)); })
        .then(function (o) { return loadProjectObject(o, { name: file.name.replace(/\.[^.]+$/, ''), file: null }); });
    }).catch(projectError);
  }
  function projectError(err) { toast('That file could not be opened as a project' + (err && /newer/.test(err.message) ? ': it was made by a newer Fembroider.' : '.')); }
  function isProjectFile(f) { return f && /\.(fembroider|json)$/i.test(f.name || ''); }
  function renameProject(n) {
    n = cleanName(n);
    if (n === project.name) return;
    project.name = n; updateProjectUi(); persist();
  }

  // ---------- confirm box (in-app, never a browser dialog) ----------
  function confirmBox(title, text, okLabel) {
    return new Promise(function (res) {
      closePop();
      var s = document.createElement('div'); s.className = 'scrim';
      s.innerHTML = '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cbT" aria-describedby="cbD" style="width:min(420px,calc(100vw - 32px))"><header><h2 id="cbT">' + esc(title) + '</h2></header>' +
        '<div class="mbody"><p id="cbD" style="margin:0 0 14px;line-height:1.5">' + esc(text) + '</p><div class="btnrow"><button type="button" class="btn" data-no>Cancel</button><button type="button" class="btn primary" data-yes>' + esc(okLabel) + '</button></div></div></div>';
      document.body.appendChild(s);
      function done(v) { s.remove(); res(v); }
      s.addEventListener('click', function (e) { if (e.target === s || e.target.closest('[data-no]')) done(false); else if (e.target.closest('[data-yes]')) done(true); });
      s.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') done(false); });
      s.querySelector('[data-no]').focus();
    });
  }

  // ---------- version history ----------
  function openVersions() {
    closePop();
    var s = document.createElement('div'); s.className = 'scrim';
    s.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="vhT" style="width:min(520px,calc(100vw - 32px))"><header><h2 id="vhT">Version history</h2><button type="button" class="btn sm" data-close>Close</button></header>' +
      '<div class="mbody" id="vhBody"><p class="note">Loading…</p></div></div>';
    document.body.appendChild(s);
    var body = s.querySelector('#vhBody');
    function draw() {
      IDB.all('versions').then(function (list) {
        list = (list || []).sort(function (a, b) { return b.time - a.time; });
        project.versions = list.length;
        body.innerHTML = '<p class="note" style="margin-bottom:10px">' + (APREFS.versions ? 'A version is kept every 5 minutes while you work, and before a design is replaced (new, open, restore). The newest ' + VERSION_KEEP + ' are kept, in this ' + (desktop ? 'app' : 'browser') + ' only.' : 'Version history is off: turn it on in the Project menu.') + '</p>' +
          '<div class="btnrow" style="margin-bottom:12px"><button type="button" class="btn sm" data-keep>Keep a version now</button></div>' +
          (list.length ? '<ul class="verlist">' + list.map(function (v) {
            return '<li><b>' + esc(v.name || 'Untitled project') + '</b><small>' + esc(when(v.time)) + ' · ' + v.layers + ' layer' + (v.layers === 1 ? '' : 's') + ' · ' + esc(v.reason || 'Autosave') + '</small>' +
              '<button type="button" class="btn sm" data-restore="' + v.id + '">Restore</button></li>';
          }).join('') + '</ul>' : '<p class="note">No versions yet.</p>');
      }, function () { body.innerHTML = '<p class="note err">Version history is not available here (this browser blocks storage).</p>'; });
    }
    draw();
    s.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') s.remove(); });
    s.addEventListener('click', function (e) {
      if (e.target === s || e.target.closest('[data-close]')) { s.remove(); return; }
      if (e.target.closest('[data-keep]')) { writeVersion('Kept by hand').then(function () { toast('Version kept'); draw(); }, function () { toast('Could not keep a version here.'); }); return; }
      var r = e.target.closest('[data-restore]');
      if (r) {
        IDB.get('versions', +r.dataset.restore).then(function (v) {
          if (!v) return;
          return writeVersion('Before restoring ' + hhmm(v.time)).catch(function () {}).then(function () { return fetchSources(v.doc); }).then(function () {
            var d = cleanDoc(JSON.parse(JSON.stringify(v.doc)));
            if (!d) throw new Error('bad version');
            var file = project.file;
            replaceDocument(d, v.name, file);
            project.savedKey = null; // restored work counts as unsaved until saved
            autosave(true); s.remove();
            toast('Restored the version from ' + when(v.time) + ' · the design it replaced is in Version history');
          });
        }).catch(function () { toast('That version could not be restored.'); });
      }
    });
    s.querySelector('[data-close]').focus();
  }

  // ---------- header: project button and menu ----------
  function statusHtml() {
    var dirty = isDirty(), parts = [];
    if (desktop && project.file) parts.push(dirty ? 'Changes not yet saved to <b>' + esc(project.file) + '</b>' : 'Saved to <b>' + esc(project.file) + '</b>' + (project.savedAt ? ' at ' + hhmm(project.savedAt) : ''));
    else parts.push(project.savedAt ? (dirty ? 'Changed since you ' + (desktop ? 'saved' : 'downloaded') + ' it at ' + hhmm(project.savedAt) : (desktop ? 'Saved' : 'Downloaded') + ' at ' + hhmm(project.savedAt)) : 'Not saved to a file yet');
    parts.push(APREFS.mode === 'off' ? 'Autosave is off' : project.autoError ? '<span style="color:var(--bad)">Autosave failed: ' + esc(project.autoError) + '</span>' : project.autosavedAt ? 'Autosaved in this ' + (desktop ? 'app' : 'browser') + ' at ' + hhmm(project.autosavedAt) : 'Autosave: ' + AUTOSAVE_LABEL[APREFS.mode].toLowerCase());
    return parts.join('<br>');
  }
  var PICONS = {
    new: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6" stroke-linecap="round"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5V11H7l-3 8z"/><path d="M4 19h14l3-8"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
    saveas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M13 20H5V4h11l3 3v4"/><path d="M8 4v5h7V4M14 21l1-3 5-5 2 2-5 5z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4M12 8v4l3 2"/></svg>',
    recent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>'
  };
  var MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl+';
  function projectMenuHtml(recent) {
    var dk = !!(desktop && desktop.saveProject);
    return '<h4>Project</h4><div class="pname"><input class="field" id="projName" maxlength="80" value="' + esc(project.name) + '" aria-label="Project name" spellcheck="false"></div>' +
      '<p class="pstatus" id="projStatus">' + statusHtml() + '</p>' +
      '<button type="button" class="mi" data-p="new">' + PICONS.new + '<span>New project</span>' + (dk ? '<kbd>' + MOD + 'Shift+N</kbd>' : '') + '</button>' +
      '<button type="button" class="mi" data-p="open">' + PICONS.open + '<span>Open…</span><kbd>' + MOD + 'O</kbd></button>' +
      (dk ? '<button type="button" class="mi" data-p="save">' + PICONS.save + '<span>Save</span><kbd>' + MOD + 'S</kbd></button>' +
            '<button type="button" class="mi" data-p="saveas">' + PICONS.saveas + '<span>Save as…</span><kbd>' + MOD + 'Shift+S</kbd></button>'
          : '<button type="button" class="mi" data-p="save">' + PICONS.download + '<span>Download project file</span><kbd>' + MOD + 'S</kbd></button>') +
      (recent && recent.length ? '<div class="psep"></div><h4>Recent</h4>' + recent.slice(0, 6).map(function (r, i) {
        return '<button type="button" class="mi" data-recent="' + i + '"' + (r.exists ? '' : ' disabled') + ' title="' + esc(r.folder + '\\' + r.file) + '">' + PICONS.recent + '<span>' + esc(r.name) + '</span><small>' + (r.exists ? esc(when(r.time)) : 'missing') + '</small></button>';
      }).join('') : '') +
      '<div class="psep"></div><h4>Autosave</h4><div class="pset">' +
      '<div class="seg grid2" role="group" aria-label="Autosave">' + ['change', '1', '5', 'off'].map(function (m) {
        return '<button type="button" data-auto="' + m + '" aria-pressed="' + String(APREFS.mode === m) + '">' + AUTOSAVE_LABEL[m] + '</button>'; }).join('') + '</div>' +
      '<div class="row"><label for="projVersions">Keep a version history<small class="hint2">one every 5 minutes, newest ' + VERSION_KEEP + '</small></label><div class="ctl"><input type="checkbox" id="projVersions"' + (APREFS.versions ? ' checked' : '') + '></div></div>' +
      (dk ? '<div class="row"><label for="projToFile">Also save changes to the project file<small class="hint2">once it has been saved somewhere</small></label><div class="ctl"><input type="checkbox" id="projToFile"' + (APREFS.toFile ? ' checked' : '') + '></div></div>' : '') +
      '</div>' +
      '<button type="button" class="mi" data-p="versions">' + PICONS.history + '<span>Version history…</span><small>' + (project.versions ? project.versions + ' kept' : '') + '</small></button>';
  }
  function openProjectPop() {
    closePop();
    var btn = $('projectBtn'), p = document.createElement('div');
    p.className = 'projpop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Project');
    var recent = [];
    function draw() { p.innerHTML = projectMenuHtml(recent); }
    draw();
    document.body.appendChild(p); placePop(p, btn, false);
    if (desktop && desktop.recentProjects) desktop.recentProjects().then(function (r) { recent = Array.isArray(r) ? r : []; if (pop === p && recent.length) { var a = document.activeElement && document.activeElement.id; draw(); if (a && $(a)) $(a).focus(); } }, function () {});
    p.addEventListener('change', function (e) {
      if (e.target.id === 'projName') { renameProject(e.target.value); return; }
      if (e.target.id === 'projVersions') { APREFS.versions = e.target.checked; savePrefs(); if (APREFS.versions) autosave(); updateProjectUi(); }
      if (e.target.id === 'projToFile') { APREFS.toFile = e.target.checked; savePrefs(); if (APREFS.toFile) autosave(); }
    });
    p.addEventListener('keydown', function (e) { if (e.target.id === 'projName' && e.key === 'Enter') { e.preventDefault(); renameProject(e.target.value); e.target.select(); } });
    p.addEventListener('click', function (e) {
      var a = e.target.closest('[data-auto]'), c = e.target.closest('[data-p]'), r = e.target.closest('[data-recent]');
      if (a) {
        APREFS.mode = a.dataset.auto; savePrefs(); scheduleAutosave();
        p.querySelectorAll('[data-auto]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === a)); });
        if (APREFS.mode !== 'off') autosave(true); else IDB.del('kv', 'current').catch(function () {});
        var st = $('projStatus'); if (st) st.innerHTML = statusHtml();
        updateProjectUi();
        return;
      }
      if (r && !r.disabled) { openProject(+r.dataset.recent); return; }
      if (!c) return;
      var nameEl = $('projName'); if (nameEl) renameProject(nameEl.value);
      closePop();
      if (c.dataset.p === 'new') newProject();
      else if (c.dataset.p === 'open') openProject();
      else if (c.dataset.p === 'save') saveProject(false);
      else if (c.dataset.p === 'saveas') saveProject(true);
      else if (c.dataset.p === 'versions') openVersions();
    });
  }
  $('projectBtn').addEventListener('click', function (e) { e.stopPropagation(); if (pop && pop.classList.contains('projpop')) closePop(); else openProjectPop(); });
  $('projectInput').addEventListener('change', function () { var f = $('projectInput').files[0]; $('projectInput').value = ''; openProjectFile(f); });

  function updateProjectUi() {
    var dirty = isDirty();
    var n = $('projectName'); if (n) n.textContent = project.name;
    var d = $('projectDirty'); if (d) d.hidden = !dirty;
    var b = $('projectBtn'); if (b) b.title = project.name + (dirty ? ' (unsaved changes)' : '') + ' — new, open, save, autosave';
    document.title = (dirty ? '• ' : '') + project.name + ' — Fembroider';
    var st = $('projStatus'); if (st) st.innerHTML = statusHtml();
  }
  setInterval(function () { var st = $('projStatus'); if (st) st.innerHTML = statusHtml(); }, 15e3);

  // keyboard: Ctrl+S / Ctrl+Shift+S / Ctrl+O (the desktop app's File menu sends the same commands)
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || document.querySelector('.scrim')) return;
    var k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); if (desktop && desktop.onMenu) return; closePop(); saveProject(e.shiftKey && !!desktop); }
    else if (k === 'o') { e.preventDefault(); if (desktop && desktop.onMenu) return; openProject(); }
  });
  if (desktop && desktop.onMenu) desktop.onMenu(function (cmd) {
    if (document.querySelector('.scrim') && cmd !== 'save') return;
    if (cmd === 'new') newProject(); else if (cmd === 'open') openProject(); else if (cmd === 'save') saveProject(false); else if (cmd === 'saveAs') saveProject(true);
  });
  // leaving: write the working copy now; warn only if nothing would keep the changes
  window.addEventListener('beforeunload', function (e) {
    if (APREFS.mode !== 'off') { if (docKey() !== project.autoKey) autosave(); return; }
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && APREFS.mode !== 'off') autosave(); });
  scheduleAutosave();
