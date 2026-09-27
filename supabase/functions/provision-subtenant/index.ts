import { withSupabase } from 'npm:@supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UserInput = {
  role: 'project_manager' | 'meter_reader' | 'collection_officer';
  full_name: string;
  email: string;
};

const roleLabels: Record<string, string> = {
  project_manager: 'مدير المشروع',
  meter_reader: 'قارئ العدادات',
  collection_officer: 'المحصل',
};

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const actorId = ctx.userClaims?.sub;
    if (!actorId) return json({ error: 'AUTH_REQUIRED' }, 401);

    const body = await req.json();
    const users = (body.users ?? []) as UserInput[];
    const normalizedUsers = users.map((u) => ({
      role: u.role,
      full_name: String(u.full_name ?? '').trim(),
      email: String(u.email ?? '').trim().toLowerCase(),
    }));

    if (
      normalizedUsers.length !== 3 ||
      new Set(normalizedUsers.map((u) => u.role)).size !== 3 ||
      new Set(normalizedUsers.map((u) => u.email)).size !== 3 ||
      normalizedUsers.some((u) => !u.full_name || !u.email)
    ) {
      return json({ error: 'EXACTLY_THREE_DISTINCT_USERS_REQUIRED' }, 400);
    }

    const { data: actor, error: actorError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role,tenant_id')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !actor || actor.role !== 'central_governance') {
      return json({ error: 'SUBTENANT_PROVISION_FORBIDDEN' }, 403);
    }

    const { data: existingUsers, error: listError } =
      await ctx.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) return json({ error: 'AUTH_LOOKUP_FAILED' }, 500);

    const existingByEmail = new Map(
      (existingUsers.users ?? [])
        .filter((u) => u.email)
        .map((u) => [u.email!.toLowerCase(), u.id]),
    );

    const conflicts = normalizedUsers
      .filter((u) => existingByEmail.has(u.email))
      .map((u) => u.email);

    if (conflicts.length) {
      return json({
        error: 'USER_EMAIL_ALREADY_EXISTS',
        emails: conflicts,
        message: 'يوجد حساب مستخدم بهذه البيانات. استخدم بريدًا مختلفًا؛ لم يتم إنشاء أي حساب جديد.',
      }, 409);
    }

    const created: Array<{ id: string; role: string; full_name: string; email: string; password: string }> = [];

    try {
      for (const input of normalizedUsers) {
        const initialPassword = generatePassword();
        const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: initialPassword,
          email_confirm: true,
          user_metadata: { full_name: input.full_name },
        });

        if (error || !data.user) {
          throw new Error(error?.message || 'AUTH_USER_CREATE_FAILED');
        }

        created.push({
          id: data.user.id,
          role: input.role,
          full_name: input.full_name,
          email: input.email,
          password: initialPassword,
        });
      }

      const { data: provisioned, error: provisionError } =
        await ctx.supabaseAdmin.rpc('mizan_provision_subtenant_auto', {
          p_actor_user_id: actorId,
          p_tenant_name_ar: String(body.tenant_name_ar ?? '').trim(),
          p_tenant_name_en: body.tenant_name_en ? String(body.tenant_name_en).trim() : null,
          p_project_name_ar: String(body.project_name_ar ?? body.tenant_name_ar ?? '').trim(),
          p_project_name_en: body.project_name_en ? String(body.project_name_en).trim() : null,
          p_timezone: body.timezone || 'Asia/Aden',
          p_funding_source: body.funding_source ? String(body.funding_source).trim() : null,
          p_funding_amount: body.funding_amount ?? null,
          p_funding_currency: body.funding_currency ? String(body.funding_currency).trim() : null,
          p_donor: body.donor ? String(body.donor).trim() : null,
          p_beneficiary_count: body.beneficiary_count ?? 0,
          p_design_capacity: body.design_capacity ?? 0,
          p_operational_capacity: body.operational_capacity ?? 0,
          p_address: body.address ? String(body.address).trim() : null,
          p_established_date: body.established_date || null,
          p_district_id: body.district_id || null,
          p_auth_users: created.map(({ id, role, full_name, email }) => ({ user_id: id, role, full_name, email })),
        });

      if (provisionError || !provisioned) {
        throw new Error(provisionError?.message || 'SUBTENANT_PROVISION_FAILED');
      }

      return json({
        ...provisioned,
        credentials: created.map(({ role, full_name, email, password }) => ({
          role,
          role_label: roleLabels[role] || role,
          full_name,
          email,
          password,
          status: 'created',
          must_change_password: true,
        })),
      });
    } catch (error) {
      await Promise.allSettled(
        created.map((u) => ctx.supabaseAdmin.auth.admin.deleteUser(u.id)),
      );
      return json({
        error: 'SUBTENANT_PROVISION_FAILED',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء المستأجر والحسابات.',
      }, 500);
    }
  }),
};
