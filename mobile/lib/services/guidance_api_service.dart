import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class GuidanceApiException implements Exception {
  final String message;

  const GuidanceApiException(this.message);

  @override
  String toString() => message;
}

/// Rehberlik modülü API istemcisi: vaka merkezi, öğrenci dosyası, görüşme,
/// randevu/müsaitlik, hedef, envanter ve çalışma programı uçları.
class GuidanceApiService {
  GuidanceApiService._();

  static final GuidanceApiService instance = GuidanceApiService._();

  Future<Map<String, String>> _headers({bool json = false}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const GuidanceApiException('Oturum bulunamadı.');
    }
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      if (json) 'Content-Type': 'application/json',
      ...BranchScopeStore.instance.headers,
    };
  }

  Never _fail(http.Response response, String fallback) {
    String message = fallback;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      }
    } catch (_) {}
    throw GuidanceApiException('$message (${response.statusCode})');
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path')
          .replace(queryParameters: query == null || query.isEmpty ? null : query),
      headers: await _headers(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _fail(response, 'Rehberlik verisi alınamadı');
    }
    return jsonDecode(utf8.decode(response.bodyBytes));
  }

  Future<dynamic> _send(String method, String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = await _headers(json: true);
    final encoded = jsonEncode(body);
    final http.Response response;
    switch (method) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: encoded);
      case 'PUT':
        response = await http.put(uri, headers: headers, body: encoded);
      case 'PATCH':
        response = await http.patch(uri, headers: headers, body: encoded);
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
      default:
        throw const GuidanceApiException('Geçersiz istek.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _fail(response, 'İşlem tamamlanamadı');
    }
    return response.body.isEmpty ? null : jsonDecode(utf8.decode(response.bodyBytes));
  }

  List<Map<String, dynamic>> _asList(dynamic value) =>
      (value as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

  // ── Vaka merkezi / dosya ────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> fetchOverview() async =>
      _asList(await _get('/api/guidance/overview'));

  Future<Map<String, dynamic>> fetchStudentFile(String student) async =>
      Map<String, dynamic>.from(
        await _get('/api/guidance/student-file', {'student': student}) as Map);

  Future<List<Map<String, dynamic>>> fetchFollowUps() async =>
      _asList(await _get('/api/guidance/follow-ups'));

  Future<List<Map<String, dynamic>>> fetchCounselors() async =>
      _asList(await _get('/api/guidance/counselors'));

  // ── Görüşmeler ──────────────────────────────────────────────────────
  Future<void> createSession(Map<String, dynamic> payload) =>
      _send('POST', '/api/guidance/sessions', payload);

  Future<void> updateSession(String id, Map<String, dynamic> payload) =>
      _send('PATCH', '/api/guidance/sessions/$id', payload);

  Future<void> deleteSession(String id) =>
      _send('DELETE', '/api/guidance/sessions/$id', const {});

  // ── Müsaitlik & randevu ─────────────────────────────────────────────
  Future<Map<String, dynamic>> fetchAvailability([String? counselor]) async =>
      Map<String, dynamic>.from(await _get(
        '/api/guidance/availability',
        counselor == null ? null : {'counselor': counselor},
      ) as Map);

  Future<void> saveAvailability(List<String> slots) =>
      _send('PUT', '/api/guidance/availability', {'slots': slots});

  Future<List<Map<String, dynamic>>> fetchAppointments({bool mine = false}) async =>
      _asList(await _get('/api/guidance/appointments', {'mine': '$mine'}));

  Future<void> createAppointment(Map<String, dynamic> payload) =>
      _send('POST', '/api/guidance/appointments', payload);

  Future<void> decideAppointment(String id, {required bool approved, String note = ''}) =>
      _send('PATCH', '/api/guidance/appointments/$id/decide',
          {'approved': approved, 'note': note});

  Future<void> completeAppointment(String id) =>
      _send('PATCH', '/api/guidance/appointments/$id/complete', const {});

  // ── Hedef / risk / envanter ─────────────────────────────────────────
  Future<void> saveGoal(String studentName, Map<String, dynamic> payload) =>
      _send('PUT', '/api/guidance/goals/${Uri.encodeComponent(studentName)}', payload);

  Future<void> createRiskReview(Map<String, dynamic> payload) =>
      _send('POST', '/api/guidance/risk-reviews', payload);

  Future<List<Map<String, dynamic>>> fetchInventories([String? student]) async =>
      _asList(await _get('/api/guidance/inventories',
          student == null ? null : {'student': student}));

  Future<void> assignInventory(Map<String, dynamic> payload) =>
      _send('POST', '/api/guidance/inventories', payload);

  Future<void> completeInventory(String id, String answersJson) =>
      _send('PATCH', '/api/guidance/inventories/$id/complete',
          {'answersJson': answersJson});

  // ── Çalışma programı (rehber, öğrenci adına) ────────────────────────
  Future<Map<String, dynamic>> fetchStudyPlan(String student) async =>
      Map<String, dynamic>.from(
        await _get('/api/guidance/study-plan', {'student': student}) as Map);

  Future<void> updateStudyPlan(String student, String planItemsSerialized) =>
      _send('PUT', '/api/guidance/study-plan',
          {'studentName': student, 'planItemsSerialized': planItemsSerialized});

  // ── Rapor & veli özeti ──────────────────────────────────────────────
  Future<Map<String, dynamic>> fetchClassReport([String? className]) async =>
      Map<String, dynamic>.from(await _get(
        '/api/guidance/class-report',
        className == null ? null : {'className': className},
      ) as Map);

  Future<List<Map<String, dynamic>>> fetchParentChildSummary() async =>
      _asList(await _get('/api/guidance/parent/child-summary'));
}
