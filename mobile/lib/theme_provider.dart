import 'package:flutter/material.dart';
import 'theme.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeProvider()
    : _isDarkMode =
          WidgetsBinding.instance.platformDispatcher.platformBrightness ==
          Brightness.dark,
      _brandPrimary = const Color(0xFF00354F),
      _brandAccent = const Color(0xFFD9790B),
      _tenantLogo = null,
      _tenantName = '';

  bool _isDarkMode;
  Color _brandPrimary;
  Color _brandAccent;
  String? _tenantLogo;
  String _tenantName;

  /// Dark mode açık mı
  bool get isDarkMode => _isDarkMode;

  /// Tenant branding
  Color get brandPrimary => _brandPrimary;
  Color get brandAccent => _brandAccent;
  String? get tenantLogo => _tenantLogo;
  String get tenantName => _tenantName;

  /// MaterialApp için themeMode
  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;

  /// Dinamik tema — brand rengine göre üretilir
  ThemeData get lightTheme =>
      buildDynamicTheme(_brandPrimary, Brightness.light);
  ThemeData get darkTheme => buildDynamicTheme(_brandPrimary, Brightness.dark);

  /// Theme değiştir
  void toggleTheme(bool value) {
    _isDarkMode = value;
    notifyListeners();
  }

  /// Tenant branding'i uygula — renk + logo ile tüm tema değişir
  void applyBranding({
    required Color primaryColor,
    Color? accentColor,
    String? logoUrl,
    String tenantName = '',
  }) {
    _brandPrimary = primaryColor;
    _brandAccent = accentColor ?? primaryColor;
    _tenantLogo = logoUrl;
    _tenantName = tenantName;
    notifyListeners();
  }

  /// Hex string'den Color üret
  static Color colorFromHex(String hex) {
    hex = hex.replaceFirst('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }
}
