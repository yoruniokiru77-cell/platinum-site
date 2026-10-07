const test=require('node:test');
const assert=require('node:assert/strict');
const {siteOrigin,decorate,sitemap,robots}=require('../server/seo.cjs');
test('custom domain is shared by metadata, robots and public-only sitemap',()=>{
 const origin=siteOrigin({SITE_URL:'https://example.com'});
 const html=decorate('<head><title>Old</title><meta name="description" content="old"></head><div class="site-loading" role="status">Loading</div>','index',origin);
 assert.match(html,/<link rel="canonical" href="https:\/\/example.com\/">/);
 assert.match(html,/神栖のメンズエステ/);assert.match(html,/application\/ld\+json/);
 assert.match(robots(origin),/Sitemap: https:\/\/example.com\/sitemap.xml/);
 const xml=sitemap([{id:'visible',active:true},{id:'hidden',active:false},{id:'unknown'},{id:'visible',active:true}],origin);
 assert.match(xml,/profile.html\?id=visible/);assert.doesNotMatch(xml,/id=hidden|id=unknown/);
 assert.equal((xml.match(/id=visible/g)||[]).length,1);
});
test('invalid canonical origins fail rather than publishing broken URLs',()=>{
 for(const url of ['http://example.com','https://example.com/path','https://user:password@example.com','https://example.com/?q=1'])assert.throws(()=>siteOrigin({SITE_URL:url}));
});
