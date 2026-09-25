import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNumber, formatDate, projectStatusLabels } from '@/lib/utils';
import { Plus, Building2, MapPin, Users, Droplets, Calendar, Check, UserCheck, Copy, AlertCircle, KeyRound } from 'lucide-react';
import type { Project } from '@/types';

interface CreatedCredential {
  role: string;
  role_label?: string;
  full_name: string;
  email: string;
  password: string;
  must_change_password?: boolean;
}

export function ProjectsPage() {
  const { projects, setCurrentProjectId, currentProject } = useProject();
  const { session, profile } = useAuth();
  const canCreateSubtenant = profile?.role === 'platform_admin' || (profile?.role === 'tenant_manager' && profile?.tenant_id === 'b9295364-d688-4e20-b2a3-433f08bfdcaa');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<CreatedCredential[] | null>(null);
  const [createdProjectName, setCreatedProjectName] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [form, setForm] = useState({
    name_ar: '', name_en: '', status: 'active', funding_source: '',
    donor: '', beneficiary_count: '', design_capacity: '',
    operational_capacity: '', address: '', established_date: '',
    manager_name: '', manager_email: '',
    reader_name: '', reader_email: '',
    collector_name: '', collector_email: '',
  });

  const handleSave = async () => {
    if (!form.name_ar.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/provision-subtenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          tenant_name_ar: form.name_ar,
          tenant_name_en: form.name_en || undefined,
          project_name_ar: form.name_ar,
          district_id: undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'فشل إنشاء المستأجر الفرعي');
      setCreatedCreds((result.credentials || []).map((item: any) => ({
        ...item,
        role_label: item.role === 'tenant_manager' ? 'مدير المشروع' : item.role === 'meter_reader' ? 'قارئ العدادات' : 'مسؤول التحصيل',
        must_change_password: true,
      })));
      setCreatedProjectName(result.project?.name_ar || form.name_ar);
      setShowForm(false);
      setForm({name_ar:'',name_en:'',status:'active',funding_source:'',donor:'',beneficiary_count:'',design_capacity:'',operational_capacity:'',address:'',established_date:'',manager_name:'',manager_email:'',reader_name:'',reader_email:'',collector_name:'',collector_email:''});
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  };

  const copyCredential = (cred: CreatedCredential, idx: number) => {
    const text = `اسم المستخدم: ${cred.full_name}\nالبريد: ${cred.email}\nكلمة المرور: ${cred.password}\nالدور: ${cred.role_label || cred.role}\nالمشروع: ${createdProjectName}`;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyAll = () => {
    if (!createdCreds) return;
    const text = createdCreds.map(c =>
      `--- ${c.role_label || c.role} ---\nالاسم: ${c.full_name}\nالبريد: ${c.email}\nكلمة المرور: ${c.password}\n`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIdx(-1);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">إدارة المشاريع</h1>
          <p className="text-sm text-neutral-500 mt-1">{formatNumber(projects.length)} مشروع مسجل</p>
        </div>
        {canCreateSubtenant && <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} /> إنشاء مستأجر فرعي ومشروع
        </button>}
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="لا توجد مشاريع بعد"
            description={canCreateSubtenant ? "أنشئ مستأجراً فرعياً ومشروع مياه. سيتم إنشاء 3 حسابات (مدير مشروع، قارئ عدادات، محصل) تلقائياً مع كلمات مرور جاهزة للتسليم." : "هذا هو المشروع المخصص لمستأجرك الفرعي."}
            action={canCreateSubtenant ? { label: 'إنشاء مستأجر فرعي ومشروع', onClick: () => setShowForm(true) } : undefined}
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

      {/* Create Project Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="إنشاء مستأجر فرعي ومشروع مع 3 حسابات مستخدمين" size="lg">
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-primary-50 text-primary-700 text-sm">
          <UserCheck size={18} className="shrink-0 mt-0.5" />
          <span>سيتم إنشاء المشروع و3 حسابات تلقائياً: مدير مشروع، قارئ عدادات، محصل. ستحصل على كلمات مرور جاهزة لتسليمها للعميل.</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-50 text-error-700 text-sm mb-4 animate-fade-in">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

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

        {/* User accounts section */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <h3 className="font-bold text-neutral-800 mb-1">حسابات المستخدمين</h3>
          <p className="text-xs text-neutral-500 mb-4">سيتم توليد 3 حسابات دخول وكلمات مرور آمنة تلقائياً، دون الحاجة إلى إدخال بريد مسبق</p>

          <div className="space-y-4">
            {/* Manager */}
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-primary-50 text-primary-700"><UserCheck size={16} /></div>
                <span className="text-sm font-semibold text-neutral-800">مدير المشروع</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input-field" placeholder="الاسم الكامل" value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
                <div className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-lg">سيتم توليد بيانات الدخول تلقائياً</div>
              </div>
            </div>

            {/* Reader */}
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-accent-50 text-accent-700"><UserCheck size={16} /></div>
                <span className="text-sm font-semibold text-neutral-800">قارئ العدادات</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input-field" placeholder="الاسم الكامل" value={form.reader_name} onChange={(e) => setForm({ ...form, reader_name: e.target.value })} />
                <div className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-lg">سيتم توليد بيانات الدخول تلقائياً</div>
              </div>
            </div>

            {/* Collector */}
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-success-50 text-success-700"><UserCheck size={16} /></div>
                <span className="text-sm font-semibold text-neutral-800">المحصل</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input-field" placeholder="الاسم الكامل" value={form.collector_name} onChange={(e) => setForm({ ...form, collector_name: e.target.value })} />
                <div className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-lg">سيتم توليد بيانات الدخول تلقائياً</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.name_ar.trim()} className="btn-primary flex-1">
            {saving ? 'جاري الإنشاء...' : 'إنشاء المشروع والحسابات'}
          </button>
        </div>
      </Modal>

      {/* Credentials Display Modal */}
      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="px-6 py-5 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success-100 text-success-600"><KeyRound size={24} /></div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">تم إنشاء المشروع بنجاح</h2>
                  <p className="text-sm text-neutral-500">احفظ بيانات الحسابات التالية وسلّمها للمستخدمين</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700 flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>هذه كلمات المرور الأولية — يجب على كل مستخدم تغييرها عند أول تسجيل دخول</span>
              </div>

              {createdCreds.map((cred, idx) => (
                <div key={idx} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        cred.role === 'tenant_manager' ? 'bg-primary-100 text-primary-700' :
                        cred.role === 'meter_reader' ? 'bg-accent-100 text-accent-700' :
                        'bg-success-100 text-success-700'
                      }`}>{cred.role_label}</span>
                    </div>
                    <button
                      onClick={() => copyCredential(cred, idx)}
                      className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700 transition-smooth"
                    >
                      {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                      {copiedIdx === idx ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-neutral-400 text-xs">الاسم</span>
                      <p className="font-medium text-neutral-800">{cred.full_name}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs">البريد الإلكتروني</span>
                      <p className="font-medium text-neutral-800" dir="ltr" style={{ textAlign: 'right' }}>{cred.email}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-xs">كلمة المرور</span>
                      <p className="font-bold text-error-700 font-mono" dir="ltr" style={{ textAlign: 'right' }}>{cred.password}</p>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={copyAll} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-medium hover:bg-neutral-200 transition-smooth text-sm">
                {copiedIdx === -1 ? <Check size={18} /> : <Copy size={18} />}
                {copiedIdx === -1 ? 'تم نسخ الكل' : 'نسخ جميع البيانات'}
              </button>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end">
              <button onClick={() => setCreatedCreds(null)} className="btn-primary">
                تم، إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
