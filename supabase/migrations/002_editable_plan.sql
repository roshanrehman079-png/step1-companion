-- Update 2: editable plan with times, ticks and backlog; invite links instead of emails.
-- Paste into Supabase > SQL Editor > Run (after 001 has been run). Safe to run more than once.

-- Each day can hold its own task list (null = use the built-in template) and its own start time.
alter table public.study_days add column if not exists tasks jsonb;
alter table public.study_days add column if not exists start_time text check (start_time is null or start_time ~ '^\d{2}:\d{2}$');
alter table public.profiles add column if not exists day_start text not null default '08:00' check (day_start ~ '^\d{2}:\d{2}$');

-- Invites by private link/code (works without any email service).
alter table public.grants add column if not exists label text not null default '';
alter table public.grants add column if not exists invite_code text;
update public.grants set invite_code = encode(gen_random_bytes(6), 'hex') where invite_code is null;
alter table public.grants alter column invite_code set default encode(gen_random_bytes(6), 'hex');
alter table public.grants alter column invite_code set not null;
alter table public.grants alter column invite_email drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'grants_invite_code_key') then
    alter table public.grants add constraint grants_invite_code_key unique (invite_code);
  end if;
end $$;

-- Email matching is switched off: only someone holding the private code can join.
create or replace function public.claim_invites() returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from grants where supporter_id = auth.uid() and status = 'active';
$$;

create or replace function public.claim_invite_code(p_code text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  update grants set supporter_id = auth.uid(), status = 'active'
   where invite_code = lower(trim(p_code)) and status = 'pending' and supporter_id is null and owner_id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

-- Move every day from p_from onwards by p_delta days (used to add or remove a day).
create or replace function public.shift_days(p_from date, p_delta int) returns int
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_delta = 0 then return 0; end if;
  update study_days set day = day + 100000 where owner_id = auth.uid() and day >= p_from;
  update study_days set day = day - 100000 + p_delta where owner_id = auth.uid() and day >= p_from + 100000;
  get diagnostics n = row_count;
  return n;
end $$;

-- Put the whole plan back exactly as a saved version (adds and removes days as needed).
create or replace function public.restore_plan(p_version uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare snap jsonb; n int;
begin
  select snapshot into snap from plan_versions where id = p_version and owner_id = auth.uid();
  if snap is null then raise exception 'version not found'; end if;
  delete from study_days where owner_id = auth.uid();
  insert into study_days (owner_id, day, mode, topic, instructions, book_subject, book_target_pct, q_core, q_stretch, locked, rest_protected, extra, tasks, start_time)
  select auth.uid(), r.day, r.mode, r.topic, r.instructions, r.book_subject, r.book_target_pct, r.q_core, r.q_stretch, r.locked, r.rest_protected,
         coalesce(r.extra, '{}'::jsonb), r.tasks, r.start_time
    from jsonb_populate_recordset(null::study_days, snap) r;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.claim_invite_code(text), public.shift_days(date, int), public.restore_plan(uuid) from public, anon;
grant execute on function public.claim_invite_code(text), public.shift_days(date, int), public.restore_plan(uuid) to authenticated;

-- Guests with "plan" access also see what's pending and the list of plan changes.
create or replace function public.get_supporter_summary(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare perm jsonb; d jsonb; out jsonb;
begin
  select permissions into perm from grants
   where owner_id = p_owner and supporter_id = auth.uid() and status = 'active';
  if perm is null then raise exception 'not allowed'; end if;
  select data into d from public_summary where owner_id = p_owner;
  d := coalesce(d, '{}'::jsonb);
  out := jsonb_build_object('name', d -> 'name', 'cat_name', d -> 'cat_name', 'updated_at', d -> 'updated_at', 'today', d -> 'today',
                            'cheers', coalesce((perm ->> 'cheers')::boolean, false));
  if (perm ->> 'plan')::boolean then out := out || jsonb_build_object('plan', d -> 'plan', 'pending', d -> 'pending', 'changes', d -> 'changes'); end if;
  if (perm ->> 'days')::boolean then out := out || jsonb_build_object('days', d -> 'days'); end if;
  if (perm ->> 'topics')::boolean then out := out || jsonb_build_object('topics', d -> 'topics'); end if;
  if (perm ->> 'mochi')::boolean then out := out || jsonb_build_object('mochi', d -> 'mochi'); end if;
  if (perm ->> 'countdown')::boolean then out := out || jsonb_build_object('countdown', d -> 'countdown'); end if;
  return out;
end $$;
