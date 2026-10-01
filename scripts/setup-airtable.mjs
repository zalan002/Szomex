// Creates (or completes) the enquiry table in the Szomex Airtable base. Idempotent, never deletes data.
// Run: AIRTABLE_TOKEN=... AIRTABLE_BASE_ID=app... node scripts/setup-airtable.mjs   (optional AIRTABLE_TABLE_ID to complete an existing table)
import {LEAD_FIELDS as F,TYPE_LABELS,CLICK_LABELS} from '../lib/airtable.mjs';
const env=process.env;
if(!env.AIRTABLE_TOKEN||!env.AIRTABLE_BASE_ID)throw new Error('AIRTABLE_TOKEN and AIRTABLE_BASE_ID are required');
const root=`https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`;
async function call(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+env.AIRTABLE_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(`Airtable ${r.status}: ${data.error?.type||data.error||'unknown'}`);return data;}
const text=name=>({name,type:'singleLineText'}),long=name=>({name,type:'multilineText'}),select=(name,choices)=>({name,type:'singleSelect',options:{choices:choices.map(name=>({name}))}});
const fields=[text(F.name),text(F.key),{name:F.email,type:'email'},{name:F.phone,type:'phoneNumber'},text(F.city),{name:F.steps,type:'number',options:{precision:0}},
  select(F.timeline,['Amint lehetséges','1–3 hónapon belül','3 hónapnál később','Még tervezek']),long(F.message),select(F.type,Object.values(TYPE_LABELS)),
  {name:F.materialOnly,type:'checkbox',options:{icon:'check',color:'greenBright'}},text(F.page),{name:F.received,type:'dateTime',options:{dateFormat:{name:'iso'},timeFormat:{name:'24hour'},timeZone:'Europe/Budapest'}},
  ...['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(k=>text(F[k])),select(F.click,Object.values(CLICK_LABELS)),
  select(F.emailState,['Elküldve','Újrapróbálandó']),select(F.status,['Új','Kapcsolatfelvétel folyamatban','Ajánlat elküldve','Megnyert','Lezárt']),long('Belső megjegyzés')];
let table=(await call(root)).tables.find(t=>env.AIRTABLE_TABLE_ID?t.id===env.AIRTABLE_TABLE_ID:t.name==='Érdeklődők');
if(!table){table=await call(root,'POST',{name:'Érdeklődők',description:'A tolgyalapanyag.hu ajánlatkérő űrlapjai',fields});console.log('Created table Érdeklődők');}
else for(const f of fields){if(table.fields.some(e=>e.name===f.name))continue;await call(`${root}/${table.id}/fields`,'POST',f);console.log('Created field:',f.name);await new Promise(r=>setTimeout(r,250));}
const verified=(await call(root)).tables.find(t=>t.id===table.id);
const missing=fields.filter(f=>!verified.fields.some(v=>v.name===f.name)).map(f=>f.name);
if(missing.length)throw new Error('Missing fields: '+missing.join(', '));
console.log('AIRTABLE_TABLE_ID='+table.id,'– schema verified,',fields.length,'fields.');
