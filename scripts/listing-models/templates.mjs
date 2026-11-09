// Reusable schematic templates for photo-based listing models.
// Each template builds a THREE.Group from a few observed parameters (colours,
// counts, presence of features) and returns named anchors for photo points.
// Nothing here is measured: sizes are generic and every scene is a schematic.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const THREE=require('three');

const BOX=new THREE.BoxGeometry(1,1,1),SPHERE=new THREE.SphereGeometry(1,20,12),CYL=new THREE.CylinderGeometry(1,1,1,20),CONE=new THREE.ConeGeometry(1,1,16);

function kit(group,palette){
  const mats={};
  const mat=name=>{
    if(!mats[name]){
      const color=palette[name]??name;
      mats[name]=new THREE.MeshStandardMaterial({name,color:new THREE.Color(color),roughness:name==='glass'||name==='chrome'?.25:.85,metalness:name==='chrome'?.6:0,transparent:name==='glass',opacity:name==='glass'?.55:1});
    }
    return mats[name];
  };
  const add=(geo,name,m,[x,y,z],[sx,sy,sz]=[1,1,1],[rx,ry,rz]=[0,0,0])=>{const mesh=new THREE.Mesh(geo,mat(m));mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);group.add(mesh);return mesh;};
  return {
    box:(name,m,pos,size,rot)=>add(BOX,name,m,pos,size,rot),
    sphere:(name,m,pos,size)=>add(SPHERE,name,m,pos,size),
    cyl:(name,m,pos,size,rot)=>add(CYL,name,m,pos,size,rot),
    cone:(name,m,pos,size)=>add(CONE,name,m,pos,size),
  };
}
function base(name,meta){const g=new THREE.Group();g.name=name;g.userData={representation:'photo-based schematic',...meta,limitations:'Not measured. Sizes, room locations and connections are not verified.'};return g;}
function stairs(k,name,m,x,zTop,dir,steps,rise=.19,run=.28,width=1.1,yTop=steps*rise){
  // Straight run that ends at (x, yTop, zTop) and descends away from it along dir.
  for(let i=0;i<steps;i++){
    const y=yTop-(i+.5)*rise,z=zTop+dir*(i+.5)*run;
    k.box(name,m,[x,y,z],[width,rise*.45,run]);
    for(const side of [-1,1]){
      k.box(name+' baluster',m,[x+side*width/2,y+.45,z],[.03,.9,.03]);
      k.box(name+' rail',m,[x+side*width/2,y+.92,z],[.05,.05,run+.02]);
    }
  }
}
function railing(k,m,[x,y,z],length,axis='x'){
  const along=axis==='x';
  k.box('railing top',m,[x,y+.95,z],along?[length,.05,.05]:[.05,.05,length]);
  for(let i=0;i<=length/.12;i++){const o=-length/2+i*.12;k.box('railing baluster',m,along?[x+o,y+.48,z]:[x,y+.48,z+o],[.025,.95,.025]);}
}

