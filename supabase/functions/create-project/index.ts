import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join("");
}

interface UserSpec {
  role: string;
  full_name: string;
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      project_name,
      project_name_en,
      status,
      funding_source,
      donor,
      beneficiary_count,
      design_capacity,
      operational_capacity,
      address,
      established_date,
      manager_name,
      manager_email,
      reader_name,
      reader_email,
      collector_name,
      collector_email,
    } = body;

    if (!project_name || !manager_email || !reader_email || !collector_email) {
      return new Response(
        JSON.stringify({ error: "اسم المشروع وبريدات المستخدمين الثلاثة مطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("id, role, tenant_id, project_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      return new Response(JSON.stringify({ error: "PROFILE_NOT_FOUND" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!["platform_admin", "tenant_manager", "operations_officer"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "PROJECT_MANAGE_FORBIDDEN" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!callerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: "TENANT_REQUIRED" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: callerTenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, parent_tenant_id, tenant_type, status")
      .eq("id", callerProfile.tenant_id)
      .maybeSingle();

    if (tenantErr || !callerTenant || callerTenant.status !== "active") {
      return new Response(JSON.stringify({ error: "TENANT_NOT_ACTIVE" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Governance boundary:
    // - Main tenant manager creates a NEW direct sub-tenant and its project.
    // - Sub-tenant manager/operations officer can create a project only inside
    //   their own tenant; they cannot create or reassign tenants.
    let targetTenantId = callerProfile.tenant_id;
    let createdSubtenant = false;

    if (callerTenant.tenant_type === "main_tenant") {
      if (callerProfile.role !== "tenant_manager") {
        return new Response(JSON.stringify({ error: "MAIN_TENANT_MANAGER_REQUIRED" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: childTenantId, error: childTenantErr } = await supabase.rpc(
        "mizan_create_subtenant",
        {
          p_name_ar: project_name,
          p_name_en: project_name_en || null,
          p_timezone: "Asia/Aden",
        }
      );

      if (childTenantErr || !childTenantId) {
        return new Response(JSON.stringify({ error: childTenantErr?.message || "SUBTENANT_CREATE_FAILED" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      targetTenantId = childTenantId as string;
      createdSubtenant = true;
    }

    const projectPayload: Record<string, unknown> = {
      name_ar: project_name,
      status: status || "active",
      tenant_id: targetTenantId,
    };
    if (project_name_en) projectPayload.name_en = project_name_en;
    if (funding_source) projectPayload.funding_source = funding_source;
    if (donor) projectPayload.donor = donor;
    if (beneficiary_count) projectPayload.beneficiary_count = parseInt(beneficiary_count);
    if (design_capacity) projectPayload.design_capacity = parseFloat(design_capacity);
    if (operational_capacity) projectPayload.operational_capacity = parseFloat(operational_capacity);
    if (address) projectPayload.address = address;
    if (established_date) projectPayload.established_date = established_date;

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .insert(projectPayload)
      .select()
      .single();

    if (projectErr) throw new Error("فشل إنشاء المشروع: " + projectErr.message);
    const projectId = project.id;

    const users: UserSpec[] = [
      { role: "tenant_manager", full_name: manager_name || "مدير المستأجر", email: manager_email },
      { role: "meter_reader", full_name: reader_name || "قارئ العدادات", email: reader_email },
      { role: "collection_officer", full_name: collector_name || "مسؤول التحصيل", email: collector_email },
    ];

    const credentials: Array<{ role: string; role_label: string; full_name: string; email: string; password: string; must_change_password: boolean }> = [];

    for (const userSpec of users) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === userSpec.email.toLowerCase());

      // Never silently move/reassign an existing identity between tenants.
      if (existing) {
        throw new Error(`المستخدم ${userSpec.email} موجود مسبقاً؛ استخدم بريداً جديداً للحساب الجديد`);
      }

      const password = generatePassword();
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: userSpec.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: userSpec.full_name,
          must_change_password: true,
        },
        app_metadata: {
          tenant_id: targetTenantId,
          role: userSpec.role,
          project_id: projectId,
        },
      });

      if (createErr) throw new Error(`فشل إنشاء ${userSpec.email}: ${createErr.message}`);
      const userId = newUser.user.id;

      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: userId,
        email: userSpec.email,
        full_name: userSpec.full_name,
        role: userSpec.role,
        project_id: projectId,
        tenant_id: targetTenantId,
        must_change_password: true,
      });

      if (profileErr) throw new Error(`فشل إنشاء ملف ${userSpec.email}: ${profileErr.message}`);

      const roleLabels: Record<string, string> = {
        tenant_manager: "مدير المستأجر",
        meter_reader: "قارئ العدادات",
        collection_officer: "مسؤول التحصيل",
      };

      credentials.push({
        role: userSpec.role,
        role_label: roleLabels[userSpec.role] || userSpec.role,
        full_name: userSpec.full_name,
        email: userSpec.email,
        password,
        must_change_password: true,
      });
    }

    const { data: tariff } = await supabase.from("tariffs").insert({
      project_id: projectId,
      name_ar: "تعرفة سكنية افتراضية",
      customer_type: "residential",
      fixed_fee: 500,
      is_active: true,
      version: 1,
    }).select().single();

    if (tariff) {
      await supabase.from("tariff_tiers").insert([
        { tariff_id: tariff.id, from_m3: 0, to_m3: 10, price_per_m3: 100 },
        { tariff_id: tariff.id, from_m3: 10, to_m3: 20, price_per_m3: 150 },
        { tariff_id: tariff.id, from_m3: 20, to_m3: null, price_per_m3: 200 },
      ]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: targetTenantId,
        subtenant_created: createdSubtenant,
        project: { id: projectId, name_ar: project_name },
        credentials,
        message: createdSubtenant
          ? "تم إنشاء المستأجر الفرعي والمشروع وحسابات التشغيل بنجاح"
          : "تم إنشاء المشروع وحسابات التشغيل بنجاح",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
