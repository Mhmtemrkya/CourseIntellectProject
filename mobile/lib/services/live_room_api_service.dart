import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class LiveRoomApiException implements Exception {
  final String message;

  const LiveRoomApiException(this.message);

  @override
  String toString() => message;
}

class LiveRoomAssetRecord {
  final String id;
  final String fileName;

  const LiveRoomAssetRecord({required this.id, required this.fileName});
}

class LiveRoomNoteRecord {
  final String id;
  final String text;

  const LiveRoomNoteRecord({required this.id, required this.text});
}

class LiveRoomSessionRecord {
  final String id;
  final String lessonTitle;
  final String teacherName;
  final String className;
  final String timeLabel;
  final String meetingLink;
  final bool micOn;
  final bool cameraOn;
  final bool sharingOn;
  final bool recordingOn;
  final String status;
  final List<String> participants;
  final List<LiveRoomAssetRecord> assets;
  final List<LiveRoomNoteRecord> notes;

  const LiveRoomSessionRecord({
    required this.id,
    required this.lessonTitle,
    required this.teacherName,
    required this.className,
    required this.timeLabel,
    required this.meetingLink,
    required this.micOn,
    required this.cameraOn,
    required this.sharingOn,
    required this.recordingOn,
    required this.status,
    required this.participants,
    required this.assets,
    required this.notes,
  });
}

class LiveRoomApiService {
  LiveRoomApiService._();

  static final LiveRoomApiService instance = LiveRoomApiService._();

  Future<LiveRoomSessionRecord> openRoom({
    required String lessonTitle,
    required String teacherName,
    required String className,
    required String timeLabel,
  }) async {
    final session = await _session();

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/liveroomsessions/open'),
      headers: _jsonHeaders(session.accessToken),
      body: jsonEncode({
        'lessonTitle': lessonTitle,
        'teacherName': teacherName,
        'className': className,
        'timeLabel': timeLabel,
      }),
    );

    return _mapOrThrow(response, fallback: 'Canlı oda acilamadi.');
  }

  Future<LiveRoomSessionRecord> updateState(
    String roomId, {
    bool? micOn,
    bool? cameraOn,
    bool? sharingOn,
    bool? recordingOn,
  }) async {
    final session = await _session();
    final payload = <String, dynamic>{};
    if (micOn != null) payload['micOn'] = micOn;
    if (cameraOn != null) payload['cameraOn'] = cameraOn;
    if (sharingOn != null) payload['sharingOn'] = sharingOn;
    if (recordingOn != null) payload['recordingOn'] = recordingOn;
    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/liveroomsessions/$roomId/state'),
      headers: _jsonHeaders(session.accessToken),
      body: jsonEncode(payload),
    );

    return _mapOrThrow(response, fallback: 'Canlı oda durumu güncellenemedi.');
  }

  Future<LiveRoomSessionRecord> addAsset(String roomId, String fileName) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/liveroomsessions/$roomId/assets'),
      headers: _jsonHeaders(session.accessToken),
      body: jsonEncode({'fileName': fileName}),
    );

    return _mapOrThrow(response, fallback: 'Dosya kaydı eklenemedi.');
  }

  Future<LiveRoomSessionRecord> addNote(String roomId, String text) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/liveroomsessions/$roomId/notes'),
      headers: _jsonHeaders(session.accessToken),
      body: jsonEncode({'text': text}),
    );

    return _mapOrThrow(response, fallback: 'Ders notu eklenemedi.');
  }

  Future<LiveRoomSessionRecord> endRoom(String roomId) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/liveroomsessions/$roomId/end'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    return _mapOrThrow(response, fallback: 'Canlı ders sonlandirilamadi.');
  }

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const LiveRoomApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }

  LiveRoomSessionRecord _mapOrThrow(
    http.Response response, {
    required String fallback,
  }) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LiveRoomApiException(
        _extractMessage(response.body) ?? '$fallback (${response.statusCode}).',
      );
    }

    return _mapSession(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  LiveRoomSessionRecord _mapSession(Map<String, dynamic> map) {
    return LiveRoomSessionRecord(
      id: map['id'] as String,
      lessonTitle: map['lessonTitle'] as String? ?? '',
      teacherName: map['teacherName'] as String? ?? '',
      className: map['className'] as String? ?? '',
      timeLabel: map['timeLabel'] as String? ?? '',
      meetingLink: map['meetingLink'] as String? ?? '',
      micOn: map['micOn'] as bool? ?? true,
      cameraOn: map['cameraOn'] as bool? ?? true,
      sharingOn: map['sharingOn'] as bool? ?? false,
      recordingOn: map['recordingOn'] as bool? ?? false,
      status: map['status'] as String? ?? 'Active',
      participants: (map['participants'] as List<dynamic>? ?? const [])
          .cast<String>(),
      assets: (map['assets'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => LiveRoomAssetRecord(
              id: item['id'] as String,
              fileName: item['fileName'] as String,
            ),
          )
          .toList(),
      notes: (map['notes'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => LiveRoomNoteRecord(
              id: item['id'] as String,
              text: item['text'] as String,
            ),
          )
          .toList(),
    );
  }

  static Map<String, String> _jsonHeaders(String accessToken) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $accessToken',
  };

  static String? _extractMessage(String rawBody) {
    if (rawBody.isEmpty) return null;
    try {
      final body = jsonDecode(rawBody);
      if (body is Map<String, dynamic>) {
        final message = body['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message;
        }
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}
