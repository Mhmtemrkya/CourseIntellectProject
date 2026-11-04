// Ders konusu listesi: optik cevap anahtarı ve soru stüdyosu (masaüstü topicCatalog.ts ile aynı kurallar).
// Konu analizi konuları adıyla topladığı için aynı konu her kayıtta aynı yazılmalı. Konu dersin hazır
// listesinden, kurumun eklediği konulardan ya da daha önce yazılmış konulardan seçilir; listede olmayan
// konu yine yazılabilir (yalnız o soruya) ya da kurum listesine eklenebilir.

import 'module_api_client.dart';
import 'optical_answer_key.dart';

/// Sunucudaki OpticalTopicCatalog.Levels ile aynı; boş = tüm seviyeler.
const topicLevels = <(String, String)>[
  ('5', '5. sınıf'),
  ('6', '6. sınıf'),
  ('7', '7. sınıf'),
  ('LGS', '8. sınıf (LGS)'),
  ('TYT', 'TYT'),
  ('AYT', 'AYT'),
  ('YDT', 'YDT'),
];

/// Seviye seçilince önerilen yanlış götürme (yalnız yeni denemede uygulanır).
int? levelPenalty(String level) => level == 'LGS' ? 3 : const ['TYT', 'AYT', 'YDT'].contains(level) ? 4 : null;

enum TopicSource { builtin, custom, used }

class TopicOption {
  const TopicOption(this.name, this.group, this.source, [this.id]);
  final String name;
  final String group;
  final TopicSource source;

  /// Kurum konusunun kimliği (listeden kaldırmak için).
  final String? id;
}

/// Arama ve eşleştirme anahtarı: büyük/küçük harf, Türkçe harf ve fazla boşluk farkı yok sayılır.
String topicKey(String text) => text
    .trim()
    .replaceAll(RegExp(r'\s+'), ' ')
    .replaceAll('İ', 'i')
    .replaceAll('I', 'ı')
    .toLowerCase()
    .replaceAll('̇', '')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replaceAll(RegExp('[âà]'), 'a')
    .replaceAll(RegExp('[îì]'), 'i')
    .replaceAll(RegExp('[ûù]'), 'u')
    .replaceAll(RegExp('[’‘`]'), "'");

List<String> _strings(Object? raw) => raw is List ? raw.map((item) => '$item').toList() : const [];

/// Bir dersin sunucudan gelen konuları; seçim listesi sırası: kurumun konuları, hazır liste, daha önce yazılanlar.
List<TopicOption> topicOptions(Map<String, dynamic>? subject) {
  if (subject == null) return const [];
  final seen = <String>{};
  final options = <TopicOption>[];
  void add(TopicOption option) {
    final key = topicKey(option.name);
    if (key.isEmpty || !seen.add(key)) return;
    options.add(option);
  }

  for (final item in (subject['custom'] as List? ?? const []).whereType<Map>()) {
    add(TopicOption('${item['name'] ?? ''}', 'Kurumun eklediği konular', TopicSource.custom, '${item['id'] ?? ''}'));
  }
  for (final group in (subject['groups'] as List? ?? const []).whereType<Map>()) {
    for (final name in _strings(group['topics'])) {
      add(TopicOption(name, '${group['label'] ?? ''}', TopicSource.builtin));
    }
  }
  for (final name in _strings(subject['used'])) {
    add(TopicOption(name, 'Daha önce yazılmış konular', TopicSource.used));
  }
  return options;
}

/// Yazılan metne göre süzer: her kelime konu adında ya da başlıkta geçmeli; adı aranan metinle başlayanlar önde.
List<TopicOption> filterTopics(List<TopicOption> options, String term) {
  final words = topicKey(term).split(' ').where((word) => word.isNotEmpty).toList();
  if (words.isEmpty) return [...options];
  final joined = words.join(' ');
  final scored = <(TopicOption, int, int)>[];
  for (var i = 0; i < options.length; i++) {
    final name = topicKey(options[i].name);
    final haystack = '$name ${topicKey(options[i].group)}';
    if (!words.every(haystack.contains)) continue;
    final rank = name.startsWith(joined) ? 0 : words.every(name.contains) ? 1 : 2;
    scored.add((options[i], rank, i));
  }
  scored.sort((a, b) => a.$2 != b.$2 ? a.$2.compareTo(b.$2) : a.$3.compareTo(b.$3));
  return scored.map((item) => item.$1).toList();
}

