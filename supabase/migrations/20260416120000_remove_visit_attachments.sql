-- Remove visit attachment feature from schema and storage.

alter table if exists public.visits
  drop column if exists file_urls;

delete from public.points_rules
where category = 'visits'
  and condition in ('رفع صورة', 'رفع فيديو');

drop policy if exists "Visit files: authenticated read" on storage.objects;
drop policy if exists "Visit files: authenticated upload" on storage.objects;
drop policy if exists "Visit files: authenticated delete" on storage.objects;

delete from storage.objects where bucket_id = 'visit-files';
delete from storage.buckets where id = 'visit-files';
