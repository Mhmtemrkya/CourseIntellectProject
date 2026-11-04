import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/pages/optical_exams_page.dart';
import 'package:student/pages/teacher_question_studio_page.dart';
import 'package:student/services/optical_answer_key.dart';
import 'package:student/services/topic_catalog.dart';

final _template = <String, dynamic>{
  'id': 'tpl',
  'name': 'LGS',
  'subjects': [
    {'name': 'Matematik', 'start': 39, 'count': 3},
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
  'level': '',
  'keys': [
    {
      'booklet': 'A',
      'subjects': [
        {'subject': 'Matematik', 'answers': 'ABC', 'topics': <String>[]},
      ],
    },
  ],
};

Map<String, dynamic> _catalog() => {
      'level': 'LGS',
      'levels': <Object>[],
      'subjects': [
        {
          'subject': 'Matematik',
          'groups': [
            {
              'label': 'Sayılar ve İşlemler',
              'topics': ['Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler'],
            },
          ],
          'custom': [
            {'id': 'c1', 'subject': 'Matematik', 'level': 'LGS', 'name': 'Sayı Örüntüleri'},
          ],
          'used': ['Sayı Bulmacaları'],
        },
      ],
    };

class _FakeTopicApi extends TopicCatalogApi {
  _FakeTopicApi();
  final fetches = <(String, List<String>)>[];
  final adds = <(String, String, String)>[];
  final removes = <String>[];

  @override
  Future<Map<String, dynamic>> fetch(String level, List<String> subjects) async {
    fetches.add((level, subjects));
    return _catalog();
  }

  @override
  Future<Map<String, dynamic>> add(String subject, String level, String name) async {
    adds.add((subject, level, name));
    final saved = name == 'sayısal akıl yürütme' ? 'Sayısal Akıl Yürütme' : name;
    return {
      'status': 'created',
      'name': saved,
      'topic': {'id': 'n${adds.length}', 'subject': subject, 'level': level, 'name': saved},
    };
  }

  @override
  Future<void> remove(String id) async => removes.add(id);
}

void main() {
  group('konu listesi', () {
    final options = topicOptions(_catalog()['subjects'][0] as Map<String, dynamic>);

    test('sıra: kurum konuları, hazır liste, daha önce yazılanlar', () {
      expect(options.map((item) => item.name), ['Sayı Örüntüleri', 'Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler', 'Sayı Bulmacaları']);
      expect(options.first.source, TopicSource.custom);
      expect(options.last.group, 'Daha önce yazılmış konular');
    });

    test('Türkçe harf duyarsız süzer ve adı arananla başlayanı öne alır', () {
      expect(topicKey('  ÜSLÜ   İfadeler '), topicKey('uslu ifadeler'));
      expect(filterTopics(options, 'uslu').map((item) => item.name), ['Üslü İfadeler']);
      expect(filterTopics(options, 'ifade').map((item) => item.name), ['Üslü İfadeler', 'Kareköklü İfadeler']);
      expect(filterTopics(options, 'sayi').first.name, 'Sayı Örüntüleri');
      expect(filterTopics(options, 'islemler').length, 3);
    });

    test('yapıştırılan konular listedeki yazıma çevrilir, olmayanlar sayılır', () {
      final aligned = alignTopics(options, ['uslu ifadeler', 'KAREKÖKLÜ İFADELER', 'Bulmaca', ' bulmaca ', '']);
      expect(aligned.values, ['Üslü İfadeler', 'Kareköklü İfadeler', 'Bulmaca', 'bulmaca', '']);
      expect(aligned.unlisted, ['Bulmaca']);
      expect(isUnlistedTopic(options, 'Bulmaca'), isTrue);
      expect(isUnlistedTopic(options, ''), isFalse);
    });

    test('seviye tahmini ve önerilen yanlış götürme', () {
      expect(guessLevel(const [OpticalSubjectBlock('T.C. İnkılap Tarihi ve Atatürkçülük', 10)], 4), 'LGS');
      expect(guessLevel(const [OpticalSubjectBlock('Temel Matematik', 40)], 4), 'TYT');
      expect(guessLevel(const [OpticalSubjectBlock('Felsefe Grubu', 20)], 4), 'AYT');
      expect(guessLevel(const [OpticalSubjectBlock('Matematik', 20)], 3), 'LGS');
      expect(guessLevel(const [OpticalSubjectBlock('Matematik', 20)], 4), '');
      expect(guessLevel(const [OpticalSubjectBlock('Matematik', 20)], 4, 'Okul optik formu (LGS)'), 'LGS');
      expect(guessLevel(const [OpticalSubjectBlock('Matematik', 20)], 4, 'Kurum TYT formu'), 'TYT');
      expect(guessLevel(const [OpticalSubjectBlock('Matematik', 20)], 4, 'Telgsiz form'), '');
      expect(levelPenalty('LGS'), 3);
      expect(levelPenalty('AYT'), 4);
      expect(levelPenalty('6'), isNull);
    });

    test('sınıf adından konu seviyesi', () {
      expect(levelForClass('8-A'), 'LGS');
      expect(levelForClass('6B'), '6');
      expect(levelForClass('10. Sınıf'), 'TYT');
      expect(levelForClass('12-A Sayısal'), 'AYT');
      expect(levelForClass('TYT Hazırlık'), 'TYT');
      expect(levelForClass('Tüm Sınıflar'), '');
    });
  });

  group('düzenleme ekranında konu seçimi', () {
    Future<(_FakeTopicApi, List<(String?, Map<String, Object?>)>)> pump(WidgetTester tester, Map<String, dynamic>? exam) async {
      tester.view.physicalSize = const Size(900, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final api = _FakeTopicApi();
      final calls = <(String?, Map<String, Object?>)>[];
      await tester.pumpWidget(MaterialApp(
        home: OpticalExamEditorPage(exam: exam, templates: [_template], client: (id, body) async => calls.add((id, body)), topicApi: api),
      ));
      await tester.pumpAndSettle();
      return (api, calls);
    }

    Future<void> openPicker(WidgetTester tester, int question) async {
      await tester.tap(find.byKey(ValueKey('topic-pick-A-Matematik-$question')));
      await tester.pumpAndSettle();
    }

    String topicText(WidgetTester tester, int question) =>
        tester.widget<TextField>(find.byKey(ValueKey('topic-A-Matematik-$question'))).controller!.text;

    testWidgets('seviye tahmin edilir, liste o seviyeyle istenir ve kaydedilir', (tester) async {
      final (api, calls) = await pump(tester, _exam);
      expect(api.fetches.single.$1, 'LGS');
      expect(api.fetches.single.$2, ['Matematik']);

      await tester.tap(find.byKey(const ValueKey('optical-level-LGS')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('TYT').last);
      await tester.pumpAndSettle();
      expect(api.fetches.last.$1, 'TYT');

      await tester.tap(find.byKey(const ValueKey('optical-save')));
      await tester.pumpAndSettle();
      expect(calls.single.$2['level'], 'TYT');
      // Mevcut denemede seviye değişince yanlış götürme değişmez.
      expect(calls.single.$2['wrongPenalty'], 3);
    });

    testWidgets('aramalı sayfadan seçilen konu hücreye yazılır', (tester) async {
      final (_, calls) = await pump(tester, _exam);
      await openPicker(tester, 1);
      expect(find.text('Sayılar ve İşlemler'), findsOneWidget);
      expect(find.text('Kurumun eklediği konular'), findsOneWidget);

      await tester.enterText(find.byKey(const ValueKey('topic-search')), 'uslu');
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('topic-option-Üslü İfadeler')), findsOneWidget);
      expect(find.byKey(const ValueKey('topic-option-Kareköklü İfadeler')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('topic-option-Üslü İfadeler')));
      await tester.pumpAndSettle();
      expect(topicText(tester, 1), 'Üslü İfadeler');

      await tester.tap(find.byKey(const ValueKey('optical-save')));
      await tester.pumpAndSettle();
      final subjects = ((calls.single.$2['keys']! as List).first as Map)['subjects'] as List;
      expect((subjects.first as Map)['topics'], ['Üslü İfadeler', '', '']);
    });

    testWidgets('listede olmayan konu yalnız o soruya yazılır ya da listeye eklenir', (tester) async {
      final (api, _) = await pump(tester, _exam);
      await openPicker(tester, 1);
      await tester.enterText(find.byKey(const ValueKey('topic-search')), 'Bulmaca');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('topic-free')));
      await tester.pumpAndSettle();
      expect(topicText(tester, 1), 'Bulmaca');
      expect(find.text('listede yok — yalnız bu soruya yazıldı'), findsOneWidget);
      expect(api.adds, isEmpty);

      await openPicker(tester, 2);
      await tester.enterText(find.byKey(const ValueKey('topic-search')), 'sayısal akıl yürütme');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('topic-add')));
      await tester.pumpAndSettle();
      expect(api.adds.single, ('Matematik', 'LGS', 'sayısal akıl yürütme'));
      expect(topicText(tester, 2), 'Sayısal Akıl Yürütme');

      // Eklenen konu artık listede.
      await openPicker(tester, 3);
      await tester.enterText(find.byKey(const ValueKey('topic-search')), 'akil');
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('topic-option-Sayısal Akıl Yürütme')), findsOneWidget);
    });

    testWidgets('yapıştırılan konular eşleştirilir, listede olmayanlar toplu eklenir', (tester) async {
      final (api, _) = await pump(tester, _exam);
      await tester.tap(find.text('Toplu yapıştır'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Konular (her satır bir soru)'), 'uslu ifadeler\nKAREKÖKLÜ İFADELER\nsayı oyunları');
      await tester.tap(find.text('Konuları yerleştir'));
      await tester.pumpAndSettle();
      expect([topicText(tester, 1), topicText(tester, 2), topicText(tester, 3)], ['Üslü İfadeler', 'Kareköklü İfadeler', 'sayı oyunları']);
      expect(find.textContaining('Listede yok: 1 konu (sayı oyunları)'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('optical-add-unlisted-Matematik')));
      await tester.pumpAndSettle();
      expect(api.adds.single, ('Matematik', 'LGS', 'sayı oyunları'));
      expect(find.byKey(const ValueKey('optical-unlisted-Matematik')), findsNothing);
    });
  });

  group('soru stüdyosunda ders ve konu', () {
    testWidgets('ders listeden, seviye sınıftan; konu aramalı listeden seçilir', (tester) async {
      tester.view.physicalSize = const Size(1600, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final api = _FakeTopicApi();
      await tester.pumpWidget(MaterialApp(home: TeacherQuestionStudioPage(topicApi: api)));
      await tester.pumpAndSettle();
      expect(api.fetches.first.$1, '');
      expect(api.fetches.first.$2, ['Matematik']);

      // Sınıf seçimi seviyeyi belirler (9. sınıf → TYT) ve listeyi yeniden ister.
      await tester.tap(find.text('Tüm Sınıflar').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('9. Sınıf').last);
      await tester.pumpAndSettle();
      expect(api.fetches.last.$1, 'TYT');

      await tester.tap(find.byKey(const ValueKey('studio-topic-pick')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('topic-search')), 'uslu');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('topic-option-Üslü İfadeler')));
      await tester.pumpAndSettle();
      final field = tester.widget<TextField>(find.byKey(const ValueKey('studio-topic')));
      expect(field.controller!.text, 'Üslü İfadeler');

      // Listede olmayan konu yazılınca işaretlenir.
      await tester.enterText(find.byKey(const ValueKey('studio-topic')), 'Bulmaca');
      await tester.pump();
      expect(find.text('listede yok — yalnız bu soruya yazıldı'), findsOneWidget);
    });
  });
}
