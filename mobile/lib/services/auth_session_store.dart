import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;
  final DateTime refreshTokenExpiresAt;
  final String fullName;
  final String username;
  final String primaryRole;
  final List<String> extraRoles;
  final String? tenantId;
  final String tenantName;
  final String tenantSlug;
  final bool isPlatformAdmin;
  final bool mustChangePassword;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
    required this.fullName,
    required this.username,
    required this.primaryRole,
    required this.extraRoles,
    required this.tenantId,
    required this.tenantName,
    required this.tenantSlug,
    required this.isPlatformAdmin,
    this.mustChangePassword = false,
  });

  factory AuthSession.fromMap(Map<String, dynamic> map) {
    return AuthSession(
      accessToken: map['accessToken'] as String,
      refreshToken: map['refreshToken'] as String,
      accessTokenExpiresAt: DateTime.parse(
        map['accessTokenExpiresAt'] as String,
      ),
      refreshTokenExpiresAt: DateTime.parse(
        map['refreshTokenExpiresAt'] as String,
      ),
      fullName: map['fullName'] as String,
      username: map['username'] as String,
      primaryRole: map['primaryRole'] as String,
      extraRoles: (map['extraRoles'] as List<dynamic>? ?? const [])
          .cast<String>(),
      tenantId: map['tenantId'] as String?,
      tenantName: (map['tenantName'] as String?) ?? '',
      tenantSlug: (map['tenantSlug'] as String?) ?? '',
      isPlatformAdmin: map['isPlatformAdmin'] == true,
      mustChangePassword: map['mustChangePassword'] == true,
    );
  }

  Map<String, dynamic> toMap() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toIso8601String(),
    'refreshTokenExpiresAt': refreshTokenExpiresAt.toIso8601String(),
    'fullName': fullName,
    'username': username,
    'primaryRole': primaryRole,
    'extraRoles': extraRoles,
    'tenantId': tenantId,
    'tenantName': tenantName,
    'tenantSlug': tenantSlug,
    'isPlatformAdmin': isPlatformAdmin,
    'mustChangePassword': mustChangePassword,
  };
}

class AuthSessionStore {
  AuthSessionStore._();

  static const _storageKey = 'course_intellect_auth_session_v1';
  static final AuthSessionStore instance = AuthSessionStore._();

  // Token'lar Keychain (iOS/macOS) / Keystore-şifreli depo (Android) içinde
  // tutulur; web'de secure storage olmadığından SharedPreferences'a düşülür.
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> save(AuthSession session) async {
    final payload = jsonEncode(session.toMap());
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, payload);
      return;
    }
    await _secure.write(key: _storageKey, value: payload);
  }

  Future<AuthSession?> load() async {
    String? raw;
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      raw = prefs.getString(_storageKey);
    } else {
      raw = await _secure.read(key: _storageKey);
      if (raw == null || raw.isEmpty) {
        // Eski sürüm migrasyonu: düz SharedPreferences'taki oturumu güvenli
        // depoya taşı ve düz kopyayı sil.
        final prefs = await SharedPreferences.getInstance();
        final legacy = prefs.getString(_storageKey);
        if (legacy != null && legacy.isNotEmpty) {
          await _secure.write(key: _storageKey, value: legacy);
          await prefs.remove(_storageKey);
          raw = legacy;
        }
      }
    }
    if (raw == null || raw.isEmpty) return null;
    try {
      return AuthSession.fromMap(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    if (!kIsWeb) {
      await _secure.delete(key: _storageKey);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}
