import 'auth_session_store.dart';
import 'branch_scope_store.dart';
import 'remember_me_store.dart';
import 'session_refresher.dart';
import 'tenant_scope_store.dart';

/// Açılışta nereye gidileceği: kayıtlı oturumla panele ya da giriş ekranına.
class StartRoute {
  const StartRoute.login() : session = null;
  const StartRoute.panel(AuthSession this.session);

  final AuthSession? session;
  bool get opensPanel => session != null;
}

/// "Beni hatırla" kapalıysa önceki çalıştırmanın oturumu silinir. Açıksa
/// oturum yenilenir; sunucuya ulaşılamasa bile access token hâlâ geçerliyse
/// panel açılır (ilk istekte bağlantı hatası görünür, oturum düşmez).
Future<StartRoute> decideStartRoute({
  RememberMeStore? remember,
  AuthSessionStore? store,
  SessionRefresher? refresher,
  DateTime Function()? now,
  Future<void> Function()? resetScopes,
}) async {
  final rememberStore = remember ?? RememberMeStore.instance;
  final sessionStore = store ?? AuthSessionStore.instance;
  if (!await rememberStore.isEnabled()) {
    await sessionStore.clear();
    return const StartRoute.login();
  }

  final result = await (refresher ?? SessionRefresher.instance).ensureFresh();
  final session = result.session;
  switch (result.status) {
    case SessionRefreshStatus.fresh:
      break;
    case SessionRefreshStatus.unavailable:
      final current = (now ?? DateTime.now)().toUtc();
      if (session == null ||
          !session.accessTokenExpiresAt.toUtc().isAfter(current)) {
        return const StartRoute.login();
      }
    case SessionRefreshStatus.missing:
    case SessionRefreshStatus.unauthorized:
      return const StartRoute.login();
  }

  // Taze girişteki gibi ana kurum/şubeden başlanır; önceki çalıştırmadan kalan
  // kurum bağlamı API'leri yanlış kuruma çözmesin (masaüstüyle aynı kural).
  await (resetScopes ?? _resetScopes)();
  return StartRoute.panel(session!);
}

Future<void> _resetScopes() async {
  await TenantScopeStore.instance.clear();
  await BranchScopeStore.instance.clear();
}
