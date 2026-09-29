/**
 * Dizin tablolarının kullanıcı tercihleri (yoğunluk, gizli sütun, sayfa boyutu).
 *
 * Tercih TABLO BAZINDA saklanır: öğrenci listesinde sıkışık çalışan bir kullanıcı
 * personel listesinde rahat görünüm isteyebilir. Anahtar tablonun `testId`'sidir —
 * rota değişse bile tercih kaybolmaz.
 *
 * Saklama localStorage'dır ve KİŞİSEL VERİ İÇERMEZ (yalnız görünüm ayarı);
 * bu yüzden oturum kapanınca temizlenmesi gerekmez.
 */

const STORAGE_PREFIX = 'ci-directory:';

export const DENSITIES = ['comfortable', 'compact'];
export const DEFAULT_DENSITY = 'comfortable';

/** Bozuk/eski kayıtları güvenli varsayılana indirger — tercih hiçbir zaman çökertmez. */
export function normalizePreferences(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const density = DENSITIES.includes(value.density) ? value.density : DEFAULT_DENSITY;
  const hiddenColumns = Array.isArray(value.hiddenColumns)
    ? [...new Set(value.hiddenColumns.filter((key) => typeof key === 'string' && key))]
    : [];
  const pageSize = Number.isFinite(value.pageSize) && value.pageSize > 0
    ? Math.floor(value.pageSize)
    : null;
  return { density, hiddenColumns, pageSize };
}

export function readPreferences(tableId) {
  if (!tableId) return normalizePreferences(null);
  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${tableId}`)));
  } catch {
    return normalizePreferences(null);
  }
}

export function writePreferences(tableId, preferences) {
  if (!tableId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(normalizePreferences(preferences)));
  } catch {
    // Kota dolu / özel mod: tercih kaydedilemez ama tablo çalışmaya devam eder.
  }
}

/**
 * Görünecek sütunlar. İLK sütun asla gizlenemez: kimlik sütunu (ad/öğrenci)
 * olmadan satırın kime ait olduğu anlaşılmaz, tablo kullanılamaz hâle gelir.
 */
export function visibleColumns(columns, hiddenColumns) {
  const hidden = new Set(hiddenColumns || []);
  return (columns || []).filter((column, index) => index === 0 || !hidden.has(column.key));
}

/** Sütun gizleme/gösterme — ilk sütun için istek gelirse yok sayılır. */
export function toggleHiddenColumn(columns, hiddenColumns, key) {
  if (!key || columns?.[0]?.key === key) return hiddenColumns || [];
  const hidden = new Set(hiddenColumns || []);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  return [...hidden];
}
