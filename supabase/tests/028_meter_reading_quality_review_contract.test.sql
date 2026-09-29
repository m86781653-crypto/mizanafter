begin;

select plan(10);

select has_column(
  'public',
  'meter_readings',
  'quality_review_status',
  'meter_readings stores explicit quality review status'
);

select has_column(
  'public',
  'meter_readings',
  'quality_reviewed_by',
  'meter_readings stores reviewer identity'
);

select has_column(
  'public',
  'meter_readings',
  'quality_reviewed_at',
  'meter_readings stores review timestamp'
);

select has_column(
  'public',
  'meter_readings',
  'quality_review_note',
  'meter_readings stores review evidence note'
);

select has_index(
  'public',
  'meter_readings',
  'idx_meter_readings_quality_review',
  'meter_readings has a quality review lookup index'
);

select has_function(
  'public',
  'mrx_review_meter_reading',
  'quality review RPC exists'
);

select has_trigger(
  'public',
  'meter_readings',
  'trg_meter_reading_quality_review_status',
  'quality review status trigger exists'
);

select ok(
  not has_function_privilege('anon','public.mrx_review_meter_reading(uuid,text,text)','EXECUTE')
  and has_function_privilege('authenticated','public.mrx_review_meter_reading(uuid,text,text)','EXECUTE'),
  'quality review RPC is available only to authenticated callers'
);

select ok(
  pg_get_functiondef(
    'public.mrx_review_meter_reading(uuid,text,text)'::regprocedure
  ) like '%METER_REVIEW_FORBIDDEN%'
  and pg_get_functiondef(
    'public.mrx_review_meter_reading(uuid,text,text)'::regprocedure
  ) like '%QUALITY_REVIEW_NOTE_REQUIRED%',
  'quality review requires project write authority and a review note'
);

select ok(
  pg_get_functiondef(
    'private.mizan_sync_meter_reading_quality_review_status()'::regprocedure
  ) like '%pending%'
  and pg_get_functiondef(
    'private.mizan_sync_meter_reading_quality_review_status()'::regprocedure
  ) like '%not_required%',
  'quality review status is derived from the server anomaly state'
);

select * from finish();

rollback;
