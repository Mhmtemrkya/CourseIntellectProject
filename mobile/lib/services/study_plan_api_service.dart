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
    if (session == null) throw const StudyPlanApiException('Oturum bulunamadi.');

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/studyplans'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudyPlanApiException('Calisma plani alinamadi (${response.statusCode}).');
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final raw = map['planItemsSerialized'] as String? ?? '[]';

    return StudyPlanStateRecord(
      planItems: (jsonDecode(raw) as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      streakCount: map['streakCount'] as int? ?? 0,
      xpPoints: map['xpPoints'] as int? ?? 0,
      lastCompletedAt: DateTime.tryParse(map['lastCompletedAt'] as String? ?? ''),
    );
  }

  Future<void> save({
    required String studentName,
    required List<Map<String, dynamic>> planItems,
    required int streakCount,
    required int xpPoints,
    required DateTime? lastCompletedAt,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const StudyPlanApiException('Oturum bulunamadi.');

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
      throw StudyPlanApiException('Calisma plani kaydedilemedi (${response.statusCode}).');
    }
  }
}
