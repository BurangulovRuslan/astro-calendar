import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,'dist');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
await build({entryPoints:[path.join(root,'src/main.jsx')],bundle:true,minify:true,jsx:'automatic',outfile:path.join(output,'app.js'),platform:'browser',target:['es2020'],define:{'process.env.NODE_ENV':'"production"'},legalComments:'inline'});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'astro-react-build-'));
try{
 await build({stdin:{contents:"import React from 'react';import {renderToString} from 'react-dom/server';import App from './src/App.jsx';export const html=renderToString(<App/>);",resolveDir:root,loader:'jsx'},bundle:true,jsx:'automatic',outfile:path.join(temporary,'render.cjs'),platform:'node',format:'cjs',define:{'process.env.NODE_ENV':'"production"'}});
 const {html}=createRequire(import.meta.url)(path.join(temporary,'render.cjs'));
 const shell=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<!--APP-->',html);
 fs.writeFileSync(path.join(output,'index.html'),shell);
 for(const name of ['styles.css','favicon.svg'])fs.copyFileSync(path.join(root,name),path.join(output,name));
 fs.cpSync(path.join(root,'fonts'),path.join(output,'fonts'),{recursive:true});
 fs.writeFileSync(path.join(output,'.nojekyll'),'');
 const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8').replace(/url\((['"]?)(\.\/fonts\/[^)'"\s]+)\1\)/g,(_m,_q,p)=>`url("data:font/woff2;base64,${fs.readFileSync(path.join(root,p)).toString('base64')}")`);
 const script=fs.readFileSync(path.join(output,'app.js'),'utf8').replace(/<\/script/gi,'<\\/script');
 const standalone=shell.replace('<link rel="stylesheet" href="./styles.css">',()=>`<style>${styles}</style>`).replace('<script src="./app.js" defer></script>',()=>`<script defer>${script}</script>`).replace('href="./favicon.svg"',()=>`href="data:image/svg+xml;base64,${fs.readFileSync(path.join(root,'favicon.svg')).toString('base64')}"`);
 // Inline script is placed after the prerendered DOM so its root is available.
 fs.writeFileSync(path.join(root,'astro-calendar.html'),standalone.replace(/<script defer>[\s\S]*?<\/script>/,'').replace('</body>',()=>`<script>${script}</script>\n</body>`));
 console.log(`React build: ${JSON.parse(fs.readFileSync(path.join(root,'data/archive.json'),'utf8')).events.length} forecasts; static assets bundled locally.`);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
