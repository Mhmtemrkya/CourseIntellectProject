import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import 'api_config.dart';
import 'auth_session_store.dart';

class MaterialDownloadException implements Exception {
  final String message;

  const MaterialDownloadException(this.message);

  @override
  String toString() => message;
}

class MaterialDownloadService {
  MaterialDownloadService._();

  static final MaterialDownloadService instance = MaterialDownloadService._();

  Future<String> downloadAndOpen({
    required String fileName,
    required String url,
  }) async {
    final resolvedUrl = ApiConfig.resolveAssetUrl(url);
    if (resolvedUrl.isEmpty || Uri.tryParse(resolvedUrl) == null) {
      throw const MaterialDownloadException('Dosya bağlantısı bulunamadı.');
    }

    final session = await AuthSessionStore.instance.load();
    final response = await http.get(
      Uri.parse(resolvedUrl),
      headers: {
        if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
      },
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MaterialDownloadException(
        'Dosya indirilemedi (${response.statusCode}).',
      );
    }

    final directory = await getApplicationDocumentsDirectory();
    final downloadsDir = Directory('${directory.path}/CourseIntellect');
    if (!await downloadsDir.exists()) {
      await downloadsDir.create(recursive: true);
    }

    final safeName = _safeFileName(fileName);
    final target = File('${downloadsDir.path}/$safeName');
    await target.writeAsBytes(response.bodyBytes, flush: true);

    final result = await OpenFilex.open(target.path);
    if (result.type != ResultType.done) {
      throw MaterialDownloadException(
        result.message.isNotEmpty ? result.message : 'Dosya açılamadı.',
      );
    }

    return target.path;
  }

  String _safeFileName(String raw) {
    final name = raw.trim().isEmpty ? 'materyal' : raw.trim();
    final sanitized = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    return sanitized.length > 120 ? sanitized.substring(0, 120) : sanitized;
  }
}
