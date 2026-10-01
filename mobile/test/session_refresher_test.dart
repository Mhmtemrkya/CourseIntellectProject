import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/remember_me_store.dart';
import 'package:student/services/session_refresher.dart';
import 'package:student/services/start_route.dart';

final _now = DateTime.utc(2026, 10, 1, 12);

AuthSession _session({
  required Duration accessLeft,
  Duration refreshLeft = const Duration(days: 10),
  String refreshToken = 'rt-old',
}) => AuthSession(
  accessToken: 'at-old',
  refreshToken: refreshToken,
  accessTokenExpiresAt: _now.add(accessLeft),
  refreshTokenExpiresAt: _now.add(refreshLeft),
  fullName: 'Kurum Yöneticisi',
  username: 'kurum.admin',
  primaryRole: 'Admin',
  departmentOrBranch: '',
  extraRoles: const [],
  tenantId: 't1',
  tenantName: 'Demo',
  tenantSlug: 'demo',
  isPlatformAdmin: false,
  mustChangePassword: false,
);

class _MemoryStore implements AuthSessionStore {
  _MemoryStore(this.value);
  AuthSession? value;
  int clears = 0;

  @override
  Future<AuthSession?> load() async => value;

  @override
  Future<void> save(AuthSession session) async => value = session;

  @override
  Future<void> clear() async {
    clears++;
    value = null;
  }
}

String _loginBody() => jsonEncode({
  'accessToken': 'at-new',
  'refreshToken': 'rt-new',
  'expiresAtUtc': _now.add(const Duration(hours: 8)).toIso8601String(),
  'refreshTokenExpiresAtUtc': _now
      .add(const Duration(days: 14))
      .toIso8601String(),
  'user': {
    'username': 'kurum.admin',
    'fullName': 'Kurum Yöneticisi',
    'primaryRole': 'Admin',
    'tenantId': 't1',
  },
});

SessionRefresher _refresher(_MemoryStore store, http.Client client) =>
    SessionRefresher(
      store: store,
      client: client,
      now: () => _now,
      baseUrl: () => 'https://api.test',
    );

