import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CODEX_API_PROVIDER_PRESETS } from '../src/utils/codexProviderPresets.ts';
import { localProviderPresentation } from '../src/utils/providerPresentation.ts';
import { resolveCodexAccountCardSkin } from '../src/utils/codexAccountCardSkin.ts';

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('1.3.76 metadata is consistent without changing Juling update trust or identity', () => {
  const pkg = JSON.parse(source('package.json'));
  const lock = JSON.parse(source('package-lock.json'));
  const config = JSON.parse(source('src-tauri/tauri.conf.json'));
  assert.equal(pkg.version, '1.3.76');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(config.version, pkg.version);
  assert.equal(config.mainBinaryName, '聚灵');
  assert.equal(config.identifier, 'com.wu798998264.juling');
  assert.deepEqual(config.plugins.updater.endpoints, [
    'https://github.com/wu798998264-crypto/juling/releases/latest/download/latest-{{target}}.json',
    'https://github.com/wu798998264-crypto/juling/releases/latest/download/latest.json',
  ]);
  assert.equal(config.plugins.updater.pubkey, 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDMwNEE4RDcwRDkyMzREMwpSV1RUTkpJTjE2Z0VBOXFuMXBDd3BIVDRZMjlzY3Y4MDRaajR5Z3JvRW5zSXhVZXdnYXd1Wk95MAo=');
});

test('new release keeps neutral provider presentation and a single Juling card skin', () => {
  for (const preset of CODEX_API_PROVIDER_PRESETS) {
    assert.notEqual(preset.isPartner, true);
    for (const link of [preset.website, preset.apiKeyUrl].filter(Boolean)) {
      const url = new URL(link!);
      assert.ok(![...url.searchParams.keys()].some(key => /^(aff|ref|invite|utm_)/i.test(key)));
      assert.doesNotMatch(url.hostname, /jlcodes99|roxybrowser/);
    }
  }
  const retired = localProviderPresentation({ id: 'apikey_fun', name: 'Promoted provider', baseUrls: ['https://api.apikey.fan/v1'], isPartner: true, website: 'https://apikey.fan/?aff=old' });
  assert.equal(retired.website, undefined);
  assert.equal(retired.isPartner, false);
  assert.deepEqual(retired.baseUrls, ['']);
  for (const endpoint of ['https://api.apikey.fan/v1', 'https://yunmoor.example/v1', 'http://127.0.0.1:7785/v1']) assert.equal(resolveCodexAccountCardSkin(endpoint), 'codex-card-skin-juling');
  assert.doesNotMatch(source('src/pages/useCodexAccountsRenderers.tsx'), /"APIKEY\.FUN"|codex-card-skin-apikey-fun/);
});

test('Rust-only packaging retains the third-party license and visible S1.0.1 identity', () => {
  const config = JSON.parse(source('src-tauri/tauri.conf.json'));
  assert.equal(config.bundle.externalBin, undefined);
  assert.ok(Object.keys(config.bundle.resources).every(path => !path.includes('juling-cliproxy')));
  assert.equal(config.bundle.resources['../resources/codex/LICENSE.CLIProxyAPI'], 'licenses/CLIProxyAPI-LICENSE.txt');
  assert.doesNotMatch(source('src-tauri/build.rs'), /Command::new\("go"\)|fn build_go_sidecar/);
  assert.match(source('src/pages/SettingsPageView.tsx'), />S1\.0\.1</);
  assert.match(source('src-tauri/src/modules/update_checker_remote.rs'), /api\.github\.com\/repos\/wu798998264-crypto\/juling\/releases/);
});

test('native and core OAuth upgrades retain own credentials and bounded refresh behavior', () => {
  for (const path of ['src-tauri/src/modules/oauth.rs', 'crates/juling-core/src/modules/oauth.rs']) {
    const text = source(path);
    assert.match(text, /JULING_ANTIGRAVITY_GOOGLE_CLIENT_ID/);
    assert.match(text, /JULING_ANTIGRAVITY_GOOGLE_CLIENT_SECRET/);
    assert.match(text, /TOKEN_REFRESH_SKEW_SECONDS: i64 = 900/);
    assert.match(text, /include_granted_scopes/);
    assert.match(text, /for attempt in 0\.\.2/);
    assert.doesNotMatch(text, /const CLIENT_SECRET: &str =/);
  }
});

test('new history repair and session mapping reach both frontend and backend', () => {
  assert.match(source('src/components/codex/CodexSessionVisibilityRepairModal.tsx'), /history/);
  assert.match(source('src-tauri/src/modules/codex_session_visibility_repair_api.rs'), /require_stopped_instances: true/);
  assert.match(source('src-tauri/src/modules/codex_session_visibility_repair_api.rs'), /repair_history_projections_for_instances/);
  assert.match(source('src-tauri/src/models/codex_local_access.rs'), /session_identity_mapping_enabled/);
  assert.match(source('src/pages/CodexApiServiceView.tsx'), /CodexSessionIdentityMappingControl/);
  assert.match(source('src/components/CodexLocalAccessModal.tsx'), /CodexSessionIdentityMappingControl/);
  assert.match(source('src-tauri/src/modules/codex_native_api/identity.rs'), /context\.session_identity_mapping_enabled/);
});
