-- Remove visit attachment feature from schema and storage.

alter table if exists public.visits
  drop column if exists file_urls;

delete from public.points_rules
where category = 'visits'
  and condition in ('رفع صورة', 'رفع فيديو');

drop policy if exists "Visit files: authenticated read" on storage.objects;
drop policy if exists "Visit files: authenticated upload" on storage.objects;
drop policy if exists "Visit files: authenticated delete" on storage.objects;

-- Direct deletion from storage.objects is blocked by Supabase SQL policies.
-- Try deleting the bucket only if allowed and empty; otherwise keep artifacts orphan-safe.
do $$
begin
  begin
    delete from storage.buckets where id = 'visit-files';
  exception
    when others then
      null;
  end;
end
$$;