void main() {
  late SessionRefresher refresher;
  tearDown(() => refresher.dispose());

  test('geçerli token için sunucuya gidilmez', () async {
    var calls = 0;
    final store = _MemoryStore(_session(accessLeft: const Duration(hours: 3)));
    refresher = _refresher(
      store,
      MockClient((_) async {
        calls++;
        return http.Response('', 500);
      }),
    );

    final result = await refresher.ensureFresh();

    expect(result.status, SessionRefreshStatus.fresh);
    expect(result.session?.accessToken, 'at-old');
    expect(calls, 0);
  });

  test(
    'dolmak üzere olan token tek istekle yenilenir (eşzamanlı çağrılar dahil)',
    () async {
      var calls = 0;
      String? sentToken;
      final store = _MemoryStore(
        _session(accessLeft: const Duration(minutes: 1)),
      );
      refresher = _refresher(
        store,
        MockClient((request) async {
          calls++;
          sentToken =
              (jsonDecode(request.body) as Map)['refreshToken'] as String;
          expect(request.url.toString(), 'https://api.test/api/auth/refresh');
          await Future<void>.delayed(const Duration(milliseconds: 20));
          return http.Response(_loginBody(), 200);
        }),
      );

      final results = await Future.wait([
        refresher.ensureFresh(),
        refresher.ensureFresh(),
        refresher.ensureFresh(),
      ]);

      // Rotasyon: ikinci istek iptal edilmiş token'la 401 alırdı.
      expect(calls, 1);
      expect(sentToken, 'rt-old');
      expect(
        results.map((r) => r.session?.accessToken),
        everyElement('at-new'),
      );
      expect(store.value?.refreshToken, 'rt-new');
    },
  );

  test('sunucu 401 dönerse oturum silinir', () async {
    final store = _MemoryStore(_session(accessLeft: Duration.zero));
    refresher = _refresher(
      store,
      MockClient((_) async => http.Response('', 401)),
    );

    final result = await refresher.ensureFresh();

    expect(result.status, SessionRefreshStatus.unauthorized);
    expect(store.value, isNull);
  });

  for (final status in [429, 500, 503]) {
    test('sunucu $status dönerse oturum korunur', () async {
      final store = _MemoryStore(_session(accessLeft: Duration.zero));
      refresher = _refresher(
        store,
        MockClient((_) async => http.Response('', status)),
      );

      final result = await refresher.ensureFresh();

      expect(result.status, SessionRefreshStatus.unavailable);
      expect(store.clears, 0);
      expect(store.value?.refreshToken, 'rt-old');
    });
  }

  test('ağ hatasında oturum korunur', () async {
    final store = _MemoryStore(_session(accessLeft: Duration.zero));
    refresher = _refresher(
      store,
      MockClient((_) async => throw http.ClientException('offline')),
    );

    final result = await refresher.ensureFresh();

    expect(result.status, SessionRefreshStatus.unavailable);
    expect(store.clears, 0);
  });

  test(
    'refresh token süresi dolmuşsa istek atılmadan oturum silinir',
    () async {
      var calls = 0;
      final store = _MemoryStore(
        _session(
          accessLeft: Duration.zero,
          refreshLeft: -const Duration(minutes: 1),
        ),
      );
      refresher = _refresher(
        store,
        MockClient((_) async {
          calls++;
          return http.Response(_loginBody(), 200);
        }),
      );

      final result = await refresher.ensureFresh();

      expect(result.status, SessionRefreshStatus.unauthorized);
      expect(calls, 0);
      expect(store.value, isNull);
    },
  );

  group('açılış kararı', () {
    Future<StartRoute> decide(
      _MemoryStore store,
      http.Client client, {
      required bool remember,
    }) async {
      SharedPreferences.setMockInitialValues({'ci_remember_me_v1': remember});
      refresher = _refresher(store, client);
      return decideStartRoute(
        remember: RememberMeStore.instance,
        store: store,
        refresher: refresher,
        now: () => _now,
        resetScopes: () async {},
      );
    }

    test(
      'hatırla kapalıysa önceki oturum silinir, giriş ekranı açılır',
      () async {
        final store = _MemoryStore(
          _session(accessLeft: const Duration(hours: 3)),
        );
        final route = await decide(
          store,
          MockClient((_) async => http.Response('', 500)),
          remember: false,
        );

        expect(route.opensPanel, isFalse);
        expect(store.value, isNull);
      },
    );

    test(
      'hatırla açıksa süresi dolmuş oturum yenilenip panel açılır',
      () async {
        final store = _MemoryStore(
          _session(accessLeft: -const Duration(hours: 5)),
        );
        final route = await decide(
          store,
          MockClient((_) async => http.Response(_loginBody(), 200)),
          remember: true,
        );

        expect(route.opensPanel, isTrue);
        expect(route.session?.accessToken, 'at-new');
      },
    );

    test('sunucuya ulaşılamazsa geçerli token ile panel açılır', () async {
      final store = _MemoryStore(
        _session(accessLeft: const Duration(minutes: 2)),
      );
      final route = await decide(
        store,
        MockClient((_) async => throw http.ClientException('offline')),
        remember: true,
      );

      expect(route.opensPanel, isTrue);
      expect(store.value, isNotNull);
    });

    test(
      'sunucuya ulaşılamaz ve token dolmuşsa giriş ekranı, oturum silinmez',
      () async {
        final store = _MemoryStore(
          _session(accessLeft: -const Duration(minutes: 1)),
        );
        final route = await decide(
          store,
          MockClient((_) async => throw http.ClientException('offline')),
          remember: true,
        );

        expect(route.opensPanel, isFalse);
        expect(store.value, isNotNull);
      },
    );

    test('kayıtlı oturum yoksa giriş ekranı', () async {
      final route = await decide(
        _MemoryStore(null),
        MockClient((_) async => http.Response('', 500)),
        remember: true,
      );
      expect(route.opensPanel, isFalse);
    });
  });

  test('kullanıcı adı yalnız hatırla açıkken saklanır', () async {
    SharedPreferences.setMockInitialValues({});
    refresher = _refresher(
      _MemoryStore(null),
      MockClient((_) async => http.Response('', 500)),
    );
    final store = RememberMeStore.instance;

    await store.saveChoice(enabled: true, username: ' kurum.admin ');
    expect(await store.rememberedUsername(), 'kurum.admin');

    await store.saveChoice(enabled: false, username: 'kurum.admin');
    expect(await store.isEnabled(), isFalse);
    expect(await store.rememberedUsername(), isNull);
  });
}
