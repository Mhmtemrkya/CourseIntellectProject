import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class QuestionThreadApiException implements Exception {
  final String message;

  const QuestionThreadApiException(this.message);

  @override
  String toString() => message;
}

class QuestionThreadApiService {
  QuestionThreadApiService._();

  static final QuestionThreadApiService instance = QuestionThreadApiService._();

  Future<List<Map<String, dynamic>>> fetchThreads() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionThreadApiException('Oturum bulunamadı.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/questionthreads'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionThreadApiException(
        'Soru listesi alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> createThread({
    required String title,
    required String subject,
    required String teacherName,
    required String questionText,
    required List<QuestionThreadAttachmentRecord> attachments,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionThreadApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/questionthreads'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'title': title,
        'subject': subject,
        'teacherName': teacherName,
        'questionText': questionText,
        'attachments': attachments.map((item) => item.toPayload()).toList(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionThreadApiException(
        'Soru gönderilemedi (${response.statusCode}).',
      );
    }

    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> replyToThread({
    required String threadId,
    required String messageText,
    required List<QuestionThreadAttachmentRecord> attachments,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionThreadApiException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/questionthreads/$threadId/replies'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'messageText': messageText,
        'attachments': attachments.map((item) => item.toPayload()).toList(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionThreadApiException(
        'Yanit gönderilemedi (${response.statusCode}).',
      );
    }

    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<QuestionThreadAttachmentRecord> uploadAttachment({
    required PlatformFile file,
    String folder = 'question-threads',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionThreadApiException('Oturum bulunamadı.');
    }

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
      throw const QuestionThreadApiException('Seçilen dosya okunamadı.');
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionThreadApiException(
        'Dosya yüklenemedi (${response.statusCode}).',
      );
    }

    final payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return QuestionThreadAttachmentRecord(
      fileName: payload['originalFileName'] as String? ?? file.name,
      fileUrl:
          payload['fileUrl'] as String? ?? payload['fileName'] as String? ?? '',
      fileType: payload['fileType'] as String? ?? _resolveFileType(file.name),
    );
  }

  static String resolveFileType(String fileName) {
    return _resolveFileType(fileName);
  }

  static String _resolveFileType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png')) {
      return 'image';
    }
    if (lower.endsWith('.m4a') || lower.endsWith('.mp3')) {
      return 'audio';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'file';
  }
}

class QuestionThreadAttachmentRecord {
  final String fileName;
  final String fileUrl;
  final String fileType;

  const QuestionThreadAttachmentRecord({
    required this.fileName,
    required this.fileUrl,
    required this.fileType,
  });

  Map<String, dynamic> toPayload() => {
    'fileName': fileName,
    'fileUrl': fileUrl,
    'fileType': fileType,
  };

  factory QuestionThreadAttachmentRecord.fromMap(Map<String, dynamic> map) {
    return QuestionThreadAttachmentRecord(
      fileName: map['fileName']?.toString() ?? 'ek',
      fileUrl: map['fileUrl']?.toString() ?? '',
      fileType: map['fileType']?.toString() ?? 'file',
    );
  }
}
