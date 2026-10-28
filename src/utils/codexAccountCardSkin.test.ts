import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveCodexAccountCardSkin } from './codexAccountCardSkin';

test('API endpoint skin stays provider-neutral without rewriting the supplied address', () => {
  for (const endpoint of [
    'https://example.com/v1',
    'http://127.0.0.1:8888/v1',
    'https://apikey.fun/v1',
    'https://ai.ahzm.top/v1',
    'https://yunmoor.com/v1',
  ]) {
    assert.equal(resolveCodexAccountCardSkin(endpoint), 'codex-card-skin-juling');
    assert.equal(new URL(endpoint).href, endpoint);
  }
});

test('invalid or non-HTTP addresses never activate endpoint decoration', () => {
  for (const endpoint of [undefined, null, '', ' ', 'not a url', 'file:///tmp/picture', 'javascript:alert(1)']) {
    assert.equal(resolveCodexAccountCardSkin(endpoint), '');
  }
});

test('card decoration cannot reintroduce provider advertisements or cover card actions', () => {
  const css = readFileSync('src/styles/pages/codex-account-card-skins.css', 'utf8');
  assert.doesNotMatch(css, /apikey|yunmoor|ahzm|https?:\/\/|url\(|pointer-events|::before|::after/i);
  assert.match(css, /codex-card-skin-juling/);
});
