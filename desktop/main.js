// Digital Store for Windows: a shell around the live site. It has no UI and makes no API calls
// of its own, so deploying the web app is also the desktop release.
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://digital-store.sukpat.dev';
const STATE = path.join(app.getPath('userData'), 'window.json');
let win;

// Only the store's own origin renders inside the app. Comparing origins (not startsWith) keeps
// https://digital-store.sukpat.dev.evil.example out.
const internal = (url) => URL.parse(url)?.origin === SITE;
const external = (url) => { if (url.startsWith('https://')) shell.openExternal(url); };

function create() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {} // first run: defaults
  win = new BrowserWindow({
    width: s.width || 1360, height: s.height || 860, minWidth: 420, minHeight: 560,
    backgroundColor: '#f6f7fb', // --bg in web/app/globals.css, so there is no white flash before first paint
  });
  if (s.maximized) win.maximize();
  // getNormalBounds: the size to restore to, even while maximized. At 125% display scaling Windows
  // reports a window 2px larger than it was created, so the stored size is kept unless it was resized.
  const opened = win.getNormalBounds();
  win.on('close', () => {
    const now = win.getNormalBounds();
    const { width, height } = now.width === opened.width && now.height === opened.height ? s : now;
    fs.writeFileSync(STATE, JSON.stringify({ width, height, maximized: win.isMaximized() }));
  });

  const wc = win.webContents;
  const nav = wc.navigationHistory;

  // One window only: target=_blank links to the store load here, so they stay under the same rules
  wc.setWindowOpenHandler(({ url }) => {
    if (internal(url)) win.loadURL(url); else external(url);
    return { action: 'deny' };
  });
  const guard = (e) => { if (!internal(e.url)) { e.preventDefault(); external(e.url); } };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);

  // -3 = ERR_ABORTED: the navigation turned into a file download, which is not a failure
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { url } });
  });

  wc.session.on('will-download', (e, item) => {
    // ponytail: no save path is set, so Electron asks with its "Save As" dialog every time.
    // item.setSavePath() here if downloads should go straight to the Downloads folder.
    const bar = (v) => win.isDestroyed() || win.setProgressBar(v);
    item.on('updated', () => bar(item.getTotalBytes() ? item.getReceivedBytes() / item.getTotalBytes() : 2)); // 2 = indeterminate
    item.once('done', (e, state) => {
      bar(-1);
      if (state === 'completed') shell.showItemInFolder(item.getSavePath());
    });
  });

  // the back/forward buttons on a mouse
  win.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward') nav.goBack();
    if (cmd === 'browser-forward') nav.goForward();
  });

  const go = (label, to) => ({ label, click: () => win.loadURL(SITE + to) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Digital Store', submenu: [
      go('หน้าแรก', '/'), go('คลังของฉัน', '/library'), go('คำสั่งซื้อ', '/orders'), go('ตะกร้า', '/cart'), go('บัญชีของฉัน', '/account'),
      { type: 'separator' },
      { role: 'quit', label: 'ออกจากโปรแกรม' },
    ] },
    { label: 'ไป', submenu: [
      { label: 'ย้อนกลับ', accelerator: 'Alt+Left', click: () => nav.goBack() },
      { label: 'ไปข้างหน้า', accelerator: 'Alt+Right', click: () => nav.goForward() },
      { label: 'โหลดใหม่', accelerator: 'F5', click: () => wc.reload() },
    ] },
    { label: 'มุมมอง', submenu: [
      { role: 'zoomIn', label: 'ขยาย' }, { role: 'zoomOut', label: 'ย่อ' }, { role: 'resetZoom', label: 'ขนาดจริง' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'เต็มจอ' },
    ] },
  ]));

  win.loadURL(SITE);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  app.whenReady().then(create);
}
