-- MIZAN AI — subscriber single-page data model
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS household_members integer;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_household_members_nonnegative;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_household_members_nonnegative
  CHECK (household_members IS NULL OR household_members >= 1);

CREATE INDEX IF NOT EXISTS idx_customers_project_name
  ON public.customers(project_id, name_ar);

CREATE INDEX IF NOT EXISTS idx_meters_project_customer
  ON public.meters(project_id, customer_id);

COMMENT ON COLUMN public.customers.household_members IS 'عدد أفراد الأسرة/المستفيدين في منزل المشترك، إن كان متاحاً.';
