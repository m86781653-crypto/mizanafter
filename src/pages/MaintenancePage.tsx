import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Activity, Wrench, Boxes, Clock3, Plus, Printer, UserRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatDate, formatRelativeTime, formatCurrency, severityLabels, faultStatusLabels, workOrderStatusLabels, statusColor } from '@/lib/utils';
import type { Asset, Fault, Pump, Well, WorkOrder } from '@/types';

type Tab = 'overview' | 'faults' | 'outages' | 'workorders' | 'assets';
type Interruption = {
  id:string; project_id:string; interruption_number:string; interruption_type:string; severity:string; status:string;
  cause_category:string|null; cause_description:string|null; description:string|null; started_at:string;
  restored_at:string|null; closed_at:string|null; affected_subscribers:number; estimated_water_loss_m3:number;
  reported_by:string|null; resolution_notes:string|null;
};

const interruptionLabels:Record<string,string> = {
  service_stop:'توقف خدمة', pressure_drop:'انخفاض ضغط', production_stop:'توقف إنتاج',
  planned_shutdown:'توقف مخطط', emergency_shutdown:'توقف طارئ'
};
const interruptionStatuses:Record<string,string> = {
  open:'مفتوح', investigating:'قيد التحقيق', mitigating:'قيد المعالجة', restored:'تمت الاستعادة', closed:'مغلق'
};

