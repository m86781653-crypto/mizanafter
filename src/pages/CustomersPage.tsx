import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber, formatDate, customerTypeLabels, meterStatusLabels } from '@/lib/utils';
import { Plus, Users, Gauge, Search, Phone, MapPin, Trash2, Ban, CheckCircle2, CalendarDays, Home } from 'lucide-react';
import type { Customer, Meter } from '@/types';

type CustomerWithMeter = Customer & { meter?: Meter | null };

export function CustomersPage() {
  const { currentProject } = useProject();
  const [customers, setCustomers] = useState<CustomerWithMeter[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('customers')
        .select('*, meters(*)')
        .eq('project_id', currentProject.id)
        .order('customer_number');
      if (queryError) throw queryError;

      setCustomers(((data as any[]) || []).map((customer) => ({
        ...customer,
        meter: Array.isArray(customer.meters) ? (customer.meters[0] || null) : (customer.meters || null),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء تحميل المشتركين');
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim();
    if (!q) return true;
    return c.name_ar.includes(q)
      || c.customer_number.includes(q)
      || (c.phone || '').includes(q)
      || (c.meter?.meter_number || '').includes(q)
      || (c.meter?.serial_number || '').includes(q);
  });

  const openForm = () => {
    setForm({
      customer_type: 'residential',
      status: 'active',
      subscription_date: new Date().toISOString().slice(0, 10),
      meter_type: 'mechanical',
      meter_status: 'active',
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    setFormError(null);

    try {
      if (!form.name_ar?.trim()) throw new Error('يرجى إدخال اسم المشترك');
      if (!form.meter_number?.trim()) throw new Error('يرجى إدخال رقم/هوية العداد');
      const household = form.household_members ? Number(form.household_members) : null;
      if (household !== null && (!Number.isInteger(household) || household < 1)) {
        throw new Error('عدد أفراد الأسرة يجب أن يكون رقماً صحيحاً لا يقل عن 1');
      }

      const { data: seqData, error: seqErr } = await supabase.rpc('next_project_seq_number', {
        seq_name: 'CUS',
        project_uuid: currentProject.id,
      });
      if (seqErr || !seqData) throw new Error('فشل توليد رقم المشترك: ' + (seqErr?.message || 'خطأ غير معروف'));

      const customerPayload: Record<string, unknown> = {
        project_id: currentProject.id,
        customer_number: seqData,
        name_ar: form.name_ar.trim(),
        customer_type: form.customer_type || 'residential',
        status: form.status || 'active',
        connection_date: form.subscription_date || new Date().toISOString().slice(0, 10),
        household_members: household,
      };
      if (form.phone?.trim()) customerPayload.phone = form.phone.trim();
      if (form.address?.trim()) customerPayload.address = form.address.trim();
      if (form.notes?.trim()) customerPayload.notes = form.notes.trim();

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert(customerPayload)
        .select('*')
        .single();
      if (customerError) throw customerError;

      const meterPayload: Record<string, unknown> = {
        project_id: currentProject.id,
        customer_id: customer.id,
        meter_number: form.meter_number.trim(),
        meter_type: form.meter_type || 'mechanical',
        status: form.meter_status || 'active',
        installation_date: form.subscription_date || null,
        last_reading: form.initial_reading ? Number(form.initial_reading) : 0,
        last_reading_date: form.initial_reading ? new Date(form.subscription_date || new Date()).toISOString() : null,
      };
      if (form.serial_number?.trim()) meterPayload.serial_number = form.serial_number.trim();
      if (form.size_mm) meterPayload.size_mm = Number(form.size_mm);

      const { data: meter, error: meterError } = await supabase
        .from('meters')
        .insert(meterPayload)
        .select('*')
        .single();

      if (meterError) {
        await supabase.from('customers').delete().eq('id', customer.id);
        throw new Error('فشل ربط العداد بالمشترك، ولم يتم الاحتفاظ بالمشترك: ' + meterError.message);
      }

      setCustomers((prev) => [...prev, { ...(customer as Customer), meter: meter as Meter }]);
      setShowForm(false);
      setForm({});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'فشل حفظ المشترك والعداد');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشترك؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    const { error: delError } = await supabase.from('customers').delete().eq('id', id);
    if (delError) {
      setError('فشل حذف المشترك: ' + delError.message);
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error: updError } = await supabase.from('customers').update({ status: newStatus }).eq('id', id);
    if (updError) {
      setError('فشل تحديث حالة المشترك: ' + updError.message);
      return;
    }
    setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">المشتركون</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar} — ملف المشترك والعداد في صفحة واحدة</p>
        </div>
        <button onClick={openForm} className="btn-primary"><Plus size={18} /> إضافة مشترك جديد</button>
      </div>

      <div className="relative max-w-xl">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input-field pr-10"
          placeholder="بحث باسم المشترك أو رقمه أو رقم/هوية العداد أو التسلسل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={fetchData} /> : filteredCustomers.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="لا يوجد مشتركين" description="أضف أول مشترك مع عداده من نفس الصفحة" action={{ label: 'إضافة مشترك', onClick: openForm }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => (
            <div key={c.id} className="card-hover p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><Users size={20} /></div>
                <div className="flex items-center gap-1.5">
                  <Badge status={c.status} label={c.status === 'active' ? 'نشط' : c.status === 'suspended' ? 'موقف' : 'غير نشط'} />
                  <button onClick={() => handleToggleStatus(c.id, c.status)} title={c.status === 'active' ? 'إيقاف المشترك' : 'تفعيل المشترك'} className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50">
                    {c.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                  <button onClick={() => handleDelete(c.id)} title="حذف المشترك" className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-neutral-900">{c.name_ar}</h3>
              <p className="text-xs text-neutral-400 mt-0.5">رقم المشترك: {c.customer_number}</p>

              <div className="space-y-2 text-sm mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">نوع المشترك</span>
                  <span className="font-medium">{customerTypeLabels[c.customer_type] || c.customer_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">أفراد الأسرة</span>
                  <span className="font-medium">{c.household_members ? formatNumber(c.household_members) : 'غير مسجل'}</span>
                </div>
                {c.phone && <div className="flex items-center gap-2 text-neutral-600"><Phone size={13} className="text-neutral-400" />{c.phone}</div>}
                {c.address && <div className="flex items-center gap-2 text-neutral-600"><MapPin size={13} className="text-neutral-400" />{c.address}</div>}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 flex items-center gap-1"><CalendarDays size={13} /> تاريخ الاشتراك</span>
                  <span className="text-neutral-600">{c.connection_date ? formatDate(c.connection_date) : 'غير مسجل'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-100 bg-neutral-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 text-primary-700 font-semibold"><Gauge size={16} /> العداد المرتبط</div>
                {c.meter ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-neutral-400">رقم/هوية العداد</span><p className="font-bold">{c.meter.meter_number}</p></div>
                    <div><span className="text-xs text-neutral-400">التسلسل</span><p className="font-medium">{c.meter.serial_number || '—'}</p></div>
                    <div><span className="text-xs text-neutral-400">آخر قراءة</span><p className="font-bold">{formatNumber(c.meter.last_reading)}</p></div>
                    <div><span className="text-xs text-neutral-400">الحالة</span><Badge status={c.meter.status} label={meterStatusLabels[c.meter.status] || c.meter.status} /></div>
                  </div>
                ) : (
                  <p className="text-sm text-warning-700 flex items-center gap-2"><Home size={14} /> لا يوجد عداد مرتبط</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={closeForm} title="إضافة مشترك جديد مع العداد">
        <div className="space-y-5">
          <div>
            <h3 className="font-bold text-neutral-800 mb-3">بيانات المشترك</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label-field">اسم المشترك *</label><input className="input-field" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="الاسم الكامل" /></div>
              <div><label className="label-field">الهاتف</label><input className="input-field" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77xxxxxxx" /></div>
              <div><label className="label-field">نوع المشترك</label><select className="input-field" value={form.customer_type || 'residential'} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>{Object.entries(customerTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label-field">عدد أفراد الأسرة</label><input type="number" min="1" step="1" className="input-field" value={form.household_members || ''} onChange={(e) => setForm({ ...form, household_members: e.target.value })} placeholder="مثال: 6" /></div>
              <div><label className="label-field">تاريخ الاشتراك *</label><input type="date" className="input-field" value={form.subscription_date || ''} onChange={(e) => setForm({ ...form, subscription_date: e.target.value })} /></div>
              <div><label className="label-field">الحالة</label><select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="suspended">موقف</option></select></div>
              <div className="md:col-span-2"><label className="label-field">العنوان</label><input className="input-field" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="الحي، الشارع، رقم المنزل..." /></div>
              <div className="md:col-span-2"><label className="label-field">ملاحظات</label><textarea className="input-field min-h-20" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-5">
            <h3 className="font-bold text-neutral-800 mb-3">بيانات العداد المرتبط</h3>
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-xs text-primary-800 mb-4">
              رقم/هوية العداد هنا هو الرقم الفعلي المطبوع على العداد، وسيُستخدم لاحقاً للتحقق من صورة العداد ميدانياً. لا ننشئ صفحة مستقلة للعدادات.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label-field">رقم/هوية العداد *</label><input className="input-field font-semibold" value={form.meter_number || ''} onChange={(e) => setForm({ ...form, meter_number: e.target.value })} placeholder="الرقم المطبوع على العداد" /></div>
              <div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={form.serial_number || ''} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="إن وجد" /></div>
              <div><label className="label-field">نوع العداد</label><select className="input-field" value={form.meter_type || 'mechanical'} onChange={(e) => setForm({ ...form, meter_type: e.target.value })}><option value="mechanical">ميكانيكي</option><option value="digital">رقمي</option><option value="ultrasonic">فوق صوتي</option></select></div>
              <div><label className="label-field">المقاس (مم)</label><input type="number" min="1" className="input-field" value={form.size_mm || ''} onChange={(e) => setForm({ ...form, size_mm: e.target.value })} placeholder="15" /></div>
              <div><label className="label-field">القراءة الابتدائية</label><input type="number" min="0" step="0.01" className="input-field" value={form.initial_reading || ''} onChange={(e) => setForm({ ...form, initial_reading: e.target.value })} placeholder="0" /></div>
              <div><label className="label-field">حالة العداد</label><select className="input-field" value={form.meter_status || 'active'} onChange={(e) => setForm({ ...form, meter_status: e.target.value })}><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="faulty">تالف</option><option value="replaced">مستبدل</option></select></div>
            </div>
          </div>

          {formError && <div className="p-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">{formError}</div>}
          <div className="flex gap-3">
            <button onClick={closeForm} disabled={saving} className="btn-secondary flex-1">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'جاري حفظ المشترك وربط العداد...' : 'حفظ المشترك والعداد'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
