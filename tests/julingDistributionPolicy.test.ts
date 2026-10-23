import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Juling updater and visible author point only to the independent repository', () => {
  const config = JSON.parse(source('src-tauri/tauri.conf.json'));
  assert.equal(config.productName, '聚灵');
  assert.equal(config.identifier, 'com.wu798998264.juling');
  for (const endpoint of config.plugins.updater.endpoints) {
    assert.ok(endpoint.startsWith('https://github.com/wu798998264-crypto/juling/'));
  }
  assert.match(source('src/pages/SettingsPageView.tsx'), /github\.com\/wu798998264-crypto/);
});

test('Rust promotional refresh and route rewrite entry points stay offline', () => {
  const text = source('src-tauri/src/modules/announcement.rs');
  const remote = text.slice(text.indexOf('async fn fetch_remote_announcements()'), text.indexOf('fn should_force_refresh_for_version'));
  assert.doesNotMatch(remote, /reqwest|\.send\(|\.get\(/);
  const sync = text.slice(text.indexOf('pub async fn sync_sponsor_routes_from_announcements'), text.indexOf('pub async fn force_refresh_sponsor_module'));
  assert.match(sync, /Ok\(Default::default\(\)\)/);
  assert.doesNotMatch(sync, /load_announcements_raw|spawn_blocking|sync_sponsor_routes\(/);
});

test('legacy profile compatibility and saved provider endpoints are protected', () => {
  assert.match(source('crates/juling-core/src/modules/data_paths.rs'), /LEGACY_DATA_DIR: &str = "\.antigravity_cockpit"/);
  for (const [path, name] of [
    ['src-tauri/src/modules/codex_account_provider.rs', 'migrate_apikey_fun_account'],
    ['src-tauri/src/modules/claude_account_core_storage.rs', 'migrate_legacy_apikey_fun_urls'],
  ]) {
    const text = source(path);
    const start = text.indexOf('fn ' + name + '(');
    const body = text.slice(start, text.indexOf('\n}', start));
    assert.match(body, /false/);
    assert.doesNotMatch(body, /account\.[\w.]+\s*=/);
  }
});

test('diagnostics are opt-in and cannot inherit another application telemetry DSN', () => {
  const config = source('src-tauri/src/modules/config.rs');
  assert.match(config, /fn default_diagnostics_error_reporting_enabled\(\) -> bool \{\s*false\s*\}/);
  const diagnostics = source('src-tauri/src/modules/diagnostics.rs');
  assert.doesNotMatch(diagnostics, /(?:var|option_env!)\("SENTRY_DSN"\)/);
  assert.match(diagnostics, /JULING_SENTRY_DSN/);
});

test('isolated desktop smoke setup retains every plugin read by frontend startup', () => {
  const text = source('src-tauri/src/lib.rs');
  const start = text.indexOf('if std::env::var("JULING_TOOLS_SMOKE_TEST")');
  const end = text.indexOf('return Ok(());', start);
  assert.ok(start > 0 && end > start);
  const smoke = text.slice(start, end);
  for (const plugin of ['tauri_plugin_autostart::init', 'tauri_plugin_process::init', 'tauri_plugin_updater::Builder']) {
    assert.ok(smoke.includes(plugin), plugin);
  }
  assert.match(smoke, /JULING_TOOLS_DATA_DIR/);
});

test('external extension identity remains compatible without being a branding replacement', () => {
  for (const path of ['src-tauri/src/modules/import.rs', 'crates/juling-core/src/modules/import.rs']) {
    assert.match(source(path), /"jlcodes\.antigravity-cockpit"/);
    assert.match(source(path), /"jlcodes99\.antigravity-cockpit"/);
  }
});
