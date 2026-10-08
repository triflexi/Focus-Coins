import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const compose=['compose','-f','compose.yml','-f','artifacts/compose.verify.yml'];
const env={...process.env,API_LOCAL_PORT:'33000',WEB_ORIGIN:'http://localhost:8080'};
const docker=(...args)=>execFileSync('docker',args,{env,encoding:'utf8',maxBuffer:4e6});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base='http://localhost:33000/api/v1';
let token='';
async function call(path,method='GET',body,key){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Client':'android',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.ok,true,JSON.stringify(data));return data;}
async function ready(){for(let i=0;i<60;i++){try{if((await fetch('http://localhost:33000/health/ready')).ok)return;}catch{ /* A restart briefly closes the port. */ }await sleep(1000);}throw new Error('API readiness timeout');}
mkdirSync('artifacts',{recursive:true});
const login=`qa_container_${Date.now()}`,nickname=`QA_${Date.now()}`;
const auth=await call('/auth/register','POST',{login,nickname,password:'Qa-local-focus-2026!'});token=auth.accessToken;
await call('/visits','POST',{});
const key=randomUUID(),session=await call('/focus','POST',{minutes:1},key);
assert.equal((await call('/focus','POST',{minutes:1},key)).id,session.id);
console.log('One-minute server session started; restarting container');
docker(...compose,'restart','api');await ready();
assert.equal((await call('/dashboard')).active?.id,session.id);
while(Date.now()<Date.parse(session.endsAt)+1200)await sleep(1000);
const completed=await call('/dashboard');
assert.equal(completed.active,null);assert.equal(completed.balance,'1.00');
assert.equal(completed.history.filter(s=>s.id===session.id&&s.status==='completed').length,1);
assert.equal((await call('/dashboard')).balance,'1.00');
const metrics=await(await fetch('http://localhost:33000/metrics')).text();assert.match(metrics,/app_focus_sessions_total \d+/);
const image=docker('inspect','focus-coins-api-1','--format','{{.Image}}').trim();
docker('tag','focus-coins-api:verified-local','focus-coins-api:before-rollback');
docker('tag','focus-coins-api:previous-local','focus-coins-api:verified-local');
try{docker(...compose,'up','-d','--no-build','--force-recreate','--wait','api');await ready();assert.equal((await call('/dashboard')).balance,'1.00');}
finally{docker('tag','focus-coins-api:before-rollback','focus-coins-api:verified-local');docker(...compose,'up','-d','--no-build','--force-recreate','--wait','api');await ready();}
const restoredImage=docker('inspect','focus-coins-api-1','--format','{{.Image}}').trim();assert.equal(restoredImage,image);
console.log('Previous image restored and final image reapplied; wallet survived');
const restoreDb=`focus_restore_qa_${Date.now()}`;
docker(...compose,'exec','-T','db','pg_dump','-U','focus','-d','focus','-Fc','-f','/tmp/focus-qa.dump');
docker('cp','focus-coins-db-1:/tmp/focus-qa.dump','artifacts/release/focus-qa.dump');
docker(...compose,'exec','-T','db','psql','-U','focus','-d','postgres','-c',`CREATE DATABASE ${restoreDb};`);
docker(...compose,'exec','-T','db','pg_restore','-U','focus','-d',restoreDb,'/tmp/focus-qa.dump');
const query='SELECT json_build_object(\'users\',(SELECT count(*) FROM "User"),\'sessions\',(SELECT count(*) FROM "FocusSession"),\'ledger\',(SELECT count(*) FROM "Ledger"),\'balance\',(SELECT coalesce(sum(balance),0)::text FROM "Wallet"));';
const counts=db=>JSON.parse(docker(...compose,'exec','-T','db','psql','-U','focus','-d',db,'-Atc',query).trim());
const live=counts('focus'),restored=counts(restoreDb);assert.deepEqual(restored,live);
const result={checkedAt:new Date().toISOString(),login,sessionId:session.id,restartRecovery:true,singleReward:'1.00',imageRollback:true,restoredImage:image,backup:'artifacts/release/focus-qa.dump',restoreDatabase:restoreDb,counts:restored};
writeFileSync('artifacts/container-qa.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
