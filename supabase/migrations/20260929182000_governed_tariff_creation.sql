-- Governed tariff creation: client roles may create tariffs only through an authorization-checked RPC.
create or replace function public.mizan_create_tariff_with_tiers(
  p_project_id uuid,
  p_name_ar text,
  p_customer_type text default 'residential',
  p_fixed_fee numeric default 0,
  p_base_liters_per_person_per_day numeric default 50,
  p_base_price_per_m3 numeric default 0,
  p_reference_period_days integer default 30,
  p_tiers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tariff public.tariffs;
  v_version integer;
  v_expected_from numeric := 0;
  v_saw_open_ended boolean := false;
  v_tier_count integer := 0;
  v_tier record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_project_id is null then
    raise exception 'PROJECT_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_name_ar, '')), '') is null then
    raise exception 'TARIFF_NAME_REQUIRED';
  end if;

  if p_customer_type not in ('residential', 'commercial', 'institutional') then
    raise exception 'INVALID_CUSTOMER_TYPE';
  end if;

  if coalesce(p_fixed_fee, 0) < 0
     or coalesce(p_base_liters_per_person_per_day, 0) < 0
     or coalesce(p_base_price_per_m3, 0) < 0 then
    raise exception 'TARIFF_VALUE_NEGATIVE';
  end if;

  if coalesce(p_reference_period_days, 0) <= 0 then
    raise exception 'REFERENCE_PERIOD_INVALID';
  end if;

  if jsonb_typeof(coalesce(p_tiers, '[]'::jsonb)) <> 'array' then
    raise exception 'TARIFF_TIERS_INVALID';
  end if;

  if not private.mizan_can_write_project(p_project_id, 'tariffs', 'insert') then
    raise exception 'TARIFF_WRITE_FORBIDDEN';
  end if;

  select coalesce(max(t.version), 0) + 1
    into v_version
  from public.tariffs t
  where t.project_id = p_project_id
    and t.customer_type = p_customer_type;

  insert into public.tariffs(
    project_id,
    name_ar,
    customer_type,
    fixed_fee,
    effective_from,
    is_active,
    version,
    base_liters_per_person_per_day,
    base_price_per_m3,
    reference_period_days
  )
  values(
    p_project_id,
    trim(p_name_ar),
    p_customer_type,
    coalesce(p_fixed_fee, 0),
    current_date,
    true,
    v_version,
    coalesce(p_base_liters_per_person_per_day, 50),
    coalesce(p_base_price_per_m3, 0),
    p_reference_period_days
  )
  returning * into v_tariff;

  for v_tier in
    select
      x.from_m3,
      x.to_m3,
      x.price_per_m3
    from jsonb_to_recordset(coalesce(p_tiers, '[]'::jsonb))
      as x(from_m3 numeric, to_m3 numeric, price_per_m3 numeric)
    order by x.from_m3 nulls first
  loop
    v_tier_count := v_tier_count + 1;

    if v_saw_open_ended then
      raise exception 'TARIFF_TIER_AFTER_OPEN_ENDED';
    end if;

    if v_tier.from_m3 is null
       or v_tier.from_m3 < 0
       or v_tier.price_per_m3 is null
       or v_tier.price_per_m3 < 0 then
      raise exception 'TARIFF_TIER_INVALID';
    end if;

    if v_tier.from_m3 <> v_expected_from then
      if v_tier.from_m3 > v_expected_from then
        raise exception 'TARIFF_TIER_GAP';
      else
        raise exception 'TARIFF_TIER_OVERLAP';
      end if;
    end if;

    if v_tier.to_m3 is not null and v_tier.to_m3 <= v_tier.from_m3 then
      raise exception 'TARIFF_TIER_RANGE_INVALID';
    end if;

    insert into public.tariff_tiers(
      tariff_id,
      from_m3,
      to_m3,
      price_per_m3
    )
    values(
      v_tariff.id,
      v_tier.from_m3,
      v_tier.to_m3,
      v_tier.price_per_m3
    );

    if v_tier.to_m3 is null then
      v_saw_open_ended := true;
    else
      v_expected_from := v_tier.to_m3;
    end if;
  end loop;

  if v_tier_count = 0 or not v_saw_open_ended then
    raise exception 'TARIFF_TIER_COVERAGE_REQUIRED';
  end if;

  return jsonb_build_object(
    'tariff', to_jsonb(v_tariff),
    'tier_count', v_tier_count
  );
end;
$function$;

revoke all on function public.mizan_create_tariff_with_tiers(
  uuid,text,text,numeric,numeric,numeric,integer,jsonb
) from public, anon;

grant execute on function public.mizan_create_tariff_with_tiers(
  uuid,text,text,numeric,numeric,numeric,integer,jsonb
) to authenticated;
