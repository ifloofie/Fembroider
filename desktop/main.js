'use strict';
// Fembroider desktop shell.
// Deliberately minimal: one sandboxed window showing local files. No Node access in the page,
// no network, no permissions, no auto-updater, no child processes, no registry writes.
// Files are written only where the user picks in a Save or folder dialog (a project, once saved, is re-saved to the
// same file the user picked; the page never names a path itself).
const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PAGE = path.join(__dirname, 'app', 'index.html');
const PAGE_URL = pathToFileURL(PAGE).href;
const SAVE_NAME = /^[\w .()\-]{1,80}\.(zip|png|txt|exp|inf|bmp|jef|dst)$/i;
const CARD_NAME = /^[A-Z0-9_]{1,8}\.(EXP|INF|BMP|DST|PES|JEF|VP3|XXX)$/;
const KIND = { zip: 'ZIP archive', png: 'PNG image', txt: 'Text', exp: 'Melco/Bernina EXP', inf: 'Bernina INF', bmp: 'Bitmap', jef: 'Janome JEF', dst: 'Tajima DST' };
const PROJECT_EXT = 'fembroider';
const PROJECT_MAX = 400 * 1024 * 1024;

// the profile (saved preferences, autosaves) lives in %APPDATA%\Fembroider
try {
  const now = path.join(app.getPath('appData'), 'Fembroider');
  app.setName('Fembroider');
  app.setPath('userData', now);
} catch (err) { /* start with a fresh profile */ }

