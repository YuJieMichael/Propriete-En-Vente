import {describe,expect,it} from 'vitest';
import {propertyOverview,type OverviewListing} from '../src/property-overview';

const text=(value:string)=>({en:value,fr:value,zh:value});
// French numbers use narrow no-break spaces; compare them as plain spaces.
const plain=(value='')=>value.replace(/[\u00a0\u202f]/g,' ');
const house:OverviewListing={id:'x',reference:'100029',type:'house',transaction:'sale',title:'1898, Rue du Bois-des-Caryers',district:'1898, Rue du Bois-des-Caryers',city:'Montréal (LaSalle)',price:1059000,beds:5,baths:4,area:2146,lotArea:2566,parkingSpaces:2,outdoor:true,features:[{key:'Année de construction',value:text('2012')}]};

describe('property overview',()=>{
  it('describes only the property; nearby places and the welcome tax wait to be asked for',()=>{
    expect(propertyOverview('en',house)).toEqual([
      'House for sale in Montréal (LaSalle), listed at $1,059,000. It offers 5 bedrooms, 4 bathrooms and 2,146 sq. ft. of space on a 2,566 sq. ft. lot. Built in 2012. It comes with parking for 2 vehicles and outdoor space.',
    ]);
  });
  it('keeps French agreement independent of the property type',()=>{
    const [about]=propertyOverview('fr',{...house,type:'condo',features:[]}).map(plain);
    expect(about).toContain('Condo à vendre à Montréal (LaSalle). Prix demandé : 1 059 000 $. La propriété offre 5 chambres');
    expect(about).not.toMatch(/affichée|construite/);
    const [land]=propertyOverview('fr',{id:'l',type:'land',city:'Sherbrooke',price:100000,lotArea:5000,outdoor:true,beds:null,baths:null,area:null}).map(plain);
    expect(land).toBe('Terrain à vendre à Sherbrooke. Prix demandé : 100 000 $. Le terrain mesure 5 000 pi². La propriété comprend un espace extérieur.');
  });
  it('spaces Chinese only around numbers and Latin words',()=>{
    const [about]=propertyOverview('zh',{...house,parkingSpaces:0,parking:false});
    expect(about).toContain('位于 Montréal (LaSalle) 的独立屋出售');
    expect(about).toContain('共有 5 间卧室');
    expect(about).toContain('配有户外空间。');
  });
  it('leaves out facts that are not published',()=>{
    const result=propertyOverview('en',{id:'r',type:'condo',transaction:'rent',city:'Laval',price:1500,beds:null,baths:null,area:null});
    expect(result).toEqual(['Condo for rent in Laval, for $1,500/month.']);
  });
});
