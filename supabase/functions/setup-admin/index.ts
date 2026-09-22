import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, full_name, phone } = await req.json();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "البريد الإلكتروني والاسم مطلوبان" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if any super_admin already exists
    const { data: existingAdmins } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "super_admin");

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "يوجد مدير عام بالفعل. لا يمكن إنشاء أكثر من مدير عام.", existing: existingAdmins }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    const password = generatePassword();

    let userId: string;

    if (existingUser) {
      // Update the existing user's password and metadata
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          user_metadata: { full_name, role: "super_admin", must_change_password: true },
        }
      );
      if (updateErr) throw new Error(updateErr.message);
      userId = existingUser.id;

      // Update profile
      await supabase.from("profiles").upsert({
        id: userId,
        email,
        full_name,
        role: "super_admin",
        phone: phone || null,
        must_change_password: true,
      });
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "super_admin", must_change_password: true },
      });
      if (createErr) throw new Error(createErr.message);
      userId = newUser.user.id;

      // The trigger should auto-create the profile, but set it explicitly to be safe
      await supabase.from("profiles").upsert({
        id: userId,
        email,
        full_name,
        role: "super_admin",
        phone: phone || null,
        must_change_password: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم إنشاء حساب المدير العام بنجاح",
        credentials: {
          email,
          password,
          role: "super_admin",
          full_name,
          must_change_password: true,
        },
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
