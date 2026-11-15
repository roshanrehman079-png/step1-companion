\set ON_ERROR_STOP 0
set role authenticated;
-- Azka
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"azka@x.com"}',false);
insert into profiles(user_id,display_name) values ('11111111-1111-1111-1111-111111111111','Azka');
insert into events(client_request_id,local_date,kind,payload) values ('aaaaaaaa-0000-0000-0000-000000000001','2026-11-20','checkin','{"mood":"okay"}');
insert into events(client_request_id,local_date,kind,payload) values ('aaaaaaaa-0000-0000-0000-000000000001','2026-11-20','checkin','{"mood":"okay"}'); -- duplicate: must fail
insert into grants(invite_email,permissions) values ('mum@x.com','{"plan":true,"days":true,"topics":false,"mochi":true,"countdown":true,"cheers":true}');
insert into public_summary(data) values ('{"name":"Azka","cat_name":"Dr. Mochi","plan":[1],"topics":["secret-ish"],"days":{"studied":5}}');
select 'azka events', count(*) from events;
-- Mum before claiming
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"mum@x.com"}',false);
select 'mum events (expect 0)', count(*) from events;
select get_supporter_summary('11111111-1111-1111-1111-111111111111'); -- expect error: not allowed
select 'claimed', claim_invites();
select 'summary', get_supporter_summary('11111111-1111-1111-1111-111111111111');
insert into events(owner_id,client_request_id,local_date,kind) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','2026-11-20','water'); -- must fail
select 'mum profiles visible (expect 0)', count(*) from profiles;
select send_cheer('11111111-1111-1111-1111-111111111111','Proud of you','Mum');
select send_cheer('11111111-1111-1111-1111-111111111111','free text attack','Mum'); -- must fail
select 'mum reads public_summary directly (expect 0)', count(*) from public_summary;
-- stranger
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","email":"stranger@x.com"}',false);
select claim_invites();
select get_supporter_summary('11111111-1111-1111-1111-111111111111'); -- must fail
-- Azka revokes
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"azka@x.com"}',false);
select 'cheers for azka', count(*) from cheers;
update grants set status='revoked', revoked_at=now();
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"mum@x.com"}',false);
select get_supporter_summary('11111111-1111-1111-1111-111111111111'); -- must fail after revoke
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"azka@x.com"}',false);
select delete_my_data(); select 'after delete', (select count(*) from events)+(select count(*) from profiles);
