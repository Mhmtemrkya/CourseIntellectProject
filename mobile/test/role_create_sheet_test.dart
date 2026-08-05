import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:student/widgets/role_create_sheet.dart';

/// Mobil rol oluşturma bölmesi.
///
/// Güvenlik garantisi: **yetki matrisi yüklenmeden rol oluşturulamaz.**
/// Katalog yükleniyorken de, yükleme başarısız olduğunda da "Rolü Oluştur"
/// kilitlidir — aksi hâlde kullanıcı hangi sayfaları verdiğini görmeden rol
/// açabilirdi. (Testte oturum yok, servis çağrısı hata verir.)
void main() {
  testWidgets('yetki matrisi yüklenmeden rol oluşturulamaz', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: RoleCreateSheet())),
    );

    // Yükleme sırasında kilitli.
    await tester.pump();
    var button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Rolü Oluştur'),
    );
    expect(button.onPressed, isNull);

    // Yükleme hata ile bittiğinde de kilitli kalır.
    await tester.pump(const Duration(seconds: 2));
    button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Rolü Oluştur'),
    );
    expect(button.onPressed, isNull);
  });
}
