import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'auth_session_store.dart';

enum SessionRefreshStatus {
  /// Geçerli (gerekirse yenilenmiş) oturum var.
  fresh,

  /// Kayıtlı oturum yok.
  missing,

  /// Sunucu refresh token'ı reddetti (iptal, süre, pasif hesap, kapalı kurum).
  /// Oturum silindi; yeniden giriş gerekir.
  unauthorized,

  /// Sunucuya ulaşılamadı, hız sınırı ya da sunucu hatası. Oturum SİLİNMEZ;
  /// token eskiyse de bir sonraki denemede yenilenebilir.
  unavailable,
}

class SessionRefreshResult {
  const SessionRefreshResult(this.status, [this.session]);

  final SessionRefreshStatus status;
  final AuthSession? session;
}

/// Access token'ı süresi dolmadan yeniler.
///
/// Backend her yenilemede eski refresh token'ı iptal eder (rotasyon). Aynı
/// anda iki yenileme giderse ikincisi iptal edilmiş token'la 401 alır ve
/// oturum düşer; bu yüzden tüm çağıranlar tek bir uçuştaki isteği paylaşır.
/// Mobil servisler token'ı her istekte depodan okur; yenilenmiş oturum depoya
/// yazıldığı an hepsi yeni token'ı kullanır.
class SessionRefresher with WidgetsBindingObserver {
  SessionRefresher({
    AuthSessionStore? store,
    http.Client? client,
    DateTime Function()? now,
    String Function()? baseUrl,
  }) : _store = store ?? AuthSessionStore.instance,
       _client = client,
       _now = now ?? DateTime.now,
       _baseUrl = baseUrl ?? (() => ApiConfig.baseUrl);

  static final SessionRefresher instance = SessionRefresher();

  /// Access token bu kadar süre içinde dolacaksa önceden yenilenir.
  static const refreshSkew = Duration(minutes: 5);

  final AuthSessionStore _store;
  final http.Client? _client;
  final DateTime Function() _now;
  final String Function() _baseUrl;

  Future<SessionRefreshResult>? _inFlight;
  Timer? _timer;
  bool _observing = false;

  /// Uygulama açılışında bir kez: öne dönüşte ve zamanlayıcıyla yeniler.
  void start() {
    if (_observing) return;
    _observing = true;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Arka planda zamanlayıcılar donar; öne dönünce ilk iş token'ı tazele.
    if (state == AppLifecycleState.resumed) unawaited(ensureFresh());
  }

  /// Geçerli oturumu döndürür; access token dolmak üzereyse önce yeniler.
  Future<SessionRefreshResult> ensureFresh({bool force = false}) {
    final pending = _inFlight;
    if (pending != null) return pending;
    final future = _ensureFresh(force: force);
    _inFlight = future;
    return future.whenComplete(() => _inFlight = null);
  }

  Future<SessionRefreshResult> _ensureFresh({required bool force}) async {
    final session = await _store.load();
    if (session == null) {
      _timer?.cancel();
      return const SessionRefreshResult(SessionRefreshStatus.missing);
    }
    final now = _now().toUtc();
    if (!force &&
        session.accessTokenExpiresAt.toUtc().isAfter(now.add(refreshSkew))) {
      _schedule(session);
      return SessionRefreshResult(SessionRefreshStatus.fresh, session);
    }
    if (!session.refreshTokenExpiresAt.toUtc().isAfter(now)) {
      await _store.clear();
      _timer?.cancel();
      return const SessionRefreshResult(SessionRefreshStatus.unauthorized);
    }

    final http.Response response;
    try {
      final uri = Uri.parse('${_baseUrl()}/api/auth/refresh');
      final body = jsonEncode({'refreshToken': session.refreshToken});
      const headers = {'Content-Type': 'application/json'};
      final client = _client;
      response =
          await (client != null
                  ? client.post(uri, headers: headers, body: body)
                  : http.post(uri, headers: headers, body: body))
              .timeout(const Duration(seconds: 15));
    } catch (_) {
      // Ağ yok / zaman aşımı: oturum korunur, sonraki fırsatta yeniden denenir.
      return SessionRefreshResult(SessionRefreshStatus.unavailable, session);
    }

    if (response.statusCode == 401) {
      await _store.clear();
      _timer?.cancel();
      return const SessionRefreshResult(SessionRefreshStatus.unauthorized);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // 429 (giriş ile ortak hız sınırı) ve 5xx geçicidir; oturum silinmez.
      return SessionRefreshResult(SessionRefreshStatus.unavailable, session);
    }

    final AuthSession refreshed;
    try {
      refreshed = AuthApiService.instance.parseLoginResponse(response.body);
    } catch (_) {
      return SessionRefreshResult(SessionRefreshStatus.unavailable, session);
    }
    // Eski refresh token sunucuda artık iptal: yenisi, uçuş çözülmeden önce
    // depoya yazılmalı ki bekleyen çağıranlar eskisini kullanmasın.
    await _store.save(refreshed);
    _schedule(refreshed);
    return SessionRefreshResult(SessionRefreshStatus.fresh, refreshed);
  }

  void _schedule(AuthSession session) {
    _timer?.cancel();
    var delay =
        session.accessTokenExpiresAt.toUtc().difference(_now().toUtc()) -
        refreshSkew;
    if (delay.isNegative) delay = Duration.zero;
    _timer = Timer(delay, () => unawaited(ensureFresh()));
  }

  @visibleForTesting
  void dispose() {
    _timer?.cancel();
    if (_observing) WidgetsBinding.instance.removeObserver(this);
    _observing = false;
  }
}
