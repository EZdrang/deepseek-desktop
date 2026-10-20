'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeepSeekURL, isExternalURL } = require('../navigation.cjs');
test('only HTTPS DeepSeek origins stay inside the desktop window', () => {
  for (const value of ['https://chat.deepseek.com/', 'https://accounts.deepseek.com/login', 'https://deepseek.com/']) {
    assert.equal(isDeepSeekURL(value), true, value);
  }
  for (const value of ['http://chat.deepseek.com/', 'https://chat.deepseek.com.evil.test/',
    'https://evil-deepseek.com/', 'https://deepseek.com@evil.test/', 'https://deepseek.com:8443/',
    'https://user:secret@deepseek.com/', 'file:///C:/Windows/system.ini', 'javascript:alert(1)', 'bad URL']) {
    assert.equal(isDeepSeekURL(value), false, value);
  }
});
test('external links cannot launch local files or custom protocols', () => {
  assert.equal(isExternalURL('https://example.com/readme'), true);
  for (const value of ['file:///C:/Windows/notepad.exe', 'cmd:echo hello', 'javascript:alert(1)',
    'http://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://user:secret@example.com/']) {
    assert.equal(isExternalURL(value), false, value);
  }
});
