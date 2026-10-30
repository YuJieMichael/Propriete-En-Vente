-- Apply only after the 27 source photos are available on the production domain.
-- A one-time, guarded content reconciliation; not a schema migration.
begin;
set local lock_timeout = '5s';
do $sync$
declare
  plan jsonb := $payload${"date":"2026-10-30","broker":"Tian Shu Lu","brokerId":"e6356","activeSourceIds":["11078212","11097135","11203229","11809271","12076073","13197652","14236984","15067975","15566726","15603395","17908403","19078347","19192949","19489343","19869401","23484515","24397299","25164738","25586801","26059437","26679587","27396478","27483813","27905590","28004437","28358241","28391738","28725722","9788011"],"newListing":{"property":{"postal":"","beds":3,"baths":1,"area":null,"lotArea":5000,"parking":null,"parkingSpaces":null,"outdoor":null,"transaction":"sale","rentPrice":null,"taxExtra":false,"mode":"broker","type":"plex","title":"1694 - 1698, Rue Gustave-Désourdy","city":"Longueuil (Saint-Hubert)","district":"Laflèche","price":1395000,"descriptionTranslations":{"en":"Detached triplex built in 2016 in the Laflèche area of Saint-Hubert. The building comprises three 5½ apartments on a 5,000 sq. ft. lot (464.5 m²). The main unit is listed with five rooms, three bedrooms and one bathroom. Advertised potential gross annual revenue is $64,596; this is potential revenue, not verified net income. Occupancy is subject to the existing leases. Living area and parking capacity are not specified in the public listing.","fr":"Triplex détaché construit en 2016 dans le secteur Laflèche à Saint-Hubert. L’immeuble comprend trois logements de 5½ sur un terrain de 5 000 pi² (464,5 m²). L’unité principale est annoncée avec cinq pièces, trois chambres et une salle de bain. Les revenus bruts annuels potentiels annoncés sont de 64 596 $; il s’agit de revenus potentiels, et non d’un revenu net vérifié. Occupation selon les baux en vigueur. La superficie habitable et le nombre de stationnements ne sont pas précisés dans la fiche publique.","zh":"Saint-Hubert 的 Laflèche 区独立三户住宅，建于2016年。包含三套5½公寓，土地面积5,000平方英尺（464.5平方米）。挂牌所列主单元为五个房间、三间卧室及一间浴室。公布的潜在年租金总收入为64,596加元，属于潜在毛收入，并非已核实的净收入。交付须按现有租约安排；公开资料未注明居住面积及停车位数量。"},"features":[{"key":"year","label":{"en":"Year built","fr":"Construction","zh":"建造年份"},"value":{"en":"2016","fr":"2016","zh":"2016"}},{"key":"buildingStyle","label":{"en":"Building style","fr":"Style de bâtiment","zh":"建筑形式"},"value":{"en":"Detached triplex","fr":"Triplex détaché","zh":"独立三户住宅"}},{"key":"units","label":{"en":"Residential units","fr":"Unités résidentielles","zh":"住宅单元"},"value":{"en":"3 × 5½ apartments","fr":"3 logements de 5½","zh":"三套5½公寓"}},{"key":"mainUnit","label":{"en":"Main unit","fr":"Unité principale","zh":"主单元"},"value":{"en":"5 rooms, 3 bedrooms, 1 bathroom","fr":"5 pièces, 3 chambres, 1 salle de bain","zh":"五个房间、三卧一卫"}},{"key":"potentialGrossRevenue","label":{"en":"Potential gross annual revenue","fr":"Revenus bruts annuels potentiels","zh":"潜在年租金总收入"},"value":{"en":"$64,596, as advertised","fr":"64 596 $, selon la fiche","zh":"挂牌注明64,596加元"}},{"key":"occupancy","label":{"en":"Occupancy","fr":"Occupation","zh":"交付安排"},"value":{"en":"According to existing leases","fr":"Selon les baux en vigueur","zh":"按现有租约"}}],"coordinates":{"latitude":45.49974,"longitude":-73.471786,"source":"centris"},"source":{"provider":"centris","id":"17908403","url":"https://www.centris.ca/fr/triplex~a-vendre~longueuil-saint-hubert/17908403","importedAt":"2026-10-30","detailsUpdatedAt":"2026-10-30","verifiedAt":"2026-10-30","brokerId":"e6356","placeholder":false,"descriptionAvailable":true},"description":"Triplex détaché construit en 2016 dans le secteur Laflèche à Saint-Hubert. L’immeuble comprend trois logements de 5½ sur un terrain de 5 000 pi² (464,5 m²). L’unité principale est annoncée avec cinq pièces, trois chambres et une salle de bain. Les revenus bruts annuels potentiels annoncés sont de 64 596 $; il s’agit de revenus potentiels, et non d’un revenu net vérifié. Occupation selon les baux en vigueur. La superficie habitable et le nombre de stationnements ne sont pas précisés dans la fiche publique."},"photo_paths":["/centris/17908403/001.webp","/centris/17908403/002.webp","/centris/17908403/003.webp","/centris/17908403/004.webp","/centris/17908403/005.webp","/centris/17908403/006.webp","/centris/17908403/007.webp","/centris/17908403/008.webp","/centris/17908403/009.webp","/centris/17908403/010.webp","/centris/17908403/011.webp","/centris/17908403/012.webp","/centris/17908403/013.webp","/centris/17908403/014.webp","/centris/17908403/015.webp","/centris/17908403/016.webp","/centris/17908403/017.webp","/centris/17908403/018.webp","/centris/17908403/019.webp","/centris/17908403/020.webp","/centris/17908403/021.webp","/centris/17908403/022.webp","/centris/17908403/023.webp","/centris/17908403/024.webp","/centris/17908403/025.webp","/centris/17908403/026.webp","/centris/17908403/027.webp"],"id":"c8755043-fb59-4d75-bb9a-0edaa43501a5","fingerprint":"b4044031a4be3a3ffb2b2ceb45a1b162d2613de8772cc4d54a3838c217acbc6a"},"priceChanges":[{"id":"0e641c20-7af2-52f2-b0b8-de2361306df2","listingNumber":100029,"sourceId":"19078347","oldPrice":1059000,"newPrice":999950,"expectedRevision":3,"expectedPropertyMd5":"9c79f11828d03acd6b0a8c72d94fa04c"}],"withdrawn":[]}$payload$::jsonb;
  fresh jsonb := plan->'newListing';
  new_id uuid := (fresh->>'id')::uuid;
  price_id uuid := '0e641c20-7af2-52f2-b0b8-de2361306df2';
  oldrow public.listing_submissions;
  unchanged_before text;
  unchanged_after text;
  actual_ids jsonb;
  new_number bigint;
