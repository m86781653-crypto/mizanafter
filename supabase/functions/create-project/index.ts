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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create the project
    const projectPayload: Record<string, unknown> = {
      name_ar: project_name,
      status: status || "active",
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

    // 2. Create the 3 users
    const users: UserSpec[] = [
      { role: "project_manager", full_name: manager_name || "مدير المشروع", email: manager_email },
      { role: "meter_reader", full_name: reader_name || "قارئ العدادات", email: reader_email },
      { role: "collector", full_name: collector_name || "المحصل", email: collector_email },
    ];

    const credentials: any[] = [];

    for (const userSpec of users) {
      const password = generatePassword();

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === userSpec.email);

      let userId: string;

      if (existing) {
        // Update password and metadata
        const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
          existing.id,
          {
            password,
            user_metadata: {
              full_name: userSpec.full_name,
              role: userSpec.role,
              must_change_password: true,
            },
          }
        );
        if (updateErr) throw new Error(`فشل تحديث ${userSpec.email}: ${updateErr.message}`);
        userId = existing.id;

        // Update profile
        await supabase.from("profiles").upsert({
          id: userId,
          email: userSpec.email,
          full_name: userSpec.full_name,
          role: userSpec.role,
          project_id: projectId,
          must_change_password: true,
        });
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: userSpec.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: userSpec.full_name,
            role: userSpec.role,
            must_change_password: true,
          },
        });
        if (createErr) throw new Error(`فشل إنشاء ${userSpec.email}: ${createErr.message}`);
        userId = newUser.user.id;

        // Update profile with project_id (trigger creates it without project_id)
        await supabase.from("profiles").upsert({
          id: userId,
          email: userSpec.email,
          full_name: userSpec.full_name,
          role: userSpec.role,
          project_id: projectId,
          must_change_password: true,
        });
      }

      const roleLabels: Record<string, string> = {
        project_manager: "مدير مشروع",
        meter_reader: "قارئ عدادات",
        collector: "محصل",
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
