const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildWindowsLatest } = require('./build_windows_latest_json.cjs');

test('Windows-only manifests advertise only the real signed NSIS package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-windows-manifest-'));
  const manifest = {
    version: '1.3.73', notes: '聚灵更新', pub_date: '2026-10-24T00:00:00.000Z',
    url: 'https://github.com/wu798998264-crypto/juling/releases/download/v1.3.73/Juling_1.3.73_x64-setup.exe',
    signature: 'signed-installer',
  };
  fs.writeFileSync(path.join(root, 'latest-windows-x86_64-nsis.json'), JSON.stringify(manifest));
  buildWindowsLatest(root);
  const generic = JSON.parse(fs.readFileSync(path.join(root, 'latest-windows-x86_64.json')));
  assert.deepEqual(generic, manifest);
  const merged = JSON.parse(fs.readFileSync(path.join(root, 'latest.json')));
  assert.deepEqual(Object.keys(merged.platforms).sort(), ['windows-x86_64', 'windows-x86_64-nsis']);
  assert.equal(merged.platforms['windows-x86_64-nsis'].url, manifest.url);
  assert.equal(merged.platforms['windows-x86_64'].signature, manifest.signature);
});

test('Windows aliases reject unsigned or portable-only updater entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-windows-manifest-'));
  const input = path.join(root, 'latest-windows-x86_64-nsis.json');
  fs.writeFileSync(input, JSON.stringify({version:'1.3.73', url:'https://example.com/portable.zip', signature:'x'}));
  assert.throws(() => buildWindowsLatest(root), /signed NSIS/);
  fs.writeFileSync(input, JSON.stringify({version:'1.3.73', url:'https://example.com/app_x64-setup.exe'}));
  assert.throws(() => buildWindowsLatest(root), /signed NSIS/);
});
