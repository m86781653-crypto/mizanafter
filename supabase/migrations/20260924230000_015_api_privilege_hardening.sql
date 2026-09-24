-- MIZAN production API privilege hardening.
-- Keep application access authenticated-only and make meter/financial state changes
-- server-authoritative through MIZAN RPCs.

begin;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in (
        'spatial_ref_sys',
        'geometry_columns',
        'geography_columns'
      )
  loop
    execute format('revoke all on table public.%I from anon', r.relname);
  end loop;
end
$$;

-- Direct client writes are forbidden for state transitions that must pass
-- server-side authorization, idempotency, validation and audit controls.
revoke insert, update, delete on table public.meter_readings from authenticated;
revoke insert, update, delete on table public.invoices from authenticated;
revoke insert, update, delete on table public.payments from authenticated;
revoke insert, update, delete on table public.meters from authenticated;

-- PostGIS system catalog is not a MIZAN application data surface.
revoke all on table public.spatial_ref_sys from anon, authenticated;

commit;
