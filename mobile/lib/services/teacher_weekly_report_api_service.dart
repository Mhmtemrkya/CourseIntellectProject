import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

String _decodeHtmlEntities(String value) {
  return value
      .replaceAll('&#xFC;', 'ü')
      .replaceAll('&#xDC;', 'Ü')
      .replaceAll('&#xE7;', 'ç')
      .replaceAll('&#xC7;', 'Ç')
      .replaceAll('&#x131;', 'ı')
      .replaceAll('&#x130;', 'İ')
      .replaceAll('&#xF6;', 'ö')
      .replaceAll('&#xD6;', 'Ö')
      .replaceAll('&#x15F;', 'ş')
      .replaceAll('&#x15E;', 'Ş')
      .replaceAll('&#x11F;', 'ğ')
      .replaceAll('&#x11E;', 'Ğ')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
}

class TeacherWeeklyReportApiException implements Exception {
  final String message;

  const TeacherWeeklyReportApiException(this.message);

  @override
  String toString() => message;
}

class TeacherWeeklyReportAttachmentRecord {
  final String name;
  final String url;
  final String fileType;

  const TeacherWeeklyReportAttachmentRecord({
    required this.name,
    required this.url,
    required this.fileType,
  });

  factory TeacherWeeklyReportAttachmentRecord.fromMap(
    Map<String, dynamic> map,
  ) {
    return TeacherWeeklyReportAttachmentRecord(
      name: _decodeHtmlEntities(map['name'] as String? ?? 'Dosya'),
      url: map['url'] as String? ?? '',
      fileType: _decodeHtmlEntities(map['fileType'] as String? ?? 'Dosya'),
    );
  }

  Map<String, dynamic> toMap() => {
    'name': name,
    'url': url,
    'fileType': fileType,
  };
}

class TeacherWeeklyReportStudentRecord {
  final String fullName;
  final String username;
  final String className;
  final String parentName;
  final String parentEmail;

  const TeacherWeeklyReportStudentRecord({
    required this.fullName,
    required this.username,
    required this.className,
    required this.parentName,
    required this.parentEmail,
  });

  factory TeacherWeeklyReportStudentRecord.fromMap(Map<String, dynamic> map) {
    return TeacherWeeklyReportStudentRecord(
      fullName: _decodeHtmlEntities(map['fullName'] as String? ?? ''),
      username: _decodeHtmlEntities(map['username'] as String? ?? ''),
      className: _decodeHtmlEntities(map['className'] as String? ?? ''),
      parentName: _decodeHtmlEntities(map['parentName'] as String? ?? ''),
      parentEmail: _decodeHtmlEntities(map['parentEmail'] as String? ?? ''),
    );
  }
}

class TeacherWeeklyReportBootstrapRecord {
  final List<String> classes;
  final List<String> subjects;
  final List<TeacherWeeklyReportStudentRecord> students;

  const TeacherWeeklyReportBootstrapRecord({
    required this.classes,
    required this.subjects,
    required this.students,
  });

