-- =====================================================
-- Connect new app changes to DB schema
-- 1) shoppers: add phone columns used by frontend
-- 2) admins.role: allow ops role
-- 3) visits.status: allow "جاري المسح" status
-- =====================================================

-- -----------------------------------------------------
-- 1) SHOPPERS PHONE COLUMNS
-- -----------------------------------------------------
alter table if exists public.shoppers
  add column if not exists primary_phone text,
  add column if not exists whatsapp_phone text;

-- Backfill from potential legacy columns if they exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'phone_primary'
  ) then
    execute '
      update public.shoppers
      set primary_phone = coalesce(nullif(primary_phone, ''''), nullif(phone_primary, ''''))
      where coalesce(primary_phone, '''') = ''''
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'phone'
  ) then
    execute '
      update public.shoppers
      set primary_phone = coalesce(nullif(primary_phone, ''''), nullif(phone, ''''))
      where coalesce(primary_phone, '''') = ''''
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'phone_whatsapp'
  ) then
    execute '
      update public.shoppers
      set whatsapp_phone = coalesce(nullif(whatsapp_phone, ''''), nullif(phone_whatsapp, ''''))
      where coalesce(whatsapp_phone, '''') = ''''
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'whatsapp'
  ) then
    execute '
      update public.shoppers
      set whatsapp_phone = coalesce(nullif(whatsapp_phone, ''''), nullif(whatsapp, ''''))
      where coalesce(whatsapp_phone, '''') = ''''
    ';
  end if;
end
$$;

-- -----------------------------------------------------
-- 2) ADMINS ROLE SUPPORT (ops)
-- -----------------------------------------------------
do $$
declare
  role_udt_schema text;
  role_udt_name text;
  role_check record;
begin
  select c.udt_schema, c.udt_name
    into role_udt_schema, role_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'admins'
    and c.column_name = 'role';

  if role_udt_name is null then
    return;
  end if;

  -- If role column uses enum type, add 'ops' to enum.
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = role_udt_schema
      and t.typname = role_udt_name
      and t.typtype = 'e'
  ) then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = role_udt_schema
        and t.typname = role_udt_name
        and e.enumlabel = 'ops'
    ) then
      execute format('alter type %I.%I add value ''ops''', role_udt_schema, role_udt_name);
    end if;
  end if;

  -- Replace restrictive CHECK constraints on admins.role (if any).
  for role_check in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'admins'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
      and pg_get_constraintdef(con.oid) ilike '%admin%'
      and pg_get_constraintdef(con.oid) ilike '%superadmin%'
  loop
    execute format('alter table public.admins drop constraint %I', role_check.conname);
  end loop;

  begin
    alter table public.admins
      add constraint admins_role_check
      check (role is null or role in ('admin', 'superadmin', 'ops'));
  exception
    when duplicate_object then
      null;
  end;
end
$$;

-- -----------------------------------------------------
-- 3) VISITS STATUS SUPPORT ("جاري المسح")
-- -----------------------------------------------------
do $$
declare
  status_udt_schema text;
  status_udt_name text;
  status_check record;
begin
  select c.udt_schema, c.udt_name
    into status_udt_schema, status_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'visits'
    and c.column_name = 'status';

  if status_udt_name is null then
    return;
  end if;

  -- If status column uses enum type, add pending-delete status.
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = status_udt_schema
      and t.typname = status_udt_name
      and t.typtype = 'e'
  ) then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = status_udt_schema
        and t.typname = status_udt_name
        and e.enumlabel = 'جاري المسح'
    ) then
      execute format('alter type %I.%I add value ''جاري المسح''', status_udt_schema, status_udt_name);
    end if;
  end if;

  -- Replace restrictive CHECK constraints on visits.status (if any).
  for status_check in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'visits'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
      and (
        pg_get_constraintdef(con.oid) ilike '%معلقة%'
        or pg_get_constraintdef(con.oid) ilike '%قادمة%'
        or pg_get_constraintdef(con.oid) ilike '%مكتملة%'
      )
  loop
    execute format('alter table public.visits drop constraint %I', status_check.conname);
  end loop;

  begin
    alter table public.visits
      add constraint visits_status_check
      check (status is null or status in ('معلقة', 'قادمة', 'مكتملة', 'جاري المسح'));
  exception
    when duplicate_object then
      null;
  end;
end
$$;
