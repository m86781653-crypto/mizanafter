/// <reference types="vite/client" />


declare interface TesseractWorkerResult {
  data: { text: string; confidence: number };
}

declare interface TesseractWorker {
  setParameters(params: Record<string, string>): Promise<void>;
  recognize(image: string | Blob): Promise<TesseractWorkerResult>;
  terminate(): Promise<void>;
}

declare interface TesseractGlobal {
  createWorker(langs?: string | string[], oem?: number, options?: Record<string, unknown>): Promise<TesseractWorker>;
}

declare interface Window { Tesseract?: TesseractGlobal; }
