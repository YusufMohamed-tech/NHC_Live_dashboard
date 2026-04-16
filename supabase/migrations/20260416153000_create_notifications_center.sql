-- In-app notification center storage for all roles.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_role text not null,
  recipient_user_id text,
  recipient_email text,
  title text not null,
  description text not null,
  event_type text not null,
  visit_id uuid references public.visits(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications
  drop constraint if exists notifications_recipient_role_check;

alter table public.notifications
  add constraint notifications_recipient_role_check
  check (recipient_role in ('superadmin', 'admin', 'ops', 'shopper'));

create index if not exists notifications_recipient_lookup_idx
on public.notifications (recipient_role, recipient_user_id, created_at desc);

create index if not exists notifications_created_at_idx
on public.notifications (created_at desc);

create index if not exists notifications_unread_lookup_idx
on public.notifications (recipient_role, recipient_user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_all on public.notifications;
create policy notifications_read_all on public.notifications
for select to anon, authenticated using (true);

drop policy if exists notifications_insert_all on public.notifications;
create policy notifications_insert_all on public.notifications
for insert to anon, authenticated with check (true);

drop policy if exists notifications_update_all on public.notifications;
create policy notifications_update_all on public.notifications
for update to anon, authenticated using (true) with check (true);

drop policy if exists notifications_delete_all on public.notifications;
create policy notifications_delete_all on public.notifications
for delete to anon, authenticated using (true);
