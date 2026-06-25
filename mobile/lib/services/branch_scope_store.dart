import 'package:shared_preferences/shared_preferences.dart';

/// Kurum yöneticisinin seçtiği aktif şube. Seçim ilk girişte yapılır ve tüm
/// şubeye-bağlı API çağrılarına `X-Branch-Filter` header'ı olarak eklenir.
/// (Desktop'taki `ci-branch-filter` ile aynı backend mekanizması.)
class BranchScopeStore {
  BranchScopeStore._();

  static const _branchKey = 'course_intellect_branch_filter_v1';
  static const _selectedKey = 'course_intellect_branch_selected_v1';

  static final BranchScopeStore instance = BranchScopeStore._();

  String? _branchId;
  bool _selected = false;
  bool _loaded = false;

  String? get branchId => _branchId;
  bool get isSelected => _selected;

  /// Senkron header erişimi (servisler tarafından kullanılır).
  Map<String, String> get headers =>
      _branchId != null && _branchId!.isNotEmpty ? {'X-Branch-Filter': _branchId!} : const {};

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _branchId = prefs.getString(_branchKey);
    _selected = prefs.getBool(_selectedKey) ?? false;
    _loaded = true;
  }

  Future<void> select(String? branchId) async {
    _branchId = (branchId == null || branchId.isEmpty) ? null : branchId;
    _selected = true;
    _loaded = true;
    final prefs = await SharedPreferences.getInstance();
    if (_branchId == null) {
      await prefs.remove(_branchKey);
    } else {
      await prefs.setString(_branchKey, _branchId!);
    }
    await prefs.setBool(_selectedKey, true);
  }

  Future<void> clear() async {
    _branchId = null;
    _selected = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_branchKey);
    await prefs.remove(_selectedKey);
  }
}
