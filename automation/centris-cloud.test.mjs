import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCloudClaims,validateSnapshot} from '../supabase/functions/_shared/centris-cloud.mjs';
import {parseCards,parseDetail} from './centris-source.mjs';
import {prepareSnapshot} from './centris-plan.mjs';
const claims={repository:'YuJieMichael/Propriete-En-Vente',repository_id:'1381834923',repository_owner_id:'107652194',ref:'refs/heads/main',ref_type:'branch',runner_environment:'github-hosted',workflow_ref:'YuJieMichael/Propriete-En-Vente/.github/workflows/centris-sync.yml@refs/heads/main',event_name:'schedule',sub:'repo:YuJieMichael@107652194/Propriete-En-Vente@1381834923:ref:refs/heads/main',run_id:'123',run_attempt:'1'};
test('cloud identity is limited to the exact repository, workflow, branch and event',()=>{
  assert.equal(assertCloudClaims(claims),'123-1');
  assert.equal(assertCloudClaims({...claims,job_workflow_ref:claims.workflow_ref}),'123-1');
  assert.throws(()=>assertCloudClaims({...claims,job_workflow_ref:claims.workflow_ref.replace('main','evil')}));
  for(const [key,value] of Object.entries({repository_id:'9',repository_owner_id:'9',ref:'refs/heads/evil',workflow_ref:'other',event_name:'pull_request',runner_environment:'self-hosted',sub:'wrong',job_workflow_ref:'reusable'}))assert.throws(()=>assertCloudClaims({...claims,[key]:value}));
});
const card={sourceId:'12345678',url:'https://www.centris.ca/fr/maison~a-vendre~test/12345678',title:'123, Rue Test',city:'Montréal',category:'Maison à vendre',transaction:'sale',price:500000,rentPrice:null,taxExtra:false};
const snapshot=cards=>({brokerId:'e6356',capturedAt:new Date().toISOString(),total:cards.length,complete:true,cards});
test('partial, empty, duplicate, malformed and incompatible prices fail closed',()=>{
  assert.equal(validateSnapshot(snapshot([card])).total,1);
  for(const value of [{...snapshot([card]),complete:false},snapshot([]),snapshot([card,card]),snapshot([{...card,sourceId:'../x'}]),snapshot([{...card,price:0}]),snapshot([{...card,transaction:'rent'}]),snapshot([{...card,rentPrice:1000}])])assert.throws(()=>validateSnapshot(value));
});
const detailHtml=(id='12345678')=>`<link hreflang="fr" href="https://www.centris.ca/fr/maison~a-vendre~test/${id}"><span id="ListingId">${id}</span><a href="/fr/courtier/e6356">Tian Shu Lu</a><input id="calculatorListingPrice" value="500000"><div class="property-summary-header__renting-price-value">1 880 $ /mois</div><div class="carac-container"><div class="carac-title">Unité principale</div><div class="carac-value">5 pièces, 3 chambres, 1 salle de bain</div></div><span id="PropertyLat">45.5</span><span id="PropertyLng">-73.5</span><script>window.MosaicPhotoUrls = ["https://mspublic.centris.ca/media.ashx?id=abc&t=pi"];</script>`;
test('dual prices and unpublished addresses are interpreted without invented location or facts',()=>{
  const dual=parseDetail(detailHtml(),{...card,transaction:'sale-rent'});
  assert.equal(dual.rentPrice,1880);assert.equal(dual.property.beds,3);assert.equal(dual.property.baths,1);assert.equal(dual.property.parking,null);
  const hidden=parseDetail(detailHtml(),{...card,title:'8888, Rue Non Disponible-Unavailable'});
  assert.equal(hidden.property.title,'Adresse non publiée');assert.equal(hidden.property.coordinates,undefined);
  assert.throws(()=>parseDetail(detailHtml('99999999'),card));
  assert.throws(()=>parseDetail(detailHtml().replace('mspublic.centris.ca','evil.example'),card));
});
test('rental listing cards require an explicit monthly price unit',()=>{
  const html=`<div><div class="property-thumbnail-feature"><meta itemprop="sku" content="12345678"></div><a class="a-more-detail" href="/fr/maison/12345678"></a><div class="price"><meta itemprop="price" content="1880">1 880 $ /mois</div><div itemprop="category">Maison à louer</div><div class="address"><div>123 Test</div><div>Montréal</div></div></div>`;
  assert.equal(parseCards(html)[0].rentPrice,1880);
  assert.throws(()=>parseCards(html.replace('/mois','/année')));
  const rentalDetail=detailHtml().replace('value="500000"','value="0"')+'<meta itemprop="price" content="1880">';
  assert.equal(parseDetail(rentalDetail,{...card,transaction:'rent',price:1880,rentPrice:1880}).property.rentPrice,1880);
});
test('existing editorial facts/photos are not sent as replacement properties; relists keep identity',async()=>{
  const row={source_id:card.sourceId,property:{...card,description:'Hand written',features:[{rooms:17}]},photo_paths:['/centris/12345678/001.webp'],published:true};
  const noChange=await prepareSnapshot(snapshot([card]),{rows:[row]},{detail:()=>{throw Error('Unneeded detail');}});
  assert.equal(noChange.snapshot.cards[0].property,undefined);assert.equal(noChange.summary.updated,0);
  const fresh={...card,sourceId:'23456789'};
  const relist=await prepareSnapshot(snapshot([fresh]),{rows:[row]},{detail:async c=>({...c,property:{source:{url:c.url}},photos:['https://mspublic.centris.ca/media.ashx?id=x']})});
  assert.equal(relist.snapshot.cards[0].replacesSourceId,card.sourceId);assert.equal(relist.newPhotos.length,0);assert.equal(relist.summary.missing,0);
});
