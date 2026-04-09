import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class AdminDirectoryApiException implements Exception {
  final String message;

  const AdminDirectoryApiException(this.message);
}

class AdminStudentRecord {
  final String fullName;
  final String tcNo;
  final String className;
  final String currentSchool;
  final String schoolNumber;
  final String birthDate;
  final String programType;
  final String parentName;
  final String parentPhone;
  final String parentEmail;
  final String address;
  final String note;
  final String username;
  final String status;

  const AdminStudentRecord({
    required this.fullName,
    required this.tcNo,
    required this.className,
    required this.currentSchool,
    required this.schoolNumber,
    required this.birthDate,
    required this.programType,
    required this.parentName,
    required this.parentPhone,
    required this.parentEmail,
    required this.address,
    required this.note,
    required this.username,
    required this.status,
  });

  factory AdminStudentRecord.fromMap(Map<String, dynamic> map) {
    return AdminStudentRecord(
      fullName: map['fullName'] as String? ?? '',
      tcNo: map['tcNo'] as String? ?? '',
      className: map['className'] as String? ?? '',
      currentSchool: map['currentSchool'] as String? ?? '',
      schoolNumber: map['schoolNumber'] as String? ?? '',
      birthDate: map['birthDate'] as String? ?? '',
      programType: map['programType'] as String? ?? '',
      parentName: map['parentName'] as String? ?? '',
      parentPhone: map['parentPhone'] as String? ?? '',
      parentEmail: map['parentEmail'] as String? ?? '',
      address: map['address'] as String? ?? '',
      note: map['note'] as String? ?? '',
      username: map['username'] as String? ?? '',
      status: map['status'] as String? ?? 'Active',
    );
  }
}

class AdminStaffRecord {
  final String fullName;
  final String username;
  final String role;
  final String departmentOrBranch;
  final String campus;
  final String status;
  final List<String> extraRoles;
  final bool hasRoleHistory;

  const AdminStaffRecord({
    required this.fullName,
    required this.username,
    required this.role,
    required this.departmentOrBranch,
    required this.campus,
    required this.status,
    this.extraRoles = const [],
    this.hasRoleHistory = false,
  });

  factory AdminStaffRecord.fromMap(Map<String, dynamic> map) {
    return AdminStaffRecord(
      fullName: map['fullName'] as String? ?? '',
      username: map['username'] as String? ?? '',
      role: map['role'] as String? ?? '',
      departmentOrBranch: map['departmentOrBranch'] as String? ?? '',
      campus: map['campus'] as String? ?? '',
      status: map['status'] as String? ?? 'Active',
      extraRoles: (map['extraRoles'] as List<dynamic>? ?? const []).cast<String>(),
      hasRoleHistory: map['hasRoleHistory'] as bool? ?? false,
    );
  }
}

class RoleSummaryRecord {
  final String roleName;
  final int userCount;
  final bool isActive;
  final bool loginEnabled;
  final bool requiresCriticalApproval;
  final String messagingScope;
  final List<String> moduleAccess;

  const RoleSummaryRecord({
    required this.roleName,
    required this.userCount,
    required this.isActive,
    required this.loginEnabled,
    required this.requiresCriticalApproval,
    required this.messagingScope,
    required this.moduleAccess,
  });

  factory RoleSummaryRecord.fromMap(Map<String, dynamic> map) {
    return RoleSummaryRecord(
      roleName: map['roleName'] as String? ?? '',
      userCount: map['userCount'] as int? ?? 0,
      isActive: map['isActive'] as bool? ?? true,
      loginEnabled: map['loginEnabled'] as bool? ?? false,
      requiresCriticalApproval: map['requiresCriticalApproval'] as bool? ?? false,
      messagingScope: map['messagingScope'] as String? ?? '',
      moduleAccess: (map['moduleAccess'] as List<dynamic>? ?? const []).cast<String>(),
    );
  }
}

class AdminDirectoryApiService {
  AdminDirectoryApiService._();

  static final AdminDirectoryApiService instance = AdminDirectoryApiService._();

  Future<List<AdminStudentRecord>> fetchStudents() async {
    final response = await _authorizedGet('/api/students');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => AdminStudentRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<String>> fetchClasses() async {
    final response = await _authorizedGet('/api/classes');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  Future<List<AdminStaffRecord>> fetchStaff({String? role}) async {
    final path = role == null || role.isEmpty ? '/api/staff' : '/api/staff?role=$role';
    final response = await _authorizedGet(path);
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => AdminStaffRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<RoleSummaryRecord>> fetchRoles() async {
    final response = await _authorizedGet('/api/users/roles');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => RoleSummaryRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<void> updateRolePolicy({
    required String roleName,
    required bool isActive,
    required bool loginEnabled,
    required bool requiresCriticalApproval,
    required String messagingScope,
    required List<String> moduleAccess,
  }) async {
    await _authorizedSend(
      'PUT',
      '/api/users/roles/$roleName',
      body: {
        'isActive': isActive,
        'loginEnabled': loginEnabled,
        'requiresCriticalApproval': requiresCriticalApproval,
        'messagingScope': messagingScope,
        'moduleAccess': moduleAccess,
      },
    );
  }

  Future<void> updateUserStatus({
    required String username,
    required bool isActive,
  }) async {
    await _authorizedSend(
      'PUT',
      '/api/users/$username/status',
      body: {'status': isActive ? 'Active' : 'Passive'},
    );
  }

  Future<void> assignPrimaryRole({
    required String username,
    required String primaryRole,
    required String departmentOrBranch,
  }) async {
    await _authorizedSend(
      'PUT',
      '/api/users/$username/primary-role',
      body: {
        'primaryRole': primaryRole,
        'departmentOrBranch': departmentOrBranch,
      },
    );
  }

  Future<void> addExtraRole({
    required String username,
    required String roleName,
  }) async {
    await _authorizedSend(
      'POST',
      '/api/users/$username/extra-roles',
      body: {'roleName': roleName},
    );
  }

  Future<bool> undoLastRoleAssignment({
    required String username,
  }) async {
    final response = await _authorizedSend(
      'POST',
      '/api/users/$username/undo-role-assignment',
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return payload['success'] as bool? ?? false;
  }

  Future<http.Response> _authorizedGet(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const AdminDirectoryApiException('Oturum bulunamadı. Lütfen yeniden giriş yap.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
      },
    );

    if (response.statusCode == 401) {
      throw const AdminDirectoryApiException('Oturum süresi dolmuş. Lütfen yeniden giriş yap.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminDirectoryApiException('Veriler alınamadı (${response.statusCode}).');
    }

    return response;
  }

  Future<http.Response> _authorizedSend(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const AdminDirectoryApiException('Oturum bulunamadı. Lütfen yeniden giriş yap.');
    }

    final request = http.Request(method, Uri.parse('${ApiConfig.baseUrl}$path'))
      ..headers.addAll({
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      });

    if (body != null) {
      request.body = jsonEncode(body);
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode == 401) {
      throw const AdminDirectoryApiException('Oturum süresi dolmuş. Lütfen yeniden giriş yap.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdminDirectoryApiException('İşlem tamamlanamadı (${response.statusCode}).');
    }

    return response;
  }
}
