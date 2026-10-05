(function (root) {
  'use strict';
  const config = root.PLATINUM_CONFIG || {};
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(value, image = false) {
    if (!value) return '';
    if (image && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  }
  const today = () => new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
  const dates = (count = 7) => Array.from({length:count}, (_,i) => new Date(Date.now()+6*3600000+i*86400000).toISOString().slice(0,10));
  function publicData(input) {
    const d = clone(input);
    delete d.password;
    d.therapists = d.therapists.map((t,i) => ({...t,legacyIndex:t.legacyIndex ?? i})).filter(t=>t.active);
    const ids = new Set(d.therapists.map(t=>t.id));
    d.news = d.news.filter(n=>n.published !== false);
    d.shifts = d.shifts.filter(s=>s.published !== false && ids.has(s.therapistId));
    return d;
  }
  function validate(d) {
    const errors = [];
    if (!d?.shop || !Array.isArray(d.therapists) || !Array.isArray(d.news) || !Array.isArray(d.courses) || !Array.isArray(d.shifts)) return ['データ形式が正しくありません。'];
    if (!String(d.shop.name||'').trim()) errors.push('店舗名を入力してください。');
    if (!/^[0-9+()\s-]{9,20}$/.test(d.shop.phone)) errors.push('電話番号を確認してください。');
    if (!url(d.shop.webUrl)) errors.push('Web予約URLは https:// または http:// から入力してください。');
    const ids = new Set();
    const names = new Set(), externalIds = new Set();
    d.therapists.forEach(t => {
      if (!String(t.name||'').trim()) errors.push('セラピスト名を入力してください。');
      if (ids.has(t.id)) errors.push('セラピストIDが重複しています。');
      ids.add(t.id);
      if(t.supabaseId){if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(t.supabaseId)||externalIds.has(t.supabaseId.toLowerCase()))errors.push('連携用セラピストIDの形式・重複を確認してください。');externalIds.add(t.supabaseId.toLowerCase());}
      if (t.active && names.has(t.name)) errors.push('公開中のセラピスト名が重複しています。');
      if(t.active) names.add(t.name);
      if (t.age && (!Number.isInteger(t.age) || t.age < 18 || t.age > 100)) errors.push(t.name+'さんの年齢を確認してください。');
      if ([t.photo,...(t.photos||[])].some(p=>p && !url(p,true))) errors.push(t.name+'さんの画像URLを確認してください。');
    });
    d.courses.forEach(c=>{if(!Number.isInteger(c.minutes)||c.minutes<=0||!Number.isInteger(c.price)||c.price<0) errors.push('コース時間・料金を確認してください。');});
    const shiftKeys = new Set();
    d.shifts.forEach(s=>{
      if (!ids.has(s.therapistId)) errors.push('出勤するセラピストを選択してください。');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || Number.isNaN(Date.parse(s.date))) errors.push('出勤日を確認してください。');
      if (![s.start,s.end].every(t=>/^([01]\d|2[0-9]):[0-5]\d$/.test(t)) || s.end<=s.start) errors.push('出勤時間は終了が開始より後になるよう入力してください。深夜2時は26:00です。');
      const key = s.therapistId+'|'+s.date;
      if(shiftKeys.has(key)) errors.push('同じセラピストの同じ日付の出勤が重複しています。');
      shiftKeys.add(key);
    });
    if(d.banner.active && d.banner.type==='image' && !url(d.banner.imgUrl,true)) errors.push('バナー画像を設定してください。');
    if(d.banner.link && !url(d.banner.link)) errors.push('バナーのリンクURLを確認してください。');
    (d.links||[]).forEach(l=>{if(!url(l.url)||l.banner&&!url(l.banner,true))errors.push('関連リンクのURLを確認してください。');});
    if (JSON.stringify(d).length > 6000000) errors.push('画像を含むデータが大きすぎます。画像枚数を減らしてください。');
    return [...new Set(errors)];
  }
  async function request(path, options = {}, token) {
    const response = await fetch(config.url+'/rest/v1/'+path, {...options, headers:{apikey:config.anonKey,Authorization:'Bearer '+(token||config.anonKey),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
    const body = await response.text();
    let result; try {result=body?JSON.parse(body):null;}catch{throw new Error('サーバーの応答を確認できませんでした。');}
    if(!response.ok) throw new Error(result?.message || '通信に失敗しました。');
    return result;
  }
  async function defaults() {
    const r=await fetch('assets/default-data.json');
    if(!r.ok) throw new Error('初期データを読み込めませんでした。');
    return r.json();
  }
  async function loadPublic() {
    if(new URLSearchParams(location.search).get('preview')==='1'){
      const draft=localStorage.getItem('platinum_preview_v1');
      if(draft) return {data:publicData(JSON.parse(draft)),preview:true};
    }
    if(config.cmsEnabled){
      try {
        const rows=await request('platinum_public?store_id=eq.'+config.storeId+'&select=payload');
        if(rows.length) return {data:publicData(rows[0].payload)};
        throw new Error('公開済みの情報がありません。');
      } catch { throw new Error('最新の公開情報を取得できませんでした。時間をおいて再読み込みしてください。'); }
    }
    return {data:publicData(await defaults())};
  }
  async function shifts(data, first, last = first) {
    const response=await fetch('/api/shifts?'+new URLSearchParams({from:first,to:last}),{signal:AbortSignal.timeout(15000),cache:'no-store'});
    const result=await response.json();
    if(!response.ok||result.ok!==true||!Array.isArray(result.shifts))throw new Error('出勤情報を取得できませんでした。');
    return result.shifts.map(s=>{
      const exact=s.therapist_id&&data.therapists.find(t=>t.supabaseId?.toLowerCase()===s.therapist_id.toLowerCase());
      const byName=data.therapists.filter(t=>!t.supabaseId&&t.name===s.therapist_name);
      return {...s,therapistId:exact?.id||(byName.length===1?byName[0].id:undefined)};
    });
  }
  root.Platinum={config,clone,escape,url,today,dates,publicData,validate,request,defaults,loadPublic,shifts};
})(typeof window === 'undefined' ? globalThis : window);
