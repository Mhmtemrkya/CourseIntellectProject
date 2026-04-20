import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class UploadsApiException implements Exception {
  final String message;

  const UploadsApiException(this.message);

  @override
  String toString() => message;
}

class UploadedAsset {
  final String fileName;
  final String fileUrl;
  final String contentType;
  final int size;

  const UploadedAsset({
    required this.fileName,
    required this.fileUrl,
    required this.contentType,
    required this.size,
  });

  factory UploadedAsset.fromMap(Map<String, dynamic> map) {
    return UploadedAsset(
      fileName: (map['fileName'] ?? '').toString(),
      fileUrl: (map['fileUrl'] ?? '').toString(),
      contentType: (map['contentType'] ?? '').toString(),
      size: (map['size'] is num) ? (map['size'] as num).toInt() : 0,
    );
  }
}

class UploadsApiService {
  UploadsApiService._();

  static final UploadsApiService instance = UploadsApiService._();

  Future<UploadedAsset> uploadFile({
    required File file,
    String folder = 'general',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const UploadsApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/uploads'),
    );
    request.headers['Authorization'] = 'Bearer ${session.accessToken}';
    request.fields['folder'] = folder;

    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw UploadsApiException('Dosya yüklenemedi (${response.statusCode}).');
    }

    return UploadedAsset.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<UploadedAsset> uploadBytes({
    required List<int> bytes,
    required String fileName,
    String folder = 'general',
    String contentType = 'application/octet-stream',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const UploadsApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/uploads/json?folder=$folder'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'fileName': fileName,
        'base64Content': base64Encode(bytes),
        'contentType': contentType,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw UploadsApiException('Dosya yüklenemedi (${response.statusCode}).');
    }

    return UploadedAsset.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }
}
