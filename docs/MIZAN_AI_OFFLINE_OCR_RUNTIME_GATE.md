# MIZAN AI — Offline OCR Runtime Gate

## Purpose

MRX must not claim true offline OCR merely because a capture can be stored in IndexedDB. The OCR runtime itself must be available without network access.

## Runtime contract

The production web client pins Tesseract.js 7.0.0 and uses a service-worker-managed offline cache for:

- Tesseract browser runtime and worker.
- LSTM core variants for baseline, SIMD, and relaxed-SIMD capable browsers.
- English and Arabic 4.0.0_best_int language data.
- Same-origin /mizan-ocr/* paths so OCR does not depend on third-party network requests at recognition time.

The app checks the offline cache before attempting OCR while offline. If any required asset is missing, the capture remains durable in the MRX queue and OCR is deferred; it is never silently treated as verified.

## First-use requirement

A device must complete the OCR asset installation while online before it is considered field-ready for offline OCR. The service worker installation fails closed if a required OCR asset cannot be cached.

## Field acceptance

At minimum verify:

1. Install/load MIZAN while online.
2. Confirm service worker is active.
3. Confirm all required /mizan-ocr/* resources are cached.
4. Disable network completely.
5. Capture a representative meter image.
6. Run OCR and verify the worker starts without network requests.
7. Restart the browser/device while still offline.
8. Repeat OCR from a queued capture.
9. Reconnect and verify server synchronization and idempotent replay.
10. Record device model, browser version, OCR confidence, runtime duration, and evidence.

This gate is separate from the MRX server-authoritative acceptance gate. Offline OCR success does not authorize a meter reading; the server remains authoritative.
