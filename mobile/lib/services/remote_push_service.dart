import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'package:student/utils/log_ignored.dart';

class RemotePushService {
  RemotePushService._();

  static final RemotePushService instance = RemotePushService._();

  static const _androidChannelId = 'course_intellect_general';
  static const _androidChannelName = 'SchoolAsist';
  static const _androidChannelDescription =
      'SchoolAsist servis ve sistem bildirimleri';

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  // Başlatma tek sefer yapılır ve herkes AYNI Future'ı bekler: main() bunu
  // unawaited çağırdığı için refreshRegistration/unregister daha önce
  // koşup "[core/no-app]" ile düşüyordu.
  Future<bool>? _initFuture;

  Future<void> initialize() async {
    await _ensureInitialized();
  }

  Future<bool> _ensureInitialized() {
    return _initFuture ??= _doInitialize().then((ok) {
      // Başarısız başlatma bir sonraki çağrıda yeniden denenebilsin.
      if (!ok) _initFuture = null;
      return ok;
    });
  }

  Future<bool> _doInitialize() async {
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      await _initializeLocalNotifications();
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );

      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
      FirebaseMessaging.instance.onTokenRefresh.listen((token) async {
        try {
          await _registerToken(token);
        } catch (e) { logIgnored('remote_push_service', e); }
      });
    } catch (e) {
      // Firebase yapılandırması yoksa uygulama bozulmaz; yalnız push kapalı kalır.
      logIgnored('remote_push_service', e);
      return false;
    }
    await refreshRegistration();
    return true;
  }

  // iOS'ta FCM token'ı APNs token'ı gelmeden alınamaz ("apns-token-not-set");
  // ilk açılışta APNs birkaç saniye gecikebilir.
  Future<String?> _currentToken() async {
    if (Platform.isIOS) {
      String? apns;
      for (var attempt = 0; attempt < 10 && apns == null; attempt++) {
        apns = await FirebaseMessaging.instance.getAPNSToken();
        if (apns == null) await Future<void>.delayed(const Duration(seconds: 1));
      }
      if (apns == null) {
        logIgnored('remote_push_service', 'APNs token alınamadı');
        return null;
      }
    }
    return FirebaseMessaging.instance.getToken();
  }

  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
      macOS: iosSettings,
    );

    await _localNotifications.initialize(settings);
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _androidChannelId,
        _androidChannelName,
        description: _androidChannelDescription,
        importance: Importance.max,
      ),
    );
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString();
    final body = notification?.body ?? message.data['body']?.toString();
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(0x7fffffff),
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannelId,
          _androidChannelName,
          channelDescription: _androidChannelDescription,
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
        macOS: DarwinNotificationDetails(),
      ),
    );
  }

  Future<void> refreshRegistration() async {
    try {
      if (Firebase.apps.isEmpty && !await _ensureInitialized()) return;
      final token = await _currentToken();
      if (token != null && token.isNotEmpty) {
        await _registerToken(token);
      }
    } catch (e) { logIgnored('remote_push_service', e); }
  }

  Future<void> unregister() async {
    try {
      if (Firebase.apps.isEmpty) return;
      final session = await AuthSessionStore.instance.load();
      final token = await _currentToken();
      if (session == null || token == null || token.isEmpty) return;

      await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/push/unregister'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${session.accessToken}',
        },
        body: jsonEncode({'token': token}),
      );
    } catch (e) { logIgnored('remote_push_service', e); }
  }

  Future<void> _registerToken(String token) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) return;

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/push/register'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'token': token,
        'platform': Platform.isIOS
            ? 'ios'
            : Platform.isAndroid
            ? 'android'
            : 'other',
        'username': session.username,
        'fullName': session.fullName,
        'role': session.primaryRole,
      }),
    );
    if (response.statusCode >= 300) {
      logIgnored('remote_push_service', 'push kaydı reddedildi: HTTP ${response.statusCode}');
    }
  }
}
