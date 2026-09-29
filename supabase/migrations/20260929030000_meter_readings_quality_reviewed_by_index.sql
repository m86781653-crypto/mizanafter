-- MIZAN AI: cover the quality-review reviewer foreign key for joins/deletes.
begin;

create index if not exists idx_meter_readings_quality_reviewed_by
  on public.meter_readings(quality_reviewed_by);

commit;
