import { containsWholeName } from './studentRecords';
import { belongsToStudent, isAbsentStatus, isAttendedStatus, isLateStatus, toAttendanceStatus } from './attendanceStatus';

describe('toAttendanceStatus', () => {
  it.each([
    ['Katildi', 'Katildi'],
    ['Geldi', 'Katildi'],
    ['Katıldı', 'Katildi'],
    ['present', 'Katildi'],
    ['Gec', 'Gec'],
    ['Geç Geldi', 'Gec'],
    ['late', 'Gec'],
    ['İzinli', 'Izinli'],
    ['excuse', 'Izinli'],
    ['Devamsiz', 'Devamsiz'],
    ['Gelmedi', 'Devamsiz'],
    ['absent', 'Devamsiz'],
    ['', 'Devamsiz'],
    [null, 'Devamsiz'],
  ])('maps %p to %p', (input, expected) => {
    expect(toAttendanceStatus(input)).toBe(expected);
  });

  it('classifies attended, late and absent consistently', () => {
    expect(isAttendedStatus('Geldi')).toBe(true);
    expect(isAttendedStatus('Izinli')).toBe(true);
    expect(isAbsentStatus('Geldi')).toBe(false);
    expect(isAbsentStatus('Devamsiz')).toBe(true);
    expect(isLateStatus('Gec')).toBe(true);
  });
});

describe('belongsToStudent', () => {
  const ali1 = { id: 's1', fullName: 'Ali KAYA' };
  const ali2 = { id: 's2', fullName: 'Ali KAYA' };

  it('matches linked records only by id', () => {
    const record = { studentId: 's1', studentName: 'Ali KAYA' };
    expect(belongsToStudent(record, ali1)).toBe(true);
    expect(belongsToStudent(record, ali2)).toBe(false);
  });

  it('falls back to the name for unlinked records', () => {
    expect(belongsToStudent({ studentId: null, studentName: 'ali kaya' }, ali2)).toBe(true);
    expect(belongsToStudent({ studentId: null, studentName: 'Veli Can' }, ali2)).toBe(false);
  });
});

describe('containsWholeName', () => {
  it('matches the name only as whole words', () => {
    expect(containsWholeName('Ali Kaya - Eylül taksiti', 'Ali KAYA')).toBe(true);
    expect(containsWholeName('Ali Kayaoğlu - Eylül taksiti', 'Ali Kaya')).toBe(false);
  });
});
