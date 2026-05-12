import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_session_store.dart';
import 'content_api_service.dart';
import 'homework_api_service.dart';
import 'meeting_request_api_service.dart';
import 'message_api_service.dart';
import 'notification_api_service.dart';
import 'notification_preferences_service.dart';
import 'planned_exam_api_service.dart';
import 'school_feed_api_service.dart';
import 'teacher_weekly_report_api_service.dart';

class LiveNotificationBridge {
  LiveNotificationBridge._();

  static final LiveNotificationBridge instance = LiveNotificationBridge._();

  static const _seenPrefix = 'course_intellect_seen_live_notifications_v1';
  static const _historyPrefix = 'course_intellect_live_notification_history_v1';
  static const _androidChannelId = 'course_intellect_live_updates';
  static const _androidChannelName = 'Canlı Bildirimler';
  static const _androidChannelDescription =
      'Yeni duyuru ve bildirimler için anlık uyarılar';
  static const _repeatCooldown = Duration(seconds: 75);

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  Timer? _timer;
  Timer? _initialTimer;
  String? _activeSessionKey;
  bool _initialized = false;
  bool _bootstrapped = false;
  bool _checking = false;
  Duration _pollInterval = const Duration(seconds: 45);

  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const windowsSettings = WindowsInitializationSettings(
      appName: 'CourseIntellect',
      appUserModelId: 'com.courseintellect.student',
      guid: 'd3b0a5e2-7c1f-4b8e-9a6d-2f5e8c3b1a04',
    );
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
      macOS: iosSettings,
      windows: windowsSettings,
    );

    await _plugin.initialize(settings);

    final androidPlugin = _plugin
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

    _initialized = true;
  }

  Future<void> startForCurrentSession() async {
    await initialize();
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      await stop();
      return;
    }

    final sessionKey = '${session.primaryRole}:${session.username}';
    if (_activeSessionKey != sessionKey) {
      _activeSessionKey = sessionKey;
      _bootstrapped = false;
    }

    _pollInterval = _resolvePollInterval(session.primaryRole);
    _initialTimer?.cancel();
    _timer?.cancel();
    _initialTimer = Timer(const Duration(seconds: 8), () {
      _checkNow();
    });
    _timer = Timer.periodic(_pollInterval, (_) => _checkNow());
  }

  Future<void> stop() async {
    _initialTimer?.cancel();
    _initialTimer = null;
    _timer?.cancel();
    _timer = null;
    _activeSessionKey = null;
    _bootstrapped = false;
  }

  Future<void> checkNow() => _checkNow();

  Future<void> _checkNow() async {
    if (_checking) return;
    _checking = true;
    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) {
        await stop();
        return;
      }

      final seenKey = '$_seenPrefix:${session.primaryRole}:${session.username}';
      final prefs = await SharedPreferences.getInstance();
      final seen = prefs.getStringList(seenKey)?.toSet() ?? <String>{};
      final notificationPreferences = await NotificationPreferencesService
          .instance
          .load(session);
      final incoming = (await _loadIncoming(session))
          .where(
            (item) => notificationPreferences.isCategoryEnabled(item.category),
          )
          .map(
            (item) => notificationPreferences.previewEnabled
                ? item
                : item.copyWith(body: 'Detayları görmek için uygulamayı açın.'),
          )
          .toList();

      final currentIds = incoming.map((item) => item.id).toSet();
      if (!_bootstrapped) {
        await prefs.setStringList(seenKey, currentIds.toList());
        _bootstrapped = true;
        return;
      }

      final unseen = incoming.where((item) => !seen.contains(item.id)).toList();
      for (final item in unseen) {
        if (!await _shouldDeliver(session, item, prefs)) {
          continue;
        }

        final playSound = !notificationPreferences.isCategorySilent(
          item.category,
        );

        await _plugin.show(
          item.id.hashCode & 0x7fffffff,
          item.title,
          item.body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _androidChannelId,
              _androidChannelName,
              channelDescription: _androidChannelDescription,
              importance: Importance.max,
              priority: Priority.high,
              playSound: playSound,
            ),
            iOS: DarwinNotificationDetails(
              presentAlert: true,
              presentBadge: true,
              presentSound: playSound,
            ),
          ),
        );
        await _rememberDelivery(session, item, prefs);
      }

      await prefs.setStringList(seenKey, currentIds.toList());
    } catch (error) {
      debugPrint('LiveNotificationBridge error: $error');
    } finally {
      _checking = false;
    }
  }

  Future<List<_LiveNotificationItem>> _loadIncoming(AuthSession session) async {
    switch (session.primaryRole) {
      case 'Parent':
        return _dedupe([
          ...await _loadVisibleAnnouncements('Veli'),
          ...await _loadParentExamResults(session),
          ...await _loadParentPlannedExams(session),
          ...await _loadParentWeeklyReports(session),
          ...await _loadParentMeetingUpdates(session),
          ...await _loadUnreadMessageNotifications(),
        ]);
      case 'Student':
        return _dedupe([
          ...await _mapRoleNotifications('Student'),
          ...await _loadVisibleAnnouncements('Öğrenci'),
          ...await _loadUnreadMessageNotifications(),
          ...await _loadStudentHomework(),
          ...await _loadStudentContents(),
          ...await _loadStudentPlannedExams(session),
          ...await _loadStudentExamResults(session),
        ]);
      case 'Teacher':
        return _dedupe([
          ...await _mapRoleNotifications('Teacher'),
          ...await _loadVisibleAnnouncements('Teacher'),
          ...await _loadUnreadMessageNotifications(),
          ...await _loadTeacherHomework(),
          ...await _loadTeacherPlannedExams(session),
          ...await _loadTeacherReports(session),
          ...await _loadTeacherMeetingRequests(session),
        ]);
      case 'Accounting':
        return _dedupe([
          ...await _mapRoleNotifications('Accounting'),
          ...await _loadVisibleAnnouncements('Accounting'),
          ...await _loadUnreadMessageNotifications(),
        ]);
      case 'Administrative':
        return _dedupe([
          ...await _mapRoleNotifications('Administrative'),
          ...await _loadVisibleAnnouncements('Administrative'),
          ...await _loadUnreadMessageNotifications(),
        ]);
      case 'Admin':
        return _dedupe([
          ...await _mapRoleNotifications('Admin'),
          ...await _loadVisibleAnnouncements('Admin'),
          ...await _loadUnreadMessageNotifications(),
        ]);
      default:
        return const [];
    }
  }

  Future<List<_LiveNotificationItem>> _mapRoleNotifications(
    String targetRole,
  ) async {
    return _mapNotifications(
      await NotificationApiService.instance.fetchNotifications(
        targetRole: targetRole,
      ),
    );
  }

  Future<List<_LiveNotificationItem>> _loadAnnouncementsForAudience(
    String audience, {
    bool includeAll = false,
  }) async {
    final announcements = await SchoolFeedApiService.instance
        .fetchAnnouncements(audience: audience, includeAll: includeAll);
    return announcements
        .map(
          (item) => _LiveNotificationItem(
            id: 'announcement:${item.id}',
            title: 'Yeni duyuru',
            body: _compactBody(item.title, item.summaryDetail),
            category: 'announcement',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadVisibleAnnouncements(
    String audience,
  ) {
    return _loadAnnouncementsForAudience(audience, includeAll: true);
  }

  Future<List<_LiveNotificationItem>> _loadUnreadMessageNotifications() async {
    final threads = await MessageApiService.instance.fetchThreads();
    return threads
        .where((item) => item.unreadCount > 0 && !item.lastMessageFromMe)
        .map(
          (item) => _LiveNotificationItem(
            id: 'thread:${item.id}:${item.lastMessageAt.toIso8601String()}',
            title: '${item.contactName} size mesaj gönderdi',
            body: item.lastMessagePreview.isEmpty
                ? 'Yeni mesajınızı görmek için uygulamayı açın.'
                : _trim(item.lastMessagePreview),
            category: 'message',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadStudentHomework() async {
    final assignments = await HomeworkApiService.instance.fetchAssignments();
    return assignments
        .where(
          (item) => (item['status']?.toString() ?? '').trim() != 'Tamamlandi',
        )
        .map(
          (item) => _LiveNotificationItem(
            id: 'homework:${item['id']}',
            title: 'Yeni ödev yayınlandı',
            body: _compactBody(
              item['title']?.toString() ?? 'Yeni ödev',
              '${item['subject'] ?? 'Ödev'} • Teslim: ${item['deadline'] ?? '-'}',
            ),
            category: 'homework',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadTeacherHomework() async {
    final assignments = await HomeworkApiService.instance.fetchAssignments();
    return assignments
        .map(
          (item) => _LiveNotificationItem(
            id: 'teacher-homework:${item['id']}',
            title: 'Ödev güncellemesi',
            body: _compactBody(
              item['title']?.toString() ?? 'Ödev',
              '${item['className'] ?? '-'} • ${item['subject'] ?? 'Ödev'} • ${item['deadline'] ?? '-'}',
            ),
            category: 'homework',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadStudentContents() async {
    final contents = await ContentApiService.instance.fetchContents(
      visibleOnly: true,
    );
    return contents
        .map(
          (item) => _LiveNotificationItem(
            id: 'content:${item.id ?? item.title}',
            title: 'Yeni içerik yayınlandı',
            body: _compactBody(
              item.title.isNotEmpty ? item.title : 'Yeni içerik',
              '${item.subject} • ${item.teacher} • ${item.fileType}',
            ),
            category: 'content',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadStudentPlannedExams(
    AuthSession session,
  ) async {
    final className = await SchoolFeedApiService.resolveLinkedStudentClassName(
      session,
    );
    final exams = await PlannedExamApiService.instance.fetchPlannedExams(
      className: className,
      studentName: session.fullName,
      studentUsername: session.username,
    );
    return exams
        .map(
          (item) => _LiveNotificationItem(
            id: 'planned-exam:${item.id}',
            title: 'Yeni sınav planlandı',
            body: _compactBody(
              item.title,
              '${item.subject} • ${item.date} • ${item.duration}',
            ),
            category: 'planned-exam',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadTeacherPlannedExams(
    AuthSession session,
  ) async {
    final exams = await PlannedExamApiService.instance.fetchPlannedExams(
      teacherName: session.fullName,
    );
    return exams
        .map(
          (item) => _LiveNotificationItem(
            id: 'teacher-exam:${item.id}',
            title: 'Sınav takvimi güncellendi',
            body: _compactBody(
              item.title,
              '${item.className} • ${item.subject} • ${item.date}',
            ),
            category: 'planned-exam',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadParentPlannedExams(
    AuthSession session,
  ) async {
    final className = await SchoolFeedApiService.resolveLinkedStudentClassName(
      session,
    );
    final studentName = await SchoolFeedApiService.resolveLinkedStudentName(
      session,
    );
    final exams = await PlannedExamApiService.instance.fetchPlannedExams(
      className: className,
      studentName: studentName,
    );
    return exams
        .map(
          (item) => _LiveNotificationItem(
            id: 'parent-planned-exam:${item.id}',
            title: 'Çocuğunuz için yeni sınav planlandı',
            body: _compactBody(
              item.title,
              '${item.subject} • ${item.date} • ${item.className}',
            ),
            category: 'planned-exam',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadStudentExamResults(
    AuthSession session,
  ) async {
    final studentName = await SchoolFeedApiService.resolveLinkedStudentName(
      session,
    );
    final results = await SchoolFeedApiService.instance.fetchExamResults(
      studentName: studentName,
    );
    return results
        .map(
          (item) => _LiveNotificationItem(
            id: 'exam-result:${item.examTitle}:${item.date}:${item.subject}',
            title: '${item.examTitle} sonucu açıklandı',
            body: _trim(
              '${item.subject} • Puan: ${item.score} • Net: ${item.net}',
            ),
            category: 'exam-result',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadParentExamResults(
    AuthSession session,
  ) async {
    final studentName = await SchoolFeedApiService.resolveLinkedStudentName(
      session,
    );
    final results = await SchoolFeedApiService.instance.fetchExamResults(
      studentName: studentName,
    );
    return results
        .map(
          (item) => _LiveNotificationItem(
            id: 'parent-exam-result:${item.examTitle}:${item.date}:${item.subject}',
            title: '${item.examTitle} sonucu yayınlandı',
            body: _trim(
              '${item.subject} • ${item.studentName} • Puan: ${item.score}',
            ),
            category: 'exam-result',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadParentWeeklyReports(
    AuthSession session,
  ) async {
    final studentName = await SchoolFeedApiService.resolveLinkedStudentName(
      session,
    );
    final reports = await TeacherWeeklyReportApiService.instance.fetchForParent(
      studentName: studentName,
      studentUsername: session.primaryRole == 'Student'
          ? session.username
          : null,
      parentName: session.fullName,
    );
    return reports
        .map(
          (item) => _LiveNotificationItem(
            id: 'weekly-report:${item.id}',
            title: 'Yeni haftalık rapor gönderildi',
            body: _compactBody(
              item.title.isEmpty ? 'Haftalık rapor' : item.title,
              '${item.subject} • ${item.studentName} • ${item.weeklyPeriodLabel}',
            ),
            category: 'report',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadTeacherReports(
    AuthSession session,
  ) async {
    final reports = await TeacherWeeklyReportApiService.instance
        .fetchForTeacher(
          teacherUsername: session.username,
          teacherName: session.fullName,
        );
    return reports
        .map(
          (item) => _LiveNotificationItem(
            id: 'teacher-report:${item.id}',
            title: 'Haftalık rapor kaydı güncellendi',
            body: _compactBody(
              item.title.isEmpty ? 'Haftalık rapor' : item.title,
              '${item.studentName} • ${item.subject} • ${item.weeklyPeriodLabel}',
            ),
            category: 'report',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadTeacherMeetingRequests(
    AuthSession session,
  ) async {
    final requests = await MeetingRequestApiService.instance.fetchRequests(
      advisor: session.fullName,
    );
    return requests
        .map(
          (item) => _LiveNotificationItem(
            id: 'teacher-meeting:${item.id}:${item.status}',
            title: 'Yeni görüşme talebi',
            body: _trim(
              '${item.parentName} • ${item.studentName} • ${item.slot}',
            ),
            category: 'meeting',
          ),
        )
        .toList();
  }

  Future<List<_LiveNotificationItem>> _loadParentMeetingUpdates(
    AuthSession session,
  ) async {
    final requests = await MeetingRequestApiService.instance.fetchRequests(
      parentName: session.fullName,
    );
    return requests
        .map(
          (item) => _LiveNotificationItem(
            id: 'parent-meeting:${item.id}:${item.status}',
            title: 'Görüşme durumu güncellendi',
            body: _trim('${item.advisor} • ${item.slot} • ${item.status}'),
            category: 'meeting',
          ),
        )
        .toList();
  }

  List<_LiveNotificationItem> _mapNotifications(
    List<AppNotificationRecord> records,
  ) {
    return records
        .map(
          (item) => _LiveNotificationItem(
            id: 'notification:${item.id}',
            title: item.title.trim().isEmpty
                ? 'Yeni bildirim'
                : _trim(item.title),
            body: _trim(item.message),
            category: _mapGenericCategory(item),
          ),
        )
        .toList();
  }

  Duration _resolvePollInterval(String role) {
    switch (role) {
      case 'Student':
      case 'Parent':
        return const Duration(seconds: 45);
      case 'Teacher':
        return const Duration(seconds: 60);
      case 'Admin':
      case 'Administrative':
      case 'Accounting':
        return const Duration(seconds: 90);
      default:
        return const Duration(seconds: 60);
    }
  }

  Future<bool> _shouldDeliver(
    AuthSession session,
    _LiveNotificationItem item,
    SharedPreferences prefs,
  ) async {
    final key = _historyKey(session, item.fingerprint);
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) {
      return true;
    }

    final lastShownAt = DateTime.tryParse(raw);
    if (lastShownAt == null) {
      return true;
    }

    return DateTime.now().difference(lastShownAt) > _repeatCooldown;
  }

  Future<void> _rememberDelivery(
    AuthSession session,
    _LiveNotificationItem item,
    SharedPreferences prefs,
  ) async {
    final key = _historyKey(session, item.fingerprint);
    await prefs.setString(key, DateTime.now().toIso8601String());
  }

  String _historyKey(AuthSession session, String fingerprint) {
    return '$_historyPrefix:${session.primaryRole}:${session.username}:$fingerprint';
  }

  static String _compactBody(String headline, String detail) {
    final cleanHeadline = _trim(headline);
    final cleanDetail = _trim(detail.replaceAll('\n', ' • '));
    if (cleanHeadline.isEmpty) return cleanDetail;
    if (cleanDetail.isEmpty) return cleanHeadline;
    return '$cleanHeadline • $cleanDetail';
  }

  static String _trim(String raw) {
    final compact = raw.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (compact.length <= 140) {
      return compact;
    }

    return '${compact.substring(0, 137)}...';
  }

  static String _mapGenericCategory(AppNotificationRecord item) {
    final category = item.category.trim().toLowerCase();
    if (category.contains('finance') ||
        category.contains('tahsil') ||
        category.contains('odeme')) {
      return 'finance';
    }
    if (category.contains('report') || category.contains('rapor')) {
      return 'report';
    }
    if (category.contains('meeting') || category.contains('gorus')) {
      return 'meeting';
    }
    return 'generic';
  }

  List<_LiveNotificationItem> _dedupe(List<_LiveNotificationItem> items) {
    final map = <String, _LiveNotificationItem>{};
    for (final item in items) {
      map[item.id] = item;
    }
    return map.values.toList();
  }
}

class _LiveNotificationItem {
  final String id;
  final String title;
  final String body;
  final String category;

  const _LiveNotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
  });

  String get fingerprint =>
      '${title.trim().toLowerCase()}|${body.trim().toLowerCase()}';

  _LiveNotificationItem copyWith({
    String? id,
    String? title,
    String? body,
    String? category,
  }) {
    return _LiveNotificationItem(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      category: category ?? this.category,
    );
  }
}
