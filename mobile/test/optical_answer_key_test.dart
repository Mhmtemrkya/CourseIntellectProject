import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/pages/optical_exams_page.dart';
import 'package:student/services/optical_answer_key.dart';

const _blocks = [OpticalSubjectBlock('Türkçe', 3), OpticalSubjectBlock('Matematik', 4)];

final _template = <String, dynamic>{
  'id': 'tpl',
  'name': 'LGS',
  'subjects': [
    {'name': 'Türkçe', 'start': 36, 'count': 3},
    {'name': 'Matematik', 'start': 39, 'count': 4},
  ],
};

final _exam = <String, dynamic>{
  'id': 'exam',
  'title': '1. Deneme',
  'examDateUtc': '2026-10-20T09:00:00Z',
  'templateId': 'tpl',
  'wrongPenalty': 3,
  'multiMarkAsWrong': true,
  'cancelledMode': 'exclude',
  'keys': [
    {
      'booklet': 'A',
      'subjects': [
        {'subject': 'Türkçe', 'answers': 'ABC', 'topics': ['Paragraf', 'Paragraf', 'Sözcükte Anlam']},
        {'subject': 'Matematik', 'answers': 'DEX*', 'topics': <String>[]},
      ],
    },
    {
      'booklet': 'B',
      'subjects': [
        {'subject': 'Türkçe', 'answers': 'CBA', 'topics': <String>[]},
        {'subject': 'Matematik', 'answers': 'EDCB', 'topics': <String>[]},
      ],
    },
  ],
};

