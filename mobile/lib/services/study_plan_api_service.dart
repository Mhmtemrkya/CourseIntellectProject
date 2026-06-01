import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class StudyPlanApiException implements Exception {
  final String message;

  const StudyPlanApiException(this.message);

  @override
  String toString() => message;
}

class StudyPlanStateRecord {
  final List<Map<String, dynamic>> planItems;
  final int streakCount;
  final int xpPoints;
  final DateTime? lastCompletedAt;

  const StudyPlanStateRecord({
    required this.planItems,
    required this.streakCount,
    required this.xpPoints,
    required this.lastCompletedAt,
  });
}

class StudyPlanApiService {
  StudyPlanApiService._();

  static final StudyPlanApiService instance = StudyPlanApiService._();

  Future<StudyPlanStateRecord> fetch() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'Çalışma planı alınamadı (${response.statusCode}).',
      );
    }

    return _recordFromBody(response.body);
  }

  Future<void> save({
    required String studentName,
    required List<Map<String, dynamic>> planItems,
    required int streakCount,
    required int xpPoints,
    required DateTime? lastCompletedAt,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'studentName': studentName,
        'planItemsSerialized': jsonEncode(planItems),
        'streakCount': streakCount,
        'xpPoints': xpPoints,
        'lastCompletedAt': lastCompletedAt?.toIso8601String(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'Çalışma planı kaydedilemedi (${response.statusCode}).',
      );
    }
  }

  Future<StudyPlanStateRecord> addXp(int amount) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans/xp'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'amount': amount}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'XP senkronize edilemedi (${response.statusCode}).',
      );
    }

    return _recordFromBody(response.body);
  }

  Future<StudyPlanStateRecord> addItem(Map<String, dynamic> item) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans/items'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'item': item}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'Çalışma planı eklenemedi (${response.statusCode}).',
      );
    }

    return _recordFromBody(response.body);
  }

  Future<StudyPlanStateRecord> setItemDone(String itemId, bool done) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.patch(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans/items/$itemId/done'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'done': done}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'Çalışma planı güncellenemedi (${response.statusCode}).',
      );
    }

    return _recordFromBody(response.body);
  }

  Future<StudyPlanStateRecord> deleteItem(String itemId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudyPlanApiException('Oturum bulunamadı.');
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans/items/$itemId'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException(
        'Çalışma planı silinemedi (${response.statusCode}).',
      );
    }

    return _recordFromBody(response.body);
  }

  StudyPlanStateRecord _recordFromBody(String body) {
    final map = Map<String, dynamic>.from(jsonDecode(body) as Map);
    final raw = map['planItemsSerialized'] as String? ?? '[]';
    return StudyPlanStateRecord(
      planItems: (jsonDecode(raw) as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      streakCount: map['streakCount'] as int? ?? 0,
      xpPoints: map['xpPoints'] as int? ?? 0,
      lastCompletedAt: DateTime.tryParse(
        map['lastCompletedAt'] as String? ?? '',
      ),
    );
  }
}
