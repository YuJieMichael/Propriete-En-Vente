// Original, deliberately fictional low-detail geometry for the public 3D viewer demo.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../frontend/public/models/demo/',import.meta.url));
const vertices=new Float32Array([
 -.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5,
 .5,-.5,-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,
 -.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,
 .5,-.5,.5,.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,
 -.5,.5,.5,.5,.5,.5,.5,.5,-.5,-.5,.5,-.5,
 -.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5,
]);
const normals=new Float32Array([...[0,0,1],...[0,0,1],...[0,0,1],...[0,0,1],...[0,0,-1],...[0,0,-1],...[0,0,-1],...[0,0,-1],...[-1,0,0],...[-1,0,0],...[-1,0,0],...[-1,0,0],...[1,0,0],...[1,0,0],...[1,0,0],...[1,0,0],...[0,1,0],...[0,1,0],...[0,1,0],...[0,1,0],...[0,-1,0],...[0,-1,0],...[0,-1,0],...[0,-1,0]]);
const indices=new Uint16Array(Array.from({length:6},(_,i)=>[i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3]).flat());
const materials=[['warm plaster',[.85,.80,.68,1]],['forest green',[.12,.27,.23,1]],['timber',[.40,.25,.14,1]],['glass',[.30,.49,.52,1]],['grass',[.39,.47,.30,1]],['stone',[.63,.65,.57,1]],['linen',[.93,.91,.83,1]],['ochre',[.69,.42,.18,1]],['soil',[.36,.32,.24,1]]].map(([name,color])=>({name,pbrMetallicRoughness:{baseColorFactor:color,metallicFactor:0,roughnessFactor:.85}}));
function scene(){const nodes=[];return {nodes,box(name,x,y,z,sx,sy,sz,material,angle=0){nodes.push({name,mesh:material,translation:[x,y,z],scale:[sx,sy,sz],...(angle?{rotation:[0,0,Math.sin(angle/2),Math.cos(angle/2)]}:{})});}};}
const exterior=scene(),e=exterior.box;
e('land',0,-.18,0,18,.3,12,4);e('terrace',0,.02,3.3,12,.16,2.2,5);
e('building',0,1.55,-.6,10,3.1,4.6,0);
e('roof left',-2.55,3.5,-.6,5.8,.22,5.2,1,.22);e('roof right',2.55,3.5,-.6,5.8,.22,5.2,1,-.22);
for(const x of [-3.6,-1.8,1.8,3.6]){e('window',x,1.7,1.72,1.25,1.25,.08,3);e('window sill',x,1.03,1.82,1.45,.1,.25,2);}
e('entry',0,1.2,1.74,.95,2.4,.1,2);e('entry glass',0,1.55,1.82,.64,1.1,.07,3);
e('walk',0,-.01,5.1,2.2,.12,2,5);
for(const [x,z]of [[-7,-3],[-7,2],[7,-2],[7,3]]){e('tree trunk',x,.7,z,.24,1.4,.24,2);e('tree canopy',x,1.9,z,1.7,2,1.7,4);}
e('bench',-3,.55,3.4,2.1,.17,.65,2);e('bench leg',-3.75,.28,3.4,.13,.5,.45,1);e('bench leg',-2.25,.28,3.4,.13,.5,.45,1);
const interior=scene(),b=interior.box;
b('floor',0,-.13,0,8,.25,6,2);b('back wall',0,1.5,-3,8,3,.18,0);b('left cutaway wall',-4,.6,0,.18,1.2,6,0);
b('window frame',1.4,1.85,-2.87,2.8,1.5,.08,2);b('window',1.4,1.85,-2.8,2.5,1.25,.07,3);
b('bed base',-1.65,.4,-.6,2.1,.65,2.9,1);b('mattress',-1.65,.82,-.6,2.1,.27,2.9,6);b('headboard',-1.65,1.05,-2.1,2.3,1.2,.16,2);
b('cover',-1.65,.98,-.05,2.15,.08,1.9,0);b('pillow',-2.12,1,-1.55,.8,.16,.6,6);b('pillow',-1.15,1,-1.55,.8,.16,.6,6);
b('bedside table',-3.15,.5,-1.7,.7,1,.7,2);b('lamp base',-3.15,1.12,-1.7,.12,.35,.12,1);b('lamp shade',-3.15,1.43,-1.7,.4,.4,.4,6);
b('rug',1.65,.02,1.1,3.2,.05,2.8,5);b('sofa base',2.8,.4,-.2,1.3,.7,2.4,7);b('sofa back',3.4,.85,-.2,.25,1.05,2.5,7);b('seat cushion',2.7,.8,-.2,1.1,.2,2.2,6);
b('coffee table',1.15,.55,.15,1.1,.14,1.7,2);b('table leg',1.15,.27,.15,.25,.5,.25,1);b('cabinet',.8,.75,-2.25,1.5,1.5,.75,0);
async function save(name,nodes){
 const chunks=[Buffer.from(vertices.buffer),Buffer.from(normals.buffer),Buffer.from(indices.buffer)];
 const binary=Buffer.concat(chunks),offsets=[0,chunks[0].length,chunks[0].length+chunks[1].length];
 const gltf={asset:{version:'2.0',generator:'Propriété En Vente original fictional viewer demo'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,materials,meshes:materials.map((_,material)=>({primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material}]})),buffers:[{byteLength:binary.length}],bufferViews:chunks.map((data,i)=>({buffer:0,byteOffset:offsets[i],byteLength:data.length,target:i===2?34963:34962})),accessors:[{bufferView:0,componentType:5126,count:24,type:'VEC3',min:[-.5,-.5,-.5],max:[.5,.5,.5]},{bufferView:1,componentType:5126,count:24,type:'VEC3'},{bufferView:2,componentType:5123,count:36,type:'SCALAR'}]};
 let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
 await fs.writeFile(path.join(output,name+'.glb'),Buffer.concat([header,jh,json,bh,bin]));
}
await fs.mkdir(output,{recursive:true});await save('exterior',exterior.nodes);await save('interior',interior.nodes);console.log('Generated two original fictional GLB demonstrations.');
