import type {PublicProperty} from '../../supabase/functions/_shared/listing-input';
import type {Language} from './seller-copy';

export type SelectedPhotoReview={width?:number;height?:number;hash?:string;error?:boolean};
export type CheckupFinding={key:string;text:string};
export type ListingCheckupResult={ready:CheckupFinding[];attention:CheckupFinding[];confirm:CheckupFinding[]};

/** Local hints complement form validation; they never approve publication or verify a property. */
export function checkListing(property:PublicProperty,photos:readonly string[],reviews:readonly SelectedPhotoReview[],lang:Language):ListingCheckupResult{
  const c={
    en:{details:'Price, area and description have been entered.',location:'City and postal code have been entered.',photos:'Selected photos are attached to this preview.',brief:'The description is short. Add the layout, condition, inclusions and availability that you can confirm.',district:'Add the neighbourhood or area to help buyers place the property.',fewPhotos:'Only one photo is selected. Consider adding other rooms, the exterior or a useful view of the site.',noPhotos:'Select at least one actual property photo before submission.',price:'Review the asking price: it must be a positive amount in CAD.',area:'Review the area: enter a positive area and make its meaning clear in the description.',small:'The following photos have a longest side below 1,000 pixels. A larger original may show details better:',duplicate:'Identical image files are repeated in these positions. Keep one copy or replace them:',unreadable:'The following photos could not be read for this check. Reopen or replace them:',residential:'Confirm the bedroom and bathroom counts, inclusions and availability in the description.',house:'Describe known work or renovations accurately; leave uncertain details as questions.',condo:'Clarify condo fees and any known special assessments, or say that they remain to be confirmed.',plex:'Clarify occupancy, leases and recurring expenses that you can substantiate.',commercial:'State whether the price covers the building, a leasehold interest or other assets; describe the offered premises.',land:'Specify whether the entered area is the lot area. Describe access, services and known permitted uses; identify what remains to be checked.',hotel:'State whether the sale includes the building, the business, equipment or a combination. Only give operating figures that you can substantiate.',daycare:'Clarify the sale scope, authorized places, permits and subsidy conditions using information you can substantiate.',business:'State whether shares or assets are offered, what is included and the lease conditions that can be disclosed.',parking:'The parking flag and number of spaces conflict. Review them before submitting.'},
    fr:{details:'Le prix, la superficie et la description sont renseignés.',location:'La ville et le code postal sont renseignés.',photos:'Les photos choisies sont jointes à cet aperçu.',brief:'La description est courte. Ajoutez la disposition, l’état, les inclusions et la disponibilité que vous pouvez confirmer.',district:'Ajoutez le quartier ou le secteur pour aider les acheteurs à situer la propriété.',fewPhotos:'Une seule photo est choisie. Pensez à montrer d’autres pièces, l’extérieur ou une vue utile du terrain.',noPhotos:'Choisissez au moins une photo réelle de la propriété avant l’envoi.',price:'Vérifiez le prix demandé : il doit s’agir d’un montant positif en CAD.',area:'Vérifiez la superficie : indiquez une valeur positive et précisez sa signification dans la description.',small:'Les photos suivantes mesurent moins de 1 000 pixels sur leur côté le plus long. Un original plus grand peut mieux montrer les détails :',duplicate:'Des fichiers image identiques sont répétés à ces positions. Gardez une copie ou remplacez-les :',unreadable:'Les photos suivantes n’ont pas pu être lues pour cette vérification. Rouvrez-les ou remplacez-les :',residential:'Confirmez dans la description les chambres, les salles de bain, les inclusions et la disponibilité.',house:'Décrivez fidèlement les travaux ou rénovations connus; indiquez ce qui reste à confirmer.',condo:'Précisez les frais de copropriété et les cotisations spéciales connues, ou indiquez qu’ils restent à confirmer.',plex:'Précisez l’occupation, les baux et les dépenses récurrentes que vous pouvez documenter.',commercial:'Indiquez si le prix vise l’immeuble, un droit au bail ou d’autres actifs et décrivez les locaux proposés.',land:'Précisez si la superficie saisie correspond au terrain. Décrivez les accès, services et usages permis connus, ainsi que les points à vérifier.',hotel:'Indiquez si la vente comprend l’immeuble, l’entreprise, l’équipement ou une combinaison. Donnez uniquement des chiffres d’exploitation documentables.',daycare:'Précisez la portée de la vente, les places autorisées, les permis et les conditions de subvention selon les renseignements que vous pouvez documenter.',business:'Indiquez si des actions ou des actifs sont proposés, les inclusions et les conditions de bail qui peuvent être divulguées.',parking:'La présence de stationnement et le nombre de places se contredisent. Vérifiez-les avant l’envoi.'},
    zh:{details:'已填写报价、面积和描述。',location:'已填写城市和邮编。',photos:'所选照片已附在本次预览中。',brief:'描述较短。建议补充您能确认的布局、状况、包含项目和可交付时间。',district:'建议补充社区或片区，方便买家了解位置。',fewPhotos:'目前只有一张照片。可补充其他房间、外观或有助于了解场地的视角。',noPhotos:'提交前请至少选择一张物业实拍照片。',price:'请检查报价：应为大于零的加元金额。',area:'请检查面积：应为大于零的数值，并在描述中说明面积含义。',small:'以下照片的最长边不足 1,000 像素。使用更大的原图可能更清楚地展示细节：',duplicate:'以下位置使用了相同的图片文件。建议保留一份或更换照片：',unreadable:'以下照片暂时无法读取进行检查。请重新打开或更换照片：',residential:'请确认描述中的卧室、浴室、包含项目及可交付时间。',house:'请准确说明已知维修或翻新情况，把不确定的内容列为待确认。',condo:'请说明物业费及已知的特别分摊费用，或注明仍待确认。',plex:'请说明您能提供依据的占用情况、租约及日常支出。',commercial:'请说明报价涉及建筑、租赁权益还是其他资产，并描述实际提供的场所。',land:'请说明所填面积是否为土地面积，描述已知道路出入、配套服务、允许用途及仍需核实的内容。',hotel:'请说明出售范围包括物业、经营业务、设备还是其组合。经营数据仅填写您能提供依据的内容。',daycare:'请依据可核实资料说明出售范围、许可名额、许可证及补贴条件。',business:'请说明出售的是股权还是资产、包含项目及可以披露的租约条件。',parking:'是否有车位与车位数量不一致，请在提交前核对。'},
  }[lang];
  const ready:CheckupFinding[]=[],attention:CheckupFinding[]=[];
  const positive=(value:number)=>Number.isFinite(value)&&value>0;
  if(positive(property.price)&&positive(property.area)&&property.description.trim())ready.push({key:'details',text:c.details});
  if(property.city.trim()&&property.postal.trim())ready.push({key:'location',text:c.location});
  if(photos.length)ready.push({key:'photos',text:c.photos});
  else attention.push({key:'noPhotos',text:c.noPhotos});
  if(!positive(property.price))attention.push({key:'price',text:c.price});
  if(!positive(property.area))attention.push({key:'area',text:c.area});
  const description=property.description.trim();
  const threshold=/[\u3400-\u9fff]/.test(description)?50:120;
  if(description.length<threshold)attention.push({key:'brief',text:c.brief});
  if(!property.district.trim())attention.push({key:'district',text:c.district});
  if(photos.length===1)attention.push({key:'fewPhotos',text:c.fewPhotos});
  if(typeof property.parkingSpaces==='number'&&property.parking!==Boolean(property.parkingSpaces>0))attention.push({key:'parking',text:c.parking});
  const validReviews=reviews.slice(0,photos.length);
  const small=validReviews.flatMap((review,index)=>typeof review.width==='number'&&review.width>0&&typeof review.height==='number'&&review.height>0&&Math.max(review.width,review.height)<1000?[index+1]:[]);
  const unreadable=validReviews.flatMap((review,index)=>review.error?[index+1]:[]);
  const hashes=new Map<string,number[]>();
  validReviews.forEach((review,index)=>{if(review.hash){const positions=hashes.get(review.hash)||[];positions.push(index+1);hashes.set(review.hash,positions);}});
  const duplicate=[...hashes.values()].filter(positions=>positions.length>1).map(positions=>positions.join(', '));
  if(small.length)attention.push({key:'small',text:`${c.small} ${small.join(', ')}.`});
  if(duplicate.length)attention.push({key:'duplicate',text:`${c.duplicate} ${duplicate.join(' / ')}.`});
  if(unreadable.length)attention.push({key:'unreadable',text:`${c.unreadable} ${unreadable.join(', ')}.`});
  const confirm:CheckupFinding[]=[];
  if(['house','condo','plex'].includes(property.type))confirm.push({key:'residential',text:c.residential});
  const typeKey=({'house':'house','condo':'condo','plex':'plex','commercial':'commercial','land':'land','hotel-motel':'hotel','daycare':'daycare','business':'business'} as const)[property.type];
  confirm.push({key:typeKey,text:c[typeKey]});
  return {ready,attention,confirm};
}

/** Inspects selected data URLs in this browser only; it performs no upload or external request. */
export async function inspectSelectedPhoto(photo:string):Promise<SelectedPhotoReview>{
  if(!/^data:image\/(?:jpeg|png|webp);base64,/.test(photo))return {error:true};
  let hash:string|undefined;
  try{
    const bytes=Uint8Array.from(atob(photo.slice(photo.indexOf(',')+1)),value=>value.charCodeAt(0));
    if(globalThis.crypto?.subtle){
      const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
      hash=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
    }
  }catch{/* An unavailable fingerprint does not imply that images are different. */}
  return new Promise(resolve=>{
    const image=new Image();
    const timer=setTimeout(()=>{image.onload=image.onerror=null;resolve({hash,error:true});},6000);
    image.onload=()=>{clearTimeout(timer);resolve({hash,width:image.naturalWidth,height:image.naturalHeight});};
    image.onerror=()=>{clearTimeout(timer);resolve({hash,error:true});};
    image.src=photo;
  });
}
