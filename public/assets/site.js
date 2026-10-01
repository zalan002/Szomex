(() => {
  'use strict';
  const config=window.SZOMEX_CONFIG||{};
  const receiptKey='szomex-receipt',attributionKey='szomex-attribution';
  const memory={};
  function read(store,key){try{return store.getItem(key);}catch{return memory[key]||null;}}
  function write(store,key,value){try{store.setItem(key,value);}catch{memory[key]=value;}}
  function remove(store,key){try{store.removeItem(key);}catch{delete memory[key];}}
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  const loaded=new Set();
  function script(src,id,onload){if(loaded.has(id))return;loaded.add(id);const s=document.createElement('script');s.async=true;s.src=src;s.id=id;if(onload)s.onload=onload;document.head.append(s);}
  // Like the original site, every visitor is measured; there is no consent banner. Previews and local runs never send data.
  const allowed=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?false:config.trackingEnabled===true;
  const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  // Google Ads click IDs must stay in page_location, otherwise GA4 cannot attribute auto-tagged Ads traffic.
  const adClickKeys=['gclid','gbraid','wbraid','gad_source','gad_campaignid'];
  const utmValue=v=>typeof v==='string'&&/^[\p{L}\p{N}_.{}\- ]{1,150}$/u.test(v);
  function analyticsUrl(){const url=new URL(location.origin+location.pathname),params=new URLSearchParams(location.search);for(const key of utmKeys){const value=params.get(key);if(utmValue(value))url.searchParams.set(key,value);}for(const key of adClickKeys){const value=params.get(key);if(value&&/^[A-Za-z0-9_.-]{1,512}$/.test(value))url.searchParams.set(key,value);}return url.href;}
  function activate(){
    if(!allowed)return;
    const firstId=config.gaId||config.adsId;
    if(firstId){window.gtag('js',new Date());script('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(firstId),'google');}
    if(config.gaId)window.gtag('config',config.gaId,{page_location:analyticsUrl(),send_page_view:true});
    if(config.adsId)window.gtag('config',config.adsId);
    if(config.clarityId){if(!window.clarity)window.clarity=function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};script('https://www.clarity.ms/tag/'+config.clarityId,'clarity');}
    // The original container may contain unknown tags and would double count the direct tags, so it stays opt-in.
    if(config.enableLegacyGtm&&config.gtmId){window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});script('https://www.googletagmanager.com/gtm.js?id='+config.gtmId,'legacy-gtm');}
    if(config.metaPixelId){
      if(!window.fbq){const f=window.fbq=function(){f.callMethod?f.callMethod.apply(f,arguments):f.queue.push(arguments);};window._fbq=f;f.push=f;f.loaded=true;f.version='2.0';f.queue=[];}
      script('https://connect.facebook.net/en_US/fbevents.js','meta');window.fbq('init',config.metaPixelId);window.fbq('track','PageView');if(location.pathname.replace(/\/$/,'')==='/lepcso')window.fbq('track','ViewContent',{content_name:'Tölgyfa lépcső alapanyag',content_category:'alapanyag'});
    }
    flushLeadReceipt();
  }
  function track(name,params={}){
    if(!allowed||!config.gaId)return;
    window.gtag('event',name,{page_path:params.page_path||location.pathname,form_type:params.form_type||undefined,placement:params.placement||undefined,event_id:params.event_id||undefined,send_to:config.gaId});
  }
  // As on the original site, the lead conversion belongs to /koszonooldal: it fires there once on every channel,
  // and only with a fresh receipt of a submission the server accepted. Direct visits and reloads never convert.
  function flushLeadReceipt(){
    if(location.pathname.replace(/\/$/,'')!=='/koszonooldal')return;
    let receipt;try{receipt=JSON.parse(read(sessionStorage,receiptKey)||'null');}catch{receipt=null;}
    remove(sessionStorage,receiptKey);
    if(!receipt||typeof receipt.id!=='string'||!(Date.now()-receipt.at<1800000))return;
    const params={form_type:receipt.type,event_id:receipt.id,page_path:receipt.path};
    track('generate_lead',params);track('form_bekuldes',params);
    if(config.adsId&&config.adsLeadLabel)window.gtag('event','conversion',{send_to:`${config.adsId}/${config.adsLeadLabel}`,transaction_id:receipt.id});
    if(config.metaPixelId&&window.fbq)window.fbq('track','Lead',{content_name:receipt.type==='stairs'?'Tölgyfa lépcső alapanyag':'Tölgyfa alapanyag'},{eventID:receipt.id});
  }
  activate();
  document.querySelectorAll('[data-track]').forEach(a=>a.addEventListener('click',()=>track(a.dataset.track,{placement:location.pathname==='/'?'home':'stairs'})));
  // On phones the call-to-action bar would cover the quote form, so it steps aside while the form is on screen.
  const mobileCta=document.querySelector('.mobile-cta'),quote=document.getElementById('ajanlat');
  if(mobileCta&&quote&&'IntersectionObserver' in window)new IntersectionObserver(([entry])=>mobileCta.classList.toggle('is-hidden',entry.isIntersecting),{rootMargin:'0px 0px -80px 0px'}).observe(quote);
  document.querySelectorAll('[data-load-map]').forEach(b=>b.addEventListener('click',()=>{const box=b.closest('.map-consent');const frame=box.nextElementSibling;if(frame?.matches('iframe[data-consent-src]')){frame.src=frame.dataset.consentSrc;box.hidden=true;}}));
  // Campaign source of the current URL travels with the enquiry (only the source type, never the raw click ID),
  // and stays available on the other pages for the rest of the browser session.
  function attribution(){
    const p=new URLSearchParams(location.search),out={};
    for(const k of utmKeys){const val=p.get(k);if(utmValue(val))out[k]=val;}
    if(['gclid','gbraid','wbraid'].some(k=>p.get(k)))out.click_source='google_ads';else if(p.get('fbclid'))out.click_source='meta_ads';
    if(Object.keys(out).length){write(sessionStorage,attributionKey,JSON.stringify(out));return out;}
    try{return JSON.parse(read(sessionStorage,attributionKey)||'{}');}catch{return {};}
  }
  attribution();
  // crypto.randomUUID is missing on older Safari (before iOS 15.4); a random v4 UUID keeps the form working there.
  function uuid(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
  const forms=[...document.querySelectorAll('[data-lead-form]')];
  function setupChallenge(){if(!config.turnstileSiteKey||!window.turnstile)return;forms.forEach(form=>{const el=form.querySelector('[data-turnstile]');if(el.dataset.widget)return;el.dataset.widget=window.turnstile.render(el,{sitekey:config.turnstileSiteKey,action:'lead',theme:'light'});});}
  if(forms.length&&config.turnstileSiteKey)script('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit','turnstile',setupChallenge);
  forms.forEach(form=>{
    if(form.dataset.kind==='stairs')form.elements.materialOnly.required=true;
    let started=false,requestId=uuid(),completed=false;
    form.addEventListener('input',()=>{if(!started){started=true;track('form_start',{form_type:form.dataset.kind});}},{passive:true});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(completed||!form.reportValidity())return;
      const button=form.querySelector('[type=submit]'),status=form.querySelector('.form-status');
      button.disabled=true;button.textContent='Küldés folyamatban…';status.className='form-status';status.textContent='';
      const data=Object.fromEntries(new FormData(form));
      const payload={...data,formType:form.dataset.kind,pagePath:location.pathname,requestId,attribution:attribution(),privacy:data.privacy==='yes',materialOnly:data.materialOnly==='yes'};
      try{
        const res=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
        const result=await res.json();
        if(!res.ok||!result.ok)throw new Error(result.message||'Az üzenetet nem sikerült elküldeni. Kérjük, próbáld újra.');
        completed=true;status.classList.add('success');status.textContent=form.dataset.kind==='comment'?'Köszönjük! A hozzászólásodat moderálásra továbbítottuk.':'Köszönjük! Az ajánlatkérésedet fogadtuk. Hamarosan felvesszük veled a kapcsolatot.';status.focus();
        if(form.dataset.kind==='comment'){form.reset();button.textContent='Hozzászólás elküldve';return;}
        write(sessionStorage,receiptKey,JSON.stringify({id:result.id,type:form.dataset.kind,path:location.pathname,at:Date.now()}));
        form.reset();
        setTimeout(()=>location.assign('/koszonooldal'),700);
      }catch(error){
        status.classList.add('error');status.textContent=error.name==='TimeoutError'?'A küldés visszajelzése késik. Próbáld újra ugyanitt, vagy írj a taborfalva@szomex.hu címre.':error.message;status.focus();button.disabled=false;button.innerHTML='Újra megpróbálom ↗';
        const widget=form.querySelector('[data-turnstile]').dataset.widget;if(widget&&window.turnstile)window.turnstile.reset(widget);
        track('form_error',{form_type:form.dataset.kind});
      }
    });
  });
  const search=document.querySelector('[data-search-results]');
  if(search){const term=(new URLSearchParams(location.search).get('s')||'').trim().slice(0,100);const field=document.querySelector('[name=s]');if(field)field.value=term;const pages=[{title:'Tölgyfa alapanyag – teljes kínálat',url:'/',terms:'tölgy fa alapanyag szomex méret gyártó polc párkány asztallap kapcsolat táborfalva'},{title:'Tölgyfa lépcső alapanyag',url:'/lepcso',terms:'tölgy fa lépcső alapanyag lépcsőlap ajánlat'},{title:'Sample Page',url:'/sample-page',terms:'sample page'},{title:'Hello world!',url:'/2025/05/30/hello-world',terms:'hello world wordpress'}];const hits=term?pages.filter(p=>(p.title+' '+p.terms).toLocaleLowerCase('hu').includes(term.toLocaleLowerCase('hu'))):[];const heading=document.createElement('p');heading.textContent=term?`${hits.length} találat erre: ${term}`:'Írj be egy keresőkifejezést.';search.append(heading);for(const p of hits){const row=document.createElement('p'),a=document.createElement('a');a.href=p.url;a.textContent=p.title;row.append(a);search.append(row);}}
})();

