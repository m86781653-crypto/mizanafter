import { supabase } from '@/lib/supabase';

export interface MRXCapture {
  client_capture_id: string;
  meter_id: string;
  project_id: string;
  reading_value: number;
  reading_date: string;
  reading_method: string;
  image_url?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  ai_extracted_value?: number | null;
  ai_confidence?: number | null;
  ai_model?: string | null;
  notes?: string | null;
  retry_count?: number;
  status?: 'pending' | 'failed' | 'conflict';
  last_error?: string | null;
  /** Server accepted the capture as structurally valid but rejected it because the meter advanced while this capture was offline. */
  conflict_reason?: 'STALE_READING' | null;
  retry_at?: string | null;
  /** When true, the photo is durably queued and OCR must run before server sync. */
  ocr_pending?: boolean;
  /** Meter identity expected by the master record at capture time; used for offline OCR verification. */
  expected_meter_number?: string | null;
  ai_detected_meter_number?: string | null;
}

export interface MRXOcrResult {
  readingValue: number;
  confidence: number;
  rawText: string;
  detectedMeterNumber: string;
}

let ocrWorkerPromise: Promise<TesseractWorker> | null = null;

function normalizeMeterDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[,٬]/g, '')
    .replace(/[٫]/g, '.');
}

export async function extractMeterReading(imageUrl: string, expectedMeterNumber?: string): Promise<MRXOcrResult> {
  if (!navigator.onLine && !ocrWorkerPromise) throw new Error('OCR_OFFLINE_NOT_READY');
  if (!window.Tesseract) throw new Error('OCR_RUNTIME_UNAVAILABLE');
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = window.Tesseract.createWorker('eng', 1);
    const worker = await ocrWorkerPromise;
    await worker.setParameters({ tessedit_char_whitelist: '0123456789.,٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', tessedit_pageseg_mode: '7' });
  }
  const worker = await ocrWorkerPromise;
  const first = await worker.recognize(imageUrl);
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const second = await worker.recognize(imageUrl);
  const candidates = [first, second].flatMap((r) => {
    const text = normalizeMeterDigits(r.data.text);
    return (text.match(/\d+(?:\.\d+)?/g) || []).map((raw) => ({ raw, confidence: r.data.confidence, text }));
  }).filter((x) => x.raw.length > 0);
  if (!candidates.length) throw new Error('OCR_READING_NOT_DETECTED');
  candidates.sort((a,b) => (b.confidence - a.confidence) || (b.raw.length - a.raw.length));
  const best = candidates[0];
  const readingValue = Number(best.raw);
  if (!Number.isFinite(readingValue)) throw new Error('OCR_READING_INVALID');

  const normalizeIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const expected = normalizeIdentity(expectedMeterNumber ?? '');
  if (!expected) throw new Error('METER_IDENTITY_REQUIRED');

  const identityCandidates = [...new Set(
    [first.data.text, second.data.text]
      .map(normalizeMeterDigits)
      .flatMap((text) => text.match(/[a-zA-Z0-9]+/g) || [])
      .map(normalizeIdentity)
      .filter(Boolean)
  )];
  const detectedMeterNumber = identityCandidates.find((candidate) => candidate === expected);
  if (!detectedMeterNumber) {
    throw new Error('METER_IDENTITY_MISMATCH');
  }

  return { readingValue, confidence: best.confidence, rawText: best.text, detectedMeterNumber };
}

export interface MRXSyncResult {
  capture: MRXCapture;
  reading: unknown;
}

const DB_NAME = 'mizan-mrx';
const STORE = 'captures';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_capture_id' });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteCapture(clientCaptureId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(clientCaptureId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function isMRXConflictError(message: string): boolean {
  return /READING_DECREASE_REQUIRES_EXCEPTION|STALE_READING|CONFLICT/i.test(message);
}

export function isPermanentMRXError(message: string): boolean {
  // Only classify deterministic business/data failures as permanent. Runtime,
  // network, and OCR availability failures must remain retryable.
  return /READING_DECREASE|DUPLICATE|METER_INACTIVE|PROJECT_ACCESS|UNAUTHORIZED|FORBIDDEN|IDENTITY|VALIDATION|CONFIDENCE|OCR_READING_NOT_DETECTED|OCR_READING_INVALID|OCR_IMAGE_MISSING/i.test(message);
}

