import { foldTr } from './foldTr';
import { toAttendanceStatus } from './attendanceStatus';

/** Devamsızlık sınırı (gün): özürsüz ve özürlü+özürsüz toplam. */
export interface AbsenceLimit {
  unexcusedDays: number;
  totalDays: number;
  source: string;
}

/**
 * Sınıf seviyesine göre yönetmelik sınırı. Yalnız ortaöğretim (9–12. sınıf, hazırlık) için
 * doğrulanmış kural uygulanır: özürsüz 10, toplam 30 gün (Ortaöğretim Kurumları Yönetmeliği).
 * İlkokul/ortaokul için doğrulanmış tek bir sayı olmadığından null döner; ekran sınır yerine
 * yalnız gün sayılarını gösterir. Eskiden herkes için sabit "20 gün" ve "%30" yazılıyordu.
 */
export function absenceLimitFor(className: string | null | undefined): AbsenceLimit | null {
  const text = foldTr(String(className ?? ''));
  const grade = Number(text.match(/\d{1,2}/)?.[0] ?? NaN);
  const isHighSchool = (grade >= 9 && grade <= 12) || text.includes('hazirlik');
  return isHighSchool ? { unexcusedDays: 10, totalDays: 30, source: 'Ortaöğretim Kurumları Yönetmeliği' } : null;
}

/**
 * Kayıtlar ders bazındadır; gün sayıları ayrı tarihlerden çıkar. Özürsüz = "Devamsız" kaydı
 * olan gün, özürlü = "İzinli" kaydı olan (ve özürsüz olmayan) gün, toplam = ikisinin birleşimi.
 */
export function absenceDayCounts(records: ReadonlyArray<{ lessonDate?: string | null; status?: string | null }>) {
  const dayOf = (value: string | null | undefined) => String(value || '').slice(0, 10);
  const unexcused = new Set<string>();
  const excused = new Set<string>();
  records.forEach((item) => {
    const day = dayOf(item.lessonDate);
    if (!day) return;
    const status = toAttendanceStatus(item.status);
    if (status === 'Devamsiz') unexcused.add(day);
    else if (status === 'Izinli') excused.add(day);
  });
  unexcused.forEach((day) => excused.delete(day));
  return { unexcusedDays: unexcused.size, excusedDays: excused.size, totalDays: unexcused.size + excused.size };
}
