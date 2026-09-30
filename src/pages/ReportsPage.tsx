import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart3, Droplets, Users, Receipt, AlertTriangle,
  Wrench, TrendingDown, Activity, Download, FileText, Printer,
} from 'lucide-react';

export function ReportsPage() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getYemenBusinessDate = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Aden',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [periodStart, setPeriodStart] = useState(() => `${getYemenBusinessDate().slice(0, 4)}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(() => getYemenBusinessDate());
  const [maintenanceReport, setMaintenanceReport] = useState<any | null>(null);
  const [operationalReport, setOperationalReport] = useState<any | null>(null);
  const validPeriod = periodStart.length === 10 && periodEnd.length === 10 && periodEnd >= periodStart;

  const periodEndExclusive = (() => {
    if (periodEnd.length !== 10) return periodEnd;
    const [year, month, day] = periodEnd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  })();

  const toYemenBoundaryUtc = (date: string) => new Date(`${date}T00:00:00+03:00`).toISOString();
  const periodStartAt = periodStart.length === 10 ? toYemenBoundaryUtc(periodStart) : periodStart;
  const periodEndExclusiveAt = periodEndExclusive.length === 10 ? toYemenBoundaryUtc(periodEndExclusive) : periodEndExclusive;
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

  const fetchData = useCallback(async (silent = false) => {
    if (!currentProject) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(null);
    const pid = currentProject.id;
    try {
      const [c, m, inv, pay, r, f, wo, w, p, a, si] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('project_id', pid),
        supabase.from('meters').select('id', { count: 'exact', head: true }).eq('project_id', pid),
        supabase.from('invoices').select('*').eq('project_id', pid).gte('issue_date', periodStartAt).lt('issue_date', periodEndExclusiveAt),
        supabase.from('payments').select('*').eq('project_id', pid).gte('payment_date', periodStartAt).lt('payment_date', periodEndExclusiveAt),
        supabase.from('meter_readings').select('*').eq('project_id', pid).gte('reading_date', periodStartAt).lt('reading_date', periodEndExclusiveAt),
        supabase.from('faults').select('*').eq('project_id', pid).gte('reported_at', periodStartAt).lt('reported_at', periodEndExclusiveAt),
        supabase.from('maintenance_work_orders').select('*').eq('project_id', pid),
        supabase.from('wells').select('*').eq('project_id', pid),
        supabase.from('pumps').select('*').eq('project_id', pid),
        supabase.from('assets').select('*').eq('project_id', pid),
        supabase.from('service_interruptions').select('*').eq('project_id', pid).lt('started_at', periodEndExclusiveAt).or(`restored_at.is.null,restored_at.gte.${periodStartAt}`).order('started_at',{ ascending: false }),
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
  }, [currentProject, periodStart, periodEnd, validPeriod]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  useEffect(() => {
    if (!currentProject || !validPeriod) return;
    let active = true;
    void supabase.rpc('mizan_maintenance_report', {
      p_project_id: currentProject.id,
      p_period_start: periodStart,
      p_period_end: periodEndExclusive,
    }).then(({ data: result, error: rpcError }) => {
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setMaintenanceReport(result as any);
    });
    return () => { active = false; };
  }, [currentProject, periodStart, periodEnd]);

  useEffect(() => {
    if (!currentProject || !periodStart || !periodEnd) return;
    let active = true;
    void supabase.rpc('mizan_operational_report', {
      p_project_id: currentProject.id,
      p_period_start: periodStart,
      p_period_end: periodEndExclusive,
    }).then(({ data: result, error: rpcError }) => {
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setOperationalReport(result as any);
    });
    return () => { active = false; };
  }, [currentProject, periodStart, periodEnd]);

  useEffect(() => {
    if (!currentProject) return;
    const channel = supabase.channel(`mizan-reports-${currentProject.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meters', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meter_readings', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faults', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_work_orders', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wells', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pumps', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_interruptions', filter: `project_id=eq.${currentProject.id}` }, () => { void fetchData(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentProject, fetchData]);

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تحليل البيانات..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const report = operationalReport || {};
  const totalRevenue = Number(report.invoiced_amount || 0);
  const collected = Number(report.approved_collected_amount || 0);
  const outstanding = Number(report.current_outstanding_amount || 0);
  const production = Number(report.production_m3 || 0);
  const consumption = Number(report.recorded_consumption_m3 || 0);
  const waterBalanceGap = Number(report.water_balance_gap_m3 || 0);
  const waterBalanceComparable = Boolean(report.water_balance_has_production && report.water_balance_has_consumption);
  const waterGapPercent = waterBalanceComparable && production > 0 ? (waterBalanceGap / production) * 100 : null;
  const collectionRate = totalRevenue > 0 ? (collected / totalRevenue * 100) : 0;
  const openFaults = Number(report.open_fault_count || 0);
  const openWOs = Number(maintenanceReport?.work_orders_open_at_end ?? report.open_maintenance_count ?? 0);
  const anomalies = Number(report.reading_anomaly_count || 0);
  const periodReadings = Number(report.reading_count || 0);
  const dataCoverage = data.meters > 0 ? Math.min(periodReadings / data.meters * 100, 100) : 0; // coverage proxy, not completeness
  const openInterruptions = Number(report.open_service_interruption_count || 0);

  const printReport = (title: string, body: string) => {
    const filename = `${currentProject.name_ar} - ${title}`;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) { setError('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'); return; }
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title>
      <style>@page{size:A4;margin:14mm}body{font-family:Arial,Tahoma,sans-serif;color:#17202a;line-height:1.6;font-size:12px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:5px}.meta{color:#667085;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.card{border:1px solid #ddd;padding:9px}.label{color:#667085;font-size:10px}.value{font-size:16px;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ddd;padding:6px;text-align:right}th{background:#f5f5f5}.footer{margin-top:22px;color:#667085;font-size:10px}</style></head><body>
      <h1>${escapeHtml(title)}</h1><div class="meta">المشروع: <strong>${escapeHtml(currentProject.name_ar)}</strong><br>الفترة: <strong>${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</strong><br>تاريخ الإصدار: ${escapeHtml(new Date().toLocaleString('ar-YE'))}</div>
      ${body}<div class="footer">تم إنشاء التقرير من MIZAN AI — البيانات المتاحة للمشروع وقت الإصدار.</div>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  const exportPDF = (type: 'full' | 'maintenance') => {
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    if (type === 'maintenance') {
      const reportLabel = `${periodStart} → ${periodEnd}`;
      const periodWOs = data.workOrders.filter((w: any) => {
        const inPeriod = (value: unknown) => { const d = String(value || '').slice(0,10); return d >= periodStart && d <= periodEnd; };
        return inPeriod(w.created_at) || inPeriod(w.completed_date) || inPeriod(w.closed_at);
      });
      const rows = periodWOs.map((w: any) => `<tr><td>${escapeHtml(w.work_order_number)}</td><td>${escapeHtml(w.type)}</td><td>${escapeHtml(w.priority)}</td><td>${escapeHtml(w.status)}</td><td>${escapeHtml(w.assigned_to || '—')}</td><td>${escapeHtml(formatDate(w.scheduled_date))}</td><td>${escapeHtml(formatDate(w.completed_date))}</td><td>${escapeHtml(formatDate(w.closed_at))}</td></tr>`).join('');
      const m = maintenanceReport || {};
      printReport(`تقرير الصيانة - ${reportLabel}`, `<div class="grid">
        <div class="card"><div class="label">أوامر الصيانة المنشأة</div><div class="value">${m.work_orders_created ?? 0}</div></div>
        <div class="card"><div class="label">المكتملة خلال الفترة</div><div class="value">${m.work_orders_completed ?? 0}</div></div>
        <div class="card"><div class="label">المغلقة</div><div class="value">${m.work_orders_closed ?? 0}</div></div>
        <div class="card"><div class="label">المفتوحة عند نهاية الشهر</div><div class="value">${m.work_orders_open_at_end ?? 0}</div></div>
        <div class="card"><div class="label">الأعطال المبلغ عنها</div><div class="value">${m.faults_reported ?? 0}</div></div>
        <div class="card"><div class="label">تكلفة الصيانة</div><div class="value">${formatCurrency(Number(m.total_maintenance_cost || 0))}</div></div>
        <div class="card"><div class="label">ساعات التوقف المسجلة</div><div class="value">${formatNumber(Number(m.total_downtime_hours || 0))}</div></div>
        <div class="card"><div class="label">متوسط زمن الحل</div><div class="value">${m.average_resolution_hours == null ? '—' : formatNumber(Number(m.average_resolution_hours)) + ' ساعة'}</div></div>
      </div><h2>تفاصيل دورة الصيانة خلال الفترة</h2><table><thead><tr><th>رقم الأمر</th><th>النوع</th><th>الأولوية</th><th>الحالة</th><th>المسؤول</th><th>الموعد</th><th>اكتمل</th><th>أُغلق</th></tr></thead><tbody>${rows || '<tr><td colspan="8">لا توجد حركة صيانة مسجلة لهذه الفترة.</td></tr>'}</tbody></table><p class="footer">المؤشرات الحسابية في هذا القسم صادرة من قاعدة البيانات وفق الفترة المختارة، وليست تقديرات واجهة.</p>`);
      return;
    }
    printReport('التقرير التشغيلي الشامل', `<div class="grid">
      <div class="card"><div class="label">معدل التحصيل</div><div class="value">${formatNumber(collectionRate)}%</div></div>
      <div class="card"><div class="label">الفجوة المائية</div><div class="value">${waterBalanceComparable ? formatNumber((waterBalanceGap / Math.max(production, 1)) * 100)+'%' : '—'}</div></div>
      <div class="card"><div class="label">تغطية القراءات</div><div class="value">${formatNumber(dataCoverage)}%</div></div>
      <div class="card"><div class="label">الفواتير</div><div class="value">${Number(report.invoice_count || 0)}</div></div>
      <div class="card"><div class="label">أعطال مفتوحة</div><div class="value">${openFaults}</div></div>
      <div class="card"><div class="label">أوامر صيانة مفتوحة</div><div class="value">${openWOs}</div></div>
    </div><h2>ميزان المياه</h2><table><tbody><tr><th>الإنتاج خلال الفترة المسجل للآبار</th><td>${formatNumber(production)} م³</td></tr><tr><th>الاستهلاك المسجل من القراءات</th><td>${formatNumber(consumption)} م³</td></tr><tr><th>فجوة ميزان المياه</th><td>${waterBalanceComparable ? formatNumber(waterBalanceGap)+' م³' : 'غير متاحة — بيانات الفترة غير مكتملة'}</td></tr><tr><th>التصنيف</th><td>${waterBalanceComparable ? 'فجوة ميزان المياه وليست NRW نهائياً' : 'غير مكتمل'}</td></tr></tbody></table>
    <h2>الإيرادات والتحصيل</h2><table><tbody><tr><th>إجمالي الفواتير</th><td>${formatCurrency(totalRevenue)}</td></tr><tr><th>التحصيل المعتمد</th><td>${formatCurrency(collected)}</td></tr><tr><th>المتأخرات</th><td>${formatCurrency(outstanding)}</td></tr></tbody></table>`);
  };

  const exportCSV = (type: string) => {
    let rows: string[][] = [];
    let filename = '';

    switch (type) {
      case 'production':
        filename = 'production_report';
        rows = [['المؤشر', 'القيمة', 'المصدر', 'الفترة']];
        rows.push(['الإنتاج المسجل', String(production), 'قاعدة البيانات', `${periodStart} → ${periodEnd}`]);
        rows.push(['الاستهلاك المسجل', String(consumption), 'قاعدة البيانات', `${periodStart} → ${periodEnd}`]);
        break;
      case 'nrw':
        filename = 'nrw_report';
        rows = [['الإنتاج (م³)', 'الاستهلاك (م³)', 'فجوة ميزان المياه (م³)', 'الحالة']];
        rows.push([String(production), String(consumption), waterBalanceComparable ? String(waterBalanceGap) : '—', waterBalanceComparable ? 'قابلة للمقارنة' : 'غير مكتملة']);
        break;
      case 'revenue':
        filename = 'revenue_report';
        rows = [['رقم الفاتورة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'التاريخ']];
        data.invoices.forEach((i: any) => {
          rows.push([i.invoice_number, String(i.grand_total), String(i.amount_paid || 0), String(i.balance), i.status, formatDate(i.issue_date)]);
        });
        break;
      case 'customers':
        filename = 'customers_report';
        rows = [['عدد المشتركين', 'عدد العدادات', 'عدد الفواتير', 'عدد القراءات']];
        rows.push([String(data.customers), String(data.meters), String(report.invoice_count || 0), String(periodReadings)]);
        break;
      case 'faults':
        filename = 'faults_report';
        rows = [['رقم العطل', 'النوع', 'الخطورة', 'الحالة', 'التاريخ']];
        data.faults.forEach((f: any) => {
          rows.push([f.fault_number, f.fault_type || '', f.severity, f.status, formatDate(f.reported_at)]);
        });
        break;
      case 'interruptions':
        filename = 'service_interruptions_report';
        rows = [['رقم التوقف','النوع','الخطورة','الحالة','بداية التوقف','المشتركون المتأثرون','الإنتاج المحتمل المتأثر م3']];
        data.interruptions.forEach((x:any) => rows.push([x.interruption_number,x.interruption_type||'',x.severity,x.status,formatDate(x.started_at),String(x.affected_subscribers||0),String(x.potentially_affected_production_m3||0)]));
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
        rows = [['عدد العدادات', 'عدد القراءات', 'قراءات شاذة', 'تغطية القراءات (%)']];
        rows.push([String(data.meters), String(periodReadings), String(anomalies), dataCoverage.toFixed(1)]);
        break;
      case 'performance':
        filename = 'performance_report';
        rows = [['المؤشر', 'القيمة']];
        rows.push(['معدل التحصيل (%)', collectionRate.toFixed(1)]);
        rows.push(['فجوة ميزان المياه (م³)', waterBalanceComparable ? String(waterBalanceGap) : '—']);
        rows.push(['تغطية القراءات (%)', dataCompleteness.toFixed(1)]);
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
    { id: 'nrw', title: 'تقرير الفجوة المائية', desc: 'يظهر فقط عند توفر قياسات متزامنة لنفس الفترة', icon: TrendingDown, color: 'warning' },
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

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button disabled={!validPeriod} onClick={() => void fetchData(true)} className="btn-primary flex items-center gap-2 disabled:opacity-50"><Activity size={16} /> تطبيق الفترة</button>
        <input aria-label="بداية الفترة" type="date" className="input-field w-auto" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} />
        <input aria-label="نهاية الفترة" type="date" className="input-field w-auto" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} />
        <button onClick={() => exportPDF('full')} className="btn-secondary flex items-center gap-2"><FileText size={16} /> PDF للفترة</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="معدل التحصيل" value={`${formatNumber(collectionRate)}%`} icon={Receipt} color={collectionRate > 60 ? 'success' : 'warning'} />
        <StatCard title="نسبة الفاقد" value="غير متاح" icon={TrendingDown} color="neutral" />
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
              <span className="text-neutral-600">الاستهلاك المسجل من القراءات خلال الفترة</span>
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
              <span className="font-bold text-neutral-700">
                {waterBalanceComparable ? `${formatNumber(waterBalanceGap)} م³` : 'غير متاح — لا توجد قياسات إنتاج واستهلاك متزامنة'}
              </span>
            </div>
            <div className="h-6 bg-neutral-100 rounded-lg overflow-hidden">
              <div className="h-full bg-neutral-300 flex items-center justify-start px-2" style={{ width: waterBalanceComparable && production > 0 ? `${Math.min(Math.max(Math.abs(waterBalanceGap) / production * 100, 0), 100)}%` : '0%' }}>
                <span className="text-xs text-white font-medium">{waterBalanceComparable ? formatNumber(Math.abs(waterBalanceGap) / Math.max(production, 1) * 100) + '%' : '—'}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-4">الفارق أعلاه هو فجوة ميزان المياه (الإنتاج − الاستهلاك المسجل) للفترة، وليس تقديراً نهائياً لـ NRW. لا يُعرض NRW كنسبة إلا بعد اكتمال أساس القياس المطلوب.</p>
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
