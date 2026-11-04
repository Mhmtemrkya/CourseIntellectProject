import 'package:flutter_test/flutter_test.dart';
import 'package:student/services/attendance_service.dart';

void main() {
  test('canonicalAttendanceStatus eski ve kanonik yazımları eşler', () {
    const cases = {
      'Katildi': 'Katildi',
      'Geldi': 'Katildi',
      'Katıldı': 'Katildi',
      'present': 'Katildi',
      'Gec': 'Gec',
      'Geç Geldi': 'Gec',
      'late': 'Gec',
      'İzinli': 'Izinli',
      'excuse': 'Izinli',
      'Devamsiz': 'Devamsiz',
      'Devamsız': 'Devamsiz',
      'Gelmedi': 'Devamsiz',
      'absent': 'Devamsiz',
    };
    cases.forEach((input, expected) {
      expect(canonicalAttendanceStatus(input), expected, reason: input);
    });
    expect(canonicalAttendanceStatus(null), 'Devamsiz');
  });

  test('AttendanceRecord.fromMap durumu kanonikleştirir', () {
    final record = AttendanceRecord.fromMap({
      'id': '1',
      'studentName': 'Ali',
      'className': '10-A',
      'lessonDate': '2026-11-03',
      'status': 'Geldi',
      'lesson': 'Matematik',
    });
    expect(record.status, 'Katildi');
  });

  test('attendanceBelongsTo bağlı kayıtta yalnız kimliğe bakar', () {
    AttendanceRecord record(String? studentId) => AttendanceRecord(
      id: '1',
      studentId: studentId,
      studentName: 'Ali KAYA',
      className: '10-A',
      date: DateTime(2026, 11, 3),
      status: 'Katildi',
      lesson: 'Fizik',
    );
    expect(
      attendanceBelongsTo(record('s1'), studentId: 's1', fullName: 'Ali KAYA'),
      isTrue,
    );
    expect(
      attendanceBelongsTo(record('s1'), studentId: 's2', fullName: 'Ali KAYA'),
      isFalse,
    );
    expect(
      attendanceBelongsTo(record(null), studentId: 's2', fullName: 'ali kaya'),
      isTrue,
    );
  });
}
