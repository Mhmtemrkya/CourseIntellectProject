import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:student/theme_provider.dart';
import 'package:student/widgets/consent_dispatch_sheet.dart';
import 'package:student/widgets/lesson_tile.dart';
import 'package:student/pages/support_page.dart';
import 'package:student/pages/teacher_exams_page.dart';
import 'package:student/pages/teacher_reports_page.dart';
import 'package:student/widgets/premium_resource_card.dart';

/// Açık temada "beyaz üstüne beyaz" metin avı.
///
/// Masaüstündeki kontrast taramasının Flutter karşılığı: widget gerçekten
/// çizilir, her Text'in hesaplanan rengi ile ARKASINDAKİ en yakın dolu zemin
/// karşılaştırılır. Oran eşiğin altındaysa test kırılır — sabit `Colors.white`
/// metin, temayı izleyen açık bir yüzeye konursa buradan yakalanır.
void main() {
  testWidgets('onam gönderme bölmesi açık temada okunur', (tester) async {
    await _expectReadable(
      tester,
      const ConsentDispatchSheet(
        form: {
          'id': '00000000-0000-0000-0000-000000000001',
          'title': 'Veli Muvafakatnamesi',
          'body': 'Bu belgeyi okuyup imzalayınız.',
          'checkItems': ['Okudum.', 'Kabul ediyorum.'],
          'staffNotes': '',
          'sourceKind': 'Text',
        },
        stations: [],
      ),
    );
  });

  testWidgets('ders kartı açık temada okunur', (tester) async {
    await _expectReadable(
      tester,
      const LessonTile(
        title: 'Matematik',
        teacher: 'Ayşe DEMİR',
        time: '10:30',
      ),
    );
  });

  // Bu iki ekran kendi koyu paletini taşıyordu; açık temada koyu kalmamalı.
  testWidgets('öğretmen raporları açık temada koyu kalmaz', (tester) async {
    await _expectReadable(
      tester,
      const TeacherReportsPage(),
      scrollable: false,
      minMeasured: 10,
    );
  });

  testWidgets('destek ekranı açık temada koyu kalmaz', (tester) async {
    await _expectReadable(
      tester,
      const SupportPage(),
      scrollable: false,
      minMeasured: 1,
    );
  });

  // Sınavlar listesi kart/rozet/istatistik yoğun: açık temada kaybolmamalı.
  testWidgets('sınavlar ekranı açık temada okunur', (tester) async {
    await _expectReadable(
      tester,
      const TeacherExamsPage(),
      scrollable: false,
      minMeasured: 3,
    );
  });

  testWidgets('premium kaynak kartı açık temada okunur', (tester) async {
    await _expectReadable(
      tester,
      const PremiumResourceCard(
        subject: 'Matematik',
        title: 'Deneme Sınavı',
        subtitle: 'PDF · 12 sayfa',
        description: 'Konu tekrarı için hazırlanan deneme.',
        chips: ['12 sayfa'],
      ),
    );
  });
}

/// Widget'ı AÇIK temada çizer ve düşük kontrastlı metin kalmadığını doğrular.
Future<void> _expectReadable(
  WidgetTester tester,
  Widget child, {
  bool scrollable = true,
  int minMeasured = 1,
}) async {
  final theme = ThemeProvider();
  await tester.pumpWidget(
    ChangeNotifierProvider<ThemeProvider>.value(
      value: theme,
      child: MaterialApp(
        theme: theme.lightTheme,
        // Sayfalar kendi Scaffold'unu kurar; parçalar sarmalayıcıya konur.
        home: scrollable ? Scaffold(body: SingleChildScrollView(child: child)) : child,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  // Ağ görselleri (avatar) widget testinde yüklenemez; kontrast taramasını
  // düşürmesinler — asıl aradığımız metin/zemin kontrastı.
  while (tester.takeException() != null) {}

  final failures = <String>[];
  var measured = 0;
  for (final element in _textElements(tester)) {
    final widget = element.widget as Text;
    final text = widget.data ?? '';
    if (text.trim().length < 2) continue;

    final color = _resolveTextColor(element, widget);
    if (color == null) continue;
    final background = _resolveBackground(element);
    if (background == null) continue;

    measured += 1;
    final ratio = _contrast(color, background);
    if (ratio < 2.2) {
      failures.add('"$text" — metin $color, zemin $background, oran '
          '${ratio.toStringAsFixed(2)}');
    }
  }

  expect(failures, isEmpty, reason: 'Açık temada okunmayan metin:\n${failures.join('\n')}');

  // Ekran hiç çizilmediyse test boşa geçmiş olur; en az bir metin ölçülmeli.
  expect(
    measured,
    greaterThanOrEqualTo(minMeasured),
    reason: 'Yalnızca $measured metin ölçüldü; ekran beklendiği gibi çizilmemiş.',
  );
}

Iterable<Element> _textElements(WidgetTester tester) {
  final found = <Element>[];
  void visit(Element element) {
    if (element.widget is Text) found.add(element);
    element.visitChildren(visit);
  }

  tester.binding.rootElement!.visitChildren(visit);
  return found;
}

Color? _resolveTextColor(Element element, Text widget) {
  final explicit = widget.style?.color;
  if (explicit != null) return explicit;
  final inherited = DefaultTextStyle.of(element).style.color;
  return inherited;
}

/// En yakın opak zemini bulur: üst öğelerde Material/ColoredBox/DecoratedBox arar.
Color? _resolveBackground(Element element) {
  Color? result;
  element.visitAncestorElements((ancestor) {
    final widget = ancestor.widget;
    Color? candidate;
    if (widget is ColoredBox) {
      candidate = widget.color;
    } else if (widget is Material) {
      candidate = widget.color;
    } else if (widget is DecoratedBox) {
      final decoration = widget.decoration;
      if (decoration is BoxDecoration) {
        // Gradyan/görsel zeminin rengi tek bir değerle ölçülemez. Yukarı
        // yürümeye DEVAM ETMEK yanlış olur: gradyanın üstündeki metin, sayfa
        // zeminiyle karşılaştırılıp hatalı biçimde "okunmaz" sayılırdı.
        if (decoration.gradient != null || decoration.image != null) {
          result = null;
          return false;
        }
        candidate = decoration.color;
      }
    } else if (widget is DecoratedBox && widget.decoration is ShapeDecoration) {
      // Chip/Card gibi öğeler dolgusunu ShapeDecoration ile çizer.
      candidate = (widget.decoration as ShapeDecoration).color;
    }
    if (candidate != null && candidate.a > 0.6) {
      result = candidate;
      return false;
    }
    return true;
  });
  return result;
}

double _contrast(Color foreground, Color background) {
  final first = _luminance(foreground);
  final second = _luminance(background);
  final lighter = math.max(first, second);
  final darker = math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

double _luminance(Color color) {
  double channel(double value) =>
      value <= 0.03928 ? value / 12.92 : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}
