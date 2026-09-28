import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle, Cloud, CloudOff, Gauge, Loader2, Search, AlertTriangle, Save, Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { MeterCamera } from '@/components/MeterCamera';
import { recognizeMeterImage } from '@/lib/meter-ocr';
import { addPendingReading, startMeterReadingSync } from '@/lib/mirrorSync';
import { readFieldCache, saveFieldCache } from '@/lib/mirrorOfflineDb';
import { formatNumber, formatRelativeTime, readingStatusLabels, syncStatusLabels } from '@/lib/utils';
import type { Customer, Meter, MeterReading } from '@/types';
import { toast } from 'sonner';

type MeterWithCustomer = Meter & { customers: Customer };
type RosterCache = {
  meters: MeterWithCustomer[];
  readings: MeterReading[];
  tenantName: string;
};

const cacheKey = (projectId: string) => `field-roster:${projectId}`;

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('ar');
}

export function ReadingsPage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const [meters, setMeters] = useState<MeterWithCustomer[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [selectedMeter, setSelectedMeter] = useState<MeterWithCustomer | null>(null);
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [form, setForm] = useState({ reading_value: '', ai_extracted_value: '', ai_confidence: '', gps_lat: '', gps_lng: '', gps_accuracy: '', notes: '' });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    startMeterReadingSync();
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);


  const load = useCallback(async () => {
    if (!currentProject) { setLoading(false); return; }
    setLoading(true);
    setPageError(null);
    const pid = currentProject.id;

    if (!navigator.onLine) {
      const cached = await readFieldCache<RosterCache>(cacheKey(pid));
      if (cached?.data) {
        setMeters(cached.data.meters);
        setReadings(cached.data.readings);
        setTenantName(cached.data.tenantName);
        setLoading(false);
        return;
      }
      setLoading(false);
      setPageError('لا توجد بيانات ميدانية محفوظة على الجهاز لهذا المشروع. اتصل بالإنترنت مرة واحدة لمزامنة قائمة المشتركين والعدادات.');
      return;
    }

    try {
      const [meterResult, readingResult, tenantResult] = await Promise.all([
        supabase.from('meters').select('*, customers!inner(*)').eq('project_id', pid).eq('status', 'active').order('meter_number'),
        supabase.from('meter_readings').select('*').eq('project_id', pid).order('reading_date', { ascending: false }).limit(100),
        supabase.from('tenants').select('name_ar').eq('id', currentProject.tenant_id).maybeSingle(),
      ]);
      if (meterResult.error) throw meterResult.error;
      if (readingResult.error) throw readingResult.error;
      const roster = {
        meters: (meterResult.data || []) as MeterWithCustomer[],
        readings: (readingResult.data || []) as MeterReading[],
        tenantName: tenantResult.data?.name_ar || currentProject.name_ar,
      };
      setMeters(roster.meters);
      setReadings(roster.readings);
      setTenantName(roster.tenantName);
      await saveFieldCache(cacheKey(pid), roster);
    } catch (err) {
      const cached = await readFieldCache<RosterCache>(cacheKey(pid));
      if (cached?.data) {
        setMeters(cached.data.meters);
        setReadings(cached.data.readings);
        setTenantName(cached.data.tenantName);
        toast.info('تم فتح آخر نسخة ميدانية محفوظة على الجهاز.');
      } else {
        setPageError(err instanceof Error ? err.message : 'فشل تحميل بيانات القراءة');
      }
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!currentProject) return;
    const channel = supabase.channel(`mizan-field-${currentProject.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meter_readings', filter: `project_id=eq.${currentProject.id}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `project_id=eq.${currentProject.id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentProject, load]);

  const filteredMeters = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return meters.slice(0, 30);
    return meters.filter((m) =>
      normalizeSearch(m.customers.name_ar).includes(q) ||
      normalizeSearch(m.customers.phone || '').includes(q) ||
      normalizeSearch(m.meter_number).includes(q) ||
      normalizeSearch(m.serial_number || '').includes(q)
    ).slice(0, 30);
  }, [meters, search]);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
  const alreadyReadToday = selectedMeter
    ? readings.some((r) => r.meter_id === selectedMeter.id && r.business_date === today && !['void','exception'].includes(r.status))
    : false;

  const openCustomer = (meter: MeterWithCustomer) => {
    setSelectedMeter(meter);
    setSearch(meter.customers.name_ar);
    setShowResults(false);
    setCapturedPhoto(null);
    setForm({ reading_value: '', ai_extracted_value: '', ai_confidence: '', gps_lat: '', gps_lng: '', gps_accuracy: '', notes: '' });
    const hasTodayReading = readings.some((r) => r.meter_id === meter.id && r.business_date === today && !['void','exception'].includes(r.status));
    setFormError(hasTodayReading ? 'تم تسجيل قراءة لهذا العداد اليوم. يمنع النظام تكرار القراءة في نفس التاريخ.' : null);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, gps_lat: pos.coords.latitude.toFixed(6), gps_lng: pos.coords.longitude.toFixed(6), gps_accuracy: String(Math.round(pos.coords.accuracy)) })),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleCapture = async (file: File, previewUrl: string) => {
    if (!selectedMeter) return;
    setCapturedPhoto({ file, previewUrl });
    setForm((f) => ({ ...f, reading_value: '', ai_extracted_value: '', ai_confidence: '' }));
    setFormError(null);
    setOcrProcessing(true);
    captureLocation();
    try {
      const result = await recognizeMeterImage(file, {
        knownMeterNumber: selectedMeter.serial_number || undefined,
        previousReading: selectedMeter.last_reading,
      });
      if (result.readingAmbiguous || result.readingValue == null) {
        throw new Error('تعذر استخراج قراءة واحدة موثوقة. أعد التصوير مع ظهور رقم العداد والقراءة بوضوح.');
      }
      if (!result.meterNumberMatch) {
        throw new Error('تعذر إثبات هوية العداد من الصورة.');
      }
      setForm((f) => ({
        ...f,
        reading_value: String(result.readingValue),
        ai_extracted_value: String(result.readingValue),
        ai_confidence: String(result.readingConfidence),
      }));
      toast.success('تم التحقق من هوية العداد واستخراج القراءة آلياً.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر تحليل صورة العداد');
    } finally {
      setOcrProcessing(false);
    }
  };

  const save = async () => {
    if (!selectedMeter || !currentProject || !profile) return;
    setFormError(null);
    if (alreadyReadToday) { setFormError('لا يمكن تسجيل أكثر من قراءة لنفس العداد في نفس التاريخ.'); return; }
    if (!capturedPhoto) { setFormError('تصوير العداد مطلوب قبل الحفظ.'); return; }
    const value = Number(form.reading_value);
    const confidence = Number(form.ai_confidence);
    if (!Number.isFinite(value) || value < 0) { setFormError('القراءة الحالية غير صحيحة.'); return; }
    if (!Number.isFinite(confidence) || confidence < 70) { setFormError('الثقة في استخراج القراءة أقل من الحد المسموح. أعد التصوير.'); return; }
    if (value < selectedMeter.last_reading) { setFormError('القراءة الحالية أقل من القراءة السابقة. يلزم مسار استثناء.'); return; }

    setSaving(true);
    const readingDate = new Date().toISOString();
    try {
      if (!navigator.onLine) {
        await addPendingReading({
          customerId: selectedMeter.customer_id!,
          meterId: selectedMeter.id,
          meterNumber: selectedMeter.meter_number,
          meterSerialNumber: selectedMeter.serial_number!,
          projectId: currentProject.id,
          current: value,
          readingDate,
          latitude: form.gps_lat ? Number(form.gps_lat) : null,
          longitude: form.gps_lng ? Number(form.gps_lng) : null,
          accuracy: form.gps_accuracy ? Number(form.gps_accuracy) : null,
          readingSource: 'OCR',
          aiExtractedValue: value,
          aiConfidence: confidence,
          aiModel: 'local-ocr',
          detectedMeterSerialNumber: selectedMeter.serial_number,
          notes: form.notes || null,
        }, capturedPhoto.file);
        toast.success('تم حفظ القراءة والصورة محلياً. ستتم المزامنة تلقائياً عند عودة الاتصال.');
        setSelectedMeter(null);
        setCapturedPhoto(null);
        setForm({ reading_value: '', ai_extracted_value: '', ai_confidence: '', gps_lat: '', gps_lng: '', gps_accuracy: '', notes: '' });
        return;
      }

      const clientCaptureId = crypto.randomUUID();
      const extension = capturedPhoto.file.type.includes('png') ? 'png' : capturedPhoto.file.type.includes('webp') ? 'webp' : 'jpg';
      const imagePath = `${currentProject.id}/${selectedMeter.id}/${clientCaptureId}.${extension}`;
      const upload = await supabase.storage.from('meter-readings').upload(imagePath, capturedPhoto.file, { contentType: capturedPhoto.file.type || 'image/jpeg', upsert: false });
      if (upload.error) throw new Error(`تعذر حفظ صورة العداد: ${upload.error.message}`);

      const { data, error } = await supabase.rpc('mrx_capture_meter_reading', {
        p_meter_id: selectedMeter.id,
        p_reading_value: value,
        p_reading_date: readingDate,
        p_reading_method: 'photo',
        p_image_url: imagePath,
        p_gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
        p_gps_lng: form.gps_lng ? Number(form.gps_lng) : null,
        p_gps_accuracy: form.gps_accuracy ? Number(form.gps_accuracy) : null,
        p_ai_extracted_value: value,
        p_ai_confidence: confidence,
        p_ai_model: 'local-ocr',
        p_notes: form.notes || null,
        p_client_capture_id: clientCaptureId,
        p_detected_meter_number: selectedMeter.serial_number,
      });
      if (error) {
        await supabase.storage.from('meter-readings').remove([imagePath]);
        throw new Error(error.message);
      }

      const recorded = data as MeterReading;
      setReadings((rows) => [recorded, ...rows]);
      setMeters((rows) => rows.map((m) => m.id === selectedMeter.id ? { ...m, last_reading: value, last_reading_date: readingDate } : m));
      toast.success('تم تسجيل القراءة وحساب الفاتورة تلقائياً. الاعتماد المالي يكون عند التحصيل.');
      setSelectedMeter(null);
      setCapturedPhoto(null);
      setForm({ reading_value: '', ai_extracted_value: '', ai_confidence: '', gps_lat: '', gps_lng: '', gps_accuracy: '', notes: '' });
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر تسجيل القراءة');
    } finally {
      setSaving(false);
    }
  };

  const consumption = selectedMeter && form.reading_value ? Math.max(Number(form.reading_value) - Number(selectedMeter.last_reading), 0) : 0;

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تجهيز سجل القراءة الميداني..." />;
  if (pageError) return <ErrorState message={pageError} onRetry={load} />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">قراءة العدادات</h1>
          <p className="text-sm text-neutral-500 mt-1">{tenantName || currentProject.name_ar} · {currentProject.name_ar}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${online ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
          {online ? <><Cloud size={16}/> متصل</> : <><CloudOff size={16}/> وضع العمل دون اتصال</>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="عدادات نشطة" value={formatNumber(meters.length)} icon={Gauge} color="primary"/>
        <StatCard title="قراءات مسجلة" value={formatNumber(readings.length)} icon={CheckCircle} color="success"/>
        <StatCard title="آخر مزامنة" value={online ? 'متصل' : 'محلي'} icon={Clock3} color={online ? 'success' : 'warning'}/>
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4"><Search size={19} className="text-primary-700"/><h2 className="font-bold text-neutral-900">اختر المشترك</h2></div>
        <div className="relative">
          <input
            className="input-field pr-10 text-base"
            placeholder="ابحث باسم المشترك أو رقم الهاتف أو رقم العداد أو الرقم التسلسلي..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            autoComplete="off"
          />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
          {showResults && filteredMeters.length > 0 && (
            <div className="absolute z-30 mt-2 w-full bg-white border border-neutral-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
              {filteredMeters.map((m) => (
                <button key={m.id} className="w-full text-right px-4 py-3 hover:bg-neutral-50 border-b last:border-0" onMouseDown={(e) => e.preventDefault()} onClick={() => openCustomer(m)}>
                  <div className="flex items-center justify-between gap-4">
                    <div><p className="font-semibold text-neutral-900">{m.customers.name_ar}</p><p className="text-xs text-neutral-500 mt-1">{m.customers.phone || 'بدون هاتف'} · هوية العداد: {m.serial_number || 'غير مسجلة'}</p><p className="text-xs text-neutral-400 mt-1">الرقم التشغيلي للنظام: {m.meter_number}</p></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedMeter && (
        <section className="card p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 rounded-xl p-4">
            <div><p className="text-xs text-neutral-400">المشترك</p><p className="font-bold">{selectedMeter.customers.name_ar}</p></div>
            <div><p className="text-xs text-neutral-400">هوية العداد (الرقم التسلسلي)</p><p className="font-bold">{selectedMeter.serial_number || 'غير مسجلة'}</p><p className="text-xs text-neutral-400 mt-1">الرقم التشغيلي للنظام: {selectedMeter.meter_number}</p></div>
            <div><p className="text-xs text-neutral-400">الهاتف</p><p className="font-bold">{selectedMeter.customers.phone || '—'}</p></div>
            <div><p className="text-xs text-neutral-400">القراءة السابقة</p><p className="font-bold text-primary-700">{formatNumber(selectedMeter.last_reading)}</p></div>
          </div>

          {alreadyReadToday && <div className="p-3 rounded-lg bg-warning-50 text-warning-800 text-sm flex gap-2"><AlertTriangle size={18}/> توجد قراءة مسجلة لهذا العداد اليوم. يمنع النظام أي قراءة ثانية في نفس التاريخ.</div>}

          <div className="border rounded-xl p-4 bg-neutral-50/70">
            <div className="flex items-center gap-2 mb-3"><Camera size={18} className="text-primary-700"/><h3 className="font-bold">تصوير العداد والتحقق</h3></div>
            <p className="text-xs text-neutral-500 mb-3">يجب أن يظهر الرقم التسلسلي للعداد والقراءة في الصورة. يتم التحقق آلياً من التطابق قبل تسجيل القراءة؛ لا يوجد اعتماد مالي للقراءة.</p>
            <MeterCamera initialPreview={capturedPhoto?.previewUrl} disabled={saving || alreadyReadToday} onCapture={handleCapture}/>
            {ocrProcessing && <div className="mt-3 flex items-center gap-2 text-sm text-primary-700"><Loader2 size={16} className="animate-spin"/> جارٍ التحقق من هوية العداد واستخراج القراءة...</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label-field">القراءة الحالية</label><input className="input-field text-lg font-bold" value={form.reading_value} readOnly placeholder="تُملأ تلقائياً من الصورة"/></div>
            <div><label className="label-field">الاستهلاك المحسوب</label><div className="input-field bg-neutral-50 font-bold">{formatNumber(consumption)} م³</div></div>
            <div><label className="label-field">ثقة الاستخراج</label><div className="input-field bg-neutral-50">{form.ai_confidence ? `${form.ai_confidence}%` : '—'}</div></div>
          </div>

          <div><label className="label-field">ملاحظة ميدانية (اختيارية)</label><textarea className="input-field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="تُستخدم فقط عند الحاجة لتوثيق ملاحظة ميدانية."/></div>

          {formError && <div className="p-3 rounded-lg bg-error-50 text-error-700 text-sm flex gap-2"><AlertTriangle size={18}/>{formError}</div>}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setSelectedMeter(null)}>إلغاء</button>
            <button className="btn-primary flex-1" disabled={saving || ocrProcessing || alreadyReadToday || !form.reading_value || !capturedPhoto} onClick={save}>
              {saving ? <><Loader2 size={17} className="animate-spin"/> جاري الحفظ...</> : <><Save size={17}/> حفظ القراءة</>}
            </button>
          </div>

          <div className="text-xs text-neutral-500">
            عند الحفظ: القراءة تُعتمد، وتُصدر الفاتورة آلياً، وتُرحّل المتأخرات، وتُحدّث بيانات المشترك والمؤشرات ضمن نفس المعاملة.
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-3">آخر القراءات</h2>
        {readings.length === 0 ? <div className="card"><EmptyState icon={Gauge} title="لا توجد قراءات مسجلة"/></div> :
          <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right text-xs text-neutral-400 bg-neutral-50 border-b">
            <th className="px-4 py-3">المشترك</th><th className="px-4 py-3">هوية العداد</th><th className="px-4 py-3">السابقة</th><th className="px-4 py-3">الحالية</th><th className="px-4 py-3">الاستهلاك</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">التاريخ</th>
          </tr></thead><tbody className="divide-y">
            {readings.slice(0,30).map((r) => {
              const meter = meters.find((m) => m.id === r.meter_id);
              return <tr key={r.id}><td className="px-4 py-3">{meter?.customers.name_ar || '—'}</td><td className="px-4 py-3">{meter?.serial_number || '—'}</td><td className="px-4 py-3">{formatNumber(r.previous_reading)}</td><td className="px-4 py-3 font-semibold">{formatNumber(r.reading_value)}</td><td className="px-4 py-3">{formatNumber(r.consumption)} م³</td><td className="px-4 py-3"><Badge status={r.status} label={readingStatusLabels[r.status] || r.status}/></td><td className="px-4 py-3 text-xs text-neutral-400">{formatRelativeTime(r.reading_date)}</td></tr>;
            })}
          </tbody></table></div>}
      </section>
    </div>
  );
}