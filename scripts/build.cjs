'use strict';
// Windows scanners can briefly lock a newly copied PE while its resources are edited.
// Retry only that operation; preserve the ASAR integrity resource and all other checks.
const integrity = require('app-builder-lib/out/electron/electronWin');
const original = integrity.addWinAsarIntegrity;
integrity.addWinAsarIntegrity = async (...args) => {
  for (let attempt = 0; ; attempt++) {
    try { return await original(...args); }
    catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || attempt >= 20) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};
const { build, Platform, Arch } = require('electron-builder');
build({
  targets: Platform.WINDOWS.createTarget(process.argv.includes('--dir') ? ['dir'] : ['nsis'], Arch.x64),
  publish: 'never'
}).catch(error => { console.error(error); process.exitCode = 1; });
