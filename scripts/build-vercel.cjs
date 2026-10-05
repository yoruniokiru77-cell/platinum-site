'use strict';
const fs=require('node:fs'),path=require('node:path');
const {publicConfig}=require('../server/config.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public');
// Only allowlisted public assets are copied; server source, SQL and .env never become static files.
fs.mkdirSync(out,{recursive:true});
for(const name of ['index','admin','staff','schedule','profile','price','access','flow','news'])fs.copyFileSync(path.join(root,name+'.html'),path.join(out,name+'.html'));
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
for(const name of ['admin.js','admin.css','cms.js','site.js','site.css','default-data.json'])fs.copyFileSync(path.join(root,'assets',name),path.join(out,'assets',name));
const config=publicConfig();
// Enable cloud CMS on Vercel only; local demos keep their existing configuration.
config.cmsEnabled=true;
fs.writeFileSync(path.join(out,'assets/config.js'),'window.PLATINUM_CONFIG = '+JSON.stringify(config,null,2)+';\n');
console.log('Vercel static output prepared; cloud CMS enabled.');
