import { isRecord } from './errors';
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

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];
export const DEFAULT_DENSITY: Density = 'comfortable';

export interface DirectoryPreferences {
  density: Density;
  hiddenColumns: string[];
  pageSize: number | null;
}

export interface DirectoryColumnKey {
  key: string;
}

function isDensity(value: unknown): value is Density {
  return DENSITIES.some((density) => density === value);
}

/** Bozuk/eski kayıtları güvenli varsayılana indirger — tercih hiçbir zaman çökertmez. */
export function normalizePreferences(raw: unknown): DirectoryPreferences {
  const value: Record<string, unknown> = isRecord(raw) ? raw : {};
  const density = isDensity(value.density) ? value.density : DEFAULT_DENSITY;
  const hiddenColumns = Array.isArray(value.hiddenColumns)
    ? [...new Set(value.hiddenColumns.filter((key): key is string => typeof key === 'string' && key !== ''))]
    : [];
  const pageSize = typeof value.pageSize === 'number' && Number.isFinite(value.pageSize) && value.pageSize > 0
    ? Math.floor(value.pageSize)
    : null;
  return { density, hiddenColumns, pageSize };
}

export function readPreferences(tableId: string | null | undefined): DirectoryPreferences {
  if (!tableId) return normalizePreferences(null);
  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${tableId}`) ?? 'null'));
  } catch {
    return normalizePreferences(null);
  }
}

export function writePreferences(tableId: string | null | undefined, preferences: unknown): void {
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
export function visibleColumns<T extends DirectoryColumnKey>(
  columns: readonly T[] | null | undefined,
  hiddenColumns: readonly string[] | null | undefined,
): T[] {
  const hidden = new Set(hiddenColumns || []);
  return (columns || []).filter((column, index) => index === 0 || !hidden.has(column.key));
}

/** Sütun gizleme/gösterme — ilk sütun için istek gelirse yok sayılır. */
export function toggleHiddenColumn(
  columns: readonly DirectoryColumnKey[] | null | undefined,
  hiddenColumns: string[] | null | undefined,
  key: string | null | undefined,
): string[] {
  if (!key || columns?.[0]?.key === key) return hiddenColumns || [];
  const hidden = new Set(hiddenColumns || []);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  return [...hidden];
}
