const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifySignature } = require('./macos-artifact-package.cjs');
const { buildTargetManifests } = require('./build_target_latest_json.cjs');
const { uploadReleaseAssets } = require('./upload_release_assets.cjs');

const repo = 'wu798998264-crypto/juling';
const version = process.env.RELEASE_VERSION;
const tag = `v${version}`;
const gh = (args, timeout = 60_000) =>
  execFileSync('gh', args, { encoding: 'utf8', timeout }).trim();
const api = endpoint => JSON.parse(gh(['api', `repos/${repo}/${endpoint}`]));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function verifiedRun(id, workflow, source, jobs) {
  assert.match(id ?? '', /^\d+$/);
  const run = api(`actions/runs/${id}`);
  assert.equal(run.head_repository?.full_name, repo);
  assert.equal(run.path, `.github/workflows/${workflow}.yml`);
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.head_sha, source);
  assert.equal(run.conclusion, 'success');
  const completed = api(`actions/runs/${id}/jobs?per_page=100`).jobs;
  for (const [name, requiredSteps] of Object.entries(jobs)) {
    const job = completed.find(entry => entry.name === name);
    assert.equal(job?.conclusion, 'success', name);
    for (const step of requiredSteps) {
      assert.equal(job.steps.find(entry => entry.name === step)?.conclusion, 'success', step);
    }
  }
}

function collect(run, artifact, incoming, stage, names) {
  const directory = path.join(incoming, artifact);
  gh(['run', 'download', run, '--repo', repo, '--name', artifact, '--dir', directory], 10 * 60_000);
  for (const name of names) {
    fs.copyFileSync(path.join(directory, name), path.join(stage, name), fs.constants.COPYFILE_EXCL);
  }
  return directory;
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, repo);
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/);
  const source = api(`commits/${tag}`).sha;
  const notes = `docs/releases/${tag}.md`;
  const config = readJson('src-tauri/tauri.conf.json');
  assert.equal(config.version, version);
  assert.equal(config.identifier, 'com.wu798998264.juling');
  const windowsRun = process.env.WINDOWS_RUN;
  const macRun = process.env.PACKAGE_RUN;
  verifiedRun(windowsRun, 'windows-artifacts', source, {
    windows: ['Juling cooldown safety gate', 'Frozen protocol parity gate', 'Build signed Windows installers'],
    'windows-arm64': ['Build signed native ARM64 installer'],
  });
  const arches = ['aarch64', 'x64', 'universal'];
  verifiedRun(macRun, 'macos-packages', source,
    Object.fromEntries(arches.map(arch => [`Package and verify ${arch}`, [
      'Verify source run and safety gates', 'Verify, ad-hoc sign and package the original application',
      'Verify updater signature and checksums',
    ]])));

  const incoming = fs.mkdtempSync(path.join(os.tmpdir(), 'juling-desktop-release-'));
  const stage = fs.mkdirSync(path.join(incoming, 'release-assets'), { recursive: true });
  const installers = [
    `Juling_${version}_x64-setup.exe`, `Juling_${version}_x64_zh-CN.msi`, `Juling_${version}_arm64-setup.exe`,
  ];
  collect(windowsRun, `Juling-Windows-${source}`, incoming, stage,
    [...installers.slice(0, 2).flatMap(name => [name, name + '.sig']), `Juling_${version}_x64-portable.zip`]);
  collect(windowsRun, `Juling-Windows-arm64-${source}`, incoming, stage, [installers[2], installers[2] + '.sig']);
  for (const arch of arches) {
    const archive = `Juling_${arch}.app.tar.gz`;
    installers.push(archive);
    const directory = collect(macRun, `juling-macos-${arch}`, incoming, stage,
      [archive, archive + '.sig', `Juling_${version}_${arch}.dmg`]);
    const receipt = readJson(path.join(directory, `verification-${arch}.json`));
    assert.equal(receipt.source, source);
    assert.equal(receipt.version, version);
    assert.equal(receipt.arch, arch);
    assert.equal(receipt.startupSmokeSeconds, 12);
    assert.equal(receipt.dmgVerified, true);
    assert.equal(receipt.updaterTreeVerified, true);
    assert.equal(receipt.updaterSignatureVerified, true);
    const checksums = fs.readFileSync(path.join(directory, `SHA256SUMS-macos-${arch}.txt`), 'utf8');
    const dmg = `Juling_${version}_${arch}.dmg`;
    assert.ok(checksums.split('\n').includes(`${digest(path.join(stage, dmg))}  ${dmg}`));
  }
  for (const name of installers) {
    verifySignature(fs.readFileSync(path.join(stage, name)), fs.readFileSync(path.join(stage, name + '.sig'), 'utf8'),
      config.plugins.updater.pubkey);
  }
  fs.copyFileSync('scripts/release/assets/dmg-readme-adhoc.txt', path.join(stage, 'macOS-install.txt'));

  const prior = JSON.parse(gh(['release', 'list', '--repo', repo, '--limit', '100', '--json', 'tagName,isDraft']));
  const existing = prior.find(item => item.tagName === tag);
  const published = existing && !existing.isDraft;
  if (!existing) gh(['release', 'create', tag, '--repo', repo, '--verify-tag', '--draft',
    '--title', `聚灵 S1.0.7 · ${version} · Windows / macOS`, '--notes-file', notes]);
  if (published) {
    console.log('Release already public. Running anonymous verification only.');
    return;
  }
  const targets = ['windows-x86_64-nsis', 'windows-x86_64-msi', 'windows-aarch64-nsis', 'darwin-aarch64-app', 'darwin-x86_64-app'];
  const release = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'createdAt,isDraft,databaseId']));
  assert.equal(release.isDraft, true);
  const manifests = buildTargetManifests({ version, repo, assetsDir: stage, notesFile: notes, publishedAt: release.createdAt, outputDir: stage, targets });
  const platforms = {};
  for (const [index, file] of manifests.entries()) {
    const manifest = readJson(file);
    const target = targets[index];
    platforms[target] = { url: manifest.url, signature: manifest.signature };
    if (!target.endsWith('-msi')) {
      const alias = target.replace(/-(?:nsis|app)$/, '');
      platforms[alias] = platforms[target];
      fs.copyFileSync(file, path.join(stage, `latest-${alias}.json`));
    }
  }
  writeJson(path.join(stage, 'latest.json'), {
    version, notes: fs.readFileSync(notes, 'utf8').trim(), pub_date: release.createdAt, platforms,
  });
  const checksums = Object.fromEntries(fs.readdirSync(stage).sort().map(name => [name, digest(path.join(stage, name))]));
  const checksumName = 'SHA256SUMS.txt';
  fs.writeFileSync(path.join(stage, checksumName), Object.entries(checksums).map(([name, hash]) => `${hash}  ${name}\n`).join(''));
  checksums[checksumName] = digest(path.join(stage, checksumName));
  const assets = () => api(`releases/${release.databaseId}/assets?per_page=100`);
  const uploaded = new Map(assets().map(asset => [asset.name, asset.digest]));
  const pending = Object.keys(checksums).filter(name => uploaded.get(name) !== 'sha256:' + checksums[name]);
  if (pending.length) await uploadReleaseAssets(tag, pending.map(name => path.join(stage, name)));
  assert.deepEqual(Object.fromEntries(assets().map(asset => [asset.name, asset.digest])),
    Object.fromEntries(Object.entries(checksums).map(([name, hash]) => [name, 'sha256:' + hash])),
    'Draft assets do not match the verified desktop packages');
  gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease=false', '--latest']);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
