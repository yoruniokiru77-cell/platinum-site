const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,normalize,range,businessToday}=require('../server/shifts.cjs');
const row={date:'2026-10-05',therapist_id:'11111111-1111-1111-1111-111111111111',therapist_name:'テスト',start_time:'12:00:00',end_time:'02:00:00'};
const env={SHIFT_PUBLIC_API_URL:'https://example.invalid/rpc/platinum_public_shifts',SHIFT_DATE_BASIS:'calendar',SHIFT_PUBLIC_API_KEY:'public'};
test('calendar midnight belongs to previous business date; business dates are not shifted twice',()=>{
 const early={...row,start_time:'01:00',end_time:'02:30'};
 assert.deepEqual(normalize([early],'2026-10-04','2026-10-04','calendar')[0],{...early,date:'2026-10-04',start_time:'25:00',end_time:'26:30'});
 assert.equal(normalize([early],'2026-10-05','2026-10-05','business')[0].date,'2026-10-05');
 assert.equal(normalize([{...early,date:'2026-01-01'}],'2025-12-31','2025-12-31','calendar')[0].date,'2025-12-31');
 assert.equal(normalize([{...early,date:'2024-03-01'}],'2024-02-29','2024-02-29','calendar').length,1);
 assert.equal(normalize([{...early,start_time:'02:59',end_time:'03:30'}],'2026-10-04','2026-10-04','calendar')[0].end_time,'27:30');
 assert.equal(normalize([{...early,start_time:'03:00',end_time:'04:00'}],'2026-10-04','2026-10-04','calendar').length,0);
 assert.equal(businessToday(Date.parse('2026-10-05T02:59:00+09:00')),'2026-10-04');
 assert.equal(businessToday(Date.parse('2026-10-05T03:00:00+09:00')),'2026-10-05');
});
test('public response is a strict field allowlist, validates malformed responses',()=>{
 const rows=normalize([{...row,phone:'secret',line_id:'secret',salary:999,memo:'secret',room_id:'secret'}],'2026-10-05','2026-10-05','calendar');
 assert.deepEqual(Object.keys(rows[0]),['date','therapist_id','therapist_name','start_time','end_time']);assert.equal(rows[0].end_time,'26:00');
 for(const bad of [null,{},[{...row,date:'2026-02-30'}],[{...row,start_time:'oops'}]])assert.throws(()=>normalize(bad,'2026-10-05','2026-10-05','calendar'));
 assert.throws(()=>normalize([],'2026-10-05','2026-10-05',''));
});
test('strict inclusive date ranges, maximum 31 days',()=>{
 range('2026-10-01','2026-10-31');
 for(const r of [[null,null],['2026-02-30','2026-03-01'],['2026-10-05','2026-10-04'],['2026-10-01','2026-11-01']])assert.throws(()=>range(...r));
});
test('server expands calendar range, coalesces requests, caches and never disguises failure as empty',async()=>{
 let time=0,calls=0,fail=false,body;
 const service=createService({env,now:()=>time,fetcher:async(url,options)=>{calls++;body=JSON.parse(options.body);return {ok:!fail,json:async()=>[]};}});
 const result=await Promise.all([service.get('2026-10-05','2026-10-06'),service.get('2026-10-05','2026-10-06')]);assert.equal(calls,1);assert.equal(body.p_to,'2026-10-07');assert.deepEqual(result[0].shifts,[]);
 await service.get('2026-10-05','2026-10-06');assert.equal(calls,1);
 time=300001;fail=true;await assert.rejects(()=>service.get('2026-10-05','2026-10-06'));fail=false;await service.get('2026-10-05','2026-10-06');assert.equal(calls,3);
});
test('HTTP contract distinguishes empty 200, invalid 400, and failed 503 without upstream details',async()=>{
 for(const [config,url,method,status] of [[env,'/?from=2026-10-05&to=2026-10-05','GET',200],[{},'/?from=2026-10-05&to=2026-10-05','GET',503],[env,'/?from=bad&to=bad','GET',400],[env,'/','POST',405]]){
  let code,payload;const res={setHeader(){},writeHead(n){code=n;return this;},end(s){payload=JSON.parse(s);}};
  await createService({env:config,fetcher:async()=>({ok:true,json:async()=>[]})}).handle({method,url},res);
  assert.equal(code,status);assert.equal(payload.ok,status===200);if(status!==200)assert.equal(payload.shifts,undefined);
 }
});
test('periodic refresh updates previously requested ranges without visitor requests',async()=>{
 let calls=0;const service=createService({env,fetcher:async()=>{calls++;return {ok:true,json:async()=>[]};}});
 await service.get('2026-10-05','2026-10-06');const before=calls;await service.refreshAll();assert.ok(calls>before);
});
