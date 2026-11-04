import 'package:flutter/foundation.dart';

import 'attendance_api_service.dart';
import 'student_record_match.dart';

/// Yoklama durumunu sunucunun kanonik değerine çevirir: Katildi / Gec / Izinli /
/// Devamsiz. Sunucu artık kanonik döner; eski yazımlar ("Geldi", "Gelmedi",
/// "present"…) yine de tanınır. Tanınmayan değer devamsız sayılır.
String canonicalAttendanceStatus(String? value) {
  final key = (value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('ı', 'i')
      .replaceAll('i̇', 'i')
      .replaceAll('İ', 'i')
      .replaceAll('ç', 'c')
      .replaceAll('ğ', 'g')
      .replaceAll('ö', 'o')
      .replaceAll('ş', 's')
      .replaceAll('ü', 'u')
      .replaceAll(RegExp(r'[^a-z]'), '');
  switch (key) {
    case 'katildi':
    case 'geldi':
    case 'present':
      return 'Katildi';
    case 'gec':
    case 'gecgeldi':
    case 'late':
      return 'Gec';
    case 'izinli':
    case 'izin':
    case 'excuse':
    case 'excused':
      return 'Izinli';
    default:
      return 'Devamsiz';
  }
}

/// Yoklama kaydı bu öğrencinin mi? Kimliğe bağlı kayıtta YALNIZ kimlik
/// karşılaştırılır (aynı adlı iki öğrenci karışmaz); kimliği olmayan eski
/// kayıtta ada düşülür.
bool attendanceBelongsTo(
  AttendanceRecord record, {
  required String studentId,
  required String fullName,
}) =>
    recordBelongsToStudent(
      recordStudentId: record.studentId,
      recordStudentName: record.studentName,
      studentId: studentId,
      fullName: fullName,
    );

class AttendanceRecord {
  final String id;
  final String? studentId;
  final String studentName;
  final String className;
  final DateTime date;
  final String status;
  final String lesson;

  const AttendanceRecord({
    required this.id,
    this.studentId,
    required this.studentName,
    required this.className,
    required this.date,
    required this.status,
    required this.lesson,
  });

  factory AttendanceRecord.fromMap(Map<String, dynamic> map) {
    return AttendanceRecord(
      id: map['id']?.toString() ?? '',
      studentId: map['studentId']?.toString(),
      studentName: map['studentName'] as String? ?? '',
      className: map['className'] as String? ?? '',
      date:
          DateTime.tryParse(map['lessonDate'] as String? ?? '') ??
          DateTime.now(),
      status: canonicalAttendanceStatus(map['status'] as String?),
      lesson: map['lesson'] as String? ?? '',
    );
  }
}

class AttendanceService extends ChangeNotifier {
  AttendanceService._();

  static final AttendanceService instance = AttendanceService._();

  final List<AttendanceRecord> _records = [];
  bool _loaded = false;

  List<AttendanceRecord> all() {
    final list = [..._records];
    list.sort((a, b) => b.date.compareTo(a.date));
    return list;
  }

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    await refresh();
  }

  Future<void> refresh({String? studentName, String? className}) async {
    final items = await AttendanceApiService.instance.fetchAttendance(
      studentName: studentName,
      className: className,
    );

    _records
      ..clear()
      ..addAll(items.map(AttendanceRecord.fromMap));
    _loaded = true;
    notifyListeners();
  }

  Future<void> deleteRecord(String id) async {
    await AttendanceApiService.instance.deleteAttendance(id);
    _records.removeWhere((item) => item.id == id);
    notifyListeners();
  }

  List<AttendanceRecord> forStudent(String studentName) =>
      all().where((item) => item.studentName == studentName).toList();

  List<AttendanceRecord> forClass(String className) =>
      all().where((item) => item.className == className).toList();

  Future<void> saveLessonAttendance({
    required String className,
    required String lesson,
    required List<Map<String, dynamic>> students,
  }) async {
    final items = await AttendanceApiService.instance.saveAttendance(
      className: className,
      lesson: lesson,
      students: students,
    );

    final today = DateTime.now();
    _records.removeWhere((item) {
      return item.className == className &&
          item.lesson == lesson &&
          item.date.year == today.year &&
          item.date.month == today.month &&
          item.date.day == today.day;
    });

    _records.addAll(items.map(AttendanceRecord.fromMap));
    _loaded = true;
    notifyListeners();
  }
}
