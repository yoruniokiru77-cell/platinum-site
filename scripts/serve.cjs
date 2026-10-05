const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createService}=require('../server/shifts.cjs');
const {configurationErrors}=require('../server/config.cjs');
if(process.env.NODE_ENV==='production'){
  const errors=configurationErrors();
  if(errors.length){console.error('Production configuration incomplete: '+errors.join(', '));process.exit(1);}
}
const shifts=createService();
shifts.start();
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const allowed=new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp']);
const server=http.createServer((req,res)=>{
  let relative;try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(relative==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"ok":true}');return;}
  if(relative==='/admin.html')res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(relative==='/api/shifts'){void shifts.handle(req,res);return;}
  if(!/^\/(?:[^/]+\.html|assets\/[^/]+|tests\/responsive\.html)?$/.test(relative)||process.env.NODE_ENV==='production'&&relative.startsWith('/tests/')){res.writeHead(404).end();return;}
  const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)||relative.split('/').some(x=>x.startsWith('.'))||!allowed.has(path.extname(file))){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
}).listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>console.log('Platinum server started'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
