import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'content_store.dart';

class ContentApiException implements Exception {
  final String message;

  const ContentApiException(this.message);

  @override
  String toString() => message;
}

class ContentApiService {
  ContentApiService._();

  static final ContentApiService instance = ContentApiService._();

  Future<ContentUploadRecord> uploadContentAsset({
    required PlatformFile file,
    String folder = 'teacher-content',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

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
      throw const ContentApiException('Secilen dosya okunamadi.');
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('Dosya yuklenemedi (${response.statusCode}).');
    }

    return ContentUploadRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<List<ContentRecord>> fetchContents({required bool visibleOnly}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/contents').replace(
        queryParameters: {'visibleOnly': visibleOnly.toString()},
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('İçerikler alınamadı (${response.statusCode}).');
    }

    final records = (jsonDecode(response.body) as List<dynamic>)
        .map((item) => _mapRecord(Map<String, dynamic>.from(item as Map)))
        .toList();
    ContentStore.instance.replaceContents(records);
    return records;
  }

  Future<ContentRecord> createContent(ContentRecord record) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/contents'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('İçerik oluşturulamadı (${response.statusCode}).');
    }

    final created = _mapRecord(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
    ContentStore.instance.addContent(created);
    return created;
  }

  Future<ContentRecord> updateContent(ContentRecord record) async {
    if (record.id == null) throw const ContentApiException('İçerik kimliği bulunamadı.');
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/${record.id}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('İçerik güncellenemedi (${response.statusCode}).');
    }

    final updated = _mapRecord(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
    final existing = ContentStore.instance.contents.where((item) => item.id == updated.id).firstOrNull;
    if (existing != null) {
      ContentStore.instance.updateContent(existing, updated);
    }
    return updated;
  }

  Future<ContentRecord> updateStatus({
    required String id,
    required String publishStatus,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/$id/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({'publishStatus': publishStatus}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('Yayın durumu güncellenemedi (${response.statusCode}).');
    }

    final updated = _mapRecord(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
    final existing = ContentStore.instance.contents.where((item) => item.id == updated.id).firstOrNull;
    if (existing != null) {
      ContentStore.instance.updateContent(existing, updated);
    }
    return updated;
  }

  Future<void> deleteContent(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw const ContentApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('İçerik silinemedi (${response.statusCode}).');
    }

    ContentStore.instance.removeById(id);
  }

  static ContentRecord _mapRecord(Map<String, dynamic> map) {
    final progressValue = (map['progress'] as num?)?.toDouble() ?? 0;
    return ContentRecord(
      id: map['id'] as String?,
      subject: map['subject'] as String,
      title: map['title'] as String,
      teacher: map['teacher'] as String,
      info: map['info'] as String,
      progress: progressValue > 1 ? progressValue / 100 : progressValue,
      fileType: map['fileType'] as String,
      grade: map['grade'] as String,
      views: map['views'] as String,
      size: map['size'] as String,
      description: map['description'] as String,
      fileName: map['fileName'] as String?,
      playlistKey: map['playlistKey'] as String?,
      playlistTitle: map['playlistTitle'] as String?,
      playlistOrder: (map['playlistOrder'] as num?)?.toInt(),
      publishStatus: map['publishStatus'] as String,
    );
  }

  static Map<String, dynamic> _toPayload(ContentRecord record) => {
        'subject': record.subject,
        'title': record.title,
        'teacher': record.teacher,
        'info': record.info,
        'progress': record.progress <= 1 ? record.progress * 100 : record.progress,
        'fileType': record.fileType,
        'grade': record.grade,
        'views': record.views,
        'size': record.size,
        'description': record.description,
        'fileName': record.fileName,
        'playlistKey': record.playlistKey,
        'playlistTitle': record.playlistTitle,
        'playlistOrder': record.playlistOrder,
        'publishStatus': record.publishStatus,
      };
}

class ContentUploadRecord {
  final String fileName;
  final String? originalFileName;
  final String? fileType;
  final int size;

  const ContentUploadRecord({
    required this.fileName,
    required this.originalFileName,
    required this.fileType,
    required this.size,
  });

  factory ContentUploadRecord.fromMap(Map<String, dynamic> map) {
    return ContentUploadRecord(
      fileName: map['fileName'] as String,
      originalFileName: map['originalFileName'] as String?,
      fileType: map['fileType'] as String?,
      size: (map['size'] as num?)?.toInt() ?? 0,
    );
  }
}
