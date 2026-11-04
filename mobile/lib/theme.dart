import 'dart:math';

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

  final Color navBackground = isDark ? const Color(0xFF0B1628) : Colors.white;

  // Kurum renkleri koyu (lacivert) olabilir ve aksan verilmezse ana renge eşitlenir. Koyu temada
  // lacivert yazı/zemin kaybolur; bu yüzden metin ve dolgu için zemine göre okunur tonlar türetilir.
  final Color accentFill = readableOn(brandAccent, card, min: 2.2);
  final Color onAccent = onColor(accentFill);
  final Color accentText = readableOn(brandAccent, card, min: 3.0);
  final Color secondary = readableOn(brand, card, min: 2.2);
  // Seçili öğe (segment, sekme göstergesi, seçili çip): aksan tonlu zemin + üstünde okunur yazı.
  // ColorScheme'de bunlar verilmezse Flutter "container" renklerini ana renge, yazıyı siyaha
  // düşürüyordu: seçili segmentte koyu zemin üstünde koyu yazı.
  final Color selectionBg = Color.alphaBlend(accentFill.withValues(alpha: isDark ? 0.24 : 0.14), card);
  final Color selectionFg = readableOn(accentText, selectionBg);

  final ColorScheme colorScheme = isDark
      ? ColorScheme.dark(
          primary: accentFill,
          onPrimary: onAccent,
          primaryContainer: selectionBg,
          onPrimaryContainer: selectionFg,
          secondary: secondary,
          onSecondary: onColor(secondary),
          secondaryContainer: selectionBg,
          onSecondaryContainer: selectionFg,
          tertiary: accentFill,
          onTertiary: onAccent,
          surface: card,
          onSurface: text,
          error: const Color(0xFFEF4444),
        )
      : ColorScheme.light(
          primary: accentFill,
          onPrimary: onAccent,
          primaryContainer: selectionBg,
          onPrimaryContainer: selectionFg,
          secondary: secondary,
          onSecondary: onColor(secondary),
          secondaryContainer: selectionBg,
          onSecondaryContainer: selectionFg,
          tertiary: accentFill,
          onTertiary: onAccent,
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
        if (states.contains(WidgetState.selected)) return onAccent;
        return text;
      }),
      dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return accentFill;
        return Colors.transparent;
      }),
      todayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return onAccent;
        return accentText;
      }),
      todayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return accentFill;
        return brandAccent.withValues(alpha: 0.10);
      }),
      todayBorder: BorderSide(color: accentText, width: 1.4),
      yearForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return onAccent;
        return text;
      }),
      yearBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return accentFill;
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
        foregroundColor: accentText,
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
        borderSide: BorderSide(color: accentText, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colorScheme.error),
      ),
    ),

    /// BUTTON
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: accentFill,
        foregroundColor: onAccent,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w900),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accentFill,
        foregroundColor: onAccent,
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
        foregroundColor: accentText,
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
      selectedColor: selectionBg,
      disabledColor: elevated.withValues(alpha: 0.55),
      labelStyle: TextStyle(color: text, fontWeight: FontWeight.w700),
      secondaryLabelStyle: TextStyle(color: selectionFg),
      side: BorderSide(color: divider),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: accentText,
      unselectedLabelColor: muted,
      indicatorColor: accentText,
      labelStyle: const TextStyle(fontWeight: FontWeight.w900),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: accentFill,
      foregroundColor: onAccent,
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

    /// SEGMENTED BUTTON — seçili segment aksan tonlu zemin + okunur yazı (iki temada).
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) =>
            states.contains(WidgetState.selected) ? selectionBg : Colors.transparent),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) return hint;
          return states.contains(WidgetState.selected) ? selectionFg : text;
        }),
        iconColor: WidgetStateProperty.resolveWith((states) =>
            states.contains(WidgetState.selected) ? selectionFg : muted),
        side: WidgetStatePropertyAll(BorderSide(color: divider)),
        textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w800)),
      ),
    ),

    /// NAVIGATION BAR (Material 3 gezinti çubuğu kullanılırsa)
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: navBackground,
      indicatorColor: selectionBg,
      iconTheme: WidgetStateProperty.resolveWith((states) =>
          IconThemeData(color: states.contains(WidgetState.selected) ? selectionFg : muted)),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            color: states.contains(WidgetState.selected) ? readableOn(accentText, navBackground) : muted,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w900 : FontWeight.w700,
          )),
    ),

    /// SEÇİM KUTULARI (Material 2'de varsayılan "secondary" = kurum laciverti, koyu temada görünmüyordu)
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? accentFill : (isDark ? const Color(0xFF94A3B8) : Colors.white)),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? accentFill.withValues(alpha: 0.45) : divider),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? accentFill : Colors.transparent),
      checkColor: WidgetStatePropertyAll(onAccent),
      side: BorderSide(color: muted, width: 1.6),
    ),
    radioTheme: RadioThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? accentFill : muted),
    ),
    listTileTheme: ListTileThemeData(
      selectedColor: selectionFg,
      selectedTileColor: selectionBg,
      iconColor: muted,
      textColor: text,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: accentFill),

    /// BOTTOM NAV
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: navBackground,
      selectedItemColor: readableOn(brandAccent, navBackground),
      unselectedItemColor: muted,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w900),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (max(la, lb) + 0.05) / (min(la, lb) + 0.05);
}

/// Rengi zemine karşı en az [min] kontrastla okunur olana dek açar (koyu zeminde) ya da
/// koyulaştırır (açık zeminde); tonu korur. Kurumun lacivert rengi koyu temada böyle açılır.
Color readableOn(Color color, Color background, {double min = 4.5}) {
  if (_contrast(color, background) >= min) return color;
  final hsl = HSLColor.fromColor(color);
  final darkBackground = background.computeLuminance() < 0.4;
  for (var step = 1; step <= 20; step++) {
    final lightness = darkBackground
        ? hsl.lightness + (1 - hsl.lightness) * step / 20
        : hsl.lightness * (1 - step / 20);
    final candidate = hsl.withLightness(lightness.clamp(0.0, 1.0)).toColor();
    if (_contrast(candidate, background) >= min) return candidate;
  }
  return darkBackground ? Colors.white : const Color(0xFF0F172A);
}

/// Dolgu renginin üstünde okunur yazı rengi (beyaz ya da koyu).
Color onColor(Color background) =>
    _contrast(Colors.white, background) >= _contrast(const Color(0xFF0F172A), background)
        ? Colors.white
        : const Color(0xFF0F172A);

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
