-- Synthetic data only, loaded BEFORE the new migration.
insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status,listing_number) overriding system value values
('00000000-0000-5000-8000-000000000024',repeat('a',64),'{}','{"email":"private@example.test"}',array['private.jpg'],'published',100024),
('00000000-0000-5000-8000-000000000025',repeat('b',64),'{}','{}',array['private.jpg'],'published',100025);
insert into public.published_listings(id,property,photo_paths) values
('00000000-0000-5000-8000-000000000024','{"title":"Adresse non publiée","city":"Saint-Sauveur","price":4890000,"source":{"placeholder":true,"originalAddress":"DO NOT EXPOSE"}}',array['public.jpg']),
('00000000-0000-5000-8000-000000000025','{"title":"12 Test Street","city":"Québec","price":500000}',array['public.jpg']);
insert into public.enquiry_batches(id,first_attempt_at,lease_until) values('00000000-0000-4000-8000-000000000030',now(),now()-interval '1 minute');
insert into public.enquiries(id,payload,batch_id) values
('00000000-0000-4000-8000-000000000001','{"kind":"buyer","name":"Synthetic buyer","email":"buyer@example.test","listingReference":"100024","city":"Montréal","listingCity":"forged"}','00000000-0000-4000-8000-000000000030'),
('00000000-0000-4000-8000-000000000002','{"kind":"buyer","name":"Synthetic buyer","email":"buyer@example.test","listingReference":"999999"}',null);
create table public.test_original_enquiries as select id,payload,created_at,batch_id,review_status,deleted_at,revision from public.enquiries;
