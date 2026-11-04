import { foldTr } from './foldTr';

/** Sunucunun sakladığı kanonik yoklama durumları (AttendanceStatusMatcher ile aynı). */
export type AttendanceStatus = 'Katildi' | 'Gec' | 'Izinli' | 'Devamsiz';

/**
 * Yoklama durumunu kanonik değere çevirir. Sunucu artık kanonik döner; eski ya
 * da serbest yazımlar ("Geldi", "Gelmedi", "present"…) yine de tanınır. Eskiden
 * yalnız "katildi/present" arandığı için "Geldi" kayıtları devamsız sayılıyordu.
 * Tanınmayan değer devamsız sayılır (sunucudaki kayıt kuralıyla aynı).
 */
export function toAttendanceStatus(value: string | null | undefined): AttendanceStatus {
  const key = foldTr(String(value ?? '')).replace(/[^a-z]/g, '');
  if (key === 'katildi' || key === 'geldi' || key === 'present') return 'Katildi';
  if (key === 'gec' || key === 'gecgeldi' || key === 'late') return 'Gec';
  if (key === 'izinli' || key === 'izin' || key === 'excuse' || key === 'excused') return 'Izinli';
  return 'Devamsiz';
}

export const isAbsentStatus = (value: string | null | undefined) => toAttendanceStatus(value) === 'Devamsiz';

export const isLateStatus = (value: string | null | undefined) => toAttendanceStatus(value) === 'Gec';

/** Gelen, geç gelen veya izinli — "derse katıldı" sayılır (sunucudaki IsAttended). */
export const isAttendedStatus = (value: string | null | undefined) => toAttendanceStatus(value) !== 'Devamsiz';

// Kayıt-öğrenci eşleşmesi ortak modülde (yoklama ve sınav sonucu aynı kuralı kullanır).
export { belongsToStudent } from './studentRecords';
