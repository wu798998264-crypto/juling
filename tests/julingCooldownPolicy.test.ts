import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const { expectedTests, verifyCoverage, verifyOutput } = createRequire(import.meta.url)('../scripts/check_juling_cooldown.cjs') as {
  expectedTests: { file: string; name: string }[];
  verifyCoverage: () => void;
  verifyOutput: (output: string) => void;
};

test('Juling cooldown safety regressions and their Rust module remain present', () => {
  assert.equal(expectedTests.length, 3);
  verifyCoverage();
  assert.match(source('src-tauri/src/modules/codex_native_api/context_rebuild_http_tests.rs'), /#\[path\s*=\s*"context_rebuild_cooling_tests\.rs"\]/);
  assert.match(source('src-tauri/src/modules/codex_native_api/mod.rs'), /mod context_rebuild_http_tests;/);
});

test('cooldown gate rejects zero, partial, ignored and failed test execution', () => {
  const lines = expectedTests.map(({ name }) => `test modules::tests::${name} ... ok`);
  verifyOutput(lines.join('\n'));
  verifyOutput(lines.join('\r\n') + '\r\n');
  assert.throws(() => verifyOutput('test result: ok. 0 passed; 0 failed;'));
  assert.throws(() => verifyOutput(lines.slice(1).join('\n')));
  for (const outcome of ['ignored', 'FAILED']) {
    assert.throws(() => verifyOutput([lines[0].replace(/ok$/, outcome), ...lines.slice(1)].join('\n')));
  }
});

test('upstream updates retain cooldown gates in build and release workflows', () => {
  assert.equal(JSON.parse(source('package.json')).scripts['test:juling-cooldown'], 'node scripts/check_juling_cooldown.cjs');
  for (const workflow of ['build-matrix', 'release']) {
    assert.match(source(`.github/workflows/${workflow}.yml`), /^\s+run: npm run test:juling-cooldown\s*$/m);
  }
  const release = source('.github/workflows/release.yml');
  const windows = release.slice(release.indexOf('\n  build-windows:'), release.indexOf('\n  build-macos-aarch64:'));
  assert.match(windows, /run: npm run test:juling-cooldown/);
  assert.ok(windows.indexOf('run: npm run test:juling-cooldown') < windows.indexOf('npx tauri build --ci'));
  const finalize = release.slice(release.indexOf('\n  finalize-legacy-latest:'), release.indexOf('\n  upload-checksums:'));
  assert.match(finalize, /^\s+- build-windows\s*$/m);
});

test('Windows library regressions get Common Controls without duplicate Tauri manifests', () => {
  const build = source('src-tauri/build.rs');
  assert.match(build, /target\.ends_with\("-windows-msvc"\)/);
  assert.match(build, /WindowsAttributes::new_without_app_manifest\(\)/);
  assert.match(build, /cargo:rustc-link-arg=\/MANIFEST:EMBED/);
  assert.match(build, /cargo:rustc-link-arg=\/MANIFESTDEPENDENCY:.*Microsoft\.Windows\.Common-Controls.*version='6\.0\.0\.0'/);
  assert.match(build, /tauri_build::try_build\(attributes\)/);
});
