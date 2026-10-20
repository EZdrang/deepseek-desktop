'use strict';
const HOME_URL = 'https://chat.deepseek.com/';
function isDeepSeekURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      (url.hostname === 'deepseek.com' || url.hostname.endsWith('.deepseek.com'));
  } catch { return false; }
}
function isExternalURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
module.exports = { HOME_URL, isDeepSeekURL, isExternalURL };