/// Metin listedeki bir konuyla (harf farkı gözetmeksizin) aynıysa o seçenek.
TopicOption? matchTopic(List<TopicOption> options, String text) {
  final key = topicKey(text);
  if (key.isEmpty) return null;
  for (final option in options) {
    if (topicKey(option.name) == key) return option;
  }
  return null;
}

bool isUnlistedTopic(List<TopicOption> options, String text) =>
    text.trim().isNotEmpty && matchTopic(options, text) == null;

/// Yapıştırılan konuları listedeki yazıma çevirir; listede olmayanlar yazıldığı gibi kalır ve ayrıca döner.
({List<String> values, List<String> unlisted}) alignTopics(List<TopicOption> options, List<String> topics) {
  final unlisted = <String>[];
  final values = topics.map((topic) {
    final trimmed = topic.trim();
    if (trimmed.isEmpty) return '';
    final match = matchTopic(options, trimmed);
    if (match != null) return match.name;
    if (!unlisted.any((item) => topicKey(item) == topicKey(trimmed))) unlisted.add(trimmed);
    return trimmed;
  }).toList();
  return (values: values, unlisted: unlisted);
}

/// Yeni denemede seviye tahmini: şablon derslerinden, sonra şablon adından ("… (LGS)"), olmazsa yanlış
/// götürmeden (3 = LGS); yoksa boş.
String guessLevel(List<OpticalSubjectBlock> blocks, int penalty, [String templateName = '']) {
  final names = blocks.map((block) => block.name).toSet();
  if (names.contains('Yabancı Dil (YDT)')) return 'YDT';
  if (names.intersection(const {'Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu'}).isNotEmpty) return 'AYT';
  if (names.intersection(const {'Temel Matematik', 'Sosyal Bilimler'}).isNotEmpty) return 'TYT';
  if (names.contains('T.C. İnkılap Tarihi ve Atatürkçülük')) return 'LGS';
  for (final level in const ['LGS', 'TYT', 'AYT', 'YDT']) {
    if (RegExp('\\b$level\\b', caseSensitive: false).hasMatch(templateName)) return level;
  }
  return penalty == 3 ? 'LGS' : '';
}

/// Sınıf adından konu listesi seviyesi (yalnız listeyi daraltır): "8-A" → LGS, "9. Sınıf"/"10" → TYT,
/// "11"/"12" → AYT, 5–7 → o sınıf; adı LGS/TYT/AYT/YDT içeriyorsa o. Anlaşılamazsa boş (tüm seviyeler).
String levelForClass(String className) {
  for (final level in const ['LGS', 'TYT', 'AYT', 'YDT']) {
    if (RegExp('\\b$level\\b', caseSensitive: false).hasMatch(className)) return level;
  }
  final grade = int.tryParse(RegExp(r'(?:^|\D)(\d{1,2})(?!\d)').firstMatch(className)?.group(1) ?? '');
  if (grade == null) return '';
  if (grade >= 5 && grade <= 7) return '$grade';
  if (grade == 8) return 'LGS';
  if (grade == 9 || grade == 10) return 'TYT';
  if (grade == 11 || grade == 12) return 'AYT';
  return '';
}

/// Konu listesi uçları; testlerde sahtesi verilir.
class TopicCatalogApi {
  const TopicCatalogApi();

  Future<Map<String, dynamic>> fetch(String level, List<String> subjects) async {
    final query = [
      if (level.isNotEmpty) 'level=${Uri.encodeQueryComponent(level)}',
      for (final subject in subjects) 'subject=${Uri.encodeQueryComponent(subject)}',
    ].join('&');
    final result = await ModuleApiClient.instance.get('/api/topics?$query');
    return result is Map<String, dynamic> ? result : const {};
  }

  Future<Map<String, dynamic>> add(String subject, String level, String name) async {
    final result = await ModuleApiClient.instance.post('/api/topics', {'subject': subject, 'level': level, 'name': name});
    return result is Map<String, dynamic> ? result : const {};
  }

  Future<void> remove(String id) async => ModuleApiClient.instance.delete('/api/topics/$id');
}
