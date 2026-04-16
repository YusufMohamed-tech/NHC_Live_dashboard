-- =============================================
-- 1. SETUP STORAGE BUCKET FOR FILE URLS
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
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
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Visit files: authenticated read" ON storage.objects;
CREATE POLICY "Visit files: authenticated read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'visit-files');

DROP POLICY IF EXISTS "Visit files: authenticated upload" ON storage.objects;
CREATE POLICY "Visit files: authenticated upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'visit-files'
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov')
);

DROP POLICY IF EXISTS "Visit files: authenticated delete" ON storage.objects;
CREATE POLICY "Visit files: authenticated delete"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'visit-files');

-- =============================================
-- 2. SEED STATIC DATA (EVALUATION CRITERIA)
-- =============================================
INSERT INTO public.evaluation_criteria (key, label, weight) VALUES
  ('criterion1', 'الاستقبال والمظهر الخارجي', 0.1),
  ('criterion2', 'السلوك والاحترافية', 0.2),
  ('criterion3', 'المعرفة بالمنتج العقاري', 0.2),
  ('criterion4', 'العرض المالي وإجراءات البيع', 0.15),
  ('criterion5', 'تجربة العرض (الوحدة النموذجية)', 0.15),
  ('criterion6', 'المتابعة بعد الزيارة', 0.1),
  ('criterion7', 'الالتزام والامتثال', 0.1)
ON CONFLICT (key) DO UPDATE SET label = excluded.label, weight = excluded.weight;

-- =============================================
-- 3. ADAPT AND SEED POINTS RULES
-- =============================================
ALTER TABLE if exists public.points_rules
  ADD COLUMN if not exists category text default 'visits';

ALTER TABLE if exists public.points_rules
  ALTER COLUMN category SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS points_rules_category_condition_idx
ON public.points_rules (category, condition);

INSERT INTO public.points_rules (category, condition, points) VALUES
  -- Visits
  ('visits', 'إكمال الزيارة', 50),
  ('visits', 'رفع صورة', 5),
  ('visits', 'رفع فيديو', 10),
  -- Issues
  ('issues', 'مشكلة بسيطة', 15),
  ('issues', 'مشكلة متوسطة', 30),
  ('issues', 'مشكلة خطيرة', 50),
  -- Quality
  ('quality', 'تقرير شامل', 25),
  ('quality', 'سرعة الإكمال', 15),
  ('quality', 'دقة المعلومات', 20),
  -- Achievements
  ('achievements', 'إنجاز 5 زيارات', 50),
  ('achievements', 'إنجاز 10 زيارات', 100),
  ('achievements', 'إنجاز 20 زيارة', 200)
ON CONFLICT (category, condition)
DO UPDATE SET points = excluded.points;

-- Note: Offices are left empty because it was empty in the mockData as well. 
-- The SuperAdmin can add offices natively through the dashboard logic we will map.
