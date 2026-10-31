import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:student/pages/assistant_page.dart';
import 'package:student/services/assistant_focus.dart';

/// Asistan sayfası, yerel sunucudan alınmış gerçek yanıtlarla (test/fixtures/assistant) çalıştırılır:
/// brifing, öneri, sınıf listesi → öğrenciye dokunma → özet, konu analizi, geri bildirim ve geçmiş.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  String fixture(String name) => File('test/fixtures/assistant/$name').readAsStringSync();

  late List<http.Request> requests;

  setUp(() {
    requests = [];
    AssistantFocus.clear();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({
      'course_intellect_auth_session_v1': jsonEncode({
        'accessToken': 'test-token', 'refreshToken': 'test-refresh',
        'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
        'refreshTokenExpiresAt': '2030-01-01T00:00:00Z',
        'fullName': 'Hasan Yılmaz', 'username': 'ogrt.hasan', 'primaryRole': 'Teacher',
        'extraRoles': [], 'tenantId': 'test-tenant',
      }),
    });
  });

  http.Client api() => MockClient((request) async {
        requests.add(request);
        final path = request.url.path;
        final body = request.body.isEmpty ? const <String, dynamic>{} : jsonDecode(request.body) as Map<String, dynamic>;
        String json;
        if (path.endsWith('/briefing')) {
          json = fixture('briefing.json');
        } else if (path.endsWith('/suggestions')) {
          json = fixture('suggestions.json');
        } else if (path.endsWith('/assistant/messages')) {
          json = fixture('student_list.json');
        } else if (path.endsWith('/assistant/actions')) {
          json = fixture('${body['command']}'.contains('topics') ? 'topics.json' : 'summary.json');
        } else if (path.endsWith('/feedback')) {
          return http.Response('', 204);
        } else if (path.endsWith('/conversations')) {
          json = fixture('conversations.json');
        } else if (path.endsWith('/messages')) {
          json = fixture('messages.json');
        } else {
          json = '[]';
        }
        return http.Response.bytes(utf8.encode(json), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      });

  Future<void> pumpPage(WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(home: AssistantPage(portal: 'teacher')));
    await tester.pumpAndSettle();
  }

  testWidgets('brifing, liste → öğrenciye dokunma → özet ve konu analizi, geri bildirim', (tester) async {
    await http.runWithClient(() async {
      await pumpPage(tester);
      final briefing = jsonDecode(fixture('briefing.json')) as Map<String, dynamic>;
      expect(find.text(briefing['greeting'] as String), findsOneWidget);
      expect(find.text((briefing['items'] as List).first['text'] as String), findsOneWidget);

      await tester.enterText(find.byType(TextField), '10-A sınıfındaki öğrenciler');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pumpAndSettle();
      final sent = jsonDecode(requests.lastWhere((r) => r.url.path.endsWith('/assistant/messages')).body) as Map<String, dynamic>;
      expect(uuid.hasMatch(sent['clientMessageId'] as String), isTrue, reason: 'sunucu Guid bekler');
      expect((sent['context'] as Map)['portal'], 'teacher');
      expect(find.textContaining('Bu sınıfta 12 öğrenci var'), findsOneWidget);

      final list = jsonDecode(fixture('student_list.json')) as Map<String, dynamic>;
      final second = (list['data']['items'] as List)[1] as Map<String, dynamic>;
      await tester.tap(find.text(second['fullName'] as String).first);
      await tester.pumpAndSettle();
      final action = jsonDecode(requests.lastWhere((r) => r.url.path.endsWith('/assistant/actions')).body) as Map<String, dynamic>;
      expect(action['command'], 'summary');
      expect(action['studentId'], second['studentId']);
      expect(find.textContaining('neye bakayım'), findsOneWidget);

      // Özet kartındaki komut butonu ("Zayıf konular") → konu analizi kartı.
      final topicsButton = find.widgetWithText(OutlinedButton, 'Zayıf konular');
      await tester.ensureVisible(topicsButton);
      await tester.tap(topicsButton);
      await tester.pumpAndSettle();
      expect(find.text('Köklü Sayılar'), findsOneWidget);
      expect(find.text('Yanlışlar ağırlıkta'), findsOneWidget);

      final down = find.byTooltip('İşe yaramadı').last;
      await tester.ensureVisible(down);
      await tester.tap(down);
      await tester.pumpAndSettle();
      final feedback = requests.lastWhere((r) => r.url.path.endsWith('/feedback'));
      expect(jsonDecode(feedback.body), {'helpful': false});
      expect(find.text('Geri bildiriminiz için teşekkürler.'), findsOneWidget);
    }, api);
  });

  testWidgets('son bakılan öğrenci bağlamı isteğe eklenir ve rozet kaldırılabilir', (tester) async {
    await http.runWithClient(() async {
      AssistantFocus.set(id: 'c0ffee00-0000-4000-a000-000000000001', name: 'Ayşe Demir');
      await pumpPage(tester);
      expect(find.textContaining('Ayşe Demir', findRichText: true), findsOneWidget);

      await tester.tap(find.text('Devamsızlığı nasıl?'));
      await tester.pumpAndSettle();
      final context = (jsonDecode(requests.lastWhere((r) => r.url.path.endsWith('/assistant/messages')).body) as Map)['context'] as Map;
      expect(context['selectedStudentId'], 'c0ffee00-0000-4000-a000-000000000001');
      expect(context['selectedStudentName'], 'Ayşe Demir');

      await tester.tap(find.byTooltip('Bağlamı kaldır'));
      await tester.pumpAndSettle();
      expect(AssistantFocus.current.value, isNull);
    }, api);
  });

  testWidgets('öğrenci portalında bağlam gönderilmez', (tester) async {
    await http.runWithClient(() async {
      AssistantFocus.set(name: 'Ayşe Demir');
      tester.view.physicalSize = const Size(800, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const MaterialApp(home: AssistantPage(portal: 'student')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Son bakılan öğrenci'), findsNothing);
      await tester.enterText(find.byType(TextField), 'devamsızlığım');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pumpAndSettle();
      final context = (jsonDecode(requests.lastWhere((r) => r.url.path.endsWith('/assistant/messages')).body) as Map)['context'] as Map;
      expect(context['selectedStudentName'], isNull);
    }, api);
  });

  testWidgets('geçmişten sohbet açılınca kartlar geri gelir', (tester) async {
    await http.runWithClient(() async {
      await pumpPage(tester);
      await tester.tap(find.byTooltip('Önceki sohbetler'));
      await tester.pumpAndSettle();
      final first = (jsonDecode(fixture('conversations.json')) as List).first as Map<String, dynamic>;
      await tester.tap(find.text(first['title'] as String).last);
      await tester.pumpAndSettle();
      expect(requests.any((r) => r.url.path.endsWith('/conversations/${first['id']}/messages')), isTrue);
      expect(find.textContaining('Bu sınıfta 12 öğrenci var'), findsOneWidget);
      expect(find.byType(ListTile), findsWidgets);
    }, api);
  });
}
