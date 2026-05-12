import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'exam_results_store.dart';
import 'linked_children_service.dart';
import 'live_room_api_service.dart';
import 'student_registry_store.dart';

class SchoolFeedApiException implements Exception {
  final String message;

  const SchoolFeedApiException(this.message);

  @override
  String toString() => message;
}

class AnnouncementFeedItem {
  final String id;
  final String title;
  final String detail;
  final String audience;
  final String date;
  final IconData icon;
  final Color color;
  final String createdByName;
  final String createdByRole;
  final String targetClassName;
  final String targetRecipientType;
  final List<String> recipientLabels;
  final int recipientCount;

  const AnnouncementFeedItem({
    required this.id,
    required this.title,
    required this.detail,
    required this.audience,
    required this.date,
    required this.icon,
    required this.color,
    required this.createdByName,
    required this.createdByRole,
    required this.targetClassName,
    required this.targetRecipientType,
    required this.recipientLabels,
    required this.recipientCount,
  });

  String get summaryDetail => detail;
}

class LiveLessonRecord {
  final String id;
  final String title;
  final String subtitle;
  final String teacher;
  final String className;
  final String platform;
  final String meetingUrl;
  final List<String> materials;
  final DateTime? startsAt;
  final int durationMinutes;
  final String status;

  const LiveLessonRecord({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.teacher,
    required this.className,
    required this.platform,
    required this.meetingUrl,
    required this.materials,
    required this.startsAt,
    required this.durationMinutes,
    required this.status,
  });

  String get timeLabel {
    if (startsAt == null) return '--:--';
    final end = startsAt!.add(Duration(minutes: durationMinutes));
    return '${_twoDigit(startsAt!.hour)}:${_twoDigit(startsAt!.minute)} - ${_twoDigit(end.hour)}:${_twoDigit(end.minute)}';
  }

  String get dateLabel {
    if (startsAt == null) return '--';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final lessonDay = DateTime(startsAt!.year, startsAt!.month, startsAt!.day);
    final diff = lessonDay.difference(today).inDays;
    if (diff == 0) return 'Bugün';
    if (diff == 1) return 'Yarın';
    if (diff == -1) return 'Dün';
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ];
    return '${startsAt!.day} ${months[startsAt!.month - 1]} ${startsAt!.year}';
  }

  static String _twoDigit(int value) => value.toString().padLeft(2, '0');
}

class SchoolFeedApiService {
  SchoolFeedApiService._();

  static final SchoolFeedApiService instance = SchoolFeedApiService._();

