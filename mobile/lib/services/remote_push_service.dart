import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class RemotePushService {
  RemotePushService._();

  static final RemotePushService instance = RemotePushService._();

  static const _androidChannelId = 'course_intellect_general';
  static const _androidChannelName = 'SchoolAsist';
  static const _androidChannelDescription =
      'SchoolAsist servis ve sistem bildirimleri';

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
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
        await _registerToken(token);
      });

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await _registerToken(token);
      }

      _initialized = true;
    } catch (_) {
      // Firebase config dosyalari yoksa uygulamayi bozma.
    }
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
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await _registerToken(token);
      }
    } catch (_) {}
  }

  Future<void> unregister() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final token = await FirebaseMessaging.instance.getToken();
      if (session == null || token == null || token.isEmpty) return;

      await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/push/unregister'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${session.accessToken}',
        },
        body: jsonEncode({'token': token}),
      );
    } catch (_) {}
  }

  Future<void> _registerToken(String token) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) return;

    await http.post(
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
  }
}
