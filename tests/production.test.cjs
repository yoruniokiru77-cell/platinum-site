const test=require('node:test'),assert=require('node:assert/strict');
const {configurationErrors}=require('../server/config.cjs');
const env={SHIFT_PUBLIC_API_URL:'https://example.invalid/rest/v1/rpc/platinum_public_shifts',SHIFT_PUBLIC_API_KEY:'public',SHIFT_DATE_BASIS:'calendar'};
const config={url:'https://example.invalid',cmsEnabled:true};
test('production refuses demo CMS, absent key, foreign upstream and incorrect date basis',()=>{
 assert.deepEqual(configurationErrors(env,config),[]);
 assert.ok(configurationErrors(env,{...config,cmsEnabled:false}).includes('CMS_NOT_ENABLED'));
 assert.ok(configurationErrors({...env,SHIFT_PUBLIC_API_KEY:''},config).includes('SHIFT_API_KEY_MISSING'));
 assert.ok(configurationErrors({...env,SHIFT_PUBLIC_API_URL:'https://other.invalid/rest/v1/rpc/platinum_public_shifts'},config).includes('SHIFT_API_URL_INVALID'));
 assert.ok(configurationErrors({...env,SHIFT_DATE_BASIS:'business'},config).includes('SHIFT_DATE_BASIS_INVALID'));
});
