#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validatePlatformEntry } = require('./verify_published_updater_manifests.cjs');

function buildWindowsLatest(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'latest-windows-x86_64-nsis.json'), 'utf8'));
  if (!manifest.version || !manifest.signature || !/^https:\/\/.+_x64-setup\.exe$/.test(manifest.url || '')) {
    throw new Error('A signed NSIS updater manifest is required');
  }
  const { version, notes, pub_date, url, signature } = manifest;
  const platforms = {
    'windows-x86_64': { url, signature },
    'windows-x86_64-nsis': { url, signature },
  };
  const msiPath = path.join(directory, 'latest-windows-x86_64-msi.json');
  if (fs.existsSync(msiPath)) {
    const msi = JSON.parse(fs.readFileSync(msiPath, 'utf8'));
    try {
      if (msi.version !== version) throw new Error('version mismatch');
      validatePlatformEntry(msi, 'windows-x86_64-msi', new URL('.', url).href, 'Windows MSI');
    } catch {
      throw new Error('A signed MSI updater manifest from the same release is required');
    }
    platforms['windows-x86_64-msi'] = { url: msi.url, signature: msi.signature };
  }
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
  write('latest-windows-x86_64.json', manifest);
  write('latest.json', {
    version, notes, pub_date,
    platforms,
  });
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Usage: build_windows_latest_json.cjs <manifest-directory>');
    buildWindowsLatest(path.resolve(process.argv[2]));
    console.log('Windows updater aliases and latest.json generated.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { buildWindowsLatest };