function fromPage(e) {
  try { return !!e.senderFrame && e.senderFrame.url.split('#')[0] === PAGE_URL; } catch (err) { return false; }
}
function bytes(d, max) {
  if (!(d instanceof Uint8Array) || d.length === 0 || d.length > max) return null;
  return Buffer.from(d.buffer, d.byteOffset, d.byteLength);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;

  function createWindow() {
    win = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      title: 'Fembroider',
      backgroundColor: '#e9ecf1',
      show: false,
      icon: path.join(__dirname, 'app', 'icon.png'),
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: !app.isPackaged,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    win.once('ready-to-show', () => win.show());
    // The page never opens windows or navigates away; refuse both.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    // closing with unsaved changes: the page asks (beforeunload), and the user decides here
    win.webContents.on('will-prevent-unload', (ev) => {
      const q = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Close without saving', 'Keep working'], defaultId: 1, cancelId: 1, noLink: true,
        message: 'This project has unsaved changes.', detail: 'Save it from the Project menu (Ctrl+S) first, or close and lose the changes since the last save.' });
      if (q === 0) ev.preventDefault();
    });
    win.loadFile(PAGE);
  }

  // Save one file where the user chooses.
  ipcMain.handle('stitch:save-file', async (e, msg) => {
    if (!fromPage(e)) return { error: 'Blocked.' };
    const name = path.basename(String((msg && msg.filename) || ''));
    const data = bytes(msg && msg.data, 200 * 1024 * 1024);
    if (!SAVE_NAME.test(name) || !data) return { error: 'That file cannot be saved.' };
    const ext = path.extname(name).slice(1).toLowerCase();
    const r = await dialog.showSaveDialog(win, {
      title: 'Save ' + KIND[ext], defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: KIND[ext], extensions: [ext] }]
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    await fs.promises.writeFile(r.filePath, data);
    return { ok: true, path: r.filePath };
  });

  // Write the machine's files: the Deco 330's EXP + INF + BMP into the card's EmbF5 folder, or any other machine's
  // file (PES, JEF, VP3, XXX, DST, or BERNINA EXP + INF) straight onto the chosen USB stick or folder.
  ipcMain.handle('stitch:write-card', async (e, payload) => {
    if (!fromPage(e)) return { error: 'Blocked.' };
    const files = Array.isArray(payload) ? payload : (payload && payload.files);
    const embf5 = Array.isArray(payload) || (payload && payload.folder === 'EmbF5');
    if (!Array.isArray(files) || !files.length || files.length > 6) return { error: 'Nothing to write.' };
    const list = files.map((f) => ({ name: String(f && f.name), data: bytes(f && f.data, 20 * 1024 * 1024) }));
    if (list.some((f) => !CARD_NAME.test(f.name) || !f.data)) return { error: 'Unexpected card file.' };
    const pick = await dialog.showOpenDialog(win, {
      title: embf5 ? 'Choose the memory card (or its EmbF5 folder)' : 'Choose the USB stick', buttonLabel: 'Write here', properties: ['openDirectory']
    });
    if (pick.canceled || !pick.filePaths.length) return { canceled: true };
    let dir = pick.filePaths[0];
    if (embf5 && path.basename(dir).toLowerCase() !== 'embf5') {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
      const found = entries.find((d) => d.isDirectory() && d.name.toLowerCase() === 'embf5');
      if (found) dir = path.join(dir, found.name);
      else {
        const q = await dialog.showMessageBox(win, {
          type: 'question', buttons: ['Create EmbF5 here', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
          message: 'There is no EmbF5 folder here.',
          detail: 'The Deco 330 reads designs from a folder named EmbF5, which it creates when it formats a card. ' +
            'Formatting the card in the machine is the safest option. Create the folder in ' + dir + ' anyway?'
        });
        if (q.response !== 0) return { canceled: true };
        dir = path.join(dir, 'EmbF5');
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }
    const clash = list.filter((f) => fs.existsSync(path.join(dir, f.name))).map((f) => f.name);
    if (clash.length) {
      const q = await dialog.showMessageBox(win, {
        type: 'warning', buttons: ['Replace', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
        message: 'Replace the existing design?', detail: clash.join(', ') + ' already exist in ' + dir + '.'
      });
      if (q.response !== 0) return { canceled: true };
    }
    for (const f of list) await fs.promises.writeFile(path.join(dir, f.name), f.data);
    return { ok: true, path: dir };
  });

  // ---- projects: the page hands over bytes; only the main process knows file paths ----
  let projectPath = null;
  const recentFile = () => path.join(app.getPath('userData'), 'recent-projects.json');
  function readRecent() {
    try { const r = JSON.parse(fs.readFileSync(recentFile(), 'utf8')); return Array.isArray(r) ? r.filter((x) => x && typeof x.path === 'string').slice(0, 10) : []; } catch (err) { return []; }
  }
  function addRecent(p) {
    const list = [{ path: p, time: Date.now() }].concat(readRecent().filter((x) => x.path !== p)).slice(0, 10);
    try { fs.writeFileSync(recentFile(), JSON.stringify(list)); } catch (err) { /* not essential */ }
    if (process.platform === 'win32') try { app.addRecentDocument(p); } catch (err) { /* ignore */ }
  }
  function described(p) { return { name: path.basename(p, path.extname(p)), file: path.basename(p), folder: path.dirname(p) }; }
  ipcMain.handle('stitch:project-save', async (e, msg) => {
    if (!fromPage(e)) return { error: 'Blocked.' };
    const data = bytes(msg && msg.data, PROJECT_MAX);
    if (!data) return { error: 'Nothing to save.' };
    let target = !msg.saveAs && projectPath ? projectPath : null;
    if (!target) {
      const base = String((msg && msg.name) || 'Untitled').replace(/[^\w .()\-]/g, '').trim().slice(0, 80) || 'Untitled';
      const r = await dialog.showSaveDialog(win, {
        title: 'Save project', defaultPath: path.join(projectPath ? path.dirname(projectPath) : app.getPath('documents'), base + '.' + PROJECT_EXT),
        filters: [{ name: 'Fembroider project', extensions: [PROJECT_EXT] }]
      });
      if (r.canceled || !r.filePath) return { canceled: true };
      target = r.filePath;
      if (path.extname(target).toLowerCase() !== '.' + PROJECT_EXT) target += '.' + PROJECT_EXT;
    }
    // write beside, then swap in: a crash mid-save never leaves a half-written project
    const tmp = target + '.saving';
    await fs.promises.writeFile(tmp, data);
    await fs.promises.rename(tmp, target);
    projectPath = target; addRecent(target);
    return Object.assign({ ok: true }, described(target));
  });
  ipcMain.handle('stitch:project-open', async (e, msg) => {
    if (!fromPage(e)) return { error: 'Blocked.' };
    let target = null;
    if (msg && Number.isInteger(msg.recent)) {
      const r = readRecent()[msg.recent];
      if (!r || !fs.existsSync(r.path)) return { error: 'That project is no longer there.' };
      target = r.path;
    } else {
      const r = await dialog.showOpenDialog(win, { title: 'Open project', properties: ['openFile'],
        filters: [{ name: 'Fembroider project', extensions: [PROJECT_EXT, 'json'] }] });
      if (r.canceled || !r.filePaths.length) return { canceled: true };
      target = r.filePaths[0];
    }
    const st = await fs.promises.stat(target);
    if (!st.isFile() || st.size > PROJECT_MAX) return { error: 'That file is too large to be a project.' };
    const data = await fs.promises.readFile(target);
    projectPath = target; addRecent(target);
    return Object.assign({ ok: true, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) }, described(target));
  });
  ipcMain.handle('stitch:project-recent', (e) => {
    if (!fromPage(e)) return [];
    return readRecent().map((r) => Object.assign({ time: r.time, exists: fs.existsSync(r.path) }, described(r.path)));
  });
  ipcMain.handle('stitch:project-new', (e) => { if (fromPage(e)) projectPath = null; return { ok: true }; });

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const ses = session.defaultSession;
    // Offline app: only local files load; every network request is cancelled.
    ses.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !/^(file|data|blob|devtools|chrome-extension):/i.test(details.url) });
    });
    // No camera, microphone, notifications, geolocation or anything else.
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);

    function menu(cmd) { if (win) win.webContents.send('stitch:menu', cmd); }
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [
        { label: 'New project', accelerator: 'CmdOrCtrl+Shift+N', click: () => menu('new') },
        { label: 'Open project…', accelerator: 'CmdOrCtrl+O', click: () => menu('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => menu('save') },
        { label: 'Save as…', accelerator: 'CmdOrCtrl+Shift+S', click: () => menu('saveAs') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' }] },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      { role: 'help', submenu: [{ role: 'about', label: 'About Fembroider' }] }
    ]));
    app.setAboutPanelOptions({
      applicationName: 'Fembroider',
      applicationVersion: app.getVersion(),
      credits: 'Embroidery digitizer and 3D stitch preview ' +
        'Fonts: 50 open-source design fonts via Fontsource: Yellowtail, Satisfy, Rochester, Ultra and Permanent Marker (Apache 2.0); the rest, plus Saira Extra Condensed and IBM Plex, under the SIL OFL 1.1. ' +
        'Emoji: Twemoji 17 by Twitter, Inc. and contributors (CC-BY 4.0); names and groups from emojibase (MIT). Thread charts: Ink/Stitch palettes (GPL-3.0). 3D: three.js (MIT).'
    });

    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
