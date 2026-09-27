const CACHE = 'mizan-offline-v2';
const APP_SHELL = ['/', '/index.html'];

const OCR_ASSETS = {
  '/mizan-ocr/core/tesseract-core.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core.wasm.js',
  '/mizan-ocr/core/tesseract-core-simd.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd.wasm.js',
  '/mizan-ocr/tesseract.min.js': 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  '/mizan-ocr/worker.min.js': 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
  '/mizan-ocr/core/tesseract-core-lstm.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js',
  '/mizan-ocr/core/tesseract-core-lstm.wasm': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm',
  '/mizan-ocr/core/tesseract-core-simd-lstm.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js',
  '/mizan-ocr/core/tesseract-core-simd-lstm.wasm': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm',
  '/mizan-ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-relaxedsimd-lstm.wasm.js',
  '/mizan-ocr/core/tesseract-core-relaxedsimd-lstm.wasm': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-relaxedsimd-lstm.wasm',
  '/mizan-ocr/lang/eng.traineddata.gz': 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz',
  '/mizan-ocr/lang/ara.traineddata.gz': 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/ara@1.0.0/4.0.0_best_int/ara.traineddata.gz',
};

async function cacheOcrAssets(cache) {
  const results = await Promise.allSettled(
    Object.entries(OCR_ASSETS).map(async ([localPath, remoteUrl]) => {
      const response = await fetch(remoteUrl, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`OCR asset failed: ${remoteUrl} (${response.status})`);
      await cache.put(new Request(new URL(localPath, self.location.origin)), response);
    }),
  );
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) {
    throw new Error(`OCR_OFFLINE_ASSETS_INCOMPLETE:${failures.length}`);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        await cacheOcrAssets(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match('/index.html')))
    );
    return;
  }

  // Keep the first-load CDN request working while the app is installing,
  // then serve the pinned OCR runtime from the offline cache.
  if (url.origin === 'https://cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
