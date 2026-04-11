-- =============================================
-- 1. ADD FILE_URLS to VISITS TABLE
-- =============================================
ALTER TABLE if exists public.visits
ADD COLUMN if not exists file_urls text[] default '{}';

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
  condition text not null,
  points integer not null
);

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY CAREFULLY
-- =============================================
-- First enable it on your tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoppers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for now
-- (This assumes you are using custom auth, but we will allow public read until Supabase Auth is strictly mapped)
CREATE POLICY "Allow public read access" ON admins FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON shoppers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON visits FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON issues FOR SELECT USING (true);

-- Allow full mutations since the React app handles role gating
CREATE POLICY "Allow public mutations" ON admins FOR ALL USING (true);
CREATE POLICY "Allow public mutations" ON shoppers FOR ALL USING (true);
CREATE POLICY "Allow public mutations" ON visits FOR ALL USING (true);
CREATE POLICY "Allow public mutations" ON issues FOR ALL USING (true);