begin
  perform pg_advisory_xact_lock(hashtext('centris-e6356-sync'));
  if exists(select 1 from public.audit_events where action='centris_sync_completed' and metadata->>'sync_id'='2026-10-30-e6356') then
    raise exception 'This catalogue reconciliation already completed';
  end if;
  if exists(select 1 from public.listing_submissions where id=new_id or property#>>'{source,id}'='17908403') then
    raise exception 'New Centris listing already exists; reconcile instead of duplicating';
  end if;
  select * into oldrow from public.listing_submissions where id=price_id for update;
  if not found or oldrow.status<>'published' or oldrow.revision<>3
    or md5(oldrow.property::text)<>'9c79f11828d03acd6b0a8c72d94fa04c' then
    raise exception 'The price record changed since review';
  end if;
  perform 1 from public.published_listings where id=price_id for update;
  if (select md5(property::text) from public.published_listings where id=price_id) is distinct from '9c79f11828d03acd6b0a8c72d94fa04c' then
    raise exception 'The published price record changed since review';
  end if;
  select md5(string_agg(to_jsonb(p)::text,'|' order by id)) into unchanged_before
    from public.published_listings p where id<>price_id;
  update public.listing_submissions
    set property=jsonb_set(jsonb_set(property,'{price}','999950'::jsonb),'{source,priceUpdatedAt}','"2026-10-30"'::jsonb),
        revision=revision+1,
        review_note=concat_ws(E'\n',review_note,'Centris catalogue sync 2026-10-30: asking price reduced from CAD 1,059,000 to CAD 999,950; other facts retained.')
    where id=price_id;
  update public.published_listings
    set property=jsonb_set(jsonb_set(property,'{price}','999950'::jsonb),'{source,priceUpdatedAt}','"2026-10-30"'::jsonb)
    where id=price_id;
  if (select property from public.listing_submissions where id=price_id) is distinct from
     (select property from public.published_listings where id=price_id) then
    raise exception 'Submission and publication differ';
  end if;
  insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status,revision,review_note)
    values(new_id,fresh->>'fingerprint',fresh->'property','{}',
      array(select jsonb_array_elements_text(fresh->'photo_paths')),'published',1,
      'Centris catalogue sync 2026-10-30, broker e6356. Public source details and 27 photographs verified.');
  insert into public.published_listings(id,property,photo_paths)
    values(new_id,fresh->'property',array(select jsonb_array_elements_text(fresh->'photo_paths')));
  select listing_number into new_number from public.published_listings where id=new_id;
  if new_number is null or (select count(*) from public.published_listings where listing_number=new_number)<>1 then
    raise exception 'New public reference missing or duplicated';
  end if;
  select jsonb_agg(property#>>'{source,id}' order by property#>>'{source,id}') into actual_ids
    from public.published_listings where property#>>'{source,provider}'='centris';
  if actual_ids is distinct from plan->'activeSourceIds' then
    raise exception 'Published Centris catalogue does not match the 29 verified active IDs';
  end if;
  select md5(string_agg(to_jsonb(p)::text,'|' order by id)) into unchanged_after
    from public.published_listings p where id not in (price_id,new_id);
  if unchanged_before is distinct from unchanged_after then
    raise exception 'An unrelated published listing changed';
  end if;
  insert into public.audit_events(action,metadata) values
    ('listing_published',jsonb_build_object('actor_label','Authorized Centris catalogue sync','listing_id',new_id,'listing_number',new_number,'title',fresh#>>'{property,title}','source_id','17908403','note','Centris catalogue reconciliation 2026-10-30; 27 verified source photos')),
    ('listing_price_updated',jsonb_build_object('actor_label','Authorized Centris catalogue sync','listing_id',price_id,'listing_number',100029,'source_id','19078347','previous_price',1059000,'price',999950,'revision',oldrow.revision+1)),
    ('centris_sync_completed',jsonb_build_object('sync_id','2026-10-30-e6356','active',29,'new',1,'price_updated',1,'withdrawn',0,'unchanged',27,'active_source_ids',actual_ids,'untouched_rows_md5',unchanged_after));
end $sync$;
select listing_number,property#>>'{source,id}' as source_id,property->>'price' as price,cardinality(photo_paths) as photos
  from public.published_listings where property#>>'{source,id}' in ('17908403','19078347') order by listing_number;
commit;
