// Photo-based orientation examples for listing 100021. No surveyed dimensions,
// room numbers, floor assignments or connected interior floor plan are implied.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const THREE=require('three');
const {GLTFExporter}=await import(pathToFileURL(require.resolve('three/addons/exporters/GLTFExporter.js')).href);
globalThis.FileReader=class {readAsArrayBuffer(blob){void blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
const output=fileURLToPath(new URL('../frontend/public/models/examples/100021/',import.meta.url));
const colors={white:0xf2f0e8,siding:0xa9b3b3,roof:0x505958,glass:0x748b95,asphalt:0x757c7c,wood:0x986b47,rust:0xa04b30,cream:0xe3d6b9,linen:0xe7e1d1,dark:0x292c2d,burgundy:0x65333e,grass:0x708661,chrome:0xbfc9c7,yellow:0xf0d13f,tile:0xb7b0a0,bathwall:0xc9c1b3,seat:0xa1ada8,water:0xc8d7d6};
const materials=Object.fromEntries(Object.entries(colors).map(([name,color])=>[name,new THREE.MeshStandardMaterial({name,color,roughness:.87,metalness:name==='chrome'?.65:0})]));
function scene(name){const group=new THREE.Group();group.name=name;group.userData={representation:'photo-based schematic',listingReference:'100021',sourcePhotos:'Existing published /centris/24397299 images',limitations:'Not measured. No room locations, floor assignments or connections are verified.'};return group;}
function add(group,name,geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const mesh=new THREE.Mesh(geometry,materials[material]);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);group.add(mesh);return mesh;}
const boxGeometry=new THREE.BoxGeometry(1,1,1),sphereGeometry=new THREE.SphereGeometry(1,20,12),cylinderGeometry=new THREE.CylinderGeometry(1,1,1,16),coneGeometry=new THREE.ConeGeometry(1,1,16);
const box=(g,n,x,y,z,sx,sy,sz,m,rx=0,ry=0,rz=0)=>add(g,n,boxGeometry,m,x,y,z,sx,sy,sz,rx,ry,rz);
const sphere=(g,n,x,y,z,sx,sy,sz,m)=>add(g,n,sphereGeometry,m,x,y,z,sx,sy,sz);
function woodFloor(g,width,depth){box(g,'wood floor',0,-.12,0,width,.24,depth,'wood');for(let i=0;i<width/.28;i++)box(g,'plank seam',-width/2+i*.28,.006,0,.012,.008,depth,'cream');}
const exterior=scene('Motel exterior orientation — schematic');
box(exterior,'parking surface',0,-.14,3,44,.28,28,'asphalt');box(exterior,'grass strip',20,.02,1.5,4,.08,25,'grass');
box(exterior,'lower storey',-2,1.4,-2.5,28,2.8,9,'white');box(exterior,'upper storey',-2,4.25,-2.5,28,2.9,9,'siding');
for(let i=0;i<110;i++)box(exterior,'vertical siding seam',-15.8+i*.25,4.25,2.015,.016,2.8,.02,'white');
box(exterior,'front roof slope',-2,5.98,-.12,28.9,.17,5.05,'roof',.13);box(exterior,'rear roof slope',-2,5.98,-4.88,28.9,.17,5.05,'roof',-.13);
box(exterior,'upper floor band',-2,2.82,2.07,28.2,.12,.17,'roof');
for(const x of [-13,-2,3.6,9.5]){box(exterior,'upper window frame',x,4.3,2.05,1.1,1.15,.12,'white');box(exterior,'upper window glass',x,4.3,2.13,.88,.94,.035,'glass');}
for(const x of [-12,-5.2,1.6,8.4]){box(exterior,'ground room door',x,1.18,2.06,.88,2.36,.12,'dark');box(exterior,'ground room window frame',x+1.5,1.45,2.06,1.22,1.1,.13,'siding');box(exterior,'ground room window',x+1.5,1.45,2.15,1.04,.9,.04,'glass');}
// Simple geometric lettering keeps the sign self-contained and texture-free.
const glyphs={M:['10001','11011','10101','10101','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],T:['11111','00100','00100','00100','00100','00100','00100'],E:['11111','10000','10000','11110','10000','10000','11111'],L:['10000','10000','10000','10000','10000','10000','11111']};
function motelSign(g,x,y,z,size){for(const [i,letter] of [...'MOTEL'].entries())for(const [r,row] of glyphs[letter].entries())for(const [c,pixel] of [...row].entries())if(pixel==='1')box(g,'MOTEL sign',x+(i*6+c)*size,y-r*size,z,size*.9,size*.9,.07,'yellow');}
motelSign(exterior,-11.6,4.96,2.22,.17);
box(exterior,'entrance wing',14.25,1.5,-.2,5,3,6,'white');box(exterior,'entrance roof front',14.25,3.26,1.35,5.5,.16,3.55,'roof',.18);box(exterior,'entrance roof rear',14.25,3.26,-1.75,5.5,.16,3.55,'roof',-.18);
for(const x of [12.8,14.2,15.6]){box(exterior,'entrance glazing',x,1.5,2.86,1.15,2.4,.05,'glass');box(exterior,'entrance post',x-.65,1.5,2.95,.1,3,.1,'white');}
box(exterior,'left landing',-17,2.88,-1.4,2,.2,4.3,'roof');
for(let i=0;i<12;i++)box(exterior,'external stair step',-17,(i+.5)*.23,2.6-i*.32,1.45,.23,.36,'roof');
for(const z of [-3.35,-1.35,.65])box(exterior,'landing railing',-17,3.4,z,1.9,.9,.08,'dark');
for(let i=0;i<13;i++)box(exterior,'parking bay marking',-15+i*2.45,.012,6.4,.07,.025,5,'white');
box(exterior,'access path',14.1,.02,4.1,5.3,.05,1.35,'tile');
box(exterior,'roadside sign post',19,2.2,9,.16,4.4,.16,'dark');box(exterior,'roadside sign board',19,4.5,9,3.8,1.55,.16,'dark');motelSign(exterior,17.28,5.03,9.13,.108);
for(const z of [-7,-2,3,7]){box(exterior,'tree trunk',20.2,.7,z,.25,1.4,.25,'wood');add(exterior,'evergreen',coneGeometry,'grass',20.2,2.45,z,1.2,3.8,1.2);}

const room=scene('Double guest room — independent schematic example');
woodFloor(room,7.2,6);
box(room,'orange accent wall',0,1.4,-3.03,7.2,2.8,.15,'rust');box(room,'left cream wall',-3.6,1.4,0,.15,2.8,6,'cream');box(room,'right cutaway wall',3.6,.33,0,.15,.66,6,'cream');
box(room,'window frame',-3.5,1.6,-.1,.1,1.8,1.65,'white');box(room,'window glass',-3.42,1.6,-.1,.06,1.56,1.4,'glass');
for(const z of [-1.04,.84])box(room,'burgundy curtain',-3.31,1.65,z,.15,2.25,.38,'burgundy');
for(const x of [-1.65,1.05]){box(room,'bed base',x,.3,-1.05,2.15,.5,2.9,'wood');box(room,'mattress',x,.63,-1.05,2.15,.23,2.9,'linen');box(room,'quilt',x,.79,-.6,2.18,.12,2,'cream');box(room,'pillow',x,.86,-2.05,1.45,.18,.54,'white');box(room,'headboard',x,1.02,-2.65,2.26,.88,.13,'wood');}
box(room,'nightstand',-.3,.5,-2.28,.6,1,.7,'wood');box(room,'lamp stem',-.3,1.15,-2.28,.06,.35,.06,'chrome');add(room,'lamp shade',cylinderGeometry,'cream',-.3,1.43,-2.28,.2,.28,.2);
box(room,'desk',3,.65,1.3,.7,.12,1.65,'wood');box(room,'desk support',3,.3,1.3,.55,.6,.95,'wood');box(room,'television',3,1.65,1.3,.1,.84,1.3,'dark');
box(room,'equipment cabinet',3,.55,-1.8,.75,1.1,.8,'cream');box(room,'microwave',3,1.28,-1.8,.7,.36,.65,'dark');
box(room,'armchair seat',-2.5,.48,1.85,.88,.24,.86,'dark');box(room,'armchair back',-2.5,.86,2.23,.9,.88,.16,'dark');for(const x of [-3.02,-1.98])box(room,'armchair arm',x,.69,1.85,.16,.45,.95,'dark');

const bath=scene('Bathroom — independent schematic example');
box(bath,'tile floor',0,-.12,0,4.4,.24,4.4,'tile');box(bath,'back tiled wall',0,1.4,-2.2,4.4,2.8,.12,'bathwall');box(bath,'left tiled wall',-2.2,1.4,0,.12,2.8,4.4,'bathwall');
for(let x=-2;x<2.2;x+=.45)box(bath,'tile grout',x,.008,0,.014,.014,4.3,'white');for(let z=-2;z<2.2;z+=.45)box(bath,'tile grout',0,.008,z,4.3,.014,.014,'white');
box(bath,'bathtub base',.9,.34,-1.35,2.25,.68,1.45,'white');box(bath,'tub interior',.9,.69,-1.35,1.87,.025,1.08,'water');
for(const z of [-2,-.7])box(bath,'tub rim',.9,.74,z,2.28,.17,.18,'white');for(const x of [-.17,1.97])box(bath,'tub rim',x,.74,-1.35,.16,.17,1.45,'white');
box(bath,'shower rod',.9,2.49,-.65,2.35,.05,.05,'chrome');box(bath,'partly open curtain',1.62,1.69,-.65,.62,1.6,.05,'linen');for(let x=1.35;x<1.95;x+=.16)box(bath,'curtain pattern',x,2.12,-.61,.09,.25,.025,'dark');
box(bath,'toilet tank',-.83,.85,-1.64,.66,.72,.3,'white');sphere(bath,'toilet bowl',-.83,.54,-1.16,.37,.2,.49,'white');box(bath,'toilet pedestal',-.83,.24,-1.35,.4,.48,.6,'white');
add(bath,'toilet seat',new THREE.TorusGeometry(.28,.045,10,28),'seat',-.83,.73,-1.15,1,1,1.32,Math.PI/2);
box(bath,'sink cabinet',-1.55,.5,.75,.86,1,1.25,'white');box(bath,'sink counter',-1.55,1.05,.75,.96,.12,1.35,'linen');sphere(bath,'sink basin',-1.55,1.12,.75,.32,.06,.43,'water');box(bath,'tap',-1.88,1.25,.75,.05,.25,.05,'chrome');
box(bath,'mirror frame',-2.1,1.82,.7,.07,1.18,1.22,'chrome');box(bath,'mirror',-2.05,1.82,.7,.025,1.05,1.1,'glass');
box(bath,'towel rail',-.7,1.95,-2.08,.9,.05,.06,'chrome');box(bath,'folded towels',-.7,1.86,-2.02,.68,.2,.18,'linen');

await fs.mkdir(output,{recursive:true});
for(const [name,group] of [['exterior-v1',exterior],['double-room-v1',room],['bathroom-v1',bath]]){
 const glb=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
 await fs.writeFile(output+name+'.glb',Buffer.from(glb));
 console.log(`${name}: ${glb.byteLength} bytes`);
}
