import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class LibraryApiException implements Exception {
  final String message;

  const LibraryApiException(this.message);

  @override
  String toString() => message;
}

/// Kütüphane modülü API istemcisi: katalog, ödünç/iade, rezervasyon,
/// öneriler, istatistik ve ayarlar.
class LibraryApiService {
  LibraryApiService._();

  static final LibraryApiService instance = LibraryApiService._();

  Future<Map<String, String>> _headers({bool json = false}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const LibraryApiException('Oturum bulunamadı.');
    }
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      if (json) 'Content-Type': 'application/json',
      ...BranchScopeStore.instance.headers,
    };
  }

  Never _fail(http.Response response, String fallback) {
    String message = fallback;
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      }
    } catch (_) {}
    throw LibraryApiException('$message (${response.statusCode})');
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path')
          .replace(queryParameters: query == null || query.isEmpty ? null : query),
      headers: await _headers(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _fail(response, 'Kütüphane verisi alınamadı');
    }
    return jsonDecode(utf8.decode(response.bodyBytes));
  }

  Future<dynamic> _send(String method, String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = await _headers(json: true);
    final encoded = jsonEncode(body);
    final http.Response response;
    switch (method) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: encoded);
      case 'PUT':
        response = await http.put(uri, headers: headers, body: encoded);
      case 'PATCH':
        response = await http.patch(uri, headers: headers, body: encoded);
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
      default:
        throw const LibraryApiException('Geçersiz istek.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _fail(response, 'İşlem tamamlanamadı');
    }
    return response.body.isEmpty ? null : jsonDecode(utf8.decode(response.bodyBytes));
  }

  List<Map<String, dynamic>> _asList(dynamic value) =>
      (value as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

  Future<List<Map<String, dynamic>>> fetchBooks({String? search}) async =>
      _asList(await _get('/api/library/books',
          search == null || search.isEmpty ? null : {'search': search}));

  Future<Map<String, dynamic>> createBook(Map<String, dynamic> payload) async =>
      Map<String, dynamic>.from(await _send('POST', '/api/library/books', payload) as Map);

  Future<Map<String, dynamic>> lookupIsbn(String isbn) async =>
      Map<String, dynamic>.from(
          await _get('/api/library/isbn-lookup', {'isbn': isbn}) as Map);

  Future<List<Map<String, dynamic>>> fetchLoans({bool activeOnly = false}) async =>
      _asList(await _get('/api/library/loans', {'activeOnly': '$activeOnly'}));

  Future<void> checkout({required String bookId, required String studentName, String className = ''}) =>
      _send('POST', '/api/library/loans',
          {'bookId': bookId, 'studentName': studentName, 'className': className});

  Future<Map<String, dynamic>> returnLoan(String id) async =>
      Map<String, dynamic>.from(
          await _send('PATCH', '/api/library/loans/$id/return', const {}) as Map);

  Future<void> extendLoan(String id) =>
      _send('PATCH', '/api/library/loans/$id/extend', const {});

  Future<Map<String, dynamic>> sendReminders() async =>
      Map<String, dynamic>.from(
          await _send('POST', '/api/library/reminders', const {}) as Map);

  Future<Map<String, dynamic>> reserve(String bookId) async =>
      Map<String, dynamic>.from(
          await _send('POST', '/api/library/reservations', {'bookId': bookId}) as Map);

  Future<void> cancelReservation(String id) =>
      _send('DELETE', '/api/library/reservations/$id', const {});

  Future<void> recommend(Map<String, dynamic> payload) =>
      _send('POST', '/api/library/recommendations', payload);

  Future<List<Map<String, dynamic>>> fetchRecommendations() async =>
      _asList(await _get('/api/library/recommendations'));

  Future<Map<String, dynamic>> fetchMy() async =>
      Map<String, dynamic>.from(await _get('/api/library/my') as Map);

  Future<List<Map<String, dynamic>>> fetchParentChildren() async =>
      _asList(await _get('/api/library/parent/children'));

  Future<Map<String, dynamic>> fetchStats() async =>
      Map<String, dynamic>.from(await _get('/api/library/stats') as Map);
}
