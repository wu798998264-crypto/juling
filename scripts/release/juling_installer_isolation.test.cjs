const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Juling installation never removes another product shortcut', () => {
  const hooks = fs.readFileSync(path.join(__dirname, '../../src-tauri/windows/nsis/installer-hooks.nsh'), 'utf8');
  assert.doesNotMatch(hooks, /^\s*Delete\s+.*(?:Cockpit|Antigravity)/im);
});

test('Juling uses only its own updater repository', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src-tauri/tauri.conf.json'), 'utf8'));
  assert.equal(config.identifier, 'com.wu798998264.juling');
  for (const endpoint of config.plugins.updater.endpoints) {
    assert.ok(endpoint.startsWith('https://github.com/wu798998264-crypto/juling/releases/'));
  }
});
