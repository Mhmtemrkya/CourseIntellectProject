import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class RegistrationApiException implements Exception {
  final String message;

  const RegistrationApiException(this.message);

  @override
  String toString() => message;
}

class GeneratedCredentials {
  final String userId;
  final String username;
  final String password;
  final String fullName;
  final GeneratedCredentials? parent;

  const GeneratedCredentials({
    this.userId = '',
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
    double? enrollmentGrossAmount,
    double? enrollmentDiscountAmount,
    String? enrollmentDiscountReason,
    double? enrollmentDownPayment,
    int? enrollmentInstallmentCount,
    String? academicYear,
    String? branchId,
  }) async {
    final response = await _authorizedPost(
      '/api/students',
      branchId: branchId,
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
        'enrollmentGrossAmount': ?enrollmentGrossAmount,
        'enrollmentDiscountAmount': ?enrollmentDiscountAmount,
        'enrollmentDiscountReason': ?enrollmentDiscountReason,
        'enrollmentDownPayment': ?enrollmentDownPayment,
        'enrollmentInstallmentCount': ?enrollmentInstallmentCount,
        'academicYear': ?academicYear,
      },
    );

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final parentRaw = map['parent'];
    GeneratedCredentials? parentCreds;
    if (parentRaw is Map) {
      final parentMap = Map<String, dynamic>.from(parentRaw);
      parentCreds = GeneratedCredentials(
        userId: (parentMap['userId'] as String?) ?? '',
        username: (parentMap['username'] as String?) ?? '',
        password: (parentMap['password'] as String?) ?? '',
        fullName: (parentMap['fullName'] as String?) ?? '',
      );
    }
    return GeneratedCredentials(
      userId: (map['userId'] as String?) ?? '',
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
    String? branchId,
  }) async {
    final response = await _authorizedPost(
      '/api/staff',
      branchId: branchId,
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
      userId: (map['userId'] as String?) ?? '',
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
    );
  }

  Future<void> deleteStaffUser(String userId) async {
    if (userId.trim().isEmpty) return;
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const RegistrationApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yap.',
      );
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/staff/users/$userId'),
      headers: {'Authorization': 'Bearer ${session.accessToken}', ...BranchScopeStore.instance.headers},
    );

    if (response.statusCode == 404) return;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message =
          'Personel geri alma işlemi başarısız oldu (${response.statusCode}).';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw RegistrationApiException(message);
    }
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
      userId: (map['userId'] as String?) ?? '',
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
      userId: (map['userId'] as String?) ?? '',
      username: map['username'] as String,
      password: map['password'] as String,
      fullName: (map['fullName'] as String?) ?? '',
    );
  }

  Future<http.Response> _authorizedPost(
    String path, {
    required Map<String, dynamic> body,
    String? branchId,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const RegistrationApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yap.',
      );
    }

    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session.accessToken}', ...BranchScopeStore.instance.headers,
    };
    // Seçilen şube: backend yetkiye göre dikkate alır (owner ise damgalar).
    if (branchId != null && branchId.isNotEmpty) {
      headers['X-Branch-Filter'] = branchId;
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: headers,
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
      var message = 'Kayıt işlemi başarısız oldu (${response.statusCode}).';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw RegistrationApiException(message);
    }

    return response;
  }
}
