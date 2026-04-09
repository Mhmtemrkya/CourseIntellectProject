import 'dart:convert';

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

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
    required this.fullName,
    required this.username,
    required this.primaryRole,
    required this.extraRoles,
  });

  factory AuthSession.fromMap(Map<String, dynamic> map) {
    return AuthSession(
      accessToken: map['accessToken'] as String,
      refreshToken: map['refreshToken'] as String,
      accessTokenExpiresAt: DateTime.parse(map['accessTokenExpiresAt'] as String),
      refreshTokenExpiresAt: DateTime.parse(map['refreshTokenExpiresAt'] as String),
      fullName: map['fullName'] as String,
      username: map['username'] as String,
      primaryRole: map['primaryRole'] as String,
      extraRoles: (map['extraRoles'] as List<dynamic>? ?? const []).cast<String>(),
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
      };
}

class AuthSessionStore {
  AuthSessionStore._();

  static const _storageKey = 'course_intellect_auth_session_v1';
  static final AuthSessionStore instance = AuthSessionStore._();

  Future<void> save(AuthSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(session.toMap()));
  }

  Future<AuthSession?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return null;
    return AuthSession.fromMap(Map<String, dynamic>.from(jsonDecode(raw) as Map));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}
