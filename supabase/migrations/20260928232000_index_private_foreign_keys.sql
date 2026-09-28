create index if not exists idx_customer_household_history_changed_by
  on private.customer_household_history(changed_by);

create index if not exists idx_customer_household_history_project_id
  on private.customer_household_history(project_id);

create index if not exists idx_subtenant_user_slots_claimed_user_id
  on private.subtenant_user_slots(claimed_user_id);
