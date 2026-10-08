import {readFile,mkdir,writeFile} from 'node:fs/promises';
const items=[...JSON.parse(await readFile(new URL('../design/assets.json',import.meta.url),'utf8')),...JSON.parse(await readFile(new URL('../design/stats-assets.json',import.meta.url),'utf8'))];
const dir=new URL('../apps/web/public/assets/',import.meta.url);await mkdir(dir,{recursive:true});
await Promise.all(items.map(async item=>{const r=await fetch(item.url);if(!r.ok)throw new Error(`${r.status} ${item.name}`);const data=await r.arrayBuffer();if(!data.byteLength)throw new Error('Empty asset');await writeFile(new URL(item.name,dir),new Uint8Array(data));}));
console.log(`Downloaded ${items.length} Figma assets`);
