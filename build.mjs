import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const archive=JSON.parse(fs.readFileSync(path.join(root,'data/archive.json'),'utf8'));
fs.writeFileSync(path.join(root,'data/archive.js'),`window.ASTRO_ARCHIVE = ${JSON.stringify(archive).replaceAll('<','\\u003c')};\n`);
const output=path.join(root,'dist');fs.mkdirSync(output,{recursive:true});
for(const name of ['index.html','styles.css','app.js','favicon.svg'])fs.copyFileSync(path.join(root,name),path.join(output,name));
fs.mkdirSync(path.join(output,'data'),{recursive:true});
for(const name of ['archive.js','archive.json'])fs.copyFileSync(path.join(root,'data',name),path.join(output,'data',name));
fs.cpSync(path.join(root,'fonts'),path.join(output,'fonts'),{recursive:true});
fs.writeFileSync(path.join(output,'.nojekyll'),'');
const inlineStyles=fs.readFileSync(path.join(root,'styles.css'),'utf8').replace(/url\((['"]?)(\.\/fonts\/[^)'"\s]+)\1\)/g,(_match,_quote,fontPath)=>`url("data:font/woff2;base64,${fs.readFileSync(path.join(root,fontPath)).toString('base64')}")`);
const inline=fs.readFileSync(path.join(root,'index.html'),'utf8')
 .replace(/<link[^>]*href="\.\/styles\.css"[^>]*>/,`<style>${inlineStyles}</style>`)
 .replace(/<script[^>]*src="\.\/data\/archive\.js"[^>]*><\/script>/,()=>`<script>${fs.readFileSync(path.join(root,'data/archive.js'),'utf8')}</script>`)
 .replace(/<script[^>]*src="\.\/app\.js"[^>]*><\/script>/,()=>`<script>document.addEventListener('DOMContentLoaded',function(){${fs.readFileSync(path.join(root,'app.js'),'utf8')}\n});</script>`)
 .replace(/href="\.\/favicon\.svg"/,()=>`href="data:image/svg+xml;base64,${fs.readFileSync(path.join(root,'favicon.svg')).toString('base64')}"`);
fs.writeFileSync(path.join(root,'astro-calendar.html'),inline);
console.log(`Built ${archive.events.length} fragments from ${archive.sources.length} sources.`);
