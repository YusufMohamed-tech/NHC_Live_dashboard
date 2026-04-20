-- 2026-04-20: Add audio mime-types to the visit-files bucket and ensure visits.file_urls exists

-- Ensure visits.file_urls column exists
alter table if exists public.visits
  add column if not exists file_urls text[] default '{}';

-- Expand allowed mime types for the visit-files storage bucket to include common audio formats
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp',
  'video/mp4','video/quicktime',
  'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/webm'
]
where id = 'visit-files';

-- Recreate the upload policy so audio extensions are allowed
drop policy if exists "Visit files: authenticated upload" on storage.objects;
create policy "Visit files: authenticated upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'visit-files'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','mp4','mov','mp3','wav','m4a','webm')
);
