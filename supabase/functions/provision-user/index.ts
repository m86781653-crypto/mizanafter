import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLES = [
  "platform_admin",
  "tenant_manager",
  "operations_officer",
  "meter_reader",
  "collection_officer",
  "maintenance_officer",
  "technician",
  "data_exception_officer",
  "viewer",
] as const;

type Role = typeof ROLES[number];

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.slice("Bearer ".length);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller) throw new Error("Unauthorized");

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,tenant_id")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile) throw new Error("Caller is not provisioned");
    const callerRole = callerProfile.role === "super_admin" ? "platform_admin" : callerProfile.role;

    if (callerRole !== "platform_admin" && callerRole !== "tenant_manager") {
      throw new Error("FORBIDDEN");
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    const requestedRole = String(body.role ?? "").trim() as Role;
    const requestedTenantId = String(body.tenant_id ?? "").trim();
    const projectId = body.project_id ? String(body.project_id) : null;

    if (!email || !fullName || !ROLES.includes(requestedRole) || !requestedTenantId) {
      throw new Error("INVALID_PROVISIONING_REQUEST");
    }

    if (requestedRole === "platform_admin" && callerRole !== "platform_admin") {
      throw new Error("PLATFORM_ROLE_FORBIDDEN");
    }

    const tenantId = callerRole === "tenant_manager"
      ? callerProfile.tenant_id
      : requestedTenantId;

    if (!tenantId) throw new Error("TENANT_REQUIRED");

    const { data: tenant } = await admin
      .from("tenants")
      .select("id,parent_tenant_id,tenant_type,status")
      .eq("id", tenantId)
      .single();

    if (!tenant || tenant.status !== "active") throw new Error("TENANT_NOT_ACTIVE");

    if (callerRole === "tenant_manager" && tenant.id !== callerProfile.tenant_id) {
      throw new Error("TENANT_SCOPE_FORBIDDEN");
    }

    if (projectId) {
      const { data: project } = await admin
        .from("projects")
        .select("id,tenant_id")
        .eq("id", projectId)
        .single();
      if (!project || project.tenant_id !== tenant.id) {
        throw new Error("PROJECT_TENANT_MISMATCH");
      }
    }

    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existing.users.some((u) => u.email?.toLowerCase() === email)) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    const password = generatePassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
      },
      app_metadata: {
        tenant_id: tenant.id,
        role: requestedRole,
        ...(projectId ? { project_id: projectId } : {}),
      },
    });

    if (createError || !created.user) throw new Error(createError?.message ?? "USER_CREATE_FAILED");

    return new Response(JSON.stringify({
      success: true,
      user_id: created.user.id,
      email,
      role: requestedRole,
      tenant_id: tenant.id,
      project_id: projectId,
      temporary_password: password,
      must_change_password: true,
    }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 :
      message === "FORBIDDEN" || message.endsWith("_FORBIDDEN") ? 403 :
      message === "USER_ALREADY_EXISTS" ? 409 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});