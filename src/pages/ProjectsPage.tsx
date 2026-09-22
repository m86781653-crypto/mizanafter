import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNumber, formatDate, projectStatusLabels } from '@/lib/utils';
import { Plus, Building2, MapPin, Users, Droplets, Calendar, Check } from 'lucide-react';
import type { Project } from '@/types';

export function ProjectsPage() {
  const { projects, setCurrentProjectId, currentProject } = useProject();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name_ar: '', name_en: '', status: 'active', funding_source: '',
    donor: '', beneficiary_count: '', design_capacity: '',
    operational_capacity: '', address: '', established_date: '',
  });

  const handleSave = async () => {
    if (!form.name_ar.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name_ar: form.name_ar,
      status: form.status,
    };
    if (form.name_en) payload.name_en = form.name_en;
    if (form.funding_source) payload.funding_source = form.funding_source;
    if (form.donor) payload.donor = form.donor;
    if (form.beneficiary_count) payload.beneficiary_count = parseInt(form.beneficiary_count);
    if (form.design_capacity) payload.design_capacity = parseFloat(form.design_capacity);
    if (form.operational_capacity) payload.operational_capacity = parseFloat(form.operational_capacity);
    if (form.address) payload.address = form.address;
    if (form.established_date) payload.established_date = form.established_date;

    const { data } = await supabase.from('projects').insert(payload).select().single();
    if (data) {
      setShowForm(false);
      setForm({ name_ar: '', name_en: '', status: 'active', funding_source: '', donor: '', beneficiary_count: '', design_capacity: '', operational_capacity: '', address: '', established_date: '' });
      window.location.reload();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">إدارة المشاريع</h1>
          <p className="text-sm text-neutral-500 mt-1">{formatNumber(projects.length)} مشروع مسجل</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} /> إضافة مشروع
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="لا توجد مشاريع بعد"
            description="ابدأ بإضافة أول مشروع مياه لإدارته عبر المنصة"
            action={{ label: 'إضافة مشروع', onClick: () => setShowForm(true) }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => setCurrentProjectId(p.id)}
              className={`card-hover p-5 cursor-pointer ${currentProject?.id === p.id ? 'ring-2 ring-primary-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700">
                  <Building2 size={24} />
                </div>
                <Badge status={p.status} label={projectStatusLabels[p.status] || p.status} />
              </div>
              <h3 className="font-bold text-lg text-neutral-900 mb-1">{p.name_ar}</h3>
              {p.name_en && <p className="text-xs text-neutral-400 mb-3">{p.name_en}</p>}
              <div className="space-y-2 text-sm">
                {p.address && (
                  <div className="flex items-center gap-2 text-neutral-600">
                    <MapPin size={14} className="text-neutral-400" /> {p.address}
                  </div>
                )}
                <div className="flex items-center gap-2 text-neutral-600">
                  <Users size={14} className="text-neutral-400" /> المستفيدون: {formatNumber(p.beneficiary_count)}
                </div>
                <div className="flex items-center gap-2 text-neutral-600">
                  <Droplets size={14} className="text-neutral-400" /> الطاقة التشغيلية: {formatNumber(p.operational_capacity)} م³/يوم
                </div>
                {p.established_date && (
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Calendar size={14} className="text-neutral-400" /> {formatDate(p.established_date)}
                  </div>
                )}
              </div>
              {currentProject?.id === p.id && (
                <div className="mt-3 flex items-center gap-1 text-primary-600 text-xs font-medium">
                  <Check size={14} /> المشروع الحالي
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="إضافة مشروع مياه جديد" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-field">اسم المشروع (عربي) *</label>
            <input className="input-field" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="مثال: مشروع مياه الخالد" />
          </div>
          <div>
            <label className="label-field">الاسم (إنجليزي)</label>
            <input className="input-field" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Al-Khalid Water Project" />
          </div>
          <div>
            <label className="label-field">حالة المشروع</label>
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">موقف</option>
              <option value="under_construction">قيد الإنشاء</option>
            </select>
          </div>
          <div>
            <label className="label-field">عدد المستفيدين</label>
            <input type="number" className="input-field" value={form.beneficiary_count} onChange={(e) => setForm({ ...form, beneficiary_count: e.target.value })} placeholder="3500" />
          </div>
          <div>
            <label className="label-field">مصدر التمويل</label>
            <input className="input-field" value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })} placeholder="منحة إنسانية" />
          </div>
          <div>
            <label className="label-field">الجهة الداعمة</label>
            <input className="input-field" value={form.donor} onChange={(e) => setForm({ ...form, donor: e.target.value })} placeholder="UNICEF" />
          </div>
          <div>
            <label className="label-field">الطاقة التصميمية (م³/يوم)</label>
            <input type="number" className="input-field" value={form.design_capacity} onChange={(e) => setForm({ ...form, design_capacity: e.target.value })} placeholder="500" />
          </div>
          <div>
            <label className="label-field">الطاقة التشغيلية (م³/يوم)</label>
            <input type="number" className="input-field" value={form.operational_capacity} onChange={(e) => setForm({ ...form, operational_capacity: e.target.value })} placeholder="380" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">العنوان</label>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="تعز - مديرية الخالد" />
          </div>
          <div>
            <label className="label-field">تاريخ الإنشاء</label>
            <input type="date" className="input-field" value={form.established_date} onChange={(e) => setForm({ ...form, established_date: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.name_ar.trim()} className="btn-primary flex-1">
            {saving ? 'جاري الحفظ...' : 'حفظ المشروع'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
