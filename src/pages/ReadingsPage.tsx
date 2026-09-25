import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import {
  formatNumber, formatDateTime, formatRelativeTime,
  readingStatusLabels, syncStatusLabels, statusColor,
} from '@/lib/utils';
import {
  Gauge, Camera, MapPin, Bot, Save, AlertTriangle,
  CheckCircle, Cloud, CloudOff, Clock, Loader2,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '@/lib/hooks';
import type { Meter, MeterReading, Customer } from '@/types';
import { MeterCamera } from '@/components/MeterCamera';
import { recognizeMeterImage } from '@/lib/meter-ocr';
import { toast } from 'sonner';
import { addPendingReading, startMeterReadingSync } from '@/lib/mirrorSync';

export function ReadingsPage() {
  const { currentProject } = useProject();
  const [meters, setMeters] = useState<(Meter & { customers?: Customer })[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<(Meter & { customers?: Customer }) | null>(null);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiSimulating, setAiSimulating] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [form, setForm] = useState({
    reading_value: '', reading_method: 'manual',
    gps_lat: '', gps_lng: '', gps_accuracy: '',
    reader_name: '', notes: '',
    ai_extracted_value: '', ai_confidence: '',
  });
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => startMeterReadingSync(), []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
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

  const simulateAI = () => {
    if (!selectedMeter) return;
    setAiSimulating(true);
    setError('');
    setTimeout(() => {
      const prev = selectedMeter.last_reading;
      const consumption = Math.floor(Math.random() * 20) + 5;
      const extracted = prev + consumption;
      const confidence = Math.floor(Math.random() * 30) + 70;
      setForm({
        ...form,
        ai_extracted_value: extracted.toString(),
        ai_confidence: confidence.toString(),
        reading_value: extracted.toString(),
        reading_method: 'ai_vision',
      });
      setAiSimulating(false);
    }, 1500);
  };

  const handleSaveReading = async () => {
    if (!selectedMeter || !currentProject) return;
    setError('');

    const value = Number(form.reading_value);
    if (!Number.isFinite(value) || value < 0) {
      setError('الرجاء إدخال قراءة صحيحة غير سالبة');
      return;
    }

    if (!online) {
      try {
        await addPendingReading({
          customerId: selectedMeter.customer_id,
          meterId: selectedMeter.id,
          meterNumber: selectedMeter.meter_number,
          projectId: currentProject.id,
          current: value,
          readingDate: new Date().toISOString(),
          latitude: form.gps_lat ? Number(form.gps_lat) : null,
          longitude: form.gps_lng ? Number(form.gps_lng) : null,
          accuracy: form.gps_accuracy ? Number(form.gps_accuracy) : null,
          readingSource: form.reading_method === 'photo' ? 'OCR' : 'MANUAL',
          aiExtractedValue: form.ai_extracted_value ? Number(form.ai_extracted_value) : null,
          aiConfidence: form.ai_confidence ? Number(form.ai_confidence) : null,
          aiModel: form.reading_method === 'photo' ? 'local-ocr-v1' : null,
          notes: form.notes || null,
        }, capturedPhoto?.file ?? null);
        setError('تم حفظ القراءة والصورة في الجهاز. ستتم المزامنة والتحقق تلقائياً عند عودة الاتصال.');
        setShowReadingModal(false);
        setSelectedMeter(null);
        setCapturedPhoto(null);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر حفظ القراءة محلياً');
        return;
      }
    }

    if (form.reading_method === 'photo' && !capturedPhoto) {
      setError('يجب تصوير العداد قبل اعتماد قراءة الصورة');
      return;
    }

    setSaving(true);
    try {
      const clientCaptureId = crypto.randomUUID();
      let imagePath: string | null = null;

      if (capturedPhoto) {
        const extension = capturedPhoto.file.type.includes('png') ? 'png' : capturedPhoto.file.type.includes('webp') ? 'webp' : 'jpg';
        imagePath = `${currentProject.id}/${selectedMeter.id}/${clientCaptureId}.${extension}`;
        const upload = await supabase.storage.from('meter-readings').upload(imagePath, capturedPhoto.file, {
          contentType: capturedPhoto.file.type || 'image/jpeg',
          upsert: false,
        });
        if (upload.error) throw new Error(`تعذر حفظ صورة العداد: ${upload.error.message}`);
      }

      const { data: reading, error: captureError } = await supabase.rpc('mrx_capture_meter_reading', {
        p_meter_id: selectedMeter.id,
        p_reading_value: value,
        p_reading_date: new Date().toISOString(),
        p_reading_method: form.reading_method === 'photo' ? 'photo' : 'manual',
        p_image_url: imagePath,
        p_gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
        p_gps_lng: form.gps_lng ? Number(form.gps_lng) : null,
        p_gps_accuracy: form.gps_accuracy ? Number(form.gps_accuracy) : null,
        p_ai_extracted_value: form.ai_extracted_value ? Number(form.ai_extracted_value) : null,
        p_ai_confidence: form.ai_confidence ? Number(form.ai_confidence) : null,
        p_ai_model: form.reading_method === 'photo' ? 'local-ocr-v1' : null,
        p_notes: form.notes || null,
        p_client_capture_id: clientCaptureId,
        p_detected_meter_number: selectedMeter.meter_number,
      });

      if (captureError) {
        if (imagePath) await supabase.storage.from('meter-readings').remove([imagePath]);
        throw new Error(captureError.message);
      }

      const approvedReading = reading as MeterReading;
      const periodEnd = new Date();
      const periodStart = selectedMeter.last_reading_date
        ? new Date(selectedMeter.last_reading_date)
        : new Date(periodEnd.getTime() - 30 * 86400000);

      const { error: invoiceError } = await supabase.rpc('mizan_create_invoice', {
        p_project_id: currentProject.id,
        p_customer_id: selectedMeter.customer_id,
        p_meter_id: selectedMeter.id,
        p_current_reading: value,
        p_period_start: periodStart.toISOString().slice(0, 10),
        p_period_end: periodEnd.toISOString().slice(0, 10),
      });

      if (invoiceError) {
        toast.error(`تم اعتماد القراءة، لكن تعذر إنشاء الفاتورة تلقائياً: ${invoiceError.message}`);
      } else {
        toast.success('تم اعتماد القراءة وإنشاء الفاتورة بنجاح');
      }

      setReadings([approvedReading, ...readings]);
      setMeters((current) => current.map((meter) =>
        meter.id === selectedMeter.id
          ? { ...meter, last_reading: value, last_reading_date: periodEnd.toISOString() }
          : meter
      ));
      setShowReadingModal(false);
      setSelectedMeter(null);
      setCapturedPhoto(null);
      setForm({
        reading_value: '', reading_method: 'manual', gps_lat: '', gps_lng: '',
        gps_accuracy: '', reader_name: '', notes: '', ai_extracted_value: '', ai_confidence: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر اعتماد القراءة');
    } finally {
      setSaving(false);
    }
  };

  const openReadingModal = (meter: Meter & { customers?: Customer }) => {
    setSelectedMeter(meter);
    setForm({ reading_value: '', reading_method: 'manual', gps_lat: '', gps_lng: '', gps_accuracy: '', reader_name: '', notes: '', ai_extracted_value: '', ai_confidence: '' });
    setError('');
    setShowReadingModal(true);
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

            {/* Mirror Runtime field camera — capture is real; OCR/identity verification remains server-authoritative. */}
            <div className="border rounded-xl p-4 bg-neutral-50/70">
              <div className="flex items-center gap-2 mb-3">
                <Camera size={18} className="text-primary-700" />
                <h4 className="font-bold text-neutral-800">تصوير العداد</h4>
                <span className="text-xs text-neutral-500">التقاط ميداني حقيقي</span>
              </div>
              <MeterCamera
                initialPreview={capturedPhoto?.previewUrl}
                disabled={saving}
                onCapture={async (file, previewUrl) => {
                  setCapturedPhoto({ file, previewUrl });
                  setForm((current) => ({ ...current, reading_method: 'photo' }));
                  setError('');
                  setOcrProcessing(true);
                  try {
                    const result = await recognizeMeterImage(file, {
                      knownMeterNumber: selectedMeter?.meter_number ?? undefined,
                      previousReading: selectedMeter?.last_reading ?? null,
                    });
                    if (result.readingAmbiguous || result.readingValue == null) {
                      throw new Error('تعذر استخراج قراءة واحدة واضحة من الصورة. أعد التصوير مع إظهار شاشة العداد بوضوح.');
                    }
                    setForm((current) => ({
                      ...current,
                      reading_value: String(result.readingValue),
                      ai_extracted_value: String(result.readingValue),
                      ai_confidence: String(result.readingConfidence),
                      reading_method: 'photo',
                    }));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'تعذر تحليل صورة العداد');
                  } finally {
                    setOcrProcessing(false);
                  }
                }}
                onClear={() => setCapturedPhoto(null)}
              />
              {ocrProcessing && <p className="text-xs text-primary-700 mt-2">جاري قراءة أرقام العداد والتحقق من هويته محلياً…</p>}
              {capturedPhoto && (
                <p className="text-xs text-success-700 mt-2">تم التقاط الصورة الأصلية. لن تُعتبر القراءة موثقة آلياً حتى ينجح تحقق هوية العداد واستخراج القراءة على الخادم.</p>
              )}
            </div>

            {/* Manual reading input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">القراءة الجديدة *</label>
                <input type="number" className="input-field text-lg font-semibold" value={form.reading_value} onChange={(e) => setForm({ ...form, reading_value: e.target.value })} placeholder={selectedMeter.last_reading.toString()} />
              </div>
              <div>
                <label className="label-field">طريقة القراءة</label>
                <select className="input-field" value={form.reading_method} onChange={(e) => setForm({ ...form, reading_method: e.target.value })}>
                  <option value="manual">يدوي</option>
                  <option value="ai_vision">ذكاء اصطناعي</option>
                  <option value="photo">صورة</option>
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
                <input className="input-field flex-1" value={form.gps_lat} onChange={(e) => setForm({ ...form, gps_lat: e.target.value })} placeholder="خط العرض" />
                <input className="input-field flex-1" value={form.gps_lng} onChange={(e) => setForm({ ...form, gps_lng: e.target.value })} placeholder="خط الطول" />
                <button onClick={getLocation} className="btn-secondary shrink-0">
                  <MapPin size={16} /> تحديد
                </button>
              </div>
              {form.gps_accuracy && <p className="text-xs text-neutral-400 mt-1">الدقة: ±{form.gps_accuracy} متر</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">اسم القارئ</label>
                <input className="input-field" value={form.reader_name} onChange={(e) => setForm({ ...form, reader_name: e.target.value })} placeholder="قارئ العداد" />
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
              <button onClick={handleSaveReading} disabled={saving || !form.reading_value} className="btn-primary flex-1">
                {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><Save size={16} /> حفظ القراءة</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
