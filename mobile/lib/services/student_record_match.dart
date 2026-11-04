/// Öğrenci kaydı (yoklama, sınav sonucu) bu öğrencinin mi? Kimliğe bağlı
/// kayıtta YALNIZ kimlik karşılaştırılır (aynı adlı iki öğrenci karışmaz);
/// kimliği olmayan eski kayıtta ada düşülür.
bool recordBelongsToStudent({
  required String? recordStudentId,
  required String recordStudentName,
  required String studentId,
  required String fullName,
}) {
  final linked = recordStudentId;
  if (linked != null && linked.isNotEmpty) {
    return studentId.isNotEmpty && linked == studentId;
  }
  final key = studentNameKey(recordStudentName);
  return key.isNotEmpty && key == studentNameKey(fullName);
}

/// Ad karşılaştırma anahtarı: harf ve Türkçe karakterden bağımsız.
String studentNameKey(String value) => value
    .trim()
    .replaceAll('İ', 'i')
    .replaceAll('I', 'ı')
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replaceAll(RegExp(r'\s+'), ' ');

const _trMonths = [
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik',
];

/// Kayıt tarih etiketini ("05.11.2026", "2026-11-05", "5 Kasım 2026") tarihe
/// çevirir; çözülemezse null. Etiket metin olarak sıralanınca "05.11.2026" <
/// "28.10.2026" çıkar ve "son sınav" yanlış seçilir.
DateTime? parseRecordDate(String? label) {
  final text = (label ?? '').trim();
  if (text.isEmpty) return null;
  final iso = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})').firstMatch(text);
  if (iso != null) {
    return DateTime(int.parse(iso[1]!), int.parse(iso[2]!), int.parse(iso[3]!));
  }
  final dotted = RegExp(r'^(\d{1,2})[./](\d{1,2})[./](\d{4})').firstMatch(text);
  if (dotted != null) {
    return DateTime(
      int.parse(dotted[3]!),
      int.parse(dotted[2]!),
      int.parse(dotted[1]!),
    );
  }
  final named = RegExp(
    r'(\d{1,2})\s+([a-z]+)\s+(\d{4})',
  ).firstMatch(studentNameKey(text));
  if (named != null) {
    final month = _trMonths.indexOf(named[2]!);
    if (month >= 0) {
      return DateTime(int.parse(named[3]!), month + 1, int.parse(named[1]!));
    }
  }
  return null;
}

/// En yeni kayıt önce (çözülemeyen tarih sona).
int compareRecordDateDesc(String? a, String? b) {
  final left = parseRecordDate(a);
  final right = parseRecordDate(b);
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right.compareTo(left);
}
