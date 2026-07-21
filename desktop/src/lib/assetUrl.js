import { desktopApiBaseUrl } from './auth';

// Yüklenen dosyalar backend'de göreli yolla (`/uploads/...`) saklanır. Masaüstü
// (Tauri) uygulamasında bir <img src="/uploads/..."> uygulamanın kendi kaynağına
// (tauri://localhost) göre çözülür, backend'e değil — bu yüzden görsel yüklenmez.
// Bu yardımcı göreli yolları API tabanına bağlar; mutlak/veri/blob linklerine
// dokunmaz. Fotoğraf/logo/imza gibi tüm statik varlık gösterimlerinde kullanın.
export function assetUrl(path) {
  if (!path) return '';
  const value = String(path).trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (!desktopApiBaseUrl) return value;
  try {
    return new URL(value, desktopApiBaseUrl).toString();
  } catch {
    return value;
  }
}
