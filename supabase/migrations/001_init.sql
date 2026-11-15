-- Step 1 Companion: full database setup.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run once.
-- Every table is locked by row-level security: you only ever see your own rows.
-- Guests never read tables directly; they call get_supporter_summary(), which returns
-- only the fields the owner switched on.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'learner' check (role in ('learner','supporter')),
  display_name text not null default '',
  cat_name text not null default 'Mochi' check (char_length(cat_name) <= 30),
  exam_date date,
  exam_confirmed boolean not null default false,
  daily_hours int not null default 8 check (daily_hours between 0 and 16),
  qbank_start int not null default 2600 check (qbank_start between 0 and 10000),
  track_mode text not null default 'percent' check (track_mode in ('percent','pages')),
  water_goal_ml int check (water_goal_ml is null or water_goal_ml between 500 and 6000),
  chat_level text not null default 'normal' check (chat_level in ('quiet','normal')),
  ai_enabled boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile delete" on public.profiles for delete to authenticated using (user_id = auth.uid());

-- ---------- study plan ----------
create table if not exists public.study_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  mode text not null check (mode in ('BOOK','QUESTION','NBME','NBME REVIEW','RECOVERY','FREE 120','FREE 120 REVIEW','TAPER','EXAM')),
  topic text not null default '',
  instructions text not null default '',
  book_subject text,
  book_target_pct int,
  q_core int not null default 0,
  q_stretch int not null default 0,
  locked boolean not null default false,
  rest_protected boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  unique (owner_id, day)
);
alter table public.study_days enable row level security;
create policy "own days" on public.study_days for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text not null default '',
  snapshot jsonb not null
);
alter table public.plan_versions enable row level security;
create policy "own versions read" on public.plan_versions for select to authenticated using (owner_id = auth.uid());
create policy "own versions add" on public.plan_versions for insert to authenticated with check (owner_id = auth.uid());

-- ---------- event log (source of truth for all progress) ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  local_date date not null,
  kind text not null check (kind in ('checkin','rest','step','book','qblock','qreview','water','pet','focus','note_review','assessment','wrap')),
  payload jsonb not null default '{}'::jsonb,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, client_request_id)
);
create index if not exists events_owner_date on public.events (owner_id, local_date);
alter table public.events enable row level security;
create policy "own events read" on public.events for select to authenticated using (owner_id = auth.uid());
create policy "own events add" on public.events for insert to authenticated with check (owner_id = auth.uid());
create policy "own events correct" on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own events delete" on public.events for delete to authenticated using (owner_id = auth.uid());

-- ---------- mistake notes ----------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  subject text, why text, source text,
  created_at timestamptz not null default now(),
  due_date date not null default current_date,
  step int not null default 0,
  archived boolean not null default false
);
alter table public.notes enable row level security;
create policy "own notes" on public.notes for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- sharing ----------
create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invite_email text not null check (invite_email = lower(invite_email)),
  supporter_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  permissions jsonb not null default '{"plan":true,"days":true,"topics":true,"mochi":true,"countdown":true,"cheers":true}'::jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id, invite_email)
);
alter table public.grants enable row level security;
create policy "owner manages grants" on public.grants for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "supporter sees own grant" on public.grants for select to authenticated using (supporter_id = auth.uid());

-- Owner-written summary containing ONLY shareable fields. No direct reads by anyone else.
create table if not exists public.public_summary (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.public_summary enable row level security;
create policy "owner writes summary" on public.public_summary for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_id uuid references auth.users(id) on delete set null,
  from_name text not null default '',
  message text not null,
  created_at timestamptz not null default now(),
  seen boolean not null default false
);
alter table public.cheers enable row level security;
create policy "owner reads cheers" on public.cheers for select to authenticated using (owner_id = auth.uid());
create policy "owner marks cheers" on public.cheers for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes cheers" on public.cheers for delete to authenticated using (owner_id = auth.uid());

-- Ask Dr. Mochi daily counter (written by the edge function only).
create table if not exists public.ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (owner_id, day)
);
alter table public.ai_usage enable row level security;
create policy "owner reads usage" on public.ai_usage for select to authenticated using (owner_id = auth.uid());

