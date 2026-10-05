const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDiary,project,createDiaryService,imageUrl}=require('../server/diary.cjs');
const stamp='2026-10-05T05:00:00.000Z',now=()=>Date.parse(stamp);
const row={id:'42',cast_id:'630410',title:'日記',body:'本文',photos:[],posted_at:stamp};
const person={id:'therapist-18',name:'あんな',active:true};
function html(content='こんにちは<br>またね',cast='630410'){
 return `<title>写メNote - プレミアム</title><p>全 1 件</p><ul class="p-shop-bloglist-list"><li class="p-shop-bloglist-list__item"><div class="p-shop-bloglist-list__item-therapist" id="42"><a class="p-therapist-diary__name" href="https://estama.jp/shop/35702/cast/${cast}/">あんな</a></div><time datetime="2026-10-05T14:00:00+09:00"></time><h3 class="p-shop-bloglist-list__item-title">日記</h3><div class="p-shop-bloglist-list__item-imgs"><img src="https://img.estama.jp/shop_data/00000035702/diary/a.jpg"><img src="https://evil.example/a.jpg"></div><p class="p-shop-bloglist-list__item-body">${content}</p></li></ul>`;
}
test('diary extracts only text, shop-owned image URLs and Tokyo timestamps',()=>{
 const parsed=parseDiary(html('こんにちは<br>またね<script>bad()</script>&lt;img src=x&gt;'));
 assert.equal(parsed.length,1);assert.equal(parsed[0].body,'こんにちは\nまたね<img src=x>');assert.equal(parsed[0].posted_at,stamp);assert.equal(parsed[0].photos.length,1);assert.equal(imageUrl('javascript:alert(1)'), '');
});
test('layout changes, partial results, other shops and challenge pages fail closed',()=>{
 for(const doc of ['<title>Challenge</title>',html().replace('全 1 件','全 2 件'),html().replace('/shop/35702/cast/','/shop/99999/cast/'),html().replace('2026-10-05T14:00:00+09:00','invalid')])assert.throws(()=>parseDiary(doc));
});
test('only active mapped therapists appear; names alone never create a match',()=>{
 assert.equal(project([row],[person]).length,1);
 for(const p of [{...person,active:false},{...person,diaryDisabled:true},{...person,estamaId:''},{...person,id:'other'}])assert.equal(project([row],[p]).length,0);
 assert.equal(project([row],[person,{...person,id:'other',estamaId:'630410'}]).length,0);
 const result=project([{...row,secret:'private'}],[{...person,name:'改名後'}]);assert.equal(result[0].therapist_name,'改名後');assert.equal(result[0].secret,undefined);
});
function service({age=0,entries=[row],people=[person],fetchFailure=false}={}){
 return createDiaryService({now,env:{SUPABASE_SERVICE_ROLE_KEY:'test',CRON_SECRET:'x'.repeat(64)},config:{url:'https://rzfprialypdoyklfwpyg.supabase.co',anonKey:'anon'},fetcher:async url=>{
  if(fetchFailure)throw new Error('offline');
  const value=url.includes('platinum_public')?[{payload:{therapists:people}}]:[{entries,updated_at:new Date(now()-age).toISOString()}];
  return new Response(JSON.stringify(value));
 }});
}
test('diary pagination and therapist filters use public rows only',async()=>{
 const entries=Array.from({length:17},(_,i)=>({...row,id:String(i)}));const s=service({entries});
 const result=await s.get(new URLSearchParams('limit=5&page=2'));assert.equal(result.total,17);assert.equal(result.entries.length,5);assert.equal(result.entries[0].id,'5');
 assert.equal((await s.get(new URLSearchParams('therapist=not-public'))).total,0);
 assert.equal((await s.get(new URLSearchParams('id=3'))).entries[0].id,'3');
 for(const q of ['page=0','limit=51','id=bad','therapist=a%26b'])await assert.rejects(()=>s.get(new URLSearchParams(q)),/INVALID_QUERY/);
});
test('empty results are successful; upstream errors and expired cache are errors',async()=>{
 assert.equal((await service({entries:[]}).get(new URLSearchParams())).total,0);
 assert.equal((await service({age:21*60000}).get(new URLSearchParams())).stale,true);
 await assert.rejects(()=>service({age:46*60000}).get(new URLSearchParams()));
 await assert.rejects(()=>service({fetchFailure:true}).get(new URLSearchParams()));
});
test('refresh failure leaves stored snapshot untouched and cron rejects anonymous calls',async()=>{
 let writes=0;const s=createDiaryService({now,env:{SUPABASE_SERVICE_ROLE_KEY:'test'},fetcher:async(url,options)=>{if(options?.method==='POST')writes++;throw new Error('offline');}});
 await assert.rejects(()=>s.refresh());assert.equal(writes,0);
 const res={setHeader(){},end(body){this.body=body;}};await s.cron({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
});
