import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/widgets/card_system.dart';
import 'package:student/widgets/school_card.dart';

void main() {
  test('titles retain financial and academic meaning', () {
    expect(cardToneFor('Tahsilat'), CardTone.emerald);
    expect(cardToneFor('Geciken Tutar'), CardTone.rose);
    expect(cardToneFor('Geciken Kayıt'), CardTone.amber);
    expect(cardToneFor('Ders Programı'), CardTone.blue);
    expect(cardToneFor('Ödevler'), CardTone.violet);
    expect(cardToneFor('Yoklama'), CardTone.cyan);
  });

  for (final brightness in Brightness.values) {
    testWidgets('narrow cards support scaled text and taps in $brightness', (tester) async {
      var taps = 0;
      await tester.pumpWidget(MaterialApp(
        theme: ThemeData(brightness: brightness),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(320, 800), textScaler: TextScaler.linear(1.6)),
          child: Scaffold(body: SingleChildScrollView(child: SizedBox(width: 320,
            child: Wrap(spacing: 12, runSpacing: 12, children: [
              for (final tone in CardTone.values) SizedBox(width: 154, child: VividMetricCard(
                title: 'Bekleyen kurum başvuruları', value: '14.750.000 TL', caption: '2 kayıt · Takip gerekli',
                tone: tone, icon: Icons.payments_rounded, onTap: () => taps++,
              )),
            ]),
          ))),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(VividMetricCard).first);
      expect(taps, 1);
    });
  }

  testWidgets('content-card form fields remain editable', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SchoolCard(
      title: 'Kayıt İşlemleri', child: Padding(padding: const EdgeInsets.all(16),
        child: TextField(controller: controller)),
    ))));
    await tester.enterText(find.byType(TextField), 'Demo 1');
    expect(controller.text, 'Demo 1');
    expect(tester.takeException(), isNull);
  });
}