async function markCaptureRetry(capture: MRXCapture, errorMessage: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      ...capture,
      status: isMRXConflictError(errorMessage) ? 'conflict' : (isPermanentMRXError(errorMessage) ? 'failed' : 'pending'),
      conflict_reason: isMRXConflictError(errorMessage) ? 'STALE_READING' : null,
      last_error: errorMessage,
      retry_at: new Date(Date.now() + 30_000).toISOString(),
      retry_count: Number((capture as MRXCapture & { retry_count?: number }).retry_count ?? 0) + 1,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function queueMRXCapture(capture: MRXCapture): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      ...capture,
      status: 'pending',
      queued_at: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPendingMRXCaptures(): Promise<MRXCapture[]> {
  const db = await openDb();
  const rows = await new Promise<MRXCapture[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly')
      .objectStore(STORE).index('status').getAll('pending');
    request.onsuccess = () => resolve((request.result || []) as MRXCapture[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

async function replaceQueuedMRXCapture(capture: MRXCapture): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(capture);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function syncMRXCapture(capture: MRXCapture): Promise<MRXSyncResult> {
  if (capture.ocr_pending) throw new Error('OCR_PENDING');
  const { data, error } = await supabase.rpc('mrx_capture_meter_reading', {
    p_meter_id: capture.meter_id,
    p_reading_value: capture.reading_value,
    p_reading_date: capture.reading_date,
    p_reading_method: capture.reading_method,
    p_image_url: capture.image_url ?? null,
    p_ai_extracted_value: capture.ai_extracted_value ?? null,
    p_ai_confidence: capture.ai_confidence ?? null,
    p_ai_model: capture.ai_model ?? null,
    p_gps_lat: capture.gps_lat ?? null,
    p_gps_lng: capture.gps_lng ?? null,
    p_gps_accuracy: capture.gps_accuracy ?? null,
    p_notes: capture.notes ?? null,
    p_client_capture_id: capture.client_capture_id,
    p_detected_meter_number: capture.ai_detected_meter_number ?? null,
  });

  if (error) {
    await markCaptureRetry(capture, error.message);
    throw error;
  }

  await deleteCapture(capture.client_capture_id);
  return { capture, reading: data };
}

export async function listConflictMRXCaptures(): Promise<MRXCapture[]> {
  const db = await openDb();
  const rows = await new Promise<MRXCapture[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly')
      .objectStore(STORE).index('status').getAll('conflict');
    request.onsuccess = () => resolve((request.result || []) as MRXCapture[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

export async function retryConflictMRXCapture(clientCaptureId: string): Promise<void> {
  const conflict = (await listConflictMRXCaptures()).find((capture) => capture.client_capture_id === clientCaptureId);
  if (!conflict) throw new Error('CAPTURE_NOT_FOUND');
  await queueMRXCapture({ ...conflict, status: 'pending', last_error: null, conflict_reason: null, retry_at: null });
}

export async function listFailedMRXCaptures(): Promise<MRXCapture[]> {
  const db = await openDb();
  const rows = await new Promise<MRXCapture[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly')
      .objectStore(STORE).index('status').getAll('failed');
    request.onsuccess = () => resolve((request.result || []) as MRXCapture[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

export async function retryFailedMRXCapture(clientCaptureId: string): Promise<void> {
  const failed = (await listFailedMRXCaptures()).find((capture) => capture.client_capture_id === clientCaptureId);
  if (!failed) throw new Error('CAPTURE_NOT_FOUND');
  await queueMRXCapture({ ...failed, status: 'pending', last_error: null, retry_at: null });
}

export async function syncPendingMRXCaptures(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = (await listPendingMRXCaptures()).filter((capture) => {
    if (!capture.retry_at) return true;
    const retryAt = Date.parse(capture.retry_at);
    return !Number.isFinite(retryAt) || retryAt <= Date.now();
  });
  let synced = 0;
  let failed = 0;

  for (const capture of pending) {
    let readyCapture = capture;
    let serverSyncAttempted = false;
    try {
      if (capture.ocr_pending) {
        if (!capture.image_url) throw new Error('OCR_IMAGE_MISSING');
        const ocr = await extractMeterReading(capture.image_url, capture.expected_meter_number ?? undefined);
        readyCapture = { ...capture, reading_value: ocr.readingValue, ai_extracted_value: ocr.readingValue, ai_confidence: ocr.confidence, ai_model: 'tesseract-js-7', ai_detected_meter_number: ocr.detectedMeterNumber, ocr_pending: false, last_error: null, retry_at: null };
        await replaceQueuedMRXCapture(readyCapture);
      }
      serverSyncAttempted = true;
      await syncMRXCapture(readyCapture);
      synced += 1;
    } catch (error) {
      // syncMRXCapture already persists server-side failures. OCR failures
      // occur before that call and must be persisted here exactly once.
      if (!serverSyncAttempted) {
        await markCaptureRetry(readyCapture, error instanceof Error ? error.message : 'MRX_SYNC_FAILED');
      }
      failed += 1;
    }
  }

  return { synced, failed };
}
