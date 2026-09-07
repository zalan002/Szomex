import {mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
const isProduction=process.env.VERCEL_ENV==='production';
await mkdir('dist/assets',{recursive:true});await cp('public','dist',{recursive:true});
const id=(key,fallback,pattern)=>{const v=process.env[key]??fallback;if(v&&!pattern.test(v))throw new Error('Invalid '+key);return v;};
const config={gaId:id('PUBLIC_GA_ID','G-5W1XXG6H15',/^G-[A-Z0-9]+$/),adsId:id('PUBLIC_GOOGLE_ADS_ID','AW-16959665415',/^AW-\d+$/),gtmId:id('PUBLIC_GTM_ID','GTM-T2Z9LF8Z',/^GTM-[A-Z0-9]+$/),enableLegacyGtm:process.env.PUBLIC_ENABLE_LEGACY_GTM==='true',metaPixelId:id('PUBLIC_META_PIXEL_ID','',/^\d+$/),clarityId:id('PUBLIC_CLARITY_ID','rf8y3ss130',/^[a-z0-9]+$/),adsLeadLabel:id('PUBLIC_GOOGLE_ADS_LEAD_LABEL','wGcRCIuopNIaEIfq_5Y_',/^[A-Za-z0-9_-]+$/),turnstileSiteKey:id('TURNSTILE_SITE_KEY','',/^[A-Za-z0-9_-]+$/),trackingEnabled:isProduction&&process.env.PUBLIC_ENABLE_TRACKING==='true'};
await writeFile('dist/assets/config.js','window.SZOMEX_CONFIG = '+JSON.stringify(config)+';\n');
const form=await readFile('src/partials/form.html','utf8');
for(const name of (await readdir('src')).filter(n=>n.endsWith('.html'))){
  let html=(await readFile(path.join('src',name),'utf8')).replaceAll('{{FORM}}',form.replaceAll('{{FORM_KIND}}','stairs')).replaceAll('{{YEAR}}',String(new Date().getFullYear()));
  const $=cheerio.load(html);
  $('form[data-lead-form]').attr('data-clarity-mask','true');
  if(name!=='index.html')$('a[href^="#"]').each((_,el)=>{const href=$(el).attr('href');if(['#GYIK','#Kontakt','#Megoldasaink','#Meretek','#Rolunk'].includes(href))$(el).attr('href','/'+href);});
  if(!isProduction||['koszonooldal.html','sample-page.html','404.html'].includes(name))$('head').append('<meta name="robots" content="noindex, nofollow">');
  if(name==='koszonooldal.html')$('title').text('Köszönjük az ajánlatkérést | SZOMEX');
  for(const el of $('[src],link[rel=stylesheet]').toArray()){const url=$(el).attr('src')||$(el).attr('href');if(url?.startsWith('/')&&!url.startsWith('//')){try{await readFile(path.join('dist',url.split('?')[0]));}catch{throw new Error('Missing asset '+url+' in '+name);}}}
  const output={'hello-world.html':'2025/05/30/hello-world.html','uncategorized.html':'category/uncategorized.html'}[name]||name;
  await mkdir(path.dirname(path.join('dist',output)),{recursive:true});
  await writeFile(path.join('dist',output),$.html());
}
await writeFile('dist/robots.txt',isProduction?'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /koszonooldal\nDisallow: /sample-page\nSitemap: https://tolgyalapanyag.hu/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/lepcso','/adatkezeles'].map(p=>'<url><loc>https://tolgyalapanyag.hu'+p+'</loc></url>').join('')+'</urlset>');
console.log(`Build complete. ${isProduction?'Production':'Preview (noindex)'}. Tracking: ${config.trackingEnabled?'enabled':'disabled'}.`);

