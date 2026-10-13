import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/linked_children_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<void> login(String username, {String role = 'Parent'}) =>
      AuthSessionStore.instance.save(
        AuthSession(
          accessToken: 'token-$username',
          refreshToken: 'test-refresh',
          accessTokenExpiresAt: DateTime.utc(2030),
          refreshTokenExpiresAt: DateTime.utc(2030),
          fullName: 'Same Parent Name',
          username: username,
          primaryRole: role,
          extraRoles: const [],
          tenantId: 'tenant-$username',
          tenantName: 'Test',
          tenantSlug: 'test',
          isPlatformAdmin: false,
        ),
      );

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  test(
    'parent switch reloads server-scoped children without name matching',
    () async {
      final authorizations = <String>[];
      await http.runWithClient(
        () async {
          await login('first');
          final first = await LinkedChildrenService.instance
              .loadLinkedChildren();
          expect(first.single.fullName, 'First Child');
          await login('second');
          final second = await LinkedChildrenService.instance
              .loadLinkedChildren();
          expect(second.single.fullName, 'Second Child');
          expect(authorizations, ['Bearer token-first', 'Bearer token-second']);
        },
        () => MockClient((request) async {
          expect(request.url.path, '/api/students');
          final authorization = request.headers['Authorization']!;
          authorizations.add(authorization);
          return http.Response(
            jsonEncode([
              {
                'fullName': authorization.endsWith('first')
                    ? 'First Child'
                    : 'Second Child',
                'className': '9-A',
                'username': 'child',
                'parentName': 'Unrelated Name',
              },
            ]),
            200,
          );
        }),
      );
    },
  );

  test(
    'empty response never falls back to a previously loaded child',
    () async {
      var calls = 0;
      await http.runWithClient(
        () async {
          await login('first');
          expect(
            await LinkedChildrenService.instance.loadLinkedChildren(),
            hasLength(1),
          );
          expect(
            await LinkedChildrenService.instance.loadLinkedChildren(),
            isEmpty,
          );
        },
        () => MockClient(
          (_) async => http.Response(
            calls++ == 0 ? '[{"fullName":"Previous Child"}]' : '[]',
            200,
          ),
        ),
      );
    },
  );

  test('discard response when user changes during the request', () async {
    await login('first');
    await http.runWithClient(
      () async {
        expect(
          await LinkedChildrenService.instance.loadLinkedChildren(),
          isEmpty,
        );
      },
      () => MockClient((_) async {
        await login('second');
        return http.Response('[{"fullName":"First Child"}]', 200);
      }),
    );
  });

  test(
    'logged-out and administrator sessions cannot use the parent selector',
    () async {
      await http.runWithClient(() async {
        expect(
          await LinkedChildrenService.instance.loadLinkedChildren(),
          isEmpty,
        );
        await login('admin', role: 'Admin');
        expect(
          await LinkedChildrenService.instance.loadLinkedChildren(),
          isEmpty,
        );
      }, () => MockClient((_) async => throw StateError('Unexpected request')));
    },
  );
}
