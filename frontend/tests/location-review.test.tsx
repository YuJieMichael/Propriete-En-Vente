// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import changes from '../../data/location-review-20261027.json';
import {parseImportedProperty} from '../src/lib/imported-listings';
import {PropertyLocation,propertyMapLinks} from '../src/property-location';

it('uses the independently checked Wilfrid-Reid address and preserves coordinate provenance',()=>{
 const item=parseImportedProperty(changes.find(r=>r.listing_number===100006)!.after);
 expect(item.coordinates).toEqual({latitude:45.5177577,longitude:-73.7121432,source:'google-maps'});
 const html=renderToStaticMarkup(<PropertyLocation item={item} lang="fr"/>);
 expect(html).toContain('45.5177577%2C-73.7121432');
 expect(html).not.toContain('45.51891143');
 expect(propertyMapLinks(item).apple).toContain('45.5177577%2C-73.7121432');
});

it.each(['en','fr','zh'] as const)('keeps approximate land navigation on the source pin and warns about subdivision in %s',lang=>{
 const item=parseImportedProperty(changes.find(r=>r.listing_number===100012)!.after);
 const html=renderToStaticMarkup(<PropertyLocation item={item} lang={lang}/>);
 expect(html).toContain('<iframe');
 expect(html).toContain({en:'Approximate location only',fr:'Emplacement indicatif uniquement',zh:'地图位置仅供参考'}[lang]);
 expect(new URL(propertyMapLinks(item).google).searchParams.get('query')).toBe('45.43167027,-71.8675206');
});

it.each(['en','fr','zh'] as const)('withholds the unverified Mulets address and map in %s',lang=>{
 const data=changes.find(r=>r.listing_number===100013)!.after;
 const item=parseImportedProperty(data);
 expect(item.title).not.toContain('11111');
 expect(item.coordinates).toBeUndefined();
 const html=renderToStaticMarkup(<PropertyLocation item={item} lang={lang}/>);
 expect(html).not.toContain('<iframe');expect(html).not.toContain('maps?');
 expect(html).toContain({en:'requires confirmation',fr:'reste à confirmer',zh:'具体地址待经纪核实'}[lang]);
 // Even malformed imported data cannot accidentally expose its retained source pin.
 expect(()=>parseImportedProperty({...data,coordinates:data.source.originalCoordinates})).toThrow();
});
