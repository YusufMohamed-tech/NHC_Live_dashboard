-- =============================================
-- 1. ADD FILE_URLS to VISITS TABLE
-- =============================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visits'
      and column_name = 'file_urls'
      and data_type = 'jsonb'
  ) then
    alter table public.visits
      alter column file_urls type text[]
      using coalesce(array(select jsonb_array_elements_text(file_urls)), '{}');
  else
    alter table if exists public.visits
      add column if not exists file_urls text[] default '{}';
  end if;
end
$$;

-- =============================================
-- 2. MOVE STATIC DATA TO NEW TABLES
-- =============================================
-- Create Offices Table
CREATE TABLE if not exists public.offices (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  city text not null,
  type text default 'مكتب مبيعات',
  location text,
  status text default 'active'
);

-- Create Evaluation Criteria Table
CREATE TABLE if not exists public.evaluation_criteria (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  label text not null,
  weight numeric not null
);

-- Create Points Rules Table
CREATE TABLE if not exists public.points_rules (
  id uuid default gen_random_uuid() primary key,
  category text not null default 'visits',
  condition text not null,
  points integer not null
);

create unique index if not exists points_rules_category_condition_idx
on public.points_rules (category, condition);

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY CAREFULLY
-- =============================================
-- NOTE:
-- These policies keep current app compatibility (custom frontend auth).
-- For stricter production security, migrate to Supabase Auth and replace
-- anon write policies with role/owner-based checks.
alter table public.admins enable row level security;
alter table public.shoppers enable row level security;
alter table public.visits enable row level security;
alter table public.issues enable row level security;

drop policy if exists admins_read_all on public.admins;
drop policy if exists admins_insert_all on public.admins;
drop policy if exists admins_update_all on public.admins;
drop policy if exists admins_delete_all on public.admins;

create policy admins_read_all on public.admins
for select to anon, authenticated using (true);

create policy admins_insert_all on public.admins
for insert to anon, authenticated with check (true);

create policy admins_update_all on public.admins
for update to anon, authenticated using (true) with check (true);

create policy admins_delete_all on public.admins
for delete to anon, authenticated using (true);

drop policy if exists shoppers_read_all on public.shoppers;
drop policy if exists shoppers_insert_all on public.shoppers;
drop policy if exists shoppers_update_all on public.shoppers;
drop policy if exists shoppers_delete_all on public.shoppers;

create policy shoppers_read_all on public.shoppers
for select to anon, authenticated using (true);

create policy shoppers_insert_all on public.shoppers
for insert to anon, authenticated with check (true);

create policy shoppers_update_all on public.shoppers
for update to anon, authenticated using (true) with check (true);

create policy shoppers_delete_all on public.shoppers
for delete to anon, authenticated using (true);

drop policy if exists visits_read_all on public.visits;
drop policy if exists visits_insert_all on public.visits;
drop policy if exists visits_update_all on public.visits;
drop policy if exists visits_delete_all on public.visits;

create policy visits_read_all on public.visits
for select to anon, authenticated using (true);

create policy visits_insert_all on public.visits
for insert to anon, authenticated with check (true);

create policy visits_update_all on public.visits
for update to anon, authenticated using (true) with check (true);

create policy visits_delete_all on public.visits
for delete to anon, authenticated using (true);

drop policy if exists issues_read_all on public.issues;
drop policy if exists issues_insert_all on public.issues;
drop policy if exists issues_update_all on public.issues;
drop policy if exists issues_delete_all on public.issues;

create policy issues_read_all on public.issues
for select to anon, authenticated using (true);

create policy issues_insert_all on public.issues
for insert to anon, authenticated with check (true);

create policy issues_update_all on public.issues
for update to anon, authenticated using (true) with check (true);

create policy issues_delete_all on public.issues
for delete to anon, authenticated using (true);
