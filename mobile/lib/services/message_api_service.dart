import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class MessageApiException implements Exception {
  final String message;

  const MessageApiException(this.message);

  @override
  String toString() => message;
}

class MessageThreadRecord {
  final String id;
  final String contactName;
  final String contactRole;
  final String lastMessagePreview;
  final DateTime lastMessageAt;
  final int unreadCount;
  final bool lastMessageFromMe;
  final String lastMessageStatus;

  const MessageThreadRecord({
    required this.id,
    required this.contactName,
    required this.contactRole,
    required this.lastMessagePreview,
    required this.lastMessageAt,
    required this.unreadCount,
    required this.lastMessageFromMe,
    required this.lastMessageStatus,
  });

  factory MessageThreadRecord.fromMap(Map<String, dynamic> map) {
    return MessageThreadRecord(
      id: map['id'] as String,
      contactName: map['contactName'] as String,
      contactRole: map['contactRole'] as String,
      lastMessagePreview: map['lastMessagePreview'] as String,
      lastMessageAt: DateTime.parse(map['lastMessageAtUtc'] as String),
      unreadCount: (map['unreadCount'] as num?)?.toInt() ?? 0,
      lastMessageFromMe: map['lastMessageFromMe'] as bool? ?? false,
      lastMessageStatus: (map['lastMessageStatus'] as String? ?? 'sent')
          .toLowerCase(),
    );
  }
}

class MessageAttachmentRecord {
  final String fileName;
  final String originalFileName;
  final String fileUrl;
  final String fileType;
  final int size;

  const MessageAttachmentRecord({
    required this.fileName,
    required this.originalFileName,
    required this.fileUrl,
    required this.fileType,
    required this.size,
  });

  String get absoluteUrl {
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }

    return '${ApiConfig.baseUrl}$fileUrl';
  }

  bool get isImage {
    final type = fileType.toLowerCase();
    final name = '$originalFileName $fileName $fileUrl'.toLowerCase();
    return type == 'image' ||
        type.startsWith('image/') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.gif') ||
        name.endsWith('.webp') ||
        name.endsWith('.heic');
  }

  bool get isVideo {
    final type = fileType.toLowerCase();
    final name = '$originalFileName $fileName $fileUrl'.toLowerCase();
    return type == 'video' ||
        type.startsWith('video/') ||
        name.endsWith('.mp4') ||
        name.endsWith('.mov') ||
        name.endsWith('.m4v') ||
        name.endsWith('.webm');
  }

  factory MessageAttachmentRecord.fromMap(Map<String, dynamic> map) {
    return MessageAttachmentRecord(
      fileName: map['fileName'] as String? ?? '',
      originalFileName:
          map['originalFileName'] as String? ??
          map['fileName'] as String? ??
          '',
      fileUrl: map['fileUrl'] as String? ?? '',
      fileType:
          ((map['fileType'] as String?) ??
                  (map['contentType'] as String?) ??
                  'file')
              .toLowerCase(),
      size: (map['size'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() => {
    'fileName': fileName,
    'originalFileName': originalFileName,
    'fileUrl': fileUrl,
    'fileType': fileType,
    'size': size,
  };
}

class MessageItemRecord {
  final String id;
  final String threadId;
  final String senderName;
  final String senderRole;
  final bool isFromCurrentActor;
  final String text;
  final bool isRead;
  final DateTime? deliveredAt;
  final DateTime? readAt;
  final String status;
  final List<MessageAttachmentRecord> attachments;
  final DateTime sentAt;

  const MessageItemRecord({
    required this.id,
    required this.threadId,
    required this.senderName,
    required this.senderRole,
    required this.isFromCurrentActor,
    required this.text,
    required this.isRead,
    required this.deliveredAt,
    required this.readAt,
    required this.status,
    required this.attachments,
    required this.sentAt,
  });

  factory MessageItemRecord.fromMap(Map<String, dynamic> map) {
    return MessageItemRecord(
      id: map['id'] as String,
      threadId: map['threadId'] as String,
      senderName: map['senderName'] as String,
      senderRole: map['senderRole'] as String,
      isFromCurrentActor: map['isFromCurrentActor'] as bool? ?? false,
      text: map['text'] as String,
      isRead: map['isRead'] as bool,
      deliveredAt: map['deliveredAtUtc'] == null
          ? null
          : DateTime.parse(map['deliveredAtUtc'] as String),
      readAt: map['readAtUtc'] == null
          ? null
          : DateTime.parse(map['readAtUtc'] as String),
      status: (map['status'] as String? ?? 'sent').toLowerCase(),
      attachments: (map['attachments'] as List<dynamic>? ?? const [])
          .map(
            (item) => MessageAttachmentRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      sentAt: DateTime.parse(map['sentAtUtc'] as String),
    );
  }
}

class MessageApiService {
  MessageApiService._();

  static final MessageApiService instance = MessageApiService._();

  Future<List<MessageThreadRecord>> fetchThreads() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/messages/threads'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException(
        'Mesaj listesi alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) => MessageThreadRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<MessageItemRecord>> fetchMessages(String threadId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/messages/threads/$threadId'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException(
        'Sohbet mesajları alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) =>
              MessageItemRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<MessageThreadRecord> createOrGetThread({
    required String contactName,
    required String contactRole,
    String? contactKey,
    String? initialMessage,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/messages/threads'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'contactName': _normalize(contactName),
        'contactRole': contactRole,
        'contactKey': contactKey,
        'initialMessage': initialMessage,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException(
        'Sohbet oluşturulamadı (${response.statusCode}).',
      );
    }

    return MessageThreadRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<MessageItemRecord> sendMessage({
    required String threadId,
    String text = '',
    List<MessageAttachmentRecord> attachments = const [],
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/messages/threads/$threadId/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'text': text.trim(),
        'attachments': attachments.map((item) => item.toMap()).toList(),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException(
        'Mesaj gönderilemedi (${response.statusCode}).',
      );
    }

    return MessageItemRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deleteForMe({
    required String threadId,
    required String messageId,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.delete(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/messages/threads/$threadId/messages/$messageId/me',
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException(
        'Mesaj kaldırılamadı (${response.statusCode}).',
      );
    }
  }

  Future<MessageAttachmentRecord> uploadAttachment({
    required File file,
    required String fileName,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const MessageApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final request = MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/uploads?folder=messages'),
    );
    request.headers['Authorization'] = 'Bearer ${session.accessToken}';
    request.files.add(
      await MultipartFile.fromPath('file', file.path, filename: fileName),
    );

    final streamed = await request.send();
    final response = await Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MessageApiException('Dosya yüklenemedi (${response.statusCode}).');
    }

    return MessageAttachmentRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  static String _normalize(String value) {
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
}
