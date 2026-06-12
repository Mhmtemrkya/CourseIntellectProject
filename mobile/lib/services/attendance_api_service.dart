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

  /// Öğretmen için QR yoklama oturumu açar (desktop ile aynı uç).
  Future<Map<String, dynamic>> openQrSession({
    required String className,
    required String lessonTitle,
    int durationMinutes = 30,
  }) async {
    final response = await _authorizedPost('/api/attendance-qr-sessions/open', {
      'className': className,
      'lessonTitle': lessonTitle,
      'durationMinutes': durationMinutes,
    });
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  /// Öğrencinin QR token'ı ile yoklamaya katılımı. Tüm roller çağırabilir.
  Future<Map<String, dynamic>> checkInQrSession({
    required String token,
    String? studentName,
  }) async {
    final response =
        await _authorizedPost('/api/attendance-qr-sessions/check-in', {
          'token': token,
          if (studentName != null && studentName.isNotEmpty)
            'studentName': studentName,
        });
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  /// Öğretmenin açtığı oturumları (katılım listesiyle birlikte) getirir.
  Future<List<Map<String, dynamic>>> fetchQrSessions({
    String? className,
    String? status,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AttendanceApiException('Oturum bulunamadı.');
    }

    final query = <String, String>{
      if (className != null && className.isNotEmpty) 'className': className,
      if (status != null && status.isNotEmpty) 'status': status,
    };
    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/attendance-qr-sessions',
      ).replace(queryParameters: query.isEmpty ? null : query),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AttendanceApiException(
        'QR oturumları alınamadı (${response.statusCode}).',
      );
    }
    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  /// QR yoklama oturumunu kapatır.
  Future<void> closeQrSession(String id) async {
    await _authorizedPost('/api/attendance-qr-sessions/$id/close', null);
  }

  Future<http.Response> _authorizedPost(
    String path,
    Map<String, dynamic>? body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AttendanceApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: body == null ? null : jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'İşlem tamamlanamadı (${response.statusCode}).';
      try {
        final map = jsonDecode(response.body);
        if (map is Map && map['message'] is String) {
          message = map['message'] as String;
        }
      } catch (_) {
        // Gövde JSON değilse genel mesaj kullanılır.
      }
      throw AttendanceApiException(message);
    }
    return response;
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
