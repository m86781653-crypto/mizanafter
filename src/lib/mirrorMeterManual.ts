/** MIZAN manual fallback contract. Manual exceptions are enforced by MRX/meter.exception. */
export interface ManualMeterReadingInput { meterId:string; customerId:string; readingDate:string; clientUuid:string; currentReading:number; latitude?:number|null; longitude?:number|null; }
export async function saveManualMeterReading():Promise<never>{throw new Error("الحفظ اليدوي المعتمد يتم حصراً عبر mrx_capture_meter_reading مع صلاحية meter.exception.");}
