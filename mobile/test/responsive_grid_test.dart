import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/widgets/responsive_layout.dart';

/// Telefon genişliğinde (390 pt), sayfa dolgusu varken kartlar gerçekten
/// istenen sütun sayısında yan yana dizilmeli. Eskiden genişlik ekrandan
/// hesaplandığı için dolgu kadar taşıyor ve her kart ayrı satıra düşüyordu.
void main() {
  Future<List<Offset>> layout(WidgetTester tester, {required int phone}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: ResponsiveGrid(
              phone: phone,
              children: [
                for (var i = 0; i < 6; i++)
                  SizedBox(key: ValueKey(i), height: 40),
              ],
            ),
          ),
        ),
      ),
    );
    return [
      for (var i = 0; i < 6; i++) tester.getTopLeft(find.byKey(ValueKey(i))),
    ];
  }

  testWidgets('telefonda iki sütun: 6 kart 3 satıra dizilir', (tester) async {
    final positions = await layout(tester, phone: 2);
    final rows = positions.map((p) => p.dy).toSet();
    expect(rows.length, 3);
    expect(positions[0].dy, positions[1].dy);
    expect(positions[1].dx, greaterThan(positions[0].dx));
  });

  testWidgets('telefonda üç sütun: 6 kutucuk 2 satıra dizilir', (tester) async {
    final positions = await layout(tester, phone: 3);
    expect(positions.map((p) => p.dy).toSet().length, 2);
    expect(tester.takeException(), isNull);
  });
}
