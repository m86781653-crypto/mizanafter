drop policy if exists mizan_water_production_evidence_insert on storage.objects;
create policy mizan_water_production_evidence_insert on storage.objects for insert to authenticated
with check (bucket_id='meter-readings' and (storage.foldername(name))[1]::uuid is not null and private.mizan_can_access_project((storage.foldername(name))[1]::uuid) and private.mizan_has_permission('water.production.capture') and (storage.foldername(name))[2]='production');
drop policy if exists mizan_water_production_evidence_select on storage.objects;
create policy mizan_water_production_evidence_select on storage.objects for select to authenticated
using (bucket_id='meter-readings' and (storage.foldername(name))[1]::uuid is not null and private.mizan_can_access_project((storage.foldername(name))[1]::uuid) and private.mizan_has_permission('water.production.read') and (storage.foldername(name))[2]='production');