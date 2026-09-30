-- Align the provisioning slot constraint with the canonical four-role project model.
alter table private.subtenant_user_slots
  drop constraint if exists subtenant_user_slots_role_check;

alter table private.subtenant_user_slots
  add constraint subtenant_user_slots_role_check
  check (
    role = any (
      array[
        'project_manager'::text,
        'meter_reader'::text,
        'collection_officer'::text,
        'operations_maintenance'::text
      ]
    )
  );
