import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_config.dart';
import '../services/auth_session_store.dart';

/// Onboarding "görüldü" durumu deposu.
///
/// - Yerel: SharedPreferences (kullanıcı+rol bazlı anahtar) — anında.
/// - Uzak: /api/user-preferences altında `onboardingSeenMobile` anahtarı —
///   cihaz değişse de turlar baştan başlamaz. Uzak senkron tamamen opsiyoneldir;
///   erişilemezse yerel kayıt yeterlidir (onboarding asla akışı bloklamaz).
class OnboardingStore {
  OnboardingStore._();

  static const _prefix = 'ci_onboarding_seen_v1';
  static const _remoteKey = 'onboardingSeenMobile';
  static final OnboardingStore instance = OnboardingStore._();

  Map<String, dynamic>? _cache;
  String? _cacheKey;
  final Set<String> _remoteMergedKeys = <String>{};

  Future<String?> _localKey() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) return null;
    return '$_prefix:${session.primaryRole}:${session.username}';
  }

  Future<Map<String, dynamic>> _load() async {
    final key = await _localKey();
    if (key == null) return <String, dynamic>{};
    if (_cache != null && _cacheKey == key) return _cache!;

    final prefs = await SharedPreferences.getInstance();
    Map<String, dynamic> seen = <String, dynamic>{};
    final raw = prefs.getString(key);
    if (raw != null && raw.isNotEmpty) {
      try {
        seen = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      } catch (_) {
        seen = <String, dynamic>{};
      }
    }
    _cache = seen;
    _cacheKey = key;

    // Uzaktaki kayıtla kullanıcı başına bir kez birleştir.
    if (!_remoteMergedKeys.contains(key)) {
      _remoteMergedKeys.add(key);
      final remote = await _fetchRemoteSeen();
      if (remote != null && remote.isNotEmpty) {
        seen = {...remote, ...seen};
        _cache = seen;
        await prefs.setString(key, jsonEncode(seen));
      }
    }
    return seen;
  }

  Future<bool> hasSeen(String tourId) async {
    final seen = await _load();
    return seen.containsKey(tourId);
  }

  Future<void> markSeen(String tourId) async {
    final key = await _localKey();
    if (key == null) return;
    final seen = await _load();
    if (seen.containsKey(tourId)) return;
    seen[tourId] = DateTime.now().millisecondsSinceEpoch;
    _cache = seen;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(seen));
    // Uzak senkron arka planda; hata yutulur.
    // ignore: unawaited_futures
    _pushRemoteSeen(seen).catchError((_) {});
  }

  Future<Map<String, dynamic>?> _fetchRemoteSeen() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final baseUrl = ApiConfig.baseUrl;
      if (session == null || baseUrl.isEmpty || session.accessToken.isEmpty) {
        return null;
      }
      final response = await http.get(
        Uri.parse('$baseUrl/api/user-preferences'),
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 8));
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) return null;
      final preferences = decoded['preferences'];
      if (preferences is! Map) return null;
      final seen = preferences[_remoteKey];
      if (seen is! Map) return null;
      return Map<String, dynamic>.from(seen);
    } catch (_) {
      return null;
    }
  }

  Future<void> _pushRemoteSeen(Map<String, dynamic> seen) async {
    final session = await AuthSessionStore.instance.load();
    final baseUrl = ApiConfig.baseUrl;
    if (session == null || baseUrl.isEmpty || session.accessToken.isEmpty) {
      return;
    }
    // Diğer tercihleri ezmemek için önce mevcut tercihler okunur (fetch-merge-put).
    Map<String, dynamic> remote = <String, dynamic>{};
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/user-preferences'),
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 8));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['preferences'] is Map) {
          remote = Map<String, dynamic>.from(decoded['preferences'] as Map);
        }
      }
    } catch (_) {
      // okunamazsa yalnız kendi anahtarımızı yazarız
    }
    final existing = remote[_remoteKey];
    remote[_remoteKey] = {
      if (existing is Map) ...Map<String, dynamic>.from(existing),
      ...seen,
    };
    await http.put(
      Uri.parse('$baseUrl/api/user-preferences'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode(remote),
    ).timeout(const Duration(seconds: 8));
  }

  /// Oturum değişiminde önbelleği sıfırla (yeni kullanıcı kendi durumunu yükler).
  void resetCache() {
    _cache = null;
    _cacheKey = null;
    _remoteMergedKeys.clear();
  }
}
