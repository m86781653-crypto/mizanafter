import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Plus, ShieldAlert, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatDate, formatRelativeTime, severityLabels, faultStatusLabels } from '@/lib/utils';
import type { Fault } from '@/types';

type Interruption = {
  id:string; project_id:string; interruption_number:string; interruption_type:string;
  severity:string; status:string; cause_category:string|null; description:string|null;
  started_at:string; restored_at:string|null; closed_at:string|null;
  affected_subscribers:number; estimated_water_loss_m3:number; resolution_notes:string|null;
};
const interruptionLabels:Record<string,string>={service_stop:'توقف خدمة',pressure_drop:'انخفاض ضغط',production_stop:'توقف إنتاج',planned_shutdown:'توقف مخطط',emergency_shutdown:'توقف طارئ'};
const interruptionStatus:Record<string,string>={open:'مفتوح',investigating:'قيد التحقيق',mitigating:'قيد المعالجة',restored:'تمت الاستعادة',closed:'مغلق'};

export function FaultsOutagesPage(){
  const {currentProject}=useProject();
  const {profile}=useAuth();
  const [faults,setFaults]=useState<Fault[]>([]);
  const [interruptions,setInterruptions]=useState<Interruption[]>([]);
  const [tab,setTab]=useState<'faults'|'interruptions'>('faults');
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState<Record<string,string>>({});

  const load=async()=>{
    if(!currentProject){setLoading(false);return;}
    setLoading(true);setError(null);
    const [f,i]=await Promise.all([
      supabase.from('faults').select('*').eq('project_id',currentProject.id).order('reported_at',{ascending:false}),
      supabase.from('service_interruptions').select('*').eq('project_id',currentProject.id).order('started_at',{ascending:false})
    ]);
    if(f.error)setError(f.error.message);else if(i.error)setError(i.error.message);
    else{setFaults((f.data||[]) as Fault[]);setInterruptions((i.data||[]) as Interruption[]);}
    setLoading(false);
  };
  useEffect(()=>{load();},[currentProject]);

  const openFaults=useMemo(()=>faults.filter(x=>!['resolved','closed'].includes(x.status)),[faults]);
  const openStops=useMemo(()=>interruptions.filter(x=>!['restored','closed'].includes(x.status)),[interruptions]);
  const critical=useMemo(()=>openFaults.filter(x=>['critical','high'].includes(x.severity)).length+openStops.filter(x=>['critical','high'].includes(x.severity)).length,[openFaults,openStops]);

  const save=async()=>{
    if(!currentProject||!profile)return;
    setSaving(true);
    if(tab==='faults'){
      if(!form.fault_type?.trim()){setSaving(false);return;}
      const number='FLT-'+new Date().getFullYear()+'-'+Date.now().toString().slice(-7);
      const {data,error:e}=await supabase.from('faults').insert({project_id:currentProject.id,fault_number:number,fault_type:form.fault_type,severity:form.severity||'medium',status:'reported',description:form.description||null,reported_by:profile.full_name,reporter_type:'staff'}).select().single();
      if(!e&&data){setFaults(v=>[data as Fault,...v]);setShow(false);setForm({});}else setError(e?.message||'تعذر تسجيل العطل');
    }else{
      if(!form.description?.trim()){setSaving(false);return;}
      const number='INT-'+new Date().getFullYear()+'-'+Date.now().toString().slice(-7);
      const {data,error:e}=await supabase.from('service_interruptions').insert({project_id:currentProject.id,interruption_number:number,interruption_type:form.interruption_type||'service_stop',severity:form.severity||'medium',status:'open',description:form.description,cause_category:form.cause_category||null,started_at:form.started_at||new Date().toISOString(),affected_subscribers:Number(form.affected_subscribers||0),estimated_water_loss_m3:Number(form.water_loss||0),reported_by:profile.id}).select().single();
      if(!e&&data){setInterruptions(v=>[data as Interruption,...v]);setShow(false);setForm({});}else setError(e?.message||'تعذر تسجيل التوقف');
    }
    setSaving(false);
  };

  const updateInterruption=async(item:Interruption,status:string)=>{
    const updates:Record<string,unknown>={status};
    if(status==='restored')updates.restored_at=new Date().toISOString();
    if(status==='closed')updates.closed_at=new Date().toISOString();
    const {error:e}=await supabase.from('service_interruptions').update(updates).eq('id',item.id);
    if(e)setError(e.message);else setInterruptions(v=>v.map(x=>x.id===item.id?{...x,...updates} as Interruption:x));
  };

  if(!currentProject)return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if(loading)return <LoadingSpinner label="جاري تحميل الأعطال والتوقفات..." />;
  if(error)return <ErrorState message={error} onRetry={load} />;

  return <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-bold text-neutral-900">الأعطال والتوقفات</h1><p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p></div><button className="btn-primary" onClick={()=>{setForm({});setShow(true)}}><Plus size={18}/> تسجيل {tab==='faults'?'عطل':'توقف'}</button></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="أعطال مفتوحة" value={String(openFaults.length)} icon={AlertTriangle} color={openFaults.length?'error':'success'}/>
      <StatCard title="توقفات مفتوحة" value={String(openStops.length)} icon={Clock3} color={openStops.length?'warning':'success'}/>
      <StatCard title="حالات عالية/حرجة" value={String(critical)} icon={ShieldAlert} color={critical?'error':'success'}/>
      <StatCard title="إجمالي البلاغات" value={String(faults.length+interruptions.length)} icon={Wrench} color="primary"/>
    </div>
    <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
      <button onClick={()=>setTab('faults')} className={'px-4 py-2.5 rounded-lg text-sm '+(tab==='faults'?'bg-white shadow-sm font-semibold':'')}>الأعطال ({faults.length})</button>
      <button onClick={()=>setTab('interruptions')} className={'px-4 py-2.5 rounded-lg text-sm '+(tab==='interruptions'?'bg-white shadow-sm font-semibold':'')}>التوقفات ({interruptions.length})</button>
    </div>
    {tab==='faults'?<div className="space-y-3">{faults.map(f=><div key={f.id} className="card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 items-center flex-wrap"><b>{f.fault_number}</b><Badge status={f.severity} label={severityLabels[f.severity]||f.severity}/><Badge status={f.status} label={faultStatusLabels[f.status]||f.status}/></div><p className="text-sm text-neutral-700 mt-2">{f.description||'لا يوجد وصف'}</p><p className="text-xs text-neutral-400 mt-2">{f.fault_type||'—'} · {f.reported_by||'—'} · {formatRelativeTime(f.reported_at)}</p></div></div></div>)}</div>
    :<div className="space-y-3">{interruptions.map(x=><div key={x.id} className="card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 items-center flex-wrap"><b>{x.interruption_number}</b><Badge status={x.severity} label={severityLabels[x.severity]||x.severity}/><Badge status={x.status} label={interruptionStatus[x.status]||x.status}/></div><p className="text-sm font-medium mt-2">{interruptionLabels[x.interruption_type]||x.interruption_type}</p><p className="text-sm text-neutral-600 mt-1">{x.description||'لا يوجد وصف'}</p><p className="text-xs text-neutral-400 mt-2">بدأ: {formatDate(x.started_at)} · متأثرون: {x.affected_subscribers} · فاقد تقديري: {x.estimated_water_loss_m3} م³</p></div>{x.status!=='closed'&&<select value={x.status} onChange={e=>updateInterruption(x,e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white"><option value="open">مفتوح</option><option value="investigating">قيد التحقيق</option><option value="mitigating">قيد المعالجة</option><option value="restored">تمت الاستعادة</option><option value="closed">مغلق</option></select>}</div></div>)}</div>}
    {show&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"><div className="flex justify-between items-center mb-5"><h2 className="text-lg font-bold">تسجيل {tab==='faults'?'عطل':'توقف'}</h2><button onClick={()=>setShow(false)}>×</button></div>
      {tab==='faults'?<div className="space-y-3"><input className="input" placeholder="نوع العطل" value={form.fault_type||''} onChange={e=>setForm({...form,fault_type:e.target.value})}/><select className="input" value={form.severity||'medium'} onChange={e=>setForm({...form,severity:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select><textarea className="input min-h-24" placeholder="الوصف" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
      :<div className="space-y-3"><select className="input" value={form.interruption_type||'service_stop'} onChange={e=>setForm({...form,interruption_type:e.target.value})}>{Object.entries(interruptionLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select className="input" value={form.severity||'medium'} onChange={e=>setForm({...form,severity:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select><input className="input" type="datetime-local" value={form.started_at||''} onChange={e=>setForm({...form,started_at:e.target.value})}/><input className="input" type="number" min="0" placeholder="عدد المشتركين المتأثرين" value={form.affected_subscribers||''} onChange={e=>setForm({...form,affected_subscribers:e.target.value})}/><input className="input" type="number" min="0" placeholder="الفاقد المقدر م³" value={form.water_loss||''} onChange={e=>setForm({...form,water_loss:e.target.value})}/><textarea className="input min-h-24" placeholder="الوصف" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>}
      <div className="flex justify-end gap-2 mt-5"><button className="btn-secondary" onClick={()=>setShow(false)}>إلغاء</button><button className="btn-primary" disabled={saving} onClick={save}>{saving?'جاري الحفظ...':'حفظ'}</button></div>
    </div></div>}
  </div>;
}
