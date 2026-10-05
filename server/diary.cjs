'use strict';
const {load}=require('cheerio');
const {publicConfig}=require('./config.cjs');
const {authorized}=require('./vercel-shifts.cjs');
const initialMap=require('../assets/estama-map.json');
const SOURCE='https://estama.jp/shop/35702/bloglist/';
const STORE='33333333-0000-0000-0000-000000000003';
const MAX_AGE=45*60*1000;
function imageUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='img.estama.jp'&&!u.port&&!u.username&&!u.password&&u.pathname.startsWith('/shop_data/00000035702/')?u.href:'';}catch{return '';}
}
function parseDiary(html){
  const $=load(html),items=$('.p-shop-bloglist-list > .p-shop-bloglist-list__item');
  if(!$('title').text().includes('プレミアム')||!$('.p-shop-bloglist-list').length)throw new Error('DIARY_FORMAT_CHANGED');
  const rows=[],ids=new Set();
  items.each((_,el)=>{
    const item=$(el),id=item.find('.p-shop-bloglist-list__item-therapist').attr('id');
    const href=item.find('.p-therapist-diary__name').attr('href')||'';
    const cast=href.match(/^https:\/\/estama\.jp\/shop\/35702\/cast\/(\d+)\/$/);
    const stamp=item.find('time').attr('datetime'),title=item.find('.p-shop-bloglist-list__item-title').text().trim();
    const content=item.find('.p-shop-bloglist-list__item-body').clone();
    if(!/^\d+$/.test(id)||!cast||!stamp||!Number.isFinite(Date.parse(stamp))||!title||!content.length||ids.has(id))throw new Error('DIARY_FORMAT_CHANGED');
    content.find('script,style,iframe,object,svg').remove();content.find('br').replaceWith('\n');
    const body=content.text().replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
    const photos=item.find('.p-shop-bloglist-list__item-imgs img').toArray().map(img=>imageUrl($(img).attr('src'))).filter(Boolean);
    rows.push({id,cast_id:cast[1],title:title.slice(0,200),body:body.slice(0,20000),photos:[...new Set(photos)].slice(0,10),posted_at:new Date(stamp).toISOString()});ids.add(id);
  });
  // Never silently replace a changed or truncated source layout with an empty archive.
  const count=$('body').text().match(/全\s*([\d,]+)\s*件/);
  if(!count||Number(count[1].replaceAll(',',''))!==rows.length)throw new Error('DIARY_FORMAT_CHANGED');
  return rows.sort((a,b)=>b.posted_at.localeCompare(a.posted_at)||Number(b.id)-Number(a.id));
}
function mappedId(t){return t.diaryDisabled?'':Object.hasOwn(t,'estamaId')?String(t.estamaId||''):initialMap[t.id]?.id||'';}
function project(rows,therapists){
  const owners=new Map();
  for(const t of therapists.filter(t=>t.active===true)){const id=mappedId(t);if(id)owners.set(id,owners.has(id)?null:t);}
  return rows.flatMap(row=>{
    const t=owners.get(row.cast_id);if(!t)return [];
    return [{id:row.id,therapist_id:t.id,therapist_name:t.name,title:row.title,body:row.body,photos:(row.photos||[]).map(imageUrl).filter(Boolean),posted_at:row.posted_at,source_url:SOURCE+'#'+row.id}];
  });
}
async function limitedText(response,max){
  if(!response.ok)throw new Error('DIARY_FETCH_FAILED');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('DIARY_TOO_LARGE');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return Buffer.concat(chunks).toString('utf8');
}
function createDiaryService({env=process.env,fetcher=fetch,now=Date.now,config=env.VERCEL?{url:'https://rzfprialypdoyklfwpyg.supabase.co',anonKey:env.SHIFT_PUBLIC_API_KEY}:publicConfig()}={}){
  let memory,inflight;
  async function db(path,options={}){
    const key=env.SUPABASE_SERVICE_ROLE_KEY||config.anonKey;
    const response=await fetcher(config.url+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!response.ok)throw new Error('DIARY_DATABASE_FAILED');const text=await response.text();return text?JSON.parse(text):null;
  }
  async function source(){
    const response=await fetcher(SOURCE,{headers:{'User-Agent':'PlatinumDiary/1.0 (+https://platinum-site-theta.vercel.app/)','Accept':'text/html'},signal:AbortSignal.timeout(18000),redirect:'error'});
    if(!(response.headers.get('content-type')||'').includes('text/html'))throw new Error('DIARY_FORMAT_CHANGED');
    return parseDiary(await limitedText(response,3000000));
  }
  async function refresh(){
    const at=new Date(now()).toISOString(),rows=await source();
    if(env.SUPABASE_SERVICE_ROLE_KEY)await db('rpc/platinum_write_diary_cache',{method:'POST',body:JSON.stringify({p_attempted:at,p_entries:rows})});
    memory={entries:rows,updated_at:at};return {ok:true,count:rows.length,updated_at:at};
  }
  async function snapshot(){
    if(env.SUPABASE_SERVICE_ROLE_KEY){const result=await db('platinum_diary_cache?store_id=eq.'+STORE+'&select=entries,updated_at');return result?.[0];}
    // Local development only. Production uses a shared private Supabase snapshot.
    if(env.VERCEL)throw new Error('DIARY_NOT_CONFIGURED');
    if(!memory||now()-Date.parse(memory.updated_at)>15*60000){if(!inflight)inflight=refresh().finally(()=>inflight=null);await inflight;}return memory;
  }
  async function get(query){
    const limit=Number(query.get('limit')||12),page=Number(query.get('page')||1),therapist=query.get('therapist'),id=query.get('id');
    if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(page)||page<1||page>1000||therapist&&!/^[a-zA-Z0-9_-]{1,100}$/.test(therapist)||id&&!/^\d{1,20}$/.test(id))throw new Error('INVALID_QUERY');
    const [cache,published]=await Promise.all([snapshot(),db('platinum_public?store_id=eq.'+STORE+'&select=payload')]);
    const age=now()-Date.parse(cache?.updated_at);
    if(!cache||!Array.isArray(cache.entries)||!Number.isFinite(age)||age>MAX_AGE||age < -60000||!Array.isArray(published?.[0]?.payload?.therapists))throw new Error('DIARY_FETCH_FAILED');
    const rows=project(cache.entries,published[0].payload.therapists).filter(r=>(!therapist||r.therapist_id===therapist)&&(!id||r.id===id));
    return {ok:true,updated_at:cache.updated_at,stale:age>20*60000,total:rows.length,page,limit,entries:rows.slice((page-1)*limit,page*limit)};
  }
  function send(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(value));}
  async function handle(req,res){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED'}});}
    try{return send(res,200,await get(new URL(req.url,'http://localhost').searchParams));}catch(e){return send(res,e.message==='INVALID_QUERY'?400:503,{ok:false,error:{code:e.message==='INVALID_QUERY'?'INVALID_QUERY':'DIARY_FETCH_FAILED'}});}
  }
  async function cron(req,res){
    if(req.method!=='GET')return send(res,405,{ok:false});
    if(!authorized(req.headers.authorization,env.CRON_SECRET))return send(res,401,{ok:false});
    try{return send(res,200,await refresh());}catch{return send(res,503,{ok:false,error:{code:'DIARY_FETCH_FAILED'}});}
  }
  return {get,refresh,handle,cron};
}
module.exports={parseDiary,project,mappedId,imageUrl,createDiaryService,SOURCE};
