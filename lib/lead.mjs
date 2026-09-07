import {createHash} from 'node:crypto';
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateLead(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Érvénytelen kérés.'};
  if(input.steps&&!/^\d{1,3}$/.test(String(input.steps)))return {error:'A lépcsőfokok száma 1 és 300 közötti lehet.'};
  for(const [key,limit] of Object.entries({name:100,email:254,phone:30,city:100,message:5000}))if(typeof input[key]==='string'&&input[key].length>limit)return {error:'Az egyik mező túl hosszú.'};
  const lead={name:clean(input.name,100),email:clean(input.email,254),phone:clean(input.phone,30),city:clean(input.city,100),steps:clean(String(input.steps||''),3),timeline:clean(input.timeline,60),message:clean(input.message,5000),formType:['stairs','comment'].includes(input.formType)?input.formType:'general',pagePath:['/lepcso','/2025/05/30/hello-world','/2025/05/30/hello-world/'].includes(input.pagePath)?input.pagePath:'/',requestId:clean(input.requestId,36),privacy:input.privacy===true,materialOnly:input.materialOnly===true,website:clean(input.website,200),token:clean(input['cf-turnstile-response'],2048),attribution:{}};
  if(lead.website)return {error:'A kérés nem küldhető el.'};
  if(lead.name.length<2||lead.message.length<5)return {error:'Kérjük, add meg a nevedet és az üzenetedet.'};
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(lead.email)||/[\r\n]/.test(lead.name+lead.phone))return {error:'Kérjük, ellenőrizd az elérhetőségeidet.'};
  if(!lead.privacy)return {error:'Az ajánlatkéréshez olvasd el és fogadd el az adatkezelési tájékoztatót.'};
  if(lead.formType==='stairs'&&!lead.materialOnly)return {error:'Kérjük, erősítsd meg, hogy alapanyagot keresel, beszerelés nélkül.'};
  if(lead.steps&&(!/^\d+$/.test(lead.steps)||+lead.steps<1||+lead.steps>300))return {error:'A lépcsőfokok száma 1 és 300 közötti lehet.'};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lead.requestId))return {error:'Érvénytelen kérésazonosító. Frissítsd az oldalt.'};
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const v=input.attribution?.[k];if(typeof v==='string'&&/^[\p{L}\p{N}_.{}\- ]{1,150}$/u.test(v))lead.attribution[k]=v;}
  return {lead};
}
export function composeEmail(lead){
  if(lead.formType==='comment')return ['Moderálásra váró hozzászólás',`Bejegyzés: ${lead.pagePath}`,`Beküldő: ${lead.name}`,`E-mail (nem publikálható): ${lead.email}`,'',lead.message,'',`Azonosító: ${lead.requestId}`,'A hozzászólást ellenőrzés után a weboldal forrásában lehet közzétenni.'].join('\n');
  return ['Új ajánlatkérés – '+(lead.formType==='stairs'?'Tölgyfa lépcső alapanyag':'Tölgyfa alapanyag'),'','Név: '+lead.name,'E-mail: '+lead.email,'Telefon: '+(lead.phone||'Nincs megadva'),'Település: '+(lead.city||'Nincs megadva'),'Lépcsőfokok: '+(lead.steps||'Nincs megadva'),'Tervezett időpont: '+(lead.timeline||'Nincs megadva'),'','Üzenet:',lead.message,'','Alapanyag, beszerelés nélkül: '+(lead.materialOnly?'Tudomásul vette':'Általános megkeresés'),'Adatkezelési tájékoztató: elfogadta (2026-09-07 v1)','Oldal: '+lead.pagePath,'Azonosító: '+lead.requestId,'',...Object.entries(lead.attribution).map(([k,v])=>`${k}: ${v}`)].join('\n');
}
export function idempotencyKey(lead){return 'szomex-'+createHash('sha256').update(lead.requestId+'\n'+composeEmail(lead)).digest('hex');}
export async function processLead({body,origin,host,contentType,env=process.env,fetchImpl=fetch}){
  if(!contentType?.toLowerCase().startsWith('application/json'))return {status:415,data:{ok:false,message:'JSON formátumú kérés szükséges.'}};
  const validOrigins=new Set(['https://tolgyalapanyag.hu','https://www.tolgyalapanyag.hu']);
  if(env.SITE_URL)validOrigins.add(env.SITE_URL.replace(/\/$/,''));
  if(env.VERCEL_URL)validOrigins.add('https://'+env.VERCEL_URL);
  if(env.NODE_ENV!=='production'&&!env.VERCEL)validOrigins.add('http://localhost:4173');
  if(!origin||!validOrigins.has(origin)||new URL(origin).host!==host)return {status:403,data:{ok:false,message:'A kérés forrása nem engedélyezett.'}};
  const result=validateLead(body);if(result.error)return {status:400,data:{ok:false,message:result.error}};
  if(!env.RESEND_API_KEY||!env.LEAD_FROM||!env.TURNSTILE_SECRET_KEY)return {status:503,data:{ok:false,message:'Az online ajánlatküldés jelenleg nem elérhető. Írj a taborfalva@szomex.hu címre, vagy hívj a +36 30 948 0560 számon.'}};
  const {lead}=result;
  if(!lead.token)return {status:400,data:{ok:false,message:'Kérjük, végezd el az űrlap biztonsági ellenőrzését.'}};
  try{
    const challenge=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:lead.token}),signal:AbortSignal.timeout(6000)});
    const verification=await challenge.json();
    if(!challenge.ok||!verification.success||verification.hostname!==new URL(origin).hostname||verification.action!=='lead')return {status:400,data:{ok:false,message:'A biztonsági ellenőrzés lejárt vagy sikertelen. Próbáld újra.'}};
    const sent=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':idempotencyKey(lead)},body:JSON.stringify({from:env.LEAD_FROM,to:[env.LEAD_TO||'taborfalva@szomex.hu'],reply_to:lead.email,subject:lead.formType==='comment'?'Moderálandó hozzászólás – SZOMEX':lead.formType==='stairs'?'Új lépcső alapanyag ajánlatkérés – SZOMEX':'Új tölgyfa alapanyag ajánlatkérés – SZOMEX',text:composeEmail(lead)}),signal:AbortSignal.timeout(10000)});
    const receipt=await sent.json();
    if(!sent.ok||!receipt.id)return {status:502,data:{ok:false,message:'Az üzenet továbbítása nem sikerült. Próbáld újra, vagy írj a taborfalva@szomex.hu címre.'}};
    return {status:200,data:{ok:true,id:lead.requestId}};
  }catch{return {status:502,data:{ok:false,message:'A küldés visszajelzése nem érkezett meg. Próbáld újra ugyanitt, vagy keresd kollégáinkat telefonon.'}};}
}
