export function registerOfflineSupport(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/mizan-offline.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch((error) => console.warn('Offline support registration failed:', error));
  });
}
