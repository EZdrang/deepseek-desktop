'use strict';
const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, session, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { HOME_URL, isDeepSeekURL, isExternalURL } = require('./navigation.cjs');

app.setName('DeepSeek Web Desktop');
app.setAppUserModelId('local.deepseek.webdesktop');
app.enableSandbox();
if (!app.isPackaged && process.env.DEEPSEEK_TEST_PROFILE) {
  app.setPath('userData', path.resolve(process.env.DEEPSEEK_TEST_PROFILE));
}
let mainWindow;
let tray;
let trayMenu;
let isQuitting = false;
let flushing = false;
let flushed = false;
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  catch { return {}; }
}
function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({
      bounds: mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized()
    }));
  } catch { /* Geometry is optional; do not interrupt quitting. */ }
}
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!tray || tray.isDestroyed()) return;
  saveState();
  mainWindow.hide();
}
function quitApplication() {
  isQuitting = true;
  app.quit();
}
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'deepseek-logo.png'));
  tray = new Tray(icon.resize({ width: 32, height: 32 }));
  tray.setToolTip('DeepSeek 网页桌面版');
  trayMenu = Menu.buildFromTemplate([
    { id: 'show', label: '显示窗口', click: showMainWindow },
    { id: 'hide', label: '隐藏到托盘', click: hideMainWindow },
    { type: 'separator' },
    { id: 'quit', label: '退出', click: quitApplication }
  ]);
  tray.setContextMenu(trayMenu);
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}
function loadHome() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.loadURL(HOME_URL).catch(() => {});
  }
}
async function openExternal(url) {
  if (!isExternalURL(url)) return;
  try { await shell.openExternal(url); } catch { /* Keep chat open. */ }
}
function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function errorPage(code) {
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <title>DeepSeek · 连接失败</title><style>
    :root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;
    place-items:center;background:light-dark(#f7f8fc,#17181c);color:light-dark(#202431,#edf0fa);
    font:16px/1.8 'Segoe UI','Microsoft YaHei',sans-serif}.card{max-width:520px;padding:48px}
    .mark{font-size:44px;color:#536dfe}h1{font-size:26px;margin:12px 0}p{opacity:.72}
    a{display:inline-block;background:#4d6bfe;color:white;padding:10px 26px;border-radius:10px;
    text-decoration:none}small{display:block;margin-top:20px;opacity:.5}</style>
    <div class="card"><div class="mark">◉</div><h1>暂时无法连接 DeepSeek</h1>
    <p>请检查网络连接；如果浏览器里也打不开，请稍后再试。登录数据仍然保存在本机。</p>
    <a href="${HOME_URL}">重新连接</a><small>连接错误：${escapeHTML(code)}</small></div></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}
function createMainWindow() {
  const state = readState();
  const bounds = state.bounds;
  const valid = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
    bounds.width >= 800 && bounds.height >= 600 && bounds.width <= 10000 && bounds.height <= 10000;
  const visible = valid && screen.getAllDisplays().some(({ workArea: area }) =>
    bounds.x + bounds.width > area.x + 80 && bounds.x < area.x + area.width - 80 &&
    bounds.y >= area.y && bounds.y < area.y + area.height - 80);
  mainWindow = new BrowserWindow({
    ...(visible ? bounds : { width: 1280, height: 850 }),
    minWidth: 800, minHeight: 600, show: false,
    title: 'DeepSeek · 正在连接…', backgroundColor: '#17181c',
    icon: path.join(__dirname, 'deepseek-logo.png'), autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
      contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
      webviewTag: false, navigateOnDragDrop: false, spellcheck: false,
      backgroundThrottling: false
    }
  });
  if (state.maximized) mainWindow.maximize();
  showMainWindow();
  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    if (isDeepSeekURL(url)) void contents.loadURL(url).catch(() => {});
    else void openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isDeepSeekURL(url)) { event.preventDefault(); void openExternal(url); }
  });
  contents.on('will-redirect', (event, url) => {
    if (!isDeepSeekURL(url)) { event.preventDefault(); void openExternal(url); }
  });
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('did-start-loading', () => mainWindow?.setTitle('DeepSeek · 正在连接…'));
  contents.on('did-stop-loading', () => mainWindow?.setTitle('DeepSeek 网页桌面版'));
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isDeepSeekURL(url)) {
      void contents.loadURL(errorPage(code)).catch(() => {});
    }
  });
  contents.on('render-process-gone', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void contents.loadURL(errorPage('页面进程已退出，请重新连接')).catch(() => {});
    }
  });
  contents.on('context-menu', (_event, params) => {
    const items = params.isEditable
      ? [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }]
      : [{ role: 'copy', label: '复制', enabled: Boolean(params.selectionText) }];
    Menu.buildFromTemplate(items).popup({ window: mainWindow });
  });
  mainWindow.on('close', event => {
    saveState();
    if (!isQuitting && tray && !tray.isDestroyed()) {
      event.preventDefault();
      hideMainWindow();
    }
  });
  mainWindow.on('query-session-end', () => { isQuitting = true; });
  mainWindow.on('session-end', () => { isQuitting = true; });
  mainWindow.on('closed', () => { mainWindow = null; });
  loadHome();
}
function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '应用', submenu: [
      { label: '隐藏到托盘', accelerator: 'Ctrl+W', click: hideMainWindow },
      { label: '回到首页', accelerator: 'Ctrl+Home', click: loadHome },
      { label: '用浏览器打开', click: () => void openExternal(HOME_URL) },
      { label: '打开下载文件夹', click: () => void shell.openPath(app.getPath('downloads')) },
      { type: 'separator' }, { label: '退出', accelerator: 'Ctrl+Q', click: quitApplication }
    ] },
    { label: '编辑', submenu: [
      { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }
    ] },
    { label: '视图', submenu: [
      { label: '刷新', accelerator: 'Ctrl+R', click: () => {
        if (mainWindow && isDeepSeekURL(mainWindow.webContents.getURL())) mainWindow.reload();
        else loadHome();
      } },
      { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }
    ] },
    { label: '帮助', submenu: [
      { label: '关于', click: () => void dialog.showMessageBox(mainWindow, {
        type: 'info', title: '关于 DeepSeek 网页桌面版',
        message: `DeepSeek 网页桌面版 ${app.getVersion()}`,
        detail: '个人封装，非 DeepSeek 官方客户端。\n直接访问 chat.deepseek.com，使用网页登录，无需 API Key。\n关闭窗口隐藏到托盘；点击托盘恢复，右键托盘可退出。\n按 Alt 显示菜单，Ctrl+Q 彻底退出。\n\n基于 doxdk/deepseek-desktop（MIT）修改。\nElectron ' + process.versions.electron
      }) }
    ] }
  ]));
}
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock || process.argv.includes('--quit')) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--quit')) quitApplication();
    else showMainWindow();
  });
  app.whenReady().then(() => {
    const ses = session.defaultSession;
    // Use the bundled Chromium version for website browser compatibility.
    // Do not alter the website or suppress any of its dialogs.
    ses.setUserAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`);
    const permitted = new Set(['clipboard-sanitized-write']);
    ses.setPermissionCheckHandler((_contents, permission, origin) =>
      isDeepSeekURL(origin) && permitted.has(permission));
    ses.setPermissionRequestHandler((contents, permission, callback) =>
      callback(Boolean(contents && isDeepSeekURL(contents.getURL()) && permitted.has(permission))));
    ses.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: '保存 DeepSeek 下载文件' });
    });
    createMenu();
    createMainWindow();
    createTray();
  }).catch(error => {
    dialog.showErrorBox('DeepSeek 启动失败', error.message);
    app.quit();
  });
  app.on('activate', () => mainWindow ? showMainWindow() : createMainWindow());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    isQuitting = true;
    if (flushed || !app.isReady()) return;
    event.preventDefault();
    if (flushing) return;
    flushing = true;
    saveState();
    session.defaultSession.flushStorageData();
    void Promise.race([
      session.defaultSession.cookies.flushStore(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]).catch(() => {}).finally(() => { flushed = true; app.quit(); });
  });
  app.on('will-quit', () => {
    if (tray && !tray.isDestroyed()) tray.destroy();
  });
}
// Main-process-only exports for native lifecycle tests; nothing is exposed to the website.
module.exports = { getWindow: () => mainWindow, getTray: () => tray, getTrayMenu: () => trayMenu };