/** Two-storey plex over a semi-basement, flat roof, front porch stair, rear balconies. */
export function plexExterior(p={}){
  const P={stone:'#b9b9b4',stoneDark:'#9d9d98',cladding:'#7a4a33',siding:'#8e8f8c',trim:'#2b2d2f',glass:'#4c5d66',roof:'#3a3c3e',lawn:'#7a9561',asphalt:'#6f7375',shed:'#8b8577',shedDoor:'#22302a',tree:'#c98a2a',trunk:'#5b4330',...p.palette};
  const g=base('Plex exterior — schematic',p.meta),k=kit(g,P);
  const W=p.width??13,D=p.depth??11,floors=p.floors??3,fh=2.75,below=.9;
  const H=floors*fh-below,top=H;
  k.box('lawn','lawn',[0,-.06,2],[W+14,.12,D+18]);
  k.box('driveway','asphalt',[W/2+2.2,-.02,D/2+3.5],[3.4,.06,8]);
  // main volume: stone base and upper storeys
  k.box('stone walls','stone',[0,H/2,0],[W,H,D]);
  for(let r=0;r<H/.35;r++)k.box('stone course','stoneDark',[0,r*.35+.1,D/2+.005],[W,.025,.01]);
  // cladding panel on the upper left of the facade
  if(p.claddingPanel!==false)k.box('wood cladding panel','cladding',[-W/4,fh*1.5+.2-below,D/2+.06],[W/2-.4,fh+.6,.1]);
  // side siding on upper storeys
  k.box('side siding','siding',[W/2+.03,fh*1.5-below/2,0],[.06,fh*2-.4,D-.2]);k.box('side siding','siding',[-W/2-.03,fh*1.5-below/2,0],[.06,fh*2-.4,D-.2]);
  k.box('flat roof','roof',[0,top+.12,0],[W+.5,.24,D+.5]);k.box('roof fascia','trim',[0,top+.05,D/2+.26],[W+.55,.35,.06]);
  // windows: each storey, left and right of the centre bay
  for(let f=0;f<floors;f++){
    const y=f*fh-below+(f===0?1.35:1.55),h=f===0?.75:1.35;
    for(const x of [-W/2+1.6,-W/2+3.6,W/2-1.6,W/2-3.6]){
      k.box('window frame','trim',[x,y,D/2+.05],[1.35,h+.16,.08]);k.box('window glass','glass',[x,y,D/2+.1],[1.17,h,.03]);
    }
  }
  // centre bay: entry doors, porch roof, front stair up to the first floor
  const doorY=fh-below;
  for(const x of [-.55,.55]){k.box('entry door','trim',[x,doorY+1.05,D/2+.06],[.9,2.1,.08]);k.box('door glass','glass',[x,doorY+1.35,D/2+.11],[.35,1.1,.02]);}
  k.box('porch landing','trim',[0,doorY-.05,D/2+.75],[2.6,.1,1.5]);
  railing(k,'trim',[0,doorY,D/2+1.5],2.6);
  k.box('porch roof','trim',[0,doorY+2.55,D/2+.8],[3,.14,1.7],[.12,0,0]);
  for(const x of [-1.2,1.2])k.box('porch post','trim',[x,doorY+1.25,D/2+1.5],[.08,2.5,.08]);
  if(p.frontStair!==false)stairs(k,'front stair','trim',0,D/2+1.5,1,Math.round(doorY/.19),.19,.28,1.25,doorY);
  k.box('basement door well','trim',[0,.2,D/2+.06],[.9,1.9,.06]);
  // rear balconies and stairs
  if(p.rearBalconies!==false){
    for(let f=1;f<floors;f++){const y=f*fh-below;k.box('rear balcony','trim',[-W/4,y-.05,-D/2-.9],[3.4,.12,1.8]);railing(k,'trim',[-W/4,y,-D/2-1.8],3.4);}
    stairs(k,'rear stair','trim',-W/4-1.2,-D/2-1.8,-1,Math.round((fh-below)/.19),.19,.28,1.05,fh-below);
    stairs(k,'rear stair upper','trim',-W/4+1.2,-D/2-1.8,-1,Math.round(fh/.19),.19,.28,1.05,2*fh-below);
  }
  // sheds in the back yard
  const sheds=p.sheds??0;
  for(let i=0;i<sheds;i++){const x=-W/2+1.8+i*2.6,z=-D/2-8.5;k.box('garden shed','shed',[x,1,z],[2.2,2,1.8]);k.box('shed roof','trim',[x,2.08,z],[2.4,.12,2]);k.box('shed door','shedDoor',[x,.9,z+.92],[1.4,1.7,.05]);}
  for(const [x,z] of [[-W/2-3,4],[W/2+4.5,-4],[-W/2-4,-9]]){k.cyl('tree trunk','trunk',[x,1.1,z],[.18,2.2,.18]);k.sphere('autumn tree','tree',[x,3.4,z],[1.8,1.9,1.8]);}
  return {group:g,anchors:{
    facade:{position:[-W/4,fh*1.5,D/2+.2],normal:[0,0,1]},
    entry:{position:[0,doorY+1.2,D/2+.3],normal:[0,0,1]},
    frontStair:{position:[0,doorY/2+.3,D/2+1.5+doorY/.19*.14],normal:[0,1,0]},
    driveway:{position:[W/2+2.2,.1,D/2+5],normal:[0,1,0]},
    rear:{position:[-W/4,fh*1.2,-D/2-1.9],normal:[0,0,-1]},
    yard:{position:[-W/2+3,2.3,-D/2-8.5],normal:[0,1,0]},
    roof:{position:[0,top+.3,0],normal:[0,1,0]},
  }};
}