void main() {
  group('taslak dönüşümü', () {
    test('kayıtlı anahtar soru sırasıyla açılır, kaydedince aynı gövde çıkar', () {
      final drafts = opticalDraftsFrom(_exam['keys'], _blocks);
      expect(drafts.map((item) => item.booklet), ['A', 'B']);
      expect(drafts.first.subjects['Matematik']!.answers, ['D', 'E', 'X', 'X']);
      expect(drafts.first.subjects['Türkçe']!.topics, ['Paragraf', 'Paragraf', 'Sözcükte Anlam']);
      final payload = opticalPayloadKeys(drafts, _blocks);
      expect(payload.first['subjects'], [
        {'subject': 'Türkçe', 'answers': 'ABC', 'topics': ['Paragraf', 'Paragraf', 'Sözcükte Anlam']},
        {'subject': 'Matematik', 'answers': 'DEXX', 'topics': <String>[]},
      ]);
    });

    test('şablon değişince aynı adlı ders korunur', () {
      final drafts = opticalDraftsFrom(_exam['keys'], _blocks);
      final next = refitOpticalDrafts(drafts, const [OpticalSubjectBlock('Matematik', 2), OpticalSubjectBlock('Fen', 2)]);
      expect(next.first.subjects['Matematik']!.answers, ['D', 'E']);
      expect(next.first.subjects['Fen']!.answers, ['', '']);
    });

    test('cevapsız sorular bildirilir', () {
      final drafts = [OpticalKeyDraft.empty('A', _blocks)];
      drafts.first.subjects['Türkçe']!.answers.setAll(0, ['A', '', 'B']);
      expect(missingOpticalAnswers(drafts, _blocks).first, 'A kitapçığı / Türkçe: 1 soru cevapsız (2)');
    });

    test('toplu yapıştırma yerleştiği aralığı ve uyuşmazlığı söyler', () {
      final short = pasteOpticalAnswers(['', '', '', 'E'], '1-A 2-B');
      expect(short.values, ['A', 'B', '', 'E']);
      expect([short.from, short.to], [1, 2]);
      expect(short.warning, contains('3–4. sorular değişmedi'));
      final long = pasteOpticalAnswers(['', ''], 'abcd');
      expect(long.values, ['A', 'B']);
      expect(long.warning, contains('fazla 2 tanesi alınmadı'));
      final invalid = pasteOpticalAnswers(['', ''], 'AF');
      expect(invalid.from, isNull);
      expect(invalid.values, ['', '']);
      expect(pasteOpticalTopics(['', '', ''], 'Kesirler\r\n\nGeometri\n').values, ['Kesirler', '', 'Geometri']);
    });
  });

  group('düzenleme ekranı', () {
    Future<List<(String?, Map<String, Object?>)>> pump(WidgetTester tester, Map<String, dynamic>? exam) async {
      tester.view.physicalSize = const Size(900, 4000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final calls = <(String?, Map<String, Object?>)>[];
      await tester.pumpWidget(MaterialApp(
        home: OpticalExamEditorPage(exam: exam, templates: [_template], client: (id, body) async => calls.add((id, body))),
      ));
      await tester.pumpAndSettle();
      return calls;
    }

    bool isSelected(WidgetTester tester, String booklet, String subject, int question, String answer) {
      final semantics = find.descendant(of: find.byKey(ValueKey('answer-$booklet-$subject-$question-$answer')), matching: find.byType(Semantics));
      return tester.widget<Semantics>(semantics.first).properties.selected ?? false;
    }

    testWidgets('mevcut deneme ders başlıkları ve 1’den başlayan sorularla açılır; kitapçıklar ayrı kalır', (tester) async {
      final calls = await pump(tester, _exam);
      expect(find.text('Türkçe'), findsOneWidget);
      expect(find.text('Matematik'), findsOneWidget);
      expect(find.text('1. Soru'), findsNWidgets(2));
      expect(find.text('4. Soru'), findsOneWidget);
      expect(isSelected(tester, 'A', 'Matematik', 3, 'X'), isTrue);
      expect(find.widgetWithText(TextField, 'Sözcükte Anlam'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('booklet-B')));
      await tester.pumpAndSettle();
      expect(isSelected(tester, 'B', 'Türkçe', 1, 'C'), isTrue);
      await tester.tap(find.byKey(const ValueKey('answer-B-Türkçe-2-E')));
      await tester.enterText(find.byKey(const ValueKey('topic-B-Türkçe-1')), 'Kesirler');
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('booklet-A')));
      await tester.pumpAndSettle();
      expect(isSelected(tester, 'A', 'Türkçe', 2, 'B'), isTrue);
      await tester.tap(find.byKey(const ValueKey('booklet-B')));
      await tester.pumpAndSettle();
      expect(isSelected(tester, 'B', 'Türkçe', 2, 'E'), isTrue);
      expect(find.widgetWithText(TextField, 'Kesirler'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('optical-save')));
      await tester.pumpAndSettle();
      expect(calls.single.$1, 'exam');
      final keys = calls.single.$2['keys']! as List;
      expect((keys[1] as Map)['subjects'], [
        {'subject': 'Türkçe', 'answers': 'CEA', 'topics': ['Kesirler', '', '']},
        {'subject': 'Matematik', 'answers': 'EDCB', 'topics': <String>[]},
      ]);
    });

    testWidgets('yeni denemede eksik cevapla kaydetmez; toplu yapıştırma vurgulanır', (tester) async {
      final calls = await pump(tester, null);
      await tester.enterText(find.byType(TextField).first, 'Yeni Deneme');
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('optical-save')));
      await tester.pumpAndSettle();
      expect(calls, isEmpty);
      expect(find.textContaining('A kitapçığı / Türkçe: 3 soru cevapsız (1, 2, 3)'), findsOneWidget);

      final mathPaste = find.descendant(of: find.byKey(const ValueKey('optical-subject-Matematik')), matching: find.text('Toplu yapıştır'));
      await tester.tap(mathPaste);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Cevaplar (1. sorudan başlayarak sırayla)'), 'ABC');
      await tester.tap(find.text('Cevapları yerleştir'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Cevaplar 1–3. sorulara yerleşti'), findsOneWidget);
      expect(find.textContaining('bu derste 4 soru var'), findsOneWidget);
      final highlighted = tester.widget<Container>(find.byKey(const ValueKey('optical-row-Matematik-3')));
      expect(highlighted.color, isNotNull);
      expect(tester.widget<Container>(find.byKey(const ValueKey('optical-row-Matematik-4'))).color, isNull);

      await tester.tap(mathPaste);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Konular (her satır bir soru)'), 'Kesirler\nDenklemler\nGeometri\nOlasılık');
      await tester.tap(find.text('Konuları yerleştir'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextField, 'Olasılık'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('answer-A-Matematik-4-X')));
      for (final (index, answer) in [(1, 'A'), (2, 'B'), (3, 'C')]) {
        await tester.tap(find.byKey(ValueKey('answer-A-Türkçe-$index-$answer')));
      }
      // İlk denemedeki uyarı çubuğu kapanana kadar bekle (Kaydet'in üstünü örter).
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('optical-problems')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('optical-save')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('optical-problems')), findsNothing);
      expect(calls.single.$1, isNull);
      expect(calls.single.$2['title'], 'Yeni Deneme');
      expect(calls.single.$2['keys'], [
        {
          'booklet': 'A',
          'subjects': [
            {'subject': 'Türkçe', 'answers': 'ABC', 'topics': <String>[]},
            {'subject': 'Matematik', 'answers': 'ABCX', 'topics': ['Kesirler', 'Denklemler', 'Geometri', 'Olasılık']},
          ],
        },
      ]);
    });
  });
}
