set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"azka@x.com"}',false);
insert into profiles(user_id,display_name) values ('11111111-1111-1111-1111-111111111111','Azka');
insert into study_days(day,mode,topic,locked) values ('2026-11-16','QUESTION','A',false),('2026-11-17','NBME','B',true),('2026-11-18','BOOK','C',false);
insert into plan_versions(reason,snapshot) select 'v1', jsonb_agg(to_jsonb(s)) from study_days s;
select 'shift +1', shift_days('2026-11-17', 1);
select string_agg(day||':'||topic, ' ' order by day) from study_days;
delete from study_days where day='2026-11-17'; select shift_days('2026-11-18', -1);
select 'after remove', string_agg(day||':'||topic, ' ' order by day) from study_days;
select 'restore', restore_plan((select id from plan_versions limit 1));
select string_agg(day||':'||topic, ' ' order by day) from study_days;
insert into grants(label) values ('Mum') returning 'code', invite_code;
-- mum signs up with any email; email match must NOT grant access
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"mum@x.com"}',false);
select 'claim by email (expect 0)', claim_invites();
select 'wrong code', claim_invite_code('nope');
select 'right code', claim_invite_code((select invite_code from grants limit 1));
