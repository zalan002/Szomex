// Airtable output next to the e-mail, following the FIT site: every accepted enquiry is upserted by its request id,
// so a retried submission never creates a second row or a second e-mail.
export const LEAD_FIELDS={
  key:'Azonosító',name:'Név',email:'E-mail',phone:'Telefon',city:'Település',steps:'Lépcsőfokok',timeline:'Tervezett időpont',message:'Üzenet',
  type:'Típus',materialOnly:'Alapanyag, beszerelés nélkül',page:'Oldal',received:'Beérkezett',click:'Hirdetési kattintás',emailState:'E-mail állapot',status:'Státusz',
  utm_source:'UTM forrás',utm_medium:'UTM médium',utm_campaign:'UTM kampány',utm_content:'UTM tartalom',utm_term:'UTM kulcsszó',
};
export const TYPE_LABELS={stairs:'Lépcső alapanyag',general:'Általános ajánlatkérés',comment:'Hozzászólás'};
export const CLICK_LABELS={google_ads:'Google Ads',meta_ads:'Facebook / Instagram'};
export function airtableConfigured(env={}){return Boolean(env.AIRTABLE_TOKEN&&env.AIRTABLE_BASE_ID&&env.AIRTABLE_TABLE_ID);}
export function leadFields(lead,receivedAt=new Date().toISOString()){
  const F=LEAD_FIELDS,fields={[F.key]:lead.requestId,[F.name]:lead.name,[F.email]:lead.email,[F.phone]:lead.phone,[F.city]:lead.city,[F.timeline]:lead.timeline||null,[F.message]:lead.message,[F.type]:TYPE_LABELS[lead.formType],[F.materialOnly]:lead.materialOnly,[F.page]:lead.pagePath,[F.received]:receivedAt,[F.status]:'Új'};
  if(lead.steps)fields[F.steps]=Number(lead.steps);
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(lead.attribution[k])fields[F[k]]=lead.attribution[k];
  if(lead.attribution.click_source)fields[F.click]=CLICK_LABELS[lead.attribution.click_source];
  return fields;
}
export function airtableClient(env,fetchImpl=fetch){
  const base=`https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_TABLE_ID)}`;
  async function request(method,suffix='',body){
    const r=await fetchImpl(base+suffix,{method,headers:{Authorization:'Bearer '+env.AIRTABLE_TOKEN,'Content-Type':'application/json'},...(body&&{body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)});
    let data={};try{data=await r.json();}catch{}
    if(!r.ok){const e=new Error('Airtable '+r.status+' '+String(data?.error?.type||data?.error||'').slice(0,80));e.status=r.status;throw e;}
    return data;
  }
  return {
    // performUpsert merges on the request id: created is false when the same enquiry arrives again.
    async save(lead){const r=await request('PATCH','',{performUpsert:{fieldsToMergeOn:[LEAD_FIELDS.key]},typecast:true,records:[{fields:leadFields(lead)}]});const record=r.records?.[0];if(!record?.id)throw new Error('Airtable receipt missing');return {id:record.id,created:(r.createdRecords||[]).includes(record.id),emailState:record.fields?.[LEAD_FIELDS.emailState]||''};},
    async update(id,fields){return request('PATCH','/'+encodeURIComponent(id),{fields,typecast:true});},
    recordUrl(id){return `https://airtable.com/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}/${id}`;},
  };
}
