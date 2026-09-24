/*
# MIZAN — RLS policy conflict elimination

Removes the legacy permissive policies left by the demo schema and the
project-only policies from the pre-tenant authorization layer. PostgreSQL
combines policies with OR semantics, so they must not remain beside the
tenant/RBAC policies.
*/

DO $$
BEGIN
  -- Legacy anon policies.
  EXECUTE 'DROP POLICY IF EXISTS anon_sel_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_projects ON public.projects';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_wells ON public.wells';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_pumps ON public.pumps';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_tanks ON public.tanks';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_customers ON public.customers';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_meters ON public.meters';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_readings ON public.meter_readings';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_tariffs ON public.tariffs';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_tiers ON public.tariff_tiers';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_invoices ON public.invoices';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_payments ON public.payments';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_assets ON public.assets';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_faults ON public.faults';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_mwo ON public.maintenance_work_orders';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_ftasks ON public.field_tasks';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_notifs ON public.notifications';

  EXECUTE 'DROP POLICY IF EXISTS anon_sel_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS anon_ins_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS anon_upd_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS anon_del_kpi ON public.kpi_snapshots';

  -- Legacy project-only policies. The tenant/RBAC policies from 006 replace them.
  EXECUTE 'DROP POLICY IF EXISTS sel_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS ins_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS upd_projects ON public.projects';
  EXECUTE 'DROP POLICY IF EXISTS del_projects ON public.projects';

  EXECUTE 'DROP POLICY IF EXISTS sel_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS ins_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS upd_wells ON public.wells';
  EXECUTE 'DROP POLICY IF EXISTS del_wells ON public.wells';

  EXECUTE 'DROP POLICY IF EXISTS sel_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS ins_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS upd_pumps ON public.pumps';
  EXECUTE 'DROP POLICY IF EXISTS del_pumps ON public.pumps';

  EXECUTE 'DROP POLICY IF EXISTS sel_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS ins_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS upd_tanks ON public.tanks';
  EXECUTE 'DROP POLICY IF EXISTS del_tanks ON public.tanks';

  EXECUTE 'DROP POLICY IF EXISTS sel_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS ins_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS upd_customers ON public.customers';
  EXECUTE 'DROP POLICY IF EXISTS del_customers ON public.customers';

  EXECUTE 'DROP POLICY IF EXISTS sel_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS ins_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS upd_meters ON public.meters';
  EXECUTE 'DROP POLICY IF EXISTS del_meters ON public.meters';

  EXECUTE 'DROP POLICY IF EXISTS sel_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS ins_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS upd_readings ON public.meter_readings';
  EXECUTE 'DROP POLICY IF EXISTS del_readings ON public.meter_readings';

  EXECUTE 'DROP POLICY IF EXISTS sel_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS ins_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS upd_tariffs ON public.tariffs';
  EXECUTE 'DROP POLICY IF EXISTS del_tariffs ON public.tariffs';

  EXECUTE 'DROP POLICY IF EXISTS sel_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS ins_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS upd_tiers ON public.tariff_tiers';
  EXECUTE 'DROP POLICY IF EXISTS del_tiers ON public.tariff_tiers';

  EXECUTE 'DROP POLICY IF EXISTS sel_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS ins_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS upd_invoices ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS del_invoices ON public.invoices';

  EXECUTE 'DROP POLICY IF EXISTS sel_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS ins_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS upd_payments ON public.payments';
  EXECUTE 'DROP POLICY IF EXISTS del_payments ON public.payments';

  EXECUTE 'DROP POLICY IF EXISTS sel_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS ins_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS upd_assets ON public.assets';
  EXECUTE 'DROP POLICY IF EXISTS del_assets ON public.assets';

  EXECUTE 'DROP POLICY IF EXISTS sel_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS ins_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS upd_faults ON public.faults';
  EXECUTE 'DROP POLICY IF EXISTS del_faults ON public.faults';

  EXECUTE 'DROP POLICY IF EXISTS sel_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS ins_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS upd_mwo ON public.maintenance_work_orders';
  EXECUTE 'DROP POLICY IF EXISTS del_mwo ON public.maintenance_work_orders';

  EXECUTE 'DROP POLICY IF EXISTS sel_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS ins_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS upd_ftasks ON public.field_tasks';
  EXECUTE 'DROP POLICY IF EXISTS del_ftasks ON public.field_tasks';

  EXECUTE 'DROP POLICY IF EXISTS sel_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS ins_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS upd_notifs ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS del_notifs ON public.notifications';

  EXECUTE 'DROP POLICY IF EXISTS sel_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS ins_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS upd_kpi ON public.kpi_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS del_kpi ON public.kpi_snapshots';
END $$;
