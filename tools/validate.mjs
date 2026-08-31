import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const htmlIds=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
const jsIds=new Set([...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]));
const missing=[...jsIds].filter(x=>!htmlIds.has(x));
if(missing.length){console.error('Missing HTML IDs:',missing.join(', '));process.exit(1)}
const jsFiles=['app.js','native-bridge.js','sw.js',...fs.readdirSync(path.join(root,'functions/api')).filter(x=>x.endsWith('.js')).map(x=>`functions/api/${x}`)];
for(const rel of jsFiles){const r=spawnSync(process.execPath,['--check',path.join(root,rel)],{encoding:'utf8'});if(r.status!==0){console.error(rel,r.stderr);process.exit(r.status||1)}}
for(const asset of ['assets/daim.png','assets/sunsik.png','assets/hunmin.png'])if(!fs.existsSync(path.join(root,asset))){console.error('Missing asset',asset);process.exit(1)}
JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
console.log(`OK: ${htmlIds.size} HTML ids / ${jsIds.size} referenced ids / ${jsFiles.length} JS files / 3 character assets`);
