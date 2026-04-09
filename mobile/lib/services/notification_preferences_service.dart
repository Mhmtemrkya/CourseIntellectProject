import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'auth_session_store.dart';

class NotificationPreferences {
  final bool allEnabled;
  final bool socialEnabled;
  final bool academicEnabled;
  final bool meetingEnabled;
  final bool reportEnabled;
  final bool financeEnabled;
  final bool previewEnabled;
  final bool silentMessages;
  final bool silentFinance;
  final bool silentReports;

  const NotificationPreferences({
    required this.allEnabled,
    required this.socialEnabled,
    required this.academicEnabled,
    required this.meetingEnabled,
    required this.reportEnabled,
    required this.financeEnabled,
    required this.previewEnabled,
    required this.silentMessages,
    required this.silentFinance,
    required this.silentReports,
  });

  factory NotificationPreferences.defaultsForRole(String role) {
    final normalized = role.trim();
    return NotificationPreferences(
      allEnabled: true,
      socialEnabled: true,
      academicEnabled: normalized != 'Accounting',
      meetingEnabled: normalized == 'Teacher' || normalized == 'Parent' || normalized == 'Admin' || normalized == 'Administrative',
      reportEnabled: normalized == 'Teacher' || normalized == 'Parent' || normalized == 'Admin' || normalized == 'Administrative',
      financeEnabled: normalized == 'Parent' || normalized == 'Accounting' || normalized == 'Admin',
      previewEnabled: true,
      silentMessages: false,
      silentFinance: false,
      silentReports: false,
    );
  }

  factory NotificationPreferences.fromMap(Map<String, dynamic> map, String role) {
    final defaults = NotificationPreferences.defaultsForRole(role);
    return NotificationPreferences(
      allEnabled: map['allEnabled'] as bool? ?? defaults.allEnabled,
      socialEnabled: map['socialEnabled'] as bool? ?? defaults.socialEnabled,
      academicEnabled: map['academicEnabled'] as bool? ?? defaults.academicEnabled,
      meetingEnabled: map['meetingEnabled'] as bool? ?? defaults.meetingEnabled,
      reportEnabled: map['reportEnabled'] as bool? ?? defaults.reportEnabled,
      financeEnabled: map['financeEnabled'] as bool? ?? defaults.financeEnabled,
      previewEnabled: map['previewEnabled'] as bool? ?? defaults.previewEnabled,
      silentMessages: map['silentMessages'] as bool? ?? defaults.silentMessages,
      silentFinance: map['silentFinance'] as bool? ?? defaults.silentFinance,
      silentReports: map['silentReports'] as bool? ?? defaults.silentReports,
    );
  }

  Map<String, dynamic> toMap() => {
        'allEnabled': allEnabled,
        'socialEnabled': socialEnabled,
        'academicEnabled': academicEnabled,
        'meetingEnabled': meetingEnabled,
        'reportEnabled': reportEnabled,
        'financeEnabled': financeEnabled,
        'previewEnabled': previewEnabled,
        'silentMessages': silentMessages,
        'silentFinance': silentFinance,
        'silentReports': silentReports,
      };

  NotificationPreferences copyWith({
    bool? allEnabled,
    bool? socialEnabled,
    bool? academicEnabled,
    bool? meetingEnabled,
    bool? reportEnabled,
    bool? financeEnabled,
    bool? previewEnabled,
    bool? silentMessages,
    bool? silentFinance,
    bool? silentReports,
  }) {
    return NotificationPreferences(
      allEnabled: allEnabled ?? this.allEnabled,
      socialEnabled: socialEnabled ?? this.socialEnabled,
      academicEnabled: academicEnabled ?? this.academicEnabled,
      meetingEnabled: meetingEnabled ?? this.meetingEnabled,
      reportEnabled: reportEnabled ?? this.reportEnabled,
      financeEnabled: financeEnabled ?? this.financeEnabled,
      previewEnabled: previewEnabled ?? this.previewEnabled,
      silentMessages: silentMessages ?? this.silentMessages,
      silentFinance: silentFinance ?? this.silentFinance,
      silentReports: silentReports ?? this.silentReports,
    );
  }

  bool isCategoryEnabled(String category) {
    if (!allEnabled) return false;
    switch (category) {
      case 'announcement':
      case 'message':
      case 'generic':
        return socialEnabled;
      case 'homework':
      case 'content':
      case 'planned-exam':
      case 'exam-result':
        return academicEnabled;
      case 'meeting':
        return meetingEnabled;
      case 'report':
        return reportEnabled;
      case 'finance':
        return financeEnabled;
      default:
        return true;
    }
  }

  bool isCategorySilent(String category) {
    switch (category) {
      case 'message':
        return silentMessages;
      case 'finance':
        return silentFinance;
      case 'report':
        return silentReports;
      default:
        return false;
    }
  }
}

class NotificationPreferencesService {
  NotificationPreferencesService._();

  static const _prefix = 'course_intellect_notification_preferences_v1';
  static final NotificationPreferencesService instance = NotificationPreferencesService._();

  Future<NotificationPreferences> load(AuthSession session) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(session));
    if (raw == null || raw.isEmpty) {
      return NotificationPreferences.defaultsForRole(session.primaryRole);
    }

    try {
      return NotificationPreferences.fromMap(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
        session.primaryRole,
      );
    } catch (_) {
      return NotificationPreferences.defaultsForRole(session.primaryRole);
    }
  }

  Future<void> save(AuthSession session, NotificationPreferences preferences) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(session), jsonEncode(preferences.toMap()));
  }

  String _key(AuthSession session) => '$_prefix:${session.primaryRole}:${session.username}';
}
