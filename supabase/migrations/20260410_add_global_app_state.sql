-- Table for syncing all local React memory state (SubAdmins, Shoppers, Visits, Issues) securely across devices
CREATE TABLE IF NOT EXISTS public.app_state (
  id text primary key,
  data jsonb not null
);

-- Runtime no longer depends on this table directly; keep it locked by default.
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_state_no_access ON public.app_state;
CREATE POLICY app_state_no_access
ON public.app_state
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
