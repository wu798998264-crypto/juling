import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLocalRelayUrl } from './localRelayConfig.ts';
import { LOCAL_RELAY_STATE, useSponsorStore } from '../stores/useSponsorStore.ts';
import { APIKEY_FUN_FAMILIES, buildApiKeyFunClientPreview } from './apikeyFunClientConfigs.ts';

test('relay requires an explicit HTTP(S) endpoint and preserves the user host/path', () => {
  assert.equal(normalizeLocalRelayUrl(''), '');
  assert.equal(normalizeLocalRelayUrl(' https://relay.example.com/custom/v1/ '), 'https://relay.example.com/custom/v1');
  assert.equal(normalizeLocalRelayUrl('http://127.0.0.1:8123/v1'), 'http://127.0.0.1:8123/v1');
  for (const input of ['file:///secret', 'https://user:pass@example.com', 'https://example.com/?aff=x', 'https://example.com/#x']) {
    assert.equal(normalizeLocalRelayUrl(input), '');
  }
});

test('local relay initialization and forced refresh cannot load ads or rewrite routes', async () => {
  assert.deepEqual(LOCAL_RELAY_STATE.sponsorModule?.sponsors, []);
  assert.equal(await useSponsorStore.getState().fetchState(true), LOCAL_RELAY_STATE);
  assert.equal(useSponsorStore.getState().initialized, true);
});

test('client configuration previews use the confirmed endpoint for every client', () => {
  const family = APIKEY_FUN_FAMILIES.find(item => item.id === 'codex')!;
  for (const client of ['codex_app', 'codex_cli', 'claude_code', 'claude_desktop'] as const) {
    const preview = buildApiKeyFunClientPreview({family, client, apiKey:'sk-test', model:'gpt-test', platform:'windows', baseUrl:'https://owned.example/custom/v1'});
    const text = preview.blocks.map(block => block.text).join('\n');
    assert.match(text, /https:\/\/owned\.example\/custom/);
    assert.doesNotMatch(text, /apikey\.(fan|fun)|relay\.example\.com/);
  }
});
