import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class MeetingRequestApiException implements Exception {
  final String message;

  const MeetingRequestApiException(this.message);

  @override
  String toString() => message;
}

class MeetingRequestApiRecord {
  final String id;
  final String parentName;
  final String studentName;
  final String advisor;
  final String topic;
  final String slot;
  final bool onlineMeeting;
  final String note;
  final String status;

  const MeetingRequestApiRecord({
    required this.id,
    required this.parentName,
    required this.studentName,
    required this.advisor,
    required this.topic,
    required this.slot,
    required this.onlineMeeting,
    required this.note,
    required this.status,
  });

  factory MeetingRequestApiRecord.fromMap(Map<String, dynamic> map) {
    return MeetingRequestApiRecord(
      id: map['id'] as String,
      parentName: map['parentName'] as String,
      studentName: map['studentName'] as String,
      advisor: map['advisor'] as String,
      topic: map['topic'] as String,
      slot: map['slot'] as String,
      onlineMeeting: map['onlineMeeting'] as bool,
      note: map['note'] as String,
      status: map['status'] as String,
    );
  }
}

class MeetingSlotApiRecord {
  final String? id;
  final String slot;
  final String advisor;
  final bool onlineMeeting;

  const MeetingSlotApiRecord({
    this.id,
    required this.slot,
    required this.advisor,
    required this.onlineMeeting,
  });

  factory MeetingSlotApiRecord.fromMap(Map<String, dynamic> map) {
    return MeetingSlotApiRecord(
      id: map['id'] as String?,
      slot: map['slot'] as String,
      advisor: map['advisor'] as String? ?? '',
      onlineMeeting: map['onlineMeeting'] as bool? ?? true,
    );
  }
}

class MeetingRequestApiService {
  MeetingRequestApiService._();

  static final MeetingRequestApiService instance = MeetingRequestApiService._();

  Future<List<MeetingRequestApiRecord>> fetchRequests({
    String? advisor,
    String? parentName,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final query = <String, String>{};
    if (advisor != null && advisor.trim().isNotEmpty) {
      query['advisor'] = _normalize(advisor);
    }
    if (parentName != null && parentName.trim().isNotEmpty) {
      query['parentName'] = _normalize(parentName);
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests').replace(queryParameters: query.isEmpty ? null : query),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme talepleri alınamadı (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => MeetingRequestApiRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<MeetingSlotApiRecord>> fetchAvailableSlots({
    required String advisor,
    required bool onlineMeeting,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/slots').replace(
        queryParameters: {
          'advisor': _normalize(advisor),
          'onlineMeeting': onlineMeeting.toString(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Uygun görüşme saatleri alınamadı (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => MeetingSlotApiRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<MeetingRequestApiRecord> createRequest({
    required String parentName,
    required String studentName,
    required String advisor,
    required String topic,
    required String slot,
    required bool onlineMeeting,
    required String note,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'parentName': _normalize(parentName),
        'studentName': _normalize(studentName),
        'advisor': _normalize(advisor),
        'topic': topic,
        'slot': slot,
        'onlineMeeting': onlineMeeting,
        'note': note,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme talebi oluşturulamadı (${response.statusCode}).');
    }

    return MeetingRequestApiRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<List<MeetingSlotApiRecord>> fetchConfiguredSlots({
    required String advisor,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/availability').replace(
        queryParameters: {'advisor': _normalize(advisor)},
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme slotları alınamadı (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => MeetingSlotApiRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<String>> fetchAvailableAdvisors() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/advisors'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme öğretmenleri alınamadı (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  Future<MeetingSlotApiRecord> createAvailability({
    required String advisor,
    required String slot,
    required bool onlineMeeting,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/availability'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'advisor': _normalize(advisor),
        'slot': slot,
        'onlineMeeting': onlineMeeting,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme slotu eklenemedi (${response.statusCode}).');
    }

    return MeetingSlotApiRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<void> deleteAvailability(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/availability/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme slotu silinemedi (${response.statusCode}).');
    }
  }

  Future<MeetingRequestApiRecord> updateStatus({
    required String id,
    required String status,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MeetingRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/meetingrequests/$id/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({'status': status}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MeetingRequestApiException('Görüşme durumu güncellenemedi (${response.statusCode}).');
    }

    return MeetingRequestApiRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  static String _normalize(String value) {
    return value
        .trim()
        .replaceAll('ç', 'c')
        .replaceAll('Ç', 'C')
        .replaceAll('ğ', 'g')
        .replaceAll('Ğ', 'G')
        .replaceAll('ı', 'i')
        .replaceAll('İ', 'I')
        .replaceAll('ö', 'o')
        .replaceAll('Ö', 'O')
        .replaceAll('ş', 's')
        .replaceAll('Ş', 'S')
        .replaceAll('ü', 'u')
        .replaceAll('Ü', 'U');
  }
}
