const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { verifySignature, validateProvenance, validateIdentity } = require('./macos-artifact-package.cjs');

test('updater verification rejects tampered data, key identity and trusted comments', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = crypto.randomBytes(8);
  const rawKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const key = Buffer.from(`untrusted comment: test\n${Buffer.concat([Buffer.from('Ed'), keyId, rawKey]).toString('base64')}\n`).toString('base64');
  const data = Buffer.from('signed application archive');
  for (const algorithm of ['Ed', 'ED']) {
    const message = algorithm === 'ED' ? crypto.createHash('blake2b512').update(data).digest() : data;
    const signature = crypto.sign(null, message, privateKey);
    const comment = 'timestamp:123';
    const commentSig = crypto.sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey);
    const raw = ['untrusted comment: test', Buffer.concat([Buffer.from(algorithm), keyId, signature]).toString('base64'),
      `trusted comment: ${comment}`, commentSig.toString('base64')].join('\n');
    const encoded = Buffer.from(raw).toString('base64');
    verifySignature(data, encoded, key);
    assert.throws(() => verifySignature(Buffer.from('tampered archive'), encoded, key), /Invalid updater signature/);
    assert.throws(() => verifySignature(data, Buffer.from(raw.replace('timestamp:123', 'timestamp:456')).toString('base64'), key), /trusted comment/);
    const wrongKey = Buffer.from(`untrusted comment: test\n${Buffer.concat([Buffer.from('Ed'), crypto.randomBytes(8), rawKey]).toString('base64')}\n`).toString('base64');
    assert.throws(() => verifySignature(data, encoded, wrongKey), /key ID mismatch/);
  }
});

function provenance() {
  const sha = 'a'.repeat(40), repo = 'owner/juling', artifactName = 'bundles-macos-aarch64';
  return { sha, repo, artifactName,
    run: { head_sha: sha, head_repository: { full_name: repo }, path: '.github/workflows/build-matrix.yml', event: 'push', conclusion: 'success' },
    jobs: ['macos-aarch64', 'macos-x86_64', 'macos-universal', 'ubuntu-22.04', 'windows-latest'].map(label => ({
      name: `🏗️ Build: ${label}`, conclusion: 'success', steps: [
        '🏗️ Build app (Signed)', '🧪 Test native Rust regressions', '🛡️ Test Juling cooldown safety',
      ].map(name => ({ name, conclusion: 'success' })),
    })),
    artifact: { name: artifactName, expired: false, workflow_run: { head_sha: sha }, digest: `sha256:${'b'.repeat(64)}` },
  };
}

test('Mac packaging rejects a different commit, PR build, expired artifact and missing safety gate', () => {
  validateProvenance(provenance());
  const different = provenance(); different.run.head_sha = 'c'.repeat(40);
  assert.throws(() => validateProvenance(different), /release tag/);
  const pr = provenance(); pr.run.event = 'pull_request';
  assert.throws(() => validateProvenance(pr), /Untrusted build event/);
  const expired = provenance(); expired.artifact.expired = true;
  assert.throws(() => validateProvenance(expired));
  const gate = provenance(); gate.jobs[3].steps[2].conclusion = 'skipped';
  assert.throws(() => validateProvenance(gate), /Safety gate/);
});

test('Mac identity checks reject the upstream bundle, wrong version and incomplete universal binary', () => {
  const config = { identifier: 'com.wu798998264.juling', productName: '聚灵', version: '1.4.0', mainBinaryName: '聚灵' };
  const info = { CFBundleIdentifier: config.identifier, CFBundleName: '聚灵', CFBundleDisplayName: '聚灵', CFBundleShortVersionString: '1.4.0', CFBundleExecutable: '聚灵' };
  validateIdentity(info, config, ['x86_64', 'arm64'], ['arm64', 'x86_64']);
  assert.throws(() => validateIdentity({ ...info, CFBundleIdentifier: 'com.jlcodes.cockpit-tools' }, config, ['arm64'], ['arm64']));
  assert.throws(() => validateIdentity({ ...info, CFBundleShortVersionString: '1.3.84' }, config, ['arm64'], ['arm64']));
  assert.throws(() => validateIdentity(info, config, ['arm64'], ['arm64', 'x86_64']));
});

test('Mac packaging uses ASCII filesystem names and preserves the Chinese display identity', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src-tauri/tauri.conf.json')));
  const mac = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src-tauri/tauri.macos.conf.json')));
  assert.equal(mac.productName, 'Juling');
  assert.equal(mac.mainBinaryName, 'Juling');
  assert.equal(mac.identifier, undefined, 'Mac must inherit the stable Juling application ID');
  assert.equal(config.mainBinaryName, '聚灵', 'Windows naming must remain unchanged');
  const effective = { ...config, ...mac, bundle: { ...config.bundle, ...mac.bundle } };
  validateIdentity({ CFBundleIdentifier: config.identifier, CFBundleName: '聚灵',
    CFBundleDisplayName: '聚灵', CFBundleShortVersionString: config.version,
    CFBundleExecutable: 'Juling' }, effective, ['arm64'], ['arm64']);
});
