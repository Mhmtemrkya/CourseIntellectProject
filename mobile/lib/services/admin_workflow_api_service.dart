import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

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
      throw const AdminWorkflowApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final session = await _session();
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}$path',
    ).replace(queryParameters: query);
    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException(
        'İstek başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<dynamic> _post(
    String path,
    Map<String, dynamic> body, [
    Map<String, String>? query,
  ]) async {
    final session = await _session();
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}$path',
    ).replace(queryParameters: query);
    final response = await http.post(
      uri,
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException(
        'İşlem başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<void> _delete(String path) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.delete(
      uri,
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException(
        'Silme başarısız (${response.statusCode}).',
      );
    }
  }

  Future<dynamic> _put(String path, Map<String, dynamic> body) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final response = await http.put(
      uri,
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminWorkflowApiException(
        'İşlem başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  List<Map<String, dynamic>> _list(dynamic raw) =>
      (raw as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  // ---- Kapsam yönetimi (platform admin): grup + kurum→grup + kullanıcı grant'ları ----
  Future<List<Map<String, dynamic>>> getScopeGroups() async =>
      _list(await _get('/api/scope-admin/groups'));

  Future<void> createScopeGroup({
    required String name,
    String? parentGroupId,
  }) async => _post('/api/scope-admin/groups', {
    'name': name,
    'parentGroupId': ?parentGroupId,
  });

  Future<void> deleteScopeGroup(String id) async =>
      _delete('/api/scope-admin/groups/$id');

  Future<List<Map<String, dynamic>>> getScopeTenants() async =>
      _list(await _get('/api/scope-admin/tenants'));

  Future<void> assignTenantGroup(String tenantId, String? groupId) async =>
      _put('/api/scope-admin/tenants/$tenantId/group', {'groupId': groupId});

  Future<List<Map<String, dynamic>>> searchScopeUsers(String? search) async =>
      _list(
        await _get(
          '/api/scope-admin/users',
          (search != null && search.isNotEmpty) ? {'search': search} : null,
        ),
      );

  Future<List<Map<String, dynamic>>> getUserGrants(String userId) async =>
      _list(await _get('/api/scope-admin/users/$userId/grants'));

  Future<void> addUserGrant(
    String userId, {
    required String level,
    String? targetId,
    required String accessMode,
  }) async => _post('/api/scope-admin/users/$userId/grants', {
    'level': level,
    'targetId': targetId,
    'accessMode': accessMode,
  });

  Future<void> removeUserGrant(String grantId) async =>
      _delete('/api/scope-admin/grants/$grantId');

  // ---- Organizasyon birimleri ----
  Future<List<Map<String, dynamic>>> getOrgUnits() async =>
      _list(await _get('/api/org-units'));

  // ---- Context switcher: erişilebilir kurum/şube ağacı + aktif bağlam ----
  Future<Map<String, dynamic>?> getMyScope() async {
    final raw = await _get('/api/my-scope');
    return raw == null ? null : Map<String, dynamic>.from(raw as Map);
  }

  // ---- Konsolide roll-up: erişilebilir tüm kurumların özet metrikleri + toplam ----
  Future<Map<String, dynamic>?> getMyScopeRollup() async {
    final raw = await _get('/api/my-scope/rollup');
    return raw == null ? null : Map<String, dynamic>.from(raw as Map);
  }

  Future<Map<String, dynamic>> createOrgUnit({
    required String name,
    required String unitType,
    String? parentUnitId,
    String? managerName,
    String? managerUserId,
    String? note,
  }) async => Map<String, dynamic>.from(
    await _post('/api/org-units', {
          'name': name,
          'unitType': unitType,
          'parentUnitId': ?parentUnitId,
          'managerName': ?managerName,
          'managerUserId': ?managerUserId,
          'note': ?note,
        })
        as Map,
  );

  // Şube sorumlusu adayları (personel + kurum yöneticileri, yalnız aktifler).
  Future<List<Map<String, dynamic>>> getManagerCandidates() async =>
      _list(await _get('/api/org-units/manager-candidates'));

  // Birimi pasif/aktif yapar (pasif birim seçim listelerinde görünmez, veri silinmez).
  Future<void> setOrgUnitActive(String id, bool isActive) async =>
      _put('/api/org-units/$id/active', {'isActive': isActive});

  // Var olan kullanıcının rol/şube/özel rol atamasını günceller (ev grant'ı yenilenir).
  Future<void> updateStaffAssignment(
    String userId, {
    String? role,
    String? branchId,
    String? customRoleId,
    bool clearCustomRole = false,
    bool clearBranch = false,
  }) async => _put('/api/staff/users/$userId/assignment', {
    'role': role,
    'branchId': branchId,
    'customRoleId': customRoleId,
    'clearCustomRole': clearCustomRole,
    'clearBranch': clearBranch,
  });

  // ---- Özel roller (kurum yöneticisi tanımlar; modül kısıtı API'de zorlanır) ----
  Future<List<Map<String, dynamic>>> getCustomRoles() async =>
      _list(await _get('/api/custom-roles'));

  /// Yetki matrisinin kaynağı: role verilebilecek sayfa kataloğu. Sunucudan
  /// gelir; kaydederken sunucu yine aynı katalogla doğrular (istemciye güvenilmez).
  Future<List<Map<String, dynamic>>> getRoleModuleCatalog() async {
    final result = await _get('/api/custom-roles/module-catalog');
    final map = Map<String, dynamic>.from(result as Map);
    return (map['groups'] as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  /// [modulesRestricted] true → [modules] BAĞLAYICIDIR; boş liste "hiçbir sayfa
  /// yok" demektir. Bayrak olmadan sunucu boş listeyi "kısıt yok" (tam yetki)
  /// sayar — yetki matrisinden gelen istekler daima true gönderir.
  Future<Map<String, dynamic>> createCustomRole({
    required String name,
    required String baseRole,
    required List<String> modules,
    bool modulesRestricted = false,
  }) async {
    final result = await _post('/api/custom-roles', {
      'name': name,
      'baseRole': baseRole,
      'modules': modules,
      'modulesRestricted': modulesRestricted,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  // ---- Kurum yapılandırmaları (öğretmen branşları burada saklanır) ----
  Future<List<Map<String, dynamic>>> getPlatformConfigurations(
    String configurationType,
  ) async => _list(
    await _get('/api/platformconfigurations', {
      'configurationType': configurationType,
    }),
  );

  Future<void> upsertPlatformConfiguration(
    Map<String, dynamic> payload,
  ) async => _put('/api/platformconfigurations', payload);

  Future<void> deleteCustomRole(String id) async =>
      _delete('/api/custom-roles/$id');

  Future<void> deleteOrgUnit(String id) async => _delete('/api/org-units/$id');

  // ---- Roller (RBAC, salt okunur) ----
  Future<List<Map<String, dynamic>>> getRoles() async =>
      _list(await _get('/api/users/roles'));

  // ---- Onaylar ----
  Future<List<Map<String, dynamic>>> getApprovals({
    String? status,
    String? category,
  }) async => _list(
    await _get('/api/approvals', {'status': ?status, 'category': ?category}),
  );

  Future<Map<String, dynamic>> decideApproval(
    String id,
    String status, {
    String? note,
  }) async => Map<String, dynamic>.from(
    await _post('/api/approvals/$id/decide', {'status': status, 'note': ?note})
        as Map,
  );

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
  }) async => Map<String, dynamic>.from(
    await _post('/api/staff-hr/leaves', {
          'staffName': staffName,
          'leaveType': leaveType,
          'startDate': startDate,
          'endDate': endDate,
          'reason': ?reason,
        })
        as Map,
  );

  Future<Map<String, dynamic>> decideLeave(String id, String status) async =>
      Map<String, dynamic>.from(
        await _post('/api/staff-hr/leaves/$id/decide', {'status': status})
            as Map,
      );

  Future<Map<String, dynamic>> getLeaveBalance(String staffName) async =>
      Map<String, dynamic>.from(
        await _get('/api/staff-hr/leave-balance', {'staffName': staffName})
            as Map,
      );

  Future<List<Map<String, dynamic>>> getAssets({String? staffName}) async =>
      _list(await _get('/api/staff-hr/assets', {'staffName': ?staffName}));

  Future<Map<String, dynamic>> assignAsset({
    required String staffName,
    required String assetName,
    String? assetCode,
    String? note,
  }) async => Map<String, dynamic>.from(
    await _post('/api/staff-hr/assets', {
          'staffName': staffName,
          'assetName': assetName,
          'assetCode': ?assetCode,
          'note': ?note,
        })
        as Map,
  );

  Future<Map<String, dynamic>> returnAsset(String id) async =>
      Map<String, dynamic>.from(
        await _post('/api/staff-hr/assets/$id/return', const {}) as Map,
      );

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
  }) async => Map<String, dynamic>.from(
    await _post('/api/admin-documents', {
          'title': title,
          'category': category,
          'direction': direction,
          'documentNo': ?documentNo,
          'relatedParty': ?relatedParty,
          'note': ?note,
        })
        as Map,
  );

  Future<Map<String, dynamic>> archiveDocument(String id) async =>
      Map<String, dynamic>.from(
        await _post('/api/admin-documents/$id/archive', const {}) as Map,
      );

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
    String? startDate,
    String? endDate,
  }) async => Map<String, dynamic>.from(
    await _post('/api/admin-tasks', {
          'title': title,
          'description': ?description,
          'category': ?category,
          'assignedToName': ?assignedToName,
          'priority': ?priority,
          'dueDate': ?dueDate,
          'startDate': ?startDate,
          'endDate': ?endDate,
        })
        as Map,
  );

  Future<Map<String, dynamic>> updateTaskStatus(
    String id,
    String status, {
    String? reason,
  }) async => Map<String, dynamic>.from(
    await _post('/api/admin-tasks/$id/status', {
          'status': status,
          'reason': ?reason,
        })
        as Map,
  );

  // ---- Özet ----
  Future<Map<String, dynamic>> getOverview() async =>
      Map<String, dynamic>.from(await _get('/api/admin/overview') as Map);

  // ---- Kurum sahibi ana paneli (tüm KPI'lar tek uçtan) ----
  // from/to ISO tarih-saat; verilmezse backend "bugün" davranışına düşer.
  // Kurumun paketinde/kullanıcının rolünde olmayan modülün sayacı null gelir.
  Future<Map<String, dynamic>> getDashboard({String? from, String? to}) async =>
      Map<String, dynamic>.from(
        await _get('/api/admin/dashboard', {'from': ?from, 'to': ?to}) as Map,
      );

  // Yeni kurum kurulum sihirbazı: adımlar ve hangilerinin bittiği. "Bitti"
  // bilgisi kullanıcının işaretinden değil, kurumun kendi verisinden hesaplanır.
  Future<Map<String, dynamic>> getSetupStatus() async =>
      Map<String, dynamic>.from(
        await _get('/api/admin/dashboard/setup') as Map,
      );

  // ---- Dönemsel analitik (kazanç / kayıt / gider) ----
  // period: day | week | month | year. İsteğe bağlı özel aralık: from/to (yyyy-MM-dd).
  Future<Map<String, dynamic>> getAnalytics({
    String period = 'week',
    String? from,
    String? to,
  }) async => Map<String, dynamic>.from(
    await _get('/api/admin/analytics', {
          'period': period,
          'from': ?from,
          'to': ?to,
        })
        as Map,
  );
}
