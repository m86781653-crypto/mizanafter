/** MIZAN field verification contract. Authoritative persistence is mrx_capture_meter_reading. */
export interface MeterVisionResult { readingValue:number|null; confidence:number; meterNumber:string|null; otherNumbers:string[]; ambiguous:boolean; serialMatch:"match"|"mismatch"|"unknown"; }
export interface MeterPipelineMetrics { imagePreparationMs:number; aiInferenceMs:number; parseMs:number; identityValidationMs:number; totalServerMs:number; }
export interface MeterVerificationResult extends MeterVisionResult { verificationToken:null; metrics:MeterPipelineMetrics; }
export interface VerifiedMeterReadingResult extends MeterVisionResult { saved:boolean; readingId:string|null; evidencePath:string|null; }
function normalizeDigits(v:string){return v.replace(/[٠-٩۰-۹]/g,d=>{const c=d.charCodeAt(0);return c>=0x660&&c<=0x669?String(c-0x660):String(c-0x6f0)})}
export function normalizeMeterIdentity(value:string){return normalizeDigits(value).normalize("NFKC").trim().toUpperCase().replace(/[\u2010-\u2015\u2212]/g,"-").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}
export function exactSerialMatch(expected:string|undefined,recognized:string|null|undefined){const a=normalizeMeterIdentity(expected??"");const b=normalizeMeterIdentity(recognized??"");return !!a&&!!b&&a===b}
export async function verifyMeterImage():Promise<MeterVerificationResult>{throw new Error("التحقق الخادمي للصورة يجب أن يتم عبر مسار MIZAN/MRX؛ لا يوجد مسار server-function مستقل في Vite.");}
export async function saveVerifiedMeterReading():Promise<VerifiedMeterReadingResult>{throw new Error("الحفظ المعتمد يتم حصراً عبر mrx_capture_meter_reading.");}
