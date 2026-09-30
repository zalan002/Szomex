const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
// Címzett és Mailgun (EU) alapértékek. A kulcs (MAILGUN_API_KEY) és a másolatot kérő cím (LEAD_BCC) csak környezeti változóból jön.
export const LEAD_TO_DEFAULT='Szomex Kft. <info@szomex.hu>';
export const MAILGUN_DOMAIN_DEFAULT='mg.traininghungary.com';
export const MAILGUN_API_BASE_DEFAULT='https://api.eu.mailgun.net/v3';
const UTM_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const CLICK_SOURCES={google_ads:'Google Ads (gclid)',meta_ads:'Facebook / Instagram (fbclid)'};
const CONTACT_HINT='írj a taborfalva@szomex.hu címre, vagy hívj a +36 30 948 0560 számon.';
export function validateLead(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Érvénytelen kérés.'};
  if(input.steps&&!/^\d{1,3}$/.test(String(input.steps)))return {error:'A lépcsőfokok száma 1 és 300 közötti lehet.'};
  for(const [key,limit] of Object.entries({name:100,email:254,phone:30,city:100,message:5000}))if(typeof input[key]==='string'&&input[key].length>limit)return {error:'Az egyik mező túl hosszú.'};
  const lead={name:clean(input.name,100),email:clean(input.email,254),phone:clean(input.phone,30),city:clean(input.city,100),steps:clean(String(input.steps||''),3),timeline:clean(input.timeline,60),message:clean(input.message,5000),formType:['stairs','comment'].includes(input.formType)?input.formType:'general',pagePath:['/lepcso','/2025/05/30/hello-world','/2025/05/30/hello-world/'].includes(input.pagePath)?input.pagePath:'/',requestId:clean(input.requestId,36),privacy:input.privacy===true,materialOnly:input.materialOnly===true,website:clean(input.website,200),token:clean(input['cf-turnstile-response'],2048),attribution:{}};
  if(lead.website)return {error:'A kérés nem küldhető el.'};
  if(lead.name.length<2||lead.message.length<5)return {error:'Kérjük, add meg a nevedet és az üzenetedet.'};
  if(!/^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$/.test(lead.email)||/[\r\n]/.test(lead.name+lead.phone))return {error:'Kérjük, ellenőrizd az elérhetőségeidet.'};
  if(!lead.privacy)return {error:'Az ajánlatkéréshez olvasd el és fogadd el az adatkezelési tájékoztatót.'};
  if(lead.formType==='stairs'&&!lead.materialOnly)return {error:'Kérjük, erősítsd meg, hogy alapanyagot keresel, beszerelés nélkül.'};
  if(lead.steps&&(!/^\d+$/.test(lead.steps)||+lead.steps<1||+lead.steps>300))return {error:'A lépcsőfokok száma 1 és 300 közötti lehet.'};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lead.requestId))return {error:'Érvénytelen kérésazonosító. Frissítsd az oldalt.'};
  for(const k of UTM_KEYS){const v=input.attribution?.[k];if(typeof v==='string'&&/^[\p{L}\p{N}_.{}\- ]{1,150}$/u.test(v))lead.attribution[k]=v;}
  const click=input.attribution?.click_source;if(typeof click==='string'&&Object.hasOwn(CLICK_SOURCES,click))lead.attribution.click_source=click;
  return {lead};
}
export function composeEmail(lead){
  if(lead.formType==='comment')return ['Moderálásra váró hozzászólás',`Bejegyzés: ${lead.pagePath}`,`Beküldő: ${lead.name}`,`E-mail (nem publikálható): ${lead.email}`,'',lead.message,'',`Azonosító: ${lead.requestId}`,'A hozzászólást ellenőrzés után a weboldal forrásában lehet közzétenni.'].join('\n');
  const source=[...UTM_KEYS.filter(k=>lead.attribution[k]).map(k=>`${k}: ${lead.attribution[k]}`),...(lead.attribution.click_source?['Hirdetési kattintás: '+CLICK_SOURCES[lead.attribution.click_source]]:[])];
  return ['Új ajánlatkérés – '+(lead.formType==='stairs'?'Tölgyfa lépcső alapanyag':'Tölgyfa alapanyag'),'','Név: '+lead.name,'E-mail: '+lead.email,'Telefon: '+(lead.phone||'Nincs megadva'),'Település: '+(lead.city||'Nincs megadva'),'Lépcsőfokok: '+(lead.steps||'Nincs megadva'),'Tervezett időpont: '+(lead.timeline||'Nincs megadva'),'','Üzenet:',lead.message,'','Alapanyag, beszerelés nélkül: '+(lead.materialOnly?'Tudomásul vette':'Általános megkeresés'),'Adatkezelési tájékoztató: elfogadta (2026-09-30 v2)','Oldal: '+lead.pagePath,'Azonosító: '+lead.requestId,...(source.length?['','Kampányforrás:',...source]:[]),'','Az érdeklődőnek a „Válasz” gombbal közvetlenül írhatsz.'].join('\n');
}
export function composeSubject(lead,env={}){
  const test=env.VERCEL_ENV&&env.VERCEL_ENV!=='production'?'[TESZT] ':'';
  if(lead.formType==='comment')return test+'Moderálandó hozzászólás – '+lead.name;
  return test+'Új ajánlatkérés – '+(lead.formType==='stairs'?'lépcső alapanyag':'tölgyfa alapanyag')+' – '+lead.name;
}
// Mailgun HTTP API: https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages
export function mailgunRequest(lead,env={}){
  const domain=env.MAILGUN_DOMAIN||MAILGUN_DOMAIN_DEFAULT;
  const form=new URLSearchParams({from:env.LEAD_FROM||`Tölgy Alapanyag weboldal <noreply@${domain}>`,to:env.LEAD_TO||LEAD_TO_DEFAULT,subject:composeSubject(lead,env),text:composeEmail(lead),'h:Reply-To':lead.email,'o:tag':lead.formType==='comment'?'szomex-hozzaszolas':'szomex-ajanlatkeres','o:tracking':'no','v:source':'szomex-weboldal','v:lead_id':lead.requestId});
  if(env.LEAD_BCC)form.set('bcc',env.LEAD_BCC);
  return {url:`${(env.MAILGUN_API_BASE||MAILGUN_API_BASE_DEFAULT).replace(/\/+$/,'')}/${encodeURIComponent(domain)}/messages`,form};
}
export function allowedOrigins(env){
  const origins=new Set(['https://tolgyalapanyag.hu','https://www.tolgyalapanyag.hu']);
  if(env.SITE_URL)origins.add(env.SITE_URL.replace(/\/$/,''));
  for(const host of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL])if(host)origins.add('https://'+host);
  if(env.NODE_ENV!=='production'&&!env.VERCEL)origins.add('http://localhost:4173');
  return origins;
}
export async function processLead({body,origin,host,contentType,env=process.env,fetchImpl=fetch}){
  if(!contentType?.toLowerCase().startsWith('application/json'))return {status:415,data:{ok:false,message:'JSON formátumú kérés szükséges.'}};
  if(!origin||!allowedOrigins(env).has(origin)||new URL(origin).host!==host)return {status:403,data:{ok:false,message:'A kérés forrása nem engedélyezett.'}};
  const result=validateLead(body);if(result.error)return {status:400,data:{ok:false,message:result.error}};
  if(!env.MAILGUN_API_KEY){console.error('[lead] A MAILGUN_API_KEY nincs beállítva, a levél nem küldhető.');return {status:503,data:{ok:false,message:'Az online ajánlatküldés jelenleg nem elérhető. Kérjük, '+CONTACT_HINT}};}
  const {lead}=result;
  // A Turnstile opcionális: csak akkor kötelező, ha a webhely- és a titkos kulcs is be van állítva.
  const challengeRequired=Boolean(env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_SITE_KEY);
  if(challengeRequired&&!lead.token)return {status:400,data:{ok:false,message:'Kérjük, végezd el az űrlap biztonsági ellenőrzését.'}};
  try{
    if(challengeRequired){
      const challenge=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:lead.token}),signal:AbortSignal.timeout(6000)});
      const verification=await challenge.json();
      if(!challenge.ok||!verification.success||verification.hostname!==new URL(origin).hostname||verification.action!=='lead')return {status:400,data:{ok:false,message:'A biztonsági ellenőrzés lejárt vagy sikertelen. Próbáld újra.'}};
    }
    const {url,form}=mailgunRequest(lead,env);
    const sent=await fetchImpl(url,{method:'POST',headers:{Authorization:'Basic '+Buffer.from('api:'+env.MAILGUN_API_KEY).toString('base64')},body:form,signal:AbortSignal.timeout(10000)});
    let receipt={};try{receipt=await sent.json();}catch{}
    if(!sent.ok||!receipt?.id){console.error('[lead] A Mailgun nem fogadta el a levelet:',sent.status,String(receipt?.message||'').slice(0,200));return {status:502,data:{ok:false,message:'Az üzenet továbbítása nem sikerült. Próbáld újra, vagy '+CONTACT_HINT}};}
    return {status:200,data:{ok:true,id:lead.requestId}};
  }catch(error){console.error('[lead] Küldési hiba:',error?.name||'Error');return {status:502,data:{ok:false,message:'A küldés visszajelzése nem érkezett meg. Próbáld újra ugyanitt, vagy keresd kollégáinkat telefonon.'}};}
}