  factory TeacherWeeklyReportBootstrapRecord.fromMap(Map<String, dynamic> map) {
    return TeacherWeeklyReportBootstrapRecord(
      classes: (map['classes'] as List<dynamic>? ?? const [])
          .map((item) => _decodeHtmlEntities(item.toString()))
          .toList(),
      subjects: (map['subjects'] as List<dynamic>? ?? const [])
          .map((item) => _decodeHtmlEntities(item.toString()))
          .toList(),
      students: (map['students'] as List<dynamic>? ?? const [])
          .map(
            (item) => TeacherWeeklyReportStudentRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }
}

class TeacherWeeklyReportRecord {
  final String id;
  final String teacherUsername;
  final String teacherName;
  final String studentUsername;
  final String studentName;
  final String parentName;
  final String parentEmail;
  final String className;
  final String subject;
  final String title;
  final String summary;
  final String highlights;
  final String supportNotes;
  final String weeklyPeriodLabel;
  final DateTime createdAtUtc;
  final List<TeacherWeeklyReportAttachmentRecord> attachments;

  const TeacherWeeklyReportRecord({
    required this.id,
    required this.teacherUsername,
    required this.teacherName,
    required this.studentUsername,
    required this.studentName,
    required this.parentName,
    required this.parentEmail,
    required this.className,
    required this.subject,
    required this.title,
    required this.summary,
    required this.highlights,
    required this.supportNotes,
    required this.weeklyPeriodLabel,
    required this.createdAtUtc,
    required this.attachments,
  });

  factory TeacherWeeklyReportRecord.fromMap(Map<String, dynamic> map) {
    return TeacherWeeklyReportRecord(
      id: map['id']?.toString() ?? '',
      teacherUsername: _decodeHtmlEntities(
        map['teacherUsername'] as String? ?? '',
      ),
      teacherName: _decodeHtmlEntities(map['teacherName'] as String? ?? ''),
      studentUsername: _decodeHtmlEntities(
        map['studentUsername'] as String? ?? '',
      ),
      studentName: _decodeHtmlEntities(map['studentName'] as String? ?? ''),
      parentName: _decodeHtmlEntities(map['parentName'] as String? ?? ''),
      parentEmail: _decodeHtmlEntities(map['parentEmail'] as String? ?? ''),
      className: _decodeHtmlEntities(map['className'] as String? ?? ''),
      subject: _decodeHtmlEntities(map['subject'] as String? ?? ''),
      title: _decodeHtmlEntities(map['title'] as String? ?? ''),
      summary: _decodeHtmlEntities(map['summary'] as String? ?? ''),
      highlights: _decodeHtmlEntities(map['highlights'] as String? ?? ''),
      supportNotes: _decodeHtmlEntities(map['supportNotes'] as String? ?? ''),
      weeklyPeriodLabel: _decodeHtmlEntities(
        map['weeklyPeriodLabel'] as String? ?? 'Bu Hafta',
      ),
      createdAtUtc:
          DateTime.tryParse(map['createdAtUtc'] as String? ?? '') ??
          DateTime.now(),
      attachments: (map['attachments'] as List<dynamic>? ?? const [])
          .map(
            (item) => TeacherWeeklyReportAttachmentRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }
}

class TeacherWeeklyReportApiService {
  TeacherWeeklyReportApiService._();

  static final TeacherWeeklyReportApiService instance =
      TeacherWeeklyReportApiService._();

  Future<TeacherWeeklyReportBootstrapRecord> fetchBootstrap({
    required String teacherUsername,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/reports/teacher-weekly/bootstrap',
      ).replace(queryParameters: {'teacherUsername': teacherUsername}),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Rapor sınıf verileri alınamadı (${response.statusCode}).',
      );
    }

    return TeacherWeeklyReportBootstrapRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<List<TeacherWeeklyReportRecord>> fetchForTeacher({
    required String teacherUsername,
    required String teacherName,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/reports/teacher-weekly/teacher',
      ).replace(
        queryParameters: {
          'teacherUsername': teacherUsername,
          'teacherName': teacherName,
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Gönderilen raporlar alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) => TeacherWeeklyReportRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<TeacherWeeklyReportStudentRecord>> fetchReportStudents({
    String? className,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/reports/students').replace(
        queryParameters: className == null || className.trim().isEmpty
            ? null
            : {'className': className.trim()},
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Rapor öğrenci listesi alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map(
          (item) => TeacherWeeklyReportStudentRecord(
            fullName: item['fullName'] as String? ?? '',
            username:
                item['username'] as String? ??
                item['fullName'] as String? ??
                '',
            className: item['className'] as String? ?? '',
            parentName: item['parentName'] as String? ?? '',
            parentEmail: item['parentEmail'] as String? ?? '',
          ),
        )
        .toList();
  }

  Future<List<TeacherWeeklyReportRecord>> fetchForParent({
    required String studentName,
    String? studentUsername,
    String? parentName,
    String? parentEmail,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/reports/teacher-weekly/parent',
      ).replace(
        queryParameters: {
          'studentName': studentName,
          if (studentUsername != null && studentUsername.trim().isNotEmpty)
            'studentUsername': studentUsername.trim(),
          if (parentName != null && parentName.trim().isNotEmpty)
            'parentName': parentName.trim(),
          if (parentEmail != null && parentEmail.trim().isNotEmpty)
            'parentEmail': parentEmail.trim(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Haftalik raporlar alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) => TeacherWeeklyReportRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<TeacherWeeklyReportRecord> create({
    required String teacherUsername,
    required String teacherName,
    required String studentUsername,
    required String studentName,
    required String className,
    required String subject,
    required String title,
    required String summary,
    required String highlights,
    required String supportNotes,
    required String weeklyPeriodLabel,
    required List<TeacherWeeklyReportAttachmentRecord> attachments,
  }) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/reports/teacher-weekly'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'teacherUsername': teacherUsername,
        'teacherName': teacherName,
        'studentUsername': studentUsername,
        'studentName': studentName,
        'className': className,
        'subject': subject,
        'title': title,
        'summary': summary,
        'highlights': highlights,
        'supportNotes': supportNotes,
        'weeklyPeriodLabel': weeklyPeriodLabel,
        'attachments': attachments.map((item) => item.toMap()).toList(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Haftalik rapor oluşturulamadi (${response.statusCode}).',
      );
    }

    return TeacherWeeklyReportRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<TeacherWeeklyReportAttachmentRecord> uploadAttachment({
    required PlatformFile file,
    String folder = 'teacher-weekly-reports',
  }) async {
    final session = await _session();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '${ApiConfig.baseUrl}/api/uploads',
      ).replace(queryParameters: {'folder': folder}),
    );
    request.headers['Authorization'] = 'Bearer ${session.accessToken}';

    if (file.path != null && file.path!.isNotEmpty) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          file.path!,
          filename: file.name,
        ),
      );
    } else if (file.bytes != null) {
      request.files.add(
        http.MultipartFile.fromBytes('file', file.bytes!, filename: file.name),
      );
    } else {
      throw const TeacherWeeklyReportApiException('Seçilen dosya okunamadı.');
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TeacherWeeklyReportApiException(
        'Dosya yüklenemedi (${response.statusCode}).',
      );
    }

    final payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final url = payload['fileUrl']?.toString().trim() ?? '';
    final fileType = _detectFileType(file.extension ?? file.name);
    return TeacherWeeklyReportAttachmentRecord(
      name: payload['fileName']?.toString().trim().isNotEmpty == true
          ? payload['fileName'].toString().trim()
          : file.name,
      url: url,
      fileType: fileType,
    );
  }

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const TeacherWeeklyReportApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }

  String _detectFileType(String source) {
    final value = source.toLowerCase();
    if (value.endsWith('.pdf') || value == 'pdf') return 'PDF';
    if (value.endsWith('.png') ||
        value.endsWith('.jpg') ||
        value.endsWith('.jpeg') ||
        value.endsWith('.webp')) {
      return 'Gorsel';
    }
    if (value.endsWith('.mp4') ||
        value.endsWith('.mov') ||
        value.endsWith('.avi') ||
        value.endsWith('.m4v')) {
      return 'Video';
    }
    return 'Dosya';
  }
}
