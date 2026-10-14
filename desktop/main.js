'use strict';
// Stitch Studio desktop shell.
// Deliberately minimal: one sandboxed window showing local files. No Node access in the page,
// no network, no permissions, no auto-updater, no child processes, no registry writes.
// Files are written only where the user picks in a Save or folder dialog.
const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PAGE = path.join(__dirname, 'app', 'index.html');
const PAGE_URL = pathToFileURL(PAGE).href;
const SAVE_NAME = /^[\w .()\-]{1,80}\.(zip|png|txt|exp|inf|bmp|jef|dst)$/i;
const CARD_NAME = /^[A-Z0-9_]{1,8}\.(EXP|INF|BMP|DST)$/;
const KIND = { zip: 'ZIP archive', png: 'PNG image', txt: 'Text', exp: 'Melco/Bernina EXP', inf: 'Bernina INF', bmp: 'Bitmap', jef: 'Janome JEF', dst: 'Tajima DST' };

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
      title: 'Stitch Studio',
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

  // Write the machine's files: the Deco 330's EXP + INF + BMP into the card's EmbF5 folder, or a Poolin DST
  // straight onto the chosen USB stick or folder.
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

    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] },
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
      { role: 'help', submenu: [{ role: 'about', label: 'About Stitch Studio' }] }
    ]));
    app.setAboutPanelOptions({
      applicationName: 'Stitch Studio',
      applicationVersion: app.getVersion(),
      credits: 'Embroidery digitizer and 3D stitch preview for the Bernina Deco 330. ' +
        'Fonts: 50 open-source design fonts via Fontsource: Yellowtail, Satisfy, Rochester, Ultra and Permanent Marker (Apache 2.0); the rest, plus Saira Extra Condensed and IBM Plex, under the SIL OFL 1.1. ' +
        'Emoji: Twemoji 17 by Twitter, Inc. and contributors (CC-BY 4.0); names and groups from emojibase (MIT). Thread charts: Ink/Stitch palettes (GPL-3.0). 3D: three.js (MIT).'
    });

    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
