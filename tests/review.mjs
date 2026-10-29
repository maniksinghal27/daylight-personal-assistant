import assert from 'node:assert/strict';
import review from '../deploy/review-worker.mjs';
import {database} from '../scripts/local-db.mjs';

const env={DB:database(':memory:'),REVIEW_SESSION_KEY:'test-only-review-session-signing-secret'};
let pending=[];const ctx={waitUntil(p){pending.push(p);}};
async function call(op,body,cookie='',headers={}){const response=await review.fetch(new Request('https://review.test/api/'+op,{method:body===undefined?'GET':'POST',headers:{cookie,Origin:'https://review.test','Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env,ctx);return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
let count=0;function ok(value,message){assert.ok(value,message);count++;console.log('PASS '+message);}
const unconfigured=await review.fetch(new Request('https://review.test/'),{DB:env.DB},ctx);ok(unconfigured.status===503,'Public review fails closed without a signing secret');
const first=await call('state');const cookie=first.cookie;
ok(first.data.demo&&first.data.setup.review&&first.data.settings.name==='Reviewer','Anonymous reviewer receives fictional data and an explicit public-demo state');
ok(cookie?.startsWith('daylight_review='),'Reviewer receives a signed session cookie');
await call('memory-save',{text:'Reviewer A preference'},cookie);
let state=await call('state',undefined,cookie);ok(state.data.memories.some(m=>m.text==='Reviewer A preference'),'Reviewer changes persist within their own session');
const second=await call('state');ok(!second.data.memories.some(m=>m.text==='Reviewer A preference'),'A new visitor cannot see another reviewer workspace');
const spoof=await call('state',undefined,second.cookie,{'oai-authenticated-user-id':first.data.id});ok(!spoof.data.memories.some(m=>m.text==='Reviewer A preference'),'Caller-supplied identity headers are ignored');
const tamper=await call('state',undefined,cookie.slice(0,-1)+(cookie.endsWith('x')?'y':'x'));ok(!tamper.data.memories.some(m=>m.text==='Reviewer A preference'),'A modified session signature cannot retrieve an existing workspace');
ok((await call('connect',{service:'gmail'},cookie)).status===403,'Public demo cannot connect a real mailbox');
ok((await call('source-save',{title:'Private upload',text:'text'},cookie)).status===403,'Public review blocks uploaded personal source data');
const scheduler=await review.fetch(new Request('https://review.test/api/scheduler-tick',{method:'POST',headers:{Origin:'https://review.test'}}),env,ctx);ok(scheduler.status===403,'Sites scheduler boundary is unavailable on the public host');
const cross=await call('todo-save',{title:'forged'},cookie,{Origin:'https://evil.test'});ok(cross.status===403,'Cross-origin review writes are denied');
const oversized=await call('memory-save',{text:'x'.repeat(33000)},cookie);ok(oversized.status===413,'Oversized request bodies are rejected');
const action=first.data.actions[0];await call('send',{id:action.id},cookie);state=await call('state',undefined,cookie);ok(state.data.actions.find(a=>a.id===action.id).receipt.simulated,'Public approval produces only a simulated receipt');
env.NEBIUS_API_KEY='mock-key';env.NEBIUS_MODEL='nvidia/Test-Nemotron';
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({choices:[{message:{content:'Mocked review output.'}}],usage:{total_tokens:20}});
await call('settings',{settings:{disclosure:true}},cookie);
for(let i=0;i<20;i++){const result=await call('run',{skill:'daily',sources:[],prompt:'Review daily brief'},cookie);assert.equal(result.status,200);await Promise.all(pending);pending=[];}
ok((await call('run',{skill:'daily',sources:[]},cookie)).status===429,'Per-session inference allowance is enforced');
await env.DB.prepare('UPDATE service_state SET value=? WHERE id=?').bind('200','review:total-calls').run();
ok((await call('run',{skill:'daily',sources:[]},second.cookie)).status===429,'Deployment-wide inference allowance is enforced');
globalThis.fetch=originalFetch;env.DB.close();console.log('\n'+count+' public review checks passed. Provider responses were mocked.');