/** Open-plan living area with a kitchen island and a patio door at the back. */
export function openLivingKitchen(p={}){
  const P={floor:'#9a7b5c',seam:'#7f644a',wall:'#f3f2ee',upper:'#f5f5f2',lower:'#8a6e55',counter:'#e9e7e1',tile:'#dcdcd8',glass:'#9fb3bb',trim:'#2b2d2f',chrome:'#c9cdcf',ac:'#ffffff',...p.palette};
  const g=base('Open living area and kitchen — schematic',p.meta),k=kit(g,P);
  const W=p.width??4.6,L=p.length??10,Hh=2.6;
  k.box('wood floor','floor',[0,-.06,0],[W,.12,L]);for(let i=0;i<W/.22;i++)k.box('plank seam','seam',[-W/2+i*.22,.002,0],[.01,.005,L]);
  k.box('kitchen tile floor','tile',[0,.004,-L/2+1.8],[W,.01,3.6]);
  k.box('left wall','wall',[-W/2,Hh/2,0],[.12,Hh,L]);k.box('back wall','wall',[0,Hh/2,-L/2],[W,Hh,.12]);
  k.box('right low wall','wall',[W/2,.3,0],[.12,.6,L]);k.box('front low wall','wall',[0,.3,L/2],[W,.6,.12]);
  // patio door in the back wall
  const pd=p.patioDoor!==false;
  if(pd){k.box('patio door frame','trim',[W/2-1.2,1.05,-L/2+.07],[1.9,2.1,.05]);k.box('patio door glass','glass',[W/2-1.2,1.05,-L/2+.1],[1.75,1.95,.02]);}
  // kitchen run along the left wall: wood lower cabinets, white uppers
  k.box('lower cabinets','lower',[-W/2+.35,.45,-L/2+1.6],[.6,.9,3]);k.box('counter','counter',[-W/2+.35,.92,-L/2+1.6],[.64,.04,3.04]);
  k.box('upper cabinets','upper',[-W/2+.2,1.85,-L/2+1.6],[.35,.8,3]);k.box('range hood','chrome',[-W/2+.3,1.4,-L/2+.8],[.5,.08,.6]);
  if(p.island!==false){k.box('island base','lower',[0,.45,-L/2+2.2],[1,.9,2.2]);k.box('island top','counter',[0,.92,-L/2+2.2],[1.1,.05,2.3]);k.box('sink','chrome',[0,.93,-L/2+2.3],[.5,.02,.7]);k.cyl('faucet','chrome',[-.3,1.12,-L/2+2.3],[.025,.38,.025]);}
  for(const z of [-L/2+1.6,-L/2+2.6])k.box('ceiling spot track','chrome',[0,Hh-.03,z],[.9,.04,.05]);
  // living area: window high on the left wall, wall-mounted heat pump
  k.box('window frame','trim',[-W/2+.05,1.75,L/2-2],[.06,.8,1.3]);k.box('window glass','glass',[-W/2+.09,1.75,L/2-2],[.02,.66,1.15]);
  if(p.heatPump!==false)k.box('wall heat pump','ac',[-W/2+.15,2.2,L/2-4],[.22,.3,.9]);
  k.box('baseboard heater','ac',[-W/2+.08,.15,L/2-3],[.06,.18,1.3]);
  k.cyl('ceiling light','ac',[0,Hh-.05,L/2-2.5],[.25,.06,.25]);
  return {group:g,anchors:{
    living:{position:[0,.4,L/2-2.5],normal:[0,1,0]},
    window:{position:[-W/2+.12,1.75,L/2-2],normal:[1,0,0]},
    kitchen:{position:[-W/2+.4,1.2,-L/2+1.6],normal:[1,0,0]},
    island:{position:[0,1,-L/2+2.2],normal:[0,1,0]},
    patioDoor:{position:[W/2-1.2,1.2,-L/2+.15],normal:[0,0,1]},
  }};
}

/** Empty bedroom: high window, bifold closet, baseboard heater. */
export function bedroom(p={}){
  const P={floor:'#9a7b5c',seam:'#7f644a',wall:'#f3f2ee',closet:'#fafaf8',trim:'#2b2d2f',glass:'#9fb3bb',heater:'#ffffff',...p.palette};
  const g=base('Bedroom — schematic',p.meta),k=kit(g,P);
  const W=p.width??3.4,D=p.depth??3.5,Hh=2.6;
  k.box('wood floor','floor',[0,-.06,0],[W,.12,D]);for(let i=0;i<W/.22;i++)k.box('plank seam','seam',[-W/2+i*.22,.002,0],[.01,.005,D]);
  k.box('back wall','wall',[0,Hh/2,-D/2],[W,Hh,.12]);k.box('left wall','wall',[-W/2,Hh/2,0],[.12,Hh,D]);
  k.box('right low wall','wall',[W/2,.3,0],[.12,.6,D]);k.box('front low wall','wall',[0,.3,D/2],[W,.6,.12]);
  const high=p.highWindow!==false,wy=high?1.95:1.5,wh=high?.55:1.1;
  k.box('window frame','trim',[.5,wy,-D/2+.07],[1.2,wh+.12,.05]);k.box('window glass','glass',[.5,wy,-D/2+.1],[1.06,wh,.02]);
  if(p.closet!==false){k.box('bifold closet','closet',[-W/2+.1,1.05,.5],[.1,2.1,1.5]);k.box('closet split','trim',[-W/2+.16,1.05,.5],[.01,2,.01]);}
  k.box('baseboard heater','heater',[.5,.15,-D/2+.1],[1.1,.18,.06]);
  k.cyl('ceiling light','heater',[0,Hh-.05,0],[.2,.05,.2]);
  return {group:g,anchors:{
    window:{position:[.5,wy,-D/2+.15],normal:[0,0,1]},
    closet:{position:[-W/2+.2,1.2,.5],normal:[1,0,0]},
    room:{position:[0,.3,.3],normal:[0,1,0]},
  }};
}

