drop index if exists public.service_interruptions_project_number_uidx;
create index if not exists idx_invoices_tariff_id on public.invoices(tariff_id);
create index if not exists idx_mwo_memo_issued_by on public.maintenance_work_orders(memo_issued_by);