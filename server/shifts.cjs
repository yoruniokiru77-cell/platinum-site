'use strict';
const DAY=86400000, TTL=300000;
function validDate(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function addDays(date,days){return new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);}
function range(from,to){if(!validDate(from)||!validDate(to)||from>to||(Date.parse(to)-Date.parse(from))/DAY>30)throw new Error('INVALID_RANGE');}
function businessToday(now=Date.now()){return new Date(now+6*3600000).toISOString().slice(0,10);}
function minutes(value){if(typeof value!=='string'||!/^([0-3]\d|4[0-7]):[0-5]\d(?::00(?:\.0+)?)?$/.test(value))throw new Error('INVALID_UPSTREAM');return Number(value.slice(0,2))*60+Number(value.slice(3,5));}
function format(value){return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
function normalize(rows,from,to,basis){
  if(!['calendar','business'].includes(basis))throw new Error('DATE_BASIS_REQUIRED');
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('INVALID_UPSTREAM');
  return rows.map(s=>{
    if(!validDate(s.date)||typeof s.therapist_name!=='string'||!s.therapist_name.trim()||s.therapist_name.length>100||s.therapist_id!=null&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s.therapist_id))throw new Error('INVALID_UPSTREAM');
    let start=minutes(s.start_time),end=minutes(s.end_time),date=s.date;
    if(start<180){if(basis==='calendar')date=addDays(date,-1);start+=1440;}
    if(end<180)end+=1440;
    if(end<start)end+=1440;
    if(end<=start||end-start>1440)throw new Error('INVALID_UPSTREAM');
    // Deliberately construct a fresh object: never forward additional upstream fields.
    return {date,therapist_id:s.therapist_id||null,therapist_name:s.therapist_name.trim(),start_time:format(start),end_time:format(end)};
  }).filter(s=>s.date>=from&&s.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.start_time.localeCompare(b.start_time)||a.therapist_name.localeCompare(b.therapist_name));
}
function createService({env=process.env,fetcher=fetch,now=Date.now}={}){
  const cache=new Map();
  async function refresh(entry){
    if(entry.pending)return entry.pending;
    entry.pending=Promise.resolve().then(async()=>{
      try{
        if(!env.SHIFT_PUBLIC_API_URL||!['calendar','business'].includes(env.SHIFT_DATE_BASIS))throw new Error('NOT_CONFIGURED');
        const endpoint=new URL(env.SHIFT_PUBLIC_API_URL);
        if(endpoint.protocol!=='https:')throw new Error('NOT_CONFIGURED');
        const headers={'Content-Type':'application/json'};
        if(env.SHIFT_PUBLIC_API_KEY){headers.apikey=env.SHIFT_PUBLIC_API_KEY;headers.Authorization='Bearer '+env.SHIFT_PUBLIC_API_KEY;}
        const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify({p_from:entry.from,p_to:addDays(entry.to,env.SHIFT_DATE_BASIS==='calendar'?1:0)}),signal:AbortSignal.timeout(12000),redirect:'error'});
        if(!response.ok)throw new Error('UPSTREAM_UNAVAILABLE');
        const rows=await response.json();
        entry.rows=normalize(rows,entry.from,entry.to,env.SHIFT_DATE_BASIS);
        entry.updated=now();entry.error=null;
      }catch{entry.error='SHIFT_FETCH_FAILED';throw new Error(entry.error);}
      finally{entry.pending=null;}
    });
    return entry.pending;
  }
  async function get(from,to){
    range(from,to);const key=from+'|'+to;
    let entry=cache.get(key);
    if(!entry){if(cache.size>=32)cache.delete(cache.keys().next().value);entry={from,to,updated:null};cache.set(key,entry);}
    if(entry.updated===null||entry.error||now()-entry.updated>=TTL)await refresh(entry);
    return {ok:true,from,to,timezone:'Asia/Tokyo',updated_at:new Date(entry.updated).toISOString(),shifts:entry.rows};
  }
  async function refreshAll(){
    const today=businessToday(now());
    const initial=get(today,addDays(today,6));
    await Promise.allSettled([initial,...[...cache.values()].map(refresh)]);
  }
  async function handle(req,res){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.setHeader('Allow','GET');res.writeHead(405).end(JSON.stringify({ok:false,error:{code:'METHOD_NOT_ALLOWED'}}));return;}
    const query=new URL(req.url,'http://localhost').searchParams;
    try{const result=await get(query.get('from'),query.get('to'));res.writeHead(200).end(JSON.stringify(result));}
    catch(e){const invalid=e.message==='INVALID_RANGE';res.writeHead(invalid?400:503).end(JSON.stringify({ok:false,error:{code:invalid?'INVALID_RANGE':'SHIFT_FETCH_FAILED',message:invalid?'日付範囲はYYYY-MM-DD形式で最大31日間を指定してください。':'出勤情報を取得できませんでした。時間をおいて再度ご確認ください。'}}));}
  }
  return {get,handle,refreshAll,start(){void refreshAll();const timer=setInterval(()=>void refreshAll(),TTL);timer.unref();return ()=>clearInterval(timer);}};
}
module.exports={createService,normalize,range,businessToday,addDays};
