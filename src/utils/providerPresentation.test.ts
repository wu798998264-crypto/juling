import assert from 'node:assert/strict';
import test from 'node:test';
import { localProviderPresentation } from './providerPresentation.ts';

test('partner protocol capabilities are retained without paid-placement links', () => {
  const original = {id:'relay', name:'Relay', baseUrls:['https://relay.example/v1'], isPartner:true, website:'https://relay.example/?aff=x', apiKeyUrl:'https://relay.example/invite/x', modelCatalog:['a']};
  const result = localProviderPresentation(original);
  assert.deepEqual(result.baseUrls, original.baseUrls);
  assert.deepEqual(result.modelCatalog, ['a']);
  assert.equal(result.isPartner, false);
  assert.equal(result.website, undefined);
  assert.equal(result.apiKeyUrl, undefined);
  assert.equal(original.isPartner, true);
});

test('unpaid links lose affiliate identifiers and old sponsored default is manual', () => {
  const result = localProviderPresentation({id:'apikey_fun', name:'JIULING.FUN', baseUrls:['https://api.apikey.fan'], website:'https://example.com/keys?aff=x&utm_source=y'});
  assert.deepEqual(result.baseUrls, ['']);
  assert.equal(result.name, '自定义中转');
  assert.equal(result.website, 'https://example.com/keys');
});
