import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class DutyApiException implements Exception {
  final String message;
  const DutyApiException(this.message);
  @override
  String toString() => message;
}

class DutyRecord {
  final String id;
  final String dutyType;
  final String location;
  final DateTime? dutyDate;
  final String day;
  final String startTime;
  final String endTime;
  final String description;
  final String status;
  final String teacherName;

  const DutyRecord({
    required this.id,
    required this.dutyType,
    required this.location,
    required this.dutyDate,
    required this.day,
    required this.startTime,
    required this.endTime,
    required this.description,
    required this.status,
    required this.teacherName,
  });

  factory DutyRecord.fromMap(Map<String, dynamic> map) {
    final rawDate = map['dutyDateUtc'] as String?;
    return DutyRecord(
      id: map['id'] as String? ?? '',
      dutyType: map['dutyType'] as String? ?? '',
      location: map['location'] as String? ?? '',
      dutyDate: rawDate != null ? DateTime.tryParse(rawDate) : null,
      day: map['day'] as String? ?? '',
      startTime: map['startTime'] as String? ?? '',
      endTime: map['endTime'] as String? ?? '',
      description: map['description'] as String? ?? '',
      status: map['status'] as String? ?? '',
      teacherName: map['teacherName'] as String? ?? '',
    );
  }
}

class AdminTaskRecord {
  final String id;
  final String title;
  final String description;
  final String category;
  final String priority;
  final String status;
  final String responseStatus;
  final String rejectionReason;
  final DateTime? startDate;
  final DateTime? endDate;

  const AdminTaskRecord({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.priority,
    required this.status,
    required this.responseStatus,
    required this.rejectionReason,
    required this.startDate,
    required this.endDate,
  });

  factory AdminTaskRecord.fromMap(Map<String, dynamic> map) => AdminTaskRecord(
        id: map['id'] as String? ?? '',
        title: map['title'] as String? ?? '',
        description: map['description'] as String? ?? '',
        category: map['category'] as String? ?? '',
        priority: map['priority'] as String? ?? '',
        status: map['status'] as String? ?? '',
        responseStatus: map['responseStatus'] as String? ?? 'Pending',
        rejectionReason: map['rejectionReason'] as String? ?? '',
        startDate: DateTime.tryParse(map['startDateUtc'] as String? ?? ''),
        endDate: DateTime.tryParse(map['endDateUtc'] as String? ?? ''),
      );
}

class DutyStats {
  final int total;
  final int completed;
  final int planned;
  final int cancelled;

  const DutyStats({
    this.total = 0,
    this.completed = 0,
    this.planned = 0,
    this.cancelled = 0,
  });

  factory DutyStats.fromMap(Map<String, dynamic> map) {
    return DutyStats(
      total: (map['total'] as num?)?.toInt() ?? 0,
      completed: (map['completed'] as num?)?.toInt() ?? 0,
      planned: (map['planned'] as num?)?.toInt() ?? 0,
      cancelled: (map['cancelled'] as num?)?.toInt() ?? 0,
    );
  }
}

class DutyTeacherInput {
  final String? teacherUserId;
  final String teacherName;
  final String teacherUsername;
  final String teacherBranch;

  const DutyTeacherInput({
    required this.teacherUserId,
    required this.teacherName,
    required this.teacherUsername,
    required this.teacherBranch,
  });
}

class DutyCreateResult {
  final int createdCount;
  final int conflictCount;
  const DutyCreateResult(this.createdCount, this.conflictCount);
}

class TeacherDutyLoad {
  final String teacherName;
  final int count;
  const TeacherDutyLoad(this.teacherName, this.count);

  factory TeacherDutyLoad.fromMap(Map<String, dynamic> map) =>
      TeacherDutyLoad(map['teacherName'] as String? ?? '', (map['count'] as num?)?.toInt() ?? 0);
}

class DutyApiService {
  Future<List<AdminTaskRecord>> fetchMyAdminTasks() async {
    final response = await _get('/api/admin-tasks/mine');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => AdminTaskRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<AdminTaskRecord> updateAdminTaskStatus(String id, String status, {String? reason}) async {
    final response = await _send('POST', '/api/admin-tasks/$id/status', body: {
      'status': status,
      'reason': ?reason,
    });
    return AdminTaskRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<List<DutyRecord>> fetchMyDuties({String scope = 'all'}) async {
    final response = await _get('/api/duties/mine?scope=$scope');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => DutyRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<DutyStats> fetchMyStats() async {
    final response = await _get('/api/duties/mine/stats');
    return DutyStats.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<DutyCreateResult> createDuty({
    required String dutyType,
    required String location,
    required DateTime dutyDate,
    required String day,
    required String startTime,
    required String endTime,
    required String description,
    required List<DutyTeacherInput> teachers,
    bool repeatWeekly = false,
    int repeatWeeks = 1,
  }) async {
    final response = await _send('POST', '/api/duties', body: {
      'dutyType': dutyType,
      'location': location,
      'dutyDate': dutyDate.toUtc().toIso8601String(),
      'day': day,
      'startTime': startTime,
      'endTime': endTime,
      'description': description,
      'repeatWeekly': repeatWeekly,
      'repeatWeeks': repeatWeeks,
      'teachers': teachers
          .map((t) => {
                'teacherUserId': t.teacherUserId,
                'teacherName': t.teacherName,
                'teacherUsername': t.teacherUsername,
                'teacherBranch': t.teacherBranch,
              })
          .toList(),
    });
    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final created = (map['created'] as List<dynamic>?)?.length ?? 0;
    final conflicts = (map['conflicts'] as List<dynamic>?)?.length ?? 0;
    return DutyCreateResult(created, conflicts);
  }

  Future<List<DutyRecord>> fetchAllDuties({DateTime? from, DateTime? to, String? dutyType}) async {
    final params = <String>[];
    if (from != null) params.add('from=${from.toUtc().toIso8601String()}');
    if (to != null) params.add('to=${to.toUtc().toIso8601String()}');
    if (dutyType != null && dutyType.isNotEmpty) params.add('dutyType=${Uri.encodeQueryComponent(dutyType)}');
    final qs = params.isEmpty ? '' : '?${params.join('&')}';
    final response = await _get('/api/duties$qs');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => DutyRecord.fromMap(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<List<TeacherDutyLoad>> fetchLoad() async {
    final response = await _get('/api/duties/load');
    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => TeacherDutyLoad.fromMap(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<void> setStatus(String id, String status) async {
    await _send('POST', '/api/duties/$id/status', body: {'status': status});
  }

  Future<void> deleteDuty(String id) async {
    await _send('DELETE', '/api/duties/$id');
  }

  Future<http.Response> _get(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const DutyApiException('Oturum bulunamadı. Lütfen yeniden giriş yap.');
    }
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode == 401) {
      throw const DutyApiException('Oturum süresi dolmuş. Lütfen yeniden giriş yap.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw DutyApiException('Veriler alınamadı (${response.statusCode}).');
    }
    return response;
  }

  Future<http.Response> _send(String method, String path, {Map<String, dynamic>? body}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const DutyApiException('Oturum bulunamadı. Lütfen yeniden giriş yap.');
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
      throw const DutyApiException('Oturum süresi dolmuş. Lütfen yeniden giriş yap.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw DutyApiException('İşlem tamamlanamadı (${response.statusCode}).');
    }
    return response;
  }
}
