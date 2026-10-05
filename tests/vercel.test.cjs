const test=require('node:test'),assert=require('node:assert/strict');
const {createVercelService,authorized}=require('../server/vercel-shifts.cjs');
const env={SHIFT_PUBLIC_API_URL:'https://rzfprialypdoyklfwpyg.supabase.co/rest/v1/rpc/platinum_public_shifts',SHIFT_PUBLIC_API_KEY:'anon',SHIFT_DATE_BASIS:'calendar',SUPABASE_SERVICE_ROLE_KEY:'server-only',CRON_SECRET:'x'.repeat(40)};
test('cron rejects absent, short, and incorrect secrets',()=>{
 assert.equal(authorized(undefined,env.CRON_SECRET),false);assert.equal(authorized('Bearer bad',env.CRON_SECRET),false);assert.equal(authorized('Bearer short','short'),false);assert.equal(authorized('Bearer '+env.CRON_SECRET,env.CRON_SECRET),true);
});
test('durable snapshot survives new instances; failed and stale refreshes are not empty success',async()=>{
 let saved=null,fail=false,clock=Date.parse('2026-10-05T12:00:00+09:00');
 const fetcher=async(url,opts)=>{
  url=String(url);
  if(url.endsWith('/rpc/platinum_public_shifts')){assert.equal(opts.headers.apikey,'anon');return {ok:!fail,json:async()=>[{date:'2026-10-06',therapist_name:'テスト',therapist_id:null,start_time:'01:00',end_time:'03:00',memo:'never copy'}]};}
  assert.equal(opts.headers.apikey,'server-only');
  if(url.endsWith('/rpc/platinum_write_shift_cache')){const p=JSON.parse(opts.body);saved={from_date:p.p_from,to_date:p.p_to,attempted_at:p.p_attempted,shifts:p.p_rows,failed:p.p_error};return {ok:true,text:async()=>''};}
  return {ok:true,text:async()=>JSON.stringify(saved?[saved]:[])};
 };
 const make=()=>createVercelService({env,fetcher,now:()=>clock});
 await assert.rejects(()=>make().get('2026-10-05','2026-10-05'));
 await make().refresh();const result=await make().get('2026-10-05','2026-10-05');
 assert.equal(result.shifts[0].start_time,'25:00');assert.equal(result.shifts[0].end_time,'27:00');assert.equal(result.shifts[0].memo,undefined);
 clock+=600001;await assert.rejects(()=>make().get('2026-10-05','2026-10-05'));
 fail=true;await assert.rejects(()=>make().refresh());assert.equal(saved.failed,true);await assert.rejects(()=>make().get('2026-10-05','2026-10-05'));
});
test('anonymous callers cannot trigger refresh, and failed cache does not leak detail',async()=>{
 let calls=0;const svc=createVercelService({env,fetcher:async()=>{calls++;throw Error('secret detail');}});
 let status,body;const res={setHeader(){},set statusCode(v){status=v;},end(v){body=JSON.parse(v);}};
 await svc.cron({method:'GET',headers:{}},res);assert.equal(status,401);assert.equal(calls,0);
 await svc.handle({method:'GET',url:'/?from=2026-10-05&to=2026-10-05'},res);assert.equal(status,503);assert.equal(JSON.stringify(body).includes('secret detail'),false);
});
