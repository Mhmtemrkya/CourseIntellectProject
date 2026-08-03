import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:student/theme_provider.dart';
import 'package:student/widgets/adaptive_scaffold.dart';

/// Telefonda alt şerit en fazla 4 sabit sekme + "Daha" gösterir.
///
/// Roller 6-9 hedefe kadar çıkabiliyor; hepsini şeride dizmek etiketleri
/// okunmaz hâle getiriyordu. Bu testler düzen geri alınırsa (şerit yine tüm
/// hedefleri dizerse ya da "Daha" hedefleri açmazsa) kırılır.
void main() {
  List<AdaptiveDestination> destinations(int count) => [
    for (var i = 0; i < count; i++)
      AdaptiveDestination(
        icon: Icons.circle,
        label: 'Hedef $i',
        pageBuilder: (_) => Scaffold(body: Center(child: Text('Sayfa $i'))),
      ),
  ];

  Widget harness(int count) => ChangeNotifierProvider<ThemeProvider>(
    create: (_) => ThemeProvider(),
    child: MaterialApp(
      home: AdaptiveScaffold(
        userRole: 'Test',
        destinations: destinations(count),
      ),
    ),
  );

  // Telefon genişliği: sidebar değil alt şerit çizilsin.
  Future<void> pumpPhone(WidgetTester tester, int count) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(harness(count));
    await tester.pumpAndSettle();
  }

  testWidgets('beş hedef şeride sığar, "Daha" eklenmez', (tester) async {
    await pumpPhone(tester, 5);

    expect(find.text('Hedef 4'), findsOneWidget);
    expect(find.text('Daha'), findsNothing);
  });

  testWidgets('altı hedefte şerit 4 sekme + "Daha" olur', (tester) async {
    await pumpPhone(tester, 6);

    expect(find.text('Hedef 3'), findsOneWidget);
    expect(find.text('Daha'), findsOneWidget);
    // Taşan hedefler şeritte DEĞİL, "Daha" ekranındadır.
    expect(find.text('Hedef 4'), findsNothing);
    expect(find.text('Hedef 5'), findsNothing);
  });

  testWidgets('"Daha" taşan hedefleri listeler ve seçileni açar', (
    tester,
  ) async {
    await pumpPhone(tester, 7);

    await tester.tap(find.text('Daha'));
    await tester.pumpAndSettle();
    expect(find.text('Hedef 4'), findsOneWidget);
    expect(find.text('Hedef 6'), findsOneWidget);

    await tester.tap(find.text('Hedef 6'));
    await tester.pumpAndSettle();
    // Hedefin sayfası açılır; liste kapanır.
    expect(find.text('Sayfa 6'), findsOneWidget);
  });
}
