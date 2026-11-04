const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Tarihin YEREL takvim günü ("yyyy-MM-dd"). `toISOString().slice(0, 10)` UTC günü verir:
 * Türkiye'de (UTC+3) yerel gece yarısı önceki günün 21:00'i olduğundan takvim hücreleri
 * bir gün kayıyor, 00:00–03:00 arasında "bugün" dün görünüyordu.
 */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Bugünden `days` gün önce/sonra (negatif = geçmiş) yerel gün anahtarı. */
export function localDateKeyOffset(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return localDateKey(date);
}
