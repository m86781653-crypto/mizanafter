import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

interface UserSpec {
  role: "tenant_manager" | "meter_reader" | "collection_officer";
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller before any privileged write.
    const { data: caller, error: callerErr } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || ""
    );
    if (callerErr || !caller.user) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("tenant_id, role, project_id")
      .eq("id", caller.user.id)
      .single();

    if (profileErr || !profile?.tenant_id || profile.role !== "tenant_manager") {
      return new Response(JSON.stringify({ error: "TENANT_MANAGER_REQUIRED" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerTenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, tenant_type, status")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantErr || callerTenant?.tenant_type !== "main_tenant" || callerTenant.status !== "active") {
      return new Response(JSON.stringify({ error: "MAIN_TENANT_REQUIRED" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Create the child tenant first. The database function enforces hierarchy and audit.
    const { data: tenantId, error: createTenantErr } = await supabase.rpc("mizan_create_subtenant", {
      p_name_ar: project_name,
      p_name_en: project_name_en || null,
      p_timezone: "Asia/Aden",
    });
    if (createTenantErr || !tenantId) throw new Error(createTenantErr?.message || "فشل إنشاء المستأجر الفرعي");

    // 2. Create the project inside the newly created child tenant.
    const projectPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      name_ar: project_name,
      status: status || "active",
    };
    if (funding_source) projectPayload.funding_source = funding_source;
    if (donor) projectPayload.donor = donor;
    if (beneficiary_count) projectPayload.beneficiary_count = parseInt(beneficiary_count, 10);
    if (design_capacity) projectPayload.design_capacity = parseFloat(design_capacity);
    if (operational_capacity) projectPayload.operational_capacity = parseFloat(operational_capacity);
    if (address) projectPayload.address = address;
    if (established_date) projectPayload.established_date = established_date;

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .insert(projectPayload)
      .select()
      .single();
    if (projectErr || !project) throw new Error("فشل إنشاء المشروع: " + (projectErr?.message || "unknown"));
    const projectId = project.id;

    // 2. Create the 3 users
    const users: UserSpec[] = [
      { role: "tenant_manager", full_name: manager_name || "مدير المشروع", email: manager_email },
      { role: "meter_reader", full_name: reader_name || "قارئ العدادات", email: reader_email },
      { role: "collection_officer", full_name: collector_name || "المحصل", email: collector_email },
    ];

    const credentials: any[] = [];

    // Never silently take over an existing identity or reset its password.
    const { data: authUsers, error: authListErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authListErr) throw new Error("فشل التحقق من الحسابات الحالية");
    const existingEmails = new Set((authUsers?.users ?? []).map((u: any) => (u.email || "").toLowerCase()));
    const duplicateEmails = users.filter((u) => existingEmails.has(u.email.toLowerCase())).map((u) => u.email);
    if (duplicateEmails.length) {
      throw new Error(`الحسابات موجودة مسبقاً ولا يمكن إعادة تعيينها تلقائياً: ${duplicateEmails.join(", ")}`);
    }

    for (const userSpec of users) {
      const password = generatePassword();

      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: userSpec.email,
        password,
        email_confirm: true,
        app_metadata: {
          tenant_id: tenantId,
          project_id: projectId,
          role: userSpec.role,
        },
        user_metadata: {
          full_name: userSpec.full_name,
          must_change_password: true,
        },
      });
      if (createErr || !newUser.user) throw new Error(`فشل إنشاء ${userSpec.email}: ${createErr?.message || "unknown"}`);
      const userId = newUser.user.id;

      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: userId,
        email: userSpec.email,
        full_name: userSpec.full_name,
        role: userSpec.role,
        project_id: projectId,
        tenant_id: tenantId,
        must_change_password: true,
      });
      if (profileErr) throw new Error(`فشل إعداد ملف ${userSpec.email}`);

      const roleLabels: Record<string, string> = {
        tenant_manager: "مدير المستأجر",
        meter_reader: "قارئ عدادات",
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

    // 3. Create a default tariff for the project
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
        project: { id: projectId, name_ar: project_name },
        credentials,
        message: "تم إنشاء المشروع و3 حسابات مستخدمين بنجاح",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
