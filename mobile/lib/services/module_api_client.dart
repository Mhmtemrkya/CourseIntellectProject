import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class ModuleApiException implements Exception {
  final String message;
  final int statusCode;
  const ModuleApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}

/// Yeni modüllerin (zümre, kulüp, ziyaretçi, tercih robotu) ortak HTTP istemcisi:
/// oturum + şube başlıkları, sunucunun anlaşılır hata metni.
class ModuleApiClient {
  ModuleApiClient._();
  static final ModuleApiClient instance = ModuleApiClient._();

  Future<Map<String, String>> _headers({bool json = false}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ModuleApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 401);
    }
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      if (json) 'Content-Type': 'application/json',
      ...ScopeHeaders.merged,
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final clean = {...?query}..removeWhere((_, value) => value.isEmpty);
    return clean.isEmpty ? uri : uri.replace(queryParameters: clean);
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) async =>
      _decode(await http.get(_uri(path, query), headers: await _headers()));

  Future<dynamic> post(String path, Object? body) async => _decode(await http.post(
        _uri(path),
        headers: await _headers(json: true),
        body: jsonEncode(body ?? const {}),
      ));

  Future<dynamic> put(String path, Object? body) async => _decode(await http.put(
        _uri(path),
        headers: await _headers(json: true),
        body: jsonEncode(body ?? const {}),
      ));

  Future<dynamic> delete(String path) async =>
      _decode(await http.delete(_uri(path), headers: await _headers()));

  dynamic _decode(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ModuleApiException(_message(response), response.statusCode);
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(utf8.decode(response.bodyBytes));
  }

  static String _message(http.Response response) {
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is Map && body['message'] is String && (body['message'] as String).trim().isNotEmpty) {
        return (body['message'] as String).trim();
      }
    } catch (_) {}
    return switch (response.statusCode) {
      401 => 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
      403 => 'Bu işlem için yetkiniz bulunmuyor.',
      404 => 'Kayıt bulunamadı.',
      _ => 'İşlem tamamlanamadı (${response.statusCode}).',
    };
  }
}

List<Map<String, dynamic>> asMapList(Object? value) =>
    (value as List? ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();

Map<String, dynamic> asMap(Object? value) => Map<String, dynamic>.from((value as Map?) ?? const {});

List<Object?> asList(Object? value) => List<Object?>.from((value as List?) ?? const []);
