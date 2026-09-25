import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import {
  Droplets, Users, Receipt, TrendingDown, AlertTriangle,
  Wrench, Gauge, Activity, Wallet, Building2, MapPin, BrainCircuit,
} from 'lucide-react';
import {
  formatNumber, formatCurrency, formatRelativeTime, statusColor,
  faultStatusLabels, invoiceStatusLabels,
} from '@/lib/utils';
import type { Invoice, Fault, WorkOrder, MeterReading, Well, Pump } from '@/types';

export function DashboardPage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    customers: 0,
    meters: 0,
    invoices: [] as Invoice[],
    unpaidInvoices: [] as Invoice[],
    overdueAmount: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    faults: [] as Fault[],
    workOrders: [] as WorkOrder[],
    readings: [] as MeterReading[],
    wells: [] as Well[],
    pumps: [] as Pump[],
    waterProduction: 0,
    waterConsumption: 0,
    ocrReadings: 0,
    anomalies: 0,
    lowConfidence: 0,
  });

  const fetchData = async () => {
    if (!currentProject) return;
    const pid = currentProject.id;
    setLoading(true);
    setError(null);
    try {
      const [customers, meters, invoices, payments, faults, wos, readings, wells, pumps, ocrReadings, anomalies, lowConfidence] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'active'),
        supabase.from('meters').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'active'),
        supabase.from('invoices').select('*').eq('project_id', pid).order('issue_date', { ascending: false }).limit(50),
        supabase.from('payments').select('amount').eq('project_id', pid),
        supabase.from('faults').select('*').eq('project_id', pid).order('reported_at', { ascending: false }).limit(10),
        supabase.from('maintenance_work_orders').select('*').eq('project_id', pid).order('created_at', { ascending: false }).limit(10),
        supabase.from('meter_readings').select('*').eq('project_id', pid).order('reading_date', { ascending: false }).limit(10),
        supabase.from('wells').select('*').eq('project_id', pid),
        supabase.from('pumps').select('*').eq('project_id', pid),
        supabase.from('meter_readings').select('id', { count: 'exact', head: true }).eq('project_id', pid).not('ai_extracted_value','is',null),
        supabase.from('meter_readings').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('anomaly_flag',true),
        supabase.from('meter_readings').select('id', { count: 'exact', head: true }).eq('project_id', pid).not('ai_extracted_value','is',null).lt('ai_confidence',0.8),
      ]);

      const invData = invoices.data as Invoice[] || [];
      const unpaid = invData.filter(i => i.status === 'unpaid' || i.status === 'overdue');
      const overdueAmt = invData.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.balance), 0);
      const totalRev = invData.reduce((s, i) => s + Number(i.grand_total), 0);
      const collectedRev = (payments.data || []).reduce((s, p: any) => s + Number(p.amount), 0);
      const production = (wells.data as Well[] || []).reduce((s, w) => s + Number(w.daily_output_m3), 0);
      const consumption = invData.reduce((s, i) => s + Number(i.consumption_m3), 0);

      setStats({
        customers: customers.count || 0,
        meters: meters.count || 0,
        invoices: invData,
        unpaidInvoices: unpaid,
        overdueAmount: overdueAmt,
        totalRevenue: totalRev,
        collectedRevenue: collectedRev,
        faults: faults.data as Fault[] || [],
        workOrders: wos.data as WorkOrder[] || [],
        readings: readings.data as MeterReading[] || [],
        wells: wells.data as Well[] || [],
        pumps: pumps.data as Pump[] || [],
        waterProduction: production,
        waterConsumption: consumption,
        ocrReadings: ocrReadings.count || 0,
        anomalies: anomalies.count || 0,
        lowConfidence: lowConfidence.count || 0,
      });
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <Building2 size={48} className="opacity-40" />
        <p className="mr-3 text-lg">اختر مشروعاً للبدء</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const nrw: number | null = stats.waterProduction > 0
    ? ((stats.waterProduction - stats.waterConsumption) / stats.waterProduction * 100)
    : null;
  const collectionRate = stats.totalRevenue > 0
    ? (stats.collectedRevenue / stats.totalRevenue * 100)
    : 0;
  const openFaults = stats.faults.filter(f => f.status !== 'closed' && f.status !== 'resolved');
  const openWOs = stats.workOrders.filter(w => w.status === 'open' || w.status === 'in_progress');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">لوحة قيادة {currentProject.name_ar}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            <MapPin size={14} className="inline ml-1" />
            {currentProject.address || 'تعز - اليمن'}
            <span className="mx-2 text-neutral-300">|</span>
            المستفيدون: {formatNumber(currentProject.beneficiary_count)} شخص
          </p>
        </div>
        <Badge status={currentProject.status} label={currentProject.status === 'active' ? 'نشط' : 'غير نشط'} />
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إنتاج المياه اليومي"
          value={`${formatNumber(stats.waterProduction)} م³`}
          icon={Droplets}
          color="primary"
          subtitle="من إجمالي الآبار"
        />
        <StatCard
          title="الاستهلاك المسجل"
          value={`${formatNumber(stats.waterConsumption)} م³`}
          icon={Gauge}
          color="accent"
          subtitle="من الفواتير"
        />
        <StatCard
          title="الفاقد (NRW)"
          value={nrw === null ? '—' : `${formatNumber(nrw)}%`}
          icon={TrendingDown}
          color={nrw === null ? 'success' : nrw > 30 ? 'error' : nrw > 15 ? 'warning' : 'success'}
          subtitle="غير مدفوع العائد"
        />
        <StatCard
          title="المشتركين النشطين"
          value={formatNumber(stats.customers)}
          icon={Users}
          color="neutral"
          subtitle={`${formatNumber(stats.meters)} عداد نشط`}
        />
      </div>

      {/* KPI Cards Row 2 - Financial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatCurrency(stats.totalRevenue)}
          icon={Wallet}
          color="success"
        />
        <StatCard
          title="المحصّل"
          value={formatCurrency(stats.collectedRevenue)}
          icon={Receipt}
          color="success"
          trend={{ value: `نسبة التحصيل ${formatNumber(collectionRate)}%`, positive: collectionRate > 60 }}
        />
        <StatCard
          title="المتأخرات"
          value={formatCurrency(stats.overdueAmount)}
          icon={AlertTriangle}
          color={stats.overdueAmount > 0 ? 'error' : 'neutral'}
          subtitle={`${stats.unpaidInvoices.length} فاتورة غير مدفوعة`}
        />
        <StatCard
          title="أعطال مفتوحة"
          value={formatNumber(openFaults.length)}
          icon={AlertTriangle}
          color={openFaults.length > 0 ? 'error' : 'success'}
          subtitle={`${openWOs.length} أمر صيانة قيد التنفيذ`}
        />
      </div>

      {/* Infrastructure Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Droplets size={18} className="text-primary-600" />
            <h3 className="font-bold text-neutral-800">حالة الآبار</h3>
          </div>
          {stats.wells.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4">لا توجد آبار مسجلة</p>
          ) : (
            <div className="space-y-3">
              {stats.wells.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-neutral-700">{w.code}</span>
                    <span className="text-neutral-400 mr-2">{w.name_ar}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">{formatNumber(w.daily_output_m3)} م³/يوم</span>
                    <Badge status={w.status} label={w.status === 'operational' ? 'يعمل' : 'متوقف'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-accent-600" />
            <h3 className="font-bold text-neutral-800">حالة المضخات</h3>
          </div>
          {stats.pumps.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4">لا توجد مضخات مسجلة</p>
          ) : (
            <div className="space-y-3">
              {stats.pumps.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-neutral-700">{p.code}</span>
                    <span className="text-neutral-400 mr-2">{p.manufacturer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">{formatNumber(p.operating_hours)} ساعة</span>
                    <Badge status={p.status} label={p.status === 'operational' ? 'يعمل' : 'متوقف'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={18} className="text-warning-600" />
            <h3 className="font-bold text-neutral-800">آخر أوامر الصيانة</h3>
          </div>
          {stats.workOrders.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4">لا توجد أوامر صيانة</p>
          ) : (
            <div className="space-y-3">
              {stats.workOrders.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-neutral-700">{w.work_order_number}</span>
                    <p className="text-xs text-neutral-400 truncate">{w.description}</p>
                  </div>
                  <Badge status={w.status} label={w.status === 'open' ? 'مفتوح' : w.status === 'in_progress' ? 'قيد التنفيذ' : w.status === 'completed' ? 'مكتمل' : w.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-success-600" />
              <h3 className="font-bold text-neutral-800">أحدث الفواتير</h3>
            </div>
          </div>
          {stats.invoices.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4">لا توجد فواتير</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200">
                    <th className="pb-2 font-medium">رقم الفاتورة</th>
                    <th className="pb-2 font-medium">المبلغ</th>
                    <th className="pb-2 font-medium">الحالة</th>
                    <th className="pb-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stats.invoices.slice(0, 6).map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50 transition-smooth">
                      <td className="py-2.5 font-medium text-neutral-700">{inv.invoice_number}</td>
                      <td className="py-2.5 text-neutral-600">{formatCurrency(inv.grand_total)}</td>
                      <td className="py-2.5">
                        <Badge status={inv.status} label={invoiceStatusLabels[inv.status] || inv.status} />
                      </td>
                      <td className="py-2.5 text-xs text-neutral-400">{formatRelativeTime(inv.issue_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Faults */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-error-600" />
              <h3 className="font-bold text-neutral-800">آخر البلاغات والأعطال</h3>
            </div>
          </div>
          {stats.faults.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4">لا توجد أعطال مسجلة</p>
          ) : (
            <div className="space-y-3">
              {stats.faults.slice(0, 6).map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-2 py-2 border-b border-neutral-100 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-neutral-700">{f.fault_number}</span>
                      <span className={`badge ${statusColor(f.severity)}`}>
                        {f.severity === 'high' ? 'عالٍ' : f.severity === 'critical' ? 'حرج' : f.severity === 'medium' ? 'متوسط' : 'منخفض'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 truncate">{f.description}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{formatRelativeTime(f.reported_at)}</p>
                  </div>
                  <Badge status={f.status} label={faultStatusLabels[f.status] || f.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile && (profile.role === 'tenant_manager' || profile.role === 'platform_admin') && (
        <div className="card p-5 border-primary-200 bg-primary-50/40">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={20} className="text-primary-700" />
            <div>
              <h3 className="font-bold text-neutral-900">Intelligence Engine</h3>
              <p className="text-xs text-neutral-500">OCR → Anomaly Detection → Analytics → AI Assistant → Decision Support</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-xl bg-white p-3 border border-neutral-100"><p className="text-xs text-neutral-400">قراءات OCR</p><p className="text-xl font-bold">{formatNumber(stats.ocrReadings)}</p></div>
            <div className="rounded-xl bg-white p-3 border border-neutral-100"><p className="text-xs text-neutral-400">شذوذ مكتشف</p><p className="text-xl font-bold text-error-600">{formatNumber(stats.anomalies)}</p></div>
            <div className="rounded-xl bg-white p-3 border border-neutral-100"><p className="text-xs text-neutral-400">OCR منخفض الثقة</p><p className="text-xl font-bold text-warning-600">{formatNumber(stats.lowConfidence)}</p></div>
            <div className="rounded-xl bg-white p-3 border border-neutral-100"><p className="text-xs text-neutral-400">فاقد NRW</p><p className="text-xl font-bold">{nrw === null ? '—' : formatNumber(nrw) + '%'}</p></div>
            <div className="rounded-xl bg-white p-3 border border-neutral-100"><p className="text-xs text-neutral-400">أعطال مفتوحة</p><p className="text-xl font-bold">{formatNumber(openFaults.length)}</p></div>
          </div>
          <div className="mt-4 rounded-xl bg-white border border-neutral-100 p-4">
            <p className="text-sm font-semibold text-neutral-800 mb-2">دعم القرار</p>
            <ul className="text-sm text-neutral-600 space-y-1">
              {stats.anomalies > 0 && <li>• مراجعة القراءات الشاذة قبل اعتمادها في الفوترة.</li>}
              {stats.lowConfidence > 0 && <li>• التحقق من صور العدادات ذات الثقة المنخفضة.</li>}
              {nrw !== null && nrw > 30 && <li>• فتح تحليل فاقد تشغيلي/شبكي لأن NRW تجاوز 30%.</li>}
              {openFaults.some(f => f.severity === 'critical') && <li>• إعطاء أولوية للأعطال الحرجة المفتوحة.</li>}
              {stats.anomalies === 0 && stats.lowConfidence === 0 && (nrw === null || nrw <= 30) && !openFaults.some(f => f.severity === 'critical') && <li>• لا توجد إشارة حرجة تلقائياً من البيانات الحالية؛ استمر في دورة القياس والتحقق.</li>}
            </ul>
            <p className="text-xs text-neutral-400 mt-3">التوصيات تفسيرية ولا تنفذ أي تغيير تلقائياً. مساعد ميزان يعمل ضمن صلاحيات المشروع ويعتمد على البيانات المصرح بها.</p>
          </div>
        </div>
      )}

      {/* Executive Summary Bar */}
      <div className="card p-5 bg-gradient-to-l from-primary-900 to-primary-800 text-white border-0">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={20} className="text-accent-300" />
          <h3 className="font-bold">الملخص التنفيذي - ماذا يحدث الآن؟</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-primary-300 text-xs">معدل التحصيل</p>
            <p className={`text-2xl font-bold ${collectionRate > 60 ? 'text-success-300' : 'text-warning-300'}`}>{formatNumber(collectionRate)}%</p>
          </div>
          <div>
            <p className="text-primary-300 text-xs">نسبة الفاقد</p>
            <p className={`text-2xl font-bold ${nrw === null ? 'text-success-300' : nrw < 15 ? 'text-success-300' : nrw < 30 ? 'text-warning-300' : 'text-error-300'}`}>{nrw === null ? '—' : `${formatNumber(nrw)}%`}</p>
          </div>
          <div>
            <p className="text-primary-300 text-xs">أعطال حرجة</p>
            <p className="text-2xl font-bold text-white">{openFaults.filter(f => f.severity === 'critical' || f.severity === 'high').length}</p>
          </div>
          <div>
            <p className="text-primary-300 text-xs">أوامر صيانة معلقة</p>
            <p className="text-2xl font-bold text-white">{openWOs.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
