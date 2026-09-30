import 'package:flutter/foundation.dart';

/// Bilinçli olarak yutulan (kullanıcıya gösterilmeyen) hatalar için ortak
/// kaydedici. Boş `catch {}` yerine kullanılır ki hata en azından hata
/// ayıklama çıktısında görünür kalsın.
void logIgnored(String context, Object error) {
  debugPrint('[$context] yok sayılan hata: $error');
}
