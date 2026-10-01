import {createHash} from 'node:crypto';
// Meta Conversions API: the server-side Lead for an accepted enquiry. It shares its event_id with the browser
// Pixel Lead on /koszonooldal (the request id), so Meta counts the two as one conversion.
const sha=v=>createHash('sha256').update(v).digest('hex');
export function metaConfigured(env={}){return Boolean(env.META_DATASET_ID&&env.FB_CAPI_TOKEN);}
export function phoneDigits(phone=''){let d=String(phone).replace(/\D/g,'');if(d.startsWith('06'))d='36'+d.slice(2);else if(d.startsWith('00'))d=d.slice(2);return d;}
export function metaLeadEvent(lead,{origin,ip,userAgent,cookies={}},now=Date.now()){
  const user={client_user_agent:String(userAgent||'').slice(0,1000),em:[sha(lead.email.trim().toLowerCase())],country:[sha('hu')]};
  if(ip)user.client_ip_address=ip;
  const phone=phoneDigits(lead.phone);if(phone.length>=8)user.ph=[sha(phone)];
  const city=lead.city.toLowerCase().replace(/[^\p{L}]/gu,'');if(city)user.ct=[sha(city)];
  for(const k of ['fbp','fbc'])if(/^fb\.[12]\.\d+\.[\w.-]+$/.test(cookies['_'+k]||''))user[k]=cookies['_'+k];
  return {event_name:'Lead',event_time:Math.floor(now/1000),event_id:lead.requestId,action_source:'website',event_source_url:origin+'/koszonooldal',user_data:user,custom_data:{content_name:lead.formType==='stairs'?'Tölgyfa lépcső alapanyag':'Tölgyfa alapanyag',content_category:'alapanyag'}};
}
export async function sendMetaLead(event,env,fetchImpl=fetch){
  const r=await fetchImpl(`https://graph.facebook.com/v24.0/${encodeURIComponent(env.META_DATASET_ID)}/events`,{method:'POST',headers:{Authorization:'Bearer '+env.FB_CAPI_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({data:[event],...(env.META_TEST_EVENT_CODE&&{test_event_code:env.META_TEST_EVENT_CODE})}),signal:AbortSignal.timeout(6000)});
  let result={};try{result=await r.json();}catch{}
  if(!r.ok||result.events_received!==1)throw new Error('Meta '+r.status+' '+String(result?.error?.message||'').slice(0,120));
}
export function parseCookies(header=''){return Object.fromEntries(String(header).split(';').map(p=>p.trim().split(/=(.*)/s).slice(0,2)).filter(p=>p.length===2));}
