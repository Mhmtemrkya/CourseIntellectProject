import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

/// Hesap & kurum silme uçları (/api/account-deletion, /api/institution-deletion).
/// Reauth (parola) sunucuda doğrulanır; istemci yalnız iletir.
class AccountDeletionApiService {
  AccountDeletionApiService._();
  static final instance = AccountDeletionApiService._();

  Future<Map<String, String>> _headers({bool json = false}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      if (json) 'Content-Type': 'application/json',
      ...ScopeHeaders.merged,
    };
  }

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  String _error(http.Response response, String operation) {
    try {
      final payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
      final message = payload['message']?.toString().trim() ?? '';
      if (message.isNotEmpty) return message;
    } catch (_) {}
    return switch (response.statusCode) {
      401 => 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
      403 => 'Parola doğrulanamadı veya yetkiniz yok.',
      _ => '$operation tamamlanamadı.',
    };
  }

  Map<String, dynamic> _decode(http.Response response, String operation) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_error(response, operation));
    }
    if (response.body.isEmpty) return const {};
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  // ---- Kişisel hesap silme ----

  Future<Map<String, dynamic>> requestAccountDeletion({
    required String password,
    String? successorAdminUserId,
  }) async {
    final response = await http.post(
      _uri('/api/account-deletion/request'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'password': password,
        'confirm': true,
        'successorAdminUserId': ?successorAdminUserId,
      }),
    );
    return _decode(response, 'Silme talebi');
  }

  Future<Map<String, dynamic>> getMyAccountDeletion() async {
    final response = await http.get(_uri('/api/account-deletion/mine'), headers: await _headers());
    return _decode(response, 'Durum');
  }

  Future<Map<String, dynamic>> cancelMyAccountDeletion() async {
    final response = await http.post(_uri('/api/account-deletion/mine/cancel'), headers: await _headers());
    return _decode(response, 'İptal');
  }

  /// Tek yönetici kendini silerken yönetimi devredebileceği adaylar.
  Future<List<Map<String, dynamic>>> getSuccessorCandidates() async {
    final response = await http.get(_uri('/api/account-deletion/successor-candidates'), headers: await _headers());
    if (response.statusCode < 200 || response.statusCode >= 300) return const [];
    final decoded = jsonDecode(response.body);
    return decoded is List ? decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList() : const [];
  }

  /// Kurum yöneticisi: kurumdaki kişisel silme talepleri (yalnız görüntüleme).
  Future<List<Map<String, dynamic>>> getTenantQueue() async {
    final response = await http.get(_uri('/api/account-deletion'), headers: await _headers());
    if (response.statusCode < 200 || response.statusCode >= 300) return const [];
    final decoded = jsonDecode(response.body);
    return decoded is List ? decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList() : const [];
  }

  // ---- Kurum silme (yalnız yönetici) ----

  Future<Map<String, dynamic>> requestInstitutionDeletion({required String password}) async {
    final response = await http.post(
      _uri('/api/institution-deletion/request'),
      headers: await _headers(json: true),
      body: jsonEncode({'password': password, 'confirm': true}),
    );
    return _decode(response, 'Kurum silme talebi');
  }

  Future<Map<String, dynamic>> getMyInstitutionDeletion() async {
    final response = await http.get(_uri('/api/institution-deletion/mine'), headers: await _headers());
    return _decode(response, 'Durum');
  }
}
