import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber } from '@/lib/utils';
import { Plus, Droplets, Activity, Database } from 'lucide-react';
import type { Well, Pump, Tank } from '@/types';

type Tab = 'wells' | 'pumps' | 'tanks';

export function InfrastructurePage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('wells');
  const [wells, setWells] = useState<Well[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!currentProject) return;
    const pid = currentProject.id;
    setLoading(true);
    setError(null);
    try {
      const [w, p, t] = await Promise.all([
        supabase.from('wells').select('*').eq('project_id', pid).order('code'),
        supabase.from('pumps').select('*').eq('project_id', pid).order('code'),
        supabase.from('tanks').select('*').eq('project_id', pid).order('code'),
      ]);
      const wErr = w.error || p.error || t.error;
      if (wErr) throw wErr;
      setWells((w.data as Well[]) || []);
      setPumps((p.data as Pump[]) || []);
      setTanks((t.data as Tank[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  const openForm = () => { setForm({}); setFormError(null); setShowForm(true); };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    setFormError(null);
    const pid = currentProject.id;
    const table = tab === 'wells' ? 'wells' : tab === 'pumps' ? 'pumps' : 'tanks';
    const payload: Record<string, unknown> = { project_id: pid };
    const fields = tab === 'wells'
      ? ['code', 'name_ar', 'depth_m', 'status', 'water_source', 'capacity_m3_h', 'daily_output_m3', 'operating_hours', 'water_level_m']
      : tab === 'pumps'
      ? ['code', 'well_id', 'manufacturer', 'model', 'serial_number', 'power_kw', 'flow_rate_m3_h', 'head_m', 'status']
      : ['code', 'name_ar', 'capacity_m3', 'current_level_m3', 'material', 'elevation_m', 'status'];

    fields.forEach((f) => {
      if (form[f] !== undefined && form[f] !== '') {
        const numericFields = ['depth_m', 'capacity_m3_h', 'daily_output_m3', 'operating_hours', 'water_level_m', 'power_kw', 'flow_rate_m3_h', 'head_m', 'capacity_m3', 'current_level_m3', 'elevation_m'];
        if (numericFields.includes(f)) payload[f] = parseFloat(form[f]);
        else payload[f] = form[f];
      }
    });

    if (tab === 'wells') payload.pump_installed = form.pump_installed === 'true';
    if (!payload.code) { setSaving(false); setFormError('الرمز مطلوب'); return; }

    try {
      const { data, error: insertError } = await supabase.from(table).insert(payload).select().single();
      if (insertError) throw insertError;
      if (data) {
        setShowForm(false);
        if (tab === 'wells') setWells([...wells, data as Well]);
        if (tab === 'pumps') setPumps([...pumps, data as Pump]);
        if (tab === 'tanks') setTanks([...tanks, data as Tank]);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  const tabs = [
    { id: 'wells' as Tab, label: 'الآبار', icon: Droplets, count: wells.length },
    { id: 'pumps' as Tab, label: 'المضخات', icon: Activity, count: pumps.length },
    { id: 'tanks' as Tab, label: 'الخزانات', icon: Database, count: tanks.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">البنية التحتية المائية</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
        </div>
        <button onClick={openForm} className="btn-primary">
          <Plus size={18} /> إضافة {tab === 'wells' ? 'بئر' : tab === 'pumps' ? 'مضخة' : 'خزان'}
        </button>
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon size={16} /> {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-500'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {loading && <LoadingSpinner />}

      {!loading && error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Wells */}
      {!loading && !error && tab === 'wells' && (
        wells.length === 0 ? (
          <div className="card"><EmptyState icon={Droplets} title="لا توجد آبار مسجلة" description="أضف بئراً لبدء تتبع إنتاج المياه" action={{ label: 'إضافة بئر', onClick: openForm }} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wells.map((w) => (
              <div key={w.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><Droplets size={22} /></div>
                  <Badge status={w.status} label={w.status === 'operational' ? 'يعمل' : 'متوقف'} />
                </div>
                <h3 className="font-bold text-neutral-900">{w.code}</h3>
                {w.name_ar && <p className="text-sm text-neutral-500 mb-3">{w.name_ar}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                  <div><p className="text-xs text-neutral-400">العمق</p><p className="font-semibold text-neutral-700">{formatNumber(w.depth_m)} م</p></div>
                  <div><p className="text-xs text-neutral-400">القدرة</p><p className="font-semibold text-neutral-700">{formatNumber(w.capacity_m3_h)} م³/س</p></div>
                  <div><p className="text-xs text-neutral-400">الإنتاج اليومي</p><p className="font-semibold text-primary-600">{formatNumber(w.daily_output_m3)} م³</p></div>
                  <div><p className="text-xs text-neutral-400">ساعات التشغيل</p><p className="font-semibold text-neutral-700">{formatNumber(w.operating_hours)} س</p></div>
                </div>
                {w.water_level_m != null && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400">مستوى المياه: <span className="font-semibold text-neutral-700">{formatNumber(w.water_level_m)} م</span></p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Pumps */}
      {!loading && !error && tab === 'pumps' && (
        pumps.length === 0 ? (
          <div className="card"><EmptyState icon={Activity} title="لا توجد مضخات مسجلة" description="أضف مضخة لبدء تتبع أدائها" action={{ label: 'إضافة مضخة', onClick: openForm }} /></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">الرمز</th>
                  <th className="px-4 py-3 font-medium">المصنع</th>
                  <th className="px-4 py-3 font-medium">الموديل</th>
                  <th className="px-4 py-3 font-medium">القدرة (kW)</th>
                  <th className="px-4 py-3 font-medium">التدفق (م³/س)</th>
                  <th className="px-4 py-3 font-medium">ساعات التشغيل</th>
                  <th className="px-4 py-3 font-medium">الكفاءة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pumps.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{p.code}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.manufacturer || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.model || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(p.power_kw)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(p.flow_rate_m3_h)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(p.operating_hours)}</td>
                    <td className="px-4 py-3">
                      {p.efficiency != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div className={`h-full ${p.efficiency > 70 ? 'bg-success-500' : p.efficiency > 50 ? 'bg-warning-500' : 'bg-error-500'}`} style={{ width: `${p.efficiency}%` }} />
                          </div>
                          <span className="text-xs text-neutral-600">{formatNumber(p.efficiency)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3"><Badge status={p.status} label={p.status === 'operational' ? 'يعمل' : 'متوقف'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tanks */}
      {!loading && !error && tab === 'tanks' && (
        tanks.length === 0 ? (
          <div className="card"><EmptyState icon={Database} title="لا توجد خزانات مسجلة" description="أضف خزاناً لبدء تتبع مستوى المياه" action={{ label: 'إضافة خزان', onClick: openForm }} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tanks.map((t) => {
              const fillPct = t.capacity_m3 && t.capacity_m3 > 0 ? (Number(t.current_level_m3) / Number(t.capacity_m3) * 100) : 0;
              return (
                <div key={t.id} className="card-hover p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-accent-50 text-accent-700"><Database size={22} /></div>
                    <Badge status={t.status} label={t.status === 'operational' ? 'يعمل' : 'متوقف'} />
                  </div>
                  <h3 className="font-bold text-neutral-900">{t.code}</h3>
                  {t.name_ar && <p className="text-sm text-neutral-500 mb-3">{t.name_ar}</p>}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-neutral-400">السعة</span><span className="font-semibold text-neutral-700">{formatNumber(t.capacity_m3)} م³</span></div>
                    <div className="flex justify-between"><span className="text-neutral-400">المستوى الحالي</span><span className="font-semibold text-neutral-700">{formatNumber(t.current_level_m3)} م³</span></div>
                    {t.material && <div className="flex justify-between"><span className="text-neutral-400">الخامة</span><span className="text-neutral-700">{t.material}</span></div>}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-400">نسبة الامتلاء</span>
                      <span className={`font-semibold ${fillPct > 70 ? 'text-success-600' : fillPct > 30 ? 'text-warning-600' : 'text-error-600'}`}>{formatNumber(fillPct)}%</span>
                    </div>
                    <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${fillPct > 70 ? 'bg-success-500' : fillPct > 30 ? 'bg-warning-500' : 'bg-error-500'}`} style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={tab === 'wells' ? 'إضافة بئر جديد' : tab === 'pumps' ? 'إضافة مضخة جديدة' : 'إضافة خزان جديد'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tab === 'wells' && (
            <>
              <FormInput label="رمز البئر *" field="code" form={form} setForm={setForm} placeholder="W-001" />
              <FormInput label="الاسم" field="name_ar" form={form} setForm={setForm} placeholder="بئر الخالد الرئيسي" />
              <FormInput label="العمق (م)" field="depth_m" form={form} setForm={setForm} type="number" />
              <FormSelect label="الحالة" field="status" form={form} setForm={setForm} options={[{ v: 'operational', l: 'يعمل' }, { v: 'stopped', l: 'متوقف' }, { v: 'maintenance', l: 'صيانة' }]} />
              <FormInput label="مصدر المياه" field="water_source" form={form} setForm={setForm} placeholder="groundwater" />
              <FormInput label="القدرة (م³/س)" field="capacity_m3_h" form={form} setForm={setForm} type="number" />
              <FormInput label="الإنتاج اليومي (م³)" field="daily_output_m3" form={form} setForm={setForm} type="number" />
              <FormInput label="ساعات التشغيل" field="operating_hours" form={form} setForm={setForm} type="number" />
              <FormInput label="مستوى المياه (م)" field="water_level_m" form={form} setForm={setForm} type="number" />
              <FormCheckbox label="مركب عليه مضخة" field="pump_installed" form={form} setForm={setForm} />
            </>
          )}
          {tab === 'pumps' && (
            <>
              <FormInput label="رمز المضخة *" field="code" form={form} setForm={setForm} placeholder="P-001" />
              <FormSelect label="البئر المرتبط" field="well_id" form={form} setForm={setForm} options={wells.map((w) => ({ v: w.id, l: w.code }))} />
              <FormInput label="المصنع" field="manufacturer" form={form} setForm={setForm} placeholder="Grundfos" />
              <FormInput label="الموديل" field="model" form={form} setForm={setForm} placeholder="SP30-10" />
              <FormInput label="الرقم التسلسلي" field="serial_number" form={form} setForm={setForm} />
              <FormInput label="القدرة (kW)" field="power_kw" form={form} setForm={setForm} type="number" />
              <FormInput label="التدفق (م³/س)" field="flow_rate_m3_h" form={form} setForm={setForm} type="number" />
              <FormInput label="الارتفاع (م)" field="head_m" form={form} setForm={setForm} type="number" />
              <FormSelect label="الحالة" field="status" form={form} setForm={setForm} options={[{ v: 'operational', l: 'يعمل' }, { v: 'stopped', l: 'متوقف' }, { v: 'maintenance', l: 'صيانة' }]} />
            </>
          )}
          {tab === 'tanks' && (
            <>
              <FormInput label="رمز الخزان *" field="code" form={form} setForm={setForm} placeholder="T-001" />
              <FormInput label="الاسم" field="name_ar" form={form} setForm={setForm} placeholder="خزان الخالد" />
              <FormInput label="السعة (م³)" field="capacity_m3" form={form} setForm={setForm} type="number" />
              <FormInput label="المستوى الحالي (م³)" field="current_level_m3" form={form} setForm={setForm} type="number" />
              <FormInput label="الخامة" field="material" form={form} setForm={setForm} placeholder="concrete" />
              <FormInput label="الارتفاع (م)" field="elevation_m" form={form} setForm={setForm} type="number" />
              <FormSelect label="الحالة" field="status" form={form} setForm={setForm} options={[{ v: 'operational', l: 'يعمل' }, { v: 'stopped', l: 'متوقف' }, { v: 'maintenance', l: 'صيانة' }]} />
            </>
          )}
        </div>
        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-error-50 border border-error-200 text-sm text-error-700">
            {formError}
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.code} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </Modal>
    </div>
  );
}

function FormInput({ label, field, form, setForm, placeholder, type = 'text' }: { label: string; field: string; form: Record<string, string>; setForm: (f: Record<string, string>) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <input type={type} className="input-field" value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={placeholder} />
    </div>
  );
}

function FormSelect({ label, field, form, setForm, options }: { label: string; field: string; form: Record<string, string>; setForm: (f: Record<string, string>) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <select className="input-field" value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })}>
        <option value="">— اختر —</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function FormCheckbox({ label, field, form, setForm }: { label: string; field: string; form: Record<string, string>; setForm: (f: Record<string, string>) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={field}
        className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        checked={form[field] === 'true'}
        onChange={(e) => setForm({ ...form, [field]: e.target.checked ? 'true' : 'false' })}
      />
      <label htmlFor={field} className="label-field !mb-0 cursor-pointer">{label}</label>
    </div>
  );
}
