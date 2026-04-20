import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class ReportsAnalyticsApiException implements Exception {
  final String message;

  const ReportsAnalyticsApiException(this.message);

  @override
  String toString() => message;
}

class ExamAnalyticsSubjectRecord {
  final String subject;
  final int averageScore;
  final int examCount;

  const ExamAnalyticsSubjectRecord({
    required this.subject,
    required this.averageScore,
    required this.examCount,
  });
}

class ExamAnalyticsRecord {
  final String studentName;
  final int averageScore;
  final int netAverage;
  final int riskScore;
  final int examCount;
  final String? strongestSubject;
  final String? weakestSubject;
  final List<ExamAnalyticsSubjectRecord> subjects;

  const ExamAnalyticsRecord({
    required this.studentName,
    required this.averageScore,
    required this.netAverage,
    required this.riskScore,
    required this.examCount,
    required this.strongestSubject,
    required this.weakestSubject,
    required this.subjects,
  });
}

class TeacherAnalyticsClassRecord {
  final String className;
  final int studentCount;
  final int average;
  final int attendance;
  final int completion;
  final String trend;
  final String topTopic;
  final String supportTopic;

  const TeacherAnalyticsClassRecord({
    required this.className,
    required this.studentCount,
    required this.average,
    required this.attendance,
    required this.completion,
    required this.trend,
    required this.topTopic,
    required this.supportTopic,
  });
}

class TeacherAnalyticsTopicRecord {
  final String name;
  final int success;
  final int questionCount;
  final String riskLevel;

  const TeacherAnalyticsTopicRecord({
    required this.name,
    required this.success,
    required this.questionCount,
    required this.riskLevel,
  });
}

class TeacherAnalyticsRecord {
  final List<TeacherAnalyticsClassRecord> classReports;
  final List<TeacherAnalyticsTopicRecord> topics;

  const TeacherAnalyticsRecord({
    required this.classReports,
    required this.topics,
  });
}

class ReportsAnalyticsApiService {
  ReportsAnalyticsApiService._();

  static final ReportsAnalyticsApiService instance =
      ReportsAnalyticsApiService._();

  Future<ExamAnalyticsRecord> fetchExamAnalytics(String studentName) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/reports/exam-analytics',
      ).replace(queryParameters: {'studentName': studentName}),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ReportsAnalyticsApiException(
        'Detaylı sınav analizi alınamadı (${response.statusCode}).',
      );
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return ExamAnalyticsRecord(
      studentName: map['studentName'] as String? ?? studentName,
      averageScore: map['averageScore'] as int? ?? 0,
      netAverage: map['netAverage'] as int? ?? 0,
      riskScore: map['riskScore'] as int? ?? 0,
      examCount: map['examCount'] as int? ?? 0,
      strongestSubject: map['strongestSubject'] as String?,
      weakestSubject: map['weakestSubject'] as String?,
      subjects: (map['subjects'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => ExamAnalyticsSubjectRecord(
              subject: item['subject'] as String? ?? 'Genel',
              averageScore: item['averageScore'] as int? ?? 0,
              examCount: item['examCount'] as int? ?? 0,
            ),
          )
          .toList(),
    );
  }

  Future<TeacherAnalyticsRecord> fetchTeacherAnalytics({
    String? className,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/reports/teacher-analytics').replace(
        queryParameters: className == null || className.trim().isEmpty
            ? null
            : {'className': className.trim()},
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ReportsAnalyticsApiException(
        'Öğretmen rapor analitiği alınamadı (${response.statusCode}).',
      );
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return TeacherAnalyticsRecord(
      classReports: (map['classReports'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => TeacherAnalyticsClassRecord(
              className: item['className'] as String? ?? 'Tanımsiz',
              studentCount: item['studentCount'] as int? ?? 0,
              average: item['average'] as int? ?? 0,
              attendance: item['attendance'] as int? ?? 0,
              completion: item['completion'] as int? ?? 0,
              trend: item['trend'] as String? ?? '+0',
              topTopic: item['topTopic'] as String? ?? 'Veri Yok',
              supportTopic: item['supportTopic'] as String? ?? 'Veri Yok',
            ),
          )
          .toList(),
      topics: (map['topics'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => TeacherAnalyticsTopicRecord(
              name: item['name'] as String? ?? 'Genel',
              success: item['success'] as int? ?? 0,
              questionCount: item['questionCount'] as int? ?? 0,
              riskLevel: item['riskLevel'] as String? ?? 'Bekleniyor',
            ),
          )
          .toList(),
    );
  }

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ReportsAnalyticsApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }
}
