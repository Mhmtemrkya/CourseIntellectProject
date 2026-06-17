import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class AdminWorkflowApiException implements Exception {
  final String message;
  const AdminWorkflowApiException(this.message);
  @override
  String toString() => message;
}

/// İdari modüller (onay/iş akışı, personel/İK, evrak, görev, denetim) için tek servis.
class AdminWorkflowApiService {
  AdminWorkflowApiService._();
  static final AdminWorkflowApiService instance = AdminWorkflowApiService._();

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AdminWorkflowApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }
    return session;
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path').replace(queryParameters: query);
    final response = await http.get(uri, headers: {'Authorization': 'Bearer ${session.accessToken}'});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException('İstek başarısız (${response.statusCode}).');
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body, [Map<String, String>? query]) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path').replace(queryParameters: query);
    final response = await http.post(
      uri,
      headers: {'Authorization': 'Bearer ${session.accessToken}', 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException('İşlem başarısız (${response.statusCode}).');
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  List<Map<String, dynamic>> _list(dynamic raw) =>
      (raw as List<dynamic>? ?? const []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  // ---- Onaylar ----
  Future<List<Map<String, dynamic>>> getApprovals({String? status, String? category}) async =>
      _list(await _get('/api/approvals', {'status': ?status, 'category': ?category}));

  Future<Map<String, dynamic>> decideApproval(String id, String status, {String? note}) async =>
      Map<String, dynamic>.from(await _post('/api/approvals/$id/decide', {'status': status, 'note': ?note}) as Map);

  // ---- Denetim ----
  Future<List<Map<String, dynamic>>> getAuditLogs({String? category}) async =>
      _list(await _get('/api/audit-logs', {'category': ?category}));

  // ---- İzin / Zimmet ----
  Future<List<Map<String, dynamic>>> getLeaves({String? status}) async =>
      _list(await _get('/api/staff-hr/leaves', {'status': ?status}));

  Future<Map<String, dynamic>> createLeave({
    required String staffName,
    required String leaveType,
    required String startDate,
    required String endDate,
    String? reason,
  }) async =>
      Map<String, dynamic>.from(await _post('/api/staff-hr/leaves', {
        'staffName': staffName,
        'leaveType': leaveType,
        'startDate': startDate,
        'endDate': endDate,
        'reason': ?reason,
      }) as Map);

  Future<Map<String, dynamic>> decideLeave(String id, String status) async =>
      Map<String, dynamic>.from(await _post('/api/staff-hr/leaves/$id/decide', {'status': status}) as Map);

  Future<Map<String, dynamic>> getLeaveBalance(String staffName) async =>
      Map<String, dynamic>.from(await _get('/api/staff-hr/leave-balance', {'staffName': staffName}) as Map);

  Future<List<Map<String, dynamic>>> getAssets({String? staffName}) async =>
      _list(await _get('/api/staff-hr/assets', {'staffName': ?staffName}));

  Future<Map<String, dynamic>> assignAsset({
    required String staffName,
    required String assetName,
    String? assetCode,
    String? note,
  }) async =>
      Map<String, dynamic>.from(await _post('/api/staff-hr/assets', {
        'staffName': staffName,
        'assetName': assetName,
        'assetCode': ?assetCode,
        'note': ?note,
      }) as Map);

  Future<Map<String, dynamic>> returnAsset(String id) async =>
      Map<String, dynamic>.from(await _post('/api/staff-hr/assets/$id/return', const {}) as Map);

  // ---- Evrak ----
  Future<List<Map<String, dynamic>>> getDocuments({String? category}) async =>
      _list(await _get('/api/admin-documents', {'category': ?category}));

  Future<Map<String, dynamic>> createDocument({
    required String title,
    required String category,
    required String direction,
    String? documentNo,
    String? relatedParty,
    String? note,
  }) async =>
      Map<String, dynamic>.from(await _post('/api/admin-documents', {
        'title': title,
        'category': category,
        'direction': direction,
        'documentNo': ?documentNo,
        'relatedParty': ?relatedParty,
        'note': ?note,
      }) as Map);

  Future<Map<String, dynamic>> archiveDocument(String id) async =>
      Map<String, dynamic>.from(await _post('/api/admin-documents/$id/archive', const {}) as Map);

  // ---- Görevler ----
  Future<List<Map<String, dynamic>>> getTasks({String? status}) async =>
      _list(await _get('/api/admin-tasks', {'status': ?status}));

  Future<Map<String, dynamic>> createTask({
    required String title,
    String? description,
    String? category,
    String? assignedToName,
    String? priority,
    String? dueDate,
  }) async =>
      Map<String, dynamic>.from(await _post('/api/admin-tasks', {
        'title': title,
        'description': ?description,
        'category': ?category,
        'assignedToName': ?assignedToName,
        'priority': ?priority,
        'dueDate': ?dueDate,
      }) as Map);

  Future<Map<String, dynamic>> updateTaskStatus(String id, String status) async =>
      Map<String, dynamic>.from(await _post('/api/admin-tasks/$id/status', {'status': status}) as Map);

  // ---- Özet ----
  Future<Map<String, dynamic>> getOverview() async =>
      Map<String, dynamic>.from(await _get('/api/admin/overview') as Map);
}
