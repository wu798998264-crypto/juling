// Repackage an existing, signed CI archive. Never change application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const { verifyTree } = require('./package-local-dmg.cjs');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const command = (exe, args, options = {}) => execFileSync(exe, args, {
  encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024, ...options,
});
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

function verifySignature(data, encodedSignature, encodedKey) {
  const pub = Buffer.from(Buffer.from(encodedKey, 'base64').toString().trim().split(/\r?\n/)[1], 'base64');
  const lines = Buffer.from(encodedSignature, 'base64').toString().trim().split(/\r?\n/);
  const sig = Buffer.from(lines[1] || '', 'base64');
  assert.equal(pub.length, 42, 'Invalid updater public key');
  assert.equal(sig.length, 74, 'Invalid updater signature');
  assert.ok(pub.subarray(2, 10).equals(sig.subarray(2, 10)), 'Updater key ID mismatch');
  assert.ok(lines[2]?.startsWith('trusted comment: '), 'Missing trusted comment');
  const algorithm = sig.subarray(0, 2).toString();
  assert.ok(['Ed', 'ED'].includes(algorithm), 'Unsupported signature algorithm');
  const key = crypto.createPublicKey({ key: Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'), pub.subarray(10),
  ]), format: 'der', type: 'spki' });
  const message = algorithm === 'ED' ? crypto.createHash('blake2b512').update(data).digest() : data;
  assert.ok(crypto.verify(null, message, key, sig.subarray(10)), 'Invalid updater signature');
  assert.ok(crypto.verify(null, Buffer.concat([sig.subarray(10), Buffer.from(lines[2].slice(17))]),
    key, Buffer.from(lines[3] || '', 'base64')), 'Invalid trusted comment signature');
}

function validateProvenance({ run, jobs, artifact, sha, repo, artifactName }) {
  assert.equal(run.head_sha, sha, 'Build source does not match release tag');
  assert.equal(run.head_repository?.full_name, repo, 'Unexpected source repository');
  assert.equal(run.path, '.github/workflows/build-matrix.yml');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event), 'Untrusted build event');
  assert.equal(run.conclusion, 'success', 'Build matrix must pass');
  for (const label of ['macos-aarch64', 'macos-x86_64', 'macos-universal', 'ubuntu-22.04', 'windows-latest']) {
    const job = jobs.find(j => j.name === `🏗️ Build: ${label}`);
    assert.equal(job?.conclusion, 'success', `Missing successful ${label} job`);
    if (label.startsWith('macos-')) {
      assert.equal(job.steps.find(s => s.name === '🏗️ Build app (Signed)')?.conclusion, 'success');
    }
    if (label === 'ubuntu-22.04') {
      for (const name of ['🧪 Test native Rust regressions', '🛡️ Test Juling cooldown safety']) {
        assert.equal(job.steps.find(s => s.name === name)?.conclusion, 'success', `Safety gate: ${name}`);
      }
    }
  }
  assert.equal(artifact?.name, artifactName);
  assert.equal(artifact?.expired, false);
  assert.equal(artifact?.workflow_run?.head_sha, sha);
  assert.match(artifact?.digest || '', /^sha256:[a-f0-9]{64}$/);
}

function validateIdentity(info, config, archs, expectedArchs) {
  assert.equal(info.CFBundleIdentifier, config.identifier);
  assert.equal(info.CFBundleName, config.productName);
  assert.equal(info.CFBundleDisplayName, config.productName);
  assert.equal(info.CFBundleShortVersionString, config.version);
  assert.equal(info.CFBundleExecutable, config.mainBinaryName);
  assert.deepEqual([...archs].sort(), [...expectedArchs].sort());
}

