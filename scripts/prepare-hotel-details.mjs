import {readFile, writeFile} from 'node:fs/promises';

// Prepare a reviewable transaction; this script never connects to the database.
const changes = JSON.parse(await readFile(new URL('../data/hotel-details-20261028.json', import.meta.url), 'utf8'));
const mode = process.argv[2] || 'dry-run';
if (!['dry-run', 'apply'].includes(mode)) throw Error('Use dry-run or apply');
if (changes.length !== 5 || new Set(changes.map(item => item.id)).size !== 5) throw Error('Expected five distinct listings');
const payload = JSON.stringify(changes);
if (payload.includes('$payload$')) throw Error('Unsafe SQL delimiter in payload');
const sql = `begin;
set local lock_timeout='5s';
do $review$
declare
  changes jsonb := $payload$${payload}$payload$::jsonb;
  item jsonb;
  oldrow public.listing_submissions;
  public_property jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('centris-e6356-sync'));
  for item in select value from jsonb_array_elements(changes) loop
    select * into strict oldrow from public.listing_submissions
      where id=(item->>'id')::uuid for update;
    select property into strict public_property from public.published_listings
      where id=oldrow.id for update;
    if oldrow.status<>'published'
      or oldrow.listing_number<>(item->>'listing_number')::bigint
      or oldrow.revision<>(item->>'revision')::integer
      or (oldrow.property->>'type') is distinct from 'hotel-motel'
      or (oldrow.property#>>'{source,id}') is distinct from (item->>'sourceId')
      or not (oldrow.property @> (item->'before'))
      or public_property is distinct from oldrow.property then
      raise exception 'Listing % changed since hotel review',item->>'listing_number';
    end if;
    update public.listing_submissions
      set property=oldrow.property || (item->'after'),revision=revision+1
      where id=oldrow.id;
    update public.published_listings
      set property=oldrow.property || (item->'after') where id=oldrow.id;
    insert into public.audit_events(action,metadata) values('listing_published',jsonb_build_object(
      'actor_label','Hotel listing content update',
      'listing_id',oldrow.id,'listing_number',oldrow.listing_number,
      'title',oldrow.property->>'title','revision',oldrow.revision+1,
      'note','Hotel details checked against Centris and broker listings on 2026-10-28',
      'sources',item->'sources','before',item->'before','after',item->'after'));
  end loop;
end $review$;
select p.listing_number,s.revision,p.property->>'description' as description,
  p.property is not distinct from s.property as synchronized
from public.published_listings p join public.listing_submissions s using(id)
where p.listing_number in (100013,100021,100024,100028,100030)
order by p.listing_number;
${mode === 'apply' ? 'commit' : 'rollback'};
`;
const output = process.argv[3] || `hotel-details-${mode}.sql`;
await writeFile(output, sql);
console.log(`Prepared ${output}; ${mode === 'apply' ? 'COMMIT' : 'ROLLBACK'} transaction, not executed.`);
