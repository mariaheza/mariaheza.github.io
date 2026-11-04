import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const files=await fs.readdir(root,{recursive:true});
let pages=0,links=0;
const errors=[];
for(const file of files.filter(x=>x.endsWith('.html'))){
  pages++;
  const text=await fs.readFile(path.join(root,file),'utf8');
  for(const m of text.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){
    links++;
    const target=path.join(root,m[1].endsWith('/')?m[1]+'index.html':m[1]);
    try{await fs.access(target);}catch{errors.push(`${file}: missing ${m[1]}`);}
  }
  if(!text.includes('<title>')||!text.includes('name="description"'))errors.push(`${file}: missing page metadata`);
  if(/_draft-/.test(text))errors.push(`${file}: unpublished draft URL leaked`);
}
if(errors.length)throw new Error(errors.join('\n'));
console.log(`Checked ${pages} HTML pages and ${links} local links/assets. No broken paths or draft leakage.`);
