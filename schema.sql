-- =========================================================================
-- SUPABASE DATABASE SCHEMA & REALTIME CONFIGURATION
-- Madani Art Festival Management System (v2 Clean)
-- =========================================================================
--
-- Instructions:
-- 1. Open your Supabase Project Dashboard: https://supabase.com/dashboard
-- 2. Go to 'SQL Editor' (left sidebar icon with '>_')
-- 3. Click 'New Query'
-- 4. Paste this entire script and click 'Run' (or press Ctrl+Enter)
--
-- This script:
--  - Creates the 'fest_data' table storing all festival documents
--  - Creates an index on 'collection_name' for rapid collection retrieval
--  - Sets REPLICA IDENTITY FULL so Realtime WebSocket broadcasts deleted rows
--  - Adds 'fest_data' to Supabase Realtime publication
--  - Configures RLS policies allowing all festival devices to SELECT, INSERT,
--    UPDATE, and DELETE obsolete data during 'Force Push to Cloud'
-- =========================================================================

-- 1. Table structure
CREATE TABLE IF NOT EXISTS public.fest_data (
  collection_name text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_name, id)
);

-- 2. Performance index
CREATE INDEX IF NOT EXISTS idx_fest_data_collection
  ON public.fest_data (collection_name);

-- 3. Replica identity for real-time delete event replication
-- CRITICAL: Without FULL replica identity, PostgreSQL cannot broadcast old row values on DELETE
ALTER TABLE public.fest_data REPLICA IDENTITY FULL;

-- 4. Realtime Publication
-- Enables live WebSocket event streaming across all connected devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fest_data'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fest_data';
  END IF;
END $$;

-- 5. Row Level Security (RLS) Configuration
-- Enables RLS and grants full SELECT, INSERT, UPDATE, DELETE permissions to public
ALTER TABLE public.fest_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to fest_data" ON public.fest_data;

CREATE POLICY "Allow public full access to fest_data"
  ON public.fest_data
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- (Optional) If your Supabase environment prefers disabling RLS altogether:
-- ALTER TABLE public.fest_data DISABLE ROW LEVEL SECURITY;
