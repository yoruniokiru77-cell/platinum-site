const fs=require('node:fs');
const pages={index:['home','神栖 メンズエステ プラチナ | Platinum'],staff:['staff','セラピスト一覧 | 神栖 プラチナ'],schedule:['schedule','出勤スケジュール | 神栖 プラチナ'],profile:['profile','プロフィール | 神栖 プラチナ'],price:['price','料金システム | 神栖 プラチナ'],access:['access','アクセス | 神栖 プラチナ'],flow:['flow','予約方法・ご利用の流れ | 神栖 プラチナ'],news:['news','お知らせ | 神栖 プラチナ']};
for(const [file,[page,title]]of Object.entries(pages)){
  fs.writeFileSync(file+'.html',`<!doctype html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="神栖のメンズエステ、プラチナ。セラピストのプロフィール・出勤情報・料金・アクセスをご案内。電話・Webからご予約いただけます。">
<meta name="theme-color" content="#a47c3d">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/config.js" defer></script><script src="assets/cms.js" defer></script><script src="assets/site.js" defer></script>
</head><body data-page="${page}">
<div id="site"><div class="site-loading" role="status">Platinum — 読み込んでいます</div></div>
<noscript><div class="no-script"><h1>プラチナ 神栖</h1><p>ページの表示にはJavaScriptを有効にしてください。</p><p>営業時間 12:00〜翌2:00</p><a href="tel:07090949709">070-9094-9709</a> ／ <a href="https://estama.jp/shop/35702/reserve/">Web予約</a></div></noscript>
</body></html>
`);
}
// Keep stable legacy profile indices when hidden entries are filtered from public output.
const path='assets/default-data.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
data.therapists.forEach((t,i)=>{t.legacyIndex??=i;t.pickup??=data.pickup.idxList.includes(i);});
data.ranking ||= [];
data.shop.heroTitle ||= '心ほどける、特別なひととき。';
data.shop.heroText ||= '神栖のプライベート空間で、あなたのためのリラクゼーションを。';
data.notices ||= [
  {title:'サービスについて',body:'コース時間はご予約時間から退室までで、シャワーもお時間に含まれます。当日セラピストが体調不良等でご案内できない場合がございます。当サロンは風俗店ではございません。性風俗的サービスは一切行っておりません。医療法が定める施術所ではありません。'},
  {title:'禁止事項',body:'18歳未満の方のご利用不可。セラピストへの不適切な言動・タッチ・過度なサービスの強要禁止。大声・近隣迷惑行為禁止。泥酔・薬物使用者のご利用禁止。セラピストとの個人的な連絡先交換・店外へのお誘い・他店引き抜き禁止。盗撮・盗聴禁止。心臓疾患・伝染病・感染症（水虫・性病）の方のご利用禁止。公衆電話・非通知でのご連絡不可。暴力団関係者・全身刺青のある方・同業者のご利用禁止。'},
  {title:'その他のご案内',body:'来店後のコース変更・チェンジ不可。遅刻の場合コース短縮の場合があります。貴重品はロッカーまたは貴重品袋で管理ください。紛失・施術後の体調不良の返金は対応しかねます。'}
];
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
