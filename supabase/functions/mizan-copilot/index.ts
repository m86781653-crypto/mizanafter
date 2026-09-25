import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

function json(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"POST required"},405);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),geminiKey=Deno.env.get("GEMINI_API_KEY");
  if(!url||!key)return json({error:"خدمة البيانات غير مهيأة"},500);
  if(!geminiKey)return json({error:"محرك الذكاء الاصطناعي غير مهيأ"},503);
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer "))return json({error:"المصادقة مطلوبة"},401);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:user,error:userError}=await admin.auth.getUser(auth.slice(7));
  if(userError||!user.user)return json({error:"جلسة غير صالحة"},401);
  const {project_id,question}=await req.json();
  if(typeof project_id!=="string"||typeof question!=="string"||question.trim().length===0)return json({error:"project_id و question مطلوبان"},400);
  if(question.length>1500)return json({error:"السؤال طويل جداً"},400);

  const {data:profile}=await admin.from("profiles").select("role,tenant_id,project_id").eq("id",user.user.id).maybeSingle();
  if(!profile)return json({error:"ملف المستخدم غير موجود"},403);
  const {data:project}=await admin.from("projects").select("id,name_ar,tenant_id,status,beneficiary_count,operational_capacity").eq("id",project_id).maybeSingle();
  if(!project)return json({error:"المشروع غير موجود"},404);
  const {data:tenant}=await admin.from("tenants").select("id,parent_tenant_id,tenant_type,status").eq("id",project.tenant_id).maybeSingle();

  const central = profile.role==="platform_admin" || (profile.role==="tenant_manager" && profile.tenant_id && tenant?.parent_tenant_id===profile.tenant_id);
  const local = profile.tenant_id===project.tenant_id && (profile.project_id===project_id || profile.role==="tenant_manager");
  if(!central && !local)return json({error:"غير مصرح بالوصول إلى هذا المشروع"},403);

  const [customers,meters,faults,interruptions,readings,wells,invoices,payments]=await Promise.all([
    admin.from("customers").select("id",{count:"exact",head:true}).eq("project_id",project_id).eq("status","active"),
    admin.from("meters").select("id",{count:"exact",head:true}).eq("project_id",project_id).eq("status","active"),
    admin.from("faults").select("fault_number,severity,status,fault_type,description").eq("project_id",project_id).not("status","in","(closed,resolved)").limit(20),
    admin.from("service_interruptions").select("interruption_number,severity,status,interruption_type,started_at,affected_subscribers,estimated_water_loss_m3,description").eq("project_id",project_id).not("status","in","(restored,closed)").limit(20),
    admin.from("meter_readings").select("reading_value,consumption,ai_extracted_value,ai_confidence,anomaly_flag,status,reading_date").eq("project_id",project_id).order("reading_date",{ascending:false}).limit(1000),
    admin.from("wells").select("code,name_ar,daily_output_m3,status").eq("project_id",project_id),
    admin.from("invoices").select("grand_total,balance,status,consumption_m3").eq("project_id",project_id),
    admin.from("payments").select("amount,status").eq("project_id",project_id)
  ]);
  const r=readings.data||[], inv=invoices.data||[], pay=payments.data||[], wellsData=wells.data||[];
  const production=wellsData.reduce((s:any,w:any)=>s+Number(w.daily_output_m3||0),0);
  const consumption=inv.reduce((s:any,i:any)=>s+Number(i.consumption_m3||0),0);
  const totalBilled=inv.reduce((s:any,i:any)=>s+Number(i.grand_total||0),0);
  const outstanding=inv.filter((i:any)=>i.status!=="paid").reduce((s:any,i:any)=>s+Number(i.balance||0),0);
  const approvedCollected=pay.filter((p:any)=>p.status==="approved").reduce((s:any,p:any)=>s+Number(p.amount||0),0);
  const context={project:{name:project.name_ar,status:project.status,beneficiaries:project.beneficiary_count,operational_capacity:project.operational_capacity},kpis:{customers:customers.count||0,meters:meters.count||0,ocr_readings:r.filter((x:any)=>x.ai_extracted_value!==null).length,anomalies:r.filter((x:any)=>x.anomaly_flag).length,low_confidence:r.filter((x:any)=>x.ai_extracted_value!==null&&Number(x.ai_confidence||0)<0.8).length,production_m3_day:production,consumption_m3:consumption,nrw_percent:production>0?((production-consumption)/production*100):null,total_billed:totalBilled,approved_collected:approvedCollected,outstanding:outstanding,open_faults:(faults.data||[]).length,open_interruptions:(interruptions.data||[]).length},faults:faults.data||[],interruptions:interruptions.data||[],wells:wellsData};
  const prompt=`أنت "مساعد ميزان" لمنصة استدامة خدمات المياه. أجب بالعربية من البيانات المرفقة فقط. لا تخترع رقماً أو اسماً أو سبباً غير موجود. إذا كانت البيانات غير كافية فقل ذلك بوضوح. لا تنفذ أي تغيير. يمكنك تقديم توصيات قرار تفسيرية، لكن يجب أن تربطها بالمؤشرات المعروضة وتصفها كتوصية وليست حقيقة. لا تصف فجوة الإنتاج والاستهلاك بأنها تسرب مؤكد. السؤال: ${question.trim()}\n\nبيانات المشروع المصرح بها:\n${JSON.stringify(context)}`;
  const aiResponse=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":geminiKey},
    body:JSON.stringify({system_instruction:{parts:[{text:"كن دقيقاً ومختصراً، واذكر حدود البيانات عند الحاجة."}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:1200}})
  });
  if(!aiResponse.ok)return json({error:"تعذر الوصول إلى محرك الذكاء الاصطناعي"},502);
  const payload=await aiResponse.json();
  const answer=payload?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("").trim();
  if(!answer)return json({error:"لم ينتج محرك الذكاء الاصطناعي إجابة"},502);
  await admin.from("ai_logs").insert({operation:"mizan_copilot",model:"gemini-3.8-flash",input_summary:question.slice(0,500),output_summary:answer.slice(0,1000),success:true,user_id:user.user.id,project_id});
  return json({answer,model:"gemini-3.8-flash",data_context:{anomalies:context.kpis.anomalies,open_faults:context.kpis.open_faults,open_interruptions:context.kpis.open_interruptions}});
});