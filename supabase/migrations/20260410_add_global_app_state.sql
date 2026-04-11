-- Table for syncing all local React memory state (SubAdmins, Shoppers, Visits, Issues) securely across devices
CREATE TABLE IF NOT EXISTS public.app_state (
  id text primary key,
  data jsonb not null
);

-- Ensure Read/Write access is fully open since the app handles its own role authorization
ALTER TABLE public.app_state DISABLE ROW LEVEL SECURITY;
