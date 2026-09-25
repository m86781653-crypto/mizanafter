-- UPDATE policies must enforce the same role/resource write boundary as INSERT/DELETE.
-- Access to a child project for oversight must never imply mutation rights.
do $$
declare t text;
begin
  foreach t in array array['assets','customers','faults','field_tasks','invoices','kpi_snapshots','maintenance_work_orders','meter_readings','meters','notifications','payments','pumps','tanks','tariffs','wells'] loop
    execute format('drop policy if exists mizan_tenant_update on public.%I', t);
    execute format('create policy mizan_tenant_update on public.%I for update to authenticated using (private.mizan_can_write_project(project_id,%L,%L)) with check (private.mizan_can_write_project(project_id,%L,%L))', t,t,'update',t,'update');
  end loop;
end $$;
