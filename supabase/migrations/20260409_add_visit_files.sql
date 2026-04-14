-- Adds file list support for visit attachments.
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-files',
  'visit-files',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Visit files: authenticated read" on storage.objects;
create policy "Visit files: authenticated read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'visit-files');

drop policy if exists "Visit files: authenticated upload" on storage.objects;
create policy "Visit files: authenticated upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'visit-files'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov')
);

drop policy if exists "Visit files: authenticated delete" on storage.objects;
create policy "Visit files: authenticated delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'visit-files');

-- Suggested object path format:
-- visits/{visit_id}/{timestamp}_{filename}
