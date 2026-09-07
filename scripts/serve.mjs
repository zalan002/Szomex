import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/lead.js';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  if(req.url.split('?')[0]==='/api/lead'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    req.body=Buffer.concat(chunks).toString();res.status=function(code){this.statusCode=code;return this;};res.json=function(data){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(data));};return handler(req,res);
  }
  try{const url=new URL(req.url,'http://localhost');const requested=decodeURIComponent(url.pathname).replace(/\/$/,'')||'/';let file=path.resolve(root,'.'+requested);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}if(requested==='/')file=path.join(root,'index.html');else if(!path.extname(file))file+='.html';if((await stat(file)).isDirectory())throw new Error('directory');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(path.join(root,'404.html'),'utf8'));}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173'));
