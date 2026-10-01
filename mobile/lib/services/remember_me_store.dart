import 'package:shared_preferences/shared_preferences.dart';

/// "Beni hatırla" tercihi ve son kullanıcı adı.
///
/// Açıkken oturum bir sonraki açılışta geri yüklenir ve kullanıcı adı giriş
/// ekranında hazır gelir. Kapalıyken oturum yalnız o çalıştırma boyunca
/// yaşar (servisler token'ı depodan okuduğu için yine kaydedilir) ve sonraki
/// açılışta silinir.
class RememberMeStore {
  RememberMeStore._();

  static final RememberMeStore instance = RememberMeStore._();

  static const _enabledKey = 'ci_remember_me_v1';
  static const _usernameKey = 'ci_remember_username_v1';

  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? true;
  }

  Future<String?> rememberedUsername() async {
    final prefs = await SharedPreferences.getInstance();
    if (!(prefs.getBool(_enabledKey) ?? true)) return null;
    final value = prefs.getString(_usernameKey);
    return value == null || value.isEmpty ? null : value;
  }

  /// Başarılı girişten sonra çağrılır: tercih kaydedilir, açıksa kullanıcı adı
  /// saklanır, kapalıysa önceden saklanan ad da silinir.
  Future<void> saveChoice({
    required bool enabled,
    required String username,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, enabled);
    if (enabled && username.trim().isNotEmpty) {
      await prefs.setString(_usernameKey, username.trim());
    } else {
      await prefs.remove(_usernameKey);
    }
  }
}
