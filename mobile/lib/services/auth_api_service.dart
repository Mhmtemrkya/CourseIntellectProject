import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class AuthApiException implements Exception {
  final String message;
  final String? code;

  const AuthApiException(this.message, {this.code});

  @override
  String toString() => message;
}

class AuthApiService {
  AuthApiService._();

  static final AuthApiService instance = AuthApiService._();

  Future<String> requestPasswordReset({required String email}) async {
    http.Response? response;
    final triedUrls = <String>[];
    final configuredError = ApiConfig.configurationError;

    if (configuredError != null) {
      throw AuthApiException(configuredError);
    }

    for (final baseUrl in ApiConfig.candidateBaseUrls.toSet()) {
      final url = Uri.parse('$baseUrl/api/auth/forgot-password');
      triedUrls.add(baseUrl);

      try {
        response = await http
            .post(
              url,
              headers: const {'Content-Type': 'application/json'},
              body: jsonEncode({'email': email}),
            )
            .timeout(const Duration(seconds: 8));

        ApiConfig.useBaseUrl(baseUrl);
        break;
      } on SocketException {
        continue;
      } on HttpException {
        continue;
      } on TimeoutException {
        continue;
      }
    }

    if (response == null) {
      throw AuthApiException(
        'Backend bağlantısı kurulamadı. Denenen adresler: ${triedUrls.join(", ")}',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException('Talep gönderilemedi (${response.statusCode}).');
    }

    try {
      final decoded = jsonDecode(response.body);
      final map = _asMap(decoded);
      final message = _asString(map['message']);
      return message.isEmpty
          ? 'E-posta sistemde kayıtlıysa talebiniz kurum yetkililerine iletildi.'
          : message;
    } catch (_) {
      return 'E-posta sistemde kayıtlıysa talebiniz kurum yetkililerine iletildi.';
    }
  }

  Future<List<PasswordResetRequestRecord>> fetchPasswordResetRequests({
    String status = 'Pending',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const AuthApiException('Oturum bulunamadı.');
    }

    final baseUrl = ApiConfig.baseUrl;
    final query = status == 'All'
        ? ''
        : '?status=${Uri.encodeQueryComponent(status)}';
    final url = Uri.parse('$baseUrl/api/auth/password-reset-requests$query');

    http.Response response;
    try {
      response = await http
          .get(url, headers: {'Authorization': 'Bearer ${session.accessToken}'})
          .timeout(const Duration(seconds: 10));
    } on SocketException {
      throw const AuthApiException('Sunucuya bağlanılamadı.');
    } on TimeoutException {
      throw const AuthApiException('İstek zaman aşımına uğradı.');
    }

    if (response.statusCode == 401) {
      throw const AuthApiException('Oturum süresi dolmuş. Tekrar giriş yapın.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException(
        'Şifre talepleri alınamadı (${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map((item) => PasswordResetRequestRecord.fromMap(_asMap(item)))
        .toList();
  }

  Future<PasswordResetReviewResult> reviewPasswordResetRequest({
    required String id,
    required bool approved,
    String note = '',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const AuthApiException('Oturum bulunamadı.');
    }

    final baseUrl = ApiConfig.baseUrl;
    final url = Uri.parse(
      '$baseUrl/api/auth/password-reset-requests/$id/review',
    );

    http.Response response;
    try {
      response = await http
          .post(
            url,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${session.accessToken}',
            },
            body: jsonEncode({'approved': approved, 'note': note}),
          )
          .timeout(const Duration(seconds: 10));
    } on SocketException {
      throw const AuthApiException('Sunucuya bağlanılamadı.');
    } on TimeoutException {
      throw const AuthApiException('İstek zaman aşımına uğradı.');
    }

    if (response.statusCode == 401) {
      throw const AuthApiException('Oturum süresi dolmuş. Tekrar giriş yapın.');
    }
    if (response.statusCode == 400) {
      String message = 'Talep sonuçlandırılamadı.';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw AuthApiException(message);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException('Sunucu hatası (${response.statusCode}).');
    }

    return PasswordResetReviewResult.fromMap(_asMap(jsonDecode(response.body)));
  }

  Future<AuthSession> login({
    required String username,
    required String password,
  }) async {
    http.Response? response;
    final triedUrls = <String>[];
    final configuredError = ApiConfig.configurationError;

    if (configuredError != null) {
      throw AuthApiException(configuredError);
    }

    for (final baseUrl in ApiConfig.candidateBaseUrls.toSet()) {
      final loginUrl = Uri.parse('$baseUrl/api/auth/login');
      triedUrls.add(baseUrl);

      try {
        response = await http
            .post(
              loginUrl,
              headers: const {'Content-Type': 'application/json'},
              body: jsonEncode({'username': username, 'password': password}),
            )
            .timeout(const Duration(seconds: 2));

        ApiConfig.useBaseUrl(baseUrl);
        break;
      } on SocketException {
        continue;
      } on HttpException {
        continue;
      } on TimeoutException {
        continue;
      }
    }

    if (response == null) {
      throw AuthApiException(
        'Backend bağlantısı kurulamadı. Denenen adresler: ${triedUrls.join(", ")}',
      );
    }

    if (response.statusCode == 401) {
      throw const AuthApiException('Kullanıcı adı veya şifre yanlış.');
    }

    // Bakım modu — backend 503 + code MAINTENANCE_MODE döndürür
    if (response.statusCode == 503) {
      String message =
          'Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
      String? code;
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          code = decoded['code']?.toString();
          final m = decoded['message']?.toString();
          if (m != null && m.isNotEmpty) message = m;
        }
      } catch (_) {}
      throw AuthApiException(message, code: code ?? 'MAINTENANCE_MODE');
    }

    // Çok fazla deneme — 429: hesap kilitleme (ACCOUNT_LOCKED) veya hız sınırı (RATE_LIMITED)
    if (response.statusCode == 429) {
      String message =
          'Çok fazla giriş denemesi yapıldı. Lütfen bir süre sonra tekrar deneyin.';
      String? code;
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          code = decoded['code']?.toString();
          final m = decoded['message']?.toString();
          if (m != null && m.isNotEmpty) message = m;
        }
      } catch (_) {}
      throw AuthApiException(message, code: code ?? 'RATE_LIMITED');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException(
        'Giriş sırasında sunucu hatası oluştu (${response.statusCode}).',
      );
    }

    final session = parseLoginResponse(response.body);
    await AuthSessionStore.instance.save(session);
    return session;
  }

  AuthSession parseLoginResponse(String body) {
    try {
      final decoded = jsonDecode(body);
      final raw = _asMap(decoded);
      final map = _asMap(raw['data']).isNotEmpty ? _asMap(raw['data']) : raw;
      final user = _asMap(map['user']);
      final now = DateTime.now().toUtc();
      final expiresInSeconds = _asInt(map['expiresIn']) ?? 900;
      final accessToken = _asString(map['accessToken']);
      final refreshToken = _asString(map['refreshToken']);
      final normalizedRole = _normalizeRole(
        user['primaryRole'] ?? user['role'],
      );
      final normalizedFullName = _asString(user['fullName']).isNotEmpty
          ? _asString(user['fullName'])
          : _asString(user['name']);
      final normalizedUsername = _asString(user['username']).isNotEmpty
          ? _asString(user['username'])
          : _usernameFromEmail(_asString(user['email']));
      final tenantId = _asString(user['tenantId']);
      final tenantName = _asString(user['tenantName']);
      final tenantSlug = _asString(user['tenantSlug']);

      if (accessToken.isEmpty ||
          refreshToken.isEmpty ||
          normalizedRole.isEmpty) {
        throw const AuthApiException(
          'Giriş cevabı eksik geldi. Lütfen tekrar dene.',
        );
      }

      return AuthSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiresAt:
            _parseDateTime(map['expiresAtUtc']) ??
            now.add(Duration(seconds: expiresInSeconds)),
        refreshTokenExpiresAt:
            _parseDateTime(map['refreshTokenExpiresAtUtc']) ??
            now.add(const Duration(days: 7)),
        fullName: normalizedFullName,
        username: normalizedUsername,
        primaryRole: normalizedRole,
        departmentOrBranch: (user['departmentOrBranch'] ?? '').toString(),
        extraRoles: _asStringList(user['extraRoles']),
        tenantId: tenantId.isEmpty ? null : tenantId,
        tenantName: tenantName,
        tenantSlug: tenantSlug,
        isPlatformAdmin: user['isPlatformAdmin'] == true,
        mustChangePassword: user['mustChangePassword'] == true,
      );
    } on AuthApiException {
      rethrow;
    } catch (_) {
      throw const AuthApiException(
        'Giriş bilgileri işlendi ama oturum oluşturulamadı. Lütfen tekrar dene.',
      );
    }
  }

  Future<void> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const AuthApiException('Oturum bulunamadı.');
    }

    final baseUrl = ApiConfig.baseUrl;
    final url = Uri.parse('$baseUrl/api/auth/change-password');

    http.Response response;
    try {
      response = await http
          .post(
            url,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${session.accessToken}',
            },
            body: jsonEncode({
              'currentPassword': currentPassword,
              'newPassword': newPassword,
            }),
          )
          .timeout(const Duration(seconds: 10));
    } on SocketException {
      throw const AuthApiException('Sunucuya bağlanılamadı.');
    } on TimeoutException {
      throw const AuthApiException('İstek zaman aşımına uğradı.');
    }

    if (response.statusCode == 401) {
      throw const AuthApiException('Oturum süresi dolmuş. Tekrar giriş yapın.');
    }

    if (response.statusCode == 400) {
      String message = 'Şifre güncellenemedi.';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw AuthApiException(message);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException('Sunucu hatası (${response.statusCode}).');
    }

    // Update local session: mustChangePassword = false
    final updated = AuthSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      fullName: session.fullName,
      username: session.username,
      primaryRole: session.primaryRole,
      departmentOrBranch: session.departmentOrBranch,
      extraRoles: session.extraRoles,
      tenantId: session.tenantId,
      tenantName: session.tenantName,
      tenantSlug: session.tenantSlug,
      isPlatformAdmin: session.isPlatformAdmin,
      mustChangePassword: false,
    );
    await AuthSessionStore.instance.save(updated);
  }

  String _normalizeRole(Object? role) {
    final value = (role ?? '').toString().trim().toLowerCase().replaceAll(
      RegExp(r'[\s_-]+'),
      '',
    );
    switch (value) {
      case 'admin':
      case 'institutionadmin':
      case 'institutionadministrator':
        return 'Admin';
      case 'developer':
        return 'Developer';
      case 'administrative':
      case 'idare':
      case 'idari':
      case 'idaripersonel':
      case 'idarîpersonel':
        return 'Administrative';
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
      case 'parent':
        return 'Parent';
      case 'accounting':
      case 'accountant':
        return 'Accounting';
      default:
        return role?.toString() ?? '';
    }
  }

  String _usernameFromEmail(String? email) {
    if (email == null || email.isEmpty) return '';
    final atIndex = email.indexOf('@');
    return atIndex > 0 ? email.substring(0, atIndex) : email;
  }

  DateTime? _parseDateTime(Object? value) {
    if (value == null) return null;
    final text = value.toString();
    if (text.isEmpty) return null;
    return DateTime.tryParse(text)?.toUtc();
  }

  Map<String, dynamic> _asMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return value.map((key, dynamic item) => MapEntry(key.toString(), item));
    }
    return const {};
  }

  String _asString(Object? value) {
    if (value == null) return '';
    return value.toString().trim();
  }

  int? _asInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(_asString(value));
  }

  List<String> _asStringList(Object? value) {
    if (value is List) {
      return value
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
    }
    return const [];
  }
}

