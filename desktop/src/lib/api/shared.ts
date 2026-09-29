// lib/api domain dosyalarının ortak yardımcıları (dışa açılmaz; modules barrel'ı bunları yayınlamaz).

/**
 * "Bulunamadı" hatası mı? Not: client.ts hata mesajına durum kodunu YAZMAZ
 * (describeApiError); bu yüzden kontrol yalnız sunucu mesajı "404" içerdiğinde
 * doğru döner. Davranış bilerek korunmuştur.
 */
export function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : (error as { message?: unknown } | null | undefined)?.message;
  return /404/.test(String(message || ''));
}

/** Diziyse kendisi, değilse boş dizi — sayfaların beklediği liste normalizasyonu. */
export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
