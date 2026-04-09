import 'package:flutter/material.dart';

/// Tek bir brand renginden tam bir tema üretir.
/// Her tenant için farklı primaryColor ile çağrılır.
ThemeData buildDynamicTheme(Color primary, Brightness brightness) {
  final bool isDark = brightness == Brightness.dark;

  final Color scaffold = isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA);
  final Color card = isDark ? const Color(0xFF1E1E1E) : Colors.white;
  final Color text = isDark ? Colors.white : Colors.black;
  final Color hint = Colors.grey;
  final Color divider = isDark ? Colors.grey.shade700 : Colors.grey.shade300;

  final ColorScheme colorScheme = isDark
      ? ColorScheme.dark(primary: primary, surface: card, onSurface: text)
      : ColorScheme.light(primary: primary, surface: card, onSurface: text);

  return ThemeData(
    brightness: brightness,
    useMaterial3: false,
    primaryColor: primary,
    scaffoldBackgroundColor: scaffold,
    canvasColor: scaffold,
    cardColor: card,
    dialogTheme: DialogThemeData(backgroundColor: card),
    dividerColor: divider,
    colorScheme: colorScheme,

    /// APPBAR
    appBarTheme: AppBarTheme(
      backgroundColor: card,
      foregroundColor: text,
      elevation: 0,
    ),

    /// CARD
    cardTheme: CardThemeData(color: card, elevation: 3),

    /// INPUT
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: card,
      labelStyle: TextStyle(color: text),
      hintStyle: TextStyle(color: hint),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: primary),
      ),
    ),

    /// BUTTON
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),

    /// TEXT
    textTheme: TextTheme(
      bodyLarge: TextStyle(color: text),
      bodyMedium: TextStyle(color: text),
      titleMedium: TextStyle(color: text),
    ),

    /// ICON
    iconTheme: IconThemeData(color: text),

    /// BOTTOM NAV
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: card,
      selectedItemColor: primary,
      unselectedItemColor: Colors.grey,
    ),
  );
}

/// Varsayılan sabit temalar (geriye uyumluluk)
final ThemeData lightTheme = buildDynamicTheme(const Color(0xFF00354F), Brightness.light);
final ThemeData darkTheme = buildDynamicTheme(const Color(0xFF00354F), Brightness.dark);
