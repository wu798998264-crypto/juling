import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadHookModule, settlePromises } from '../../tests/helpers/reactHookHarness';

function content(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(content).join(' ');
  return content(node.props?.children);
}

const noRemoteRequest = () => assert.fail('Default update UI must not request remote release notes');
const imports = {
  '../hooks/useRemoteReleaseData': { useRemoteReleaseNotes: noRemoteRequest, useRemoteReleaseHistory: noRemoteRequest },
  'react-i18next': { useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) },
  '../hooks/useEscClose': { useEscClose() {} },
  '../utils/updaterReleaseNotes': { prependUpdaterReleaseHighlights: (_version: string, notes: string) => notes },
  '@tauri-apps/plugin-opener': { openUrl() {} },
};

test('default update dialog uses supplied notes and never calls the retained remote APIs', () => {
  const h = loadHookModule(new URL('./UpdateNotification.tsx', import.meta.url), {
    ...imports,
    '@tauri-apps/api/core': { invoke: noRemoteRequest },
  });
  let visible = true;
  let view = h.render(() => h.exports.UpdateNotification({
    updateInfo: { latest_version: '1.3.78', current_version: '1.3.76', download_url: '', release_notes: '### Added\n- Supplied updater notes', release_notes_zh: '' },
    visible, onClose() {},
  }));
  assert.match(content(view), /Supplied updater notes/);
  visible = false; h.flush();
  visible = true; view = h.flush();
  assert.match(content(view), /Supplied updater notes/);
  h.unmount();
});

test('default post-update dialog does not fall back to remote APIs when local reads fail', async () => {
  const calls: string[] = [];
  const h = loadHookModule(new URL('./VersionJumpNotification.tsx', import.meta.url), {
    ...imports,
    '@tauri-apps/api/core': { invoke(command: string) {
      calls.push(command);
      assert.ok(['get_bundled_release_notes', 'get_pending_release_notes'].includes(command));
      return Promise.reject(new Error('Local notes unavailable'));
    } },
  }, { window: {}, performance: { now: () => 0 }, console: { log() {}, error() {} } });
  h.render(() => h.exports.VersionJumpNotification({ info: { previous_version: '1.3.76', current_version: '1.3.78' }, onClose() {} }));
  await settlePromises();
  assert.match(content(h.flush()), /1\.3\.78/);
  assert.deepEqual(calls, ['get_bundled_release_notes', 'get_pending_release_notes']);
  h.unmount();
});

test('retained explicit remote service still invokes distinct registered compatibility commands', async () => {
  const calls: { command: string; args: unknown }[] = [];
  const h = loadHookModule(new URL('../services/releaseNotesService.ts', import.meta.url), {
    '@tauri-apps/api/core': { invoke(command: string, args: unknown) {
      calls.push({ command, args });
      return Promise.resolve(command === 'get_release_notes' ? { release_notes: '', release_notes_zh: '' } : []);
    } },
  });
  await h.exports.fetchReleaseNotes('1.3.78');
  await h.exports.fetchReleaseHistory('zh-CN');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { command: 'get_release_notes', args: { version: '1.3.78' } },
    { command: 'get_remote_release_history', args: { locale: 'zh-CN', limit: 30 } },
  ]);
  const source = (path: string) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  const lib = source('src-tauri/src/lib.rs');
  const commands = source('src-tauri/src/commands/update.rs');
  for (const name of ['get_release_notes', 'get_remote_release_history']) {
    assert.ok(lib.includes(`commands::update::${name},`));
    assert.ok(commands.includes(`update_checker::${name}(`));
  }
  assert.match(commands, /update_checker::get_local_release_history/);
  assert.match(source('src-tauri/src/modules/update_checker.rs'), /mod remote;/);
  const remote = source('src-tauri/src/modules/update_checker_remote.rs');
  assert.match(remote, /https:\/\/api\.github\.com\/repos\/wu798998264-crypto\/juling\/releases/);
  assert.doesNotMatch(remote, /jlcodes99\/cockpit-tools/);
  assert.match(remote, /external_network_enabled/);
});
