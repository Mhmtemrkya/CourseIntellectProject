// lib/api domain dosyalarının ortak yardımcıları (dışa açılmaz; modules barrel'ı bunları yayınlamaz).

import { isApiError } from './client';

/**
 * "Bulunamadı" hatası mı? client.ts hata mesajına durum kodunu yazmaz
 * (describeApiError); bu yüzden mesaja bakmak hiç eşleşmiyordu ve 404'te
 * boş sonuç dönmesi gereken uçlar hata fırlatıyordu. Durum koduna bakılır.
 */
export function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** Diziyse kendisi, değilse boş dizi — sayfaların beklediği liste normalizasyonu. */
export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
