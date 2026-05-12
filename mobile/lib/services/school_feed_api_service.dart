import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'exam_results_store.dart';
import 'linked_children_service.dart';
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

  bool get isLiveLesson => detail.startsWith('LIVE_LESSON');

  Map<String, String> get detailPayload {
    if (!isLiveLesson) return const {};
    final lines = detail.split('\n');
    final map = <String, String>{};
    for (final line in lines.skip(1)) {
      final separator = line.indexOf('=');
      if (separator <= 0) continue;
      map[line.substring(0, separator)] = line.substring(separator + 1);
    }
    return map;
  }

  String get summaryDetail {
    if (!isLiveLesson) return detail;
    final payload = detailPayload;
    final teacher = payload['teacher']?.trim();
    final subtitle = payload['subtitle']?.trim();
    final className = payload['class']?.trim();
    final platform = payload['platform']?.trim();
    final startsAt = DateTime.tryParse(payload['datetime'] ?? '');
    final dateLabel = startsAt == null
        ? ''
        : '${startsAt.day.toString().padLeft(2, '0')}.${startsAt.month.toString().padLeft(2, '0')}.${startsAt.year}';
    final timeLabel = startsAt == null
        ? ''
        : '${startsAt.hour.toString().padLeft(2, '0')}:${startsAt.minute.toString().padLeft(2, '0')}';

    final parts = <String>[
      if (subtitle != null && subtitle.isNotEmpty) subtitle,
      if (teacher != null && teacher.isNotEmpty) teacher,
      if (className != null && className.isNotEmpty) className,
      if (platform != null && platform.isNotEmpty) platform,
      if (dateLabel.isNotEmpty || timeLabel.isNotEmpty)
        [
          if (dateLabel.isNotEmpty) dateLabel,
          if (timeLabel.isNotEmpty) timeLabel,
        ].join(' • '),
    ];

    return parts.isEmpty ? 'Canlı ders duyurusu yayınlandı.' : parts.join('\n');
  }
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
    final announcements = await fetchAnnouncements(audience: 'Öğrenci');
    return announcements
        .where((item) => item.detail.startsWith('LIVE_LESSON'))
        .map(_parseLiveLesson)
        .toList()
      ..sort((a, b) {
        final left = a.startsAt?.millisecondsSinceEpoch ?? 0;
        final right = b.startsAt?.millisecondsSinceEpoch ?? 0;
        return left.compareTo(right);
      });
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
    final announcement = await createAnnouncement(
      title: title,
      detail: _buildLiveLessonDetail(
        teacher: teacher,
        startsAt: startsAt,
        durationMinutes: durationMinutes,
        className: className,
        platform: platform,
        meetingUrl: meetingUrl,
        subtitle: subtitle,
        materials: materials,
      ),
      audience: 'Öğrenci',
    );
    return _parseLiveLesson(announcement);
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

  LiveLessonRecord _parseLiveLesson(AnnouncementFeedItem announcement) {
    final lines = announcement.detail.split('\n');
    final map = <String, String>{};
    for (final line in lines.skip(1)) {
      final separator = line.indexOf('=');
      if (separator <= 0) continue;
      map[line.substring(0, separator)] = line.substring(separator + 1);
    }

    final startsAt = DateTime.tryParse(map['datetime'] ?? '');
    final durationMinutes = int.tryParse(map['duration'] ?? '') ?? 60;
    final now = DateTime.now();
    final endsAt = startsAt?.add(Duration(minutes: durationMinutes));
    String status = 'Planlandı';
    if (startsAt != null && endsAt != null) {
      if (now.isAfter(startsAt) && now.isBefore(endsAt)) {
        status = 'Şimdi Canlı';
      } else if (now.isAfter(endsAt)) {
        status = 'Tamamlandı';
      }
    }

    return LiveLessonRecord(
      id: announcement.id,
      title: announcement.title,
      subtitle: map['subtitle'] ?? 'Canlı ders açıklaması',
      teacher: map['teacher'] ?? 'Öğretmen',
      className: map['class'] ?? 'Tüm Sınıflar',
      platform: map['platform'] ?? 'Zoom',
      meetingUrl: map['link'] ?? '',
      materials: (map['materials'] ?? '')
          .split('|')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList(),
      startsAt: startsAt,
      durationMinutes: durationMinutes,
      status: status,
    );
  }

  String _buildLiveLessonDetail({
    required String teacher,
    required DateTime startsAt,
    required int durationMinutes,
    required String className,
    required String platform,
    required String meetingUrl,
    required String subtitle,
    required List<String> materials,
  }) {
    return [
      'LIVE_LESSON',
      'teacher=${teacher.trim()}',
      'datetime=${startsAt.toIso8601String()}',
      'duration=$durationMinutes',
      'class=${className.trim()}',
      'platform=${platform.trim()}',
      'link=${meetingUrl.trim()}',
      'subtitle=${subtitle.trim()}',
      'materials=${materials.map((item) => item.trim()).where((item) => item.isNotEmpty).join('|')}',
    ].join('\n');
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
