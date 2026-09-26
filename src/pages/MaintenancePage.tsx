import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import {
  formatNumber, formatCurrency, formatDate, formatRelativeTime,
  faultStatusLabels, workOrderStatusLabels, severityLabels, statusColor,
} from '@/lib/utils';
import {
  Wrench, AlertTriangle, Plus, Activity, Clock, CheckCircle,
  Loader2, Boxes, AlertCircle,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import type { Fault, WorkOrder, Asset, Well, Pump } from '@/types';

type Tab = 'faults' | 'workorders' | 'assets';

export function MaintenancePage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('faults');
  const [faults, setFaults] = useState<Fault[]>([]);
  const [workOrders, setWorkOrders] = useState<(WorkOrder & { faults?: Fault })[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [wells, setWells] = useState<Well[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!currentProject) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const pid = currentProject.id;
    try {
      const [f, wo, a, w, p] = await Promise.all([
        supabase.from('faults').select('*').eq('project_id', pid).order('reported_at', { ascending: false }),
        supabase.from('maintenance_work_orders').select('*, faults(fault_number, severity, description)').eq('project_id', pid).order('created_at', { ascending: false }),
        supabase.from('assets').select('*').eq('project_id', pid).order('asset_code'),
        supabase.from('wells').select('*').eq('project_id', pid),
        supabase.from('pumps').select('*').eq('project_id', pid),
      ]);
      if (f.error) throw f.error;
      if (wo.error) throw wo.error;
      if (a.error) throw a.error;
      setFaults(f.data as Fault[] || []);
      setWorkOrders(wo.data as any[] || []);
      setAssets(a.data as Asset[] || []);
      setWells(w.data as Well[] || []);
      setPumps(p.data as Pump[] || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentProject]);

  const openFaults = faults.filter(f => f.status !== 'closed' && f.status !== 'resolved');
  const openWOs = workOrders.filter(w => w.status === 'open' || w.status === 'in_progress');

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    setFormError(null);
    const pid = currentProject.id;

    if (tab === 'faults') {
      if (!form.fault_type) { setFormError('نوع العطل مطلوب'); setSaving(false); return; }
      const { data: seqData } = await supabase.rpc('next_seq_number', { seq_name: 'FLT' });
      const faultNum = seqData || `F-${Date.now()}`;
      const payload: Record<string, unknown> = {
        project_id: pid,
        fault_number: faultNum,
        fault_type: form.fault_type,
        severity: form.severity || 'medium',
        status: 'reported',
        description: form.description || null,
        reported_by: form.reported_by || null,
        reporter_type: form.reporter_type || 'staff',
      };
      if (form.pump_id) payload.pump_id = form.pump_id;
      if (form.well_id) payload.well_id = form.well_id;
      const { data, error: insErr } = await supabase.from('faults').insert(payload).select().single();
      if (insErr) { setFormError(insErr.message); setSaving(false); return; }
      if (data) { setFaults([data as Fault, ...faults]); setShowForm(false); setForm({}); }
    } else if (tab === 'workorders') {
      if (!form.description) { setFormError('الوصف مطلوب'); setSaving(false); return; }
      const { data: data, error: insErr } = await supabase.rpc('mizan_create_work_order', {
        p_project_id: pid,
        p_description: form.description,
        p_type: form.type || 'corrective',
        p_priority: form.priority || 'medium',
        p_assigned_to: form.assigned_to || null,
        p_scheduled_date: form.scheduled_date || null,
        p_fault_id: form.fault_id || null,
        p_asset_id: form.asset_id || null,
        p_well_id: form.well_id || null,
        p_pump_id: form.pump_id || null,
      });
      if (insErr) { setFormError(insErr.message); setSaving(false); return; }
      if (data) {
        const { data: hydrated, error: hydrateErr } = await supabase.from('maintenance_work_orders').select('*, faults(fault_number, severity, description)').eq('id', data.id).single();
        if (hydrateErr) { setFormError(hydrateErr.message); setSaving(false); return; }
        setWorkOrders([hydrated as any, ...workOrders]); setShowForm(false); setForm({});
      }
    } else if (tab === 'assets') {
      if (!form.asset_code || !form.name_ar) { setFormError('رمز الأصل والاسم مطلوبان'); setSaving(false); return; }
      const payload: Record<string, unknown> = {
        project_id: pid,
        asset_code: form.asset_code,
        name_ar: form.name_ar,
        category: form.category || null,
        type: form.type || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        status: form.status || 'operational',
      };
      if (form.purchase_cost) payload.purchase_cost = parseFloat(form.purchase_cost);
      if (form.expected_lifespan_years) payload.expected_lifespan_years = parseFloat(form.expected_lifespan_years);
      if (form.purchase_date) payload.purchase_date = form.purchase_date;
      if (form.installation_date) payload.installation_date = form.installation_date;
      const { data, error: insErr } = await supabase.from('assets').insert(payload).select().single();
      if (insErr) { setFormError(insErr.message); setSaving(false); return; }
      if (data) { setAssets([data as Asset, ...assets]); setShowForm(false); setForm({}); }
    }
    setSaving(false);
  };

  const updateFaultStatus = async (fault: Fault, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    if (newStatus === 'verified') updates.verified_at = new Date().toISOString();
    await supabase.from('faults').update(updates).eq('id', fault.id);
    setFaults(faults.map(f => f.id === fault.id ? { ...f, ...updates } as Fault : f));
  };

  const updateWOStatus = async (wo: WorkOrder, newStatus: string) => {
    const { data, error: updateErr } = await supabase.rpc('mizan_update_work_order_status', {
      p_work_order_id: wo.id,
      p_status: newStatus,
    });
    if (updateErr) { setFormError(updateErr.message); return; }
    if (data) setWorkOrders(workOrders.map(w => w.id === wo.id ? { ...w, ...(data as any) } as WorkOrder : w));
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تحميل بيانات الصيانة..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const tabs = [
    { id: 'faults' as Tab, label: 'الأعطال', icon: AlertTriangle, count: faults.length },
    { id: 'workorders' as Tab, label: 'أوامر الصيانة', icon: Wrench, count: workOrders.length },
    { id: 'assets' as Tab, label: 'الأصول', icon: Boxes, count: assets.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">الصيانة والأعطال</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
        </div>
        <button onClick={() => { setForm({}); setFormError(null); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /> إضافة {tab === 'faults' ? 'عطل' : tab === 'workorders' ? 'أمر صيانة' : 'أصل'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="أعطال مفتوحة" value={formatNumber(openFaults.length)} icon={AlertTriangle} color={openFaults.length > 0 ? 'error' : 'success'} />
        <StatCard title="أوامر صيانة معلقة" value={formatNumber(openWOs.length)} icon={Wrench} color={openWOs.length > 0 ? 'warning' : 'success'} />
        <StatCard title="إجمالي الأصول" value={formatNumber(assets.length)} icon={Boxes} color="primary" />
        <StatCard title="أعطال حرجة" value={formatNumber(openFaults.filter(f => f.severity === 'critical' || f.severity === 'high').length)} icon={Activity} color="error" />
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>
              <Icon size={16} /> {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Faults Tab */}
      {tab === 'faults' && (
        faults.length === 0 ? (
          <div className="card"><EmptyState icon={AlertTriangle} title="لا توجد أعطال مسجلة" description="سجل أول بلاغ عطل لبدء التتبع" action={{ label: 'إضافة عطل', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
        ) : (
          <div className="space-y-3">
            {faults.map((f) => (
              <div key={f.id} className="card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 ${f.severity === 'critical' ? 'bg-error-50 text-error-700' : f.severity === 'high' ? 'bg-error-50 text-error-700' : f.severity === 'medium' ? 'bg-warning-50 text-warning-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900">{f.fault_number}</span>
                        <span className={`badge ${statusColor(f.severity)}`}>{severityLabels[f.severity] || f.severity}</span>
                        <Badge status={f.status} label={faultStatusLabels[f.status] || f.status} />
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{f.description || 'لا يوجد وصف'}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                        <span>النوع: {f.fault_type || '—'}</span>
                        <span>المرسل: {f.reported_by || '—'}</span>
                        <span>{formatRelativeTime(f.reported_at)}</span>
                      </div>
                    </div>
                  </div>
                  {f.status !== 'closed' && f.status !== 'resolved' && (
                    <select
                      value={f.status}
                      onChange={(e) => updateFaultStatus(f, e.target.value)}
                      className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white text-neutral-700 outline-none focus:border-primary-500"
                    >
                      <option value="reported">تم الإبلاغ</option>
                      <option value="verified">تم التحقق</option>
                      <option value="assigned">تم التعيين</option>
                      <option value="in_progress">قيد المعالجة</option>
                      <option value="resolved">تم الحل</option>
                      <option value="closed">مغلقة</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Work Orders Tab */}
      {tab === 'workorders' && (
        workOrders.length === 0 ? (
          <div className="card"><EmptyState icon={Wrench} title="لا توجد أوامر صيانة" description="أنشئ أول أمر صيانة" action={{ label: 'إضافة أمر صيانة', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">رقم الأمر</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">الأولوية</th>
                  <th className="px-4 py-3 font-medium">الوصف</th>
                  <th className="px-4 py-3 font-medium">المسؤول</th>
                  <th className="px-4 py-3 font-medium">التكلفة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {workOrders.map((w) => (
                  <tr key={w.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{w.work_order_number}</td>
                    <td className="px-4 py-3 text-neutral-600">{w.type === 'corrective' ? 'تصحيحي' : w.type === 'preventive' ? 'وقائي' : 'طارئ'}</td>
                    <td className="px-4 py-3"><span className={`badge ${statusColor(w.priority)}`}>{severityLabels[w.priority] || w.priority}</span></td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{w.description || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{w.assigned_to || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatCurrency(w.cost)}</td>
                    <td className="px-4 py-3"><Badge status={w.status} label={workOrderStatusLabels[w.status] || w.status} /></td>
                    <td className="px-4 py-3">
                      {w.status !== 'completed' && w.status !== 'cancelled' && (
                        <button onClick={() => updateWOStatus(w, w.status === 'open' ? 'in_progress' : 'completed')} className="text-primary-600 text-xs font-medium">
                          {w.status === 'open' ? 'بدء' : 'إكمال'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Assets Tab */}
      {tab === 'assets' && (
        assets.length === 0 ? (
          <div className="card"><EmptyState icon={Boxes} title="لا توجد أصول مسجلة" description="أضف أول أصل لتتبع دورة حياته" action={{ label: 'إضافة أصل', onClick: () => { setForm({}); setShowForm(true); } }} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((a) => (
              <div key={a.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><Boxes size={20} /></div>
                  <Badge status={a.status} label={a.status === 'operational' ? 'يعمل' : a.status} />
                </div>
                <h3 className="font-bold text-neutral-900">{a.name_ar}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{a.asset_code}</p>
                <div className="space-y-1.5 text-sm mt-3">
                  {a.category && <div className="flex justify-between"><span className="text-neutral-400">التصنيف</span><span className="text-neutral-700">{a.category}</span></div>}
                  {a.manufacturer && <div className="flex justify-between"><span className="text-neutral-400">المصنع</span><span className="text-neutral-700">{a.manufacturer}</span></div>}
                  {a.model && <div className="flex justify-between"><span className="text-neutral-400">الموديل</span><span className="text-neutral-700">{a.model}</span></div>}
                  {a.purchase_cost && <div className="flex justify-between"><span className="text-neutral-400">التكلفة</span><span className="font-semibold text-neutral-700">{formatCurrency(a.purchase_cost)}</span></div>}
                  {a.expected_lifespan_years && <div className="flex justify-between"><span className="text-neutral-400">العمر المتوقع</span><span className="text-neutral-700">{formatNumber(a.expected_lifespan_years)} سنة</span></div>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={tab === 'faults' ? 'تسجيل عطل جديد' : tab === 'workorders' ? 'إنشاء أمر صيانة' : 'إضافة أصل جديد'} size="lg">
        {tab === 'faults' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">نوع العطل *</label>
              <select className="input-field" value={form.fault_type || ''} onChange={(e) => setForm({ ...form, fault_type: e.target.value })}>
                <option value="">— اختر —</option>
                <option value="pump_failure">عطل مضخة</option>
                <option value="pipe_leak">تسريب أنبوب</option>
                <option value="electrical">عطل كهربائي</option>
                <option value="meter_issue">مشكلة عداد</option>
                <option value="water_quality">جودة المياه</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <label className="label-field">درجة الخطورة</label>
              <select className="input-field" value={form.severity || 'medium'} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="low">منخفض</option>
                <option value="medium">متوسط</option>
                <option value="high">عالٍ</option>
                <option value="critical">حرج</option>
              </select>
            </div>
            <div>
              <label className="label-field">المضخة المرتبطة</label>
              <select className="input-field" value={form.pump_id || ''} onChange={(e) => setForm({ ...form, pump_id: e.target.value })}>
                <option value="">— اختر —</option>
                {pumps.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.manufacturer}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">البئر المرتبط</label>
              <select className="input-field" value={form.well_id || ''} onChange={(e) => setForm({ ...form, well_id: e.target.value })}>
                <option value="">— اختر —</option>
                {wells.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name_ar}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-field">الوصف</label>
              <textarea className="input-field min-h-[80px]" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف العطل..." />
            </div>
            <div>
              <label className="label-field">اسم المبلّغ</label>
              <input className="input-field" value={form.reported_by || ''} onChange={(e) => setForm({ ...form, reported_by: e.target.value })} placeholder="الاسم" />
            </div>
          </div>
        )}
        {tab === 'workorders' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">النوع</label>
              <select className="input-field" value={form.type || 'corrective'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="corrective">تصحيحي</option>
                <option value="preventive">وقائي</option>
                <option value="emergency">طارئ</option>
              </select>
            </div>
            <div>
              <label className="label-field">الأولوية</label>
              <select className="input-field" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">منخفض</option>
                <option value="medium">متوسط</option>
                <option value="high">عالٍ</option>
                <option value="critical">حرج</option>
              </select>
            </div>
            <div>
              <label className="label-field">العطل المرتبط</label>
              <select className="input-field" value={form.fault_id || ''} onChange={(e) => setForm({ ...form, fault_id: e.target.value })}>
                <option value="">— اختر —</option>
                {faults.filter(f => f.status !== 'closed').map((f) => <option key={f.id} value={f.id}>{f.fault_number} - {f.fault_type}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">المضخة المرتبطة</label>
              <select className="input-field" value={form.pump_id || ''} onChange={(e) => setForm({ ...form, pump_id: e.target.value })}>
                <option value="">— اختر —</option>
                {pumps.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">المسؤول عن التنفيذ</label>
              <input className="input-field" value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="اسم الفني" />
            </div>
            <div>
              <label className="label-field">التاريخ المجدول</label>
              <input type="date" className="input-field" value={form.scheduled_date || ''} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label-field">الوصف *</label>
              <textarea className="input-field min-h-[80px]" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف العمل المطلوب..." />
            </div>
          </div>
        )}
        {tab === 'assets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">رمز الأصل *</label>
              <input className="input-field" value={form.asset_code || ''} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="A-003" />
            </div>
            <div>
              <label className="label-field">الاسم *</label>
              <input className="input-field" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="اسم الأصل" />
            </div>
            <div>
              <label className="label-field">التصنيف</label>
              <select className="input-field" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— اختر —</option>
                <option value="pump">مضخة</option>
                <option value="electrical">كهربائي</option>
                <option value="pipe">أنبوب</option>
                <option value="valve">صمام</option>
                <option value="meter">عداد</option>
                <option value="generator">مولدة</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <label className="label-field">النوع</label>
              <input className="input-field" value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            </div>
            <div>
              <label className="label-field">المصنع</label>
              <input className="input-field" value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div>
              <label className="label-field">الموديل</label>
              <input className="input-field" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="label-field">الرقم التسلسلي</label>
              <input className="input-field" value={form.serial_number || ''} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <label className="label-field">الحالة</label>
              <select className="input-field" value={form.status || 'operational'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="operational">يعمل</option>
                <option value="needs_repair">يحتاج صيانة</option>
                <option value="out_of_service">خارج الخدمة</option>
                <option value="retired">متقاعد</option>
              </select>
            </div>
            <div>
              <label className="label-field">التكلفة (ر.ي)</label>
              <input type="number" className="input-field" value={form.purchase_cost || ''} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
            </div>
            <div>
              <label className="label-field">العمر المتوقع (سنوات)</label>
              <input type="number" className="input-field" value={form.expected_lifespan_years || ''} onChange={(e) => setForm({ ...form, expected_lifespan_years: e.target.value })} />
            </div>
            <div>
              <label className="label-field">تاريخ الشراء</label>
              <input type="date" className="input-field" value={form.purchase_date || ''} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div>
              <label className="label-field">تاريخ التركيب</label>
              <input type="date" className="input-field" value={form.installation_date || ''} onChange={(e) => setForm({ ...form, installation_date: e.target.value })} />
            </div>
          </div>
        )}
        {formError && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-error-50 text-error-700 text-sm">
            <AlertCircle size={16} /><span>{formError}</span>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'حفظ'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
