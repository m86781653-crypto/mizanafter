import { useEffect, useState } from 'react';
import { extractMeterReading, isPermanentMRXError, listFailedMRXCaptures, queueMRXCapture, syncMRXCapture, syncPendingMRXCaptures } from '@/lib/mrxOfflineQueue';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import {
  formatNumber, formatRelativeTime,
  readingStatusLabels, syncStatusLabels,
} from '@/lib/utils';
import {
  Gauge, Camera, MapPin, Save, AlertTriangle,
  CheckCircle, Cloud, CloudOff, Clock, Loader2,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import type { Meter, MeterReading, Customer } from '@/types';

export function ReadingsPage() {
  const { currentProject } = useProject();
  const [meters, setMeters] = useState<(Meter & { customers?: Customer })[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<(Meter & { customers?: Customer }) | null>(null);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [manualException, setManualException] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [failedCaptures, setFailedCaptures] = useState(0);
  const [form, setForm] = useState({
    reading_value: '', reading_method: 'manual',
    gps_lat: '', gps_lng: '', gps_accuracy: '',
    reader_name: '', notes: '',
    ai_extracted_value: '', ai_confidence: '',
  });
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshQueueState = async () => {
      try { setFailedCaptures((await listFailedMRXCaptures()).length); } catch { setFailedCaptures(0); }
    };
    const syncAndRefresh = async () => {
      if (navigator.onLine) await syncPendingMRXCaptures().catch(() => undefined);
      await refreshQueueState();
    };
    const updateOnline = () => {
      setOnline(navigator.onLine);
      void syncAndRefresh();
    };
    const handleVisibility = () => { if (document.visibilityState === 'visible') void syncAndRefresh(); };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    void syncAndRefresh();
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!currentProject) { setLoading(false); return; }
    const pid = currentProject.id;
    (async () => {
      setLoading(true);
      setPageError(null);
      try {
        const [m, r] = await Promise.all([
          supabase.from('meters').select('*, customers(name_ar, customer_number, phone)').eq('project_id', pid).eq('status', 'active').order('meter_number'),
          supabase.from('meter_readings').select('*').eq('project_id', pid).order('reading_date', { ascending: false }).limit(20),
        ]);
        if (m.error) throw m.error;
        if (r.error) throw r.error;
        setMeters((m.data as any[]) || []);
        setReadings((r.data as MeterReading[]) || []);
      } catch (err) {
        setPageError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentProject]);

  const stats = {
    total: readings.length,
    pending: readings.filter(r => r.status === 'pending').length,
    anomalies: readings.filter(r => r.anomaly_flag).length,
    synced: readings.filter(r => r.sync_status === 'synced').length,
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('خدمة تحديد الموقع غير متاحة على هذا الجهاز');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({
          ...form,
          gps_lat: pos.coords.latitude.toFixed(6),
          gps_lng: pos.coords.longitude.toFixed(6),
          gps_accuracy: Math.round(pos.coords.accuracy).toString(),
        });
        setError('');
      },
      (err) => setError('تعذر تحديد الموقع: ' + (err.message || 'خطأ غير معروف')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoCapture = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('الملف المحدد ليس صورة');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const source = typeof reader.result === 'string' ? reader.result : null;
      if (!source) {
        setError('تعذر قراءة صورة العداد');
        return;
      }

      const image = new Image();
      image.onload = () => {
        const maxDimension = 1280;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('تعذر تجهيز صورة العداد');
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        setPhotoData(compressed);
        setOcrProcessing(true);
        setManualException(false);
        setOcrConfidence(null);
        setError('');
        void extractMeterReading(compressed)
          .then((result) => {
            setForm((prev) => ({
              ...prev,
              reading_value: result.readingValue.toString(),
              reading_method: 'photo',
              ai_extracted_value: result.readingValue.toString(),
              ai_confidence: result.confidence.toString(),
            }));
            setOcrConfidence(result.confidence);
          })
          .catch((err) => {
            setForm((prev) => ({ ...prev, reading_value: '', ai_extracted_value: '', ai_confidence: '' }));
            setError(err instanceof Error ? 'تعذر استخراج القراءة آلياً. فعّل الاستثناء اليدوي فقط بعد التحقق من العداد.' : 'تعذر استخراج القراءة آلياً.');
          })
          .finally(() => setOcrProcessing(false));
      };
      image.onerror = () => setError('تعذر معالجة صورة العداد');
      image.src = source;
    };
    reader.onerror = () => setError('تعذر قراءة صورة العداد');
    reader.readAsDataURL(file);
  };

  const handleSaveReading = async () => {
    if (!selectedMeter || !currentProject) return;
    setError('');

    if (!photoData) {
      setError('يجب تصوير العداد قبل تسجيل القراءة');
      return;
    }
    if (ocrProcessing) {
      setError('جارٍ استخراج القراءة من الصورة، انتظر لحظة');
      return;
    }
    const value = parseFloat(form.reading_value);
    const deferredOfflineOcr = !online && !manualException && !form.reading_value;
    if ((!deferredOfflineOcr && (!Number.isFinite(value) || value < 0)) || (manualException && (!Number.isFinite(value) || value < 0))) {
      setError('الرجاء إدخال قراءة صحيحة');
      return;
    }
    if (manualException && !form.notes.trim()) {
      setError('الاستثناء اليدوي يتطلب سبباً موثقاً في الملاحظات');
      return;
    }

    setSaving(true);
    const capture = {
      client_capture_id: crypto.randomUUID(),
      meter_id: selectedMeter.id,
      project_id: currentProject.id,
      reading_value: Number.isFinite(value) ? value : 0,
      reading_date: new Date().toISOString(),
      reading_method: manualException ? 'manual_exception' : 'photo',
      image_url: photoData,
      gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
      gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : null,
      gps_accuracy: form.gps_accuracy ? parseFloat(form.gps_accuracy) : null,
      ai_extracted_value: manualException || deferredOfflineOcr ? null : value,
      ai_confidence: manualException || deferredOfflineOcr ? null : ocrConfidence,
      ai_model: manualException || deferredOfflineOcr ? null : 'tesseract-js-7',
      expected_meter_number: selectedMeter.meter_number,
      ai_detected_meter_number: manualException || deferredOfflineOcr ? null : selectedMeter.meter_number,
      notes: form.notes || null,
      ocr_pending: deferredOfflineOcr,
    };

    try {
      if (!online) {
        await queueMRXCapture(capture);
        setError('تم الحفظ محلياً وسيتم رفع القراءة تلقائياً عند عودة الاتصال.');
        setSaving(false);
        setShowReadingModal(false);
        setSelectedMeter(null);
        return;
      }

      try {
        await syncMRXCapture(capture);
        setFailedCaptures((await listFailedMRXCaptures()).length);
      } catch (syncError) {
        const syncMessage = syncError instanceof Error ? syncError.message : 'تعذر الإرسال الآن.';
        if (!isPermanentMRXError(syncMessage)) await queueMRXCapture(capture);
        setFailedCaptures((await listFailedMRXCaptures()).length);
        throw new Error(
          syncError instanceof Error
            ? (isPermanentMRXError(syncMessage)
              ? `تعذر اعتماد القراءة: ${syncMessage}`
              : `تعذر الإرسال الآن؛ حُفظت القراءة محلياً للمزامنة التلقائية: ${syncMessage}`)
            : 'تعذر الإرسال الآن؛ حُفظت القراءة محلياً للمزامنة التلقائية.'
        );
      }

      const { data: refreshed } = await supabase
        .from('meter_readings')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('reading_date', { ascending: false })
        .limit(20);

      if (refreshed) setReadings(refreshed as MeterReading[]);
      setShowReadingModal(false);
      setSelectedMeter(null);
      setPhotoData(null);
      setOcrConfidence(null);
      setManualException(false);
      setForm({ reading_value: '', reading_method: 'photo', gps_lat: '', gps_lng: '', gps_accuracy: '', reader_name: '', notes: '', ai_extracted_value: '', ai_confidence: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ القراءة');
    } finally {
      setSaving(false);
    }
  };

  const openReadingModal = (meter: Meter & { customers?: Customer }) => {
    setSelectedMeter(meter);
    setForm({ reading_value: '', reading_method: 'photo', gps_lat: '', gps_lng: '', gps_accuracy: '', reader_name: '', notes: '', ai_extracted_value: '', ai_confidence: '' });
    setPhotoData(null);
    setOcrConfidence(null);
    setManualException(false);
    setError('');
    setShowReadingModal(true);
    window.setTimeout(() => getLocation(), 0);
  };

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;
  if (loading) return <LoadingSpinner label="جاري تحميل العدادات والقراءات..." />;
  if (pageError) return <ErrorState message={pageError} onRetry={() => window.location.reload()} />;

  const consumption = form.reading_value && selectedMeter
    ? Math.max(parseFloat(form.reading_value) - selectedMeter.last_reading, 0)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">قراءة العدادات</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${online ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
          {online ? <><Cloud size={16} /> متصل</> : <><CloudOff size={16} /> غير متصل - وضع عدم الاتصال</>}
        </div>
      </div>

      {/* Stats */}
      {failedCaptures > 0 && (
        <div className="bg-error-50 border border-error-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-error-600" />
          <p className="text-sm text-error-700">يوجد {formatNumber(failedCaptures)} قراءة مرفوضة تحتاج معالجة يدوية.</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي القراءات" value={formatNumber(stats.total)} icon={Gauge} color="primary" />
        <StatCard title="بانتظار المراجعة" value={formatNumber(stats.pending)} icon={Clock} color="warning" />
        <StatCard title="قراءات شاذة" value={formatNumber(stats.anomalies)} icon={AlertTriangle} color={stats.anomalies > 0 ? 'error' : 'neutral'} />
        <StatCard title="متزامنة" value={formatNumber(stats.synced)} icon={CheckCircle} color="success" />
      </div>

      {/* Meters to read */}
      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">العدادات بانتظار القراءة</h2>
        {meters.length === 0 ? (
          <div className="card"><EmptyState icon={Gauge} title="لا توجد عدادات نشطة" description="أضف عدادات أولاً من صفحة المشتركين" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meters.map((m) => (
              <div key={m.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700"><Gauge size={20} /></div>
                  <Badge status={m.status} label="نشط" />
                </div>
                <h3 className="font-bold text-neutral-900">{m.meter_number}</h3>
                <p className="text-sm text-neutral-500 mt-0.5">{m.customers?.name_ar || 'بدون مشترك'}</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div><p className="text-xs text-neutral-400">القراءة السابقة</p><p className="font-semibold text-neutral-700">{formatNumber(m.last_reading)}</p></div>
                  <div><p className="text-xs text-neutral-400">تاريخها</p><p className="font-semibold text-neutral-700 text-xs">{m.last_reading_date ? formatRelativeTime(m.last_reading_date) : '—'}</p></div>
                </div>
                <button onClick={() => openReadingModal(m)} className="btn-primary w-full mt-4 text-sm">
                  <Camera size={16} /> تسجيل قراءة
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent readings history */}
      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">سجل القراءات الأخيرة</h2>
        {readings.length === 0 ? (
          <div className="card"><EmptyState icon={Clock} title="لا توجد قراءات مسجلة بعد" /></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium">القيمة</th>
                  <th className="px-4 py-3 font-medium">السابقة</th>
                  <th className="px-4 py-3 font-medium">الاستهلاك</th>
                  <th className="px-4 py-3 font-medium">الطريقة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">المزامنة</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {readings.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50 transition-smooth">
                    <td className="px-4 py-3 font-medium text-neutral-800">{formatNumber(r.reading_value)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(r.previous_reading)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${r.anomaly_flag ? 'text-error-600' : 'text-neutral-700'}`}>{formatNumber(r.consumption)} م³</span>
                      {r.anomaly_flag && <AlertTriangle size={13} className="inline mr-1 text-error-500" />}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {r.reading_method === 'manual' ? 'يدوي' : r.reading_method === 'ai_vision' ? 'ذكاء اصطناعي' : r.reading_method}
                    </td>
                    <td className="px-4 py-3"><Badge status={r.status} label={readingStatusLabels[r.status] || r.status} /></td>
                    <td className="px-4 py-3"><Badge status={r.sync_status} label={syncStatusLabels[r.sync_status] || r.sync_status} /></td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{formatRelativeTime(r.reading_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reading Modal */}
      <Modal open={showReadingModal} onClose={() => setShowReadingModal(false)} title={`تسجيل قراءة - ${selectedMeter?.meter_number || ''}`} size="lg">
        {selectedMeter && (
          <div className="space-y-5">
            {/* Meter info */}
            <div className="bg-neutral-50 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary-100 text-primary-700"><Gauge size={22} /></div>
              <div className="flex-1">
                <p className="font-bold text-neutral-800">{selectedMeter.meter_number}</p>
                <p className="text-sm text-neutral-500">{selectedMeter.customers?.name_ar}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-neutral-400">القراءة السابقة</p>
                <p className="text-xl font-bold text-primary-700">{formatNumber(selectedMeter.last_reading)}</p>
              </div>
            </div>

            {/* Meter photo capture */}
            <div className="border-2 border-dashed border-primary-200 rounded-xl p-4 bg-primary-50/30">
              <div className="flex items-center gap-2 mb-2">
                <Camera size={18} className="text-primary-600" />
                <h4 className="font-bold text-neutral-800">صورة العداد</h4>
              </div>
              <p className="text-xs text-neutral-500 mb-3">
                التقط صورة العداد واحفظها مع القراءة. استخراج القراءة آلياً عبر الرؤية الحاسوبية سيُربط في طبقة MRX لاحقاً؛ لا توجد محاكاة للذكاء الاصطناعي في مسار الإنتاج.
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="input-field"
                onChange={(e) => handlePhotoCapture(e.target.files?.[0])}
              />
              {photoData && (
                <img src={photoData} alt="صورة العداد" className="mt-3 max-h-48 w-full object-contain rounded-lg bg-white border" />
              )}
            </div>

            {/* Manual reading input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">القراءة المستخرجة *</label>
                <input type="number" min="0" step="0.01" readOnly={!manualException} className="input-field text-lg font-semibold" value={form.reading_value} onChange={(e) => setForm({ ...form, reading_value: e.target.value })} placeholder={ocrProcessing ? 'جارٍ الاستخراج...' : selectedMeter.last_reading.toString()} />
                {ocrConfidence !== null && !manualException && <p className="text-xs text-success-700 mt-1">ثقة OCR: {formatNumber(ocrConfidence)}%</p>}
                {manualException && <p className="text-xs text-warning-700 mt-1">استثناء يدوي: أدخل القراءة بعد التحقق البصري، واكتب السبب.</p>}
              </div>
              <div>
                <label className="label-field">طريقة القراءة</label>
                <select className="input-field" value={form.reading_method} onChange={(e) => { const v = e.target.value; setManualException(v === 'manual_exception'); setForm({ ...form, reading_method: v }); }}>
                  <option value="photo">صورة + OCR</option>
                  <option value="manual_exception">استثناء يدوي</option>
                </select>
              </div>
            </div>

            {/* Consumption preview */}
            {form.reading_value && (
              <div className={`rounded-lg p-3 ${consumption > 50 ? 'bg-error-50 border border-error-200' : 'bg-success-50 border border-success-200'}`}>
                <div className="flex items-center gap-2">
                  {consumption > 50 ? <AlertTriangle size={18} className="text-error-600" /> : <CheckCircle size={18} className="text-success-600" />}
                  <span className="text-sm font-medium text-neutral-700">
                    الاستهلاك المحسوب: <span className="font-bold">{formatNumber(consumption)} م³</span>
                    {consumption > 50 && <span className="text-error-600 mr-2">— استهلاك مرتفع، سيتم وضع علامة شاذة</span>}
                  </span>
                </div>
              </div>
            )}

            {/* GPS */}
            <div>
              <label className="label-field">الموقع الجغرافي (GPS)</label>
              <div className="flex gap-2">
                <input className="input-field flex-1" value={form.gps_lat} readOnly placeholder="خط العرض" />
                <input className="input-field flex-1" value={form.gps_lng} readOnly placeholder="خط الطول" />
                <button onClick={getLocation} className="btn-secondary shrink-0">
                  <MapPin size={16} /> تحديث الموقع
                </button>
              </div>
              {form.gps_accuracy && <p className="text-xs text-neutral-400 mt-1">الدقة: ±{form.gps_accuracy} متر</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">المستخدم المنفذ</label>
                <input className="input-field bg-neutral-50" value="المستخدم الحالي" readOnly />
              </div>
              <div>
                <label className="label-field">ملاحظات</label>
                <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="مثال: استبدال العداد، تجاوز الصفر..." />
              </div>
            </div>

            {error && (
              <div className="bg-error-50 border border-error-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={18} className="text-error-600 shrink-0 mt-0.5" />
                <p className="text-sm text-error-700">{error}</p>
              </div>
            )}

            {!online && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center gap-2">
                <CloudOff size={18} className="text-warning-600" />
                <p className="text-sm text-warning-700">لا يوجد اتصال. سيتم حفظ القراءة محلياً ومزامنتها عند توفر الاتصال.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowReadingModal(false)} className="btn-secondary flex-1">إلغاء</button>
              <button onClick={handleSaveReading} disabled={saving || ocrProcessing || !photoData || (online && !form.reading_value) || (manualException && !form.reading_value)} className="btn-primary flex-1">
                {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><Save size={16} /> حفظ القراءة</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
