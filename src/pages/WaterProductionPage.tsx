import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Clock3, Droplets, Gauge, Play, Square, Loader2, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { MeterCamera } from '@/components/MeterCamera';
import { Modal } from '@/components/ui/Modal';
import { formatNumber } from '@/lib/utils';
import type { Pump, Well } from '@/types';

type ProductionMeter = {
  id: string;
  project_id: string;
  well_id: string;
  pump_id: string;
  meter_number: string;
  serial_number: string | null;
  unit: string;
  status: string;
  initial_reading: number;
};

type ProductionCycle = {
  id: string;
  pump_id: string;
  production_meter_id: string;
  started_at: string;
  stopped_at: string | null;
  production_m3: number | null;
  status: string;
};

type Photo = { file: File; previewUrl: string };

export function WaterProductionPage() {
  const { currentProject } = useProject();
  const { profile } = useAuth();
  const [meters, setMeters] = useState<ProductionMeter[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [wells, setWells] = useState<Well[]>([]);
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [reading, setReading] = useState('');
  const [phase, setPhase] = useState<'start' | 'stop'>('start');
  const [activeCycle, setActiveCycle] = useState<ProductionCycle | null>(null);
  const [saving, setSaving] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [meterForm, setMeterForm] = useState({ well_id: '', pump_id: '', meter_number: '', serial_number: '', initial_reading: '' });

  const isProjectManager = profile?.role === 'project_manager';
  const selectedMeter = meters.find((m) => m.id === selectedMeterId) ?? null;
  const selectedPump = selectedMeter ? pumps.find((p) => p.id === selectedMeter.pump_id) : null;
  const selectedWell = selectedMeter ? wells.find((w) => w.id === selectedMeter.well_id) : null;

  const load = async () => {
    if (!currentProject) return;
    setError(null);
    const pid = currentProject.id;
    const [m, p, w, c] = await Promise.all([
      supabase.from('water_production_meters').select('*').eq('project_id', pid).eq('status', 'active').order('meter_number'),
      supabase.from('pumps').select('*').eq('project_id', pid).order('code'),
      supabase.from('wells').select('*').eq('project_id', pid).order('code'),
      supabase.from('pump_operation_cycles').select('*').eq('project_id', pid).order('started_at', { ascending: false }).limit(30),
    ]);
    const firstError = m.error || p.error || w.error || c.error;
    if (firstError) throw firstError;
    setMeters((m.data ?? []) as ProductionMeter[]);
    setPumps((p.data ?? []) as Pump[]);
    setWells((w.data ?? []) as Well[]);
    const rows = (c.data ?? []) as ProductionCycle[];
    setCycles(rows);
    const running = rows.find((row) => row.status === 'running') ?? null;
    setActiveCycle(running);
    if (!selectedMeterId && m.data?.[0]) setSelectedMeterId(m.data[0].id);
  };

  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : 'تعذر تحميل إنتاج المياه.')); }, [currentProject]);

  useEffect(() => {
    if (activeCycle) {
      setSelectedMeterId(activeCycle.production_meter_id);
      setPhase('stop');
    } else {
      setPhase('start');
    }
  }, [activeCycle]);

  const openStart = () => {
    if (!selectedMeter) return;
    setPhase('start');
    setReading('');
    setPhoto(null);
    setError(null);
  };

  const openStop = (cycle: ProductionCycle) => {
    setActiveCycle(cycle);
    setSelectedMeterId(cycle.production_meter_id);
    setPhase('stop');
    setReading('');
    setPhoto(null);
    setError(null);
  };

  const capture = async (file: File, previewUrl: string) => {
    setPhoto({ file, previewUrl });
    setReading('');
    setError(null);
    setOcrProcessing(true);
    try {
      const { recognizeMeterImage } = await import('@/lib/meter-ocr');
      const result = await recognizeMeterImage(file, {
        knownMeterNumber: selectedMeter?.serial_number || selectedMeter?.meter_number,
        previousReading: phase === 'stop' && activeCycle ? undefined : selectedMeter?.initial_reading,
      });
      if (result.readingValue == null || result.readingAmbiguous) {
        throw new Error('تعذر استخراج قراءة موثوقة من الصورة. أعد التصوير مع ظهور أرقام العداد كاملة.');
      }
      setReading(String(result.readingValue));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحليل صورة عداد الإنتاج.');
    } finally {
      setOcrProcessing(false);
    }
  };

  const uploadEvidence = async () => {
    if (!currentProject || !selectedMeter || !photo) throw new Error('صورة العداد مطلوبة.');
    const id = crypto.randomUUID();
    const extension = photo.file.type.includes('png') ? 'png' : photo.file.type.includes('webp') ? 'webp' : 'jpg';
    const path = `${currentProject.id}/production/${selectedMeter.id}/${id}.${extension}`;
    const result = await supabase.storage.from('meter-readings').upload(path, photo.file, {
      contentType: photo.file.type || 'image/jpeg',
      upsert: false,
    });
    if (result.error) throw new Error(`تعذر حفظ صورة عداد الإنتاج: ${result.error.message}`);
    return path;
  };

  const submit = async () => {
    if (!currentProject || !selectedMeter) return;
    const value = Number(reading);
    if (!Number.isFinite(value) || value < 0) {
      setError('قراءة عداد الإنتاج غير صحيحة.');
      return;
    }
    if (!photo) {
      setError('تصوير عداد الإنتاج مطلوب عند بداية التشغيل ونهايته.');
      return;
    }
    setSaving(true);
    setError(null);
    let imagePath: string | null = null;
    try {
      imagePath = await uploadEvidence();
      const gps = await new Promise<{ lat: number | null; lng: number | null; accuracy: number | null }>((resolve) => {
        if (!navigator.geolocation) return resolve({ lat: null, lng: null, accuracy: null });
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve({ lat: null, lng: null, accuracy: null }),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
      });
      const { data: readingId, error: captureError } = await supabase.rpc('mizan_capture_water_production_reading', {
        p_production_meter_id: selectedMeter.id,
        p_reading_value: value,
        p_captured_at: new Date().toISOString(),
        p_capture_phase: phase,
        p_image_url: imagePath,
        p_gps_lat: gps.lat,
        p_gps_lng: gps.lng,
        p_gps_accuracy: gps.accuracy,
        p_notes: null,
      });
      if (captureError) throw captureError;

      if (phase === 'start') {
        const { error: startError } = await supabase.rpc('mizan_start_pump_operation_cycle', {
          p_production_meter_id: selectedMeter.id,
          p_reading_id: readingId,
          p_started_at: new Date().toISOString(),
          p_notes: null,
        });
        if (startError) throw startError;
      } else {
        if (!activeCycle) throw new Error('لا توجد دورة تشغيل مفتوحة لهذه المضخة.');
        const { error: stopError } = await supabase.rpc('mizan_stop_pump_operation_cycle', {
          p_cycle_id: activeCycle.id,
          p_reading_id: readingId,
          p_stopped_at: new Date().toISOString(),
          p_notes: null,
        });
        if (stopError) throw stopError;
      }

      setPhoto(null);
      setReading('');
      await load();
    } catch (e) {
      if (imagePath) await supabase.storage.from('meter-readings').remove([imagePath]);
      setError(e instanceof Error ? e.message : 'تعذر حفظ دورة إنتاج المياه.');
    } finally {
      setSaving(false);
    }
  };

  const registerMeter = async () => {
    if (!currentProject) return;
    if (!meterForm.well_id || !meterForm.pump_id || !meterForm.meter_number.trim()) {
      setError('البئر والمضخة ورقم عداد الإنتاج مطلوبة.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('mizan_register_water_production_meter', {
        p_project_id: currentProject.id,
        p_well_id: meterForm.well_id,
        p_pump_id: meterForm.pump_id,
        p_meter_number: meterForm.meter_number.trim(),
        p_serial_number: meterForm.serial_number.trim() || null,
        p_initial_reading: Number(meterForm.initial_reading || 0),
        p_installed_at: null,
        p_notes: null,
      });
      if (rpcError) throw rpcError;
      setShowMeterForm(false);
      setMeterForm({ well_id: '', pump_id: '', meter_number: '', serial_number: '', initial_reading: '' });
      await load();
      setSelectedMeterId(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل عداد الإنتاج.');
    } finally {
      setSaving(false);
    }
  };

  const cycleDuration = useMemo(() => {
    if (!activeCycle) return null;
    const minutes = Math.max(0, Math.round((Date.now() - new Date(activeCycle.started_at).getTime()) / 60000));
    return `${Math.floor(minutes / 60)}س ${minutes % 60}د`;
  }, [activeCycle]);

  if (!currentProject) return <div className="text-center py-20 text-neutral-400">اختر مشروعاً للبدء</div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">إنتاج المياه وتشغيل المضخات</h1>
          <p className="text-sm text-neutral-500 mt-1">{currentProject.name_ar} · توثيق الإنتاج من عداد المضخة</p>
        </div>
        {isProjectManager && (
          <button className="btn-secondary flex items-center gap-2" onClick={() => setShowMeterForm(true)}>
            <Plus size={16} /> تسجيل عداد إنتاج
          </button>
        )}
      </div>

      {error && <div className="rounded-xl bg-error-50 text-error-700 px-4 py-3 text-sm flex gap-2"><AlertTriangle size={18} />{error}</div>}

      {meters.length === 0 ? (
        <div className="card p-6 text-center">
          <Gauge className="mx-auto text-neutral-400 mb-3" size={32} />
          <h2 className="font-bold text-neutral-900">لا يوجد عداد إنتاج مسجل</h2>
          <p className="text-sm text-neutral-500 mt-1">يجب على مدير المشروع تسجيل عداد الإنتاج وربطه بالبئر والمضخة قبل بدء التوثيق الميداني.</p>
        </div>
      ) : (
        <>
          <section className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-field">عداد الإنتاج</label>
                <select className="input-field" value={selectedMeterId} onChange={(e) => setSelectedMeterId(e.target.value)} disabled={!!activeCycle}>
                  {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}{m.serial_number ? ` · ${m.serial_number}` : ''}</option>)}
                </select>
              </div>
              <div><label className="label-field">البئر</label><div className="input-field bg-neutral-50">{selectedWell?.code || '—'}</div></div>
              <div><label className="label-field">المضخة</label><div className="input-field bg-neutral-50">{selectedPump?.code || '—'}</div></div>
            </div>
          </section>

          {activeCycle ? (
            <section className="card p-5 border-2 border-warning-200">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div>
                  <div className="flex items-center gap-2"><Clock3 size={18} className="text-warning-700" /><h2 className="font-bold">المضخة في دورة تشغيل</h2></div>
                  <p className="text-sm text-neutral-500 mt-1">بدأت {new Date(activeCycle.started_at).toLocaleString('ar-YE')}</p>
                </div>
                <span className="text-sm font-semibold text-warning-700">{cycleDuration}</span>
              </div>
              <div className="rounded-xl bg-warning-50 p-4 mb-5 text-sm text-warning-900">صوّر عداد الإنتاج الآن عند إيقاف المضخة. سيحسب النظام إنتاج هذه الدورة من فرق القراءتين.</div>
              <MeterCamera initialPreview={photo?.previewUrl} disabled={saving} onCapture={capture} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div><label className="label-field">قراءة الإيقاف</label><input className="input-field text-lg font-bold" value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" /></div>
                <div><label className="label-field">الحالة</label><div className="input-field bg-neutral-50">{ocrProcessing ? 'جارٍ استخراج القراءة...' : reading ? 'القراءة جاهزة للحفظ' : 'التقط صورة أولاً'}</div></div>
              </div>
              <button className="btn-primary w-full mt-4" disabled={saving || ocrProcessing || !photo || !reading} onClick={() => void submit()}>
                {saving ? <><Loader2 size={17} className="animate-spin" /> جارٍ حفظ الإيقاف...</> : <><Square size={17} /> تسجيل إيقاف المضخة وحساب الإنتاج</>}
              </button>
            </section>
          ) : (
            <section className="card p-5">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div><h2 className="font-bold">بدء دورة تشغيل</h2><p className="text-sm text-neutral-500 mt-1">صورة + قراءة عداد الإنتاج عند تشغيل المضخة.</p></div>
                <Play size={22} className="text-primary-700" />
              </div>
              <MeterCamera initialPreview={photo?.previewUrl} disabled={saving} onCapture={capture} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div><label className="label-field">قراءة البداية</label><input className="input-field text-lg font-bold" value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" /></div>
                <div><label className="label-field">الحالة</label><div className="input-field bg-neutral-50">{ocrProcessing ? 'جارٍ استخراج القراءة...' : reading ? 'القراءة جاهزة للحفظ' : 'التقط صورة أولاً'}</div></div>
              </div>
              <button className="btn-primary w-full mt-4" disabled={saving || ocrProcessing || !photo || !reading} onClick={() => void submit()}>
                {saving ? <><Loader2 size={17} className="animate-spin" /> جارٍ حفظ البداية...</> : <><Play size={17} /> بدء دورة التشغيل</>}
              </button>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="p-5 border-b"><h2 className="font-bold">آخر دورات التشغيل</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-50 text-xs text-neutral-400"><tr><th className="px-4 py-3 text-right">البداية</th><th className="px-4 py-3 text-right">النهاية</th><th className="px-4 py-3 text-right">الإنتاج</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">
              {cycles.map((c) => <tr key={c.id}><td className="px-4 py-3">{new Date(c.started_at).toLocaleString('ar-YE')}</td><td className="px-4 py-3">{c.stopped_at ? new Date(c.stopped_at).toLocaleString('ar-YE') : '—'}</td><td className="px-4 py-3 font-semibold">{c.production_m3 != null ? `${formatNumber(c.production_m3)} م³` : '—'}</td><td className="px-4 py-3">{c.status === 'completed' ? <span className="text-success-700 flex items-center gap-1"><CheckCircle2 size={15}/> مكتملة</span> : 'قيد التشغيل'}</td><td className="px-4 py-3">{c.status === 'running' && <button className="btn-secondary text-xs" onClick={() => openStop(c)}>إيقاف</button>}</td></tr>)}
            </tbody></table></div>
          </section>
        </>
      )}

      <Modal open={showMeterForm} onClose={() => setShowMeterForm(false)} title="تسجيل عداد إنتاج المضخة">
        <div className="space-y-4">
          <div><label className="label-field">البئر *</label><select className="input-field" value={meterForm.well_id} onChange={(e) => setMeterForm((f) => ({ ...f, well_id: e.target.value, pump_id: '' }))}><option value="">اختر البئر</option>{wells.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name_ar || ''}</option>)}</select></div>
          <div><label className="label-field">المضخة *</label><select className="input-field" value={meterForm.pump_id} onChange={(e) => setMeterForm((f) => ({ ...f, pump_id: e.target.value }))}><option value="">اختر المضخة</option>{pumps.filter((p) => p.well_id === meterForm.well_id).map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></div>
          <div><label className="label-field">رقم عداد الإنتاج *</label><input className="input-field" value={meterForm.meter_number} onChange={(e) => setMeterForm((f) => ({ ...f, meter_number: e.target.value }))} /></div>
          <div><label className="label-field">الرقم التسلسلي</label><input className="input-field" value={meterForm.serial_number} onChange={(e) => setMeterForm((f) => ({ ...f, serial_number: e.target.value }))} /></div>
          <div><label className="label-field">القراءة الابتدائية *</label><input className="input-field" value={meterForm.initial_reading} onChange={(e) => setMeterForm((f) => ({ ...f, initial_reading: e.target.value }))} inputMode="decimal" /></div>
          <button className="btn-primary w-full" disabled={saving} onClick={() => void registerMeter()}>{saving ? 'جارٍ الحفظ...' : 'حفظ عداد الإنتاج'}</button>
        </div>
      </Modal>
    </div>
  );
}
