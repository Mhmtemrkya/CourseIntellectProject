import 'package:flutter/material.dart';

/// Tek bir brand renginden tam bir tema üretir.
/// Her tenant için farklı primaryColor ile çağrılır.
ThemeData buildDynamicTheme(
  Color primary,
  Brightness brightness, {
  Color? accent,
}) {
  final bool isDark = brightness == Brightness.dark;
  final Color brand = primary;
  final Color brandAccent = accent ?? const Color(0xFFFF7A1A);

  final Color scaffold = isDark
      ? const Color(0xFF08111F)
      : const Color(0xFFF6F8FC);
  final Color card = isDark ? const Color(0xFF0E1A2F) : Colors.white;
  final Color elevated = isDark ? const Color(0xFF12223A) : Colors.white;
  final Color text = isDark ? Colors.white : const Color(0xFF0F172A);
  final Color muted = isDark
      ? Colors.white.withValues(alpha: 0.66)
      : const Color(0xFF64748B);
  final Color hint = isDark
      ? Colors.white.withValues(alpha: 0.48)
      : const Color(0xFF94A3B8);
  final Color divider = isDark
      ? Colors.white.withValues(alpha: 0.10)
      : const Color(0xFFE2E8F0);

  final ColorScheme colorScheme = isDark
      ? ColorScheme.dark(
          primary: brandAccent,
          secondary: brand,
          surface: card,
          onSurface: text,
          error: const Color(0xFFEF4444),
        )
      : ColorScheme.light(
          primary: brandAccent,
          secondary: brand,
          surface: card,
          onSurface: text,
          error: const Color(0xFFDC2626),
        );

  return ThemeData(
    brightness: brightness,
    useMaterial3: false,
    primaryColor: brand,
    scaffoldBackgroundColor: scaffold,
    canvasColor: scaffold,
    cardColor: card,
    dialogTheme: DialogThemeData(
      backgroundColor: card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: brand,
      headerForegroundColor: Colors.white,
      elevation: isDark ? 0 : 12,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      dividerColor: divider,
      dayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return hint;
        if (states.contains(WidgetState.selected)) return Colors.white;
        return text;
      }),
      dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return brandAccent;
        return Colors.transparent;
      }),
      todayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return Colors.white;
        return brandAccent;
      }),
      todayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return brandAccent;
        return brandAccent.withValues(alpha: 0.10);
      }),
      todayBorder: BorderSide(color: brandAccent, width: 1.4),
      yearForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return Colors.white;
        return text;
      }),
      yearBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return brandAccent;
        return Colors.transparent;
      }),
      yearOverlayColor: WidgetStatePropertyAll(
        brandAccent.withValues(alpha: 0.10),
      ),
      cancelButtonStyle: TextButton.styleFrom(
        foregroundColor: muted,
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
      confirmButtonStyle: TextButton.styleFrom(
        foregroundColor: brandAccent,
        textStyle: const TextStyle(fontWeight: FontWeight.w900),
      ),
    ),
    dividerColor: divider,
    colorScheme: colorScheme,
    splashColor: brandAccent.withValues(alpha: 0.10),
    highlightColor: brandAccent.withValues(alpha: 0.06),

    /// APPBAR
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? const Color(0xFF08111F) : Colors.white,
      foregroundColor: text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: text,
        fontSize: 20,
        fontWeight: FontWeight.w900,
      ),
      iconTheme: IconThemeData(color: text),
    ),

    /// CARD
    cardTheme: CardThemeData(
      color: card,
      elevation: isDark ? 0 : 2,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(color: divider),
      ),
      shadowColor: Colors.black.withValues(alpha: isDark ? 0.24 : 0.08),
    ),

    /// INPUT
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: elevated,
      labelStyle: TextStyle(color: muted, fontWeight: FontWeight.w700),
      hintStyle: TextStyle(color: hint),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: brandAccent, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colorScheme.error),
      ),
    ),

    /// BUTTON
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: brandAccent,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w900),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: brandAccent,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w900),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
        side: BorderSide(color: divider),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: brandAccent,
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),

    /// TEXT
    textTheme: TextTheme(
      bodyLarge: TextStyle(color: text),
      bodyMedium: TextStyle(color: text),
      bodySmall: TextStyle(color: muted),
      titleLarge: TextStyle(color: text, fontWeight: FontWeight.w900),
      titleMedium: TextStyle(color: text),
      titleSmall: TextStyle(color: text, fontWeight: FontWeight.w800),
      headlineSmall: TextStyle(color: text, fontWeight: FontWeight.w900),
    ),

    /// ICON
    iconTheme: IconThemeData(color: text),
    chipTheme: ChipThemeData(
      backgroundColor: elevated,
      selectedColor: brandAccent.withValues(alpha: 0.16),
      disabledColor: elevated.withValues(alpha: 0.55),
      labelStyle: TextStyle(color: text, fontWeight: FontWeight.w700),
      secondaryLabelStyle: TextStyle(color: brandAccent),
      side: BorderSide(color: divider),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: brandAccent,
      unselectedLabelColor: muted,
      indicatorColor: brandAccent,
      labelStyle: const TextStyle(fontWeight: FontWeight.w900),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: brandAccent,
      foregroundColor: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: isDark
          ? const Color(0xFF12223A)
          : const Color(0xFF0F172A),
      contentTextStyle: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w700,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),

    /// BOTTOM NAV
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: isDark ? const Color(0xFF0B1628) : Colors.white,
      selectedItemColor: brandAccent,
      unselectedItemColor: muted,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w900),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}

/// Varsayılan sabit temalar (geriye uyumluluk)
final ThemeData lightTheme = buildDynamicTheme(
  const Color(0xFF08111F),
  Brightness.light,
  accent: const Color(0xFFFF7A1A),
);
final ThemeData darkTheme = buildDynamicTheme(
  const Color(0xFF08111F),
  Brightness.dark,
  accent: const Color(0xFFFF7A1A),
);
