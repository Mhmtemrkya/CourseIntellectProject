// Optik cevap anahtarı taslağı (masaüstü answerKeyDraft.ts ile aynı kurallar).
// Ekranda her ders için soru başına bir satır (cevap + konu) tutulur. API ise ders başına
// tek cevap dizisi ("ABCX…") ve soru sırasıyla konu listesi bekler; dönüşüm burada yapılır.

/// Anahtarda kullanılabilen cevaplar; X iptal edilen soru. Boş dize = henüz girilmedi.
const opticalAnswerChoices = ['A', 'B', 'C', 'D', 'E', 'X'];

class OpticalSubjectBlock {
  const OpticalSubjectBlock(this.name, this.count);
  final String name;
  final int count;

  static List<OpticalSubjectBlock> listFrom(Object? raw) => raw is List
      ? raw.whereType<Map>().map((item) => OpticalSubjectBlock('${item['name'] ?? ''}', (item['count'] as num?)?.toInt() ?? 0)).toList()
      : const [];
}

class OpticalSubjectDraft {
  OpticalSubjectDraft(this.answers, this.topics);
  final List<String> answers;
  final List<String> topics;

  factory OpticalSubjectDraft.from(int count, String answers, List<String> topics) {
    final letters = answers.replaceAll(RegExp(r'\s'), '').split('').where((item) => item.isNotEmpty).map(normalizeOpticalAnswer).toList();
    return OpticalSubjectDraft(_fit(letters, count), _fit(topics, count));
  }

  OpticalSubjectDraft copy() => OpticalSubjectDraft([...answers], [...topics]);
}

class OpticalKeyDraft {
  OpticalKeyDraft(this.booklet, this.subjects);
  final String booklet;
  final Map<String, OpticalSubjectDraft> subjects;

  factory OpticalKeyDraft.empty(String booklet, List<OpticalSubjectBlock> blocks) =>
      OpticalKeyDraft(booklet, {for (final block in blocks) block.name: OpticalSubjectDraft.from(block.count, '', const [])});
}

/// Sunucu iptal için '*' de kabul eder; ekranda ikisi de X olarak gösterilir.
String normalizeOpticalAnswer(String value) {
  final upper = value.trim().toUpperCase();
  if (upper == '*') return 'X';
  return opticalAnswerChoices.contains(upper) ? upper : '';
}

List<String> _fit(List<String> values, int count) => List.generate(count, (index) => index < values.length ? values[index] : '');

/// Kayıtlı anahtarları taslağa çevirir; anahtar yoksa boş bir A kitapçığı açar.
List<OpticalKeyDraft> opticalDraftsFrom(Object? rawKeys, List<OpticalSubjectBlock> blocks) {
  final keys = rawKeys is List ? rawKeys.whereType<Map>().toList() : const <Map>[];
  if (keys.isEmpty) return [OpticalKeyDraft.empty('A', blocks)];
  return keys.map((key) {
    final subjects = key['subjects'] is List ? (key['subjects'] as List).whereType<Map>().toList() : const <Map>[];
    return OpticalKeyDraft('${key['booklet'] ?? 'A'}', {
      for (final block in blocks)
        block.name: () {
          final existing = subjects.where((item) => item['subject'] == block.name).firstOrNull;
          final topics = existing?['topics'] is List ? (existing!['topics'] as List).map((item) => '${item ?? ''}').toList() : const <String>[];
          return OpticalSubjectDraft.from(block.count, '${existing?['answers'] ?? ''}', topics);
        }(),
    });
  }).toList();
}

/// Şablon değişince aynı adlı derslerin girilen bilgileri korunur; soru sayısına göre kırpılır ya da uzatılır.
List<OpticalKeyDraft> refitOpticalDrafts(List<OpticalKeyDraft> drafts, List<OpticalSubjectBlock> blocks) => drafts
    .map((draft) => OpticalKeyDraft(draft.booklet, {
          for (final block in blocks)
            block.name: OpticalSubjectDraft(
              _fit(draft.subjects[block.name]?.answers ?? const [], block.count),
              _fit(draft.subjects[block.name]?.topics ?? const [], block.count),
            ),
        }))
    .toList();

