/* Store CMS: drafts, authenticated cloud publishing, and explicit local demo. */
'use strict';
const C=window.Platinum, E=C.escape;
const $=id=>document.getElementById(id);
const menus=[['dashboard','◫','ダッシュボード'],['therapists','♙','セラピスト'],['shifts','▦','出勤・ご案内状況'],['news','≡','お知らせ'],['display','◇','バナー・ランキング'],['pricing','¥','料金システム'],['links','↗','関連リンク'],['shop','⚙','店舗設定']];
menus.splice(3,0,['diary','▧','写メ日記']);
let diaryMap={};
let data, revision=0, dirty=false, formDirty=false, demo=false, section='dashboard', client, activeFilter='all', search='', shiftDate=C.today(), busy=false;
const draftKey='platinum_admin_demo_v1';
const field=(name,label,value='',type='text',extra='')=>`<label ${type==='textarea'?'class="full"':''}>${E(label)}${type==='textarea'?`<textarea name="${name}" ${extra}>${E(value)}</textarea>`:`<input name="${name}" type="${type}" value="${E(value)}" ${extra}>`}</label>`;
const check=(name,label,value)=>`<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}>${E(label)}</label>`;
const select=(name,label,value,options)=>`<label>${E(label)}<select name="${name}">${options.map(([v,t])=>`<option value="${E(v)}" ${String(v)===String(value)?'selected':''}>${E(t)}</option>`).join('')}</select></label>`;
const pill=(text,style='')=>`<span class="status ${style}">${E(text)}</span>`;
const photo=(t,cls='avatar')=>C.url(t.photo,true)?`<img class="${cls}" src="${E(C.url(t.photo,true))}" alt="${E(t.name)}" loading="lazy">`:`<div class="${cls}" aria-label="写真未登録"></div>`;
function toast(text,error=false){$('toast').textContent=text;$('toast').className='toast show'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').className='toast',5500);}
function confirmAction(message,action){$('actionMessage').textContent=message;$('actionDialog').showModal();$('actionConfirm').onclick=()=>{$('actionDialog').close();action();};}
$('actionCancel').onclick=()=>$('actionDialog').close();
function changed(){dirty=true;updateStatus();}
function updateStatus(){ $('modeLabel').textContent=(demo?'デモモード':'店舗管理')+' ・ '+(dirty?'未保存の変更あり':'下書き保存済み'); }
function head(title,note,button=''){return `<div class="page-head"><div><h1>${title}</h1><p>${note}</p></div>${button}</div>`;}
function action(label,cmd,style='secondary'){return `<button class="${style}" data-action="${cmd}">${label}</button>`;}
function ensure(d){
  d.shiftSource='existing';d.ranking ||= [];d.shifts ||= [];d.news.forEach((n,i)=>{n.id ||= 'news-'+i;});
  d.therapists.forEach((t,i)=>{t.id ||= 'therapist-'+i;t.legacyIndex ??= i;t.pickup ??= d.pickup?.idxList?.includes(i)||false;});
  d.shop.heroTitle ||= '心ほどける、特別なひととき。';d.shop.heroText ||= '神栖のプライベート空間で、あなたのためのリラクゼーションを。';
  d.shop.lineUrl ||= '';d.shop.recruitUrl ||= '';d.shop.snsUrl ||= '';
  return d;
}
async function token(){const {data:s,error}=await client.auth.getSession();if(error||!s.session)throw new Error('再度ログインしてください。');return s.session.access_token;}
async function enter(isDemo){
  const mapResponse=await fetch('assets/estama-map.json');if(!mapResponse.ok)throw new Error('日記の連携設定を読み込めませんでした。');diaryMap=await mapResponse.json();
  demo=isDemo;
  if(demo){let saved;try{saved=JSON.parse(localStorage.getItem(draftKey));}catch{}data=ensure(saved||await C.defaults());revision=0;}
  else {
    const rows=await C.request('platinum_drafts?store_id=eq.'+C.config.storeId+'&select=payload,revision',{},await token());
    if(rows.length){data=ensure(rows[0].payload);revision=rows[0].revision;}else{data=ensure(await C.defaults());revision=0;}
  }
  $('login').hidden=true;$('app').hidden=false;
  $('connectionNote').innerHTML=demo?'デモモード：変更はこのブラウザーだけに保存されます。公開サイトには反映されません。 <button data-action="reset-demo" style="font-size:11px;padding:2px 8px;text-decoration:underline">デモを初期状態に戻す</button>':'下書き保存 → プレビュー → 公開の順に更新できます。公開するまでお客様の表示は変わりません。';
  $('publish').disabled=demo;
  dirty=false;updateStatus();render();
}
async function save(){
  if(!flushForm())throw new Error('入力内容を確認してから保存してください。');
  const errors=C.validate(data);if(errors.length)throw new Error(errors.join('\n'));
  if(demo) localStorage.setItem(draftKey,JSON.stringify(data));
  else {const result=await C.request('rpc/platinum_save_draft',{method:'POST',body:JSON.stringify({p_store:C.config.storeId,p_payload:data,p_expected:revision})},await token());revision=result;}
  dirty=false;updateStatus();toast(demo?'デモの下書きを保存しました':'下書きを保存しました');
}
async function run(task){if(busy)return;busy=true;['save','publish','confirmPublish'].forEach(id=>$(id).disabled=true);try{await task();}catch(e){toast(e.message,true);}finally{busy=false;['save','confirmPublish'].forEach(id=>$(id).disabled=false);$('publish').disabled=demo;}}
function render(){
  $('adminNav').innerHTML=menus.map(([id,icon,label])=>`<button data-section="${id}" class="${id===section?'active':''}" ${id===section?'aria-current="page"':''}><span class="nav-icon">${icon}</span>${label}</button>`).join('');
  const renders={dashboard,therapists,shifts,news,display,pricing,links,shop,diary};
  $('main').innerHTML=renders[section]();
  if(section==='dashboard')loadDashboardShifts();
  if(section==='diary')loadDiaryStatus();
  if(section==='shifts'&&data.shiftSource==='existing')loadExistingShifts();
  if(section==='pricing'&&data.notices?.length){const panel=document.createElement('section');panel.className='panel';panel.innerHTML='<div class="panel-head"><h2>注意事項</h2></div><div class="panel-body fields">'+data.notices.map((n,i)=>field('notice_'+i,n.title,n.body,'textarea')).join('')+'</div>';$('pricingForm').insertBefore(panel,$('pricingForm').lastElementChild);}
}
function links(){data.links.forEach((l,i)=>{l.id ||= 'link-'+i;});return head('関連リンク','関連サイトや相互リンクを管理します。',action('＋ リンクを追加','new:links','primary'))+`<section class="panel">${data.links.map(l=>`<div class="row"><div class="row-info"><strong>${E(l.name)}</strong><small>${E(l.url)}</small></div>${action('編集','edit:links:'+l.id,'')}${action('削除','remove:links:'+l.id,'danger')}</div>`).join('')||'<div class="empty">関連リンクはありません。</div>'}</section>`;}
function dashboard(){
  const active=data.therapists.filter(t=>t.active), news=data.news.filter(n=>n.published!==false);
  return head('ダッシュボード',new Intl.DateTimeFormat('ja-JP',{dateStyle:'full',timeZone:'Asia/Tokyo'}).format(new Date())+'　店舗の状況を確認しましょう。')+
    `<div class="stats"><div class="stat"><div class="stat-label">公開中のセラピスト</div><div class="stat-value">${active.length}<small>名</small></div><div class="stat-note">在籍情報を管理</div></div><div class="stat"><div class="stat-label">本日の出勤</div><div class="stat-value" id="todayCount">—<small>名</small></div><div class="stat-note">${data.shiftSource==='existing'?'既存システムと連携':'この管理画面で管理'}</div></div><div class="stat"><div class="stat-label">新人セラピスト</div><div class="stat-value">${active.filter(t=>t.isNew).length}<small>名</small></div><div class="stat-note">NEW FACEに表示</div></div><div class="stat"><div class="stat-label">公開対象のお知らせ</div><div class="stat-value">${news.length}<small>件</small></div><div class="stat-note">最新情報をお届け</div></div></div>`+
    `<div class="columns"><div><section class="panel"><div class="panel-head"><h2>本日の出勤</h2>${action('出勤を管理 →','goto:shifts','')}</div><div id="todayRows" class="empty">出勤情報を読み込んでいます…</div></section><section class="panel"><div class="panel-head"><h2>最近のお知らせ</h2>${action('すべて見る →','goto:news','')}</div>${news.slice(0,3).map(n=>`<div class="row"><div class="row-info"><small>${E(n.date)}　${E(n.cat)}</small><strong>${E(n.title||n.body.slice(0,42))}</strong></div>${pill('公開対象')}</div>`).join('')||'<div class="empty">お知らせはありません。</div>'}</section></div><div><section class="panel"><div class="panel-head"><h2>クイック操作</h2></div><div class="panel-body quick">${action('＋ セラピスト<small>プロフィールを追加</small>','new:therapists')}${action('▦ 出勤確認<small>連携したシフトを確認</small>','goto:shifts')}${action('＋ お知らせ<small>最新情報を掲載</small>','new:news')}${action('◇ バナー設定<small>トップページを更新</small>','goto:display')}</div></section><section class="panel"><div class="panel-head"><h2>公開前の確認</h2></div><div class="panel-body"><ul class="check-list"><li><span>○</span>料金・営業時間は最新ですか？</li><li><span>○</span>出勤時間と受付状況を確認</li><li><span>○</span>写真・紹介文をプレビュー</li><li><span>○</span>下書き保存後に「公開する」</li></ul></div></section></div></div>`;
}
async function loadDashboardShifts(){try{const rows=await C.shifts(data,C.today());if(section!=='dashboard')return;$('todayCount').innerHTML=rows.length+'<small>名</small>';$('todayRows').className='';$('todayRows').innerHTML=rows.slice(0,6).map(s=>{const t=data.therapists.find(t=>t.id===s.therapistId)||{name:s.therapist_name};return `<div class="row">${photo(t)}<div class="row-info"><strong>${E(t.name)}</strong><small>${E(s.start_time.slice(0,5))} 〜 ${E(s.end_time.slice(0,5))}</small></div>${pill('出勤予定')}</div>`;}).join('')||'<div class="empty">本日の出勤はまだ登録されていません。</div>';}catch{if(section==='dashboard'){$('todayRows').textContent='出勤情報を取得できませんでした。接続状況をご確認ください。';}}}
function therapists(){
  const list=data.therapists.filter(t=>(activeFilter==='all'||(activeFilter==='active'?t.active:!t.active))&&(!search||(t.name+' '+t.nameEn).toLowerCase().includes(search.toLowerCase())));
  return head('セラピスト','公開スイッチを1タップで切り替え。変更は下書きに反映されます。',action('＋ セラピストを追加','new:therapists','primary'))+`<div class="toolbar"><input id="staffSearch" aria-label="セラピストを検索" placeholder="名前で検索" value="${E(search)}">${[['all','すべて'],['active','公開中'],['hidden','非公開']].map(([v,l])=>action(l,'filter:'+v,activeFilter===v?'active':'secondary')).join('')}<span class="help">${list.length} 名</span></div><div class="card-grid">${list.map(t=>`<article class="person-card">${photo(t,'person-img')}<div class="person-body"><div class="person-meta"><h3>${E(t.name)}</h3><button type="button" class="visibility-toggle ${t.active?'is-active':''}" role="switch" aria-checked="${Boolean(t.active)}" aria-label="${E(t.name)}の公開設定" data-action="visibility:therapists:${E(t.id)}"><span class="visibility-track" aria-hidden="true"></span><span>${t.active?'公開中':'非公開'}</span></button></div><p>${E(t.nameEn)}${t.age?' / '+t.age+'歳':''}</p><div class="badges">${t.isNew?pill('NEW','gold'):''}${t.special?pill('SPECIAL','gold'):''}${t.pickup?pill('PICK UP','gold'):''}</div>${action('編集する','edit:therapists:'+t.id)}</div></article>`).join('')||'<p class="empty">該当するセラピストはいません。</p>'}</div>`;
}
function shifts(){
  return head('出勤情報','神栖／Premiumの承認済み通常シフトを表示します。')+'<section class="panel"><div class="panel-body"><div class="fields">'+field('shiftDate','営業日',shiftDate,'date')+'</div><p class="help">出勤の登録・変更は既存のシフト管理システムで行います。HPは5分間隔で更新します。深夜0〜2時台は24〜26時台で表示します。</p></div></section><section class="panel"><div class="panel-head"><h2>公開用の出勤情報</h2></div><div id="existingShifts" class="empty">読み込み中…</div></section>';
}
async function loadExistingShifts(){const date=shiftDate;try{const rows=await C.shifts({...data,shiftSource:'existing'},date);if(section!=='shifts'||date!==shiftDate||!$('existingShifts'))return;$('existingShifts').innerHTML=rows.map(s=>`<div class="row"><div class="row-info"><strong>${E(s.therapist_name)}</strong><small>連携ID：${E(s.therapist_id||'未登録')}</small></div><span>${E(s.start_time.slice(0,5))} 〜 ${E(s.end_time.slice(0,5))}</span></div>`).join('')||'出勤データがありません。';}catch{if($('existingShifts'))$('existingShifts').textContent='既存システムの出勤情報を取得できませんでした。';}}
function news(){return head('お知らせ','最新情報・イベント・新人情報を掲載します。',action('＋ お知らせを追加','new:news','primary'))+`<section class="panel">${data.news.map(n=>`<div class="row"><div class="row-info"><small>${E(n.date)}　${E(n.cat)}</small><strong>${E(n.title||n.body.slice(0,60))}</strong></div>${pill(n.published!==false?'公開対象':'非公開',n.published!==false?'':'draft')}${action('編集','edit:news:'+n.id,'')}${action('削除','remove:news:'+n.id,'danger')}</div>`).join('')||'<div class="empty">お知らせはありません。</div>'}</section>`;}
function display(){const b=data.banner;return head('バナー・ランキング','トップページの掲載内容を管理します。')+`<form id="displayForm"><section class="panel"><div class="panel-head"><h2>イベントバナー</h2></div><div class="panel-body fields">${check('active','バナーを表示する',b.active)}${select('type','表示形式',b.type,[['text','テキスト'],['image','画像']])}${field('textMain','タイトル',b.textMain)}${field('textSub','サブテキスト',b.textSub)}${field('imgUrl','画像URL',b.imgUrl,'url')}${field('link','リンク先URL',b.link,'url')}<label class="full">バナー画像を選択<input type="file" id="bannerFile" accept="image/jpeg,image/png,image/webp"></label></div></section><section class="panel"><div class="panel-head"><h2>ランキング</h2><span class="help">未設定の順位は表示しません</span></div><div class="panel-body fields">${[0,1,2,3,4].map(i=>select('rank'+i,'第'+(i+1)+'位',data.ranking[i]||'',[['','表示しない'],...data.therapists.filter(t=>t.active).map(t=>[t.id,t.name])])).join('')}</div></section><section class="panel"><div class="panel-body"><h2>ピックアップ・新人情報</h2><p>セラピスト編集画面の「ピックアップ」「新人」をオンにすると、トップページに表示します。</p></div></section><button class="primary" type="submit">変更を下書きに反映</button></form>`;}
function pricing(){return head('料金システム','コース・追加料金・キャンセル案内をまとめて管理します。',action('＋ コースを追加','new:courses','primary'))+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>コース</th><th>料金</th><th>おすすめ</th><th></th></tr></thead><tbody>${data.courses.map(c=>`<tr><td>${c.minutes}分</td><td>${c.price.toLocaleString()}円</td><td>${c.popular?pill('おすすめ','gold'):'—'}</td><td>${action('編集','edit:courses:'+c.id,'')}${action('削除','remove:courses:'+c.id,'danger')}</td></tr>`).join('')}</tbody></table></div></section><form id="pricingForm"><section class="panel"><div class="panel-body fields">${field('taxNote','税表記（確認後に入力）',data.pricing.taxNote)}${field('extension','延長料金',data.pricing.extension)}${field('nomination','通常指名料',data.pricing.nomination)}${field('special','SPECIAL本指名料',data.pricing.special)}${field('costume','衣装チェンジ',data.pricing.costume)}${field('cancel','キャンセル条件',data.pricing.cancel,'textarea')}</div></section><button class="primary" type="submit">変更を下書きに反映</button></form>`;}
function shop(){return head('店舗設定','連絡先・営業時間・アクセス・予約導線を管理します。')+`<form id="shopForm"><section class="panel"><div class="panel-head"><h2>基本情報</h2></div><div class="panel-body fields">${field('name','店舗名',data.shop.name,'text','required')}${field('phone','電話番号',data.shop.phone,'tel','required')}${field('hours','営業時間',data.shop.hours)}${field('reception','電話受付時間の案内',data.shop.reception)}${field('area','エリア',data.shop.area)}${field('off','定休日',data.shop.off)}${field('payment','お支払い方法',data.shop.payment)}${field('parking','駐車場の案内',data.shop.parking)}${field('access','アクセスの説明',data.shop.access,'textarea')}${select('receptionMode','電話受付の状態',data.reception,[['auto','自動（10:00〜24:00）'],['open','受付中'],['closed','受付終了']])}</div></section><section class="panel"><div class="panel-head"><h2>予約・外部リンク</h2></div><div class="panel-body fields">${field('webUrl','Web予約URL',data.shop.webUrl,'url','required')}${field('lineUrl','LINE予約URL（任意）',data.shop.lineUrl,'url')}${field('recruitUrl','求人ページURL（任意）',data.shop.recruitUrl,'url')}${field('snsUrl','店舗SNS URL（任意）',data.shop.snsUrl,'url')}</div></section><section class="panel"><div class="panel-head"><h2>トップページ</h2></div><div class="panel-body fields">${field('heroTitle','キャッチコピー',data.shop.heroTitle)}${field('heroText','紹介文',data.shop.heroText,'textarea')}</div></section><button class="primary" type="submit">変更を下書きに反映</button></form>`;}
let editing;
function diary(){return head('写メ日記','エステ魂の神栖／プレミアムから15分ごとに自動取得します。')+`<section class="panel"><div class="panel-body"><p>投稿・修正はエステ魂で行ってください。トップは最新5件、各プロフィールには本人の日記を表示します。HPで非公開のセラピストは日記も表示されません。</p><p><a href="https://estama.jp/shop/35702/bloglist/" target="_blank" rel="noopener">エステ魂の写メNoteを見る ↗</a> ／ <a href="diary.html" target="_blank" rel="noopener">HPの日記一覧を見る ↗</a></p><p id="diaryStatus" role="status">同期状況を確認しています…</p></div></section><section class="panel"><div class="panel-head"><h2>セラピストとの連携</h2></div>${data.therapists.map(t=>{const id=Object.hasOwn(t,'estamaId')?t.estamaId:diaryMap[t.id]?.id;return `<div class="row"><div class="row-info"><strong>${E(t.name)}</strong><small>${t.diaryDisabled?'日記を非表示':id?'エステ魂ID：'+E(id):'未連携（セラピスト編集でIDを設定）'}</small></div>${action('設定','edit:therapists:'+t.id)}</div>`;}).join('')}</section>`;}
async function loadDiaryStatus(){try{const r=await fetch('/api/diary?limit=1',{cache:'no-store'}),value=await r.json();if(!r.ok||!value.ok)throw new Error();if($('diaryStatus'))$('diaryStatus').textContent='最終取得：'+new Date(value.updated_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' ／ 公開対象 '+value.total+'件'+(value.stale?'（更新が遅れています）':'');}catch{if($('diaryStatus'))$('diaryStatus').textContent='日記の同期状況を取得できませんでした。';}}
function flushForm(){
  if(!formDirty)return true;
  const form=document.querySelector('#shopForm,#pricingForm,#displayForm');
  if(!form)return true;
  if(!form.reportValidity())return false;
  form.requestSubmit();
  return !formDirty;
}
function edit(type,id){
  const item=id?data[type].find(x=>x.id===id):{id:crypto.randomUUID()};if(!item)return;
  editing={type,id,item:C.clone(item)};
  const t=editing.item;
  if(type==='therapists'&&!Object.hasOwn(t,'estamaId'))t.estamaId=diaryMap[t.id]?.id||'';
  const labels={therapists:'セラピスト',shifts:'出勤',news:'お知らせ',courses:'コース',links:'関連リンク'};
  $('editorTitle').textContent=labels[type]+(id?'を編集':'を追加');$('editorError').textContent='';
  if(type==='therapists') $('editorFields').innerHTML=field('name','名前',t.name,'text','required maxlength="50"')+field('supabaseId','連携用セラピストID（任意）',t.supabaseId||'')+field('nameEn','ローマ字',t.nameEn)+field('age','年齢',t.age||'','number','min="18" max="100"')+field('height','身長（cm・任意）',t.height||'','number','min="100" max="220"')+field('comment','紹介文',t.comment,'textarea')+field('photo','メイン写真URL',t.photo)+field('photos','追加写真URL（1行1枚・最大5枚）',(t.photos||[]).filter(p=>p!==t.photo).join('\n'),'textarea')+'<label class="full">メイン写真を選択<input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp"></label>'+check('active','公開する',t.active!==false)+check('isNew','新人（NEW）',t.isNew)+check('special','SPECIAL',t.special)+check('pickup','ピックアップ',t.pickup);
  if(type==='shifts') $('editorFields').innerHTML=select('therapistId','セラピスト',t.therapistId||'',[['','選択してください'],...data.therapists.filter(t=>t.active).map(t=>[t.id,t.name])])+field('date','出勤日',t.date||shiftDate,'date','required')+field('start','開始（例 12:00）',t.start||'12:00','text','required pattern="([01][0-9]|2[0-9]):[0-5][0-9]"')+field('end','終了（例 26:00）',t.end||'26:00','text','required pattern="([01][0-9]|2[0-9]):[0-5][0-9]"')+select('availability','ご案内状況',t.availability||'お問い合わせください',[['お問い合わせください','お問い合わせください'],['ご案内可能','ご案内可能'],['予約満了','予約満了']])+check('published','公開対象にする',t.published!==false);
  if(type==='news') $('editorFields').innerHTML=field('date','掲載日',(t.date||C.today()).replaceAll('.','-'),'date','required')+select('cat','カテゴリ',t.cat||'お知らせ',[['お知らせ','お知らせ'],['イベント','イベント'],['新人情報','新人情報']])+field('title','タイトル',t.title||'','text','required maxlength="120"')+field('body','本文',t.body||'','textarea','required')+check('published','公開対象にする',t.published!==false);
  if(type==='courses') $('editorFields').innerHTML=field('minutes','コース時間（分）',t.minutes||90,'number','min="1" max="600" required')+field('price','料金（円）',t.price??20000,'number','min="0" max="1000000" required')+check('popular','おすすめコース',t.popular);
  if(type==='links') $('editorFields').innerHTML=field('name','サイト名',t.name,'text','required')+field('url','URL',t.url,'url','required')+field('banner','バナー画像URL（任意）',t.banner,'url');
  if(type==='therapists')$('editorFields').insertAdjacentHTML('beforeend',field('estamaId','エステ魂のセラピストID（写メ日記連携）',t.estamaId||'','text','inputmode="numeric" pattern="[0-9]{1,20}"')+check('diaryDisabled','このセラピストの写メ日記を非表示にする',t.diaryDisabled)+'<p class="help full">神栖／プレミアムのセラピストページURLの末尾の数字を入力します。例：/cast/630410/ → 630410。空欄は未連携です。</p>');
  $('editor').showModal();
}
function applyEdit(event){event.preventDefault();const f=new FormData(event.target), {type,id,item}=editing;const next={...item};
  for(const [k,v] of f)if(typeof v==='string')next[k]=v.trim();
  const checks={therapists:['active','isNew','special','pickup'],shifts:['published'],news:['published'],courses:['popular'],links:[]}[type];checks.forEach(k=>next[k]=f.has(k));
  if(type==='therapists'){next.diaryDisabled=f.has('diaryDisabled');next.age=Number(next.age)||0;next.height=Number(next.height)||0;next.photos=[next.photo,...next.photos.split('\n').map(v=>v.trim())].filter(Boolean);next.photos=[...new Set(next.photos)].slice(0,6);const id=next.estamaId;if(id&&data.therapists.some(t=>t.id!==next.id&&(Object.hasOwn(t,'estamaId')?t.estamaId:diaryMap[t.id]?.id)===id)){$('editorError').textContent='このエステ魂IDは他のセラピストに設定されています。';return;}}
  if(type==='courses'){next.minutes=Number(next.minutes);next.price=Number(next.price);}
  const proposed=C.clone(data);if(id)proposed[type][proposed[type].findIndex(x=>x.id===id)]=next;else proposed[type].push(next);
  const errors=C.validate(proposed);if(errors.length){$('editorError').textContent=errors.join('\n');return;}
  data=proposed;changed();$('editor').close();render();toast('下書きに反映しました。保存後に公開できます。');
}
async function readImage(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebP画像を選択してください。');
  if(file.size>15000000)throw new Error('画像は15MB以下を選択してください。');
  const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas'),ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.82);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-section],[data-action]');if(!button)return;
  if(button.dataset.section){if(!flushForm())return;section=button.dataset.section;render();return;}
  const [cmd,type,id]=button.dataset.action.split(':');
  if(cmd==='reset-demo'&&demo){confirmAction('デモの編集内容を破棄して初期状態に戻しますか？公開サイトには影響しません。',()=>{localStorage.removeItem(draftKey);localStorage.removeItem('platinum_preview_v1');formDirty=false;section='dashboard';run(()=>enter(true));});}
  if(cmd==='goto'){if(!flushForm())return;section=type;render();}
  if(cmd==='new')edit(type);
  if(cmd==='edit')edit(type,id);
  if(cmd==='filter'){activeFilter=type;render();}
  if(cmd==='visibility'){
    const therapist=data.therapists.find(t=>t.id===id);if(!therapist)return;
    therapist.active=!therapist.active;changed();render();
    document.querySelector('[data-action="visibility:therapists:'+CSS.escape(id)+'"]')?.focus({preventScroll:true});
    toast(therapist.name+'を'+(therapist.active?'公開':'非公開')+'に設定しました。下書き保存後に公開できます。');
  }
  if(cmd==='remove'){confirmAction('下書きから削除しますか？公開するまではお客様の表示は変わりません。',()=>{data[type]=data[type].filter(x=>x.id!==id);changed();render();});}
});
document.addEventListener('change',async event=>{const el=event.target;
  if(el.name==='shiftSource'){data.shiftSource=el.value;changed();render();}
  if(el.name==='shiftDate'){shiftDate=el.value||C.today();render();}
  if(el.id==='photoFile'||el.id==='bannerFile'){try{const image=await readImage(el.files[0]);const target=el.id==='photoFile'?$('editorForm').elements.photo:$('displayForm').elements.imgUrl;target.type='text';target.value=image;if(el.id==='bannerFile'){formDirty=true;changed();}toast('画像を読み込みました。フォームの更新ボタンで反映します。');}catch(e){toast(e.message,true);}}
});
document.addEventListener('input',event=>{if(event.target.closest('#shopForm,#pricingForm,#displayForm')){formDirty=true;changed();}});
document.addEventListener('input',event=>{if(event.target.id==='staffSearch'){search=event.target.value;const pos=event.target.selectionStart;render();$('staffSearch').focus();$('staffSearch').setSelectionRange(pos,pos);}});
document.addEventListener('submit',event=>{const id=event.target.id;if(!['shopForm','pricingForm','displayForm'].includes(id))return;event.preventDefault();const f=new FormData(event.target),next=C.clone(data);
  if(id==='shopForm'){for(const [k,v]of f){if(k==='receptionMode')next.reception=v;else next.shop[k]=v.trim();}for(const key of ['lineUrl','recruitUrl','snsUrl'])if(next.shop[key]&&!C.url(next.shop[key])){toast('外部リンクのURLを確認してください。',true);return;}}
  if(id==='pricingForm'){for(const [key,value]of f){if(key.startsWith('notice_'))next.notices[Number(key.slice(7))].body=value;else next.pricing[key]=value;}}
  if(id==='displayForm'){next.banner={active:f.has('active'),type:f.get('type'),textMain:f.get('textMain'),textSub:f.get('textSub'),imgUrl:f.get('imgUrl'),link:f.get('link')};next.ranking=[0,1,2,3,4].map(i=>f.get('rank'+i));const ranks=next.ranking.filter(Boolean);if(new Set(ranks).size!==ranks.length){toast('同じセラピストを複数の順位に設定できません。',true);return;}}
  const errors=C.validate(next);if(errors.length){toast(errors[0],true);return;}data=next;formDirty=false;changed();toast('変更を下書きに反映しました。');
});
$('editorForm').addEventListener('submit',applyEdit);
['closeEditor','cancelEditor'].forEach(id=>$(id).onclick=()=>$('editor').close());
$('save').onclick=()=>run(save);
$('preview').onclick=()=>{try{if(!flushForm())return;const errors=C.validate(data);if(errors.length)throw new Error(errors[0]);localStorage.setItem('platinum_preview_v1',JSON.stringify(data));window.open('index.html?preview=1','_blank','noopener');}catch(e){toast(e.message,true);}};
$('publish').onclick=()=>run(async()=>{if(dirty)await save();$('publishSummary').innerHTML=`<p>公開対象：セラピスト ${data.therapists.filter(t=>t.active).length}名 ／ お知らせ ${data.news.filter(n=>n.published!==false).length}件</p><p>出勤情報：${data.shiftSource==='cms'?'この管理画面':'既存システム'}</p>`;$('publishDialog').showModal();});
$('cancelPublish').onclick=()=>$('publishDialog').close();
$('confirmPublish').onclick=()=>run(async()=>{await C.request('rpc/platinum_publish',{method:'POST',body:JSON.stringify({p_store:C.config.storeId,p_expected:revision})},await token());$('publishDialog').close();toast('公開サイトに反映しました。');});
$('demo').onclick=()=>run(()=>enter(true));
$('logout').onclick=()=>{const exit=async()=>{if(!demo&&client)await client.auth.signOut();localStorage.removeItem('platinum_preview_v1');dirty=false;location.reload();};if(dirty)confirmAction('保存していない変更があります。終了しますか？',exit);else exit();};
$('loginForm').onsubmit=async event=>{event.preventDefault();if(!client||!C.config.cmsEnabled){$('loginNote').textContent='本番接続の初期設定が必要です。先にデモで画面をご確認いただけます。';return;}const f=new FormData(event.target);try{const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)throw error;const user=(await client.auth.getUser()).data.user;const members=await C.request('platinum_admins?store_id=eq.'+C.config.storeId+'&user_id=eq.'+user.id+'&select=user_id',{},await token());if(!members.length)throw new Error('この店舗の管理権限がありません。');await enter(false);}catch(e){$('loginNote').textContent=e.message;}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
if(window.supabase)client=window.supabase.createClient(C.config.url,C.config.anonKey,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
if(!C.config.cmsEnabled)$('loginNote').textContent='本番接続は未設定です。デモでは編集・保存・プレビューをお試しいただけます。';
