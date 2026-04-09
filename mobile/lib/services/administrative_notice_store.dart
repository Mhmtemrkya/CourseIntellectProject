import 'package:flutter/material.dart';

import 'notification_api_service.dart';

class AdministrativeNoticeRecord {
  final String title;
  final String detail;
  final String date;
  final Color color;
  final String iconKey;

  AdministrativeNoticeRecord({
    required this.title,
    required this.detail,
    required this.date,
    required this.color,
    required this.iconKey,
  });

  IconData get icon => _iconForKey(iconKey);

  factory AdministrativeNoticeRecord.fromMap(Map<String, dynamic> map) {
    return AdministrativeNoticeRecord(
      title: map['title'] as String? ?? '',
      detail: map['detail'] as String? ?? '',
      date: map['date'] as String? ?? '',
      color: Color(map['colorValue'] as int? ?? const Color(0xFF0F766E).toARGB32()),
      iconKey: map['iconKey'] as String? ?? _legacyIconKey(map['iconCodePoint'] as int?),
    );
  }

  Map<String, dynamic> toMap() => {
        'title': title,
        'detail': detail,
        'date': date,
        'colorValue': color.toARGB32(),
        'iconKey': iconKey,
      };

  static String _legacyIconKey(int? codePoint) {
    switch (codePoint) {
      case 0xe86c:
        return 'email';
      case 0xe876:
      default:
        return 'task';
    }
  }

  static IconData _iconForKey(String key) {
    switch (key) {
      case 'email':
        return Icons.mark_email_unread_outlined;
      default:
        return Icons.task_alt_rounded;
    }
  }
}

class AdministrativeNoticeStore extends ChangeNotifier {
  AdministrativeNoticeStore._() : _restoreFuture = Future<void>.value() {
    _restoreFuture = _restore();
  }

  static final AdministrativeNoticeStore instance = AdministrativeNoticeStore._();
  Future<void> _restoreFuture;

  bool isLoaded = false;
  List<AdministrativeNoticeRecord> notices = [];

  Future<void> ensureLoaded() => _restoreFuture;

  Future<void> refresh() async {
    await _restore();
  }

  Future<void> _restore() async {
    final list = await NotificationApiService.instance.fetchNotifications(
      targetRole: 'Administrative',
    );
    notices = list
        .where((item) => item.category == 'AdministrativeNotice' || item.category == 'Administrative')
        .map(
          (item) => AdministrativeNoticeRecord(
            title: item.title,
            detail: item.message,
            date: item.timeLabel,
            color: _colorForCategory(item.category),
            iconKey: _iconKeyForCategory(item.category),
          ),
        )
        .toList();
    isLoaded = true;
    notifyListeners();
  }

  Future<void> addNotice({
    required String title,
    required String detail,
    required String date,
    Color color = const Color(0xFF0F766E),
    IconData icon = Icons.notifications_active_outlined,
  }) async {
    await NotificationApiService.instance.createNotification(
      title: title,
      message: detail,
      timeLabel: date,
      audience: 'Administrative',
      targetRole: 'Administrative',
      category: icon.codePoint == Icons.mark_email_unread_outlined.codePoint
          ? 'AdministrativeEmail'
          : 'AdministrativeNotice',
    );
    await _restore();
  }

  static String _iconKeyForCategory(String category) {
    if (category == 'AdministrativeEmail') {
      return 'email';
    }
    return 'task';
  }

  static Color _colorForCategory(String category) {
    if (category == 'AdministrativeEmail') {
      return const Color(0xFFB45309);
    }
    return const Color(0xFF0F766E);
  }
}
