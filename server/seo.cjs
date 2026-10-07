'use strict';
const DEFAULT_ORIGIN='https://kamisuplatinum.com';
const pages={
 index:['神栖のメンズエステ・メンエス｜プラチナ【公式】','神栖市のメンズエステ（メンエス）プラチナ。セラピスト・本日の出勤・写メ日記・料金をご案内。千葉県方面からご来店を検討される方も、店舗情報とアクセスをご確認ください。'],
 staff:['セラピスト一覧｜神栖のメンズエステ プラチナ','神栖プラチナの公開中のセラピストをご紹介。プロフィールや写真、出勤予定をご確認いただけます。'],
 schedule:['本日の出勤・スケジュール｜神栖メンエス プラチナ','神栖のメンズエステ、プラチナの出勤情報。ご希望のセラピストと日時をご確認のうえ、電話・Webからご予約ください。'],
 diary:['写メ日記｜神栖のメンズエステ プラチナ','神栖プラチナのセラピスト写メ日記。写真とともに日々の出来事や出勤のお知らせをお届けします。'],
 price:['料金システム｜神栖のメンズエステ プラチナ','神栖プラチナのコース料金・指名料・延長料金をご案内。メンエスのご利用前に料金と注意事項をご確認ください。'],
 access:['アクセス・店舗情報｜神栖のメンズエステ プラチナ','茨城県神栖市のメンズエステ、プラチナの店舗情報。千葉県方面からのご来店をご検討の方も、営業時間・予約方法・アクセスをご確認ください。'],
 flow:['予約方法・ご利用の流れ｜神栖メンエス プラチナ','神栖プラチナの予約方法とご利用の流れ。セラピスト・日時・コースを選び、電話またはWebからご予約いただけます。'],
 news:['最新情報・お知らせ｜神栖のメンズエステ プラチナ','神栖プラチナからのお知らせ。イベントやセラピストに関する最新情報をご案内します。'],
 profile:['セラピストプロフィール｜神栖のメンズエステ プラチナ','神栖プラチナのセラピスト紹介。写真・紹介文・出勤予定・本人の写メ日記をご確認ください。']
};
const escape=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
function siteOrigin(env=process.env){const u=new URL(env.SITE_URL||DEFAULT_ORIGIN);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('SITE_URL must be an HTTPS origin');return u.origin;}
function decorate(html,name,origin=siteOrigin()){
 if(!pages[name])return html;
 const [title,description]=pages[name],canonical=origin+(name==='index'?'/':'/'+name+'.html');
 html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
 const metadata=`<link rel="canonical" href="${canonical}"><meta property="og:locale" content="ja_JP"><meta property="og:type" content="website"><meta property="og:site_name" content="神栖 プラチナ"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}">`;
 html=html.replace('</head>',metadata+'</head>');
 const links=Object.entries(pages).filter(([key])=>key!=='profile').map(([key,[t]])=>`<a href="${key==='index'?'/':key+'.html'}">${escape(t.split('｜')[0])}</a>`).join('');
 const intro=name==='index'?'<h2>神栖・千葉方面でメンエスをお探しの方へ</h2><p>プラチナは茨城県神栖市のメンズエステ（メンエス）です。個室のプライベート空間で、オイルを使ったリラクゼーションをご案内しています。千葉県方面からご来店を検討される方も、セラピストや料金、アクセスをご確認のうえご予約ください。店舗の所在地は茨城県神栖市です。</p>':'';
 html=html.replace(/<div class="site-loading" role="status">[\s\S]*?<\/div>/,`<main class="seo-fallback"><h1>${escape(title)}</h1><p>${escape(description)}</p>${intro}<nav aria-label="ページ一覧">${links}</nav><p role="status">最新情報を読み込んでいます…</p></main>`);
 if(name==='index'){
  const schema={'@context':'https://schema.org','@type':'LocalBusiness',name:'プラチナ',url:origin+'/',description,telephone:'070-9094-9709',address:{'@type':'PostalAddress',addressCountry:'JP',addressRegion:'茨城県',addressLocality:'神栖市'}};
  html=html.replace('</head>','<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script></head>');
 }
 return html;
}
function sitemap(therapists,origin=siteOrigin()){
 const urls=Object.keys(pages).filter(p=>p!=='profile').map(p=>origin+(p==='index'?'/':'/'+p+'.html'));
 for(const t of therapists)if(t.active===true&&typeof t.id==='string')urls.push(origin+'/profile.html?id='+encodeURIComponent(t.id));
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...new Set(urls)].map(url=>'<url><loc>'+escape(url)+'</loc></url>').join('')+'</urlset>';
}
function robots(origin=siteOrigin()){return 'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /*?preview=\nDisallow: /*&preview=\nSitemap: '+origin+'/sitemap.xml\n';}
module.exports={siteOrigin,decorate,sitemap,robots,pages};
