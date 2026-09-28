import { useEffect, useMemo, useState } from 'react';
import { Users, Gauge, Plus, Search, Home, Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { customerTypeLabels, formatDate, formatNumber } from '@/lib/utils';
import type { Customer, Meter } from '@/types';

type MeterRow = Meter & { customers?: { name_ar:string; customer_number:string } | null };
type FormState = Record<string,string>;

export function CustomersPage() {
  const { currentProject } = useProject();
  const [customers,setCustomers] = useState<Customer[]>([]);
  const [meters,setMeters] = useState<MeterRow[]>([]);
  const [search,setSearch] = useState('');
  const [showForm,setShowForm] = useState(false);
  const [includeMeter,setIncludeMeter] = useState(true);
  const [form,setForm] = useState<FormState>({});
  const [saving,setSaving] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [formError,setFormError] = useState<string|null>(null);

  const load=async()=>{
    if(!currentProject){setLoading(false);return;}
    setLoading(true);setError(null);
    const [c,m]=await Promise.all([
      supabase.from('customers').select('*').eq('project_id',currentProject.id).order('customer_number'),
      supabase.from('meters').select('*, customers(name_ar, customer_number)').eq('project_id',currentProject.id).order('meter_number')
    ]);
    if(c.error||m.error)setError((c.error||m.error)?.message||'تعذر تحميل البيانات');
    else {setCustomers((c.data||[]) as Customer[]);setMeters((m.data||[]) as MeterRow[]);}
    setLoading(false);
  };
  useEffect(()=>{load()},[currentProject?.id]);

  const filteredCustomers=useMemo(()=>customers.filter(c=>{
    const q=search.trim().toLowerCase(); if(!q)return true;
    return [c.name_ar,c.customer_number,c.phone||'',c.address||''].some(v=>v.toLowerCase().includes(q));
  }),[customers,search]);

  const openForm=()=>{setForm({household_members:'1',customer_type:'residential',status:'active',meter_type:'mechanical',meter_status:'active'});setIncludeMeter(true);setFormError(null);setShowForm(true)};

  const save=async()=>{
    if(!currentProject)return;
    if(!form.name_ar?.trim()){setFormError('اسم المشترك مطلوب');return;}
    setSaving(true);setFormError(null);
    const {data,error:e}=await supabase.rpc('mizan_register_subscriber',{
      p_project_id:currentProject.id,p_name_ar:form.name_ar.trim(),p_phone:form.phone||null,p_address:form.address||null,
      p_customer_type:form.customer_type||'residential',p_status:form.status||'active',
      p_connection_date:form.connection_date||null,p_household_members:Number(form.household_members||1),
      p_notes:form.notes||null,p_meter_serial_number:includeMeter?(form.serial_number||null):null,
      p_meter_type:form.meter_type||'mechanical',p_meter_size_mm:form.size_mm?Number(form.size_mm):null,
      p_meter_status:form.meter_status||'active',p_meter_installation_date:form.meter_installation_date||null
    });
    if(e){setFormError(e.message);setSaving(false);return;}
    const customer=data?.customer as Customer|undefined;
    if(customer)setCustomers(v=>[...v,customer].sort((a,b)=>a.customer_number.localeCompare(b.customer_number)));
    if(data?.meter){
      const {data:m}=await supabase.from('meters').select('*, customers(name_ar, customer_number)').eq('id',data.meter.id).single();
      if(m)setMeters(v=>[...v,m as MeterRow].sort((a,b)=>a.meter_number.localeCompare(b.meter_number)));
    }
    setShowForm(false);setForm({});setSaving(false);
  };

  if(!currentProject)return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  return <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl font-bold text-neutral-900">المشتركون والعدادات</h1><p className="text-sm text-neutral-500 mt-1">سجل تشغيلي موحد: المشترك ← العداد ← القراءة ← الاستهلاك</p></div><button onClick={openForm} className="btn-primary"><Plus size={18}/> إضافة مشترك وعداد</button></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card p-4"><div className="text-sm text-neutral-500 flex items-center gap-2"><Users size={17}/> المشتركون</div><div className="text-2xl font-bold mt-2">{formatNumber(customers.length)}</div></div>
      <div className="card p-4"><div className="text-sm text-neutral-500 flex items-center gap-2"><Gauge size={17}/> العدادات</div><div className="text-2xl font-bold mt-2">{formatNumber(meters.length)}</div></div>
      <div className="card p-4"><div className="text-sm text-neutral-500 flex items-center gap-2"><Link2 size={17}/> مرتبطة بمشترك</div><div className="text-2xl font-bold mt-2">{formatNumber(meters.filter(m=>m.customer_id).length)}</div></div>
      <div className="card p-4"><div className="text-sm text-neutral-500 flex items-center gap-2"><Home size={17}/> أفراد الأسرة</div><div className="text-2xl font-bold mt-2">{formatNumber(customers.reduce((n,c)=>n+(c.household_members||0),0))}</div></div>
    </div>
    <div className="relative max-w-xl"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"/><input className="input-field pr-10" placeholder="بحث بالاسم أو رقم المشترك أو العداد أو الهاتف..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {loading?<LoadingSpinner/>:error?<ErrorState message={error} onRetry={load}/>:filteredCustomers.length===0?<div className="card"><EmptyState icon={Users} title="لا يوجد مشتركون" description="أضف أول سجل تشغيلي من النموذج الموحد" action={{label:'إضافة مشترك',onClick:openForm}}/></div>:
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right text-xs text-neutral-400 border-b bg-neutral-50"><th className="px-4 py-3">رقم المشترك</th><th className="px-4 py-3">الاسم</th><th className="px-4 py-3">الهاتف</th><th className="px-4 py-3">أفراد الأسرة</th><th className="px-4 py-3">العداد</th><th className="px-4 py-3">آخر قراءة</th><th className="px-4 py-3">الحالة</th></tr></thead>
    <tbody className="divide-y divide-neutral-100">{filteredCustomers.map(c=>{const m=meters.find(x=>x.customer_id===c.id);return <tr key={c.id} className="hover:bg-neutral-50"><td className="px-4 py-3 font-semibold">{c.customer_number}</td><td className="px-4 py-3 font-medium">{c.name_ar}</td><td className="px-4 py-3">{c.phone||'—'}</td><td className="px-4 py-3">{formatNumber(c.household_members||0)}</td><td className="px-4 py-3">{m?.meter_number||'غير مرتبط'}</td><td className="px-4 py-3">{m?.last_reading!=null?formatNumber(m.last_reading):'—'}</td><td className="px-4 py-3"><Badge status={c.status} label={c.status==='active'?'نشط':c.status}/></td></tr>})}</tbody></table></div>}
    <Modal open={showForm} onClose={()=>setShowForm(false)} title="إضافة مشترك وعداد" size="lg">
      <div className="mb-4 p-3 rounded-xl bg-primary-50 text-primary-800 text-sm">الأرقام والترميز تُنشأ آلياً من قاعدة البيانات. أدخل فقط البيانات الميدانية.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="label-field">رقم المشترك</label><div className="input-field bg-neutral-50 text-neutral-400">يُولّد تلقائياً</div></div>
        <div><label className="label-field">اسم المشترك *</label><input className="input-field" value={form.name_ar||''} onChange={e=>setForm({...form,name_ar:e.target.value})}/></div>
        <div><label className="label-field">الهاتف</label><input className="input-field" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
        <div><label className="label-field">أفراد الأسرة *</label><input type="number" min="1" className="input-field" value={form.household_members||'1'} onChange={e=>setForm({...form,household_members:e.target.value})}/></div>
        <div><label className="label-field">نوع المشترك</label><select className="input-field" value={form.customer_type||'residential'} onChange={e=>setForm({...form,customer_type:e.target.value})}>{Object.entries(customerTypeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label-field">تاريخ الربط</label><input type="date" className="input-field" value={form.connection_date||''} onChange={e=>setForm({...form,connection_date:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="label-field">العنوان</label><input className="input-field" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="label-field">ملاحظات</label><textarea className="input-field min-h-20" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        <div className="md:col-span-2 border-t pt-4"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={includeMeter} onChange={e=>setIncludeMeter(e.target.checked)}/> إنشاء وربط العداد الآن</label></div>
        {includeMeter&&<><div><label className="label-field">رقم العداد</label><div className="input-field bg-neutral-50 text-neutral-400">يُولّد تلقائياً</div></div><div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={form.serial_number||''} onChange={e=>setForm({...form,serial_number:e.target.value})}/></div><div><label className="label-field">نوع العداد</label><select className="input-field" value={form.meter_type||'mechanical'} onChange={e=>setForm({...form,meter_type:e.target.value})}><option value="mechanical">ميكانيكي</option><option value="digital">رقمي</option><option value="ultrasonic">فوق صوتي</option></select></div><div><label className="label-field">المقاس (مم)</label><input type="number" min="1" className="input-field" value={form.size_mm||''} onChange={e=>setForm({...form,size_mm:e.target.value})}/></div><div><label className="label-field">تاريخ التركيب</label><input type="date" className="input-field" value={form.meter_installation_date||''} onChange={e=>setForm({...form,meter_installation_date:e.target.value})}/></div><div><label className="label-field">حالة العداد</label><select className="input-field" value={form.meter_status||'active'} onChange={e=>setForm({...form,meter_status:e.target.value})}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="faulty">تالف</option><option value="replaced">مستبدل</option></select></div></>}
      </div>
      {formError&&<div className="mt-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{formError}</div>}
      <div className="flex gap-3 mt-6"><button className="btn-secondary flex-1" onClick={()=>setShowForm(false)}>إلغاء</button><button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving?<><Loader2 size={16} className="animate-spin"/> جاري الحفظ...</>:'حفظ السجل'}</button></div>
    </Modal>
  </div>;
}