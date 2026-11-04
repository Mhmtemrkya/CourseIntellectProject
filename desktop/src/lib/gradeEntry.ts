import { foldTr } from './foldTr';
import { recordDateValue } from './studentRecords';

/** Not girişi sütunu: 1. yazılı, 2. yazılı, performans. */
export type GradeSlot = 'first' | 'second' | 'performance';

export const GRADE_SLOT_LABELS: Record<GradeSlot, string> = {
  first: '1. Yazılı',
  second: '2. Yazılı',
  performance: 'Performans',
};

/**
 * Sonucun hangi not sütununa ait olduğu, YALNIZ başlık/türdeki değerlendirme adından
 * çıkar. Eskiden "başlıkta 1 ya da 2 geçiyor mu" bakılıyordu ("2026" yılı bile 2. yazılı
 * sayılıyordu) ve bulunamayınca ilgisiz bir sınavın puanı yazılı notu yazılıyordu.
 */
export function classifyAssessment(title: string | null | undefined, type?: string | null): GradeSlot | null {
  const text = foldTr(`${title ?? ''} ${type ?? ''}`);
  if (/(^|[^0-9])1\s*\.?\s*yazili/.test(text) || /birinci\s+yazili/.test(text)) return 'first';
  if (/(^|[^0-9])2\s*\.?\s*yazili/.test(text) || /ikinci\s+yazili/.test(text)) return 'second';
  if (/performans|performance/.test(text)) return 'performance';
  return null;
}

/** Eğitim yılı eylülde başlar; 1. dönem eylül–ocak, 2. dönem şubat–haziran. */
export function currentPeriod(now: Date = new Date()): string {
  const month = now.getMonth();
  const startYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const term = month >= 8 || month === 0 ? 1 : 2;
  return `${startYear} - ${startYear + 1} / ${term}. Dönem`;
}

/** Önceki eğitim yılı ile içinde bulunulan eğitim yılının dönemleri (eskiden 2024–2026'ya sabitti). */
export function periodOptions(now: Date = new Date()): string[] {
  const month = now.getMonth();
  const startYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return [startYear - 1, startYear].flatMap((year) => [
    `${year} - ${year + 1} / 1. Dönem`,
    `${year} - ${year + 1} / 2. Dönem`,
  ]);
}

/** Dönemin tarih aralığı [başlangıç, bitiş); çözülemezse null. */
export function periodRange(period: string): { start: number; end: number } | null {
  const match = period.match(/(\d{4})\s*-\s*\d{4}\s*\/\s*([12])\./);
  if (!match) return null;
  const year = Number(match[1]);
  return match[2] === '1'
    ? { start: new Date(year, 8, 1).getTime(), end: new Date(year + 1, 1, 1).getTime() }
    : { start: new Date(year + 1, 1, 1).getTime(), end: new Date(year + 1, 8, 1).getTime() };
}

/**
 * Sonuç bu döneme mi ait? Tarih etiketi varsa tarihe, yoksa başlıkta dönem adının
 * geçmesine bakılır. Eskiden bütün yılların sonuçları aynı not sütunlarına karışıyordu.
 */
export function isInPeriod(record: { dateLabel?: string | null; examTitle?: string | null }, period: string): boolean {
  const range = periodRange(period);
  if (!range) return true;
  const date = recordDateValue(record.dateLabel);
  if (date > 0) return date >= range.start && date < range.end;
  return foldTr(String(record.examTitle ?? '')).includes(foldTr(period));
}