/// Kaydetmeyi engelleyen eksikler: cevabı girilmemiş sorular (kitapçık / ders / soru no).
List<String> missingOpticalAnswers(List<OpticalKeyDraft> drafts, List<OpticalSubjectBlock> blocks) {
  final problems = <String>[];
  for (final draft in drafts) {
    for (final block in blocks) {
      final answers = draft.subjects[block.name]?.answers ?? const <String>[];
      final empty = [for (var i = 0; i < answers.length; i++) if (answers[i].isEmpty) i + 1];
      if (empty.isEmpty) continue;
      final shown = empty.length > 6 ? '${empty.take(6).join(', ')}…' : empty.join(', ');
      problems.add('${draft.booklet} kitapçığı / ${block.name}: ${empty.length} soru cevapsız ($shown)');
    }
  }
  return problems;
}

/// API gövdesi: cevaplar soru sırasıyla tek dizi; hiç konu girilmemişse boş liste, yoksa her soru için bir satır.
List<Map<String, Object>> opticalPayloadKeys(List<OpticalKeyDraft> drafts, List<OpticalSubjectBlock> blocks) => drafts
    .map((draft) => <String, Object>{
          'booklet': draft.booklet,
          'subjects': blocks.map((block) {
            final value = draft.subjects[block.name] ?? OpticalSubjectDraft.from(block.count, '', const []);
            final topics = _fit(value.topics, block.count).map((topic) => topic.trim()).toList();
            return <String, Object>{
              'subject': block.name,
              'answers': _fit(value.answers, block.count).join(),
              'topics': topics.any((topic) => topic.isNotEmpty) ? topics : <String>[],
            };
          }).toList(),
        })
    .toList();

class OpticalPasteResult {
  const OpticalPasteResult(this.values, this.from, this.to, this.warning);
  final List<String> values;

  /// Yerleşen soru aralığı (1'den başlar); hiçbir şey yerleşmediyse null.
  final int? from;
  final int? to;
  final String? warning;
}

/// Toplu cevap: "ABCDE…", "A B C", "A,B,C" ya da "1-A 2-B" biçimlerini kabul eder; harfler 1. sorudan sırayla yerleşir.
OpticalPasteResult pasteOpticalAnswers(List<String> current, String text) {
  final cleaned = text.toUpperCase().replaceAll(RegExp(r'\d+\s*[-.):]?'), ' ').replaceAll(RegExp(r'[\s,;|/]+'), '');
  final letters = cleaned.split('').where((item) => item.isNotEmpty).toList();
  final invalid = letters.where((letter) => normalizeOpticalAnswer(letter).isEmpty).toSet();
  if (invalid.isNotEmpty) {
    return OpticalPasteResult([...current], null, null,
        'Geçersiz karakter: ${invalid.join(' ')}. Yalnız A, B, C, D, E ve X (iptal) kullanılabilir.');
  }
  return _place(current, letters.map(normalizeOpticalAnswer).toList(), 'cevap');
}

/// Toplu konu: her satır bir soru; boş satır o sorunun konusunu boş bırakır.
OpticalPasteResult pasteOpticalTopics(List<String> current, String text) {
  final lines = text.replaceAll('\r', '').replaceFirst(RegExp(r'\n+$'), '').split('\n').map((line) => line.trim()).toList();
  return _place(current, lines, 'konu satırı');
}

OpticalPasteResult _place(List<String> current, List<String> incoming, String noun) {
  final count = current.length;
  if (incoming.isEmpty || (incoming.length == 1 && incoming.first.isEmpty)) {
    return OpticalPasteResult([...current], null, null, 'Yapıştırılacak veri bulunamadı.');
  }
  final placed = incoming.length < count ? incoming.length : count;
  final values = [for (var i = 0; i < count; i++) i < placed ? incoming[i] : current[i]];
  String? warning;
  if (incoming.length > count) {
    warning = '${incoming.length} $noun yapıştırıldı, bu derste $count soru var; fazla ${incoming.length - count} tanesi alınmadı.';
  } else if (incoming.length < count) {
    warning = '${incoming.length} $noun yapıştırıldı, bu derste $count soru var; ${placed + 1}–$count. sorular değişmedi.';
  }
  return OpticalPasteResult(values, 1, placed, warning);
}
