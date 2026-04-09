import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class HomeworkApiException implements Exception {
  final String message;

  const HomeworkApiException(this.message);

  @override
  String toString() => message;
}

class HomeworkApiService {
  HomeworkApiService._();

  static final HomeworkApiService instance = HomeworkApiService._();

  Future<String> uploadHomeworkAsset({
    required PlatformFile file,
    String folder = 'homework-materials',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const HomeworkApiException('Oturum bulunamadi.');

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/uploads').replace(queryParameters: {'folder': folder}),
    );
    request.headers['Authorization'] = 'Bearer ${session.accessToken}';

    if (file.path != null && file.path!.isNotEmpty) {
      request.files.add(await http.MultipartFile.fromPath('file', file.path!, filename: file.name));
    } else if (file.bytes != null) {
      request.files.add(http.MultipartFile.fromBytes('file', file.bytes!, filename: file.name));
    } else {
      throw const HomeworkApiException('Secilen dosya okunamadi.');
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HomeworkApiException('Dosya yuklenemedi (${response.statusCode}).');
    }

    final payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final fileUrl = payload['fileUrl']?.toString().trim();
    final fileName = payload['fileName']?.toString().trim().isNotEmpty == true
        ? payload['fileName'].toString().trim()
        : file.name;
    final safeUrl = fileUrl == null || fileUrl.isEmpty ? fileName : fileUrl;
    return '$fileName::$safeUrl';
  }

  Future<List<Map<String, dynamic>>> fetchAssignments() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const HomeworkApiException('Oturum bulunamadi.');

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/homework'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HomeworkApiException('Odevler alinamadi (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => _normalizeAssignment(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> createAssignment({
    required String title,
    required String className,
    required String subject,
    required String teacher,
    required String deadline,
    required String description,
    required List<String> materials,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const HomeworkApiException('Oturum bulunamadi.');

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/homework'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'title': title,
        'className': className,
        'subject': subject,
        'teacher': teacher,
        'deadline': deadline,
        'description': description,
        'materials': materials,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HomeworkApiException('Odev kaydedilemedi (${response.statusCode}).');
    }

    return _normalizeAssignment(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<void> deleteAssignment(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const HomeworkApiException('Oturum bulunamadi.');

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/homework/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HomeworkApiException('Odev silinemedi (${response.statusCode}).');
    }
  }

  Future<Map<String, dynamic>> submitAssignment({
    required String assignmentId,
    required String studentName,
    required String note,
    required List<String> files,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const HomeworkApiException('Oturum bulunamadi.');

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/homework/$assignmentId/submit'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'studentName': studentName,
        'note': note,
        'files': files,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HomeworkApiException('Odev teslim edilemedi (${response.statusCode}).');
    }

    return _normalizeAssignment(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Map<String, dynamic> _normalizeAssignment(Map<String, dynamic> map) {
    final status = map['status'] as String? ?? 'Yeni';
    final statusColor = switch (status) {
      'Tamamlandi' => 0xFF69C36D,
      'Devam Ediyor' => 0xFFFFB020,
      _ => 0xFF4E8DF5,
    };

    return {
      ...map,
      'id': map['id']?.toString(),
      'deadline': map['deadline'] as String? ?? '',
      'materials': (map['materials'] as List<dynamic>? ?? const []).cast<String>(),
      'submissions': (map['submissions'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      'submitted': map['submitted'] as int? ?? 0,
      'total': map['total'] as int? ?? 25,
      'status': status,
      'statusColor': Color(statusColor),
      'accentColor': Color(status == 'Tamamlandi' ? 0xFF69C36D : 0xFFFF7A00),
    };
  }
}
