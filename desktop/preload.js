'use strict';
// The only bridge between the page and the desktop: two narrowly-scoped save calls.
// Everything is validated again in the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stitchDesktop', {
  saveFile: (filename, data) => ipcRenderer.invoke('stitch:save-file', { filename: String(filename), data }),
  writeCard: (files, folder) => ipcRenderer.invoke('stitch:write-card', { folder: folder === 'EmbF5' ? 'EmbF5' : '', files: (files || []).map((f) => ({ name: String(f.name), data: f.data })) })
});
