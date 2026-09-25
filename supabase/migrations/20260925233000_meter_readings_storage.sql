-- MIZAN field evidence storage for authoritative MRX captures.
-- Private bucket: evidence is never publicly readable.
insert into storage.buckets (id, name, public)
values ('meter-readings', 'meter-readings', false)
on conflict (id) do update set public = false;

drop policy if exists "mizan_meter_readings_evidence_select" on storage.objects;
create policy "mizan_meter_readings_evidence_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'meter-readings'
  and private.mizan_can_access_project((storage.foldername(name))[1]::uuid)
);

drop policy if exists "mizan_meter_readings_evidence_insert" on storage.objects;
create policy "mizan_meter_readings_evidence_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meter-readings'
  and private.mizan_can_write_project(
    (storage.foldername(name))[1]::uuid,
    'meter_readings',
    'insert'
  )
);

drop policy if exists "mizan_meter_readings_evidence_update" on storage.objects;
create policy "mizan_meter_readings_evidence_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'meter-readings'
  and private.mizan_can_write_project(
    (storage.foldername(name))[1]::uuid,
    'meter_readings',
    'update'
  )
)
with check (
  bucket_id = 'meter-readings'
  and private.mizan_can_write_project(
    (storage.foldername(name))[1]::uuid,
    'meter_readings',
    'update'
  )
);

drop policy if exists "mizan_meter_readings_evidence_delete" on storage.objects;
create policy "mizan_meter_readings_evidence_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'meter-readings'
  and private.mizan_can_write_project(
    (storage.foldername(name))[1]::uuid,
    'meter_readings',
    'delete'
  )
);
