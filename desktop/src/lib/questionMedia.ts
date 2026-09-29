import { desktopApiBaseUrl } from './auth';

// Bazı (özellikle ehliyet) sorularında şıkların değeri düz metin değil, bir
// görsel bağlantısıdır. Değer tek parça bir URL/yol ve görsel uzantısıyla
// bitiyorsa görsel kabul edilir; aksi halde metindir.
export function isImageValue(value: unknown): boolean {
  if (!value) return false;
  const v = String(value).trim();
  if (!v || /\s/.test(v)) return false;
  return /\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?(#.*)?$/i.test(v);
}

// Görsel yolunu tam URL'e çevirir. Mutlak http(s) linkleri (ör. jsdelivr CDN)
// olduğu gibi kullanılır; göreli yollar API tabanına eklenir.
export function buildQuestionImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const v = String(path).trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `${desktopApiBaseUrl}/${v.replace(/^\/+/, '')}`;
}

// Şık için ham "A) " önekini temizler.
export function stripOptionPrefix(option: unknown): string {
  return String(option ?? '').replace(/^[A-F][).]\s*/i, '').trim();
}
