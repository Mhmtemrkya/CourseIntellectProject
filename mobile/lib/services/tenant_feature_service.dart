import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

/// Kurum bazlı özellik anahtarları. Platform yöneticisinin kapattığı
/// modüller mobil menü/kısayollardan gizlenir. Bayraklar oturum boyunca
/// önbelleğe alınır; okunamazsa güvenli varsayılan "tümü açık"tır.
class TenantFeatureService {
  TenantFeatureService._();

  static final TenantFeatureService instance = TenantFeatureService._();

  Set<String>? _disabled;
  Future<Set<String>>? _pending;

  Future<Set<String>> disabledFeatures() {
    final cached = _disabled;
    if (cached != null) return Future.value(cached);
    return _pending ??= _load();
  }

  Future<Set<String>> _load() async {
    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) return _disabled = <String>{};

      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/tenant-features/my'),
        headers: {'Authorization': 'Bearer ${session.accessToken}'},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return _disabled = <String>{};
      }

      final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
      final features = map['features'] as List<dynamic>? ?? const [];
      return _disabled = features
          .map((item) => Map<String, dynamic>.from(item as Map))
          .where((item) => item['enabled'] == false)
          .map((item) => item['key'].toString())
          .toSet();
    } catch (_) {
      return _disabled = <String>{};
    } finally {
      _pending = null;
    }
  }

  void reset() {
    _disabled = null;
    _pending = null;
  }
}
