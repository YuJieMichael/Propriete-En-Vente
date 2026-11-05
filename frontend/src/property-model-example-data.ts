import type {PropertyModel} from './lib/property-models';

// Existing published photo assets, unchanged. Independent orientation examples;
// there is no verified interior floor plan or room-to-building assignment.
export const motelExample={reference:'100021',title:'104, Rue Olivier',city:'Laurier-Station',sourceId:'24397299',sourceUrl:'https://www.centris.ca/fr/batisse-commerciale~a-vendre~laurier-station/24397299'};
export const motelExampleModels:PropertyModel[]=[
  {src:'/models/examples/100021/exterior-v1.glb',area:'exterior',label:{fr:'Bâtiment et stationnement',en:'Building and parking',zh:'建筑与停车场'},illustrative:true,schematic:true,hotspots:[
    {id:'facade',label:{fr:'Façade',en:'Front exterior',zh:'建筑外观'},position:[-5,3.1,2.25],normal:[0,0,1],photos:['/centris/24397299/001.webp'],illustrative:false},
    {id:'parking',label:{fr:'Vue aérienne et stationnement',en:'Aerial view and parking',zh:'航拍与停车场'},position:[8,.2,8],normal:[0,1,0],photos:['/centris/24397299/002.webp'],illustrative:false},
  ]},
  {src:'/models/examples/100021/double-room-v1.glb',area:'interior',label:{fr:'Exemple de chambre à deux lits',en:'Two-bed guest room example',zh:'双床客房示例'},illustrative:true,schematic:true,hotspots:[
    {id:'beds',label:{fr:'Lits et mobilier',en:'Beds and furniture',zh:'床位与家具'},position:[.4,1,-.6],normal:[0,1,0],photos:['/centris/24397299/007.webp','/centris/24397299/006.webp'],illustrative:false},
    {id:'window',label:{fr:'Fenêtre et équipements',en:'Window and amenities',zh:'窗边与设备'},position:[-3.3,1.8,-.1],normal:[1,0,0],photos:['/centris/24397299/006.webp'],illustrative:false},
  ]},
  {src:'/models/examples/100021/bathroom-v1.glb',area:'interior',label:{fr:'Exemple de salle de bain',en:'Bathroom example',zh:'浴室示例'},illustrative:true,schematic:true,hotspots:[
    {id:'bathroom',label:{fr:'Salle de bain',en:'Bathroom',zh:'浴室'},position:[1.1,1,-.7],normal:[0,1,0],photos:['/centris/24397299/008.webp'],illustrative:false},
  ]},
];
