const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const defaults=JSON.parse(fs.readFileSync('assets/default-data.json','utf8'));
function setup(fetch=()=>{throw new Error('unexpected network');}){
  const context={URL,Date,AbortSignal,fetch,PLATINUM_CONFIG:{url:'https://example.invalid',anonKey:'public-key',storeId:'test-store'},URLSearchParams,location:{search:''},localStorage:{getItem:()=>null}};
  vm.runInNewContext(fs.readFileSync('assets/cms.js','utf8'),context);
  return {C:context.Platinum,context};
}
const copy=()=>JSON.parse(JSON.stringify(defaults));
test('legacy content validates, fixed profile ids are unique',()=>{
  const {C}=setup(),d=copy();assert.equal(C.validate(d).length,0);assert.equal(new Set(d.therapists.map(t=>t.id)).size,40);
});
test('unpublished therapists, news and shifts never enter public projection',()=>{
  const {C}=setup(),d=copy();d.password='private';d.therapists[0].active=false;d.news.push({body:'draft',published:false});
  d.shifts=[{therapistId:d.therapists[0].id,published:true},{therapistId:d.therapists[1].id,published:false},{therapistId:d.therapists[2].id,published:true}];
  const p=C.publicData(d);assert.equal(p.password,undefined);assert.equal(p.therapists.length,39);assert.equal(p.therapists[0].legacyIndex,1);assert.equal(p.news.length,1);assert.equal(p.shifts.length,1);assert.equal(d.therapists.length,40);
});
test('unsafe HTML and URL protocols are rejected or escaped',()=>{
  const {C}=setup();assert.equal(C.url('javascript:alert(1)'), '');assert.equal(C.url('data:image/svg+xml,<svg onload=alert(1)>',true),'');assert.equal(C.url('https://example.com/p'),'https://example.com/p');assert.equal(C.url('data:image/png;base64,AAAA',true),'data:image/png;base64,AAAA');assert.equal(C.escape('<img src=x onerror="run()">'),'&lt;img src=x onerror=&quot;run()&quot;&gt;');
});
test('overnight schedules validate as 26:00; reversed and duplicate shifts fail',()=>{
  const {C}=setup(),d=copy();const shift={id:'s',therapistId:d.therapists[0].id,date:'2026-10-04',start:'12:00',end:'26:00'};d.shifts=[shift];assert.equal(C.validate(d).length,0);shift.end='02:00';assert.ok(C.validate(d).some(e=>e.includes('出勤時間')));shift.end='26:00';d.shifts.push({...shift,id:'s2'});assert.ok(C.validate(d).some(e=>e.includes('重複')));
});
test('all shifts come from same-origin public API and ID mapping wins',async()=>{
 let requested;const d=copy();d.shiftSource='cms';d.therapists[0].supabaseId='11111111-1111-1111-1111-111111111111';
 const {C}=setup(async url=>{requested=url;return {ok:true,json:async()=>({ok:true,shifts:[{date:'2026-10-04',therapist_id:d.therapists[0].supabaseId,therapist_name:'改名後',start_time:'12:00',end_time:'26:00'}]})};});
 const rows=await C.shifts(d,'2026-10-04','2026-10-10');assert.equal(requested,'/api/shifts?from=2026-10-04&to=2026-10-10');assert.equal(rows[0].therapistId,d.therapists[0].id);
});
test('failed reads reject while successful empty reads return zero',async()=>{
 const {C}=setup(async()=>({ok:false,json:async()=>({ok:false,error:{code:'SHIFT_FETCH_FAILED'}})}));await assert.rejects(()=>C.shifts(copy(),'2026-10-04'));
 const good=setup(async()=>({ok:true,json:async()=>({ok:true,shifts:[]})}));assert.equal((await good.C.shifts(copy(),'2026-10-04')).length,0);
});

test('anonymous normal pages ignore local previews',async()=>{
  const {C,context}=setup(async()=>({ok:true,json:async()=>copy()}));context.localStorage.getItem=()=>JSON.stringify({...copy(),shop:{...defaults.shop,name:'DRAFT ONLY'}});const normal=await C.loadPublic();assert.equal(normal.data.shop.name,defaults.shop.name);context.location.search='?preview=1';const preview=await C.loadPublic();assert.equal(preview.preview,true);assert.equal(preview.data.shop.name,'DRAFT ONLY');
});

test('production CMS failures never restore old default therapist profiles',async()=>{
 for(const rows of [[],null]){
  const {C,context}=setup(async()=>({ok:rows!==null,text:async()=>JSON.stringify(rows)}));context.PLATINUM_CONFIG.cmsEnabled=true;
  await assert.rejects(()=>C.loadPublic(),/最新の公開情報/);
 }
});