-- ---------- functions for guests ----------
-- Turns pending invites for my (verified) email into active access.
create or replace function public.claim_invites() returns int
language plpgsql security definer set search_path = public as $$
declare my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or my_email = '' then return 0; end if;
  update grants set supporter_id = auth.uid(), status = 'active'
   where invite_email = my_email and status = 'pending' and owner_id <> auth.uid();
  return (select count(*) from grants where supporter_id = auth.uid() and status = 'active');
end $$;

create or replace function public.my_owners() returns table (owner_id uuid, name text)
language sql security definer set search_path = public stable as $$
  select g.owner_id, coalesce(nullif(p.display_name, ''), 'Your friend')
    from grants g left join profiles p on p.user_id = g.owner_id
   where g.supporter_id = auth.uid() and g.status = 'active';
$$;

-- Returns only allowed fields. Re-checks the grant on every call, so revoking is instant.
create or replace function public.get_supporter_summary(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare perm jsonb; d jsonb; out jsonb;
begin
  select permissions into perm from grants
   where owner_id = p_owner and supporter_id = auth.uid() and status = 'active';
  if perm is null then raise exception 'not allowed'; end if;
  select data into d from public_summary where owner_id = p_owner;
  d := coalesce(d, '{}'::jsonb);
  out := jsonb_build_object('name', d -> 'name', 'cat_name', d -> 'cat_name', 'updated_at', d -> 'updated_at',
                            'cheers', coalesce((perm ->> 'cheers')::boolean, false));
  if (perm ->> 'plan')::boolean then out := out || jsonb_build_object('plan', d -> 'plan'); end if;
  if (perm ->> 'days')::boolean then out := out || jsonb_build_object('days', d -> 'days'); end if;
  if (perm ->> 'topics')::boolean then out := out || jsonb_build_object('topics', d -> 'topics'); end if;
  if (perm ->> 'mochi')::boolean then out := out || jsonb_build_object('mochi', d -> 'mochi'); end if;
  if (perm ->> 'countdown')::boolean then out := out || jsonb_build_object('countdown', d -> 'countdown'); end if;
  return out;
end $$;

create or replace function public.send_cheer(p_owner uuid, p_message text, p_from_name text) returns void
language plpgsql security definer set search_path = public as $$
declare perm jsonb;
begin
  select permissions into perm from grants
   where owner_id = p_owner and supporter_id = auth.uid() and status = 'active';
  if perm is null or not coalesce((perm ->> 'cheers')::boolean, false) then raise exception 'not allowed'; end if;
  if p_message not in ('Proud of you', 'You''ve got this', 'Drink some water', 'Take a break', 'Thinking of you') then
    raise exception 'unknown cheer';
  end if;
  if (select count(*) from cheers where from_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many cheers today';
  end if;
  insert into cheers (owner_id, from_id, from_name, message) values (p_owner, auth.uid(), left(coalesce(p_from_name, ''), 40), p_message);
end $$;

-- Owner wipes all their study data (the login itself is removed from the Supabase dashboard).
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from events where owner_id = auth.uid();
  delete from notes where owner_id = auth.uid();
  delete from study_days where owner_id = auth.uid();
  delete from plan_versions where owner_id = auth.uid();
  delete from grants where owner_id = auth.uid();
  delete from cheers where owner_id = auth.uid();
  delete from public_summary where owner_id = auth.uid();
  delete from ai_usage where owner_id = auth.uid();
  delete from profiles where user_id = auth.uid();
end $$;

revoke all on function public.claim_invites, public.my_owners, public.get_supporter_summary(uuid),
  public.send_cheer(uuid, text, text), public.delete_my_data from public, anon;
grant execute on function public.claim_invites, public.my_owners, public.get_supporter_summary(uuid),
  public.send_cheer(uuid, text, text), public.delete_my_data to authenticated;

-- Table privileges (row-level security above still decides which rows).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.study_days, public.events, public.notes,
  public.grants, public.public_summary to authenticated;
grant select, insert on public.plan_versions to authenticated;
grant select, update, delete on public.cheers to authenticated;
grant select on public.ai_usage to authenticated;
revoke all on all tables in schema public from anon;
