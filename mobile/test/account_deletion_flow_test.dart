import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:student/pages/account_deletion_page.dart';
import 'package:student/pages/institution_deletion_page.dart';
import 'package:student/pages/driver_route_students_page.dart';
import 'package:student/pages/cafeteria_weekly_menu_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({
      'course_intellect_auth_session_v1': jsonEncode({
        'accessToken': 'test-token', 'refreshToken': 'test-refresh',
        'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
        'refreshTokenExpiresAt': '2030-01-01T00:00:00Z',
        'fullName': 'Test User', 'username': 'test-user', 'primaryRole': 'Student',
        'extraRoles': [], 'tenantId': 'test-tenant',
      }),
    });
  });

  http.Client api() => MockClient((request) async {
    if (request.url.path.endsWith('/mine')) {
      return http.Response(jsonEncode({'status': 'none', 'retainedRecordsExplanation': ['Test açıklama'],
        'impact': {'userCount': 2, 'studentCount': 1, 'fileCount': 3, 'financeRecordCount': 0, 'educationRecordCount': 0}}), 200);
    }
    return http.Response('[]', 200);
  });

  for (final institution in [false, true]) {
    testWidgets('${institution ? 'institution' : 'account'} confirmation before typing enables submit and clearing disables it', (tester) async {
      await http.runWithClient(() async {
        tester.view.physicalSize = const Size(700, 1600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(MaterialApp(home: institution ? const InstitutionDeletionPage() : const AccountDeletionPage()));
        await tester.pumpAndSettle();
        await tester.tap(find.text(institution ? 'Kurum silme talebi oluştur' : 'Hesabımı silmek istiyorum'));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(CheckboxListTile));
        await tester.pumpAndSettle();
        final submit = find.widgetWithText(FilledButton, institution ? 'Talebi gönder' : 'Silme talebini gönder');
        expect(tester.widget<FilledButton>(submit).onPressed, isNull);
        await tester.enterText(find.byType(TextField), 'test-password');
        await tester.pump();
        expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);
        await tester.enterText(find.byType(TextField), '');
        await tester.pump();
        expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      }, api);
    });
  }

  for (final driver in [true, false]) {
    testWidgets('${driver ? 'driver' : 'cafeteria'} can open account deletion', (tester) async {
      await http.runWithClient(() async {
        await tester.pumpWidget(MaterialApp(home: driver ? const DriverRouteStudentsPage(standalone: true) : const CafeteriaWeeklyMenuPage(canEdit: true)));
        await tester.pumpAndSettle();
        expect(find.byTooltip('Hesabımı Sil'), findsOneWidget);
        await tester.tap(find.byTooltip('Hesabımı Sil'));
        await tester.pumpAndSettle();
        expect(find.byType(AccountDeletionPage), findsOneWidget);
      }, api);
    });
  }
}
