import { supabase } from "@/lib/supabase";
import { idbDelete, idbGet, idbGetAll, idbPut, idbPutQueueWithPhoto, requestPersistentStorage, STORE_BLOBS, STORE_QUEUE } from "./mirrorOfflineDb";

export type QueueStatus = "pending" | "syncing" | "synced" | "failed";

export interface PendingReading {
  clientId: string;
  customerId: string;
  meterId: string;
  meterNumber: string;
  projectId: string;
  current: number;
  readingDate: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  readingSource: "OCR" | "MANUAL";
  aiExtractedValue?: number | null;
  aiConfidence?: number | null;
  aiModel?: string | null;
  notes?: string | null;
  hasPhoto: boolean;
  photoType?: string;
  status: QueueStatus;
  attempts: number;
  createdAt: string;
  lastError?: string;
  lastAttemptAt?: string;
  syncedAt?: string;
}

const EVENT = "mizan-mrx-queue-updated";
let syncing = false;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function validImage(blob: Blob) {
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(blob.type)) throw new Error("صيغة صورة العداد غير مدعومة");
  if (!blob.size || blob.size > 25 * 1024 * 1024) throw new Error("حجم صورة العداد غير صالح");
}

export async function addPendingReading(
  input: Omit<PendingReading, "clientId" | "status" | "attempts" | "createdAt" | "hasPhoto">,
  photo: Blob | null
) {
  if (!input.projectId || !input.meterId || !input.customerId) throw new Error("بيانات العداد أو المشروع غير مكتملة");
  if (photo) validImage(photo);
  await requestPersistentStorage();
  const item: PendingReading = {
    ...input,
    clientId: crypto.randomUUID(),
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    hasPhoto: !!photo,
    photoType: photo?.type,
  };
  if (photo) await idbPutQueueWithPhoto(item, photo);
  else await idbPut(STORE_QUEUE, item);
  notify();
  return item;
}

export async function getPendingReadings() {
  return (await idbGetAll<PendingReading>(STORE_QUEUE)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function uploadEvidence(item: PendingReading, blob: Blob) {
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  const path = `${item.projectId}/${item.meterId}/${item.clientId}.${ext}`;
  const { error } = await supabase.storage.from("meter-readings").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error && !error.message.toLowerCase().includes("already exists")) throw error;
  return path;
}

async function syncOne(item: PendingReading) {
  let imagePath: string | null = null;
  const blob = item.hasPhoto ? await idbGet<Blob>(STORE_BLOBS, item.clientId) : null;
  if (item.readingSource === "OCR" && !blob) throw new Error("صورة القراءة غير موجودة محلياً");
  if (blob) imagePath = await uploadEvidence(item, blob);

  const { error } = await supabase.rpc("mrx_capture_meter_reading", {
    p_meter_id: item.meterId,
    p_reading_value: item.current,
    p_reading_date: item.readingDate,
    p_reading_method: item.readingSource === "OCR" ? "photo" : "manual",
    p_image_url: imagePath,
    p_gps_lat: item.latitude ?? null,
    p_gps_lng: item.longitude ?? null,
    p_gps_accuracy: item.accuracy ?? null,
    p_ai_extracted_value: item.aiExtractedValue ?? null,
    p_ai_confidence: item.aiConfidence ?? null,
    p_ai_model: item.aiModel ?? null,
    p_notes: item.notes ?? null,
    p_client_capture_id: item.clientId,
    p_detected_meter_number: item.meterNumber,
  });
  if (error) throw error;

  const periodEnd = new Date(item.readingDate);
  const periodStart = new Date(periodEnd.getTime() - 30 * 86400000);
  const { error: invoiceError } = await supabase.rpc("mizan_create_invoice", {
    p_project_id: item.projectId,
    p_customer_id: item.customerId,
    p_meter_id: item.meterId,
    p_current_reading: item.current,
    p_period_start: periodStart.toISOString().slice(0, 10),
    p_period_end: periodEnd.toISOString().slice(0, 10),
  });
  if (invoiceError) throw invoiceError;

  await idbDelete(STORE_BLOBS, item.clientId);
}

export async function syncPendingReadings(force = false) {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    for (const item of await getPendingReadings()) {
      if (item.status === "synced") continue;
      if (!force && item.status === "failed" && item.lastAttemptAt) {
        const wait = Math.min(15 * 60_000, 30_000 * 2 ** Math.min(item.attempts, 5));
        if (Date.now() - Date.parse(item.lastAttemptAt) < wait) continue;
      }
      await idbPut(STORE_QUEUE, { ...item, status: "syncing" });
      try {
        await syncOne(item);
        await idbPut(STORE_QUEUE, { ...item, status: "synced", syncedAt: new Date().toISOString(), lastError: undefined });
        synced++;
      } catch (error) {
        await idbPut(STORE_QUEUE, {
          ...item,
          status: "failed",
          attempts: item.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { synced, failed };
}

export function startMeterReadingSync() {
  if (typeof window === "undefined") return () => {};
  const retry = () => { if (navigator.onLine) void syncPendingReadings(true); };
  window.addEventListener("online", retry);
  window.addEventListener("focus", retry);
  const timer = window.setInterval(retry, 60_000);
  retry();
  return () => {
    window.removeEventListener("online", retry);
    window.removeEventListener("focus", retry);
    window.clearInterval(timer);
  };
}

export function subscribeToMeterQueue(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
