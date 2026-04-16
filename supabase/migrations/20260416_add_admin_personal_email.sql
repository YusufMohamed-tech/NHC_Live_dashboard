-- Add personal notification email for all admin roles (superadmin/admin/ops).
alter table if exists public.admins
  add column if not exists personal_email text;

-- Optional backfill from legacy column names if present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admins' and column_name = 'secondary_email'
  ) then
    execute '
      update public.admins
      set personal_email = coalesce(nullif(personal_email, ''''), nullif(secondary_email, ''''))
      where coalesce(personal_email, '''') = ''''
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admins' and column_name = 'email_personal'
  ) then
    execute '
      update public.admins
      set personal_email = coalesce(nullif(personal_email, ''''), nullif(email_personal, ''''))
      where coalesce(personal_email, '''') = ''''
    ';
  end if;
end
$$;

-- Set default superadmin personal notification email when still empty.
update public.admins
set personal_email = 'yusufmohamedyak55@gmail.com'
where role = 'superadmin'
  and lower(coalesce(email, '')) in ('superadmin@nhc.sa', 'yusufmohamedyak55@gmail.com')
  and coalesce(personal_email, '') = '';

-- Backfill any remaining empty admin personal emails from login email.
update public.admins
set personal_email = nullif(email, '')
where coalesce(personal_email, '') = ''
  and coalesce(email, '') <> '';

-- Ensure shoppers also have a personal email target (fallback to login email).
update public.shoppers
set personal_email = nullif(email, '')
where coalesce(personal_email, '') = ''
  and coalesce(email, '') <> '';
