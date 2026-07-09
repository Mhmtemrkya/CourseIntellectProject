import 'package:shared_preferences/shared_preferences.dart';

/// Sahip/MEB tarafından seçilen aktif kurum bağlamı. Şubenin bir üst seviyesi;
/// tüm API çağrılarına `X-Tenant-Context` header'ı olarak eklenir (backend grant'a
/// göre doğrular, yetkisizse 403). Şube değişince değil, KURUM değişince sıfırlanır.
/// (Desktop'taki `ci-tenant-context` ile aynı backend mekanizması.)
class TenantScopeStore {
  TenantScopeStore._();

  static const _tenantKey = 'course_intellect_tenant_context_v1';
  static const _selectedKey = 'course_intellect_tenant_selected_v1';

  static final TenantScopeStore instance = TenantScopeStore._();

  String? _tenantId;
  bool _selected = false;
  bool _loaded = false;

  String? get tenantId => _tenantId;
  bool get isSelected => _selected;

  /// Senkron header erişimi (servisler tarafından kullanılır).
  Map<String, String> get headers =>
      _tenantId != null && _tenantId!.isNotEmpty ? {'X-Tenant-Context': _tenantId!} : const {};

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _tenantId = prefs.getString(_tenantKey);
    _selected = prefs.getBool(_selectedKey) ?? false;
    _loaded = true;
  }

  Future<void> select(String? tenantId) async {
    _tenantId = (tenantId == null || tenantId.isEmpty) ? null : tenantId;
    _selected = true;
    _loaded = true;
    final prefs = await SharedPreferences.getInstance();
    if (_tenantId == null) {
      await prefs.remove(_tenantKey);
    } else {
      await prefs.setString(_tenantKey, _tenantId!);
    }
    await prefs.setBool(_selectedKey, true);
  }

  Future<void> clear() async {
    _tenantId = null;
    _selected = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tenantKey);
    await prefs.remove(_selectedKey);
  }
}
