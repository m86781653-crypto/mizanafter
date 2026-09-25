import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Mizan-Bootstrap-Secret",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bootstrapSecret = Deno.env.get("MIZAN_BOOTSTRAP_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "خدمة المصادقة غير مهيأة" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: platformAdmins, error: adminLookupError } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("role", "platform_admin")
      .limit(2);

    if (adminLookupError) throw new Error(adminLookupError.message);

    const hasPlatformAdmin = (platformAdmins?.length ?? 0) > 0;
    const authorization = req.headers.get("Authorization");
    const bootstrapHeader = req.headers.get("X-Mizan-Bootstrap-Secret");

    if (!hasPlatformAdmin) {
      if (!bootstrapSecret || !bootstrapHeader || bootstrapHeader !== bootstrapSecret) {
        return json({ error: "التهيئة الأولية تتطلب مفتاح bootstrap صالحاً" }, 401);
      }
    } else {
      if (!authorization?.startsWith("Bearer ")) {
        return json({ error: "المصادقة مطلوبة" }, 401);
      }

      const token = authorization.slice("Bearer ".length).trim();
      const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);

      if (callerError || !callerData.user) {
        return json({ error: "رمز المصادقة غير صالح" }, 401);
      }

      const { data: callerProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", callerData.user.id)
        .maybeSingle();

      if (profileError) throw new Error(profileError.message);

      if (callerProfile?.role !== "platform_admin") {
        return json({ error: "يتطلب هذا الإجراء صلاحية platform_admin" }, 403);
      }
    }

    const { email, full_name, phone } = await req.json();

    if (!email || !full_name) {
      return json({ error: "البريد الإلكتروني والاسم مطلوبان" }, 400);
    }

    const password = generatePassword();

    const { data: existingAdmins, error: existingAdminError } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("role", "platform_admin")
      .limit(2);

    if (existingAdminError) throw new Error(existingAdminError.message);

    if (existingAdmins && existingAdmins.length > 0) {
      const existing = existingAdmins[0];

      if (existing.email !== email) {
        return json({
          error: "يوجد مدير منصة بالفعل. لا يمكن إنشاء مدير منصة آخر عبر هذه العملية.",
        }, 409);
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
        app_metadata: { role: "platform_admin" },
      });

      if (updateError) throw new Error(updateError.message);

      const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
        id: existing.id,
        email,
        full_name,
        role: "platform_admin",
        phone: phone || null,
        must_change_password: true,
      });

      if (profileUpsertError) throw new Error(profileUpsertError.message);

      return json({
        success: true,
        message: "تم إعادة تعيين كلمة مرور مدير المنصة بنجاح",
        credentials: {
          email,
          password,
          role: "platform_admin",
          full_name,
          must_change_password: true,
        },
      });
    }

    const { data: existingUsers, error: listUsersError } = await adminClient.auth.admin.listUsers();
    if (listUsersError) throw new Error(listUsersError.message);

    const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;

    if (existingUser) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
        app_metadata: { role: "platform_admin" },
      });

      if (updateError) throw new Error(updateError.message);
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
        app_metadata: { role: "platform_admin" },
      });

      if (createError) throw new Error(createError.message);
      userId = newUser.user.id;
    }

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      role: "platform_admin",
      phone: phone || null,
      must_change_password: true,
    });

    if (profileUpsertError) throw new Error(profileUpsertError.message);

    return json({
      success: true,
      message: "تم إنشاء حساب مدير المنصة بنجاح",
      credentials: {
        email,
        password,
        role: "platform_admin",
        full_name,
        must_change_password: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    return json({ error: message }, 500);
  }
});