export function MaintenancePage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const [tab,setTab] = useState<Tab>('overview');
  const [faults,setFaults] = useState<Fault[]>([]);
  const [interruptions,setInterruptions] = useState<Interruption[]>([]);
  const [workOrders,setWorkOrders] = useState<WorkOrder[]>([]);
  const [assets,setAssets] = useState<Asset[]>([]);
  const [wells,setWells] = useState<Well[]>([]);
  const [pumps,setPumps] = useState<Pump[]>([]);
  const [show,setShow] = useState(false);
  const [form,setForm] = useState<Record<string,string>>({});
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [formError,setFormError] = useState<string|null>(null);

  const load = useCallback(async()=>{
    if(!currentProject){setLoading(false);return;}
    setLoading(true);setError(null);
    const pid=currentProject.id;
    const [f,i,w,a,wl,p] = await Promise.all([
      supabase.from('faults').select('*').eq('project_id',pid).order('reported_at',{ascending:false}),
      supabase.from('service_interruptions').select('*').eq('project_id',pid).order('started_at',{ascending:false}),
      supabase.from('maintenance_work_orders').select('*, faults(fault_number,severity,description)').eq('project_id',pid).order('created_at',{ascending:false}),
      supabase.from('assets').select('*').eq('project_id',pid).order('asset_code'),
      supabase.from('wells').select('*').eq('project_id',pid).order('code'),
      supabase.from('pumps').select('*').eq('project_id',pid).order('code'),
    ]);
    const firstError=[f,i,w,a,wl,p].find(x=>x.error);
    if(firstError?.error){setError(firstError.error.message);}
    else{
      setFaults((f.data||[]) as Fault[]);
      setInterruptions((i.data||[]) as Interruption[]);
      setWorkOrders((w.data||[]) as WorkOrder[]);
      setAssets((a.data||[]) as Asset[]);
      setWells((wl.data||[]) as Well[]);
      setPumps((p.data||[]) as Pump[]);
    }
    setLoading(false);
  },[currentProject]);

  useEffect(()=>{load();},[load]);

  const openFaults=useMemo(()=>faults.filter(x=>!['resolved','closed'].includes(x.status)),[faults]);
  const openOutages=useMemo(()=>interruptions.filter(x=>!['restored','closed'].includes(x.status)),[interruptions]);
  const openOrders=useMemo(()=>workOrders.filter(x=>['open','in_progress'].includes(x.status)),[workOrders]);

  const openForm=(kind:Tab)=>{
    setTab(kind);setForm({});setFormError(null);setShow(true);
  };

  const createFault=async()=>{
    if(!currentProject||!profile||!form.fault_type?.trim())throw new Error('نوع العطل مطلوب');
    const { error: e } = await supabase.rpc('mizan_report_fault', {
      p_project_id: currentProject.id,
      p_fault_type: form.fault_type,
      p_severity: form.severity || 'medium',
      p_description: form.description || null,
      p_asset_id: form.asset_id || null,
      p_well_id: form.well_id || null,
      p_pump_id: form.pump_id || null,
    });
    if (e) throw e;
  };

  const createOutage=async()=>{
    if(!currentProject||!profile||!form.description?.trim())throw new Error('وصف التوقف مطلوب');
    const { error: e } = await supabase.from('service_interruptions').insert({
      project_id: currentProject.id,
      interruption_type: form.interruption_type || 'service_stop',
      severity: form.severity || 'medium',
      status: 'open',
      description: form.description,
      cause_category: form.cause_category || null,
      cause_description: form.cause_description || null,
      started_at: form.started_at || new Date().toISOString(),
      affected_subscribers: Number(form.affected_subscribers || 0),
      estimated_water_loss_m3: Number(form.water_loss || 0),
      reported_by: profile.id
    });
    if (e) throw e;
  };

  const createWorkOrder=async()=>{
    if(!currentProject||!form.description?.trim())throw new Error('وصف أمر الصيانة مطلوب');
    const {error:e}=await supabase.rpc('mizan_create_work_order',{
      p_project_id:currentProject.id,p_description:form.description,p_type:form.type||'corrective',
      p_priority:form.priority||'medium',p_assigned_to:null,p_scheduled_date:form.scheduled_date||null,
      p_fault_id:form.fault_id||null,p_asset_id:form.asset_id||null,p_well_id:form.well_id||null,p_pump_id:form.pump_id||null
    });
    if(e)throw e;
  };

  const createAsset=async()=>{
    if(!currentProject||!form.name_ar?.trim())throw new Error('اسم الأصل مطلوب');
    const {error:e}=await supabase.from('assets').insert({
      project_id:currentProject.id,name_ar:form.name_ar,category:form.category||null,type:form.type||null,
      manufacturer:form.manufacturer||null,model:form.model||null,serial_number:form.serial_number||null,
      status:form.status||'operational',purchase_cost:form.purchase_cost?Number(form.purchase_cost):null,
      expected_lifespan_years:form.expected_lifespan_years?Number(form.expected_lifespan_years):null,
      purchase_date:form.purchase_date||null,installation_date:form.installation_date||null
    });
    if(e)throw e;
  };

  const save=async()=>{
    setSaving(true);setFormError(null);
    try{
      if(tab==='faults')await createFault();
      else if(tab==='outages')await createOutage();
      else if(tab==='workorders')await createWorkOrder();
      else if(tab==='assets')await createAsset();
      else throw new Error('اختر نوع العملية');
      setShow(false);setForm({});await load();
    }catch(e){setFormError(e instanceof Error?e.message:'تعذر حفظ العملية');}
    finally{setSaving(false);}
  };

  const updateFault=async(f:Fault,status:string)=>{
    
    const { error: e } = await supabase.rpc('mizan_update_fault_status', {
      p_fault_id: f.id,
      p_status: status,
      p_resolution_notes: updates.resolution_notes ? String(updates.resolution_notes) : null,
    });
    if(e)setError(e.message);else await load();
  };

  const updateOutage=async(x:Interruption,status:string)=>{
    const updates:Record<string,unknown>={status};
    if(status==='restored')updates.restored_at=new Date().toISOString();
    if(status==='closed')updates.closed_at=new Date().toISOString();
    const { error: e } = await supabase.rpc('mizan_update_service_interruption_status', {
      p_interruption_id: x.id,
      p_status: status,
      p_resolution_notes: null,
    });
    if(e)setError(e.message);else await load();
  };

  const assignOrder=async(wo:WorkOrder)=>{
    const name=window.prompt('اسم الشخص الذي سيجري الصيانة',wo.assigned_to||'');
    if(!name?.trim())return;
    const {error:e}=await supabase.rpc('mizan_assign_work_order',{p_work_order_id:wo.id,p_assigned_to:name.trim(),p_scheduled_date:wo.scheduled_date||null});
    if(e)setError(e.message);else await load();
  };

  const updateOrder=async(wo:WorkOrder,status:string)=>{
    const {error:e}=await supabase.rpc('mizan_update_work_order_status',{p_work_order_id:wo.id,p_status:status});
    if(e)setError(e.message);else await load();
  };

  const printMemo=async(wo:WorkOrder)=>{
    if(!currentProject)return;
    const linkedFault=faults.find(f=>f.id===wo.fault_id);
    const issuedAt=new Date().toLocaleString('ar-YE');
    const w=window.open('','_blank','noopener,noreferrer');
    if(!w){setError('تعذر فتح نافذة المذكرة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');return;}
    w.document.write('<html dir="rtl"><head><title>مذكرة صيانة '+wo.work_order_number+'</title><style>body{font-family:Arial,sans-serif;padding:36px;color:#111}h1{text-align:center;font-size:22px;margin-bottom:4px}h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px;margin-top:26px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f7f7f7;padding:14px;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:8px;text-align:right}.sign{margin-top:60px;display:flex;justify-content:space-between}small{color:#666}</style></head><body>');
    w.document.write('<h1>مذكرة صيانة</h1><div style="text-align:center">'+currentProject.name_ar+'</div>');
    w.document.write('<h2>بيانات أمر الصيانة</h2><div class="meta"><div><b>رقم الأمر:</b> '+wo.work_order_number+'</div><div><b>النوع:</b> '+wo.type+'</div><div><b>الأولوية:</b> '+wo.priority+'</div><div><b>الحالة:</b> '+(workOrderStatusLabels[wo.status]||wo.status)+'</div><div><b>المنفذ:</b> '+(wo.assigned_to||'لم يخصص بعد')+'</div><div><b>التاريخ المجدول:</b> '+(wo.scheduled_date||'—')+'</div></div>');
    w.document.write('<h2>وصف العمل</h2><p>'+((wo.description||'').replace(/</g,'&lt;'))+'</p>');
    if(linkedFault)w.document.write('<h2>العطل المرتبط</h2><p><b>'+linkedFault.fault_number+'</b> — '+(linkedFault.description||linkedFault.fault_type||'عطل مسجل')+'</p>');
    w.document.write('<h2>نتيجة التنفيذ</h2><p>يُستكمل هذا القسم عند انتهاء العمل، مع تسجيل الأجزاء المستخدمة والتكلفة ومدة التوقف والملاحظات في النظام.</p>');
    w.document.write('<div class="sign"><div>مدير المشروع: __________________</div><div>منفذ الصيانة: __________________</div></div><p><small>تاريخ إصدار المذكرة: '+issuedAt+' · MIZAN AI</small></p></body></html>');
    w.document.close();w.focus();w.print();
    const {error:e}=await supabase.rpc('mizan_mark_work_order_memo_issued',{p_work_order_id:wo.id});
    if(!e)await load();
  };

  if(!currentProject)return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if(loading)return <LoadingSpinner label="جاري تحميل التشغيل والصيانة..." />;
  if(error)return <ErrorState message={error} onRetry={load}/>;

  return <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-2xl font-bold text-neutral-900">التشغيل والصيانة</h1><p className="text-sm text-neutral-500 mt-1">إدارة الأعطال والتوقفات وأوامر الصيانة والأصول في سجل تشغيلي مترابط — {currentProject.name_ar}</p></div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={()=>openForm('faults')}><Plus size={18}/> تسجيل عطل</button>
        <button className="btn-secondary" onClick={()=>openForm('outages')}><Clock3 size={18}/> تسجيل توقف</button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard title="أعطال مفتوحة" value={String(openFaults.length)} icon={AlertTriangle} color={openFaults.length?'error':'success'}/>
      <StatCard title="توقفات مفتوحة" value={String(openOutages.length)} icon={Activity} color={openOutages.length?'warning':'success'}/>
      <StatCard title="أوامر صيانة نشطة" value={String(openOrders.length)} icon={Wrench} color={openOrders.length?'warning':'success'}/>
      <StatCard title="الأصول" value={String(assets.length)} icon={Boxes} color="primary"/>
      <StatCard title="أوامر مكتملة" value={String(workOrders.filter(x=>x.status==='completed').length)} icon={CheckCircle2} color="success"/>
    </div>

    <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-full overflow-x-auto">
      {([['overview','نظرة تشغيلية'],['faults','الأعطال'],['outages','التوقفات'],['workorders','أوامر الصيانة'],['assets','الأصول']] as [Tab,string][]).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'px-4 py-2.5 rounded-lg text-sm whitespace-nowrap '+(tab===id?'bg-white shadow-sm font-semibold text-primary-700':'text-neutral-500')}>{label}</button>)}
    </div>

    {tab==='overview'&&<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card p-5"><h2 className="font-bold mb-4">الأعمال التي تحتاج متابعة</h2>{openOrders.slice(0,6).map(wo=><div key={wo.id} className="border-b last:border-0 py-3"><div className="flex justify-between gap-3"><b>{wo.work_order_number}</b><Badge status={statusColor(wo.status)} label={workOrderStatusLabels[wo.status]||wo.status}/></div><p className="text-sm mt-1">{wo.description||'—'}</p><p className="text-xs text-neutral-400 mt-1">{wo.assigned_to||'لم يخصص منفذ بعد'}</p></div>)}{openOrders.length===0&&<EmptyState icon={CheckCircle2} title="لا توجد أعمال مفتوحة" description="الحالة التشغيلية مستقرة حالياً."/>}</div>
      <div className="card p-5"><h2 className="font-bold mb-4">آخر الأعطال والتوقفات</h2>{[...faults.slice(0,3).map(x=>({number:x.fault_number,desc:x.description||x.fault_type,status:x.status,date:x.reported_at})),...interruptions.slice(0,3).map(x=>({number:x.interruption_number,desc:x.description||interruptionLabels[x.interruption_type],status:x.status,date:x.started_at}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(x=><div key={x.number} className="border-b last:border-0 py-3"><div className="flex justify-between"><b>{x.number}</b><span className="text-xs text-neutral-400">{formatRelativeTime(x.date)}</span></div><p className="text-sm mt-1">{x.desc}</p><p className="text-xs text-neutral-500 mt-1">{faultStatusLabels[x.status]||interruptionStatuses[x.status]||x.status}</p></div>)}</div>
    </div>}

    {tab==='faults'&&<div className="space-y-3">{faults.length===0?<div className="card"><EmptyState icon={AlertTriangle} title="لا توجد أعطال" description="سجل العطل من هنا، وسيُنشئ النظام أمر الصيانة تلقائياً." action={{label:'تسجيل عطل',onClick:()=>openForm('faults')}}/></div>:faults.map(f=><div className="card p-4" key={f.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex gap-2 items-center flex-wrap"><b>{f.fault_number}</b><Badge status={f.severity} label={severityLabels[f.severity]||f.severity}/><Badge status={f.status} label={faultStatusLabels[f.status]||f.status}/></div><p className="text-sm mt-2">{f.description||f.fault_type||'—'}</p><p className="text-xs text-neutral-400 mt-1">{f.reported_by||'—'} · {formatRelativeTime(f.reported_at)}</p></div><select className="input-field w-auto" value={f.status} onChange={e=>updateFault(f,e.target.value)}><option value="reported">مبلغ عنه</option><option value="verified">تم التحقق</option><option value="in_progress">قيد المعالجة</option><option value="resolved">تم الحل</option><option value="closed">مغلق</option></select></div></div>)}</div>}

    {tab==='outages'&&<div className="space-y-3">{interruptions.length===0?<div className="card"><EmptyState icon={Clock3} title="لا توجد توقفات" description="سجل توقف الخدمة أو الإنتاج مع بيانات الأثر والفاقد." action={{label:'تسجيل توقف',onClick:()=>openForm('outages')}}/></div>:interruptions.map(x=><div className="card p-4" key={x.id}><div className="flex flex-wrap justify-between gap-4"><div><div className="flex gap-2 items-center"><b>{x.interruption_number}</b><Badge status={x.severity} label={severityLabels[x.severity]||x.severity}/><Badge status={x.status} label={interruptionStatuses[x.status]||x.status}/></div><p className="font-medium mt-2">{interruptionLabels[x.interruption_type]||x.interruption_type}</p><p className="text-sm text-neutral-600 mt-1">{x.description||'—'}</p><p className="text-xs text-neutral-400 mt-2">بدأ {formatDate(x.started_at)} · المتأثرون {x.affected_subscribers} · الفاقد {x.estimated_water_loss_m3} م³</p></div><select className="input-field w-auto h-fit" value={x.status} onChange={e=>updateOutage(x,e.target.value)}>{Object.entries(interruptionStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></div>)}</div>}

    {tab==='workorders'&&<div className="space-y-3"><div className="flex justify-end"><button className="btn-primary" onClick={()=>openForm('workorders')}><Plus size={18}/> أمر صيانة جديد</button></div>{workOrders.length===0?<div className="card"><EmptyState icon={Wrench} title="لا توجد أوامر صيانة" description="العطل الجديد ينشئ أمراً تصحيحياً تلقائياً." /></div>:workOrders.map(wo=><div className="card p-4" key={wo.id}><div className="flex flex-wrap justify-between gap-4"><div><div className="flex gap-2 items-center flex-wrap"><b>{wo.work_order_number}</b><Badge status={statusColor(wo.priority)} label={'أولوية '+(wo.priority||'medium')}/><Badge status={statusColor(wo.status)} label={workOrderStatusLabels[wo.status]||wo.status}/></div><p className="text-sm mt-2">{wo.description||'—'}</p><p className="text-xs text-neutral-500 mt-2 flex items-center gap-2"><UserRound size={13}/>{wo.assigned_to||'لم يخصص منفذ بعد'} {wo.scheduled_date?' · '+wo.scheduled_date:''}</p>{wo.memo_issued_at&&<p className="text-xs text-emerald-600 mt-1">مذكرة صيانة صادرة · الإصدار {wo.memo_version}</p>}</div><div className="flex flex-wrap gap-2 h-fit"><button className="btn-secondary" onClick={()=>assignOrder(wo)}>تخصيص المنفذ</button><button className="btn-secondary" onClick={()=>printMemo(wo)}><Printer size={16}/> مذكرة صيانة</button><select className="input-field w-auto" value={wo.status} onChange={e=>updateOrder(wo,e.target.value)}><option value="open">مفتوح</option><option value="in_progress">قيد المعالجة</option><option value="completed">تم الحل</option><option value="cancelled">ملغى</option></select></div></div></div>)}</div>}

    {tab==='assets'&&<div className="space-y-3"><div className="flex justify-end"><button className="btn-primary" onClick={()=>openForm('assets')}><Plus size={18}/> إضافة أصل</button></div><div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right text-xs text-neutral-400 bg-neutral-50 border-b"><th className="px-4 py-3">الرمز</th><th className="px-4 py-3">الأصل</th><th className="px-4 py-3">التصنيف</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">التكلفة</th></tr></thead><tbody className="divide-y">{assets.map(a=><tr key={a.id}><td className="px-4 py-3 font-semibold">{a.asset_code}</td><td className="px-4 py-3">{a.name_ar}</td><td className="px-4 py-3">{a.category||'—'}</td><td className="px-4 py-3"><Badge status={a.status} label={a.status}/></td><td className="px-4 py-3">{a.purchase_cost?formatCurrency(a.purchase_cost):'—'}</td></tr>)}</tbody></table></div></div>}

    <Modal open={show} onClose={()=>setShow(false)} title={tab==='faults'?'تسجيل عطل':tab==='outages'?'تسجيل توقف خدمة':tab==='workorders'?'إنشاء أمر صيانة':'إضافة أصل'} size="lg">
      {tab==='faults'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">نوع العطل *</label><select className="input-field" value={form.fault_type||''} onChange={e=>setForm({...form,fault_type:e.target.value})}><option value="">— اختر —</option><option value="pump_failure">عطل مضخة</option><option value="pipe_leak">تسريب</option><option value="electrical">كهربائي</option><option value="meter_issue">عداد</option><option value="water_quality">جودة المياه</option><option value="other">أخرى</option></select></div>
        <div><label className="label-field">الخطورة</label><select className="input-field" value={form.severity||'medium'} onChange={e=>setForm({...form,severity:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select></div>
        <div><label className="label-field">المضخة</label><select className="input-field" value={form.pump_id||''} onChange={e=>setForm({...form,pump_id:e.target.value})}><option value="">—</option>{pumps.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></div>
        <div><label className="label-field">البئر</label><select className="input-field" value={form.well_id||''} onChange={e=>setForm({...form,well_id:e.target.value})}><option value="">—</option>{wells.map(w=><option key={w.id} value={w.id}>{w.code} — {w.name_ar}</option>)}</select></div>
        <div><label className="label-field">الأصل</label><select className="input-field" value={form.asset_id||''} onChange={e=>setForm({...form,asset_id:e.target.value})}><option value="">—</option>{assets.map(a=><option key={a.id} value={a.id}>{a.asset_code} — {a.name_ar}</option>)}</select></div>
        <div className="md:col-span-2"><label className="label-field">الوصف</label><textarea className="input-field min-h-24" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
      </div>}
      {tab==='outages'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">نوع التوقف</label><select className="input-field" value={form.interruption_type||'service_stop'} onChange={e=>setForm({...form,interruption_type:e.target.value})}>{Object.entries(interruptionLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label-field">الخطورة</label><select className="input-field" value={form.severity||'medium'} onChange={e=>setForm({...form,severity:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select></div>
        <div><label className="label-field">وقت البداية</label><input className="input-field" type="datetime-local" value={form.started_at||''} onChange={e=>setForm({...form,started_at:e.target.value})}/></div>
        <div><label className="label-field">المشتركون المتأثرون</label><input className="input-field" type="number" min="0" value={form.affected_subscribers||''} onChange={e=>setForm({...form,affected_subscribers:e.target.value})}/></div>
        <div><label className="label-field">الفاقد التقديري (م³)</label><input className="input-field" type="number" min="0" value={form.water_loss||''} onChange={e=>setForm({...form,water_loss:e.target.value})}/></div>
        <div><label className="label-field">تصنيف السبب</label><input className="input-field" value={form.cause_category||''} onChange={e=>setForm({...form,cause_category:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="label-field">الوصف</label><textarea className="input-field min-h-24" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
      </div>}
      {tab==='workorders'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">النوع</label><select className="input-field" value={form.type||'corrective'} onChange={e=>setForm({...form,type:e.target.value})}><option value="corrective">تصحيحي</option><option value="preventive">وقائي</option><option value="emergency">طارئ</option></select></div>
        <div><label className="label-field">الأولوية</label><select className="input-field" value={form.priority||'medium'} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="urgent">عاجل</option></select></div>
        <div><label className="label-field">العطل المرتبط</label><select className="input-field" value={form.fault_id||''} onChange={e=>setForm({...form,fault_id:e.target.value})}><option value="">—</option>{faults.filter(f=>!['closed','resolved'].includes(f.status)).map(f=><option key={f.id} value={f.id}>{f.fault_number} — {f.fault_type}</option>)}</select></div>
        <div><label className="label-field">الأصل</label><select className="input-field" value={form.asset_id||''} onChange={e=>setForm({...form,asset_id:e.target.value})}><option value="">—</option>{assets.map(a=><option key={a.id} value={a.id}>{a.asset_code} — {a.name_ar}</option>)}</select></div>
        <div><label className="label-field">البئر</label><select className="input-field" value={form.well_id||''} onChange={e=>setForm({...form,well_id:e.target.value})}><option value="">—</option>{wells.map(w=><option key={w.id} value={w.id}>{w.code}</option>)}</select></div>
        <div><label className="label-field">المضخة</label><select className="input-field" value={form.pump_id||''} onChange={e=>setForm({...form,pump_id:e.target.value})}><option value="">—</option>{pumps.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></div>
        <div><label className="label-field">التاريخ المجدول</label><input className="input-field" type="date" value={form.scheduled_date||''} onChange={e=>setForm({...form,scheduled_date:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="label-field">الوصف *</label><textarea className="input-field min-h-24" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
        <div className="md:col-span-2 text-xs text-neutral-500">اسم المنفذ لا يُدخل هنا؛ مدير المشروع يخصصه من سجل أمر الصيانة بعد الإنشاء.</div>
      </div>}
      {tab==='assets'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">رمز الأصل</label><div className="input-field bg-neutral-50 text-neutral-400">يُولّد تلقائياً</div></div>
        <div><label className="label-field">الاسم *</label><input className="input-field" value={form.name_ar||''} onChange={e=>setForm({...form,name_ar:e.target.value})}/></div>
        <div><label className="label-field">التصنيف</label><select className="input-field" value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}><option value="">—</option><option value="pump">مضخة</option><option value="electrical">كهربائي</option><option value="pipe">أنبوب</option><option value="valve">صمام</option><option value="meter">عداد</option><option value="generator">مولدة</option><option value="other">أخرى</option></select></div>
        <div><label className="label-field">النوع</label><input className="input-field" value={form.type||''} onChange={e=>setForm({...form,type:e.target.value})}/></div>
        <div><label className="label-field">المصنع</label><input className="input-field" value={form.manufacturer||''} onChange={e=>setForm({...form,manufacturer:e.target.value})}/></div>
        <div><label className="label-field">الموديل</label><input className="input-field" value={form.model||''} onChange={e=>setForm({...form,model:e.target.value})}/></div>
        <div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={form.serial_number||''} onChange={e=>setForm({...form,serial_number:e.target.value})}/></div>
        <div><label className="label-field">الحالة</label><select className="input-field" value={form.status||'operational'} onChange={e=>setForm({...form,status:e.target.value})}><option value="operational">يعمل</option><option value="needs_repair">يحتاج صيانة</option><option value="out_of_service">خارج الخدمة</option><option value="retired">متقاعد</option></select></div>
        <div><label className="label-field">التكلفة</label><input type="number" className="input-field" value={form.purchase_cost||''} onChange={e=>setForm({...form,purchase_cost:e.target.value})}/></div>
        <div><label className="label-field">العمر المتوقع (سنوات)</label><input type="number" className="input-field" value={form.expected_lifespan_years||''} onChange={e=>setForm({...form,expected_lifespan_years:e.target.value})}/></div>
        <div><label className="label-field">تاريخ الشراء</label><input type="date" className="input-field" value={form.purchase_date||''} onChange={e=>setForm({...form,purchase_date:e.target.value})}/></div>
        <div><label className="label-field">تاريخ التركيب</label><input type="date" className="input-field" value={form.installation_date||''} onChange={e=>setForm({...form,installation_date:e.target.value})}/></div>
      </div>}
      {formError&&<div className="mt-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{formError}</div>}
      <div className="flex gap-3 mt-6"><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>إلغاء</button><button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving?'جاري الحفظ...':'حفظ'}</button></div>
    </Modal>
  </div>;
}