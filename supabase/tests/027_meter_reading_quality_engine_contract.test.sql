begin;

select plan(12);

select has_column(
  'public',
  'meter_readings',
  'reading_quality',
  'meter_readings stores server-side reading quality evidence'
);

select has_index(
  'public',
  'meter_readings',
  'idx_meter_readings_anomaly',
  'meter_readings has an anomaly lookup index'
);

select has_function(
  'private',
  'mizan_assess_meter_reading_quality',
  'server-side meter reading quality function exists'
);

select has_trigger(
  'public',
  'meter_readings',
  'trg_meter_reading_quality',
  'meter reading quality trigger exists'
);

select ok(
  not has_function_privilege('anon','private.mizan_assess_meter_reading_quality()','EXECUTE')
  and not has_function_privilege('authenticated','private.mizan_assess_meter_reading_quality()','EXECUTE'),
  'quality engine is not executable by API roles'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%percentile_cont%'
  and pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%CONSUMPTION_HIGH_OUTLIER%',
  'quality engine uses historical distribution and high-outlier classification'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%CONSUMPTION_LOW_OUTLIER%',
  'quality engine detects low historical outliers'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%CONSUMPTION_FLATLINE%',
  'quality engine detects repeated zero-consumption flatline'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%OCR_READING_MISMATCH%'
  and pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%OCR_CONFIDENCE_LOW%',
  'quality engine records OCR evidence failures'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%reading_quality%',
  'quality evidence is persisted with each reading'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%(tg_op = ''INSERT'' or mr.id <> new.id)%',
  'quality history excludes the row currently being updated'
);

select ok(
  pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%engine_version%'
  and pg_get_functiondef(
    'private.mizan_assess_meter_reading_quality()'::regprocedure
  ) like '%history_count%',
  'quality evidence contains versioned and historical context'
);

select * from finish();

rollback;