  Future<List<AnnouncementFeedItem>> fetchAnnouncements({
    required String audience,
    bool includeAll = false,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SchoolFeedApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final linkedChildren = audience == 'Veli'
        ? await LinkedChildrenService.instance.loadLinkedChildren()
        : const <LinkedChildRecord>[];

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/announcements').replace(
        queryParameters: <String, String>{
          if (!includeAll) 'audience': _normalizeText(audience),
          if (includeAll) 'includeAll': 'true',
          'viewerRole': _normalizeText(session.primaryRole),
          'viewerUsername': session.username,
          'viewerName': session.fullName,
          'viewerClassName': linkedChildren.isNotEmpty
              ? linkedChildren.first.className
              : '',
          if (linkedChildren.isNotEmpty)
            'viewerLinkedStudentUsernames': linkedChildren
                .map((item) => item.username)
                .join(','),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SchoolFeedApiException(
        'Duyurular alınamadı (${response.statusCode}).',
      );
    }

    final list = (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map(
          (map) => AnnouncementFeedItem(
            id: '${map['id'] ?? ''}',
            title: map['title'] as String,
            detail: map['detail'] as String,
            audience: map['audience'] as String,
            date: map['dateLabel'] as String,
            icon: _iconForAudience(map['audience'] as String),
            color: _colorForAudience(map['audience'] as String),
            createdByName: (map['createdByName'] as String?) ?? '',
            createdByRole: (map['createdByRole'] as String?) ?? '',
            targetClassName: (map['targetClassName'] as String?) ?? '',
            targetRecipientType: (map['targetRecipientType'] as String?) ?? '',
            recipientLabels:
                ((map['recipientLabels'] as List<dynamic>?) ?? const [])
                    .map((item) => item.toString())
                    .toList(),
            recipientCount: (map['recipientCount'] as num?)?.toInt() ?? 0,
          ),
        )
        .toList();

    return list;
  }

  Future<List<ExamScoreRecord>> fetchExamResults({
    String? studentName,
    String? className,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SchoolFeedApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final queryParameters = <String, String>{};
    if (studentName != null && studentName.trim().isNotEmpty) {
      queryParameters['studentName'] = _normalizeText(studentName);
    }
    if (className != null && className.trim().isNotEmpty) {
      queryParameters['className'] = className.trim();
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/examresults').replace(
        queryParameters: queryParameters.isEmpty ? null : queryParameters,
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SchoolFeedApiException(
        'Sınav sonuçları alınamadı (${response.statusCode}).',
      );
    }

    final records =
        (jsonDecode(response.body) as List<dynamic>)
            .map((item) => Map<String, dynamic>.from(item as Map))
            .map(
              (map) => ExamScoreRecord(
                examTitle: map['examTitle'] as String,
                type: _mapExamType(map['type'] as String),
                subject: map['subject'] as String,
                date: map['dateLabel'] as String,
                studentName: map['studentName'] as String,
                className: map['className'] as String,
                score: map['score'] as int,
                net: map['net'] as int,
              ),
            )
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

    ExamResultsStore.instance.replaceRecords(records);
    return records;
  }

  Future<AnnouncementFeedItem> createAnnouncement({
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
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SchoolFeedApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/announcements'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'title': title.trim(),
        'detail': detail.trim(),
        'audience': _normalizeText(audience),
        'createdByName': (createdByName ?? session.fullName).trim(),
        'createdByRole': (createdByRole ?? session.primaryRole).trim(),
        'createdByUsername': (createdByUsername ?? session.username).trim(),
        'targetClassName': (targetClassName ?? '').trim(),
        'targetRecipientType': (targetRecipientType ?? '').trim(),
        'recipientKeys': recipientKeys,
        'recipientLabels': recipientLabels,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SchoolFeedApiException(
        'Duyuru oluşturulamadı (${response.statusCode}).',
      );
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return AnnouncementFeedItem(
      id: '${map['id'] ?? ''}',
      title: map['title'] as String,
      detail: map['detail'] as String,
      audience: map['audience'] as String,
      date: map['dateLabel'] as String,
      icon: _iconForAudience(map['audience'] as String),
      color: _colorForAudience(map['audience'] as String),
      createdByName: (map['createdByName'] as String?) ?? '',
      createdByRole: (map['createdByRole'] as String?) ?? '',
      targetClassName: (map['targetClassName'] as String?) ?? '',
      targetRecipientType: (map['targetRecipientType'] as String?) ?? '',
      recipientLabels: ((map['recipientLabels'] as List<dynamic>?) ?? const [])
          .map((item) => item.toString())
          .toList(),
      recipientCount: (map['recipientCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> deleteAnnouncement(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SchoolFeedApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/announcements/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SchoolFeedApiException(
        'Canlı ders silinemedi (${response.statusCode}).',
      );
    }
  }

  Future<List<LiveLessonRecord>> fetchLiveLessons() async {
    try {
      final rooms = await LiveRoomApiService.instance.fetchRooms();
      return rooms.map(_mapLiveRoomSession).toList()
        ..sort((a, b) {
          final left = a.startsAt?.millisecondsSinceEpoch ?? 0;
          final right = b.startsAt?.millisecondsSinceEpoch ?? 0;
          return right.compareTo(left);
        });
    } on LiveRoomApiException catch (error) {
      throw SchoolFeedApiException(error.message);
    }
  }

  Future<LiveLessonRecord> createLiveLesson({
    required String title,
    required String subtitle,
    required String teacher,
    required String className,
    required String platform,
    required String meetingUrl,
    required DateTime startsAt,
    required int durationMinutes,
    required List<String> materials,
  }) async {
    try {
      final room = await LiveRoomApiService.instance.openRoom(
        lessonTitle: title,
        teacherName: teacher,
        className: className,
        timeLabel: _timeRangeLabel(startsAt, durationMinutes),
        meetingLink: meetingUrl,
      );

      var currentRoom = room;
      for (final material in materials) {
        final parsed = _parseMaterialReference(material);
        if (parsed.$1.isEmpty) continue;
        currentRoom = await LiveRoomApiService.instance.addAsset(
          currentRoom.id,
          parsed.$1,
          fileUrl: parsed.$2,
        );
      }

      return _mapLiveRoomSession(
        currentRoom,
        subtitleOverride: subtitle,
        platformOverride: platform,
        startsAtOverride: startsAt,
        durationMinutesOverride: durationMinutes,
      );
    } on LiveRoomApiException catch (error) {
      throw SchoolFeedApiException(error.message);
    }
  }

  Future<void> deleteLiveLesson(String id) async {
    try {
      await LiveRoomApiService.instance.deleteRoom(id);
    } on LiveRoomApiException catch (error) {
      throw SchoolFeedApiException(error.message);
    }
  }

  Future<ExamScoreRecord> createExamResult({
    required String examTitle,
    required String type,
    required String subject,
    required String dateLabel,
    required String studentName,
    required String className,
    required int score,
    required int net,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SchoolFeedApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/examresults'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'examTitle': examTitle.trim(),
        'type': type,
        'subject': subject.trim(),
        'dateLabel': dateLabel.trim(),
        'studentName': _normalizeText(studentName),
        'className': className.trim(),
        'score': score,
        'net': net,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SchoolFeedApiException(
        'Sınav sonucu kaydedilemedi (${response.statusCode}).',
      );
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final record = ExamScoreRecord(
      examTitle: map['examTitle'] as String,
      type: _mapExamType(map['type'] as String),
      subject: map['subject'] as String,
      date: map['dateLabel'] as String,
      studentName: map['studentName'] as String,
      className: map['className'] as String,
      score: map['score'] as int,
      net: map['net'] as int,
    );
    ExamResultsStore.instance.upsertScore(
      examTitle: record.examTitle,
      type: record.type,
      subject: record.subject,
      date: record.date,
      studentName: record.studentName,
      className: record.className,
      score: record.score,
      net: record.net,
    );
    return record;
  }

  static String normalizeStudentQuery(String value) => _normalizeText(value);

  LiveLessonRecord _mapLiveRoomSession(
    LiveRoomSessionRecord room, {
    String? subtitleOverride,
    String? platformOverride,
    DateTime? startsAtOverride,
    int? durationMinutesOverride,
  }) {
    final startsAt = startsAtOverride ?? room.startedAtUtc?.toLocal();
    final durationMinutes = durationMinutesOverride ??
        _durationMinutesFromTimeLabel(room.timeLabel) ??
        60;

    return LiveLessonRecord(
      id: room.id,
      title: room.lessonTitle,
      subtitle: subtitleOverride?.trim().isNotEmpty == true
          ? subtitleOverride!.trim()
          : 'Canlı ders odası',
      teacher: room.teacherName,
      className: room.className,
      platform: platformOverride?.trim().isNotEmpty == true
          ? platformOverride!.trim()
          : _platformFromLink(room.meetingLink),
      meetingUrl: room.meetingLink,
      materials: room.assets
          .map((item) => '${item.fileName}::${item.fileUrl}')
          .toList(),
      startsAt: startsAt,
      durationMinutes: durationMinutes,
      status: _liveRoomStatusLabel(room.status),
    );
  }

  String _liveRoomStatusLabel(String status) {
    if (status.toLowerCase() == 'completed') return 'Tamamlandı';
    if (status.toLowerCase() == 'active') return 'Şimdi Canlı';
    return status;
  }

  String _platformFromLink(String link) {
    final value = link.toLowerCase();
    if (value.contains('zoom')) return 'Zoom';
    if (value.contains('teams')) return 'Microsoft Teams';
    if (value.contains('meet')) return 'Meet';
    return 'Canlı Ders';
  }

  (String, String) _parseMaterialReference(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return ('', '');
    if (!value.contains('::')) return (value.split('/').last, '');
    final parts = value.split('::');
    return (parts.first.trim(), parts.sublist(1).join('::').trim());
  }

  String _timeRangeLabel(DateTime startsAt, int durationMinutes) {
    final end = startsAt.add(Duration(minutes: durationMinutes));
    return '${LiveLessonRecord._twoDigit(startsAt.hour)}:${LiveLessonRecord._twoDigit(startsAt.minute)} - '
        '${LiveLessonRecord._twoDigit(end.hour)}:${LiveLessonRecord._twoDigit(end.minute)}';
  }

  int? _durationMinutesFromTimeLabel(String value) {
    final parts = value.split('-').map((item) => item.trim()).toList();
    if (parts.length < 2) return null;
    final start = _minutesOfDay(parts.first);
    final end = _minutesOfDay(parts[1]);
    if (start == null || end == null || end <= start) return null;
    return end - start;
  }

  int? _minutesOfDay(String value) {
    final parts = value.split(':');
    if (parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return hour * 60 + minute;
  }

  static Future<String> resolveLinkedStudentName(AuthSession? session) async {
    if (session == null) {
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      return linkedChildren.isNotEmpty
          ? _normalizeText(linkedChildren.first.fullName)
          : '';
    }
    if (session.primaryRole == 'Student') {
      return _normalizeText(session.fullName);
    }
    if (session.primaryRole == 'Parent') {
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      if (linkedChildren.isNotEmpty) {
        return _normalizeText(linkedChildren.first.fullName);
      }
    }
    return _normalizeText(session.fullName);
  }

  static Future<String> resolveLinkedStudentClassName(
    AuthSession? session,
  ) async {
    await StudentRegistryStore.instance.ensureLoaded();
    final students = StudentRegistryStore.instance.students;

    if (students.isEmpty) {
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      return linkedChildren.isNotEmpty
          ? linkedChildren.first.className.trim()
          : '';
    }

    if (session == null) {
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      return linkedChildren.isNotEmpty
          ? linkedChildren.first.className.trim()
          : '';
    }

    if (session.primaryRole == 'Student') {
      final directMatch = students.where((item) {
        final sameUsername =
            item.username.trim().toLowerCase() ==
            session.username.trim().toLowerCase();
        final sameName =
            _normalizeText(item.fullName) == _normalizeText(session.fullName);
        return sameUsername || sameName;
      }).toList();
      if (directMatch.isNotEmpty) {
        return directMatch.first.className.trim();
      }
    }

    final linkedChildren = await LinkedChildrenService.instance
        .loadLinkedChildren();
    return linkedChildren.isNotEmpty
        ? linkedChildren.first.className.trim()
        : '';
  }

  static String _normalizeText(String value) {
    return value
        .trim()
        .replaceAll('ç', 'c')
        .replaceAll('Ç', 'C')
        .replaceAll('ğ', 'g')
        .replaceAll('Ğ', 'G')
        .replaceAll('ı', 'i')
        .replaceAll('İ', 'I')
        .replaceAll('ö', 'o')
        .replaceAll('Ö', 'O')
        .replaceAll('ş', 's')
        .replaceAll('Ş', 'S')
        .replaceAll('ü', 'u')
        .replaceAll('Ü', 'U');
  }

  static String _mapExamType(String type) {
    switch (type) {
      case 'MockExam':
        return 'Deneme';
      case 'Written':
        return 'Yazılı';
      case 'Oral':
        return 'Sözlü';
      case 'Quiz':
        return 'Quiz';
      default:
        return type;
    }
  }

  static IconData _iconForAudience(String audience) {
    if (audience.contains('Öğrenci')) {
      return Icons.school_outlined;
    }
    if (audience.contains('Veli')) {
      return Icons.groups_outlined;
    }
    if (audience.contains('Öğretmen')) {
      return Icons.menu_book_outlined;
    }
    return Icons.campaign_outlined;
  }

  static Color _colorForAudience(String audience) {
    if (audience.contains('Öğrenci')) {
      return const Color(0xFF2563EB);
    }
    if (audience.contains('Veli')) {
      return const Color(0xFF14532D);
    }
    if (audience.contains('Öğretmen')) {
      return const Color(0xFF7C3AED);
    }
    return const Color(0xFFB45309);
  }
}
