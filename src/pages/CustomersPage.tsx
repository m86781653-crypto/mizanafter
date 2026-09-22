import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNumber, formatDate, customerTypeLabels, meterStatusLabels } from '@/lib/utils';
import { Plus, Users, Gauge, Search, Phone, MapPin } from 'lucide-react';
import type { Customer, Meter } from '@/types';

type Tab = 'customers' | 'meters';

export function CustomersPage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentProject) return;
    const pid = currentProject.id;
    (async () => {
      const [c, m] = await Promise.all([
        supabase.from('customers').select('*').eq('project_id', pid).order('customer_number'),
        supabase.from('meters').select('*, customers(name_ar, customer_number)').eq('project_id', pid).order('meter_number'),
      ]);
      setCustomers(c.data as Customer[] || []);
      setMeters(m.data as any[] || []);
    })();
  }, [currentProject]);

  const filteredCustomers = customers.filter(c =>
    !search || c.name_ar.includes(search) || c.customer_number.includes(search) || (c.phone || '').includes(search)
  );

  const filteredMeters = (meters as any[]).filter(m =>
    !search || m.meter_number.includes(search) || (m.customers?.name_ar || '').includes(search)
  );

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    const pid = currentProject.id;
    if (tab === 'customers') {
      if (!form.customer_number || !form.name_ar) { setSaving(false); return; }
      const payload: Record<string, unknown> = {
        project_id: pid,
        customer_number: form.customer_number,
        name_ar: form.name_ar,
        customer_type: form.customer_type || 'residential',
        status: form.status || 'active',
      };
      if (form.phone) payload.phone = form.phone;
      if (form.address) payload.address = form.address;
      const { data } = await supabase.from('customers').insert(payload).select().single();
      if (data) { setCustomers([...customers, data as Customer]); setShowForm(false); setForm({}); }
    } else {
      if (!form.meter_number) { setSaving(false); return; }
      const payload: Record<string, unknown> = {
        project_id: pid,
        meter_number: form.meter_number,
        meter_type: form.meter_type || 'mechanical',
        status: form.status || 'active',
      };
      if (form.customer_id) payload.customer_id = form.customer_id;
      if (form.serial_number) payload.serial_number = form.serial_number;
      if (form.size_mm) payload.size_mm = parseInt(form.size_mm);
      const { data } = await supabase.from('meters').insert(payload).select('*, customers(name_ar, customer_number)').single();
      if (data) { setMeters([...meters, data as any]); setShowForm(false); setForm({}); }
    }
    setSaving(false);
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">المشتركين والعدادات</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
        </div>
        <button onClick={() => { setForm({}); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /> إضافة {tab === 'customers' ? 'مشترك' : 'عداد'}
        </button>
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('customers')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'customers' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>
          <Users size={16} /> المشتركين
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'customers' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200'}`}>{customers.length}</span>
        </button>
        <button onClick={() => setTab('meters')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'meters' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>
          <Gauge size={16} /> العدادات
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'meters' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200'}`}>{meters.length}</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input className="input-field pr-10" placeholder="بحث بالاسم أو الرقم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {tab === 'customers' ? (
        filteredCustomers.length === 0 ? (
          <div className="card"><EmptyState icon={Users} title="لا يوجد مشتركين" description="أضف أول مشترك لبدء إدارة الخدمة" action={{ label: 'إضافة مشترك', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((c) => (
              <div key={c.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><Users size={20} /></div>
                  <Badge status={c.status} label={c.status === 'active' ? 'نشط' : 'غير نشط'} />
                </div>
                <h3 className="font-bold text-neutral-900">{c.name_ar}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{c.customer_number}</p>
                <div className="space-y-1.5 text-sm mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">النوع</span>
                    <span className="font-medium text-neutral-700">{customerTypeLabels[c.customer_type] || c.customer_type}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Phone size={13} className="text-neutral-400" /> {c.phone}
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2 text-neutral-600">
                      <MapPin size={13} className="text-neutral-400" /> {c.address}
                    </div>
                  )}
                  {c.connection_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">تاريخ الربط</span>
                      <span className="text-neutral-600">{formatDate(c.connection_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredMeters.length === 0 ? (
          <div className="card"><EmptyState icon={Gauge} title="لا توجد عدادات" description="أضف أول عداد لبدء تسجيل القراءات" action={{ label: 'إضافة عداد', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">رقم العداد</th>
                  <th className="px-4 py-3 font-medium">المشترك</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">المقاس (مم)</th>
                  <th className="px-4 py-3 font-medium">آخر قراءة</th>
                  <th className="px-4 py-3 font-medium">تاريخ القراءة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMeters.map((m: any) => (
                  <tr key={m.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{m.meter_number}</td>
                    <td className="px-4 py-3 text-neutral-600">{m.customers?.name_ar || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{m.meter_type === 'mechanical' ? 'ميكانيكي' : m.meter_type === 'digital' ? 'رقمي' : m.meter_type}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(m.size_mm)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(m.last_reading)}</td>
                    <td className="px-4 py-3 text-neutral-600">{m.last_reading_date ? formatDate(m.last_reading_date) : '—'}</td>
                    <td className="px-4 py-3"><Badge status={m.status} label={meterStatusLabels[m.status] || m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={tab === 'customers' ? 'إضافة مشترك جديد' : 'إضافة عداد جديد'}>
        {tab === 'customers' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">رقم المشترك *</label>
              <input className="input-field" value={form.customer_number || ''} onChange={(e) => setForm({ ...form, customer_number: e.target.value })} placeholder="C-0006" />
            </div>
            <div>
              <label className="label-field">الاسم *</label>
              <input className="input-field" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="الاسم الكامل" />
            </div>
            <div>
              <label className="label-field">الهاتف</label>
              <input className="input-field" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="077xxxxxxx" />
            </div>
            <div>
              <label className="label-field">نوع المشترك</label>
              <select className="input-field" value={form.customer_type || 'residential'} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
                {Object.entries(customerTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-field">العنوان</label>
              <input className="input-field" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="حي السلام - تعز" />
            </div>
            <div>
              <label className="label-field">الحالة</label>
              <select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="suspended">موقف</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">رقم العداد *</label>
              <input className="input-field" value={form.meter_number || ''} onChange={(e) => setForm({ ...form, meter_number: e.target.value })} placeholder="M-0006" />
            </div>
            <div>
              <label className="label-field">الرقم التسلسلي</label>
              <input className="input-field" value={form.serial_number || ''} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <label className="label-field">المشترك</label>
              <select className="input-field" value={form.customer_id || ''} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— اختر —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_number} - {c.name_ar}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">النوع</label>
              <select className="input-field" value={form.meter_type || 'mechanical'} onChange={(e) => setForm({ ...form, meter_type: e.target.value })}>
                <option value="mechanical">ميكانيكي</option>
                <option value="digital">رقمي</option>
                <option value="ultrasonic">فوق صوتي</option>
              </select>
            </div>
            <div>
              <label className="label-field">المقاس (مم)</label>
              <input type="number" className="input-field" value={form.size_mm || ''} onChange={(e) => setForm({ ...form, size_mm: e.target.value })} placeholder="15" />
            </div>
            <div>
              <label className="label-field">الحالة</label>
              <select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="faulty">تالف</option>
                <option value="replaced">مستبدل</option>
              </select>
            </div>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </Modal>
    </div>
  );
}
