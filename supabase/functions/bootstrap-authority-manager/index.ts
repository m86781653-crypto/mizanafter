import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const CENTRAL_TENANT_ID = "b9295364-d688-4e20-b2a3-433f08bfdcaa";
const CENTRAL_EMAIL = "authority.manager@mizan.local";

function json(body: Record<string, unknown>, status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
function password(){const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";const bytes=crypto.getRandomValues(new Uint8Array(20));return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"POST required"},405);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), bootstrap=Deno.env.get("MIZAN_BOOTSTRAP_SECRET");
  if(!url||!key) return json({error:"خدمة الإدارة غير مهيأة"},500);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});

  const {data:existing}=await admin.from("profiles").select("id,email").eq("tenant_id",CENTRAL_TENANT_ID).eq("role","tenant_manager").limit(1);
  if(existing&&existing.length>0) return json({error:"يوجد مدير مركزي بالفعل. لا تتم إعادة تعيين كلمة المرور عبر هذه العملية."},409);

  const auth=req.headers.get("Authorization");
  let authorized=false;
  if(auth?.startsWith("Bearer ")){
    const {data:u}=await admin.auth.getUser(auth.slice(7));
    if(u.user){
      const {data:p}=await admin.from("profiles").select("role").eq("id",u.user.id).maybeSingle();
      authorized=p?.role==="platform_admin";
    }
  }
  if(!authorized){
    const supplied=req.headers.get("X-Mizan-Bootstrap-Secret");
    if(!bootstrap||!supplied||supplied!==bootstrap) return json({error:"يتطلب إنشاء الحساب المركزي مدير منصة أو مفتاح bootstrap صالحاً"},401);
  }

  const pwd=password();
  const {data:newUser,error:createError}=await admin.auth.admin.createUser({
    email:CENTRAL_EMAIL,password:pwd,email_confirm:true,
    app_metadata:{role:"tenant_manager",tenant_id:CENTRAL_TENANT_ID},
    user_metadata:{full_name:"مدير هيئة مياه الريف",must_change_password:true}
  });
  if(createError||!newUser.user) return json({error:createError?.message||"تعذر إنشاء الحساب"},500);

  const {error:profileError}=await admin.from("profiles").upsert({
    id:newUser.user.id,email:CENTRAL_EMAIL,full_name:"مدير هيئة مياه الريف",
    role:"tenant_manager",tenant_id:CENTRAL_TENANT_ID,project_id:null,must_change_password:true
  });
  if(profileError){await admin.auth.admin.deleteUser(newUser.user.id);return json({error:profileError.message},500);}

  return json({success:true,credentials:{email:CENTRAL_EMAIL,password:pwd,role:"tenant_manager",full_name:"مدير هيئة مياه الريف",must_change_password:true},warning:"هذه بيانات اعتماد أولية؛ سلّمها عبر قناة آمنة وسيُطلب تغيير كلمة المرور عند أول دخول."},201);
});