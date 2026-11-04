import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/pages/optical_template_editor_page.dart';
import 'package:student/services/optical_template_layout.dart';

Map<String, dynamic> _form([Map<String, dynamic> patch = const {}]) => {
      'name': 'Test',
      'encoding': 'windows-1254',
      'studentNoStart': 1,
      'studentNoLength': 10,
      'nameStart': 11,
      'nameLength': 25,
      'classStart': 36,
      'classLength': 4,
      'bookletStart': 40,
      'bookletLength': 1,
      'subjects': [
        {'name': 'Türkçe', 'start': 41, 'count': 5},
      ],
      ...patch,
    };

OpticalLayoutField _field(Map<String, dynamic> form, String id) => opticalLayoutFields(form).firstWhere((field) => field.id == id);

String _row(String no, String name, String cls, String booklet, String answers) =>
    '${no.padRight(10)}${name.padRight(25)}${cls.padRight(4)}$booklet$answers';

void main() {
  group('okuma özeti', () {
    test('bitiş = başlangıç + uzunluk − 1; tek karakter ve kullanılmayan alan', () {
      expect(opticalReadingSummary(_field(_form(), 'studentNo')), 'Her satırın 1–10. karakterleri öğrenci numarası olarak okunacak.');
      expect(opticalReadingSummary(_field(_form(), 'name')), 'Her satırın 11–35. karakterleri ad soyad olarak okunacak.');
      expect(opticalReadingSummary(_field(_form(), 'class')), 'Her satırın 36–39. karakterleri sınıf olarak okunacak.');
      expect(opticalReadingSummary(_field(_form(), 'booklet')), 'Her satırın 40. karakteri kitapçık türü olarak okunacak.');
      expect(opticalReadingSummary(_field(_form({'classLength': 0}), 'class')), 'Bu alan dosyadan okunmayacak.');
    });

    test('çakışan iki alan ve karakterler yazılır', () {
      expect(opticalLayoutProblems(opticalLayoutFields(_form())), isEmpty);
      expect(opticalLayoutProblems(opticalLayoutFields(_form({'nameLength': 27}))), [
        'Ad soyad (11–37. karakterler) ile Sınıf (36–39. karakterler) çakışıyor: 36–37. karakterler iki alana birden ayrılmış.',
      ]);
      expect(opticalLayoutProblems(opticalLayoutFields(_form({'classLength': 0, 'classStart': 20}))), isEmpty);
    });
  });

  group('örnek dosya', () {
    test('Windows-1254 ve UTF-8 Türkçe karakterleri doğru çözülür', () {
      const cp1254 = [0x41, 0x59, 0xDE, 0x45, 0x20, 0xDD, 0xFD, 0xF0, 0xC7, 0xD6, 0xDC];
      expect(decodeOpticalSample(cp1254, 'windows-1254').text, 'AYŞE İığÇÖÜ');
      expect(decodeOpticalSample(cp1254, 'auto').encoding, 'windows-1254');
      final utf = utf8.encode('AYŞE DEMİR');
      expect(decodeOpticalSample(utf, 'auto'), (text: 'AYŞE DEMİR', encoding: 'utf-8'));
    });

    test('satırı okur; boş cevabı eksik karakterden ayırır', () {
      final line = _row('1234', 'AYŞE DEMİR', '10-A', 'B', 'A C E');
      final readings = readOpticalSampleLine(OpticalSampleLine(1, line), opticalLayoutFields(_form()));
      String value(String id) => readings.firstWhere((item) => item.field.id == id).value;
      expect([value('studentNo'), value('name'), value('class'), value('booklet'), value('subject-0')], ['1234', 'AYŞE DEMİR', '10-A', 'B', 'A C E']);
      expect(readings.last.blankQuestions, [2, 4]);
      expect(readings.last.missing, isNull);

      final short = readOpticalSampleLine(OpticalSampleLine(3, line.substring(0, 43)), opticalLayoutFields(_form())).last;
      expect(short.missing, '3. satır 43. karakterde bitiyor; Türkçe alanının 4–5. soruları dosyada yok (boş bırakılmış cevap değil, satır kısa).');
      expect(opticalSampleLines('ilk\r\n\r\n  \r\nson\u001A').map((item) => item.line), [1, 4]);
      expect(opticalRuler(12), (tens: '        10  ', units: '123456789012'));
    });
  });

  group('şablon ekranı', () {
    Future<List<Map<String, dynamic>>> pump(WidgetTester tester, Map<String, dynamic>? template, {List<int>? sample}) async {
      tester.view.physicalSize = const Size(390, 5000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final saved = <Map<String, dynamic>>[];
      await tester.pumpWidget(MaterialApp(
        home: OpticalTemplateEditorPage(
          template: template,
          save: (id, body) async => saved.add({'id': id, ...body}),
          pickSample: () async => sample == null ? null : ('ornek.txt', sample),
        ),
      ));
      await tester.pumpAndSettle();
      return saved;
    }

    String reading(WidgetTester tester, String id) => tester.widget<Text>(find.byKey(ValueKey('reading-$id'))).data ?? '';

    testWidgets('açıklamalar görünür; konum değişince özet güncellenir; çakışmada kaydetmez', (tester) async {
      final saved = await pump(tester, null);
      expect(find.textContaining('Karakter sayımı 1’den başlar; boşluklar da karakter sayılır.'), findsOneWidget);
      expect(find.textContaining('Karakter sayısı, ismin harf sayısı değildir.'), findsOneWidget);
      expect(find.text('Bu değerleri nasıl bulabilirim?'), findsOneWidget);
      expect(find.text('Başlangıç konumu'), findsWidgets);
      expect(find.text('Bilgi satırın kaçıncı karakterinde başlıyor?'), findsWidgets);
      expect(reading(tester, 'booklet'), 'Her satırın 40. karakteri kitapçık türü olarak okunacak.');

      await tester.enterText(find.byType(TextField).first, 'Yeni şablon');
      await tester.enterText(find.byKey(const ValueKey('studentNo-start')), '3');
      await tester.enterText(find.byKey(const ValueKey('studentNo-length')), '6');
      await tester.enterText(find.byKey(const ValueKey('class-length')), '0');
      await tester.pump();
      expect(reading(tester, 'studentNo'), 'Her satırın 3–8. karakterleri öğrenci numarası olarak okunacak.');
      expect(reading(tester, 'class'), 'Bu alan dosyadan okunmayacak.');

      await tester.enterText(find.byKey(const ValueKey('booklet-start')), '20');
      await tester.pump();
      expect(find.textContaining('Ad soyad (11–35. karakterler) ile Kitapçık (20. karakter) çakışıyor'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const ValueKey('optical-template-save'))).onPressed, isNull);

      await tester.enterText(find.byKey(const ValueKey('booklet-start')), '40');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('optical-template-save')));
      await tester.pumpAndSettle();
      expect(saved.single['studentNoStart'], 3);
      expect(saved.single['classLength'], 0);
      expect(saved.single['subjects'], [
        {'name': 'Türkçe', 'start': 41, 'count': 40},
      ]);
    });

    testWidgets('mevcut şablon aynı değerlerle açılır; örnek dosya önizlenir', (tester) async {
      final existing = {..._form(), 'id': 'tpl', 'name': 'Okul formu', 'subjects': [
        {'name': 'Fen', 'start': 41, 'count': 5},
      ]};
      final sample = [
        ...latin1.encode(_row('1001', '', '10-A', 'A', 'AB DE')),
        ...[0x0D, 0x0A],
      ];
      // Ad alanına 1254 kodlu "ŞAHİN" yazılır (Ş=0xDE, İ=0xDD).
      sample.setRange(10, 15, [0xDE, 0x41, 0x48, 0xDD, 0x4E]);
      final saved = await pump(tester, existing, sample: sample);
      expect(find.text('Okul formu'), findsOneWidget);
      expect(find.text('Fen (mevcut kayıt)'), findsOneWidget);
      expect(reading(tester, 'subject-0'), contains('41–45. karakterleri Fen cevapları'));

      await tester.tap(find.byKey(const ValueKey('optical-sample-pick')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('optical-sample-line-1')), findsOneWidget);
      expect(find.textContaining('ŞAHİN'), findsWidgets);
      expect(find.textContaining('(1 soru boş bırakılmış)'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('optical-template-save')));
      await tester.pumpAndSettle();
      expect(saved.single['id'], 'tpl');
      expect((saved.single['subjects'] as List).single, {'name': 'Fen', 'start': 41, 'count': 5});
    });
  });

  group('dosyadan öneri', () {
    Map<String, dynamic> suggestion({int nameLength = 20}) => {
          'supported': true,
          'message': 'Öneri hazır.',
          'encoding': 'utf-8',
          'format': 'fixed',
          'totalLines': 180,
          'sampledLines': 180,
          'fields': [
            {'key': 'studentNo', 'label': 'Öğrenci no', 'start': 21, 'length': 10, 'confidence': 'low', 'reason': 'iki rakam alanı'},
            {'key': 'name', 'label': 'Ad soyad', 'start': 1, 'length': nameLength, 'confidence': 'high', 'reason': 'harf'},
            {'key': 'class', 'label': 'Sınıf', 'start': 1, 'length': 0, 'confidence': 'none', 'reason': 'Algılanamadı / Dosyada bulunmuyor olabilir.'},
            {'key': 'booklet', 'label': 'Kitapçık', 'start': 31, 'length': 1, 'confidence': 'high', 'reason': 'A-D'},
          ],
          'numberCandidates': [
            {'id': 'n1', 'start': 21, 'length': 10, 'constant': false, 'note': 'hepsi farklı'},
            {'id': 'n2', 'start': 140, 'length': 5, 'constant': false, 'note': 'çoğu farklı'},
          ],
          'answerBlocks': [
            {'label': 'Cevap bloğu 1', 'start': 32, 'count': 95, 'confidence': 'medium', 'reason': 'A-E', 'countNeedsConfirmation': true},
          ],
          'booklets': ['A', 'B', 'C', 'D'],
          'flaggedLines': [
            {'line': 1, 'kind': 'header', 'reason': 'Başlık satırı olabilir.'},
          ],
          'warnings': <String>[],
          'confirmations': ['Cevap bloğu 1: gerçek soru sayısını doğrulayın.'],
          'aiStatus': 'disabled',
          'aiNotes': <String>[],
          'manualRecommended': false,
        };

    Future<List<Map<String, dynamic>>> pump(
      WidgetTester tester,
      Map<String, dynamic>? template,
      Future<Map<String, dynamic>> Function(String, List<int>) suggest,
    ) async {
      tester.view.physicalSize = const Size(390, 9000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final saved = <Map<String, dynamic>>[];
      await tester.pumpWidget(MaterialApp(
        home: OpticalTemplateEditorPage(
          template: template,
          save: (id, body) async => saved.add({'id': id, ...body}),
          pickSample: () async => ('ornek.dat', utf8.encode(_row('1234', 'AYŞE DEMİR', '10-A', 'A', 'ABCDE'))),
          suggest: suggest,
        ),
      ));
      await tester.pumpAndSettle();
      return saved;
    }

    String text(WidgetTester tester, String key) => tester.widget<TextField>(find.byKey(ValueKey(key))).controller!.text;

    testWidgets('yeni şablonda öneri forma yerleşir; ders seçilmeden kaydedilmez', (tester) async {
      final saved = await pump(tester, null, (_, _) async => suggestion());
      await tester.tap(find.byKey(const ValueKey('optical-suggest-pick')));
      await tester.pumpAndSettle();

      expect(find.text('Bu özellik dosya düzenini önerir. Cevap anahtarı ve soru konuları ayrıca girilir.'), findsOneWidget);
      expect(find.text('Düşük güven'), findsOneWidget);
      expect(find.text('Algılanamadı'), findsOneWidget);
      expect(find.textContaining('Başlık satırı olabilir.'), findsOneWidget);
      expect([text(tester, 'name-start'), text(tester, 'name-length'), text(tester, 'studentNo-start'), text(tester, 'booklet-start'), text(tester, 'class-length')],
          ['1', '20', '21', '31', '0']);
      expect([text(tester, 'subject-0-start'), text(tester, 'subject-0-length')], ['32', '95']);
      expect(find.text('Cevap bloğu 1 — ders seçin'), findsOneWidget);
      expect(find.byKey(const ValueKey('optical-sample-line-1')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('number-candidate-n2')));
      await tester.pump();
      expect([text(tester, 'studentNo-start'), text(tester, 'studentNo-length')], ['140', '5']);

      await tester.enterText(find.byType(TextField).first, 'İnternet örneği');
      await tester.pump();
      expect(find.textContaining('Cevap bloğu 1 için listeden ders seçin.'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const ValueKey('optical-template-save'))).onPressed, isNull);

      await tester.tap(find.text('Cevap bloğu 1 — ders seçin'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Türkçe').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('optical-template-save')));
      await tester.pumpAndSettle();
      expect(saved.single['nameLength'], 20);
      expect(saved.single['classLength'], 0);
      expect(saved.single['subjects'], [
        {'name': 'Türkçe', 'start': 32, 'count': 95},
      ]);
    });

    testWidgets('düzenlenen şablonda form ancak "Öneriyi uygula" ile değişir; blok bölünür', (tester) async {
      final existing = {..._form(), 'id': 'tpl', 'name': 'Okul formu'};
      await pump(tester, existing, (_, _) async => suggestion());
      await tester.tap(find.byKey(const ValueKey('optical-suggest-pick')));
      await tester.pumpAndSettle();
      expect(text(tester, 'name-length'), '25');
      await tester.tap(find.byKey(const ValueKey('optical-suggest-apply')));
      await tester.pumpAndSettle();
      expect([text(tester, 'name-length'), text(tester, 'subject-0-start')], ['20', '32']);

      await tester.tap(find.byKey(const ValueKey('optical-split-0')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('optical-split-count')), '20');
      await tester.tap(find.text('Böl'));
      await tester.pumpAndSettle();
      expect([text(tester, 'subject-0-length'), text(tester, 'subject-1-start'), text(tester, 'subject-1-length')], ['20', '52', '75']);
    });

    testWidgets('dosya değişince geç gelen eski yanıt forma yazılmaz', (tester) async {
      final pending = Completer<Map<String, dynamic>>();
      await pump(tester, null, (_, _) => pending.future);
      await tester.tap(find.byKey(const ValueKey('optical-suggest-pick')));
      await tester.pump();
      expect(find.text('Dosya inceleniyor…'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('optical-sample-pick')));
      await tester.pumpAndSettle();
      pending.complete(suggestion(nameLength: 18));
      await tester.pumpAndSettle();
      expect(text(tester, 'name-length'), '25');
      expect(find.byKey(const ValueKey('suggested-name')), findsNothing);
    });

    testWidgets('analiz hatası anlaşılır gösterilir, elle giriş açık kalır', (tester) async {
      await pump(tester, null, (_, _) => Future.error(Exception('Sunucuya ulaşılamadı')));
      await tester.tap(find.byKey(const ValueKey('optical-suggest-pick')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Dosya analiz edilemedi'), findsOneWidget);
      expect(find.textContaining('Değerleri elle girebilirsiniz.'), findsOneWidget);
      expect(text(tester, 'name-length'), '25');
    });
  });
}
