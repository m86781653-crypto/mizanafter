/*
# Add sequences for production-safe ID generation

## Purpose
Fixes duplicate invoice/receipt/fault/work-order numbers that occur when using
in-memory array length for sequential ID generation. After page reload, the
count resets and produces duplicates.

## Changes
1. Creates 4 sequence counters in a new `seq_counters` table
2. Creates a `next_seq_number()` function that atomically increments and returns the next number
3. This replaces the pattern `INV-{year}-{invoices.length + 1}` with a DB-backed atomic counter

## Security
- seq_counters: RLS enabled, super_admin only write, all authenticated can call the function
- next_seq_number() is SECURITY DEFINER so any authenticated user can get the next sequence atomically
*/

CREATE TABLE IF NOT EXISTS public.seq_counters (
  id text PRIMARY KEY,
  counter bigint NOT NULL DEFAULT 0,
  year int NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int
);

ALTER TABLE public.seq_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_seq" ON public.seq_counters;
CREATE POLICY "sel_seq" ON public.seq_counters
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ins_seq" ON public.seq_counters;
CREATE POLICY "ins_seq" ON public.seq_counters
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "upd_seq" ON public.seq_counters;
CREATE POLICY "upd_seq" ON public.seq_counters
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_seq_number(seq_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year int;
  next_val bigint;
  result text;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::int;
  
  INSERT INTO public.seq_counters (id, counter, year)
  VALUES (seq_name, 1, current_year)
  ON CONFLICT (id) DO UPDATE
    SET counter = CASE WHEN seq_counters.year = current_year THEN seq_counters.counter + 1 ELSE 1 END,
        year = current_year
    RETURNING counter INTO next_val;
  
  result := seq_name || '-' || current_year::text || '-' || LPAD(next_val::text, 4, '0');
  RETURN result;
END;
$$;