class PasswordResetRequestRecord {
  final String id;
  final String userId;
  final String requestedEmail;
  final String fullName;
  final String username;
  final String primaryRole;
  final String status;
  final String reviewNote;
  final String reviewedByName;
  final DateTime? requestedAtUtc;
  final DateTime? reviewedAtUtc;
  final DateTime? expiresAtUtc;
  final DateTime? usedAtUtc;

  const PasswordResetRequestRecord({
    required this.id,
    required this.userId,
    required this.requestedEmail,
    required this.fullName,
    required this.username,
    required this.primaryRole,
    required this.status,
    required this.reviewNote,
    required this.reviewedByName,
    required this.requestedAtUtc,
    required this.reviewedAtUtc,
    required this.expiresAtUtc,
    required this.usedAtUtc,
  });

  factory PasswordResetRequestRecord.fromMap(Map<String, dynamic> map) {
    return PasswordResetRequestRecord(
      id: map['id']?.toString() ?? '',
      userId: map['userId']?.toString() ?? '',
      requestedEmail: map['requestedEmail']?.toString() ?? '',
      fullName: map['fullName']?.toString() ?? '',
      username: map['username']?.toString() ?? '',
      primaryRole: map['primaryRole']?.toString() ?? '',
      status: map['status']?.toString() ?? '',
      reviewNote: map['reviewNote']?.toString() ?? '',
      reviewedByName: map['reviewedByName']?.toString() ?? '',
      requestedAtUtc: DateTime.tryParse(
        map['requestedAtUtc']?.toString() ?? '',
      ),
      reviewedAtUtc: DateTime.tryParse(map['reviewedAtUtc']?.toString() ?? ''),
      expiresAtUtc: DateTime.tryParse(map['expiresAtUtc']?.toString() ?? ''),
      usedAtUtc: DateTime.tryParse(map['usedAtUtc']?.toString() ?? ''),
    );
  }
}

class PasswordResetReviewResult {
  final String id;
  final String status;
  final String message;
  final String temporaryPassword;
  final DateTime? expiresAtUtc;

  const PasswordResetReviewResult({
    required this.id,
    required this.status,
    required this.message,
    required this.temporaryPassword,
    required this.expiresAtUtc,
  });

  factory PasswordResetReviewResult.fromMap(Map<String, dynamic> map) {
    return PasswordResetReviewResult(
      id: map['id']?.toString() ?? '',
      status: map['status']?.toString() ?? '',
      message: map['message']?.toString() ?? '',
      temporaryPassword: map['temporaryPassword']?.toString() ?? '',
      expiresAtUtc: DateTime.tryParse(map['expiresAtUtc']?.toString() ?? ''),
    );
  }
}
