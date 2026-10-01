import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../pages/change_password_page.dart';
import '../pages/login_page.dart';
import '../theme_provider.dart';
import '../widgets/notification_primer_sheet.dart';
import 'auth_session_store.dart';
import 'branding_service.dart';
import 'live_notification_bridge.dart';
import 'push_navigation.dart';
import 'remote_push_service.dart';
import 'role_router.dart';
import 'session_refresher.dart';

/// Oturum açıldıktan sonra (girişte ya da açılışta geri yüklenince) çalışan
/// ortak rutin. İki yol birebir aynı adımları izlemeli: geri yükleme yolu
/// örneğin PushNavigation.markPanelReady'yi atlasaydı, uygulama kapalıyken
/// dokunulan bildirim hiç açılmazdı.
Future<void> enterSession(BuildContext context, AuthSession session) async {
  final themeProvider = context.read<ThemeProvider>();
  await BrandingService.instance.applyBranding(themeProvider);
  if (!context.mounted) return;
  await NotificationPrimer.showIfFirstTime(context);
  if (!context.mounted) return;
  _openRolePanel(context, session);
  unawaited(SessionRefresher.instance.ensureFresh());
  unawaited(LiveNotificationBridge.instance.startForCurrentSession());
  unawaited(RemotePushService.instance.refreshRegistration());
}

void _openRolePanel(BuildContext context, AuthSession session) {
  // Navigator önceden alınır: pushReplacement çağıran sayfayı kapatır; başarı
  // sonrası o sayfanın context'ine bakılsaydı (eskiden öyleydi) yönlendirme
  // hiç çalışmazdı.
  final navigator = Navigator.of(context);
  if (session.mustChangePassword) {
    navigator.pushReplacement(
      MaterialPageRoute(
        builder: (_) => ChangePasswordPage(
          forceMode: true,
          onSuccess: () async {
            await AuthSessionStore.instance.clear();
            navigator.pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginPage()),
              (_) => false,
            );
          },
        ),
      ),
    );
    return;
  }

  final page = RoleRouter.panelFor(session);
  if (page == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${RoleRouter.displayLabel(session.primaryRole)} rolü için mobil panel bulunamadı.',
        ),
      ),
    );
    return;
  }
  navigator.pushReplacement(MaterialPageRoute(builder: (_) => page));
  // Bekleyen bildirim dokunuşu (uygulama kapalıyken) artık açılabilir.
  PushNavigation.instance.markPanelReady(navigator);
}
