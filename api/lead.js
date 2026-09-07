import {processLead} from '../lib/lead.mjs';
export const config={maxDuration:30};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,message:'Csak POST kérés engedélyezett.'});}
  if(Number(req.headers['content-length']||0)>20000)return res.status(413).json({ok:false,message:'Túl hosszú üzenet.'});
  let body=req.body;
  if(typeof body==='string'){if(Buffer.byteLength(body)>20000)return res.status(413).json({ok:false,message:'Túl hosszú üzenet.'});try{body=JSON.parse(body);}catch{return res.status(400).json({ok:false,message:'Érvénytelen kérés.'});}}
  if(Buffer.byteLength(JSON.stringify(body||{}))>20000)return res.status(413).json({ok:false,message:'Túl hosszú üzenet.'});
  const result=await processLead({body,origin:req.headers.origin,host:req.headers.host,contentType:req.headers['content-type']});
  return res.status(result.status).json(result.data);
}
