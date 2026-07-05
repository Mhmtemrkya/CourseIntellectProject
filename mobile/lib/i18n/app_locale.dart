import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'strings_tr_en.dart';

/// Uygulama dili. Flutter'da DOM gözlemcisi olmadığından çeviri, string
/// literallerini saran `.tr` uzantısı ile yapılır: aktif dil global bir
/// ValueNotifier'da tutulur, MaterialApp bu notifier'a bağlı bir key ile
/// yeniden kurulur; böylece dil değişince tüm ağaç yeni dille çizilir.
///
/// EN seçiliyken sözlükte karşılığı olan metin İngilizce'ye çevrilir; olmayan
/// metin Türkçe kalır (bozulma olmaz). Sayısal kalıplar {n} ile korunur.
class AppLocale {
  AppLocale._();

  static const _storageKey = 'app_language';
  static final ValueNotifier<String> language = ValueNotifier<String>('tr');

  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_storageKey);
      if (saved == 'en' || saved == 'tr') {
        language.value = saved!;
      }
    } catch (_) {}
  }

  static Future<void> set(String lang) async {
    if (lang != 'tr' && lang != 'en') return;
    language.value = lang;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, lang);
    } catch (_) {}
  }

  static void toggle() {
    set(language.value == 'tr' ? 'en' : 'tr');
  }

  static bool get isEnglish => language.value == 'en';
}

final _numberPattern = RegExp(r'\d[\d.,:%]*');

/// TR string'i aktif dile çevirir. EN değilse veya karşılığı yoksa aynen döner.
String translate(String source) {
  if (!AppLocale.isEnglish) return source;
  final trimmed = source.trim();
  if (trimmed.isEmpty) return source;
  final direct = kTrEn[trimmed];
  if (direct != null) return source.replaceFirst(trimmed, direct);
  // Sayısal kalıp: "3 kayıt" -> "{n} kayıt"
  if (_numberPattern.hasMatch(trimmed)) {
    final numbers = _numberPattern.allMatches(trimmed).map((m) => m.group(0)!).toList();
    final pattern = trimmed.replaceAll(_numberPattern, '{n}');
    final hit = kTrEn[pattern];
    if (hit != null) {
      var index = 0;
      final restored = hit.replaceAllMapped(RegExp(r'\{n\}'), (_) => index < numbers.length ? numbers[index++] : '');
      return source.replaceFirst(trimmed, restored);
    }
  }
  return source;
}

extension TranslateString on String {
  /// Aktif dile göre çevrilmiş metin.
  String get tr => translate(this);
}
