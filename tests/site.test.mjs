import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
async function htmlFiles(dir='dist'){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await htmlFiles(p));else if(e.name.endsWith('.html'))out.push(path.relative('dist',p));}return out;}
const pages=await htmlFiles();
for(const file of pages)test('local assets and fragment links exist: '+file,async()=>{
 const $=cheerio.load(await readFile('dist/'+file,'utf8'));
 for(const el of $('[src],link[rel=stylesheet]').toArray()){const ref=$(el).attr('src')||$(el).attr('href');if(ref?.startsWith('/')&&!ref.startsWith('//'))assert.ok((await stat(path.join('dist',ref.split('?')[0]))).isFile(),ref);}
 for(const el of $('a[href^="#"]').toArray()){const hash=$(el).attr('href').slice(1);if(hash)assert.ok($('[id]').toArray().some(e=>$(e).attr('id')===hash),'Missing fragment '+hash);}
 assert.equal($('script[src*="googletagmanager"]').length,0);
 assert.equal($('script[src*="wpforms"]').length,0);
 assert.equal($('iframe[src*="maps.google"]').length,0);
});
test('original home retains all main source sections',async()=>{const $=cheerio.load(await readFile('dist/index.html','utf8'));for(const id of ['GYIK','Kontakt','Megoldasaink','Meretek','Rolunk'])assert.equal($('#'+id).length,1,id);for(const word of ['Prémium tölgyfa-alapanyag','Közvetlenül a gyártótól','Kr isztian'.replace(' ',''),'taborfalva@szomex.hu'])assert.ok($('body').text().includes(word),word);});
test('every original asset has a local copy',async()=>{for(const entry of JSON.parse(await readFile('audit/assets.json','utf8')))assert.ok((await stat(path.join('public',entry.path))).size>0,entry.path);});
test('landing has descriptive alt text and material-only acknowledgement',async()=>{const $=cheerio.load(await readFile('dist/lepcso.html','utf8'));assert.equal($('h1').length,1);assert.equal($('[name=materialOnly]').length,1);assert.equal($('form[data-kind=stairs]').length,1);for(const img of $('img').toArray())assert.ok($(img).attr('alt'));assert.match($('body').text(),/beszerelést nem vállalunk/);assert.match($('body').text(),/inspirációs képek/);});
test('preview cannot pollute analytics or search indexes',async()=>{const config=await readFile('dist/assets/config.js','utf8');assert.match(config,/"trackingEnabled":false/);assert.match(await readFile('dist/robots.txt','utf8'),/Disallow: \//);for(const file of pages)assert.match(await readFile('dist/'+file,'utf8'),/name="robots" content="noindex, nofollow"/);});
