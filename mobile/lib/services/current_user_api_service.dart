import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class CurrentUserApiException implements Exception {
  final String message;

  const CurrentUserApiException(this.message);

  @override
  String toString() => message;
}

class CurrentUserProfile {
  final String id;
  final String fullName;
  final String username;
  final String primaryRole;
  final List<String> extraRoles;
  final String status;
  final String campus;
  final String departmentOrBranch;
  final String? tenantId;
  final String? tenantName;
  final String? tenantSlug;
  final bool isPlatformAdmin;

  const CurrentUserProfile({
    required this.id,
    required this.fullName,
    required this.username,
    required this.primaryRole,
    required this.extraRoles,
    required this.status,
    required this.campus,
    required this.departmentOrBranch,
    required this.tenantId,
    required this.tenantName,
    required this.tenantSlug,
    required this.isPlatformAdmin,
  });

  factory CurrentUserProfile.fromMap(Map<String, dynamic> map) {
    final extraRaw = map['extraRoles'];
    final extraRoles = extraRaw is List
        ? extraRaw
              .map((item) => item.toString())
              .where((item) => item.isNotEmpty)
              .toList()
        : <String>[];

    return CurrentUserProfile(
      id: (map['id'] ?? '').toString(),
      fullName: (map['fullName'] ?? '').toString(),
      username: (map['username'] ?? '').toString(),
      primaryRole: (map['primaryRole'] ?? '').toString(),
      extraRoles: extraRoles,
      status: (map['status'] ?? '').toString(),
      campus: (map['campus'] ?? '').toString(),
      departmentOrBranch: (map['departmentOrBranch'] ?? '').toString(),
      tenantId: map['tenantId']?.toString(),
      tenantName: map['tenantName']?.toString(),
      tenantSlug: map['tenantSlug']?.toString(),
      isPlatformAdmin: map['isPlatformAdmin'] as bool? ?? false,
    );
  }
}

class CurrentUserApiService {
  CurrentUserApiService._();

  static final CurrentUserApiService instance = CurrentUserApiService._();

  Future<CurrentUserProfile> fetchMe() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const CurrentUserApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/auth/me'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CurrentUserApiException(
        'Profil bilgileri alınamadı (${response.statusCode}).',
      );
    }

    return CurrentUserProfile.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<CurrentUserProfile> updateMe({
    required String fullName,
    required String campus,
    required String departmentOrBranch,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const CurrentUserApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/auth/me'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'fullName': fullName,
        'campus': campus,
        'departmentOrBranch': departmentOrBranch,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CurrentUserApiException(
        'Profil güncellenemedi (${response.statusCode}).',
      );
    }

    return CurrentUserProfile.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }
}
