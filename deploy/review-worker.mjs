import application from '../worker/index.js';
import {initial} from '../src/core.js';

const respond=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function signingKey(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function session(request,secret){
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('daylight_review='))?.slice(16);
  const key=await signingKey(secret);
  if(token){const [id,expiry,signature]=token.split('.');if(/^[\w-]{36}$/.test(id)&&/^\d+$/.test(expiry)&&Number(expiry)>Date.now()&&signature){try{if(await crypto.subtle.verify('HMAC',key,decode(signature),new TextEncoder().encode(id+'.'+expiry)))return {id,token,fresh:false};}catch{}}}
  const id=crypto.randomUUID(),expiry=Date.now()+86400000,payload=id+'.'+expiry;
  return {id,token:payload+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)))),fresh:true};
}
async function bodyText(request){
  const reader=request.body?.getReader();if(!reader)return '{}';const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw Object.assign(new Error('The review demo accepts requests up to 32 KB.'),{status:413});}chunks.push(value);}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(result);
}
async function reserve(db,id,limit){
  const row=await db.prepare('INSERT INTO service_state(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=CAST(value AS INTEGER)+1 WHERE CAST(value AS INTEGER)<? RETURNING value').bind(id,'1',limit).first();return !!row;
}

// This entrypoint is a separate public, fictional review deployment. It never
// trusts incoming Sites identity headers and never exposes a real workspace.
export default {async fetch(request,environment,ctx){try{
  const url=new URL(request.url);
  if(!environment.REVIEW_SESSION_KEY||environment.REVIEW_SESSION_KEY.length<32)return respond('Review session signing is not configured.',503);
  if(!environment.DB)return respond('Review database is not configured.',503);
  if(!['GET','POST'].includes(request.method))return respond('Method not allowed.',405);
  if(url.pathname.startsWith('/oauth/')||url.pathname==='/mcp'||['/api/tick','/api/scheduler-tick'].includes(url.pathname))return respond('This operation is unavailable in the public review demo.',403);
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return respond('Cross-origin request denied.',403);
  const visitor=await session(request,environment.REVIEW_SESSION_KEY);
  const owner='review:'+visitor.id,workspace=owner+':demo:'+visitor.id;
  let payload,body;
  if(request.method==='POST'){
    try{body=await bodyText(request);payload=JSON.parse(body);}catch(error){return respond(error.status?error.message:'Enter valid JSON.',error.status||400);}
    const op=url.pathname.slice(5);
    if(['connect','disconnect','sync','reconcile','leave-demo','automation-toggle','automation-run','source-save','sources-upload'].includes(op))return respond('The review demo uses fictional sources. Real accounts, uploads, external delivery, and background schedules are disabled.',403);
    if(op==='demo'){url.pathname='/api/reset-demo';}
    const mayRun=op==='run'||op==='run-state'&&payload.state==='Queued';
    if(mayRun&&environment.NEBIUS_API_KEY){
      const row=await environment.DB.prepare('SELECT data FROM workspaces WHERE id=? AND owner=?').bind(workspace,owner).first();
      if(row){const state=JSON.parse(row.data),run=op==='run'?payload:state.runs.find(x=>x.id===payload.id)||{};const context={request:run,sources:state.sources.filter(x=>(run.sources||[]).includes(x.id)),memories:state.settings.memory?state.memories.filter(x=>x.state==='Active'):[],skill:state.skills.find(x=>x.id===run.skill)};if(JSON.stringify(context).length>40000)return respond('The public demo limits each model request to 40,000 characters of selected context. Shorten the notes or memory first.',413);}
      if(!await reserve(environment.DB,'review:session-calls:'+visitor.id,20))return respond('This demo session has reached its 20-run allowance.',429);
      if(!await reserve(environment.DB,'review:total-calls',200))return respond('The public demo has reached its live inference allowance. Contact the project owner for review access.',429);
    }
  }
  if(url.pathname==='/api/state'){
    const data=initial(owner,true,'Reviewer');
    await environment.DB.prepare('INSERT OR IGNORE INTO workspaces(id,owner,data,updated_at) VALUES(?,?,?,?)').bind(workspace,owner,JSON.stringify(data),Date.now()).run();
  }
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.startsWith('oai-')||name==='authorization')headers.delete(name);
  headers.set('oai-authenticated-user-id',owner);
  headers.set('cookie','daylight_demo='+visitor.id);
  const env={DB:environment.DB,NEBIUS_API_KEY:environment.NEBIUS_API_KEY,NEBIUS_MODEL:environment.NEBIUS_MODEL,NEBIUS_BASE_URL:environment.NEBIUS_BASE_URL};
  let response=await application.fetch(new Request(url,{method:request.method,headers,...(body!==undefined?{body}: {})}),env,ctx);
  if(url.pathname==='/api/state'&&response.ok){const state=await response.json();state.setup.review=true;response=Response.json(state,{headers:response.headers});}
  const result=new Response(response.body,response);
  result.headers.set('Cache-Control','no-store');
  result.headers.set('X-Content-Type-Options','nosniff');
  if(visitor.fresh)result.headers.append('Set-Cookie','daylight_review='+visitor.token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'+(url.protocol==='https:'?'; Secure':''));
  return result;
}catch(error){return respond('The review demo could not complete this request. Please reload and try again.',500);}}};
