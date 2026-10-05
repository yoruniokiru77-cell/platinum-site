// Read-only: no SQL execution, publishing, authentication changes, or private row output.
'use strict';
const {publicConfig,configurationErrors}=require('../server/config.cjs');
const {createService,businessToday,addDays}=require('../server/shifts.cjs');
const vercel=process.argv.includes('--vercel');
const config=publicConfig(vercel?'public/assets/config.js':'assets/config.js');let failures=0;
function report(ok,label){console.log((ok?'PASS ':'FAIL ')+label);if(!ok)failures++;}
async function request(table){
  const r=await fetch(config.url+'/rest/v1/'+table,{headers:{apikey:config.anonKey,Authorization:'Bearer '+config.anonKey},signal:AbortSignal.timeout(12000)});
  return {status:r.status,body:await r.json()};
}
(async()=>{
  const errors=configurationErrors(process.env,config);
  if(vercel&&!process.env.SUPABASE_SERVICE_ROLE_KEY)errors.push('CACHE_KEY_MISSING');
  if(vercel&&(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32))errors.push('CRON_SECRET_MISSING');
  report(!errors.length,'production configuration'+(errors.length?': '+errors.join(', '):''));
  try{const r=await request('platinum_public?select=revision&store_id=eq.'+config.storeId);report(r.status===200&&Array.isArray(r.body)&&r.body.length===1,'published CMS revision exists');}catch{report(false,'published CMS connection');}
  for(const table of ['platinum_drafts','platinum_admins']){
    try{const r=await request(table+'?select=store_id&limit=1');report([401,403].includes(r.status)||r.status===200&&Array.isArray(r.body)&&r.body.length===0,table+' blocks anonymous reads (HTTP '+r.status+(r.body?.code?', '+r.body.code:'')+')');}catch{report(false,table+' anonymous read check');}
  }
  try{const today=businessToday();const result=await createService().get(today,addDays(today,6));report(true,'public shift API: '+result.shifts.length+' rows (empty is a valid result)');}catch{report(false,'public shift API connection / response validation');}
  if(vercel){try{const today=businessToday();await require('../server/vercel-shifts.cjs').createVercelService().get(today,addDays(today,6));report(true,'Vercel durable cache is fresh');}catch{report(false,'Vercel durable cache (run authenticated refresh after deployment)');}}
  console.log(failures?'NOT READY: '+failures+' checks require setup.':'Read-only checks passed. Verify administrator login and publishing in the target environment before cutover.');
  process.exitCode=failures?1:0;
})();
