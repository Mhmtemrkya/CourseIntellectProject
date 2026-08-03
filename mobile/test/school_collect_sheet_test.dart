import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:student/widgets/school_collect_sheet.dart';

/// Mobil tahsilat penceresi güvenlik davranışı.
///
/// Cari hesap okunamasa bile (testte oturum yok → servis hata verir) pencere
/// KULLANILABİLİR kalır ve **tutar geçerli olmadan tahsilat kaydedilemez**.
/// Bu, "tek dokunuşta para hareketi" hatasının tekrarlamasını engeller.
void main() {
  testWidgets('tutar girilmeden tahsilat kaydedilemez', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SchoolCollectSheet(studentName: 'Ada Yılmaz')),
      ),
    );
    // Yükleme sonlanana kadar birkaç kare (spinner sonsuz döndüğü için
    // pumpAndSettle kullanılamaz).
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('Ada Yılmaz'), findsWidgets);

    final saveButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Tahsilatı Kaydet'),
    );
    expect(saveButton.onPressed, isNull);
  });
}
