import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const mode=process.argv[2];
if(!['staging','production'].includes(mode))throw Error('Use staging or production explicitly.');
const output=fileURLToPath(new URL('../../dist/',import.meta.url));
await readFile(path.join(output,'index.html'));
// Existing static paths are served directly; unknown paths retain a real 404.
const rules=['Options -Indexes','DirectoryIndex index.html','ErrorDocument 404 /404.html'];
if(mode==='staging')rules.push('<IfModule mod_headers.c>','  Header always set X-Robots-Tag "noindex, nofollow"','</IfModule>');
await writeFile(path.join(output,'.htaccess'),rules.join('\n')+'\n');
async function inspect(folder){
  for(const item of await readdir(folder,{withFileTypes:true})){
    const full=path.join(folder,item.name);
    if(item.isDirectory())await inspect(full);
    else {
      if(/^(?:\.env(?:\..*)?|hosting\.json|package(?:-lock)?\.json)$/i.test(item.name))throw Error(`Source configuration found in public output: ${full}`);
      const size=(await stat(full)).size;
      if(size===0)throw Error(`Empty public file: ${full}`);
    }
  }
}
await inspect(output);
console.log(`WHC ${mode} files ready in dist/. ${mode==='staging'?'Verify the noindex header on the actual server.':'Indexing is enabled; configure HTTPS on the server.'}`);
