/// Soru şıkları için ortak görsel yardımcıları.
///
/// Bazı (özellikle ehliyet) sorularında şıkların değeri düz metin değil bir
/// görsel bağlantısıdır. Değer tek parça bir URL/yol ve görsel uzantısıyla
/// bitiyorsa görsel kabul edilir; aksi halde metindir.
bool isImageOptionValue(String? value) {
  final v = (value ?? '').trim();
  if (v.isEmpty || v.contains(RegExp(r'\s'))) return false;
  return RegExp(
    r'\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?(#.*)?$',
    caseSensitive: false,
  ).hasMatch(v);
}

/// Şıktaki baştaki "A) " / "A." önekini temizler.
String stripOptionPrefix(String? option) =>
    (option ?? '').replaceFirst(RegExp(r'^[A-Fa-f][).]\s*'), '').trim();
