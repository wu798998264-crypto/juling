import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('1.3.75 metadata is consistent without changing Juling update trust or identity', () => {
  const pkg = JSON.parse(source('package.json'));
  const lock = JSON.parse(source('package-lock.json'));
  const config = JSON.parse(source('src-tauri/tauri.conf.json'));
  assert.equal(pkg.version, '1.3.75');
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
  assert.match(source('src-tauri/src/modules/codex_local_access_sidecar_config.rs'), /collection\.session_identity_mapping_enabled/);
});
