'use strict';
// Runs development Electron against the official page, in a disposable data profile.
if (Object.hasOwn(process.env, 'DEEPSEEK_PACKAGED_EXE')) {
  throw new Error('DEEPSEEK_PACKAGED_EXE is unsupported: packaged apps ignore the test profile. Run this test with development Electron to keep your normal login data separate.');
}
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = process.env.DEEPSEEK_TEST_PROFILE
  ? path.resolve(process.env.DEEPSEEK_TEST_PROFILE)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-smoke-profile-'));
const evidence = process.env.DEEPSEEK_TEST_REPORT_DIR
  ? path.resolve(process.env.DEEPSEEK_TEST_REPORT_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-smoke-report-'));
const executable = path.join(root, 'node_modules/electron/dist/electron.exe');
const port = 19338;
fs.mkdirSync(evidence, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let child;
let connection;
const report = { profile, evidence, checks: [] };

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.pending = new Map();
    this.id = 0;
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(method + ' timed out')); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  close() { this.ws.close(); }
}

async function launch() {
  const env = { ...process.env, DEEPSEEK_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const args = [root, `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'];
  child = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => { console.error(error); });
  let target;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('App exited before creating a window: ' + child.exitCode);
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
      if (target) break;
    } catch {}
    await delay(300);
  }
  assert.ok(target, 'Electron must expose the main window');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  connection = new CDP(ws);
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const state = await connection.evaluate('({url:location.href,ready:document.readyState,text:document.body?.innerText?.length||0})');
      if (state.ready === 'complete' && state.text > 20) return state;
    } catch {}
    await delay(300);
  }
  throw new Error('No completed visible page after waiting');
}

async function closeWindow() {
  await connection.send('Page.close').catch(() => {});
  await delay(250);
  assert.equal(child.exitCode, null, 'Closing the window must keep the app running in the tray');
  report.checks.push('close-window-keeps-app-in-tray');
  const env = { ...process.env, DEEPSEEK_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const quitProcess = spawn(executable, [root, '--quit'], {
    cwd: root, env, windowsHide: true, stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 50 && quitProcess.exitCode === null; attempt++) await delay(100);
  connection.close();
  for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt++) await delay(100);
  assert.notEqual(child.exitCode, null, 'Explicit quit must terminate the application');
  report.checks.push('explicit-quit-exits-process');
}

(async () => {
  const initial = await launch();
  report.initialPage = initial;
  assert.ok(initial.url.startsWith('https://chat.deepseek.com/'), 'Official DeepSeek website must load');
  report.checks.push('official-website-loaded');
  const isolation = await connection.evaluate('({require:typeof require,process:typeof process,bridge:typeof window.electron})');
  assert.deepEqual(isolation, { require: 'undefined', process: 'undefined', bridge: 'undefined' });
  report.checks.push('no-node-or-preload-bridge-in-website');
  const shot = await connection.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(evidence, 'development.png'), Buffer.from(shot.data, 'base64'));

  await connection.evaluate('localStorage.setItem("__desktop_smoke__","persisted"); true');
  await connection.send('Network.setCookie', {
    name: '__desktop_smoke__', value: 'persisted', url: 'https://chat.deepseek.com/',
    secure: true, httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600
  });
  await connection.send('Page.reload');
  await delay(2000);
  assert.equal(await connection.evaluate('localStorage.getItem("__desktop_smoke__")'), 'persisted');
  report.checks.push('localstorage-survives-reload');
  await closeWindow();
  await launch();
  assert.equal(await connection.evaluate('localStorage.getItem("__desktop_smoke__")'), 'persisted');
  const cookies = await connection.send('Network.getCookies', { urls: ['https://chat.deepseek.com/'] });
  assert.ok(cookies.cookies.some(cookie => cookie.name === '__desktop_smoke__' && cookie.value === 'persisted'));
  report.checks.push('localstorage-and-cookies-survive-restart');
  const env = { ...process.env, DEEPSEEK_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const duplicate = spawn(executable, [root], { env, windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 50 && duplicate.exitCode === null; attempt++) await delay(100);
  assert.notEqual(duplicate.exitCode, null, 'Second instance should exit');
  assert.equal(child.exitCode, null, 'First instance should stay active');
  report.checks.push('single-instance');
  await connection.evaluate('localStorage.removeItem("__desktop_smoke__"); true');
  await connection.send('Network.deleteCookies', { name: '__desktop_smoke__', url: 'https://chat.deepseek.com/' });
  await closeWindow();
  report.passed = true;
  fs.writeFileSync(path.join(evidence, 'development.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(async error => {
  report.error = error.message;
  if (connection) {
    try {
      const shot = await connection.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(evidence, 'failure.png'), Buffer.from(shot.data, 'base64'));
      const env = { ...process.env, DEEPSEEK_TEST_PROFILE: profile };
      delete env.ELECTRON_RUN_AS_NODE;
      spawn(executable, [root, '--quit'], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
    } catch {}
    connection.close();
  }
  fs.writeFileSync(path.join(evidence, 'failure.json'), JSON.stringify(report, null, 2));
  console.error(error);
  if (child && child.exitCode === null) child.kill();
  process.exitCode = 1;
});
