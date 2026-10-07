'use strict';
(async()=>{
  const C=window.Platinum,E=C.escape,root=document.getElementById('site');
  try {
    const loaded=await C.loadPublic(),d=loaded.data,s=d.shop;
    d.news.sort((a,b)=>b.date.replaceAll('.','-').localeCompare(a.date.replaceAll('.','-')));
    const page=document.body.dataset.page||'home';
    const canonical=document.querySelector('link[rel="canonical"]');
    const seoOrigin=C.config.siteUrl||(canonical?new URL(canonical.href).origin:location.origin);
    function updateSEO(title,description,path){
      document.title=title;const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=description;
      if(canonical)canonical.href=seoOrigin+path;
      for(const [key,value]of [['og:title',title],['og:description',description],['og:url',seoOrigin+path]]){const el=document.querySelector('meta[property="'+key+'"]');if(el)el.content=value;}
    }
    if(loaded.preview){const robots=document.createElement('meta');robots.name='robots';robots.content='noindex,nofollow';document.head.append(robots);}
    const suffix=loaded.preview?'preview=1':'';
    const link=(path)=>path+(suffix?(path.includes('?')?'&':'?')+suffix:'');
    const phone='tel:'+s.phone.replace(/[^0-9+]/g,'');
    const web=C.url(s.webUrl);
    const menus=[['index.html','TOP','トップ'],['staff.html','THERAPIST','セラピスト'],['schedule.html','SCHEDULE','出勤情報'],['price.html','SYSTEM','料金システム'],['flow.html','RESERVATION','予約方法'],['access.html','ACCESS','アクセス']];
    menus.splice(3,0,['diary.html','PHOTO DIARY','写メ日記']);
    const section=(en,ja,body,cls='')=>`<section class="section ${cls}"><div class="wrap">${en||ja?`<div class="section-head"><div class="en">${en}</div><h2>${ja}</h2></div>`:''}${body}</div></section>`;
    const button=(url,text,cls='')=>`<a class="button ${cls}" href="${E(url)}">${text}</a>`;
    const more=(path,text)=>`<div class="section-more">${button(link(path),text+'　→')}</div>`;
    const empty=text=>`<div class="empty">${text}</div>`;
    const title=(en,ja)=>`<div class="page-head"><p>${en}</p><h1>${ja}</h1></div>`;
    const fmtDate=date=>new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date(date+'T00:00:00+09:00'));
    function card(t,shift,rank){
      const src=C.url(t.photo||(t.photos||[])[0],true),detail=link('profile.html?id='+encodeURIComponent(t.id));
      const hours=shift?`${E(shift.start_time.slice(0,5))} 〜 ${E(shift.end_time.slice(0,5))}`:'';
      const availability='';
      return `<a class="staff-card" href="${E(detail)}"><div class="staff-photo">${src?`<img src="${E(src)}" alt="${E(t.name)}" loading="lazy" width="450" height="600">`:'Platinum'}<div class="photo-badges">${t.isNew?'<span class="badge new">NEW</span>':''}${t.special?'<span class="badge">SPECIAL</span>':''}</div>${rank?`<span class="rank-no">No. ${rank}</span>`:''}</div><div class="staff-info"><div class="staff-name">${E(t.name)}</div><div class="staff-meta">${t.age?E(t.age)+'歳':''}${t.height?' / T'+E(t.height):''}</div>${shift?`<div class="staff-shift">${hours}${availability?'<br>'+E(availability):''}</div>`:''}</div></a>`;
    }
    const grid=list=>`<div class="staff-grid">${list.join('')}</div>`;
    const news=list=>`<div class="news-list">${list.map(n=>`<article class="news-item"><time>${E(n.date)}</time><span class="news-tag">${E(n.cat)}</span><div>${n.title?`<strong>${E(n.title)}</strong>`:''}<p>${E(n.body)}</p></div></article>`).join('')}</div>`;
    const courses=()=>`<div class="courses">${d.courses.map(c=>`<div class="course ${c.popular?'pop':''}"><div class="course-min">${E(c.minutes)}<small> min</small></div><div class="course-price">¥ ${Number(c.price).toLocaleString()}</div></div>`).join('')}</div><p class="price-notes">${E(d.pricing.taxNote||'')}<br>お支払い：${E(s.payment)} ／ コース時間にはシャワー・お着替えを含みます。</p>`;
    const reserveStrip=()=>`<div class="reservation-strip"><div><h3>ご予約・お問い合わせ</h3><p>ご希望のセラピスト・日時・コースをお伝えください。</p></div>${button(web,'Webで予約する　→','dark')}</div>`;
    const steps=()=>`<div class="flow-grid"><article class="flow-card"><span>01</span><h3>セラピスト・コースを選ぶ</h3><p>プロフィールと出勤情報をご覧になり、ご希望の日時・コースをお選びください。</p></article><article class="flow-card"><span>02</span><h3>電話・Webから予約</h3><p>ご希望の内容をお伝えください。予約の確定状況は店舗または予約サービスの案内をご確認ください。</p></article><article class="flow-card"><span>03</span><h3>ご案内のルームへ</h3><p>詳細なアクセスはショートメールにてご案内します。お支払いは${E(s.payment)}です。</p></article></div>`;
    function banner(){const b=d.banner;if(!b?.active)return '';const content=b.type==='image'?`<img src="${E(C.url(b.imgUrl,true))}" alt="${E(b.textMain||'イベントのお知らせ')}">`:`<strong>${E(b.textMain)}</strong><p>${E(b.textSub)}</p>`;return b.link&&C.url(b.link)?`<a class="event-banner ${b.type==='image'?'has-image':''}" href="${E(C.url(b.link))}">${content}</a>`:`<div class="event-banner ${b.type==='image'?'has-image':''}">${content}</div>`;}
    let body='';
    function bannerSlider(){
      if(d.banner?.sliderActive===false)return '';
      const slides=C.bannerSlides(d).filter(b=>b.active!==false);
      if(!slides.length)return '';
      return `<section class="banner-slider" id="bannerSlider" aria-roledescription="カルーセル" aria-label="店舗のご案内" tabindex="0"><div class="banner-slides">${slides.map((b,i)=>{const image=C.url(b.image,true),href=C.url(b.link)||(['schedule','staff','diary','price','flow','access'].includes(b.destination)?link(b.destination+'.html'):'');return `<article class="banner-slide banner-theme-${i%3} ${image?'banner-image-slide':''}" ${i?'hidden':''} role="group" aria-roledescription="スライド" aria-label="${i+1} / ${slides.length}">${image?`<${href?'a':'div'} ${href?`href="${E(href)}"`:''} class="banner-image-link"><img src="${E(image)}" alt="${E(b.title)}" ${i?'loading="lazy"':'fetchpriority="high"'} width="1440" height="560"></${href?'a':'div'}>`:`<div class="wrap banner-copy"><p class="eyebrow">PLATINUM · KAMISU</p><h2>${E(b.title)}</h2><p>${E(b.text)}</p>${href?button(href,E(b.label||'詳しく見る'),'dark'):''}</div>`}</article>`;}).join('')}</div>${slides.length>1?`<div class="banner-controls"><button type="button" id="bannerPrev" aria-label="前のバナー">←</button><div class="banner-dots">${slides.map((b,i)=>`<button type="button" data-banner-index="${i}" aria-label="バナー${i+1}：${E(b.title)}" aria-current="${i===0?'true':'false'}"></button>`).join('')}</div><button type="button" id="bannerNext" aria-label="次のバナー">→</button><button type="button" id="bannerPause" aria-label="バナーの自動切替を停止">一時停止</button></div>`:''}</section>`;
    }
    if(page==='home'){
      const picks=d.therapists.filter(t=>t.pickup??d.pickup?.idxList?.includes(t.legacyIndex));
      const ranks=(d.ranking||[]).map((id,i)=>({t:d.therapists.find(t=>t.id===id),rank:i+1})).filter(r=>r.t);
      body=`<div class="home-heading wrap"><h1>神栖のメンズエステ｜プラチナ</h1><p>茨城県神栖市のプライベートリラクゼーション</p></div>`+bannerSlider();
      body+=section("TODAY'S SCHEDULE",'本日の出勤',`<div id="todaySchedule">${empty('出勤情報を読み込んでいます…')}</div>${more('schedule.html','出勤スケジュールを見る')}`,'alt');
      body+=section('PICK UP','ピックアップ',picks.length?grid(picks.slice(0,8).map(t=>card(t))):empty('ピックアップはただいま準備中です。'));
      body+=section('PHOTO DIARY','写メ日記',`<div id="diaryEntries" aria-live="polite">${empty('日記を読み込んでいます…')}</div>${more('diary.html','写メ日記をもっと見る')}`,'alt');
      body+=section('INFORMATION','最新情報',news(d.news.slice(0,3))+more('news.html','お知らせ一覧'));
      body+=`<div class="wrap">${reserveStrip()}</div>`;
      if(ranks.length)body+=section('RANKING','ランキング',grid(ranks.map(r=>card(r.t,null,r.rank))));
      if(d.therapists.some(t=>t.isNew))body+=section('NEW FACE','新人セラピスト',grid(d.therapists.filter(t=>t.isNew).slice(-4).reverse().map(t=>card(t)))+more('staff.html?filter=new','新人一覧を見る'));
      body+=section('SYSTEM','料金システム',courses()+more('price.html','料金・ご利用案内'),'dark');
      body+=section('RESERVATION','ご利用の流れ',steps()+more('flow.html','予約方法を見る'));
      body+=section('ABOUT PLATINUM','神栖・千葉方面でメンエスをお探しの方へ',`<div class="terms"><p>プラチナは、茨城県神栖市のメンズエステ（メンエス）です。個室のプライベート空間で、オイルを使ったリラクゼーションをご案内しています。</p><p>神栖でメンエスをお探しの方はもちろん、千葉県方面からご来店を検討されている方も、セラピストのプロフィール・本日の出勤・料金をご覧のうえご予約ください。店舗の所在地は茨城県神栖市です。</p><p>詳しいアクセスはご予約時にご案内します。</p></div>`+more('access.html','店舗情報・アクセスを見る'));
      if(s.recruitUrl&&C.url(s.recruitUrl))body+=section('RECRUIT','セラピスト募集',`<div class="section-more">${button(C.url(s.recruitUrl),'求人情報を見る　→')}</div>`,'alt');
    }
    if(page==='staff'){const filter=new URLSearchParams(location.search).get('filter')||'all';body=title('THERAPIST','セラピスト一覧')+section('','',`<div class="filters">${[['all','すべて'],['new','新人'],['special','SPECIAL']].map(([v,label])=>`<button data-filter="${v}" class="${v===filter?'active':''}">${label}</button>`).join('')}</div><div id="staffCards"></div>`);}
    if(page==='schedule')body=title('SCHEDULE','出勤スケジュール')+section('','',`<div class="date-tabs">${C.dates().map((date,i)=>`<button data-date="${date}" class="${i===0?'active':''}">${i===0?'本日<br>':''}${fmtDate(date)}</button>`).join('')}</div><div id="scheduleCards"></div><p class="muted">出勤予定は変更になる場合があります。予約の空き状況はお問い合わせください。</p>`);
    if(page==='news')body=title('INFORMATION','お知らせ')+section('','',news(d.news));
    if(page==='diary')body=title('PHOTO DIARY','写メ日記')+section('','',`<div class="diary-toolbar"><label for="diaryTherapist">セラピスト</label><select id="diaryTherapist"><option value="">すべて</option>${d.therapists.map(t=>`<option value="${E(t.id)}">${E(t.name)}</option>`).join('')}</select></div><div id="diaryEntries" aria-live="polite">${empty('日記を読み込んでいます…')}</div>`);
    if(page==='price')body=title('SYSTEM','料金システム')+section('PLATINUM COURSE','コース料金',courses()+`<div class="options">${[['延長',d.pricing.extension],['通常指名料',d.pricing.nomination],['SPECIAL本指名料',d.pricing.special],['衣装チェンジ',d.pricing.costume]].map(([k,v])=>`<div class="option"><span>${E(k)}</span><span>${E(v)}</span></div>`).join('')}</div><p class="price-notes">2回目以降は自動的に本指名扱いになります。<br>出張サービスは行っておりません。</p>`,'dark')+section('GUIDANCE','ご利用にあたって',`<div class="terms"><h3>キャンセルについて</h3><p>${E(d.pricing.cancel)}</p><h3>サービスについて</h3><p>当サロンは風俗店ではございません。性風俗的サービスは一切行っておりません。<br>コース時間はご予約時間から退室までで、シャワーもお時間に含まれます。</p></div>`);
    if(page==='price'&&d.notices?.length)body+=section('NOTICE','注意事項',`<div class="terms">${d.notices.map(n=>`<h3>${E(n.title)}</h3><p>${E(n.body)}</p>`).join('')}</div>`);
    if(page==='access')body=title('ACCESS','アクセス')+section('SHOP INFORMATION','店舗のご案内',`<div class="shop-grid"><dl class="shop-dl">${[['店舗名',s.name],['エリア',s.area],['営業時間',s.hours],['電話受付',s.reception],['定休日',s.off],['お支払い',s.payment],...(s.parking?[['駐車場',s.parking]]:[])].map(([k,v])=>`<div><dt>${k}</dt><dd>${E(v)}</dd></div>`).join('')}</dl><div><iframe class="access-map" title="神栖市大野原の周辺地図" src="https://maps.google.com/maps?q=${encodeURIComponent('茨城県神栖市大野原')}&output=embed&hl=ja&z=15" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><p class="muted">地図は周辺エリアです。施術ルームの場所は個別にご案内します。</p><p class="access-note">${E(s.access)}</p></div></div>`);
    if(page==='flow')body=title('RESERVATION','ご予約・ご利用の流れ')+section('HOW TO RESERVE','ご予約方法',steps()+`<div class="section-more">${button(web,'Webから予約する','dark')} ${button(phone,'電話で予約する')}</div><p class="price-notes" style="color:var(--muted)">電話受付 ${E(s.reception)} ／ 営業時間 ${E(s.hours)}</p>${C.url(s.lineUrl)?`<div class="section-more">${button(C.url(s.lineUrl),'LINEから予約する')}</div>`:''}`)+section('BEFORE YOUR VISIT','ご来店前に',`<div class="terms"><h3>ご予約時にお伝えいただくこと</h3><p>お名前・ご連絡先・希望日時・希望コース・セラピストの指名有無をご用意ください。</p><h3>キャンセルについて</h3><p>${E(d.pricing.cancel)}</p></div>`,'alt');
    let profile;
    if(page==='profile'){
      const params=new URLSearchParams(location.search),id=params.get('id'),idx=params.get('idx');profile=id?d.therapists.find(t=>t.id===id):(idx!==null?d.therapists.find(t=>t.legacyIndex===Number(idx)):null);
      if(!profile)body=title('NOT FOUND','プロフィールが見つかりません')+section('','',empty('公開中のセラピスト一覧からお選びください。')+more('staff.html','セラピスト一覧へ'));
      else {const t=profile,photos=[...new Set([t.photo,...(t.photos||[])].filter(p=>C.url(p,true)))];document.title=t.name+' | プラチナ 神栖';body=section('THERAPIST','プロフィール',`<div class="profile-grid"><div>${photos.length?`<img id="mainPhoto" class="profile-main-photo" src="${E(C.url(photos[0],true))}" alt="${E(t.name)}"><div class="thumbnails">${photos.map((p,i)=>`<button data-photo="${E(C.url(p,true))}" aria-label="写真${i+1}を表示"><img src="${E(C.url(p,true))}" alt="写真${i+1}"></button>`).join('')}</div>`:empty('写真準備中')}</div><div class="profile-info"><div class="eyebrow">${E(t.nameEn)}</div><h1>${E(t.name)}</h1><div class="staff-meta">${t.age?E(t.age)+'歳':''}${t.height?' / 身長 '+E(t.height)+'cm':''}</div><div class="profile-comment">${E(t.comment)}</div>${button(web,'Webで予約する','dark')}<div id="profileWeek"></div></div></div>`)+more('staff.html','セラピスト一覧へ');}
    }
    root.innerHTML=`${loaded.preview?'<div class="preview-bar">下書きプレビュー — この画面の変更は公開されていません</div>':''}${loaded.warning?`<div class="site-warning">${E(loaded.warning)}</div>`:''}<a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><div class="wrap header-top"><a class="brand" href="${link('index.html')}"><span class="crest">P</span><span>PLATINUM<small>神栖 メンズエステ プラチナ</small></span></a><div class="header-contact">営業時間 ${E(s.hours)}<a href="${E(phone)}">${E(s.phone)}</a>電話受付 ${E(s.reception)}</div><button class="mobile-toggle" id="menuToggle" aria-expanded="false" aria-controls="siteNav">メニュー</button></div><nav class="site-nav" id="siteNav" aria-label="メインメニュー">${menus.map(([p,en,ja])=>`<a href="${link(p)}" class="${(page==='home'?'index':page)===p.replace('.html','')?'active':''}"><span>${en}</span>${ja}</a>`).join('')}</nav></header><main id="main">${body}</main>${page!=='home'?`<div class="wrap">${reserveStrip()}</div>`:''}${page==='home'&&d.links?.length?section('LINKS','関連リンク',`<div class="link-grid">${d.links.filter(l=>C.url(l.url)).map(l=>`<a href="${E(C.url(l.url))}" target="_blank" rel="noopener">${l.banner&&C.url(l.banner,true)?`<img src="${E(C.url(l.banner,true))}" alt="" loading="lazy">`:''}${E(l.name)}</a>`).join('')}</div>`):''}<footer class="site-footer"><a class="brand" href="${link('index.html')}">PLATINUM</a><div class="footer-links">${menus.map(([p,en,ja])=>`<a href="${link(p)}">${ja}</a>`).join('')}${C.url(s.snsUrl)?`<a href="${E(C.url(s.snsUrl))}" target="_blank" rel="noopener">店舗SNS</a>`:''}${C.url(s.recruitUrl)?`<a href="${E(C.url(s.recruitUrl))}">求人情報</a>`:''}</div><small>© ${new Date().getFullYear()} Platinum Men's Esthetic</small></footer><div class="bottom-bar"><a href="${E(phone)}">電話で予約<small id="receptionLabel">受付 ${E(s.reception)}</small></a><a class="reserve" href="${E(web)}">Web予約<small>RESERVATION</small></a><a href="${link('schedule.html')}">出勤情報<small>SCHEDULE</small></a><a href="${link('price.html')}">料金<small>SYSTEM</small></a></div><dialog id="receptionDialog"><button class="alert-close" aria-label="閉じる">×</button><h2>電話受付時間外です</h2><p>電話受付は${E(s.reception)}です。Webからのご予約もご利用ください。</p>${button(web,'Webから予約する','dark')}</dialog>`;
    $('menuToggle').onclick=()=>{const open=$('siteNav').classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));};
    function $(id){return document.getElementById(id);}
    if($('bannerSlider')&&$('bannerNext')){
      const slider=$('bannerSlider'),slides=[...slider.querySelectorAll('.banner-slide')],dots=[...slider.querySelectorAll('[data-banner-index]')],reduce=matchMedia('(prefers-reduced-motion: reduce)');
      let current=0,paused=reduce.matches,timer,touchX;
      const show=index=>{current=(index+slides.length)%slides.length;slides.forEach((el,i)=>el.hidden=i!==current);dots.forEach((el,i)=>el.setAttribute('aria-current',String(i===current)));};
      const stop=()=>clearInterval(timer);
      const play=()=>{stop();if(!paused&&!document.hidden&&!slider.matches(':hover')&&!slider.contains(document.activeElement))timer=setInterval(()=>show(current+1),6000);};
      const label=()=>{$('bannerPause').textContent=paused?'再生':'一時停止';$('bannerPause').setAttribute('aria-label',paused?'バナーの自動切替を再開':'バナーの自動切替を停止');};
      $('bannerPrev').onclick=()=>{show(current-1);play();};$('bannerNext').onclick=()=>{show(current+1);play();};dots.forEach(el=>el.onclick=()=>{show(Number(el.dataset.bannerIndex));play();});
      $('bannerPause').onclick=()=>{paused=!paused;label();play();};slider.onmouseenter=stop;slider.onmouseleave=play;slider.onfocusin=stop;slider.onfocusout=()=>setTimeout(play,0);document.addEventListener('visibilitychange',play);
      slider.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1));}});
      slider.addEventListener('touchstart',e=>{touchX=e.touches[0]?.clientX;stop();},{passive:true});slider.addEventListener('touchend',e=>{const dx=e.changedTouches[0]?.clientX-touchX;if(Math.abs(dx)>50)show(current+(dx<0?1:-1));play();},{passive:true});
      reduce.addEventListener('change',()=>{paused=reduce.matches;label();play();});label();play();
    }
    function receptionOpen(){if(d.reception==='open')return true;if(d.reception==='closed')return false;return new Date(Date.now()+9*3600000).getUTCHours()>=10;}
    const updateReception=()=>$('receptionLabel').textContent=receptionOpen()?'電話受付中':'電話受付時間外';updateReception();setInterval(updateReception,60000);
    document.addEventListener('click',event=>{const a=event.target.closest('a[href^="tel:"]');if(a&&!receptionOpen()){event.preventDefault();$('receptionDialog').showModal();}const p=event.target.closest('[data-photo]');if(p)$('mainPhoto').src=p.dataset.photo;});
    $('receptionDialog').querySelector('button').onclick=()=>$('receptionDialog').close();
    if(page==='staff'){
      const show=filter=>{const list=d.therapists.filter(t=>filter==='new'?t.isNew:filter==='special'?t.special:true);$('staffCards').innerHTML=list.length?grid(list.map(t=>card(t))):empty('該当するセラピストはいません。');};
      show(new URLSearchParams(location.search).get('filter')||'all');document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));show(b.dataset.filter);});
    }
    let scheduleRequest=0;
    async function showSchedule(date,target){const seq=++scheduleRequest;target.innerHTML=empty('出勤情報を読み込んでいます…');try{const rows=await C.shifts(d,date);if(seq!==scheduleRequest)return;const known=rows.filter(s=>d.therapists.some(t=>t.id===s.therapistId));target.innerHTML=known.length?grid(known.map(s=>card(d.therapists.find(t=>t.id===s.therapistId),s))):empty(rows.length?'出勤情報はお電話でご確認ください。':`${E(fmtDate(date))}の出勤はまだ登録されていません。最新情報はお電話でご確認ください。`);}catch{if(seq===scheduleRequest)target.innerHTML=empty('出勤情報を取得できませんでした。お電話でご確認ください。');}}
    if(page==='home')showSchedule(C.today(),$('todaySchedule'));
    if(page==='schedule'){showSchedule(C.today(),$('scheduleCards'));document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-date]').forEach(x=>x.classList.toggle('active',x===b));showSchedule(b.dataset.date,$('scheduleCards'));});}
    if(profile){updateSEO(profile.name+'｜神栖のメンズエステ プラチナ',profile.name+'のプロフィール・出勤情報・写メ日記。神栖プラチナのセラピストをご紹介します。','/profile.html?id='+encodeURIComponent(profile.id));$('main').insertAdjacentHTML('beforeend',section('PHOTO DIARY',E(profile.name)+'の写メ日記','<div id="diaryEntries" aria-live="polite"></div>'+more('diary.html?therapist='+encodeURIComponent(profile.id),'日記をすべて見る')));}
    if(page==='profile'&&!profile){const robots=document.createElement('meta');robots.name='robots';robots.content='noindex';document.head.append(robots);}
    if($('diaryEntries')){
      let sequence=0;
      const params=new URLSearchParams(location.search);
      let selected=profile?.id||params.get('therapist')||'';
      if(selected&&!d.therapists.some(t=>t.id===selected))selected='';
      if($('diaryTherapist'))$('diaryTherapist').value=selected;
      const dateTime=value=>new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value));
      async function showDiaries(p=1,id=''){
        const current=++sequence,target=$('diaryEntries');target.innerHTML=empty('日記を読み込んでいます…');
        try{
          const q=new URLSearchParams({page:String(p),limit:page==='home'?'5':profile?'6':'12'});
          if(selected)q.set('therapist',selected);if(id)q.set('id',id);
          const response=await fetch('/api/diary?'+q,{cache:'no-store',signal:AbortSignal.timeout(20000)}),result=await response.json();
          if(!response.ok||!result.ok||!Array.isArray(result.entries))throw new Error('DIARY_FETCH_FAILED');
          if(current!==sequence)return;
          if(page==='diary'&&!id)updateSEO('写メ日記｜神栖のメンズエステ プラチナ','神栖プラチナのセラピスト写メ日記。写真とともに日々の出来事や出勤のお知らせをお届けします。','/diary.html'+(selected?'?therapist='+encodeURIComponent(selected):''));
          if(id&&result.entries[0]){const r=result.entries[0];updateSEO(r.title+'｜'+r.therapist_name+'の写メ日記｜神栖プラチナ',r.body.replace(/\s+/g,' ').slice(0,120),'/diary.html?id='+encodeURIComponent(r.id));}
          const cards=result.entries.filter(r=>d.therapists.some(t=>t.id===r.therapist_id)).map(r=>{
            const detail=link('diary.html?id='+encodeURIComponent(r.id)),pics=r.photos.filter(x=>C.url(x));
            if(id)return `<article class="diary-article"><div class="diary-byline"><a href="${E(link('profile.html?id='+encodeURIComponent(r.therapist_id)))}">${E(r.therapist_name)}</a><time datetime="${E(r.posted_at)}">${E(dateTime(r.posted_at))}</time></div><h2>${E(r.title)}</h2><div class="diary-photos">${pics.map(src=>`<img src="${E(src)}" alt="${E(r.title)}" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div><p class="diary-body">${E(r.body)}</p><a class="diary-source" href="${E(r.source_url)}" target="_blank" rel="noopener noreferrer">エステ魂で元の日記を見る ↗</a></article>`;
            return `<article class="diary-card"><a href="${E(detail)}" class="diary-cover">${pics[0]?`<img src="${E(pics[0])}" alt="${E(r.title)}" loading="lazy" referrerpolicy="no-referrer">`:'<span>Platinum<small>PHOTO DIARY</small></span>'}</a><div class="diary-card-content"><time datetime="${E(r.posted_at)}">${E(dateTime(r.posted_at))}</time><h3><a href="${E(detail)}">${E(r.title)}</a></h3><p>${E(r.body.slice(0,85))}${r.body.length>85?'…':''}</p><a class="diary-author" href="${E(link('profile.html?id='+encodeURIComponent(r.therapist_id)))}">${E(r.therapist_name)}　→</a></div></article>`;
          });
          target.innerHTML=(result.stale?'<p class="muted">更新が遅れています。前回取得した日記を表示しています。</p>':'')+(cards.length?(id?cards.join(''):`<div class="diary-grid ${page==='home'?'diary-latest':''}">${cards.join('')}</div>`):empty(id?'この日記は現在公開されていません。':'公開中の写メ日記はまだありません。'));
          if(page==='diary'){
            if(id)target.insertAdjacentHTML('beforeend',more('diary.html','日記一覧へ'));
            else {const pages=Math.ceil(result.total/result.limit);target.insertAdjacentHTML('beforeend',`<div class="diary-pagination">${p>1?'<button class="button" data-diary-page="'+(p-1)+'">前へ</button>':''}<span>${result.total}件${pages?' ／ '+p+' / '+pages+'ページ':''}</span>${p<pages?'<button class="button" data-diary-page="'+(p+1)+'">次へ</button>':''}</div>`);target.querySelectorAll('[data-diary-page]').forEach(b=>b.onclick=()=>{showDiaries(Number(b.dataset.diaryPage));target.scrollIntoView({block:'start'});});}
          }
        }catch{if(current===sequence)target.innerHTML=empty('日記を取得できませんでした。時間をおいて再読み込みしてください。')+'<div class="section-more"><button class="button" id="retryDiary">再読み込み</button></div>';if($('retryDiary'))$('retryDiary').onclick=()=>showDiaries(p,id);}
      }
      showDiaries(1,page==='diary'?params.get('id')||'':'');
      if($('diaryTherapist'))$('diaryTherapist').onchange=()=>{selected=$('diaryTherapist').value;const query=selected?'?therapist='+encodeURIComponent(selected):'';history.replaceState(null,'','diary.html'+query);showDiaries();};
    }
    if(profile){const dates=C.dates();try{const rows=await C.shifts(d,dates[0],dates[6]);$('profileWeek').innerHTML='<h3>今週の出勤</h3><div class="week-list">'+dates.map(date=>{const rowsForDay=rows.filter(s=>s.therapistId===profile.id&&s.date===date);return `<div class="week-day">${fmtDate(date)}<strong>${rowsForDay.map(s=>E(s.start_time.slice(0,5))+'<br>〜'+E(s.end_time.slice(0,5))).join('<br>')||'未定'}</strong></div>`;}).join('')+'</div>';}catch{$('profileWeek').innerHTML=empty('出勤情報を取得できませんでした。');}}
  }catch(error){root.innerHTML='<div class="no-script"><h1>読み込みに失敗しました</h1><p>時間をおいて再読み込みしてください。</p><a href="tel:07090949709">電話でお問い合わせ</a></div>';console.error(error);}
})();
