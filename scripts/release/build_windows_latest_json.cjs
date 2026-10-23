#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function buildWindowsLatest(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'latest-windows-x86_64-nsis.json'), 'utf8'));
  if (!manifest.version || !manifest.signature || !/^https:\/\/.+_x64-setup\.exe$/.test(manifest.url || '')) {
    throw new Error('A signed NSIS updater manifest is required');
  }
  const { version, notes, pub_date, url, signature } = manifest;
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
  write('latest-windows-x86_64.json', manifest);
  write('latest.json', {
    version, notes, pub_date,
    platforms: {
      'windows-x86_64': { url, signature },
      'windows-x86_64-nsis': { url, signature },
    },
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
