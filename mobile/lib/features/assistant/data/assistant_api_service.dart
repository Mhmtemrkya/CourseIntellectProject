import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:student/services/api_config.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/branch_scope_store.dart';

import 'assistant_models.dart';

class AssistantApiException implements Exception {
  final String message;
  const AssistantApiException(this.message);
  @override
  String toString() => message;
}

class AssistantApiService {
  AssistantApiService._();
  static final instance = AssistantApiService._();

  Future<Map<String, String>> _headers() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AssistantApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yapın.',
      );
    }
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
      ...ScopeHeaders.merged,
    };
  }

  Future<List<AssistantSuggestionModel>> suggestions() async {
    final response = await http
        .get(
          Uri.parse('${ApiConfig.baseUrl}/api/assistant/suggestions'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 20));
    final body = _decode(response);
    return (body as List<dynamic>)
        .whereType<Map>()
        .map(
          (x) =>
              AssistantSuggestionModel.fromJson(Map<String, dynamic>.from(x)),
        )
        .toList();
  }

  Future<AssistantMessageModel> send({
    required String message,
    String? conversationId,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiConfig.baseUrl}/api/assistant/messages'),
          headers: await _headers(),
          body: jsonEncode({
            'conversationId': conversationId,
            'message': message,
            'clientMessageId': _uuid(),
            'context': {
              'currentRoute': 'mobile/assistant',
              'selectedStudentId': null,
            },
          }),
        )
        .timeout(const Duration(seconds: 30));
    return AssistantMessageModel.fromJson(
      Map<String, dynamic>.from(_decode(response) as Map),
    );
  }

  Future<AssistantMessageModel> action({
    required String conversationId,
    required String command,
    String? studentId,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiConfig.baseUrl}/api/assistant/actions'),
          headers: await _headers(),
          body: jsonEncode({
            'conversationId': conversationId,
            'command': command,
            'studentId': studentId,
          }),
        )
        .timeout(const Duration(seconds: 30));
    return AssistantMessageModel.fromJson(
      Map<String, dynamic>.from(_decode(response) as Map),
    );
  }

  dynamic _decode(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      body = null;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return body;
    if (response.statusCode == 429) {
      throw const AssistantApiException(
        'Çok hızlı mesaj gönderdiniz. Lütfen kısa bir süre bekleyin.',
      );
    }
    if (response.statusCode == 401) {
      throw const AssistantApiException(
        'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
      );
    }
    throw AssistantApiException(
      body is Map && body['message'] != null
          ? '${body['message']}'
          : 'Asistan servisine ulaşılamadı.',
    );
  }

  String _uuid() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int value) => value.toRadixString(16).padLeft(2, '0');
    final value = bytes.map(hex).join();
    return '${value.substring(0, 8)}-${value.substring(8, 12)}-${value.substring(12, 16)}-${value.substring(16, 20)}-${value.substring(20)}';
  }
}
