'use strict';
// Run with Electron in a disposable profile. Exercises real BrowserWindow and Tray objects.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const phase = process.env.DEEPSEEK_TRAY_PHASE || 'write';
assert.ok(['write', 'read'].includes(phase), 'DEEPSEEK_TRAY_PHASE must be write or read');
assert.equal(app.isPackaged, false, 'Run this test with development Electron, which supports a separate test profile');
if (phase === 'read' && !process.env.DEEPSEEK_TEST_PROFILE) {
  throw new Error('The read phase requires DEEPSEEK_TEST_PROFILE set to the profile used by the write phase.');
}
const profile = process.env.DEEPSEEK_TEST_PROFILE
  ? path.resolve(process.env.DEEPSEEK_TEST_PROFILE)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-tray-profile-'));
process.env.DEEPSEEK_TEST_PROFILE = profile;
const evidence = process.env.DEEPSEEK_TEST_REPORT_DIR
  ? path.resolve(process.env.DEEPSEEK_TEST_REPORT_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-tray-report-'));
const reportPath = path.join(evidence, 'tray-' + phase + '.json');
const report = { phase, profile, reportPath, checks: [] };
// Set the profile before main.js reads it or acquires the single-instance lock.
const desktop = require('../main.js');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const win = desktop.getWindow();
  const tray = desktop.getTray();
  const trayMenu = desktop.getTrayMenu();
  assert.ok(win && win.isVisible());
  assert.ok(tray && !tray.isDestroyed());
  const bounds = tray.getBounds();
  assert.ok(bounds.width > 0 && bounds.height > 0, 'Tray icon should have native Windows bounds');
  report.trayBounds = bounds;
  report.checks.push('native-tray-icon-created');
  win.close();
  await delay(250);
  assert.equal(win.isDestroyed(), false);
  assert.equal(win.isVisible(), false);
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  report.checks.push('close-hides-window-and-keeps-app-alive');
  tray.emit('click');
  assert.equal(win.isVisible(), true);
  report.checks.push('tray-click-restores-window');
  trayMenu.getMenuItemById('hide').click();
  assert.equal(win.isVisible(), false);
  trayMenu.getMenuItemById('show').click();
  assert.equal(win.isVisible(), true);
  report.checks.push('tray-menu-hide-and-show');
  win.minimize();
  tray.emit('double-click');
  assert.equal(win.isMinimized(), false);
  assert.equal(win.isVisible(), true);
  report.checks.push('tray-double-click-restores-minimized-window');
  win.close();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const duplicate = spawn(process.execPath, [path.resolve(__dirname, '..')], { env, windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 50 && duplicate.exitCode === null; attempt++) await delay(100);
  assert.notEqual(duplicate.exitCode, null);
  assert.equal(win.isVisible(), true);
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  report.checks.push('relaunch-restores-hidden-existing-window');
  for (let attempt = 0; attempt < 150; attempt++) {
    if (!win.webContents.isLoading() && win.webContents.getURL().startsWith('https://chat.deepseek.com/')) break;
    await delay(200);
  }
  assert.ok(win.webContents.getURL().startsWith('https://chat.deepseek.com/'));
  assert.equal(await win.webContents.executeJavaScript('typeof require'), 'undefined');
  report.checks.push('official-website-loaded-with-node-disabled');
  if (phase === 'write') {
    await win.webContents.executeJavaScript('localStorage.setItem("__tray_test__","preserved"); true');
  } else {
    assert.equal(await win.webContents.executeJavaScript('localStorage.getItem("__tray_test__")'), 'preserved');
    await win.webContents.executeJavaScript('localStorage.removeItem("__tray_test__"); true');
    report.checks.push('storage-survives-explicit-quit-and-restart');
  }
  report.exitFromHiddenWindow = phase === 'write';
  if (report.exitFromHiddenWindow) win.close();
  app.on('will-quit', () => {
    assert.ok(tray.isDestroyed(), 'Explicit exit should destroy the tray');
    report.checks.push('explicit-quit-destroys-tray-and-exits');
    report.passed = true;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  });
  trayMenu.getMenuItemById('quit').click();
}).catch(error => {
  report.error = error.stack;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(error);
  app.exit(1);
});
