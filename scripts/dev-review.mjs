import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {database} from './local-db.mjs';
import review from '../deploy/review-worker.mjs';
const env={DB:database('.review.sqlite'),REVIEW_SESSION_KEY:randomBytes(48).toString('hex')};
if(existsSync('.env.local'))for(const line of readFileSync('.env.local','utf8').split(/\r?\n/)){const p=line.indexOf('=');if(p>0&&['NEBIUS_API_KEY','NEBIUS_MODEL','NEBIUS_BASE_URL'].includes(line.slice(0,p)))env[line.slice(0,p)]=line.slice(p+1);}
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:4318'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});const response=await review.fetch(request,env,{waitUntil(p){p.catch(()=>{});}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local review preview error.');}}).listen(4318,'127.0.0.1',()=>console.log('Local review: http://127.0.0.1:4318'));
