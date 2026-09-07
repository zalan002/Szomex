(() => {
  'use strict';
  const config=window.SZOMEX_CONFIG||{};
  const consentKey='szomex-consent-v1';
  let consent={analytics:false,marketing:false};
  const memory={};
  function read(store,key){try{return store.getItem(key);}catch{return memory[key]||null;}}
  function write(store,key,value){try{store.setItem(key,value);}catch{memory[key]=value;}}
  function remove(store,key){try{store.removeItem(key);}catch{delete memory[key];}}
  let saved;
  try{saved=JSON.parse(read(localStorage,consentKey)||'null');if(saved&&saved.expires>Date.now())consent={analytics:saved.analytics===true,marketing:saved.marketing===true};else saved=null;}catch{saved=null;}
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('set','ads_data_redaction',true);
  const loaded=new Set();
  function script(src,id,onload){if(loaded.has(id))return;loaded.add(id);const s=document.createElement('script');s.async=true;s.src=src;s.id=id;if(onload)s.onload=onload;document.head.append(s);}
  const allowed=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?false:config.trackingEnabled===true;
  function analyticsUrl(){const url=new URL(location.origin+location.pathname),params=new URLSearchParams(location.search);for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=params.get(key);if(value&&/^[\p{L}\p{N}_.{}\- ]{1,150}$/u.test(value))url.searchParams.set(key,value);}return url.href;}
  function cleanCookies(){for(const part of document.cookie.split(';')){const key=part.trim().split('=')[0];if(/^(_ga|_gid|_gat|_gcl|_fbp|_fbc|_clck|_clsk)/.test(key)){for(const domain of ['',location.hostname,'.'+location.hostname,'.tolgyalapanyag.hu'])document.cookie=`${key}=; Max-Age=0; path=/; SameSite=Lax${domain?'; domain='+domain:''}`;}}}
  function activate(){
    window.gtag('consent','update',{analytics_storage:consent.analytics?'granted':'denied',ad_storage:consent.marketing?'granted':'denied',ad_user_data:consent.marketing?'granted':'denied',ad_personalization:consent.marketing?'granted':'denied'});
    if(!allowed)return;
    const firstId=consent.analytics?config.gaId:consent.marketing?config.adsId:'';
    if(firstId&&!loaded.has('google')){window.gtag('js',new Date());script('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(firstId),'google');}
    if(consent.analytics&&config.gaId&&!loaded.has('ga-config')){loaded.add('ga-config');window.gtag('config',config.gaId,{page_location:analyticsUrl(),send_page_view:true});}
    if(consent.marketing&&config.adsId&&!loaded.has('ads-config')){loaded.add('ads-config');window.gtag('config',config.adsId);}
    if(consent.analytics&&config.clarityId){if(!window.clarity)window.clarity=function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};window.clarity('consentv2',{ad_Storage:consent.marketing?'granted':'denied',analytics_Storage:'granted'});script('https://www.clarity.ms/tag/'+config.clarityId,'clarity');}
    // The original container may contain unknown tags. Load only after both grants.
    if(consent.analytics&&consent.marketing&&config.enableLegacyGtm&&config.gtmId&&!loaded.has('legacy-gtm')){window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});script('https://www.googletagmanager.com/gtm.js?id='+config.gtmId,'legacy-gtm');}
    if(consent.marketing&&config.metaPixelId){
      if(!window.fbq){const f=window.fbq=function(){f.callMethod?f.callMethod.apply(f,arguments):f.queue.push(arguments);};window._fbq=f;f.push=f;f.loaded=true;f.version='2.0';f.queue=[];}
      window.fbq('consent','grant');
      if(!loaded.has('meta')){script('https://connect.facebook.net/en_US/fbevents.js','meta');window.fbq('init',config.metaPixelId);window.fbq('track','PageView');if(location.pathname.replace(/\/$/,'')==='/lepcso')window.fbq('track','ViewContent',{content_name:'Tölgyfa lépcső alapanyag',content_category:'alapanyag'});}
    }
  }
  function track(name,params={}){
    if(!allowed)return;
    const safe={page_path:location.pathname,form_type:params.form_type||undefined,placement:params.placement||undefined,event_id:params.event_id||undefined};
    if(consent.analytics&&config.gaId)window.gtag('event',name,{...safe,send_to:config.gaId});
    if(name==='generate_lead'&&consent.analytics&&config.gaId)window.gtag('event','form_bekuldes',{...safe,send_to:config.gaId});
    if(name==='generate_lead'&&consent.marketing){
      if(window.fbq&&config.metaPixelId)window.fbq('track','Lead',{content_name:params.form_type==='stairs'?'Tölgyfa lépcső alapanyag':'Tölgyfa alapanyag'},{eventID:params.event_id});
      if(config.adsId&&config.adsLeadLabel)window.gtag('event','conversion',{send_to:`${config.adsId}/${config.adsLeadLabel}`,transaction_id:params.event_id});
    }
  }
  const panel=document.createElement('section');panel.className='cookie-panel';panel.setAttribute('aria-label','Sütibeállítások');panel.hidden=true;
  panel.innerHTML='<h2>Te döntesz a sütikről.</h2><p>Az oldal működéséhez szükséges beállításokon túl csak az engedélyeddel használunk látogatottsági és hirdetési mérést. <a href="/adatkezeles">Részletek</a></p><div class="cookie-options" hidden><label><input type="checkbox" name="analytics"> Látogatottság és használat (Google / Clarity)</label><label><input type="checkbox" name="marketing"> Hirdetési mérés (Google / Meta)</label></div><div class="cookie-actions"><button type="button" data-choice="reject">Elutasítom</button><button type="button" data-choice="settings">Beállítom</button><button type="button" data-choice="accept" class="accept">Elfogadom</button></div>';
  document.body.append(panel);
  let panelOpener;
  function showSettings(expanded=false){panelOpener=document.activeElement;panel.hidden=false;panel.querySelector('.cookie-options').hidden=!expanded;panel.querySelector('[name=analytics]').checked=consent.analytics;panel.querySelector('[name=marketing]').checked=consent.marketing;panel.querySelector('[data-choice=settings]').textContent=expanded?'Mentés':'Beállítom';if(expanded)panel.querySelector('input').focus();}
  function setConsent(next){const revoked=(consent.analytics&&!next.analytics)||(consent.marketing&&!next.marketing);consent=next;write(localStorage,consentKey,JSON.stringify({...next,expires:Date.now()+180*86400000}));activate();if(!next.marketing&&window.fbq)window.fbq('consent','revoke');if(!next.analytics&&window.clarity)window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});if(revoked){cleanCookies();remove(sessionStorage,'szomex-attribution');}panel.hidden=true;panelOpener?.focus();if(revoked)location.reload();}
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(!b)return;const choice=b.dataset.choice;if(choice==='reject')setConsent({analytics:false,marketing:false});if(choice==='accept')setConsent({analytics:true,marketing:true});if(choice==='settings'){if(panel.querySelector('.cookie-options').hidden)showSettings(true);else setConsent({analytics:panel.querySelector('[name=analytics]').checked,marketing:panel.querySelector('[name=marketing]').checked});}});
  if(!saved)showSettings();activate();
  document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.addEventListener('click',()=>showSettings(true)));
  document.querySelectorAll('[data-track]').forEach(a=>a.addEventListener('click',()=>track(a.dataset.track,{placement:location.pathname==='/'?'home':'stairs'})));
  document.querySelectorAll('[data-load-map]').forEach(b=>b.addEventListener('click',()=>{const box=b.closest('.map-consent');const frame=box.nextElementSibling;if(frame?.matches('iframe[data-consent-src]')){frame.src=frame.dataset.consentSrc;box.hidden=true;}}));
  function attribution(){
    if(!consent.analytics&&!consent.marketing)return {};
    const p=new URLSearchParams(location.search),out={};
    for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const val=p.get(k);if(val&&/^[\p{L}\p{N}_.{}\- ]{1,150}$/u.test(val))out[k]=val;}
    if(Object.keys(out).length)write(sessionStorage,'szomex-attribution',JSON.stringify(out));
    try{return Object.keys(out).length?out:JSON.parse(read(sessionStorage,'szomex-attribution')||'{}');}catch{return {};}
  }
  attribution();
  const forms=[...document.querySelectorAll('[data-lead-form]')];
  function setupChallenge(){if(!config.turnstileSiteKey||!window.turnstile)return;forms.forEach(form=>{const el=form.querySelector('[data-turnstile]');if(el.dataset.widget)return;el.dataset.widget=window.turnstile.render(el,{sitekey:config.turnstileSiteKey,action:'lead',theme:'light'});});}
  if(forms.length&&config.turnstileSiteKey)script('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit','turnstile',setupChallenge);
  forms.forEach(form=>{
    if(form.dataset.kind==='stairs')form.elements.materialOnly.required=true;
    let started=false,requestId=crypto.randomUUID(),completed=false;
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
        write(sessionStorage,'szomex-receipt',JSON.stringify({id:result.id,at:Date.now()}));
        track('generate_lead',{form_type:form.dataset.kind,event_id:result.id});form.reset();
        setTimeout(()=>location.assign('/koszonooldal'),700);
      }catch(error){
        status.classList.add('error');status.textContent=error.name==='TimeoutError'?'A küldés visszajelzése késik. Próbáld újra ugyanitt, vagy írj a taborfalva@szomex.hu címre.':error.message;status.focus();button.disabled=false;button.innerHTML='Újra megpróbálom ↗';
        const widget=form.querySelector('[data-turnstile]').dataset.widget;if(widget&&window.turnstile)window.turnstile.reset(widget);
        track('form_error',{form_type:form.dataset.kind});
      }
    });
  });
  // A direct visit to the thank-you route never fires a lead conversion.
  const search=document.querySelector('[data-search-results]');
  if(search){const term=(new URLSearchParams(location.search).get('s')||'').trim().slice(0,100);const field=document.querySelector('[name=s]');if(field)field.value=term;const pages=[{title:'Tölgyfa alapanyag – teljes kínálat',url:'/',terms:'tölgy fa alapanyag szomex méret gyártó polc párkány asztallap kapcsolat táborfalva'},{title:'Tölgyfa lépcső alapanyag',url:'/lepcso',terms:'tölgy fa lépcső alapanyag lépcsőlap ajánlat'},{title:'Sample Page',url:'/sample-page',terms:'sample page'},{title:'Hello world!',url:'/2025/05/30/hello-world',terms:'hello world wordpress'}];const hits=term?pages.filter(p=>(p.title+' '+p.terms).toLocaleLowerCase('hu').includes(term.toLocaleLowerCase('hu'))):[];const heading=document.createElement('p');heading.textContent=term?`${hits.length} találat erre: ${term}`:'Írj be egy keresőkifejezést.';search.append(heading);for(const p of hits){const row=document.createElement('p'),a=document.createElement('a');a.href=p.url;a.textContent=p.title;row.append(a);search.append(row);}}
})();

