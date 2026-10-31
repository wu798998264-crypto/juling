const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildWindowsPortableArchive, collectPortableFiles, createZip } = require('./build_windows_portable.cjs');

test('builds a portable archive with the executable, resources and loader DLL', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-portable-'));
  const releaseDir = path.join(root, 'release');
  const outputDir = path.join(root, 'output');
  fs.mkdirSync(path.join(releaseDir, 'resources', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(releaseDir, 'juling_tools.exe'), 'exe');
  fs.writeFileSync(path.join(releaseDir, 'WebView2Loader.dll'), 'dll');
  fs.writeFileSync(path.join(releaseDir, 'juling-cliproxy.exe'), 'retired Go engine');
  fs.writeFileSync(path.join(releaseDir, 'resources', 'sidecar.exe'), 'sidecar');
  fs.writeFileSync(path.join(releaseDir, 'resources', 'scripts', 'helper.cjs'), 'helper');

  assert.deepEqual(
    collectPortableFiles({
      releaseDir,
      executablePath: path.join(releaseDir, 'juling_tools.exe'),
    }).map((file) => file.archivePath),
    ['juling_tools.exe', 'resources/scripts/helper.cjs', 'resources/sidecar.exe', 'WebView2Loader.dll'],
  );

  const archivePath = buildWindowsPortableArchive({
    releaseDir,
    outputDir,
    version: '1.2.3',
  });
  assert.equal(path.basename(archivePath), 'Juling_1.2.3_x64-portable.zip');
  const archive = fs.readFileSync(archivePath).toString('latin1');
  assert.match(archive, /Juling_1\.2\.3_x64-portable\/juling_tools\.exe/);
  assert.match(archive, /Juling_1\.2\.3_x64-portable\/resources\/sidecar\.exe/);
  assert.match(archive, /Juling_1\.2\.3_x64-portable\/README\.txt/);
});

test('portable keeps mapped resources and excludes the retired Go proxy', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-resource-layout-'));
  fs.mkdirSync(path.join(root, 'native-menu-icons'), {recursive:true});
  fs.mkdirSync(path.join(root, 'scripts'), {recursive:true});
  for (const name of ['juling.exe', 'juling-cliproxy.exe', 'native-menu-icons/codex.svg', 'scripts/claude-desktop-auth-helper.cjs']) {
    fs.writeFileSync(path.join(root, name), 'test');
  }
  const files = collectPortableFiles({releaseDir:root, executablePath:path.join(root,'juling.exe')});
  assert.deepEqual(files.map(file=>file.archivePath), [
    'juling.exe', 'native-menu-icons/codex.svg', 'scripts/claude-desktop-auth-helper.cjs',
  ]);
});

test('portable includes attribution and upgrade notes without obsolete sidecars', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-notices-'));
  fs.mkdirSync(path.join(root, 'licenses'), { recursive: true });
  for (const name of ['聚灵.exe', 'juling-cliproxy.exe', 'NOTICE.txt', '升级说明.md', 'licenses/CLIProxyAPI-LICENSE.txt', 'cockpit-cliproxy.exe']) {
    fs.writeFileSync(path.join(root, name), 'test');
  }
  const names = collectPortableFiles({ releaseDir: root, executablePath: path.join(root, '聚灵.exe') }).map(file => file.archivePath);
  for (const expected of ['聚灵.exe', 'NOTICE.txt', '升级说明.md', 'licenses/CLIProxyAPI-LICENSE.txt']) assert.ok(names.includes(expected));
  assert.ok(!names.includes('cockpit-cliproxy.exe'));
  assert.ok(!names.includes('juling-cliproxy.exe'));
});

test('ZIP marks Chinese filenames as UTF-8 in both headers', () => {
  const zip = createZip([{ archivePath: '聚灵.exe', content: Buffer.from('exe') }]);
  assert.equal(zip.readUInt16LE(6) & 0x0800, 0x0800);
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central > 0);
  assert.equal(zip.readUInt16LE(central + 8) & 0x0800, 0x0800);
  assert.ok(zip.includes(Buffer.from('聚灵.exe', 'utf8')));
});
