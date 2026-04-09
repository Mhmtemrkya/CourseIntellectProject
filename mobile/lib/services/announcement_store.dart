import 'package:flutter/material.dart';

import 'school_feed_api_service.dart';

class AnnouncementRecord {
  final String title;
  final String detail;
  final String audience;
  final String date;
  final String iconKey;
  final Color color;

  const AnnouncementRecord({
    required this.title,
    required this.detail,
    required this.audience,
    required this.date,
    required this.iconKey,
    required this.color,
  });

  IconData get icon => _iconDataFromKey(iconKey);

  factory AnnouncementRecord.fromFeedItem(AnnouncementFeedItem item) {
    return AnnouncementRecord(
      title: item.title,
      detail: item.detail,
      audience: item.audience,
      date: item.date,
      iconKey: _iconKeyForAudience(item.audience),
      color: item.color,
    );
  }

  static String _iconKeyForAudience(String audience) {
    final normalized = audience.toLowerCase();
    if (normalized.contains('ogretmen') || normalized.contains('teacher')) {
      return 'teacher';
    }
    if (normalized.contains('veli') || normalized.contains('parent')) {
      return 'parent';
    }
    if (normalized.contains('ogrenci') || normalized.contains('student')) {
      return 'student';
    }
    if (normalized.contains('odeme') || normalized.contains('payment')) {
      return 'payments';
    }
    if (normalized.contains('sinav') || normalized.contains('exam')) {
      return 'exam';
    }
    return 'announcement';
  }

  static IconData _iconDataFromKey(String key) {
    switch (key) {
      case 'teacher':
        return Icons.menu_book_outlined;
      case 'parent':
        return Icons.groups_outlined;
      case 'student':
        return Icons.school_outlined;
      case 'payments':
        return Icons.payments_outlined;
      case 'exam':
        return Icons.fact_check_outlined;
      default:
        return Icons.campaign_outlined;
    }
  }
}

class AnnouncementStore extends ChangeNotifier {
  AnnouncementStore._() : _restoreFuture = Future<void>.value() {
    _restoreFuture = _restore();
  }

  static final AnnouncementStore instance = AnnouncementStore._();

  Future<void> _restoreFuture;
  bool isLoaded = false;
  List<AnnouncementRecord> announcements = [];

  Future<void> ensureLoaded() => _restoreFuture;

  Future<void> refresh({String audience = 'Tüm Kurum'}) async {
    await _restore(audience: audience);
  }

  Future<void> _restore({String audience = 'Tüm Kurum'}) async {
    final items = await SchoolFeedApiService.instance.fetchAnnouncements(audience: audience);
    announcements = items.map(AnnouncementRecord.fromFeedItem).toList();
    isLoaded = true;
    notifyListeners();
  }

  Future<void> addAnnouncement({
    required String title,
    required String detail,
    required String audience,
    String? createdByName,
    String? createdByRole,
    String? createdByUsername,
    String? targetClassName,
    String? targetRecipientType,
    List<String> recipientKeys = const [],
    List<String> recipientLabels = const [],
  }) async {
    await SchoolFeedApiService.instance.createAnnouncement(
      title: title,
      detail: detail,
      audience: audience,
      createdByName: createdByName,
      createdByRole: createdByRole,
      createdByUsername: createdByUsername,
      targetClassName: targetClassName,
      targetRecipientType: targetRecipientType,
      recipientKeys: recipientKeys,
      recipientLabels: recipientLabels,
    );
    await _restore(audience: 'Tüm Kurum');
  }

  List<AnnouncementRecord> announcementsForAudience(String audience) {
    if (audience == 'Tüm Kurum') return List.unmodifiable(announcements);
    return announcements.where((item) {
      return item.audience == 'Tüm Kurum' || item.audience.contains(audience);
    }).toList();
  }
}
