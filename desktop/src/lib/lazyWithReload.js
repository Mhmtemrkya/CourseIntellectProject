import { lazy } from 'react';

// Code-split edilmiş route chunk'larının "Loading chunk N failed" ile çökmesini
// önler. Bu hata, çalışan build (paketlenmiş Tauri app ya da açık sekme) ile
// diskteki/yeni build'in chunk hash'leri uyuşmadığında olur: index.html artık
// var olmayan bir chunk adını ister.
//
// Strateji: chunk yüklenemezse bir kez tam sayfa reload yapılır; reload taze
// index.html'i ve güncel chunk adlarını çeker. Kısa süre içinde tekrar olursa
// (gerçekten eksik/bozuk bundle) reload tekrarlanmaz — böylece sonsuz reload
// döngüsü yerine normal hata sınırı (PageErrorBoundary) devreye girer.
const RELOAD_KEY = 'ci:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10000;

function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || '');
  return (
    /Loading chunk [\w-]+ failed/i.test(message)
    || /Loading CSS chunk [\w-]+ failed/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /Failed to fetch dynamically imported module/i.test(message)
  );
}

export function lazyWithReload(factory) {
  return lazy(() => factory().catch((error) => {
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
        window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Reload tetiklendi; render'ı askıda tutmak için çözülmeyen promise döner.
        return new Promise(() => {});
      }
    }
    throw error;
  }));
}

export default lazyWithReload;
