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
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
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
      throw const ContentApiException('Seçilen dosya okunamadı.');
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('Dosya yüklenemedi (${response.statusCode}).');
    }

    return ContentUploadRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<List<ContentRecord>> fetchContents({required bool visibleOnly}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/contents',
      ).replace(queryParameters: {'visibleOnly': visibleOnly.toString()}),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'İçerikler alınamadı (${response.statusCode}).',
      );
    }

    final records = (jsonDecode(response.body) as List<dynamic>)
        .map((item) => _mapRecord(Map<String, dynamic>.from(item as Map)))
        .toList();
    ContentStore.instance.replaceContents(records);
    return records;
  }

  Future<ContentRecord> createContent(ContentRecord record) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/contents'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'İçerik oluşturulamadı (${response.statusCode}).',
      );
    }

    final created = _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
    ContentStore.instance.addContent(created);
    return created;
  }

  Future<ContentRecord> updateContent(ContentRecord record) async {
    if (record.id == null) {
      throw const ContentApiException('İçerik kimliği bulunamadı.');
    }
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/${record.id}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'İçerik güncellenemedi (${response.statusCode}).',
      );
    }

    final updated = _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
    final existing = ContentStore.instance.contents
        .where((item) => item.id == updated.id)
        .firstOrNull;
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
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/$id/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({'publishStatus': publishStatus}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'Yayın durumu güncellenemedi (${response.statusCode}).',
      );
    }

    final updated = _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
    final existing = ContentStore.instance.contents
        .where((item) => item.id == updated.id)
        .firstOrNull;
    if (existing != null) {
      ContentStore.instance.updateContent(existing, updated);
    }
    return updated;
  }

  Future<void> deleteContent(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

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
      fileUrl: map['fileUrl'] as String?,
      coverImageUrl: map['coverImageUrl'] as String?,
      playlistKey: map['playlistKey'] as String?,
      playlistTitle: map['playlistTitle'] as String?,
      playlistOrder: (map['playlistOrder'] as num?)?.toInt(),
      allowDownload: map['allowDownload'] as bool? ?? true,
      allowNotes: map['allowNotes'] as bool? ?? true,
      completionCertificate: map['completionCertificate'] as bool? ?? false,
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
    'fileUrl': record.fileUrl,
    'coverImageUrl': record.coverImageUrl,
    'playlistKey': record.playlistKey,
    'playlistTitle': record.playlistTitle,
    'playlistOrder': record.playlistOrder,
    'allowDownload': record.allowDownload,
    'allowNotes': record.allowNotes,
    'completionCertificate': record.completionCertificate,
    'publishStatus': record.publishStatus,
  };

  Future<ContentEngagementRecord> fetchEngagement(String contentId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/$contentId/engagement'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'İçerik etkileşimleri alınamadı (${response.statusCode}).',
      );
    }

    return ContentEngagementRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> saveUserState({
    required String contentId,
    required double progress,
    required bool liked,
    required bool favorite,
    required String note,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/contents/$contentId/engagement/state'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'progress': progress.clamp(0, 100),
        'liked': liked,
        'favorite': favorite,
        'note': note,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException(
        'İçerik ilerlemesi kaydedilemedi (${response.statusCode}).',
      );
    }
  }

  Future<List<ContentCommentRecord>> addComment({
    required String contentId,
    required String message,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ContentApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/contents/$contentId/engagement/comments',
      ),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({'message': message}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ContentApiException('Yorum eklenemedi (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) => ContentCommentRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }
}

class ContentEngagementRecord {
  final String? coverImageUrl;
  final List<ContentExerciseRecord> exercises;
  final List<ContentCommentRecord> comments;
  final double progress;
  final bool liked;
  final bool favorite;
  final String note;

  const ContentEngagementRecord({
    this.coverImageUrl,
    required this.exercises,
    required this.comments,
    required this.progress,
    required this.liked,
    required this.favorite,
    required this.note,
  });

  factory ContentEngagementRecord.fromMap(Map<String, dynamic> map) {
    return ContentEngagementRecord(
      coverImageUrl: map['coverImageUrl'] as String?,
      exercises: ((map['exercises'] as List<dynamic>?) ?? const [])
          .map(
            (item) => ContentExerciseRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      comments: ((map['comments'] as List<dynamic>?) ?? const [])
          .map(
            (item) => ContentCommentRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      progress: (map['progress'] as num?)?.toDouble() ?? 0,
      liked: map['liked'] as bool? ?? false,
      favorite: map['favorite'] as bool? ?? false,
      note: map['note'] as String? ?? '',
    );
  }
}

class ContentExerciseRecord {
  final String id;
  final String title;
  final String description;
  final String url;

  const ContentExerciseRecord({
    required this.id,
    required this.title,
    required this.description,
    required this.url,
  });

  factory ContentExerciseRecord.fromMap(Map<String, dynamic> map) {
    return ContentExerciseRecord(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      url: map['url'] as String? ?? '',
    );
  }
}

class ContentCommentRecord {
  final String id;
  final String authorName;
  final String authorRole;
  final String message;

  const ContentCommentRecord({
    required this.id,
    required this.authorName,
    required this.authorRole,
    required this.message,
  });

  factory ContentCommentRecord.fromMap(Map<String, dynamic> map) {
    return ContentCommentRecord(
      id: map['id'] as String? ?? '',
      authorName: map['authorName'] as String? ?? 'Kullanıcı',
      authorRole: map['authorRole'] as String? ?? '',
      message: map['message'] as String? ?? '',
    );
  }
}

class ContentUploadRecord {
  final String fileName;
  final String? originalFileName;
  final String? fileType;
  final String? fileUrl;
  final int size;

  const ContentUploadRecord({
    required this.fileName,
    required this.originalFileName,
    required this.fileType,
    required this.fileUrl,
    required this.size,
  });

  factory ContentUploadRecord.fromMap(Map<String, dynamic> map) {
    return ContentUploadRecord(
      fileName: map['fileName'] as String,
      originalFileName: map['originalFileName'] as String?,
      fileType: map['fileType'] as String?,
      fileUrl: map['fileUrl'] as String?,
      size: (map['size'] as num?)?.toInt() ?? 0,
    );
  }
}
