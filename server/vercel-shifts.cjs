'use strict';
const {timingSafeEqual}=require('node:crypto');
const {createService,businessToday,addDays,range,normalize}=require('./shifts.cjs');
const STORE='33333333-0000-0000-0000-000000000003';
const MAX_AGE=10*60*1000;
function authorized(header,secret){
  if(!secret||secret.length<32||typeof header!=='string')return false;
  const a=Buffer.from(header),b=Buffer.from('Bearer '+secret);
  return a.length===b.length&&timingSafeEqual(a,b);
}
function createVercelService({env=process.env,fetcher=fetch,now=Date.now}={}){
  async function cacheRequest(path,options={}){
    if(!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('CACHE_NOT_CONFIGURED');
    const source=new URL(env.SHIFT_PUBLIC_API_URL);
    if(source.origin!=='https://rzfprialypdoyklfwpyg.supabase.co')throw new Error('CACHE_NOT_CONFIGURED');
    const r=await fetcher(source.origin+'/rest/v1/'+path,{...options,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!r.ok)throw new Error('CACHE_UNAVAILABLE');
    const text=await r.text();return text?JSON.parse(text):null;
  }
  async function refresh(){
    const attempted=new Date(now()).toISOString(),from=businessToday(now()),to=addDays(from,30);
    // A new source service forces a fresh upstream request, even on warm invocations.
    let snapshot;
    try{snapshot=await createService({env,fetcher,now}).get(from,to);}
    catch{
      await cacheRequest('rpc/platinum_write_shift_cache',{method:'POST',body:JSON.stringify({p_from:from,p_to:to,p_attempted:attempted,p_rows:[],p_error:true})});
      throw new Error('SHIFT_FETCH_FAILED');
    }
    await cacheRequest('rpc/platinum_write_shift_cache',{method:'POST',body:JSON.stringify({p_from:from,p_to:to,p_attempted:attempted,p_rows:snapshot.shifts,p_error:false})});
    return {ok:true,updated_at:snapshot.updated_at,count:snapshot.shifts.length};
  }
  async function get(from,to){
    range(from,to);
    const rows=await cacheRequest('platinum_shift_cache?store_id=eq.'+STORE+'&select=from_date,to_date,attempted_at,shifts,failed');
    const entry=Array.isArray(rows)&&rows[0];
    if(!entry||entry.failed||!Number.isFinite(Date.parse(entry.attempted_at))||now()-Date.parse(entry.attempted_at)>MAX_AGE||Date.parse(entry.attempted_at)>now()+60000)throw new Error('SHIFT_FETCH_FAILED');
    // Dates outside the rolling snapshot remain supported through a server-side range request.
    if(from<entry.from_date||to>entry.to_date)return createService({env,fetcher,now}).get(from,to);
    const safe=normalize(entry.shifts,from,to,'business');
    return {ok:true,from,to,timezone:'Asia/Tokyo',updated_at:entry.attempted_at,shifts:safe};
  }
  function send(res,status,body){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.statusCode=status;res.end(JSON.stringify(body));}
  async function handle(req,res){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED'}});}
    const q=new URL(req.url,'http://localhost').searchParams;
    try{send(res,200,await get(q.get('from'),q.get('to')));}catch(e){send(res,e.message==='INVALID_RANGE'?400:503,{ok:false,error:{code:e.message==='INVALID_RANGE'?'INVALID_RANGE':'SHIFT_FETCH_FAILED'}});}
  }
  async function cron(req,res){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED'}});}
    if(!authorized(req.headers.authorization,env.CRON_SECRET))return send(res,401,{ok:false,error:{code:'UNAUTHORIZED'}});
    try{send(res,200,await refresh());}catch{send(res,503,{ok:false,error:{code:'SHIFT_FETCH_FAILED'}});}
  }
  return {get,refresh,handle,cron};
}
module.exports={createVercelService,authorized};
