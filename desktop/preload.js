'use strict';
// The only bridge between the page and the desktop: narrowly-scoped save / open calls and the File menu.
// Everything is validated again in the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stitchDesktop', {
  saveFile: (filename, data) => ipcRenderer.invoke('stitch:save-file', { filename: String(filename), data }),
  saveProject: (name, data, saveAs) => ipcRenderer.invoke('stitch:project-save', { name: String(name || ''), data, saveAs: !!saveAs }),
  openProject: (recent) => ipcRenderer.invoke('stitch:project-open', Number.isInteger(recent) ? { recent } : {}),
  recentProjects: () => ipcRenderer.invoke('stitch:project-recent'),
  newProject: () => ipcRenderer.invoke('stitch:project-new'),
  onMenu: (cb) => { if (typeof cb === 'function') ipcRenderer.on('stitch:menu', (_e, cmd) => cb(String(cmd))); },
  writeCard: (files, folder) => ipcRenderer.invoke('stitch:write-card', { folder: folder === 'EmbF5' ? 'EmbF5' : '', files: (files || []).map((f) => ({ name: String(f.name), data: f.data })) })
});
