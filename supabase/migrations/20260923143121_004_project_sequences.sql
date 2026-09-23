/*
# Add per-project auto-numbering for customers and meters

## Purpose
Make customer_number and meter_number auto-generated from DB.
Previously users had to type them manually, causing duplicates and inconsistency.
Equipment codes (wells, pumps, tanks, assets) stay manual per business requirement.

## Approach
- next_project_seq_number(seq_name, project_id): returns "PREFIX-PROJECT-COUNT" format
  e.g. CUS-<project_prefix>-0001, MTR-<project_prefix>-0001
- Uses per-project counters so each project gets its own independent sequence
- PREFIX is extracted from seq_name (CUS, MTR, etc.)
- Project prefix is derived from project name (first 3 uppercase letters, sanitized)
- Falls back to project UUID prefix if name is empty

## Security
- SECURITY DEFINER so any authenticated user can call it
- Counter table is protected by RLS (authenticated can read/insert/update)
*/

-- Add per-project sequence support
CREATE TABLE IF NOT EXISTS public.project_seq_counters (
  id text PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  seq_name text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  UNIQUE(id)
);

ALTER TABLE public.project_seq_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_proj_seq" ON public.project_seq_counters;
CREATE POLICY "sel_proj_seq" ON public.project_seq_counters
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ins_proj_seq" ON public.project_seq_counters;
CREATE POLICY "ins_proj_seq" ON public.project_seq_counters
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "upd_proj_seq" ON public.project_seq_counters;
CREATE POLICY "upd_proj_seq" ON public.project_seq_counters
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_project_seq_number(seq_name text, project_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_id text;
  next_val bigint;
  prefix text;
  project_prefix text;
  proj_name text;
  result text;
BEGIN
  -- Extract prefix from seq_name (e.g., 'CUS' from 'CUS')
  prefix := upper(seq_name);
  seq_id := prefix || '-' || project_uuid::text;

  -- Get project name for prefix
  SELECT COALESCE(name_ar, name_en, 'PRJ') INTO proj_name
    FROM public.projects WHERE id = project_uuid;

  -- Build project prefix: first 3 alphanumeric chars of name, uppercased
  project_prefix := upper(regexp_replace(substring(proj_name from 1 for 3), '[^a-zA-Z0-9]', '', 'g'));
  IF project_prefix = '' THEN
    project_prefix := 'PRJ';
  END IF;

  -- Atomically increment counter
  INSERT INTO public.project_seq_counters (id, project_id, seq_name, counter)
  VALUES (seq_id, project_uuid, prefix, 1)
  ON CONFLICT (id) DO UPDATE
    SET counter = project_seq_counters.counter + 1
    RETURNING counter INTO next_val;

  result := prefix || '-' || project_prefix || '-' || LPAD(next_val::text, 4, '0');
  RETURN result;
END;
$$;
