import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const PROJECT_ID = "dofteozulbjwnzofcfmo";
const CENTRAL_TENANT_ID = "b9295364-d688-4e20-b2a3-433f08bfdcaa";

type ProvisionedAccount = {
  role: "tenant_manager" | "meter_reader" | "collection_officer";
  email: string;
  password: string;
  full_name: string;
  user_id: string;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function password() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "project";
}

function makeEmail(projectName: string, role: string) {
  return `${role}.${slug(projectName)}.${crypto.randomUUID().slice(0, 8)}@mizan.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "الطلب يجب أن يكون POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "خدمة الإدارة غير مهيأة" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return response({ error: "المصادقة مطلوبة" }, 401);

  const { data: caller, error: callerError } = await admin.auth.getUser(auth.slice(7));
  if (callerError || !caller.user) return response({ error: "جلسة المصادقة غير صالحة" }, 401);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,tenant_id")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (profileError) return response({ error: profileError.message }, 500);

  const isPlatformAdmin = profile?.role === "platform_admin";
  const isCentralManager = profile?.role === "tenant_manager" && profile?.tenant_id === CENTRAL_TENANT_ID;
  if (!isPlatformAdmin && !isCentralManager) return response({ error: "هذا الإجراء متاح لهيئة مياه الريف فقط" }, 403);

  const body = await req.json();
  const tenantName = String(body.tenant_name_ar ?? "").trim();
  const projectName = String(body.project_name_ar ?? "").trim();
  const nameEn = body.tenant_name_en ? String(body.tenant_name_en).trim() : null;
  const districtId = body.district_id ? String(body.district_id) : null;
  const requestedNames = {
    tenant_manager: String(body.manager_name ?? "").trim(),
    meter_reader: String(body.reader_name ?? "").trim(),
    collection_officer: String(body.collector_name ?? "").trim(),
  };
  if (!tenantName || !projectName) return response({ error: "اسم المشروع واسم المستأجر مطلوبان" }, 400);

  const tenantId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const accounts: ProvisionedAccount[] = [];
  const createdUserIds: string[] = [];

  try {
    const { error: tenantError } = await admin.from("tenants").insert({
      id: tenantId,
      parent_tenant_id: CENTRAL_TENANT_ID,
      name_ar: tenantName,
      name_en: nameEn,
      tenant_type: "sub_tenant",
      status: "active",
    });
    if (tenantError) throw new Error(tenantError.message);

    const { error: projectError } = await admin.from("projects").insert({
      id: projectId,
      tenant_id: tenantId,
      name_ar: projectName,
      name_en: nameEn,
      district_id: districtId,
      status: "active",
    });
    if (projectError) throw new Error(projectError.message);

    const roles: Array<{ role: ProvisionedAccount["role"]; label: string }> = [
      { role: "tenant_manager", label: "مدير المشروع" },
      { role: "meter_reader", label: "مسؤول قراءة العدادات" },
      { role: "collection_officer", label: "مسؤول التحصيل" },
    ];

    for (const item of roles) {
      const email = makeEmail(projectName, item.role);
      const pwd = password();
      const fullName = requestedNames[item.role] || `${item.label} - ${projectName}`;

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: fullName, must_change_password: true },
        app_metadata: { role: item.role, tenant_id: tenantId, project_id: projectId },
      });
      if (createError || !created.user) throw new Error(createError?.message ?? "تعذر إنشاء المستخدم");

      createdUserIds.push(created.user.id);

      const { error: profileUpsertError } = await admin.from("profiles").upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role: item.role,
        tenant_id: tenantId,
        project_id: projectId,
        must_change_password: true,
      });
      if (profileUpsertError) throw new Error(profileUpsertError.message);

      accounts.push({ role: item.role, email, password: pwd, full_name: fullName, user_id: created.user.id });
    }

    await admin.from("audit_logs").insert({
      table_name: "tenants",
      record_id: tenantId,
      action: "CREATE_SUB_TENANT",
      new_values: { tenant_id: tenantId, project_id: projectId, tenant_name: tenantName, project_name: projectName, account_count: 3 },
      actor_user_id: caller.user.id,
      entity_type: "tenant",
      entity_id: tenantId,
      result: "success",
    });

    return response({
      success: true,
      tenant: { id: tenantId, name_ar: tenantName, parent_tenant_id: CENTRAL_TENANT_ID },
      project: { id: projectId, name_ar: projectName },
      credentials: accounts,
      warning: "هذه بيانات الدخول الأولية. يجب تسليمها للمشروع عبر قناة آمنة، وسيُطلب تغيير كلمات المرور عند أول دخول.",
    }, 201);
  } catch (error) {
    for (const userId of createdUserIds) await admin.auth.admin.deleteUser(userId);
    await admin.from("projects").delete().eq("id", projectId);
    await admin.from("tenants").delete().eq("id", tenantId);
    return response({ error: error instanceof Error ? error.message : "فشل إنشاء المستأجر والمستخدمين" }, 500);
  }
});
