const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),https=require('node:https');
const {execFileSync}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
// Supplement the already-published 1.4.0 release; never replace executable assets.
const root=process.cwd(),base=path.resolve('.tmp/macos-v1.4.0'),repo='wu798998264-crypto/juling',version='1.4.0',tag='v1.4.0',source='d03e4695513a62061d3fce457eef887bc6dd93bf';
const gh=args=>execFileSync('gh',args,{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});
const api=(endpoint,args=[])=>JSON.parse(gh(['api',`repos/${repo}/${endpoint}`,...args]));
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const put=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function response(url,depth=0){
 const u=new URL(url);assert.ok(u.protocol==='https:'&&(u.hostname==='github.com'||u.hostname.endsWith('.githubusercontent.com')));assert.ok(depth<8);
 return new Promise((resolve,reject)=>{const req=https.get(u,{headers:{'User-Agent':'Juling-mac-release-verification'}},res=>{if([301,302,303,307,308].includes(res.statusCode)){res.resume();response(new URL(res.headers.location,u),depth+1).then(resolve,reject);}else if(res.statusCode===200)resolve(res);else{res.resume();reject(Error('Download status '+res.statusCode));}});req.setTimeout(120000,()=>req.destroy(Error('Download timeout')));req.on('error',reject);});
}
async function download(url,file){await pipeline(await response(url),fs.createWriteStream(file));}
async function upload(releaseId,file,token){
 const bytes=fs.statSync(file).size,name=path.basename(file);
 return new Promise((resolve,reject)=>{const req=https.request(`https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'Juling-release-uploader','Content-Type':'application/octet-stream','Content-Length':bytes}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{if(res.statusCode!==201)return reject(Error('Upload HTTP '+res.statusCode));try{resolve(JSON.parse(text));}catch(e){reject(e);}});});const input=fs.createReadStream(file);const timer=setTimeout(()=>req.destroy(Error('Upload deadline exceeded')),20*60*1000);req.on('close',()=>clearTimeout(timer));req.on('error',e=>{input.destroy();reject(e);});input.on('error',e=>req.destroy(e));input.pipe(req);});
}
async function prepare(runId){
 const run=api(`actions/runs/${runId}`);assert.equal(run.conclusion,'success');assert.equal(run.path,'.github/workflows/macos-packages.yml');assert.equal(run.event,'workflow_dispatch');
 const release=api(`releases/tags/${tag}`);assert.equal(release.draft,false);assert.equal(release.target_commitish,source);
 const stage=path.join(base,'release-assets');fs.mkdirSync(stage,{recursive:true});assert.equal(fs.readdirSync(stage).length,0,'Inspect staging before retrying');
 const config=json(path.join(root,'src-tauri/tauri.conf.json'));
 const verify=require(path.join(root,'scripts/release/macos-artifact-package.cjs')).verifySignature;
 const reports=[];
 for(const arch of ['aarch64','x64','universal']){
  const dir=path.join(base,'downloads',arch),report=json(path.join(dir,`verification-${arch}.json`));
  assert.equal(report.version,version);assert.equal(report.source,source);assert.equal(report.arch,arch);assert.equal(report.signing,'ad-hoc');assert.equal(report.notarized,false);
  for(const field of ['sourceSignatureVerified','logoVerified','dmgVerified','updaterTreeVerified','updaterSignatureVerified','codePreservedBeforeSigning'])assert.equal(report[field],true,field);
  assert.equal(report.bundleId,config.identifier);assert.equal(report.productName,'聚灵');assert.equal(report.executable,'Juling');assert.equal(report.startupSmokeSeconds,12);assert.equal(report.resourcesVerified,Object.keys(config.bundle.resources).length);
  const checksums=new Map(fs.readFileSync(path.join(dir,`SHA256SUMS-macos-${arch}.txt`),'utf8').trim().split('\n').map(line=>[line.slice(66).trim(),line.slice(0,64)]));
  for(const name of [`Juling_${version}_${arch}.dmg`,`Juling_${arch}.app.tar.gz`,`Juling_${arch}.app.tar.gz.sig`]){
   assert.equal(sha(path.join(dir,name)),checksums.get(name));fs.copyFileSync(path.join(dir,name),path.join(stage,name));
  }
  verify(fs.readFileSync(path.join(stage,`Juling_${arch}.app.tar.gz`)),fs.readFileSync(path.join(stage,`Juling_${arch}.app.tar.gz.sig`),'utf8'),config.plugins.updater.pubkey);
  reports.push(report);
 }
 put(path.join(stage,'macos-verification.json'),{version,packageRun:Number(runId),packagingSource:run.head_sha,applications:reports});
 fs.copyFileSync(path.join(root,'scripts/release/assets/dmg-readme-adhoc.txt'),path.join(stage,'macOS-install.txt'));
 require(path.join(root,'scripts/release/build_target_latest_json.cjs')).buildTargetManifests({version,repo,assetsDir:stage,notesFile:path.join(root,'docs/releases/v1.4.0-macos.md'),publishedAt:release.published_at,outputDir:stage,targets:['darwin-aarch64-app','darwin-x86_64-app']});
 for(const arch of ['aarch64','x86_64'])fs.copyFileSync(path.join(stage,`latest-darwin-${arch}-app.json`),path.join(stage,`latest-darwin-${arch}.json`));
 const before=path.join(base,'latest-before.json');await download(release.assets.find(a=>a.name==='latest.json').browser_download_url,before);
 assert.equal('sha256:'+sha(before),release.assets.find(a=>a.name==='latest.json').digest);
 const latest=json(before);assert.equal(latest.version,version);
 for(const arch of ['aarch64','x86_64']){const manifest=json(path.join(stage,`latest-darwin-${arch}-app.json`));const entry={url:manifest.url,signature:manifest.signature};latest.platforms[`darwin-${arch}`]=entry;latest.platforms[`darwin-${arch}-app`]=entry;}
 latest.notes+='\n\n'+fs.readFileSync(path.join(root,'docs/releases/v1.4.0-macos.md'),'utf8');put(path.join(stage,'latest.json'),latest);
 const old=json(before);for(const [key,value]of Object.entries(old.platforms))assert.deepEqual(latest.platforms[key],value,'Existing platform changed');
 put(path.join(base,'release-before.json'),release);
 const digestMap=new Map(release.assets.filter(a=>a.name!=='SHA256SUMS.txt').map(a=>{assert.match(a.digest,/^sha256:[a-f0-9]{64}$/);return[a.name,a.digest.slice(7)];}));
 for(const name of fs.readdirSync(stage))digestMap.set(name,sha(path.join(stage,name)));
 fs.writeFileSync(path.join(stage,'SHA256SUMS.txt'),[...digestMap].sort(([a],[b])=>a.localeCompare(b)).map(([n,h])=>`${h}  ${n}`).join('\n')+'\n');
 const files=fs.readdirSync(stage).map(name=>({name,sha256:sha(path.join(stage,name)),bytes:fs.statSync(path.join(stage,name)).size}));
 put(path.join(base,'prepared.json'),{version,source,runId:Number(runId),packagingSource:run.head_sha,releaseId:release.id,stage,files});
 console.log(JSON.stringify({prepared:true,files:files.length,source,packageRun:runId}));
}
async function publish(){
 const record=json(path.join(base,'prepared.json')),before=json(path.join(base,'release-before.json'));
 assert.equal(api(`actions/runs/${record.runId}`).conclusion,'success');
 const token=gh(['auth','token','--hostname','github.com']).trim();
 const replacing=new Set(['latest.json','SHA256SUMS.txt']);
 const ordered=[...record.files.filter(f=>!replacing.has(f.name)),...record.files.filter(f=>replacing.has(f.name)).sort((a,b)=>a.name==='latest.json'?-1:1)];
 for(const asset of ordered){
  const file=path.join(record.stage,asset.name);assert.equal(sha(file),asset.sha256);
  const release=api(`releases/${record.releaseId}`);assert.equal(release.tag_name,tag);assert.equal(release.draft,false);
  for(const old of before.assets.filter(a=>!replacing.has(a.name)))assert.equal(release.assets.find(a=>a.name===old.name)?.digest,old.digest,'Existing asset changed');
  const existing=release.assets.find(a=>a.name===asset.name);
  if(existing?.digest==='sha256:'+asset.sha256){console.log('Already verified '+asset.name);continue;}
  if(existing){assert.ok(replacing.has(asset.name),'Will not overwrite an existing package');assert.equal(existing.digest,before.assets.find(a=>a.name===asset.name).digest);gh(['api','--method','DELETE',`repos/${repo}/releases/assets/${existing.id}`]);}
  const result=await upload(record.releaseId,file,token);assert.equal(result.digest,'sha256:'+asset.sha256);assert.equal(result.size,asset.bytes);console.log('Uploaded '+asset.name);
 }
 const note=path.join(base,'release-update.json');put(note,{body:before.body+'\n\n'+fs.readFileSync(path.join(root,'docs/releases/v1.4.0-macos.md'),'utf8')});
 api(`releases/${record.releaseId}`,['--method','PATCH','--input',note]);
 const release=api(`releases/${record.releaseId}`);for(const file of record.files)assert.equal(release.assets.find(a=>a.name===file.name)?.digest,'sha256:'+file.sha256);
 put(path.join(base,'published.json'),{version,source,packageRun:record.runId,url:release.html_url,publishedAt:new Date().toISOString(),files:release.assets.map(a=>({name:a.name,bytes:a.size,digest:a.digest,url:a.browser_download_url}))});
 console.log('Published verified macOS packages: '+release.html_url);
}
async function verifyPublic(){
 const publication=json(path.join(base,'published.json')),results=[];
 for(const arch of ['aarch64','x64','universal']){
  const asset=publication.files.find(a=>a.name===`Juling_${version}_${arch}.dmg`);const hash=crypto.createHash('sha256');let bytes=0;
  for await(const chunk of await response(asset.url)){hash.update(chunk);bytes+=chunk.length;}
  const digest='sha256:'+hash.digest('hex');assert.equal(digest,asset.digest);assert.equal(bytes,asset.bytes);results.push({name:asset.name,digest,bytes});console.log('Anonymous DMG verified: '+asset.name);
 }
 for(const name of ['latest-darwin-aarch64-app.json','latest-darwin-x86_64-app.json','latest-darwin-aarch64.json','latest-darwin-x86_64.json','latest-windows-x86_64-nsis.json','latest-windows-x86_64.json','latest.json']){
  const chunks=[];for await(const chunk of await response(`https://github.com/${repo}/releases/latest/download/${name}`))chunks.push(chunk);
  const manifest=JSON.parse(Buffer.concat(chunks));assert.equal(manifest.version,version);
  if(name==='latest.json'){const old=json(path.join(base,'latest-before.json'));for(const [key,value]of Object.entries(old.platforms))assert.deepEqual(manifest.platforms[key],value);assert.ok(manifest.platforms['darwin-aarch64-app']&&manifest.platforms['darwin-x86_64-app']);}
 }
 put(path.join(base,'public-verified.json'),{version,authenticated:false,dmgs:results,macAndWindowsUpdateAliasesVerified:true,verifiedAt:new Date().toISOString()});
 console.log('Public downloads and both platform update routes verified.');
}
(async()=>{const mode=process.argv[2];if(mode==='prepare')await prepare(process.argv[3]);else if(mode==='publish')await publish();else if(mode==='verify')await verifyPublic();else throw Error('prepare <run>|publish|verify');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
