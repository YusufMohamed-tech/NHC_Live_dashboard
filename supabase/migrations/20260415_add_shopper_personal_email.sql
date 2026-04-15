-- Add shopper personal email used by admin management forms.
alter table if exists public.shoppers
  add column if not exists personal_email text;

-- Optional backfill from legacy column names if present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'secondary_email'
  ) then
    execute '
      update public.shoppers
      set personal_email = coalesce(nullif(personal_email, ''''), nullif(secondary_email, ''''))
      where coalesce(personal_email, '''') = ''''
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shoppers' and column_name = 'email_personal'
  ) then
    execute '
      update public.shoppers
      set personal_email = coalesce(nullif(personal_email, ''''), nullif(email_personal, ''''))
      where coalesce(personal_email, '''') = ''''
    ';
  end if;
end
$$;
