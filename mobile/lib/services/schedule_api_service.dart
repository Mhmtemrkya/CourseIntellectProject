import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class ScheduleApiException implements Exception {
  final String message;

  const ScheduleApiException(this.message);

  @override
  String toString() => message;
}

class ScheduleEntryApiRecord {
  final String id;
  final String className;
  final String day;
  final String time;
  final String subject;
  final String teacher;
  final String room;
  final bool isReadOnly;

  const ScheduleEntryApiRecord({
    required this.id,
    required this.className,
    required this.day,
    required this.time,
    required this.subject,
    required this.teacher,
    required this.room,
    required this.isReadOnly,
  });

  factory ScheduleEntryApiRecord.fromMap(Map<String, dynamic> map) {
    return ScheduleEntryApiRecord(
      id: (map['id'] ?? '').toString(),
      className: (map['className'] ?? '').toString(),
      day: (map['day'] ?? '').toString(),
      time: (map['time'] ?? '').toString(),
      subject: (map['subject'] ?? '').toString(),
      teacher: (map['teacher'] ?? '').toString(),
      room: (map['room'] ?? '').toString(),
      isReadOnly: map['isReadOnly'] as bool? ?? false,
    );
  }
}

class ScheduleApiService {
  ScheduleApiService._();

  static final ScheduleApiService instance = ScheduleApiService._();

  Future<List<ScheduleEntryApiRecord>> fetchEntries() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ScheduleApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/schedule'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ScheduleApiException(
        'Ders programı alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) => ScheduleEntryApiRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<ScheduleEntryApiRecord> createEntry({
    required String className,
    required String day,
    required String time,
    required String subject,
    required String teacher,
    String? room,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ScheduleApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/schedule'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'className': className,
        'day': day,
        'time': time,
        'subject': subject,
        'teacher': teacher,
        'room': room,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ScheduleApiException(
        _extractError(response, 'Ders programı kaydı oluşturulamadı'),
      );
    }

    return ScheduleEntryApiRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<ScheduleEntryApiRecord> updateEntry({
    required String id,
    required String className,
    required String day,
    required String time,
    required String subject,
    required String teacher,
    String? room,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ScheduleApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/schedule/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'className': className,
        'day': day,
        'time': time,
        'subject': subject,
        'teacher': teacher,
        'room': room,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ScheduleApiException(
        _extractError(response, 'Ders programı kaydı güncellenemedi'),
      );
    }

    return ScheduleEntryApiRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deleteEntry(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ScheduleApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/schedule/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ScheduleApiException(
        _extractError(response, 'Ders programı kaydı silinemedi'),
      );
    }
  }

  String _extractError(http.Response response, String fallback) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body['message'] is String) {
        return body['message'] as String;
      }
    } catch (_) {}
    return '$fallback (${response.statusCode}).';
  }
}
