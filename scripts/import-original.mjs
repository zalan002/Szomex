import {mkdir, writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as cheerio from 'cheerio';

const origin = 'https://tolgyalapanyag.hu';
const root = path.resolve('public');
await mkdir('audit/raw', {recursive:true});
const manifest = [];
const pending = new Map();
async function get(url) {
  const res = await fetch(url, {signal:AbortSignal.timeout(45000), headers:{'User-Agent':'Mozilla/5.0 SzomexMigration/1.0'}});
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res;
}
function destination(url) {
  const u = new URL(url);
  return u.origin === origin ? decodeURIComponent(u.pathname) : `/assets/vendor/${createHash('sha256').update(url).digest('hex').slice(0,16)}${u.hostname==='fonts.googleapis.com'?'.css':path.extname(u.pathname)}`;
}
async function asset(raw, base=origin) {
  if (!raw || /^(data:|#|javascript:)/.test(raw)) return raw;
  const url=new URL(raw,base).href;
  if (!/tolgyalapanyag.hu|fonts.googleapis.com|fonts.gstatic.com/.test(new URL(url).hostname)) return raw;
  const local=destination(url);
  if(pending.has(url)) return local;
  const job=(async()=>{
    const res=await get(url);
    let data=Buffer.from(await res.arrayBuffer());
    if (/\.css(?:\?|$)/.test(url)||new URL(url).hostname==='fonts.googleapis.com') {
      let css=data.toString();
      const matches=[...css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)];
      for(const m of matches) css=css.replace(m[0],`url("${await asset(m[1],url)}")`);
      data=Buffer.from(css);
    }
    const file=path.resolve(root,'.'+local);
    if(!file.startsWith(root+path.sep))throw new Error('Invalid asset path');
    await mkdir(path.dirname(file),{recursive:true});await writeFile(file,data);
    manifest.push({source:url,path:local,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  })();
  pending.set(url,job);
  await job;
  return local;
}
async function importPage(route, output) {
const raw=route==='/'?await readFile('../audit/home.html','utf8'):await (await get(origin+route)).text();
await writeFile('audit/raw/'+(route==='/'?'home':route.replaceAll('/',''))+'.html',raw);
const $=cheerio.load(raw);
const form=await readFile('src/partials/form.html','utf8');
$('form[id^="wpforms-form"]').replaceWith(form.replaceAll('{{FORM_KIND}}','general'));
$('form[role="search"],form.et-search-form,form#searchform').attr('action','/kereses').attr('method','get');
if($('#commentform').length){$('#commentform').replaceWith('<p>A hozzászólás elküldés után moderálásra kerül. Nem jelent ajánlatkérést.</p>'+form.replaceAll('{{FORM_KIND}}','comment').replace('Ajánlatot kérek','Hozzászólás elküldése').replace('Miben segíthetünk?','Hozzászólás').replace('Az ajánlatkérés nem jár vásárlási kötelezettséggel.','A hozzászólásod ellenőrzés után jelenhet meg.'));$('.comment-reply-link,#cancel-comment-reply-link').remove();}
$('link[href*="wpforms-lite"]').remove();
$('script').each((_,el)=>{
  const node=$(el), code=node.html()||'', src=node.attr('src')||'';
  if(/googletagmanager|gtag\(|wpforms|emoji|speculationrules/.test(src+code)||node.attr('type')==='speculationrules')node.remove();
});
$('noscript').filter((_,el)=>$(el).html()?.includes('googletagmanager')).remove();
$('link[rel="pingback"],link[rel="dns-prefetch"],link[rel="alternate"],link[rel="EditURI"]').remove();
const elems=$('[src],[href],[srcset],[style]').toArray();
for(const el of elems){
  const node=$(el);
  for(const attr of ['src','href']) {
    const v=node.attr(attr);
    if(!v)continue;
    if(v.includes('/wp-content/')||v.includes('/wp-includes/')||v.includes('fonts.googleapis.com'))node.attr(attr,await asset(v));
    else if(el.tagName==='a'&&v.startsWith(origin)){node.attr(attr,v.slice(origin.length)||'/');}
  }
  const srcset=node.attr('srcset');
  if(srcset){const parts=[];for(const part of srcset.split(',')){const [url,size]=part.trim().split(/\s+/);parts.push(`${await asset(url)} ${size||''}`);}node.attr('srcset',parts.join(', '));}
  const style=node.attr('style');
  if(style){let s=style;for(const m of style.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))s=s.replace(m[0],`url('${await asset(m[1])}')`);node.attr('style',s);}
}
for(const el of $('style').toArray()){let css=$(el).html();for(const m of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))css=css.replace(m[0],`url('${await asset(m[1])}')`);$(el).html(css);}
// Preserve the Divi layout/runtime, but detach unused WordPress server endpoints.
$('script:not([src])').each((_,el)=>{const n=$(el);n.html((n.html()||'').replaceAll(origin+'/wp-admin/admin-ajax.php','/api/legacy-unavailable').replaceAll(origin+'/wp-content/','/wp-content/'));});
$('#top-menu').append('<li><a href="/lepcso">Tölgyfa lépcső</a></li>');
$('#et-info-phone').wrap('<a href="tel:+36309480560" data-track="phone_click"></a>');
$('a[href^="mailto:"]').attr('data-track','email_click');
$('iframe').each((_,el)=>{const n=$(el);if(n.attr('src')?.includes('maps.google')){const src=n.attr('src');n.attr('data-consent-src',src).removeAttr('src').attr('title','SZOMEX Kft. telephelye Táborfalván').attr('loading','lazy');n.before('<div class="map-consent"><p>A térkép betöltésével a Google Maps szolgáltatáshoz kapcsolódsz.</p><button type="button" data-load-map>Térkép betöltése</button> <a href="https://www.google.com/maps/search/?api=1&query=2381+Táborfalva+Tarcsay+út+41" target="_blank" rel="noopener">Útvonaltervezés</a></div>');}});
$('head').append('<meta name="description" content="Prémium tölgyfa alapanyag közvetlenül a gyártótól. Széles méretválaszték, egyedi méretek, több mint 30 év tapasztalat. SZOMEX Kft., Táborfalva."><link rel="stylesheet" href="/assets/site.css"><script src="/assets/config.js" defer></script><script src="/assets/site.js" defer></script>');
$('body').append('<footer class="legal-footer"><a href="/lepcso">Tölgyfa lépcső alapanyag</a><a href="/adatkezeles">Adatkezelési tájékoztató</a><button type="button" data-cookie-settings>Sütibeállítások</button></footer>');
await mkdir('src',{recursive:true});await writeFile(output,$.html());
}
await importPage('/','src/index.html');
await importPage('/koszonooldal/','src/koszonooldal.html');
await importPage('/sample-page/','src/sample-page.html');
await importPage('/2025/05/30/hello-world/','src/hello-world.html');
await importPage('/category/uncategorized/','src/uncategorized.html');
await Promise.all(pending.values());
await writeFile('audit/assets.json',JSON.stringify(manifest,null,2));
const inventory={capturedAt:new Date().toISOString(),source:origin,pages:[],measurements:{ga4:'G-5W1XXG6H15',ads:'AW-16959665415',gtm:'GTM-T2Z9LF8Z',meta:null},forms:[{id:'101',fields:['name','email','phone','message'],recipient:'taborfalva@szomex.hu'}]};
for(const route of ['/wp-json/wp/v2/pages?per_page=100','/robots.txt','/wp-sitemap.xml']){
 try{const r=await get(origin+route),body=await r.text();await writeFile('audit/raw/'+route.replace(/[^a-z0-9]/gi,'_')+'.txt',body);if(route.includes('/pages'))inventory.pages=JSON.parse(body).map(p=>({id:p.id,slug:p.slug,url:p.link,title:p.title.rendered}));}catch(e){inventory[route]=e.message;}
}
await writeFile('audit/source-inventory.json',JSON.stringify(inventory,null,2));
console.log(JSON.stringify({assets:manifest.length,bytes:manifest.reduce((s,x)=>s+x.bytes,0),inventory},null,2));
