import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber, customerTypeLabels, meterStatusLabels } from '@/lib/utils';
import { Plus, Users, Gauge, Search, Phone, MapPin, Trash2, Ban, CheckCircle2, Home } from 'lucide-react';
import type { Customer, Meter } from '@/types';

type MeterRow = Meter & { customers?: Pick<Customer, 'name_ar' | 'customer_number'> | null };
type FormMode = 'customer-meter' | 'meter-existing';

export function CustomersPage() {
  const { currentProject } = useProject();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meters, setMeters] = useState<MeterRow[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<FormMode>('customer-meter');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true); setError(null);
    const pid = currentProject.id;
    try {
      const [c, m] = await Promise.all([
        supabase.from('customers').select('*').eq('project_id', pid).order('customer_number'),
        supabase.from('meters').select('*, customers(name_ar, customer_number)').eq('project_id', pid).order('meter_number'),
      ]);
      if (c.error) throw c.error;
      if (m.error) throw m.error;
      setCustomers((c.data || []) as Customer[]);
      setMeters((m.data || []) as MeterRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات المشتركين والعدادات');
    } finally { setLoading(false); }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => customers.map(c => ({
    customer: c,
    meter: meters.find(m => m.customer_id === c.id) || null,
  })), [customers, meters]);

  const filteredRows = rows.filter(({ customer, meter }) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [customer.name_ar, customer.customer_number, customer.phone || '', customer.address || '', meter?.meter_number || '', meter?.serial_number || '']
      .some(v => v.toLowerCase().includes(q));
  });

  const openNew = (newMode: FormMode = 'customer-meter', customerId = '') => {
    setMode(newMode);
    setForm(customerId ? { customer_id: customerId } : {});
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setFormError(null); setForm({}); };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true); setFormError(null);
    try {
      if (mode === 'customer-meter') {
        if (!form.name_ar?.trim()) throw new Error('اسم المشترك مطلوب');
        if ((form.meter_status || 'active') === 'active' && !form.meter_serial_number?.trim()) throw new Error('الرقم التسلسلي للعداد مطلوب للعداد النشط');
        const { error: rpcError } = await supabase.rpc('mizan_create_customer_with_meter', {
          p_project_id: currentProject.id,
          p_customer_name: form.name_ar,
          p_phone: form.phone || null,
          p_address: form.address || null,
          p_customer_type: form.customer_type || 'residential',
          p_customer_status: form.customer_status || 'active',
          p_household_members: Number(form.household_members || 0),
          p_connection_date: form.connection_date || null,
          p_notes: form.notes || null,
          p_meter_serial_number: form.meter_serial_number || null,
          p_meter_type: form.meter_type || 'mechanical',
          p_meter_size_mm: form.meter_size_mm ? Number(form.meter_size_mm) : null,
          p_meter_status: form.meter_status || 'active',
        });
        if (rpcError) throw rpcError;
      } else {
        if (!form.customer_id) throw new Error('اختر المشترك أولاً');
        if ((form.meter_status || 'active') === 'active' && !form.meter_serial_number?.trim()) throw new Error('الرقم التسلسلي للعداد مطلوب للعداد النشط');
        const { error: insertError } = await supabase.from('meters').insert({
          project_id: currentProject.id,
          customer_id: form.customer_id,
          serial_number: form.meter_serial_number || null,
          meter_type: form.meter_type || 'mechanical',
          size_mm: form.meter_size_mm ? Number(form.meter_size_mm) : null,
          status: form.meter_status || 'active',
        });
        if (insertError) throw insertError;
      }
      closeForm();
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'فشل حفظ البيانات');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشترك؟')) return;
    const { error: delError } = await supabase.from('customers').delete().eq('id', id);
    if (delError) setError('فشل حذف المشترك: ' + delError.message);
    else await fetchData();
  };

  const handleToggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'suspended' : 'active';
    const { error: updError } = await supabase.from('customers').update({ status: next }).eq('id', id);
    if (updError) setError('فشل تحديث الحالة: ' + updError.message);
    else await fetchData();
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">المشتركون والعدادات</h1>
          <p className="text-sm text-neutral-500 mt-1">سجل تشغيلي موحّد للمشترك والعداد والبيانات المرتبطة به — {currentProject.name_ar}</p>
        </div>
        <button onClick={() => openNew()} className="btn-primary"><Plus size={18} /> إضافة مشترك وعداد</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="flex items-center gap-3"><Users className="text-primary-600" size={20}/><div><p className="text-xs text-neutral-500">المشتركون</p><p className="text-xl font-bold">{customers.length}</p></div></div></div>
        <div className="card p-4"><div className="flex items-center gap-3"><Gauge className="text-primary-600" size={20}/><div><p className="text-xs text-neutral-500">العدادات</p><p className="text-xl font-bold">{meters.length}</p></div></div></div>
        <div className="card p-4"><div className="flex items-center gap-3"><Home className="text-primary-600" size={20}/><div><p className="text-xs text-neutral-500">أفراد الأسر</p><p className="text-xl font-bold">{customers.reduce((s,c)=>s+(c.household_members||0),0)}</p></div></div></div>
        <div className="card p-4"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={20}/><div><p className="text-xs text-neutral-500">عدادات نشطة</p><p className="text-xl font-bold">{meters.filter(m=>m.status==='active').length}</p></div></div></div>
      </div>

      <div className="relative max-w-xl">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
        <input className="input-field pr-10" placeholder="بحث بالاسم أو رقم المشترك أو رقم العداد أو الهاتف..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? <LoadingSpinner/> : error ? <ErrorState message={error} onRetry={fetchData}/> : filteredRows.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="لا توجد سجلات" description="أنشئ أول سجل مشترك + عداد ليبدأ المسار التشغيلي." action={{label:'إضافة مشترك وعداد',onClick:()=>openNew()}}/></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-right text-xs text-neutral-400 border-b bg-neutral-50">
              <th className="px-4 py-3">المشترك</th><th className="px-4 py-3">الهاتف والعنوان</th><th className="px-4 py-3">أفراد الأسرة</th>
              <th className="px-4 py-3">العداد</th><th className="px-4 py-3">المواصفات</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">إجراءات</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map(({customer, meter}) => (
                <tr key={customer.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3"><div className="font-semibold">{customer.name_ar}</div><div className="text-xs text-neutral-400">{customer.customer_number}</div><div className="text-xs text-neutral-500 mt-1">{customerTypeLabels[customer.customer_type]||customer.customer_type}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5">{customer.phone && <><Phone size={13}/>{customer.phone}</>}</div><div className="flex items-center gap-1.5 text-neutral-500 mt-1">{customer.address && <><MapPin size={13}/>{customer.address}</>}</div></td>
                  <td className="px-4 py-3 font-semibold">{customer.household_members ?? 0}</td>
                  <td className="px-4 py-3">{meter ? <><div className="font-semibold">{meter.meter_number}</div><div className="text-xs text-neutral-400">{meter.serial_number || 'لا يوجد رقم تسلسلي'}</div></> : <span className="text-neutral-400">غير مرتبط</span>}</td>
                  <td className="px-4 py-3 text-neutral-600">{meter ? <><div>{meter.meter_type==='mechanical'?'ميكانيكي':meter.meter_type==='digital'?'رقمي':'فوق صوتي'}</div><div className="text-xs">{meter.size_mm ? formatNumber(meter.size_mm) + ' مم' : '—'}</div></> : '—'}</td>
                  <td className="px-4 py-3"><div className="flex gap-1 flex-wrap"><Badge status={customer.status} label={customer.status==='active'?'نشط':customer.status==='suspended'?'موقف':'غير نشط'}/>{meter&&<Badge status={meter.status} label={meterStatusLabels[meter.status]||meter.status}/>}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100" title="إضافة عداد لهذا المشترك" onClick={()=>openNew('meter-existing',customer.id)}><Gauge size={16}/></button>
                    <button className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100" title={customer.status==='active'?'إيقاف المشترك':'تفعيل المشترك'} onClick={()=>handleToggleStatus(customer.id,customer.status)}>{customer.status==='active'?<Ban size={16}/>:<CheckCircle2 size={16}/>}</button>
                    <button className="p-2 rounded-lg text-error-500 hover:bg-error-50" title="حذف المشترك" onClick={()=>handleDelete(customer.id)}><Trash2 size={16}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={closeForm} title={mode==='customer-meter'?'إنشاء سجل مشترك + عداد':'إضافة عداد لمشترك موجود'} size="lg">
        <div className="mb-4 p-3 rounded-xl bg-primary-50 text-primary-800 text-sm">
          {mode==='customer-meter' ? 'سيتم توليد رقم المشترك ورقم العداد تلقائياً وربطهما في عملية واحدة.' : 'رقم العداد سيُولّد تلقائياً ويُربط بالمشترك المختار.'}
        </div>
        {mode==='customer-meter' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><h3 className="font-semibold text-neutral-800">بيانات المشترك</h3></div>
            <div><label className="label-field">الاسم *</label><input className="input-field" value={form.name_ar||''} onChange={e=>setForm({...form,name_ar:e.target.value})}/></div>
            <div><label className="label-field">الهاتف</label><input className="input-field" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
            <div><label className="label-field">نوع المشترك</label><select className="input-field" value={form.customer_type||'residential'} onChange={e=>setForm({...form,customer_type:e.target.value})}>{Object.entries(customerTypeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label-field">أفراد الأسرة</label><input type="number" min="0" className="input-field" value={form.household_members||''} onChange={e=>setForm({...form,household_members:e.target.value})} placeholder="عدد أفراد الأسرة"/></div>
            <div className="md:col-span-2"><label className="label-field">العنوان</label><input className="input-field" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></div>
            <div><label className="label-field">تاريخ الربط</label><input type="date" className="input-field" value={form.connection_date||''} onChange={e=>setForm({...form,connection_date:e.target.value})}/></div>
            <div><label className="label-field">الحالة</label><select className="input-field" value={form.customer_status||'active'} onChange={e=>setForm({...form,customer_status:e.target.value})}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="suspended">موقف</option></select></div>
            <div className="md:col-span-2"><label className="label-field">ملاحظات</label><textarea className="input-field min-h-20" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
            <div className="md:col-span-2 border-t pt-4"><h3 className="font-semibold text-neutral-800">بيانات العداد</h3></div>
            <div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={form.meter_serial_number||''} onChange={e=>setForm({...form,meter_serial_number:e.target.value})}/></div>
            <div><label className="label-field">النوع</label><select className="input-field" value={form.meter_type||'mechanical'} onChange={e=>setForm({...form,meter_type:e.target.value})}><option value="mechanical">ميكانيكي</option><option value="digital">رقمي</option><option value="ultrasonic">فوق صوتي</option></select></div>
            <div><label className="label-field">المقاس (مم)</label><input type="number" min="1" className="input-field" value={form.meter_size_mm||''} onChange={e=>setForm({...form,meter_size_mm:e.target.value})}/></div>
            <div><label className="label-field">حالة العداد</label><select className="input-field" value={form.meter_status||'active'} onChange={e=>setForm({...form,meter_status:e.target.value})}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="faulty">تالف</option><option value="replaced">مستبدل</option></select></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label-field">المشترك</label><select className="input-field" value={form.customer_id||''} onChange={e=>setForm({...form,customer_id:e.target.value})}>{customers.map(c=><option key={c.id} value={c.id}>{c.customer_number} — {c.name_ar}</option>)}</select></div>
            <div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={form.meter_serial_number||''} onChange={e=>setForm({...form,meter_serial_number:e.target.value})}/></div>
            <div><label className="label-field">النوع</label><select className="input-field" value={form.meter_type||'mechanical'} onChange={e=>setForm({...form,meter_type:e.target.value})}><option value="mechanical">ميكانيكي</option><option value="digital">رقمي</option><option value="ultrasonic">فوق صوتي</option></select></div>
            <div><label className="label-field">المقاس (مم)</label><input type="number" min="1" className="input-field" value={form.meter_size_mm||''} onChange={e=>setForm({...form,meter_size_mm:e.target.value})}/></div>
            <div><label className="label-field">الحالة</label><select className="input-field" value={form.meter_status||'active'} onChange={e=>setForm({...form,meter_status:e.target.value})}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="faulty">تالف</option><option value="replaced">مستبدل</option></select></div>
          </div>
        )}
        {formError&&<div className="mt-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{formError}</div>}
        <div className="flex gap-3 mt-6"><button onClick={closeForm} className="btn-secondary flex-1">إلغاء</button><button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving?'جاري الحفظ...':'حفظ السجل'}</button></div>
      </Modal>
    </div>
  );
}