async function main(mode) {
  const version = process.env.VERSION;
  const arch = process.env.PACKAGE_ARCH;
  const expectedArchs = { aarch64: ['arm64'], x64: ['x86_64'], universal: ['arm64', 'x86_64'] }[arch];
  assert.match(version || '', /^\d+\.\d+\.\d+$/);
  assert.ok(expectedArchs, 'Unsupported architecture');
  const config = readJson('source/src-tauri/tauri.conf.json');
  assert.equal(config.version, version);
  assert.equal(config.identifier, 'com.wu798998264.juling');
  const output = path.resolve('release-assets');
  fs.mkdirSync(output, { recursive: true });
  const archive = path.join(output, `Juling_${arch}.app.tar.gz`);
  const reportPath = path.join(output, `verification-${arch}.json`);
  if (mode === 'provenance') {
    assert.match(process.env.SOURCE_RUN || '', /^\d+$/);
    const repo = process.env.GITHUB_REPOSITORY;
    const api = endpoint => JSON.parse(command('gh', ['api', `repos/${repo}/${endpoint}`]));
    const sha = command('git', ['-C', 'source', 'rev-parse', 'HEAD']).trim();
    const run = api(`actions/runs/${process.env.SOURCE_RUN}`);
    const jobs = api(`actions/runs/${run.id}/jobs?per_page=100`).jobs;
    const artifact = api(`actions/runs/${run.id}/artifacts?per_page=100`).artifacts
      .find(a => a.name === process.env.SOURCE_ARTIFACT);
    validateProvenance({ run, jobs, artifact, sha, repo, artifactName: process.env.SOURCE_ARTIFACT });
    fs.writeFileSync('provenance.json', JSON.stringify({ version, source: sha,
      run: run.id, artifactId: artifact.id, artifactDigest: artifact.digest }, null, 2));
    return;
  }
  if (mode === 'finalize') {
    verifySignature(fs.readFileSync(archive), fs.readFileSync(`${archive}.sig`, 'utf8'), config.plugins.updater.pubkey);
    const report = readJson(reportPath);
    report.updaterSignatureVerified = true;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    const names = fs.readdirSync(output).sort();
    fs.writeFileSync(path.join(output, `SHA256SUMS-macos-${arch}.txt`),
      names.map(name => `${digest(path.join(output, name))}  ${name}`).join('\n') + '\n');
    return;
  }
  assert.equal(mode, 'package');
  assert.equal(process.platform, 'darwin');
  const candidates = walk('incoming').filter(file => file.endsWith('.app.tar.gz'));
  assert.equal(candidates.length, 1, 'Expected one original updater archive');
  const original = candidates[0];
  verifySignature(fs.readFileSync(original), fs.readFileSync(`${original}.sig`, 'utf8'), config.plugins.updater.pubkey);
  const entries = command('tar', ['-tzf', original]).trim().split('\n');
  assert.ok(entries.every(e => e.replace(/^\.\//, '').startsWith('聚灵.app/') && !e.split('/').includes('..')),
    'Archive must contain only the expected application');
  const payload = path.resolve('.tmp/macos-payload');
  fs.mkdirSync(payload, { recursive: true });
  command('tar', ['-xzf', original, '-C', payload]);
  const app = path.join(payload, '聚灵.app');
  const info = JSON.parse(command('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Contents/Info.plist')]));
  const binary = path.join(app, 'Contents/MacOS', info.CFBundleExecutable);
  const archs = command('lipo', ['-archs', binary]).trim().split(/\s+/);
  validateIdentity(info, config, archs, expectedArchs);
  for (const [source, dest] of Object.entries(config.bundle.resources)) {
    assert.equal(digest(path.resolve('source/src-tauri', source)), digest(path.join(app, 'Contents/Resources', dest)), dest);
  }
  const icon = info.CFBundleIconFile.endsWith('.icns') ? info.CFBundleIconFile : `${info.CFBundleIconFile}.icns`;
  assert.equal(digest('source/src-tauri/icons/icon.icns'), digest(path.join(app, 'Contents/Resources', icon)));
  const originalBinarySha256 = digest(binary);
  command('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app]);
  command('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
  const signing = spawnSync('codesign', ['--display', '--verbose=4', app], { encoding: 'utf8' });
  assert.equal(signing.status, 0);
  assert.match(signing.stderr, /^Signature=adhoc$/m);
  // The runner is disposable and contains no user's accounts or local config.
  const launchLog = fs.openSync('.tmp/macos-launch.log', 'w');
  const child = spawn('open', ['-W', '-n', '--stdout', path.resolve('.tmp/macos-app-stdout.log'),
    '--stderr', path.resolve('.tmp/macos-app-stderr.log'), app], { stdio: ['ignore', launchLog, launchLog] });
  fs.closeSync(launchLog);
  let launchError;
  child.on('error', error => { launchError = error; });
  await new Promise(resolve => setTimeout(resolve, 12_000));
  assert.equal(launchError, undefined, 'Application launch failed');
  // Some macOS runners return from open -W before the application terminates.
  // Inspect the application itself rather than treating the launcher as it.
  assert.ok(child.exitCode === null || child.exitCode === 0, 'LaunchServices failed');
  const pids = command('pgrep', ['-f', `${app}/Contents/MacOS/`]).trim().split(/\s+/);
  assert.ok(pids.length > 0, 'No application process after LaunchServices startup');
  for (const pid of pids) process.kill(Number(pid), 'SIGTERM');
  if (child.exitCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  fs.symlinkSync('/Applications', path.join(payload, 'Applications'));
  fs.copyFileSync(path.join(__dirname, 'assets/dmg-readme-adhoc.txt'), path.join(payload, '安装说明.txt'));
  const dmg = path.join(output, `Juling_${version}_${arch}.dmg`);
  command(process.execPath, [path.join(__dirname, 'package-local-dmg.cjs'), '--stage', payload, '--output', dmg], { stdio: 'inherit' });
  command('tar', ['-czf', archive, '-C', payload, '聚灵.app']);
  const extracted = path.resolve('.tmp/updater-verification');
  fs.mkdirSync(extracted, { recursive: true });
  command('tar', ['-xzf', archive, '-C', extracted]);
  verifyTree(app, path.join(extracted, '聚灵.app'));
  command('codesign', ['--verify', '--deep', '--strict', path.join(extracted, '聚灵.app')]);
  fs.writeFileSync(reportPath, JSON.stringify({ ...readJson('provenance.json'), arch, archs,
    bundleId: info.CFBundleIdentifier, productName: info.CFBundleName,
    minimumSystemVersion: info.LSMinimumSystemVersion, originalBinarySha256,
    signing: 'ad-hoc', notarized: false, sourceSignatureVerified: true,
    resourcesVerified: Object.keys(config.bundle.resources).length, logoVerified: true,
    startupSmokeSeconds: 12, dmgVerified: true, updaterTreeVerified: true }, null, 2));
}

if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { verifySignature, validateProvenance, validateIdentity };
