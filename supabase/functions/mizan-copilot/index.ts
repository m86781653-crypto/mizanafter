import { withSupabase } from 'npm:@supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
    if (!ctx.userClaims?.sub) return json({ error: 'المصادقة مطلوبة' }, 401);
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'محرك الذكاء الاصطناعي غير مهيأ' }, 503);

    const { project_id, question } = await req.json().catch(() => ({}));
    if (typeof project_id !== 'string' || typeof question !== 'string' || !question.trim()) return json({ error: 'project_id و question مطلوبان' }, 400);
    if (question.length > 1500) return json({ error: 'السؤال طويل جداً' }, 400);

    const { data: profile } = await ctx.supabase.from('profiles').select('role,tenant_id,project_id').eq('id', ctx.userClaims.sub).maybeSingle();
    if (!profile) return json({ error: 'ملف المستخدم غير موجود' }, 403);

    const { data: project } = await ctx.supabase.from('projects').select('id,name_ar,tenant_id,status,beneficiary_count,operational_capacity').eq('id', project_id).maybeSingle();
    if (!project) return json({ error: 'المشروع غير موجود' }, 404);

    const local = profile.tenant_id === project.tenant_id && profile.project_id === project_id;
    if (!local && profile.role !== 'central_governance' && profile.role !== 'platform_admin') return json({ error: 'غير مصرح بالوصول إلى هذا المشروع' }, 403);

    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [year] = today.split('-');
    const periodStart = `${year}-01-01`;
    const [y, m, d] = today.split('-').map(Number);
    const periodEndExclusive = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    const [customers, meters, faults, interruptions, readings, wells, operational] = await Promise.all([
      ctx.supabase.from('customers').select('id', { count: 'exact', head: true }).eq('project_id', project_id).eq('status', 'active'),
      ctx.supabase.from('meters').select('id', { count: 'exact', head: true }).eq('project_id', project_id).eq('status', 'active'),
      ctx.supabase.from('faults').select('fault_number,severity,status,fault_type,description').eq('project_id', project_id).not('status', 'in', '(closed,resolved)').limit(20),
      ctx.supabase.from('service_interruptions').select('interruption_number,severity,status,interruption_type,started_at,affected_subscribers,estimated_water_loss_m3,description').eq('project_id', project_id).not('status', 'in', '(restored,closed)').limit(20),
      ctx.supabase.from('meter_readings').select('reading_value,consumption,ai_extracted_value,ai_confidence,anomaly_flag,status,reading_date').eq('project_id', project_id).order('reading_date', { ascending: false }).limit(1000),
      ctx.supabase.from('wells').select('code,name_ar,daily_output_m3,status').eq('project_id', project_id),
      ctx.supabase.rpc('mizan_operational_report', { p_project_id: project_id, p_period_start: periodStart, p_period_end: periodEndExclusive }),
    ]);

    const r = readings.data || [], wd = wells.data || [], report = operational.data || {};
    if (operational.error) return json({ error: 'تعذر تحميل مؤشرات المشروع التشغيلية' }, 502);
    const production = Number(report.production_m3 || 0);
    const consumption = Number(report.recorded_consumption_m3 || 0);
    const totalBilled = Number(report.invoiced_amount || 0);
    const outstanding = Number(report.current_outstanding_amount || 0);
    const approvedCollected = Number(report.approved_collected_amount || 0);
    const context = {
      period: { start: periodStart, end: today },
      project: { name: project.name_ar, status: project.status, beneficiaries: project.beneficiary_count, operational_capacity: project.operational_capacity },
      kpis: { customers: customers.count || 0, meters: meters.count || 0, ocr_readings: r.filter((x: any) => x.ai_extracted_value !== null).length, anomalies: r.filter((x: any) => x.anomaly_flag).length, low_confidence: r.filter((x: any) => x.ai_extracted_value !== null && Number(x.ai_confidence || 0) < 80).length, production_m3_period: production, consumption_m3: consumption, total_billed: totalBilled, approved_collected: approvedCollected, outstanding, open_faults: (faults.data || []).length, open_interruptions: (interruptions.data || []).length },
      faults: faults.data || [], interruptions: interruptions.data || [], wells: wd,
    };
    const prompt = `أنت "مساعد ميزان" لمنصة استدامة خدمات المياه. أجب بالعربية من البيانات المرفقة فقط. لا تخترع رقماً أو اسماً أو سبباً غير موجود. إذا كانت البيانات غير كافية فقل ذلك. لا تنفذ أي تغيير. لا تصف فجوة الإنتاج والاستهلاك بأنها تسرب مؤكد. السؤال: ${question.trim()}\\n\\nبيانات المشروع المصرح بها:\\n${JSON.stringify(context)}`;

    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({ system_instruction: { parts: [{ text: 'كن دقيقاً ومختصراً، واذكر حدود البيانات عند الحاجة.' }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1200 } }),
    });
    if (!aiResponse.ok) return json({ error: 'تعذر الوصول إلى محرك الذكاء الاصطناعي' }, 502);
    const payload = await aiResponse.json();
    const answer = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim();
    if (!answer) return json({ error: 'لم ينتج محرك الذكاء الاصطناعي إجابة' }, 502);
    const { error: aiLogError } = await ctx.supabase.rpc('mizan_log_ai_interaction', {
      p_project_id: project_id,
      p_question: question,
      p_answer: answer,
      p_model: 'gemini-3.8-flash',
      p_success: true,
      p_error_message: null,
    });
    if (aiLogError) return json({ error: 'تعذر تسجيل نشاط المساعد الذكي' }, 502);
    return json({ answer, model: 'gemini-3.8-flash', data_context: { anomalies: context.kpis.anomalies, open_faults: context.kpis.open_faults, open_interruptions: context.kpis.open_interruptions } });
  }),
};