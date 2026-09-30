-- Restrict interruption evidence uploads to maintenance execution users while preserving normal production evidence capture.
drop policy if exists "mizan_water_production_evidence_insert" on storage.objects;

create policy "mizan_water_production_evidence_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meter-readings'
  and (storage.foldername(name))[1]::uuid is not null
  and private.mizan_can_access_project((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[2] = 'production'
  and (
    (
      (storage.foldername(name))[4] = 'interruption'
      and private.mizan_has_permission('maintenance.execute')
      and private.mizan_has_permission('water.production.capture')
    )
    or (
      (storage.foldername(name))[4] is distinct from 'interruption'
      and private.mizan_has_permission('water.production.capture')
    )
  )
);