import { foldTr } from './foldTr';
import { parseTrDateTime } from './financePeriod';

const nameKey = (value: string | null | undefined) => foldTr(String(value ?? '').trim()).replace(/\s+/g, ' ');

/**
 * Öğrenci kaydı (yoklama, sınav sonucu) bu öğrencinin mi? Kimliğe bağlı kayıtta YALNIZ kimlik karşılaştırılır
 * (aynı adlı iki öğrenci karışmaz); kimliği olmayan eski kayıtta ada düşülür.
 */
export function belongsToStudent(
  record: { studentId?: string | null; studentName?: string | null },
  student: { id?: string | null; fullName?: string | null },
): boolean {
  if (record.studentId) return Boolean(student.id) && record.studentId === student.id;
  return nameKey(record.studentName) !== '' && nameKey(record.studentName) === nameKey(student.fullName);
}

const TR_MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

/**
 * Kayıt tarih etiketini ("05.11.2026", "2026-11-05", "5 Kasım 2026") zaman damgasına
 * çevirir; çözülemezse 0. Etiket metin olarak sıralanınca "05.11.2026" < "28.10.2026"
 * çıkar ve "son sınav" yanlış seçilir — sıralama bununla yapılmalı.
 */
export function recordDateValue(label: string | null | undefined): number {
  const parsed = parseTrDateTime(label);
  if (parsed) return parsed.getTime();
  const match = foldTr(String(label ?? '')).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return 0;
  const month = TR_MONTHS.indexOf(match[2] ?? '');
  return month < 0 ? 0 : new Date(Number(match[3]), month, Number(match[1])).getTime();
}

/** En yeni kayıt önce. */
export const byRecordDateDesc = (a: { dateLabel?: string | null }, b: { dateLabel?: string | null }) =>
  recordDateValue(b.dateLabel) - recordDateValue(a.dateLabel);

/**
 * Serbest metinde (fatura başlığı, not) öğrenci adı TAM KELİME olarak geçiyor mu?
 * "içeriyor mu" bakılınca "Ali Kaya"nın kayıtlarına "Ali Kayaoğlu"nunkiler de karışıyordu.
 */
export function containsWholeName(text: string | null | undefined, name: string | null | undefined): boolean {
  const haystack = nameKey(text);
  const needle = nameKey(name);
  if (needle.length < 3) return false;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    const before = index === 0 ? '' : haystack.charAt(index - 1);
    const after = haystack.charAt(index + needle.length);
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }
  return false;
}
