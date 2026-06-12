/// Türkçe karakter katlamalı normalize — proje genelinde TEK kopya.
/// Eşleştirme/karşılaştırma yapan her yer bunu kullanmalı.
String normalizeTr(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll('ç', 'c')
      .replaceAll('ğ', 'g')
      .replaceAll('ı', 'i')
      .replaceAll('ö', 'o')
      .replaceAll('ş', 's')
      .replaceAll('ü', 'u');
}
