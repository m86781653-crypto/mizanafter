import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = new Set(["project_manager", "meter_reader", "collection_officer"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function cleanString(value: unknown, max = 200) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

async function getBearerUser(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function getActor(actorId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,role,tenant_id,project_id,full_name")
    .eq("id", actorId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function getTarget(targetUserId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,full_name,phone,role,tenant_id,project_id,must_change_password")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error || !data) return null;
  if (!allowedRoles.has(data.role)) return null;
  return data;
}


async function authorizeProject(actorId: string, projectId: string) {
  const actor = await getActor(actorId);
  if (!actor || actor.role !== "central_governance") return null;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,name_ar,tenant_id,status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project || project.status === "archived") return null;

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id,parent_tenant_id,tenant_type,status")
    .eq("id", project.tenant_id)
    .maybeSingle();
  if (
    tenantError ||
    !tenant ||
    tenant.tenant_type !== "sub_tenant" ||
    tenant.status !== "active" ||
    tenant.parent_tenant_id !== actor.tenant_id
  ) return null;

  return { actor, project, tenant };
}

async function authorize(actorId: string, targetUserId: string) {
  const actor = await getActor(actorId);
  const target = await getTarget(targetUserId);
  if (!actor || actor.role !== "central_governance" || !target) return null;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,name_ar,tenant_id,status")
    .eq("id", target.project_id)
    .maybeSingle();
  if (projectError || !project || project.status === "archived") return null;

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id,parent_tenant_id,tenant_type,status")
    .eq("id", project.tenant_id)
    .maybeSingle();
  if (
    tenantError ||
    !tenant ||
    tenant.tenant_type !== "sub_tenant" ||
    tenant.status !== "active" ||
    tenant.parent_tenant_id !== actor.tenant_id ||
    target.tenant_id !== project.tenant_id
  ) return null;

  const { data: permission, error: permissionError } = await admin
    .from("mizan_role_permissions")
    .select("permission_code")
    .eq("role_code", "central_governance")
    .eq("permission_code", "governance.users.manage")
    .maybeSingle();
  if (permissionError || !permission) return null;

  return { actor, target, project, tenant };
}

async function audit(actorId: string, target: Record<string, unknown>, action: string, beforeData: unknown, afterData: unknown, reason: string) {
  const { error } = await admin.from("audit_logs").insert({
    table_name: "auth.users",
    record_id: target.id,
    action,
    user_id: actorId,
    actor_user_id: actorId,
    entity_type: "project_user_identity",
    entity_id: target.id,
    project_id: target.project_id,
    reason,
    result: "success",
    before_data: beforeData,
    after_data: afterData,
  });
  if (error) throw new Error("AUDIT_WRITE_FAILED");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const actor = await getBearerUser(req);
  if (!actor) return json({ error: "UNAUTHORIZED" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = cleanString(body.action, 40);

  if (action === "list") {
    const projectId = cleanString(body.project_id, 80);
    if (!projectId) return json({ error: "PROJECT_REQUIRED" }, 400);
    const projectContext = await authorizeProject(actor.id, projectId);
    if (!projectContext) return json({ error: "FORBIDDEN_PROJECT_SCOPE" }, 403);

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id,email,full_name,phone,role,tenant_id,project_id,must_change_password")
      .eq("project_id", projectId)
      .in("role", ["project_manager", "meter_reader", "collection_officer"])
      .order("role");
    if (profilesError) return json({ error: "PROFILE_LOOKUP_FAILED", detail: profilesError.message }, 500);

    const users = await Promise.all((profiles || []).map(async (profile) => {
      const { data, error } = await admin.auth.admin.getUserById(profile.id);
      if (error || !data.user) return {
        ...profile,
        email_confirmed: false,
        banned_until: null,
      };
      return {
        ...profile,
        email_confirmed: Boolean(data.user.email_confirmed_at),
        banned_until: data.user.banned_until ?? null,
      };
    }));

    return json({ project_id: projectId, users });
  }

  const targetUserId = cleanString(body.target_user_id, 80);
  if (!targetUserId) return json({ error: "TARGET_USER_REQUIRED" }, 400);
  const context = await authorize(actor.id, targetUserId);
  if (!context) return json({ error: "FORBIDDEN_TARGET_SCOPE" }, 403);

  const { target, project } = context;

  if (action === "reset_password") {
    const password = randomPassword();
    const { data: authUser, error } = await admin.auth.admin.getUserById(target.id);
    if (error || !authUser.user) return json({ error: "AUTH_USER_NOT_FOUND" }, 404);

    const before = {
      email_confirmed: Boolean(authUser.user.email_confirmed_at),
      banned_until: authUser.user.banned_until ?? null,
      must_change_password: target.must_change_password,
    };

    const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
      password,
      email_confirm: true,
    });
    if (updateError) return json({ error: "PASSWORD_UPDATE_FAILED", detail: updateError.message }, 500);

    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", target.id);
    if (profileError) return json({ error: "PROFILE_UPDATE_FAILED", detail: profileError.message }, 500);

    await audit(actor.id, target, "ADMIN_PASSWORD_RESET", before, {
      email_confirmed: true,
      must_change_password: true,
    }, "Central governance reset credentials; first-login password change required.");

    return json({
      status: "success",
      action,
      project_id: project.id,
      user_id: target.id,
      email: target.email,
      password,
      must_change_password: true,
    });
  }

  if (action === "confirm_email") {
    const { data: authUser, error: lookupError } = await admin.auth.admin.getUserById(target.id);
    if (lookupError || !authUser.user) return json({ error: "AUTH_USER_NOT_FOUND" }, 404);

    if (authUser.user.email_confirmed_at) {
      return json({ status: "already_confirmed", action, user_id: target.id });
    }

    const { error } = await admin.auth.admin.updateUserById(target.id, { email_confirm: true });
    if (error) return json({ error: "EMAIL_CONFIRM_FAILED", detail: error.message }, 500);

    await audit(actor.id, target, "ADMIN_EMAIL_CONFIRM", {
      email_confirmed: false,
    }, {
      email_confirmed: true,
    }, "Central governance confirmed the project user's email.");

    return json({ status: "success", action, user_id: target.id });
  }

  if (action === "reactivate") {
    const { data: authUser, error: lookupError } = await admin.auth.admin.getUserById(target.id);
    if (lookupError || !authUser.user) return json({ error: "AUTH_USER_NOT_FOUND" }, 404);

    const before = { banned_until: authUser.user.banned_until ?? null };
    if (!authUser.user.banned_until) return json({ status: "already_active", action, user_id: target.id });

    const { error } = await admin.auth.admin.updateUserById(target.id, { ban_duration: "none" });
    if (error) return json({ error: "REACTIVATE_FAILED", detail: error.message }, 500);

    await audit(actor.id, target, "ADMIN_ACCOUNT_REACTIVATE", before, {
      banned_until: null,
    }, "Central governance reactivated the project user account.");

    return json({ status: "success", action, user_id: target.id });
  }

  if (action === "force_password_change") {
    if (target.must_change_password) return json({ status: "already_required", action, user_id: target.id });

    const { error } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", target.id);
    if (error) return json({ error: "PROFILE_UPDATE_FAILED", detail: error.message }, 500);

    await audit(actor.id, target, "ADMIN_FORCE_PASSWORD_CHANGE", {
      must_change_password: false,
    }, {
      must_change_password: true,
    }, "Central governance required a password change at next login.");

    return json({ status: "success", action, user_id: target.id });
  }

  if (action === "update_profile") {
    const fullName = cleanString(body.full_name, 160);
    const phone = cleanString(body.phone, 60);
    if (!fullName) return json({ error: "FULL_NAME_REQUIRED" }, 400);

    const before = { full_name: target.full_name, phone: target.phone };
    const { error } = await admin
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", target.id);
    if (error) return json({ error: "PROFILE_UPDATE_FAILED", detail: error.message }, 500);

    await audit(actor.id, target, "ADMIN_PROFILE_UPDATE", before, {
      full_name: fullName,
      phone,
    }, "Central governance updated allowed identity profile fields.");

    return json({ status: "success", action, user_id: target.id });
  }

  return json({ error: "UNSUPPORTED_ACTION" }, 400);
});