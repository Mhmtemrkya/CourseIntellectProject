import 'package:flutter/foundation.dart';

/// Asistanın "son bakılan öğrenci" bağlamı (masaüstündeki assistantFocus ile aynı fikir).
/// Öğrenci detayı açan sayfalar [AssistantFocus.set] çağırır; asistan "devamsızlığı nasıl?"
/// sorusunu ad yazılmadan bu öğrenciye yöneltir. Sunucu bunu yalnız ipucu sayar ve yine
/// kullanıcının rol kapsamındaki öğrenciler arasında eşler.
class AssistantFocus {
  AssistantFocus._();

  static final ValueNotifier<({String? id, String name})?> current = ValueNotifier(null);

  static void set({String? id, required String name}) {
    final trimmed = name.trim();
    if (trimmed.isEmpty && (id == null || id.isEmpty)) return;
    current.value = (id: id == null || id.isEmpty ? null : id, name: trimmed);
  }

  static void clear() => current.value = null;
}
