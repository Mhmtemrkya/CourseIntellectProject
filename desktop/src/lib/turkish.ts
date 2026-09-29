// Türkçe karakter katlamalı normalize — proje genelinde TEK kopya.
// Eşleştirme/karşılaştırma yapan her yer bunu kullanmalı.
export function foldTr(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}
