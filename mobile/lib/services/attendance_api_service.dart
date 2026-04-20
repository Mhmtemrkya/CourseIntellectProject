import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class AttendanceApiException implements Exception {
  final String message;

  const AttendanceApiException(this.message);

  @override
  String toString() => message;
}

class AttendanceApiService {
  AttendanceApiService._();

  static final AttendanceApiService instance = AttendanceApiService._();

  Future<List<Map<String, dynamic>>> fetchAttendance({
    String? studentName,
    String? className,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AttendanceApiException('Oturum bulunamadı.');
    }

    final query = <String, String>{};
    if (studentName != null && studentName.isNotEmpty) {
      query['studentName'] = studentName;
    }
    if (className != null && className.isNotEmpty) {
      query['className'] = className;
    }

    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/attendance',
      ).replace(queryParameters: query.isEmpty ? null : query),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AttendanceApiException(
        'Devamsızlık verisi alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> saveAttendance({
    required String className,
    required String lesson,
    required List<Map<String, dynamic>> students,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AttendanceApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/attendance'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'className': className,
        'lesson': lesson,
        'lessonDate': DateTime.now().toIso8601String(),
        'students': students
            .map(
              (student) => {
                'name': student['name'],
                'status': student['status'],
              },
            )
            .toList(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AttendanceApiException(
        'Yoklama kaydedilemedi (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }
}
