'use strict';
const {sitemap}=require('../server/seo.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end();}
 try{
  const key=process.env.SHIFT_PUBLIC_API_KEY;
  const r=await fetch('https://rzfprialypdoyklfwpyg.supabase.co/rest/v1/platinum_public?store_id=eq.33333333-0000-0000-0000-000000000003&select=payload',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!r.ok)throw new Error('CMS_UNAVAILABLE');const rows=await r.json();const people=rows?.[0]?.payload?.therapists;
  if(!Array.isArray(people))throw new Error('CMS_UNAVAILABLE');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');res.statusCode=200;res.end(req.method==='HEAD'?undefined:sitemap(people));
 }catch{res.setHeader('Cache-Control','no-store');res.statusCode=503;res.end('<?xml version="1.0"?><error>Temporarily unavailable</error>');}
};
