import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class NotificationApiException implements Exception {
  final String message;

  const NotificationApiException(this.message);
}

class AppNotificationRecord {
  final String id;
  final String title;
  final String message;
  final String timeLabel;
  final String audience;
  final String targetRole;
  final String category;
  final bool isRead;

  const AppNotificationRecord({
    required this.id,
    required this.title,
    required this.message,
    required this.timeLabel,
    required this.audience,
    required this.targetRole,
    required this.category,
    required this.isRead,
  });

  factory AppNotificationRecord.fromMap(Map<String, dynamic> map) {
    return AppNotificationRecord(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      message: map['message'] as String? ?? '',
      timeLabel: map['timeLabel'] as String? ?? '',
      audience: map['audience'] as String? ?? '',
      targetRole: map['targetRole'] as String? ?? '',
      category: map['category'] as String? ?? '',
      isRead: map['isRead'] as bool? ?? false,
    );
  }
}

class NotificationApiService {
  NotificationApiService._();

  static final NotificationApiService instance = NotificationApiService._();

  Future<List<AppNotificationRecord>> fetchNotifications({
    String? targetRole,
    String? audience,
  }) async {
    final query = <String>[
      if (targetRole != null && targetRole.isNotEmpty) 'targetRole=$targetRole',
      if (audience != null && audience.isNotEmpty) 'audience=$audience',
    ].join('&');
    final path = query.isEmpty
        ? '/api/notifications'
        : '/api/notifications?$query';
    final response = await _authorizedRequest('GET', path);
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map(
          (item) => AppNotificationRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<void> markAsRead(String id) async {
    await _authorizedRequest('PUT', '/api/notifications/$id/read');
  }

  Future<AppNotificationRecord> createNotification({
    required String title,
    required String message,
    required String timeLabel,
    required String audience,
    required String targetRole,
    required String category,
  }) async {
    final response = await _authorizedRequest(
      'POST',
      '/api/notifications',
      body: {
        'title': title,
        'message': message,
        'timeLabel': timeLabel,
        'audience': audience,
        'targetRole': targetRole,
        'category': category,
      },
    );
    return AppNotificationRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<http.Response> _authorizedRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const NotificationApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yap.',
      );
    }

    final request = http.Request(method, Uri.parse('${ApiConfig.baseUrl}$path'))
      ..headers.addAll({
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      });
    if (body != null) {
      request.body = jsonEncode(body);
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode == 401) {
      throw const NotificationApiException(
        'Oturum süresi dolmuş. Lütfen yeniden giriş yap.',
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationApiException(
        'Bildirimler alınamadı (${response.statusCode}).',
      );
    }

    return response;
  }
}
