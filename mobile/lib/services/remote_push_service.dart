import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class RemotePushService {
  RemotePushService._();

  static final RemotePushService instance = RemotePushService._();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );

      FirebaseMessaging.onMessage.listen((_) {});
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
