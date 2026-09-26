import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart3, Droplets, Users, Receipt, AlertTriangle,
  Wrench, TrendingDown, Activity, Download, FileText,
} from 'lucide-react';

export function ReportsPage() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState({
    customers: 0,
    meters: 0,
    invoices: [] as any[],
    payments: [] as any[],
    readings: [] as any[],
    faults: [] as any[],
    workOrders: [] as any[],
    wells: [] as any[],
    pumps: [] as any[],
    assets: [] as any[],
    interruptions: [] as any[],
  });

  const fetchData = useCallback(async () => {
    if (!currentProject) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const pid = currentProject.id;
    try {
      const [c, m, inv, pay, r, f, wo, w, p, a, si] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('project_id', pid),
        supabase.from('meters').select('id', { count: 'exact', head: true }).eq('project_id', pid),
        supabase.from('invoices').select('*').eq('project_id', pid),
        supabase.from('payments').select('*').eq('project_id', pid),
        supabase.from('meter_readings').select('*').eq('project_id', pid),
        supabase.from('faults').select('*').eq('project_id', pid),
        supabase.from('maintenance_work_orders').select('*').eq('project_id', pid),
        supabase.from('wells').select('*').eq('project_id', pid),
        supabase.from('pumps').select('*').eq('project_id', pid),
        supabase.from('assets').select('*').eq('project_id', pid),
        supabase.from('service_interruptions').select('*').eq('project_id', pid).order('started_at',{ ascending: false }),
      ]);
      const firstError = c.error || m.error || inv.error || pay.error || r.error || f.error || wo.error || w.error || p.error || a.error || si.error;
      if (firstError) throw firstError;
      setData({
        customers: c.count || 0,
        meters: m.count || 0,
        invoices: inv.data || [],
        payments: pay.data || [],
        readings: r.data || [],
        faults: f.data || [],
        workOrders: wo.data || [],
        wells: w.data || [],
        pumps: p.data || [],
        assets: a.data || [],
        interruptions: si.data || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const inRange = useCallback((value: unknown) => {
    if (!dateFrom && !dateTo) return true;
    const d = value ? new Date(String(value)) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59.999')) return false;
    return true;
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => ({
    invoices: data.invoices.filter((x:any) => inRange(x.issue_date || x.created_at)),
    payments: data.payments.filter((x:any) => inRange(x.payment_date || x.created_at)),
    readings: data.readings.filter((x:any) => inRange(x.reading_date || x.created_at)),
    faults: data.faults.filter((x:any) => inRange(x.reported_at || x.created_at)),
    workOrders: data.workOrders.filter((x:any) => inRange(x.scheduled_date || x.created_at)),
    interruptions: data.interruptions.filter((x:any) => inRange(x.started_at || x.created_at)),
  }), [data, inRange]);

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تحليل البيانات..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const totalRevenue = filtered.invoices.reduce((s: number, i: any) => s + Number(i.grand_total), 0);
  const collected = filtered.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const outstanding = filtered.invoices.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + Number(i.balance), 0);
  const production = data.wells.reduce((s: number, w: any) => s + Number(w.daily_output_m3), 0);
  const consumption = filtered.invoices.reduce((s: number, i: any) => s + Number(i.consumption_m3), 0);
  const nrw: number | null = production > 0 ? ((production - consumption) / production * 100) : null;
  const collectionRate = totalRevenue > 0 ? (collected / totalRevenue * 100) : 0;
  const openFaults = filtered.faults.filter((f: any) => f.status !== 'closed' && f.status !== 'resolved').length;
  const openWOs = filtered.workOrders.filter((w: any) => w.status === 'open' || w.status === 'in_progress').length;
  const anomalies = filtered.readings.filter((r: any) => r.anomaly_flag).length;
  const dataCompleteness = data.meters > 0 ? Math.min(filtered.readings.length / data.meters * 100, 100) : 0;
  const openInterruptions = filtered.interruptions.filter((x: any) => !['restored','closed'].includes(x.status)).length;

  const exportCSV = (type: string) => {
    let rows: string[][] = [];
    let filename = '';

    switch (type) {
      case 'production':
        filename = 'production_report';
        rows = [['البئر', 'الإنتاج اليومي (م³)', 'الحالة', 'ساعات التشغيل']];
        data.wells.forEach((w: any) => {
          rows.push([w.code, String(w.daily_output_m3 || 0), w.status, String(w.operating_hours || 0)]);
        });
        break;
      case 'nrw':
        filename = 'nrw_report';
        rows = [['الإنتاج (م³)', 'الاستهلاك (م³)', 'الفاقد (م³)', 'نسبة الفاقد (%)']];
        rows.push([String(production), String(consumption), String(production - consumption), nrw ? nrw.toFixed(2) : '—']);
        break;
      case 'revenue':
        filename = 'revenue_report';
        rows = [['رقم الفاتورة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'التاريخ']];
        filtered.invoices.forEach((i: any) => {
          rows.push([i.invoice_number, String(i.grand_total), String(i.amount_paid || 0), String(i.balance), i.status, formatDate(i.issue_date)]);
        });
        break;
      case 'customers':
        filename = 'customers_report';
        rows = [['عدد المشتركين', 'عدد العدادات', 'عدد الفواتير', 'عدد القراءات']];
        rows.push([String(data.customers), String(data.meters), String(filtered.invoices.length), String(filtered.readings.length)]);
        break;
      case 'faults':
        filename = 'faults_report';
        rows = [['رقم العطل', 'النوع', 'الخطورة', 'الحالة', 'التاريخ']];
        filtered.faults.forEach((f: any) => {
          rows.push([f.fault_number, f.fault_type || '', f.severity, f.status, formatDate(f.reported_at)]);
        });
        break;
      case 'interruptions':
        filename = 'service_interruptions_report';
        rows = [['رقم التوقف','النوع','الخطورة','الحالة','بداية التوقف','المشتركون المتأثرون','الفاقد المقدر م3']];
        filtered.interruptions.forEach((x:any) => rows.push([x.interruption_number,x.interruption_type||'',x.severity,x.status,formatDate(x.started_at),String(x.affected_subscribers||0),String(x.estimated_water_loss_m3||0)]));
        break;
      case 'assets':
        filename = 'assets_report';
        rows = [['الرمز', 'الاسم', 'التصنيف', 'الحالة', 'التكلفة']];
        data.assets.forEach((a: any) => {
          rows.push([a.asset_code, a.name_ar, a.category || '', a.status, String(a.purchase_cost || 0)]);
        });
        break;
      case 'quality':
        filename = 'data_quality_report';
        rows = [['عدد العدادات', 'عدد القراءات', 'قراءات شاذة', 'اكتمال البيانات (%)']];
        rows.push([String(data.meters), String(data.readings.length), String(anomalies), dataCompleteness.toFixed(1)]);
        break;
      case 'performance':
        filename = 'performance_report';
        rows = [['المؤشر', 'القيمة']];
        rows.push(['معدل التحصيل (%)', collectionRate.toFixed(1)]);
        rows.push(['نسبة الفاقد (%)', nrw ? nrw.toFixed(1) : '—']);
        rows.push(['اكتمال البيانات (%)', dataCompleteness.toFixed(1)]);
        rows.push(['أعطال مفتوحة', String(openFaults)]);
        rows.push(['أوامر صيانة معلقة', String(openWOs)]);
        break;
      default:
        return;
    }

    const csv = '\ufeff' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    { id: 'production', title: 'تقرير الإنتاج والاستهلاك', desc: 'إنتاج المياه مقابل الاستهلاك المسجل', icon: Droplets, color: 'primary' },
    { id: 'nrw', title: 'تقرير الفاقد (NRW)', desc: 'حساب الفاقد غير المدفوع العائد', icon: TrendingDown, color: 'warning' },
    { id: 'revenue', title: 'تقرير الإيرادات والتحصيل', desc: 'الإيرادات، المحصّل، المتأخرات', icon: Receipt, color: 'success' },
    { id: 'customers', title: 'تقرير المشتركين', desc: 'إحصائيات المشتركين والأنواع', icon: Users, color: 'accent' },
    { id: 'faults', title: 'تقرير الأعطال والصيانة', desc: 'الأعطال، أوامر الصيانة، الأوقات', icon: AlertTriangle, color: 'error' },
    { id: 'interruptions', title: 'تقرير التوقفات', desc: 'التوقفات ومددها وتأثيرها على الخدمة', icon: AlertTriangle, color: 'error' },
    { id: 'assets', title: 'تقرير الأصول', desc: 'الأصول وحالتها ودورة الحياة', icon: Wrench, color: 'neutral' },
    { id: 'quality', title: 'تقرير جودة البيانات', desc: 'اكتمال البيانات والقراءات الشاذة', icon: Activity, color: 'primary' },
    { id: 'performance', title: 'تقرير الأداء التشغيلي', desc: 'مؤشرات الأداء الرئيسية', icon: BarChart3, color: 'accent' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">التقارير والتحليلات</h1>
        <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-xs text-neutral-500 mb-1">من تاريخ</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" /></div>
          <div><label className="block text-xs text-neutral-500 mb-1">إلى تاريخ</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" /></div>
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="btn-secondary text-sm">مسح الفترة</button>
          <span className="text-xs text-neutral-500 mr-auto">{dateFrom || dateTo ? 'تطبيق نطاق التاريخ على المؤشرات والسجلات' : 'كل البيانات'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="معدل التحصيل" value={`${formatNumber(collectionRate)}%`} icon={Receipt} color={collectionRate > 60 ? 'success' : 'warning'} />
        <StatCard title="نسبة الفاقد" value={nrw === null ? '—' : `${formatNumber(nrw)}%`} icon={TrendingDown} color={nrw === null ? 'success' : nrw < 15 ? 'success' : nrw < 30 ? 'warning' : 'error'} />
        <StatCard title="اكتمال البيانات" value={`${formatNumber(dataCompleteness)}%`} icon={Activity} color={dataCompleteness > 80 ? 'success' : 'warning'} />
        <StatCard title="قراءات شاذة" value={formatNumber(anomalies)} icon={AlertTriangle} color={anomalies > 0 ? 'error' : 'neutral'} />
        <StatCard title="توقفات مفتوحة" value={formatNumber(openInterruptions)} icon={AlertTriangle} color={openInterruptions > 0 ? 'warning' : 'success'} />
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Droplets size={20} className="text-primary-600" />
          <h2 className="text-lg font-bold text-neutral-800">ميزان المياه</h2>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-neutral-600">الإنتاج اليومي</span>
              <span className="font-bold text-neutral-800">{formatNumber(production)} م³</span>
            </div>
            <div className="h-6 bg-neutral-100 rounded-lg overflow-hidden">
              <div className="h-full bg-primary-500 flex items-center justify-start px-2" style={{ width: '100%' }}>
                <span className="text-xs text-white font-medium">100%</span>
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-neutral-600">الاستهلاك المسجل</span>
              <span className="font-bold text-neutral-800">{formatNumber(consumption)} م³</span>
            </div>
            <div className="h-6 bg-neutral-100 rounded-lg overflow-hidden">
              <div className="h-full bg-success-500 flex items-center justify-start px-2" style={{ width: `${production > 0 ? (consumption / production * 100) : 0}%` }}>
                <span className="text-xs text-white font-medium">{production > 0 ? formatNumber(consumption / production * 100) : 0}%</span>
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-neutral-600">الفاقد (NRW)</span>
              <span className={`font-bold ${nrw === null ? 'text-neutral-500' : nrw > 30 ? 'text-error-600' : 'text-warning-600'}`}>
                {formatNumber(production - consumption)} م³ {nrw === null ? '(لا يوجد إنتاج)' : `(${formatNumber(nrw)}%)`}
              </span>
            </div>
            <div className="h-6 bg-neutral-100 rounded-lg overflow-hidden">
              <div className={`h-full flex items-center justify-start px-2 ${nrw === null ? 'bg-neutral-300' : nrw > 30 ? 'bg-error-500' : 'bg-warning-500'}`} style={{ width: `${Math.min(nrw || 0, 100)}%` }}>
                <span className="text-xs text-white font-medium">{nrw === null ? '—' : `${formatNumber(nrw)}%`}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-4">ملاحظة: يتم حساب الفاقد كالفرق بين الإنتاج والاستهلاك المسجل. دقة المؤشر تعتمد على اكتمال بيانات القراءات.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3"><Receipt size={18} className="text-success-600" /><h3 className="font-bold text-neutral-800">الإيرادات</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-400">إجمالي الفواتير</span><span className="font-semibold text-neutral-700">{formatCurrency(totalRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">المحصّل</span><span className="font-semibold text-success-600">{formatCurrency(collected)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">المتأخرات</span><span className="font-semibold text-error-600">{formatCurrency(outstanding)}</span></div>
            <div className="flex justify-between border-t border-neutral-100 pt-2"><span className="text-neutral-400">عدد الفواتير</span><span className="font-semibold text-neutral-700">{data.invoices.length}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} className="text-error-600" /><h3 className="font-bold text-neutral-800">الأعطال والصيانة</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-400">إجمالي الأعطال</span><span className="font-semibold text-neutral-700">{data.faults.length}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">أعطال مفتوحة</span><span className="font-semibold text-error-600">{openFaults}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">أوامر صيانة مفتوحة</span><span className="font-semibold text-warning-600">{openWOs}</span></div>
            <div className="flex justify-between border-t border-neutral-100 pt-2"><span className="text-neutral-400">إجمالي الأصول</span><span className="font-semibold text-neutral-700">{data.assets.length}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3"><Activity size={18} className="text-primary-600" /><h3 className="font-bold text-neutral-800">التشغيل</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-400">الآبار</span><span className="font-semibold text-neutral-700">{data.wells.length}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">المضخات</span><span className="font-semibold text-neutral-700">{data.pumps.length}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">المشتركين</span><span className="font-semibold text-neutral-700">{formatNumber(data.customers)}</span></div>
            <div className="flex justify-between border-t border-neutral-100 pt-2"><span className="text-neutral-400">القراءات</span><span className="font-semibold text-neutral-700">{data.readings.length}</span></div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">التقارير المتاحة (تصدير CSV)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reports.map((r, i) => {
            const Icon = r.icon;
            const colorMap: Record<string, string> = {
              primary: 'bg-primary-50 text-primary-700', accent: 'bg-accent-50 text-accent-700',
              success: 'bg-success-50 text-success-700', warning: 'bg-warning-50 text-warning-700',
              error: 'bg-error-50 text-error-700', neutral: 'bg-neutral-100 text-neutral-600',
            };
            return (
              <div key={i} className="card-hover p-5">
                <div className={`p-2.5 rounded-xl mb-3 ${colorMap[r.color]}`}><Icon size={20} /></div>
                <h3 className="font-bold text-neutral-900 text-sm">{r.title}</h3>
                <p className="text-xs text-neutral-500 mt-1">{r.desc}</p>
                <button onClick={() => exportCSV(r.id)} className="text-primary-600 text-xs font-medium mt-3 flex items-center gap-1 hover:text-primary-700 transition-smooth">
                  <Download size={14} /> تصدير CSV
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5 bg-neutral-50 border-neutral-200">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-neutral-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-neutral-700 text-sm">ملاحظة حول جودة البيانات</h3>
            <p className="text-xs text-neutral-500 mt-1">
              جميع المؤشرات محسوبة من البيانات الفعلية في النظام. نسبة اكتمال البيانات: {formatNumber(dataCompleteness)}%.
              المؤشرات قد تكون غير دقيقة إذا كانت بيانات القراءات غير مكتملة. يُنصح بإتمام دورة قراءة العدادات لتحسين دقة المؤشرات.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
