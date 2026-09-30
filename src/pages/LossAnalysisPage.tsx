import { useEffect, useMemo, useState } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';

type BalanceRow = {
  period_date: string;
  production_m3: number;
  recorded_consumption_m3: number;
  unaccounted_gap_m3: number;
};

export function LossAnalysisPage() {
  const { currentProject } = useProject();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentProject) { setRows([]); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from('mizan_water_balance')
        .select('period_date,production_m3,recorded_consumption_m3,unaccounted_gap_m3')
        .eq('project_id', currentProject.id)
        .order('period_date', { ascending: false })
        .limit(366);
      if (alive) {
        setRows(error ? [] : ((data || []) as BalanceRow[]));
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentProject]);

  const summary = useMemo(
    () => rows.reduce((a, r) => ({
      production: a.production + Number(r.production_m3 || 0),
      consumption: a.consumption + Number(r.recorded_consumption_m3 || 0),
      gap: a.gap + Number(r.unaccounted_gap_m3 || 0),
    }), { production: 0, consumption: 0, gap: 0 }),
    [rows],
  );
  const comparable = summary.production > 0 && summary.consumption > 0;
  const gapPct = summary.production ? Math.abs(summary.gap) / summary.production * 100 : 0;

  const monthlyRows = useMemo(() => {
    const grouped = new Map<string, BalanceRow>();
    for (const row of rows) {
      const month = String(row.period_date).slice(0, 7);
      const current = grouped.get(month) || { period_date: month, production_m3: 0, recorded_consumption_m3: 0, unaccounted_gap_m3: 0 };
      current.production_m3 += Number(row.production_m3 || 0);
      current.recorded_consumption_m3 += Number(row.recorded_consumption_m3 || 0);
      current.unaccounted_gap_m3 += Number(row.unaccounted_gap_m3 || 0);
      grouped.set(month, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.period_date.localeCompare(a.period_date)).slice(0, 12);
  }, [rows]);

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  return <div className="space-y-6" dir="rtl">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6"/>تحليل ميزان المياه</h1>
      <p className="text-sm text-neutral-500 mt-1">التحليل يعتمد على قياس إنتاج المضخات وقراءات الاستهلاك المسجلة. الفجوة هنا مؤشر ميزان مائي وليست تقديراً نهائياً للفاقد غير المحصل.</p>
    </div>
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-neutral-500">جاري تحميل القياسات...</div> :
      <><div className="grid md:grid-cols-3 gap-4">
        <Metric title="الإنتاج المقاس" value={summary.production.toLocaleString('ar-YE')} unit="م³"/>
        <Metric title="الاستهلاك المسجل" value={summary.consumption.toLocaleString('ar-YE')} unit="م³"/>
        <Metric title="فجوة الميزان المائي" value={summary.gap.toLocaleString('ar-YE')} unit={comparable ? gapPct.toFixed(1)+'%' : 'غير قابلة للمقارنة'} alert={comparable && gapPct>15}/>
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="p-4 border-b font-semibold">السجل الشهري المبني على القياسات الفعلية</div>
        {monthlyRows.length===0?<div className="p-8 text-center text-neutral-500">لا توجد قياسات إنتاج واستهلاك قابلة للعرض بعد.</div>:<table className="w-full text-sm"><thead className="bg-neutral-50"><tr><th className="p-3 text-right">الفترة</th><th className="p-3 text-right">الإنتاج</th><th className="p-3 text-right">الاستهلاك</th><th className="p-3 text-right">فجوة الميزان</th></tr></thead><tbody>{monthlyRows.map((r)=><tr key={r.period_date} className="border-t"><td className="p-3">{r.period_date}</td><td className="p-3">{Number(r.production_m3||0).toLocaleString('ar-YE')}</td><td className="p-3">{Number(r.recorded_consumption_m3||0).toLocaleString('ar-YE')}</td><td className="p-3">{Number(r.unaccounted_gap_m3||0).toLocaleString('ar-YE')} م³</td></tr>)}</tbody></table>}
      </div>
      {comparable && gapPct>15 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3"><AlertTriangle className="w-5 h-5"/><span>الفجوة التشغيلية تتجاوز 15% من الإنتاج المقاس ضمن البيانات المتاحة؛ يلزم التحقق من القياسات وسلسلة التشغيل قبل تفسيرها.</span></div>}
      </>
    }
  </div>;
}

function Metric({title,value,unit,alert=false}:{title:string;value:string;unit:string;alert?:boolean}) {
  return <div className={'rounded-xl border bg-white p-5 '+(alert?'border-amber-300':'')}><div className="text-sm text-neutral-500">{title}</div><div className="text-2xl font-bold mt-2">{value} <span className="text-sm font-normal text-neutral-500">{unit}</span></div></div>;
}