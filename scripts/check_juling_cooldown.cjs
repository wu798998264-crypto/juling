#!/usr/bin/env node
'use strict';

// Local safety policy, deliberately separate from the frozen parity22 baseline.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const expectedTests = [
  { file: 'src-tauri/src/modules/codex_native_api/server.rs', name: 'juling_cooldown_retry_compression_uses_renewed_budget' },
  { file: 'src-tauri/src/modules/codex_native_api/context_rebuild_cooling_tests.rs', name: 'juling_cooldown_complete_history_switches_account_without_replaying_tools' },
  { file: 'src-tauri/src/modules/codex_native_api/context_rebuild_cooling_tests.rs', name: 'juling_cooldown_incomplete_history_preserves_owner_and_reports_recovery' },
];

function verifyCoverage() {
  if (!expectedTests.length || new Set(expectedTests.map(test => test.name)).size !== expectedTests.length) {
    throw new Error('Cooldown safety coverage must be nonempty and unique');
  }
  for (const test of expectedTests) {
    if (!/^juling_cooldown_\w+$/.test(test.name)
        || !new RegExp(`\\bfn\\s+${test.name}\\s*\\(`).test(fs.readFileSync(path.join(root, test.file), 'utf8'))) {
      throw new Error(`Cooldown regression is missing: ${test.name}`);
    }
  }
}

function verifyOutput(output) {
  for (const { name } of expectedTests) {
    if (!new RegExp(`^test [\\w:]+::${name} \\.\\.\\. ok\\r?$`, 'm').test(output)) {
      throw new Error(`Cooldown regression did not execute successfully: ${name}`);
    }
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check-only')) throw new Error('Only --check-only is supported');
    verifyCoverage();
    console.log(`Checked ${expectedTests.length} required cooldown regressions.`);
    if (!args.includes('--check-only')) {
      const result = spawnSync('cargo', ['test', '--locked', '--color', 'never', '--manifest-path', 'src-tauri/Cargo.toml',
        '--lib', 'juling_cooldown_', '--', '--test-threads=1'], {
        cwd: root, encoding: 'utf8', shell: false, env: { ...process.env, CARGO_TERM_COLOR: 'never' },
        // A cold Windows build also links the full desktop test binary.
        timeout: 45 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
      });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`cargo test failed (${result.status ?? result.signal})`);
      verifyOutput(result.stdout);
      console.log('All required cooldown safety regressions passed.');
    }
  } catch (error) {
    console.error(`Cooldown safety verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { expectedTests, verifyCoverage, verifyOutput };
