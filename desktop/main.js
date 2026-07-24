'use strict';
// LifeTrack HUD — Electron main process.
// Frameless translucent window + tray + native notifications + OAuth popup.
// All privileged work lives here; the renderer talks to it only through the
// contextBridge API defined in preload.js.
const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, powerMonitor, nativeImage, shell, globalShortcut, screen } = require('electron');
const path = require('path');

const NORMAL_SIZE = { width: 1080, height: 720 };
const MINI_SIZE = { width: 340, height: 150 };
const QUICK_SIZE = { width: 360, height: 190 };

let win = null;
let quickWin = null;
let tray = null;
let isMini = false;
const reminderTimers = new Map(); // id -> timeout

// ── Window ──────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    ...NORMAL_SIZE,
    minWidth: 460,
    minHeight: 320,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    show: false,
    title: 'LifeTrack HUD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Honor --hidden (autostart launches minimized to tray).
  const startHidden = process.argv.includes('--hidden');
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });

  // Hard-deny navigation and popups except our OAuth flow (handled explicitly).
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Closing the window hides to tray so reminders keep firing.
  win.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });

  // Let the renderer know when max/fullscreen state changes (icon swap, etc).
  const sendWinState = () => win && win.webContents.send('win-state', {
    max: win.isMaximized(), fs: win.isFullScreen(),
  });
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(ev =>
    win.on(ev, sendWinState));

  // F11 toggles fullscreen (handled here, not globalShortcut, so it's local
  // to this window and doesn't fight other apps' F11 bindings).
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
}

// ── Tray ────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'tray.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('LifeTrack HUD');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar', click: () => showWindow() },
    { label: 'Mini-modo', click: () => setMiniMode(!isMini) },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => showWindow());
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function setMiniMode(mini) {
  if (!win) return;
  isMini = mini;
  const size = mini ? MINI_SIZE : NORMAL_SIZE;
  win.setResizable(!mini);
  win.setAlwaysOnTop(mini);
  win.setSize(size.width, size.height, true);
  win.webContents.send('mode-changed', mini ? 'mini' : 'normal');
}

// ── Reminder scheduling (main-process timers survive a hidden window) ─────
function clearReminders() {
  for (const t of reminderTimers.values()) clearTimeout(t);
  reminderTimers.clear();
}

function scheduleReminders(list) {
  clearReminders();
  if (!Array.isArray(list)) return;
  const now = Date.now();
  for (const r of list) {
    // r = { id, title, body, at }  (at = epoch ms of next fire)
    const delay = r.at - now;
    if (delay <= 0 || delay > 26 * 60 * 60 * 1000) continue; // cap ~26h
    const t = setTimeout(() => {
      showNotification(r.title, r.body);
      reminderTimers.delete(r.id);
      if (win) win.webContents.send('reminder-fired', r.id);
    }, delay);
    reminderTimers.set(r.id, t);
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: title || 'LifeTrack', body: body || '' });
  n.on('click', () => showWindow());
  n.show();
}

// Re-ask the renderer to recompute schedules after sleep (timers may have lapsed).
powerMonitor.on('resume', () => { if (win) win.webContents.send('system-resumed'); });

// ── OAuth popup ─────────────────────────────────────────────────────────
// Opens the Supabase OAuth URL in a child window and resolves with the tokens
// parsed from the redirect URL fragment (implicit flow — matches the PWA).
function openOAuth(authUrl, redirectPrefix) {
  return new Promise((resolve, reject) => {
    const popup = new BrowserWindow({
      width: 480, height: 640, parent: win, modal: true, show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    // Standard Chrome UA — Google blocks obvious embedded webviews.
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
    let settled = false;

    const tryHandle = (url) => {
      if (settled || !url || !url.startsWith(redirectPrefix)) return;
      const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
      const p = new URLSearchParams(hash);
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      settled = true;
      popup.destroy();
      if (access_token) resolve({ access_token, refresh_token });
      else reject(new Error('No tokens in redirect'));
    };

    popup.webContents.on('will-redirect', (_e, url) => tryHandle(url));
    popup.webContents.on('did-navigate', (_e, url) => tryHandle(url));
    popup.on('closed', () => { if (!settled) { settled = true; reject(new Error('cancelled')); } });
    popup.loadURL(authUrl, { userAgent: UA });
  });
}

// ── Quick-log overlay (global hotkey) ────────────────────────────────────
function createQuickLogWindow() {
  quickWin = new BrowserWindow({
    ...QUICK_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  quickWin.loadFile(path.join(__dirname, 'renderer', 'quicklog.html'));
  quickWin.on('blur', () => quickWin && quickWin.hide());
  quickWin.webContents.on('will-navigate', (e) => e.preventDefault());
  quickWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function toggleQuickLog() {
  if (!quickWin) createQuickLogWindow();
  if (quickWin.isVisible()) { quickWin.hide(); return; }
  // Position near the cursor, clamped to the display's work area.
  const pt = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(pt).workArea;
  const x = Math.min(Math.max(pt.x - QUICK_SIZE.width / 2, wa.x + 8), wa.x + wa.width - QUICK_SIZE.width - 8);
  const y = Math.min(Math.max(pt.y - 20, wa.y + 8), wa.y + wa.height - QUICK_SIZE.height - 8);
  quickWin.setPosition(Math.round(x), Math.round(y));
  quickWin.show();
  quickWin.focus();
}

// ── IPC bridge ──────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.hide());
ipcMain.on('win:mini', (_e, mini) => setMiniMode(!!mini));
ipcMain.on('win:always-on-top', (_e, on) => win && win.setAlwaysOnTop(!!on));
ipcMain.on('win:maximize-toggle', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on('win:fullscreen-toggle', () => win && win.setFullScreen(!win.isFullScreen()));
ipcMain.handle('win:get-state', () => win ? { max: win.isMaximized(), fs: win.isFullScreen() } : { max: false, fs: false });
// Manual resize-by-delta for the frameless/transparent window (edge grips in
// the renderer report pointer deltas since transparent windows don't always
// get reliable native edge-resize hit-testing on Windows).
ipcMain.on('win:resize-by', (_e, { edge, dx, dy }) => {
  if (!win || win.isMaximized() || win.isFullScreen()) return;
  const b = win.getBounds();
  let { x, y, width, height } = b;
  if (edge.includes('e')) width  += dx;
  if (edge.includes('s')) height += dy;
  if (edge.includes('w')) { width  -= dx; x += dx; }
  if (edge.includes('n')) { height -= dy; y += dy; }
  win.setBounds({ x, y, width: Math.max(width, 460), height: Math.max(height, 320) });
});
ipcMain.on('notify', (_e, { title, body }) => showNotification(title, body));
ipcMain.on('schedule-reminders', (_e, list) => scheduleReminders(list));
ipcMain.handle('oauth', (_e, { url, redirectPrefix }) => openOAuth(url, redirectPrefix));
ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));
ipcMain.on('quicklog:close', () => quickWin && quickWin.hide());
// A window mutated the shared data — nudge the HUD to re-render immediately.
ipcMain.on('data-changed', () => win && win.webContents.send('data-changed'));
ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('autostart:set', (_e, on) =>
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }));

// ── Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+L', toggleQuickLog);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { /* stay alive in tray */ });
app.on('before-quit', () => { app.isQuitting = true; clearReminders(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
