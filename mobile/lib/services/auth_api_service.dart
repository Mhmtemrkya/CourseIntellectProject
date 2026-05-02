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
        'Backend baglantisi kurulamadi. Denenen adresler: ${triedUrls.join(", ")}',
      );
    }

    if (response.statusCode == 401) {
      throw const AuthApiException('Kullanıcı adı veya şifre yanlış.');
    }

    // Bakım modu — backend 503 + code MAINTENANCE_MODE döndürür
    if (response.statusCode == 503) {
      String message = 'Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
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
        extraRoles: _asStringList(user['extraRoles']),
        tenantId: tenantId.isEmpty ? null : tenantId,
        tenantName: tenantName,
        tenantSlug: tenantSlug,
        isPlatformAdmin: user['isPlatformAdmin'] == true,
      );
    } on AuthApiException {
      rethrow;
    } catch (_) {
      throw const AuthApiException(
        'Giriş bilgileri işlendi ama oturum oluşturulamadı. Lütfen tekrar dene.',
      );
    }
  }

  String _normalizeRole(Object? role) {
    final value = (role ?? '').toString().trim().toLowerCase();
    switch (value) {
      case 'admin':
        return 'Admin';
      case 'developer':
        return 'Developer';
      case 'administrative':
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
