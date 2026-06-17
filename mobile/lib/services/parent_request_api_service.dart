import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class ParentRequestApiException implements Exception {
  final String message;
  const ParentRequestApiException(this.message);
  @override
  String toString() => message;
}

/// Veli talepleri (erken çıkış/izin/onam) — merkezi onay motoruna düşer.
class ParentRequestApiService {
  ParentRequestApiService._();
  static final ParentRequestApiService instance = ParentRequestApiService._();

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ParentRequestApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }
    return session;
  }

  Future<List<Map<String, dynamic>>> getMyRequests() async {
    final session = await _session();
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/approvals/mine'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ParentRequestApiException('Talepler alınamadı (${response.statusCode}).');
    }
    return (jsonDecode(response.body) as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> createRequest({
    required String category,
    required String title,
    String? description,
    String? priority,
  }) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/approvals'),
      headers: {'Authorization': 'Bearer ${session.accessToken}', 'Content-Type': 'application/json'},
      body: jsonEncode({
        'category': category,
        'title': title,
        'description': ?description,
        'priority': ?priority,
        'unit': 'Veli',
        'referenceType': 'ParentRequest',
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ParentRequestApiException('Talep gönderilemedi (${response.statusCode}).');
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }
}
