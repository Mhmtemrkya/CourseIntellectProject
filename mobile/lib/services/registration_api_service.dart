import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class RegistrationApiException implements Exception {
  final String message;

  const RegistrationApiException(this.message);

  @override
  String toString() => message;
}

class GeneratedCredentials {
  final String username;
  final String password;
  final String fullName;
  final GeneratedCredentials? parent;

  const GeneratedCredentials({
    required this.username,
    required this.password,
    this.fullName = '',
    this.parent,
  });
}

class RegistrationApiService {
  RegistrationApiService._();

  static final RegistrationApiService instance = RegistrationApiService._();

  Future<GeneratedCredentials> createStudent({
    required String fullName,
    required String tcNo,
    required String className,
    required String currentSchool,
    required String schoolNumber,
    required String birthDate,
    required String programType,
    required String parentName,
    required String parentPhone,
    required String parentEmail,
    required String address,
    required String note,
  }) async {
    final response = await _authorizedPost(
      '/api/students',
      body: {
        'fullName': fullName,
        'tcNo': tcNo,
        'className': className,
        'currentSchool': currentSchool,
        'schoolNumber': schoolNumber,
        'birthDate': birthDate,
        'programType': programType,
        'parentName': parentName,
        'parentPhone': parentPhone,
        'parentEmail': parentEmail,
        'address': address,
        'note': note,
      },
    );

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final parentRaw = map['parent'];
    GeneratedCredentials? parentCreds;
    if (parentRaw is Map) {
      final parentMap = Map<String, dynamic>.from(parentRaw);
      parentCreds = GeneratedCredentials(
        username: (parentMap['username'] as String?) ?? '',
        password: (parentMap['password'] as String?) ?? '',
        fullName: (parentMap['fullName'] as String?) ?? '',
      );
    }
    return GeneratedCredentials(
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
      parent: parentCreds,
    );
  }

  Future<GeneratedCredentials> createStaff({
    required String fullName,
    required String role,
    required String departmentOrBranch,
    required String tcNo,
    required String phone,
    required String email,
    required String education,
    required String startDate,
    required String campus,
    required String homeroomClass,
    required List<String> assignedClasses,
    required String maritalStatus,
    required int childCount,
    required String note,
  }) async {
    final response = await _authorizedPost(
      '/api/staff',
      body: {
        'fullName': fullName,
        'role': role,
        'departmentOrBranch': departmentOrBranch,
        'tcNo': tcNo,
        'phone': phone,
        'email': email,
        'education': education,
        'startDate': startDate,
        'campus': campus,
        'homeroomClass': homeroomClass,
        'assignedClasses': assignedClasses,
        'maritalStatus': maritalStatus,
        'childCount': childCount,
        'note': note,
      },
    );

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return GeneratedCredentials(
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
    );
  }

  Future<GeneratedCredentials> createAccounting({
    required String fullName,
    required String tcNo,
    required String phone,
    required String email,
    required String education,
    required String startDate,
    required String campus,
    required String maritalStatus,
    required int childCount,
    required String note,
  }) async {
    final response = await _authorizedPost(
      '/api/staff/accounting',
      body: {
        'fullName': fullName,
        'tcNo': tcNo,
        'phone': phone,
        'email': email,
        'education': education,
        'startDate': startDate,
        'campus': campus,
        'maritalStatus': maritalStatus,
        'childCount': childCount,
        'note': note,
      },
    );

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return GeneratedCredentials(
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
    );
  }

  Future<GeneratedCredentials> createParent({
    required String fullName,
    required String phone,
    required String email,
  }) async {
    final response = await _authorizedPost(
      '/api/parents',
      body: {'fullName': fullName, 'phone': phone, 'email': email},
    );

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return GeneratedCredentials(
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
    );
  }

  Future<http.Response> _authorizedPost(
    String path, {
    required Map<String, dynamic> body,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const RegistrationApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yap.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(body),
    );

    if (response.statusCode == 401) {
      throw const RegistrationApiException(
        'Oturum süresi dolmuş. Lütfen yeniden giriş yap.',
      );
    }

    if (response.statusCode == 403) {
      throw const RegistrationApiException('Bu işlem için yetkin yok.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RegistrationApiException(
        'Kayıt işlemi başarısız oldu (${response.statusCode}).',
      );
    }

    return response;
  }
}
