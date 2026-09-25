-- Production tenant identity: the single central tenant is Rural Water Authority.
update public.tenants
set name_ar='هيئة مياه الريف',
    name_en='Rural Water Authority',
    updated_at=now()
where tenant_type='main_tenant'
  and id='b9295364-d688-4e20-b2a3-433f08bfdcaa';
