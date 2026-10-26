import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {database} from './local-db.mjs';
const env={...process.env,LOCAL_DEV:true,DB:database('.local.sqlite')};
const localEnv='.env.local';if(existsSync(localEnv))for(const line of readFileSync(localEnv,'utf8').split(/\r?\n/)){if(line&&!line.startsWith('#')&&line.includes('=')){const p=line.indexOf('=');env[line.slice(0,p)]=line.slice(p+1);}}
const pending=new Set();let worker;let stamp='';
http.createServer(async(req,res)=>{try{const fs=await import('node:fs/promises');const current=String((await fs.stat('worker/index.js')).mtimeMs);if(current!==stamp){worker=(await import(pathToFileURL(process.cwd()+'/worker/index.js').href+'?v='+current)).default;stamp=current;}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:4317'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});const response=await worker.fetch(request,env,{waitUntil(p){pending.add(p);p.finally(()=>pending.delete(p));}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){console.error(e.message);res.writeHead(500);res.end('Local preview error.');}}).listen(4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4317'));