/** Bathroom with freestanding tub, glass shower, wood vanity and tall cabinet. */
export function bathroom(p={}){
  const P={floor:'#d7d7d3',tile:'#bdbcb7',wall:'#f3f2ee',white:'#fbfbfa',wood:'#8a6e55',counter:'#f2f2f0',glass:'#cfe0e6',chrome:'#c9cdcf',mirror:'#d9e3e6',...p.palette};
  const g=base('Bathroom — schematic',p.meta),k=kit(g,P);
  const W=p.width??2.8,D=p.depth??3.2,Hh=2.6;
  k.box('tile floor','floor',[0,-.06,0],[W,.12,D]);
  for(let x=-W/2+.6;x<W/2;x+=.6)k.box('floor grout','tile',[x,.002,0],[.01,.005,D]);for(let z=-D/2+.6;z<D/2;z+=.6)k.box('floor grout','tile',[0,.002,z],[W,.005,.01]);
  k.box('back tiled wall','tile',[0,Hh/2,-D/2],[W,Hh,.12]);k.box('left wall','wall',[-W/2,Hh/2,0],[.12,Hh,D]);k.box('left tile band','tile',[-W/2+.07,.6,0],[.02,1.2,D]);
  k.box('right low wall','wall',[W/2,.3,0],[.12,.6,D]);k.box('front low wall','wall',[0,.3,D/2],[W,.6,.12]);
  if(p.tub!==false){k.box('freestanding tub','white',[.35,.3,-D/2+.45],[1.65,.6,.78]);k.box('tub interior','glass',[.35,.59,-D/2+.45],[1.45,.02,.58]);k.cyl('tub filler','chrome',[-.3,.7,-D/2+.2],[.025,.5,.025]);}
  if(p.toilet!==false){k.box('toilet tank','white',[W/2-.45,.7,-D/2+.25],[.5,.55,.22]);k.sphere('toilet bowl','white',[W/2-.45,.42,-D/2+.62],[.24,.18,.32]);k.box('toilet pedestal','white',[W/2-.45,.2,-D/2+.5],[.3,.4,.45]);}
  if(p.shower!==false){const sx=-W/2+.5,sz=D/2-.55;k.box('shower base','white',[sx,.04,sz],[.9,.08,.9]);k.box('shower glass','glass',[sx+.45,1.05,sz],[.02,2,.9]);k.box('shower glass','glass',[sx,1.05,sz-.45],[.9,2,.02]);k.cyl('shower rail','chrome',[-W/2+.1,1.3,sz],[.02,1,.02]);}
  if(p.vanity!==false){const z=0;k.box('vanity','wood',[-W/2+.32,.45,z],[.55,.9,1.2]);k.box('vanity top','counter',[-W/2+.32,.92,z],[.58,.04,1.24]);k.box('vessel sink','white',[-W/2+.32,1.0,z],[.38,.12,.48]);k.box('led mirror','mirror',[-W/2+.08,1.65,z],[.03,.85,.65]);k.box('mirror glow','white',[-W/2+.07,1.65,z],[.02,.9,.7]);}
  if(p.tallCabinet!==false)k.box('tall cabinet','wood',[-W/2+.25,1.1,-.95],[.42,2.2,.5]);
  return {group:g,anchors:{
    tub:{position:[.35,.8,-D/2+.45],normal:[0,1,0]},
    shower:{position:[-W/2+.5,1.3,D/2-.55],normal:[1,0,0]},
    vanity:{position:[-W/2+.2,1.6,0],normal:[1,0,0]},
    toilet:{position:[W/2-.45,.8,-D/2+.5],normal:[0,1,0]},
  }};
}

export const templates={plexExterior,openLivingKitchen,bedroom,bathroom};
