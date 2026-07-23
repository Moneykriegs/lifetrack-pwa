'use strict';
// Bridge between the sandboxed renderer and the Electron main process.
// The renderer only ever sees `window.desktop` — never Node or ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  setMiniMode: (mini) => ipcRenderer.send('win:mini', mini),
  setAlwaysOnTop: (on) => ipcRenderer.send('win:always-on-top', on),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  scheduleReminders: (list) => ipcRenderer.send('schedule-reminders', list),
  openOAuth: (url, redirectPrefix) => ipcRenderer.invoke('oauth', { url, redirectPrefix }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  closeQuickLog: () => ipcRenderer.send('quicklog:close'),
  dataChanged: () => ipcRenderer.send('data-changed'),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  setAutostart: (on) => ipcRenderer.invoke('autostart:set', on),
  // main → renderer events
  onReminderFired: (cb) => ipcRenderer.on('reminder-fired', (_e, id) => cb(id)),
  onModeChanged: (cb) => ipcRenderer.on('mode-changed', (_e, mode) => cb(mode)),
  onSystemResumed: (cb) => ipcRenderer.on('system-resumed', () => cb()),
  onDataChanged: (cb) => ipcRenderer.on('data-changed', () => cb()),
});
