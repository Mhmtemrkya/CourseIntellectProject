import 'package:flutter/foundation.dart';

import 'attendance_api_service.dart';

class AttendanceRecord {
  final String id;
  final String studentName;
  final String className;
  final DateTime date;
  final String status;
  final String lesson;

  const AttendanceRecord({
    required this.id,
    required this.studentName,
    required this.className,
    required this.date,
    required this.status,
    required this.lesson,
  });

  factory AttendanceRecord.fromMap(Map<String, dynamic> map) {
    return AttendanceRecord(
      id: map['id']?.toString() ?? '',
      studentName: map['studentName'] as String? ?? '',
      className: map['className'] as String? ?? '',
      date: DateTime.tryParse(map['lessonDate'] as String? ?? '') ?? DateTime.now(),
      status: map['status'] as String? ?? 'Devamsiz',
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
