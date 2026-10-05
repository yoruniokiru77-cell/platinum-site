'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function publicConfig(filename='assets/config.js'){
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),context);
  return context.window.PLATINUM_CONFIG;
}
function configurationErrors(env=process.env,config=publicConfig()){
  const errors=[];
  if(!config.cmsEnabled)errors.push('CMS_NOT_ENABLED');
  if(!env.SHIFT_PUBLIC_API_KEY)errors.push('SHIFT_API_KEY_MISSING');
  try{const url=new URL(env.SHIFT_PUBLIC_API_URL);if(url.protocol!=='https:'||url.origin!==new URL(config.url).origin||url.pathname!=='/rest/v1/rpc/platinum_public_shifts')errors.push('SHIFT_API_URL_INVALID');}catch{errors.push('SHIFT_API_URL_INVALID');}
  if(env.SHIFT_DATE_BASIS!=='calendar')errors.push('SHIFT_DATE_BASIS_INVALID');
  return errors;
}
module.exports={publicConfig,configurationErrors};
