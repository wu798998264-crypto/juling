import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { CODEX_API_PROVIDER_PRESETS } from '../src/utils/codexProviderPresets.ts';
import { CLAUDE_API_PROVIDER_PRESETS } from '../src/utils/claudeProviderPresets.ts';
import { CLAUDE_DESKTOP_GATEWAY_PROVIDER_PRESETS } from '../src/utils/claudeDesktopProviderPresets.ts';
import { localProviderPresentation } from '../src/utils/providerPresentation.ts';
import { useAnnouncementStore } from '../src/stores/useAnnouncementStore.ts';
import { useTopRightAdStore } from '../src/stores/useTopRightAdStore.ts';
import { useSponsorStore } from '../src/stores/useSponsorStore.ts';
const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function rustFunction(path: string, name: string): string {
  const text = source(path);
  const start = text.indexOf('fn ' + name + '(');
  assert.ok(start >= 0, `${path}: missing ${name}`);
  const end = text.indexOf('\n}', start);
  assert.ok(end > start, `${path}: incomplete ${name}`);
  return text.slice(start, end + 2);
}

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
  for (const path of ['src-tauri/src/modules/announcement.rs', 'crates/juling-core/src/modules/announcement.rs']) {
    const remote = rustFunction(path, 'fetch_remote_announcements');
    assert.match(remote, /serde_json::from_str\("\{\}"\)/);
    assert.doesNotMatch(remote, /reqwest|\.send\(|\.get\(/);
    const raw = rustFunction(path, 'load_announcements_raw');
    assert.match(raw, /fetch_remote_announcements\(\)\.await/);
    assert.doesNotMatch(raw, /load_local_announcements|load_cache|try_load_force_refreshed_announcements/);
    const state = rustFunction(path, 'get_announcement_state');
    assert.match(state, /announcements:\s*Vec::new\(\)/);
    assert.match(state, /unread_ids:\s*Vec::new\(\)/);
    assert.match(state, /popup_announcement:\s*None/);
    assert.doesNotMatch(state, /load_announcements_raw|filter_announcements/);
    const ad = rustFunction(path, 'get_top_right_ad_state');
    assert.match(ad, /ad:\s*None/);
    assert.match(ad, /ads:\s*Vec::new\(\)/);
    assert.doesNotMatch(ad, /load_announcements_raw|filter_top_right/);
  }
  const nativePath = 'src-tauri/src/modules/announcement.rs';
  const sponsors = rustFunction(nativePath, 'get_sponsor_module_state');
  assert.match(sponsors, /"sponsors":\s*\[\]/);
  assert.doesNotMatch(sponsors, /load_announcements_raw|filter_sponsor_module/);
  const sync = rustFunction(nativePath, 'sync_sponsor_routes_from_announcements');
  assert.match(sync, /Ok\(Default::default\(\)\)/);
  assert.doesNotMatch(sync, /load_announcements_raw|spawn_blocking|sync_sponsor_routes\(/);
});

test('frontend refresh and forced refresh cannot restore promotional content', async () => {
  const emptyAnnouncements = { announcements: [], unreadIds: [], popupAnnouncement: null };
  for (const force of [false, true]) {
    assert.deepEqual(await useAnnouncementStore.getState().fetchState(force), emptyAnnouncements);
    assert.deepEqual(await useSponsorStore.getState().fetchState(force), useSponsorStore.getState().state);
    assert.deepEqual(useSponsorStore.getState().state.sponsorModule?.sponsors, []);
  }
  const emptyAds = { ad: null, ads: [] };
  assert.deepEqual(await useTopRightAdStore.getState().fetchState(), emptyAds);
  assert.deepEqual(await useTopRightAdStore.getState().forceRefreshState(), emptyAds);
  assert.deepEqual(await useAnnouncementStore.getState().markAsRead('legacy-promotion'), emptyAnnouncements);
  assert.deepEqual(await useAnnouncementStore.getState().markAllAsRead(), emptyAnnouncements);
});

test('all provider preset families keep neutral presentation without affiliate links', () => {
  for (const presets of [CODEX_API_PROVIDER_PRESETS, CLAUDE_API_PROVIDER_PRESETS, CLAUDE_DESKTOP_GATEWAY_PROVIDER_PRESETS]) {
    assert.ok(presets.length > 0);
    for (const preset of presets) {
      assert.notEqual(preset.isPartner, true, preset.id);
      for (const link of [preset.website, preset.apiKeyUrl].filter(Boolean)) {
        const url = new URL(link!);
        assert.ok(![...url.searchParams.keys()].some(key => /^(aff|ref|code|source|from|invite|invitation|ytag|utm_)/i.test(key)), `${preset.id}: ${link}`);
      }
      if (preset.id === 'apikey_fun') {
        assert.deepEqual(preset.baseUrls, ['']);
        assert.equal(preset.website, undefined);
        assert.equal(preset.apiKeyUrl, undefined);
      }
    }
  }
  const savedEndpoint = 'https://provider.example/v1';
  const preset = { id: 'custom-provider', name: 'User provider', baseUrls: [savedEndpoint], isPartner: true, website: 'https://provider.example/?aff=legacy' };
  const neutral = localProviderPresentation(preset);
  assert.deepEqual(neutral.baseUrls, [savedEndpoint]);
  assert.equal(neutral.website, undefined);
  assert.equal(neutral.isPartner, false);
  assert.equal(preset.isPartner, true, 'presentation must not mutate the original provider');
  assert.equal(preset.website, 'https://provider.example/?aff=legacy');
});

test('all 18 locales describe user-selected services without promotional copy or remote-download promises', () => {
  // Reviewed localized copy: user-owned API settings, no paid placement, and local/inline
  // subscription resources only. Review translations before updating these snapshots;
  // an English/Chinese keyword regex alone cannot protect all supported languages.
  const reviewed: Record<string, string> = {
    en: 'f774ca478117c8e8a4892971f093a76ef09f8faa14743a1723ecf31ba3f889ab',
    'en-US': 'f774ca478117c8e8a4892971f093a76ef09f8faa14743a1723ecf31ba3f889ab',
    'zh-CN': '2b55414cb24eeb4a49f7b2365f496781eb624d76bbb3f495a0c24f1cb262a337',
    'zh-tw': 'f52b5034a7f99265072750ffe023e3202f7eb9df1478597546b3efe501e8bbb4',
    ja: '066c998aec569a83a897172d36226a0aaf2d05bf7b48cc00b99a735cc8d125a4',
    ko: '757bd6aee00571c4f6a34f3bb92ac4bb66d68b5e43cacd22fd08c70eee945234',
    de: 'd170a0f38f3c1f088bf7bbb9dcd1ef1bff479d8cef3abace5dedc11a507b23fb',
    fr: '0b6d412f61a5a122f0eee9403b9e7deab29d46ba240f1b6518001ad8d0546d29',
    es: 'b7f37cc86464d1f2db10b26b0b4a272f818aff1e0f8b990d1d281f8f73550f0c',
    it: 'f183c6daabed7ed180d13f3498f838a0170c9b06719dba04159bf3a6baf0c909',
    'pt-br': 'abffc3c5c21c5940358350437e6c8b65f463a2a7c56555e97acff71ec82d0589',
    ru: 'a61f4747a48fbd48fc03299438e53d3b0b2369deb35db089ff370e482349802d',
    pl: 'faa6d4a7fd55a5ae2d7abb28663bbaaa8e93170af804297c1e955969859143de',
    cs: '3e669838ef64fa8f4eaad238a2049cba8f0e91d5f88eac692319fa9c0ac4155a',
    tr: '288dcb03c4529529336c851023086e053d93e3f4f2339fadb24c14604efd106b',
    vi: '1bcb6dc4ff4714a5102f640a926927f468d10c89e7ef27764dff475c0da12e02',
    id: 'ba24bfc90c1ecd62f1ac8751e0aa4b797122206d99a654b7ba46e3d168aef4bd',
    ar: '3bbbebef067a1f083bc15e0dfc6605da70128aa6158455dfeb3ff3298109bad4',
  };
  const watched = [
    'apiKeyFun.eyebrow', 'apiKeyFun.title', 'apiKeyFun.description',
    'apiKeyFun.apiKeyPlaceholder', 'apiKeyFun.queryDesc', 'apiKeyFun.toolsDesc',
    'apiKeyFun.prefill.claudeDesktopReady', 'codex.modelProviders.sponsorHint',
    'codex.proxy.catalog.pendingProviders',
  ];
  const locales = readdirSync(new URL('../src/locales/', import.meta.url))
    .filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
  assert.equal(locales.length, 18);
  assert.deepEqual(locales, Object.keys(reviewed).sort());
  const page = source('src/pages/ApiKeyFunPage.tsx');
  const activeKeys = [...page.matchAll(/['"](apiKeyFun\.[\w.]+)['"]/g)].map(match => match[1]);
  for (const locale of locales) {
    const dictionary = JSON.parse(source(`src/locales/${locale}.json`));
    const value = (key: string) => key.split('.').reduce((node, part) => node?.[part], dictionary);
    const reviewedCopy = watched.map(key => {
      const text = value(key);
      assert.equal(typeof text, 'string', `${locale}: missing ${key}`);
      assert.ok(text.trim().length > 0, `${locale}: empty ${key}`);
      return text;
    });
    assert.equal(createHash('sha256').update(JSON.stringify(reviewedCopy)).digest('hex'), reviewed[locale], `${locale}: review changed user-facing API copy`);
    for (const key of activeKeys) {
      const text = value(key);
      if (typeof text !== 'string') continue; // Missing optional keys use the page's local fallback.
      assert.doesNotMatch(text, /https?:\/\/|apikey\.(?:fan|fun)|roxybrowser|[?&](?:aff|ref|invite|utm_[^=]*)=|discount|partner|exclusive|折扣|優惠|优惠|合作/i, `${locale}: ${key}`);
    }
    assert.match(value('codex.proxy.catalog.pendingProviders'), /\{\{count\}\}/);
  }
  assert.doesNotMatch(page, /t\('apiKeyFun\.(?:title|apiKeyPlaceholder)'[^\n]*JIULING\.FUN/);
});

test('upstream date-based campaigns cannot bypass offline announcement policy', async () => {
  for (const path of ['src/components/layout/SideNav.tsx', 'src/pages/ApiKeyFunPage.tsx', 'src/components/AnnouncementCenter.tsx']) {
    assert.doesNotMatch(source(path), /useApiKeyFunCampaign|ApiKeyFunPromotionHeader|SideNavCampaign\.css/);
  }
  const moduleUrl = new URL('../src/utils/apiKeyFunCampaign.ts', import.meta.url);
  // Older Juling versions do not contain this upstream promotional module.
  if (!existsSync(moduleUrl)) return;
  const { APIKEY_FUN_CAMPAIGN, isApiKeyFunCampaignActive } = await import(moduleUrl.href);
  assert.equal(APIKEY_FUN_CAMPAIGN.url, '');
  for (const time of [0, Date.parse(APIKEY_FUN_CAMPAIGN.startsAt), Date.parse('2026-11-05T12:00:00+08:00'), Date.parse(APIKEY_FUN_CAMPAIGN.expiresAt), Date.now()]) {
    assert.equal(isApiKeyFunCampaignActive(time), false, `campaign must remain disabled at ${time}`);
  }
});

test('legacy profile compatibility and saved provider endpoints are protected', () => {
  assert.match(source('crates/juling-core/src/modules/data_paths.rs'), /LEGACY_DATA_DIR: &str = "\.antigravity_cockpit"/);
  for (const [path, name] of [
    ['src-tauri/src/modules/codex_account_provider.rs', 'migrate_apikey_fun_account'],
    ['src-tauri/src/modules/claude_account_core_storage.rs', 'migrate_legacy_apikey_fun_urls'],
  ]) {
    const body = rustFunction(path, name);
    assert.match(body, /let _ = account;\s*false/);
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
