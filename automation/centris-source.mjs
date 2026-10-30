import {gunzipSync} from 'node:zlib';
import {JSDOM} from 'jsdom';

export const BROKER_URL='https://www.centris.ca/fr/courtier-immobilier~tian-shu-lu~re-max-platine/e6356';
const origin='https://www.centris.ca';
const clean=value=>(value??'').replace(/\s+/g,' ').trim();
const documentOf=html=>new JSDOM(html).window.document;
const required=(value,label)=>{if(!value)throw Error(`Missing ${label}`);return value;};
const money=value=>{const n=Number(value);if(!Number.isFinite(n)||n<=0||n>1e9)throw Error('Invalid price');return n;};

export class CentrisClient {
  cookies=new Map();
  async request(path,body) {
    const url=new URL(path,origin);
    if(url.origin!==origin)throw Error('Unexpected source host');
    const response=await fetch(url,{headers:{'User-Agent':'ProprieteEnVenteCatalogueSync/1.0 (+https://proprieteenvente.ca)',
      Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),
      ...(body?{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest'}:{})},
      ...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
    for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1));}
    if(!response.ok)throw Error(`Centris HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const html=(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes).toString('utf8');
    if(/<title>\s*(Just a moment|Access denied|Attention Required)/i.test(html))throw Error('Centris access challenge; no updates made');
    return html;
  }
  async json(path,body){const response=JSON.parse(await this.request(path,body));if(response.d?.Succeeded!==true)throw Error('Centris request failed');return response.d.Result;}
  async catalogue(){
    const broker=documentOf(await this.request(BROKER_URL));
    const code=required(broker.querySelector('#CourtierCode')?.value,'broker code');
    const advertised=Number(required(broker.querySelector('#BrokerPropertiesCount')?.value,'broker count'));
    if(code!=='97998'||advertised<1||advertised>200)throw Error('Unexpected broker or catalogue size');
    const route=await this.json('/broker/UpdatePropertyForBroker',{courtierCode:code});
    const first=documentOf(await this.request(route));
    const total=Number(first.querySelector('.js-resultCount')?.textContent);
    if(total!==advertised)throw Error('Broker and catalogue counts differ');
    const encoded=required(first.querySelector('#serializedSearchQuery')?.textContent,'search query');
    const query=JSON.parse(gunzipSync(Buffer.from(encoded,'base64url')).toString('utf8'));
    if(query.brokerCode!==code)throw Error('Wrong broker query');
    const sortSeed=Number(first.querySelector('#sortSeed')?.textContent);
    const pageSize=Number(first.querySelector('#pageSize')?.textContent);
    if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Invalid page size');
    const region=required(first.querySelector('#currentRegion')?.textContent,'region');
    const cards=[];
    for(let page=1;page<=Math.ceil(total/pageSize);page++){
      const result=await this.json('/Property/GetInscriptions',{mode:'Result',searchView:'Thumbnail',sortSeed,sort:'DateDesc',pageSize,page,query,region});
      if(result.count!==total||result.inscNumberPerPage!==pageSize)throw Error('Catalogue changed during pagination');
      const part=parseCards(result.html);
      if(part.length!==Math.min(pageSize,total-(page-1)*pageSize))throw Error('Partial page');
      cards.push(...part);
    }
    if(cards.length!==total||new Set(cards.map(c=>c.sourceId)).size!==total)throw Error('Duplicate or missing catalogue IDs');
    return {brokerId:'e6356',capturedAt:new Date().toISOString(),total,complete:true,cards};
  }
  async detail(card){return parseDetail(await this.request(card.url),card);}
}

export function parseCards(html){
  const doc=documentOf(html);
  return [...doc.querySelectorAll('.property-thumbnail-feature')].map(node=>{
    const shell=node.parentElement;
    const sourceId=required(node.querySelector('[itemprop=sku]')?.content,'source ID');
    if(!/^\d{7,8}$/.test(sourceId))throw Error('Invalid source ID');
    const url=new URL(required(shell.querySelector('a.a-more-detail')?.getAttribute('href'),'detail URL'),origin).href;
    if(!url.startsWith(origin+'/')||!url.split('?')[0].endsWith('/'+sourceId))throw Error('Source URL mismatch');
    const category=clean(shell.querySelector('[itemprop=category]')?.textContent);
    const rent=/à louer|for rent/i.test(category),sale=/à vendre|for sale/i.test(category);
    const transaction=rent&&sale?'sale-rent':rent?'rent':sale?'sale':null;
    if(!transaction)throw Error('Unknown transaction');
    const priceText=clean(shell.querySelector('.price')?.textContent);
    if(transaction==='rent'&&!/\/\s*(mois|month)/i.test(priceText))throw Error('Unsupported rental price period');
    const address=[...shell.querySelectorAll('.address>div')].map(x=>clean(x.textContent));
    if(address.length<2)throw Error('Missing address');
    return {sourceId,url,category,title:address[0],city:address[1],transaction,
      price:money(shell.querySelector('[itemprop=price]')?.content),taxExtra:/TPS|GST|TVQ|QST/.test(priceText),
      beds:null,baths:null,rentPrice:transaction==='rent'?money(shell.querySelector('[itemprop=price]')?.content):null};
  });
}

const typeNames={house:['House','Maison','住宅'],condo:['Condominium / apartment','Condo / appartement','公寓'],plex:['Income property','Immeuble à revenus','多户住宅'],commercial:['Commercial property','Propriété commerciale','商业物业'],land:['Land','Terrain','土地'],'hotel-motel':['Hotel / motel','Hôtel / motel','酒店 / 汽车旅馆'],daycare:['Daycare','Garderie','日托中心'],business:['Business','Commerce','生意']};
export function parseDetail(html,card){
  const d=documentOf(html);
  if(clean(d.querySelector('#ListingId')?.textContent)!==card.sourceId)throw Error('Detail ID mismatch');
  if(![...d.querySelectorAll('a[href]')].some(a=>/\/e6356(?:\?|$)/.test(a.getAttribute('href'))))throw Error('Broker not confirmed on detail');
  const frUrl=required(d.querySelector('link[hreflang=fr]')?.href,'French canonical URL');
  if(!frUrl.startsWith(origin+'/fr/')||!frUrl.endsWith('/'+card.sourceId))throw Error('Invalid canonical URL');
  const specs=[...d.querySelectorAll('.carac-container')].map(e=>({label:clean(e.querySelector('.carac-title')?.textContent),value:clean(e.querySelector('.carac-value')?.textContent)}));
  const spec=(pattern)=>specs.find(s=>pattern.test(s.label))?.value??'';
  const main=spec(/Unité principale|Main unit/i);
  const bedsMatch=(main||clean(d.querySelector('.cac')?.textContent)).match(/(?:^|\s)(\d+)\s*(?:chambre|bedroom|$)/i);
  const bathsMatch=(main||clean(d.querySelector('.sdb')?.textContent)).match(/(?:^|\s)(\d+)\s*(?:salle de bain|bathroom|$)/i);
  const areaValue=spec(/Superficie habitable|Living area/i),lotValue=spec(/Superficie du terrain|Lot area/i);
  const area=s=>/^([\d\s,.]+)\s*(?:pc|sqft|sq\. ft\.)$/i.test(s)?Number(s.match(/^[\d\s,.]+/)[0].replace(/[\s,]/g,'')):null;
  const price=money(required(d.querySelector('meta[itemprop=price]')?.content||d.querySelector('#calculatorListingPrice')?.value,'detail price'));
  if(price!==card.price)throw Error('Card/detail price mismatch; retry next run');
  let rentPrice=card.rentPrice;
  if(card.transaction==='sale-rent'){
    const rental=clean(d.querySelector('.property-summary-header__renting-price-value')?.textContent);
    const match=rental?.match(/(?:\$\s*)?([\d\s,]+)\s*(?:\$)?\s*\/\s*(?:mois|month)/i);
    if(!match)throw Error('Missing dual-listing monthly rent');
    rentPrice=money(match[1].replace(/[\s,]/g,''));
  }
  const scope=clean(d.querySelector('.region-content')?.textContent);
  const category=card.category;
  let type=/condo|appartement|apartment|loft/i.test(category)?'condo':/duplex|triplex|quadruplex|quintuplex|plex/i.test(category)?'plex':/maison|house|bungalow|cottage/i.test(category)?'house':/terrain|terre|land|lot/i.test(category)?'land':/commerce|business/i.test(category)?'business':/commercial|bâtisse/i.test(category)?'commercial':null;
  if(['business','commercial'].includes(type)&&/\b(motel|hôtel|hotel|auberge)\b/i.test(scope))type='hotel-motel';
  if(['business','commercial'].includes(type)&&/\b(garderie|daycare)\b/i.test(scope))type='daycare';
  if(!type)throw Error('Unmapped property category');
  const undisclosed=/non disponible|unavailable|non publiée|undisclosed/i.test(card.title);
  const title=undisclosed?'Adresse non publiée':card.title;
  const date=new Date().toISOString().slice(0,10),names=typeNames[type];
  const action=card.transaction==='sale'?['for sale','à vendre','出售']:card.transaction==='rent'?['for rent','à louer','出租']:['for sale or rent','à vendre ou à louer','出售或出租'];
  const descriptions={en:`${names[0]} ${action[0]} in ${card.city}. ${undisclosed?'The precise address is not published.':`Address: ${title}.`} Public Centris listing ${card.sourceId}, listed by Tian Shu Lu. Contact the broker for availability and further details.`,fr:`${names[1]} ${action[1]} à ${card.city}. ${undisclosed?'L’adresse précise n’est pas publiée.':`Adresse : ${title}.`} Fiche publique Centris ${card.sourceId}, courtier Tian Shu Lu. Communiquez avec le courtier pour les disponibilités et les détails.`,zh:`${card.city}的${names[2]}，${action[2]}。${undisclosed?'未公开详细地址。':`地址：${title}。`}Centris 房源编号 ${card.sourceId}，挂牌经纪人为陆天舒（Tian Shu Lu）。详情与可用状态请联系经纪人确认。`};
  const features=[];
  const year=spec(/Année de construction|Year built/i);
  if(/^\d{4}$/.test(year))features.push({key:'year',label:{en:'Year built',fr:'Construction',zh:'建造年份'},value:{en:year,fr:year,zh:year}});
  const property={title,city:card.city,district:'',postal:'',type,mode:'broker',transaction:card.transaction,price:card.price,rentPrice,taxExtra:card.taxExtra,
    beds:bedsMatch?Number(bedsMatch[1]):null,baths:bathsMatch?Number(bathsMatch[1]):null,area:area(areaValue),lotArea:area(lotValue),parking:null,parkingSpaces:null,outdoor:null,
    description:descriptions.fr,descriptionTranslations:descriptions,features,
    source:{provider:'centris',id:card.sourceId,url:frUrl,brokerId:'e6356',importedAt:date,verifiedAt:date,placeholder:false,descriptionAvailable:true,locationStatus:undisclosed?'unverified':'approximate'}};
  const lat=Number(d.querySelector('#PropertyLat')?.textContent),lng=Number(d.querySelector('#PropertyLng')?.textContent);
  if(!undisclosed&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=44&&lat<=63&&lng>=-80&&lng<=-57)property.coordinates={latitude:lat,longitude:lng,source:'centris'};
  const match=html.match(/window\.MosaicPhotoUrls\s*=\s*(\[[^\n;]+\]);/);
  const photos=match?JSON.parse(match[1]):[];
  if(!Array.isArray(photos)||photos.length<1||photos.length>100)throw Error('Missing/invalid photo gallery');
  for(const url of photos){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='mspublic.centris.ca'||u.pathname!=='/media.ashx')throw Error('Untrusted photo URL');}
  return {...card,rentPrice,property,photos};
}
