import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';
import 'package:student/utils/log_ignored.dart';

/// Genel finans modülünün işletme giderleri uçları (/api/finance/expenses).
class ExpensesApiService {
  ExpensesApiService._();
  static final instance = ExpensesApiService._();

  String _errorMessage(http.Response response, String operation) {
    Map<String, dynamic>? payload;
    try {
      payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    } catch (e) { logIgnored('expenses_api_service', e); }

    final traceId = payload?['traceId']?.toString();
    final trace = traceId == null || traceId.isEmpty
        ? ''
        : ' Takip kodu: $traceId.';
    if (response.statusCode >= 500) {
      return '$operation sırasında beklenmeyen bir sorun oluştu. '
          'Kısa bir süre sonra tekrar deneyin; sorun devam ederse destek ekibine başvurun.$trace';
    }

    final serverMessage = payload?['message']?.toString().trim() ?? '';
    final technical = RegExp(
      r'request failed|internal server error|http error|status code|işlem başarısız \(\d+\)',
      caseSensitive: false,
    ).hasMatch(serverMessage);
    final fallback = switch (response.statusCode) {
      401 =>
        'Oturumunuz sona erdi. Lütfen yeniden giriş yapıp işlemi tekrar deneyin.',
      403 =>
        'Bu işlem için yetkiniz bulunmuyor. Kurum yöneticinizden gerekli yetkiyi isteyin.',
      404 => 'İstenen kayıt bulunamadı. Listeyi yenileyip kaydı yeniden seçin.',
      409 =>
        'İşlem güncel kayıtla çakıştı. Bilgileri yenileyip tekrar deneyin.',
      429 =>
        'Kısa sürede çok fazla işlem yapıldı. Biraz bekleyip tekrar deneyin.',
      _ =>
        '$operation tamamlanamadı. Bilgileri ve zorunlu alanları kontrol edip tekrar deneyin.',
    };
    final message = serverMessage.isEmpty || technical
        ? fallback
        : serverMessage;
    final reason = payload?['reason']?.toString().trim();
    final action = payload?['action']?.toString().trim();
    return '$message'
        '${reason == null || reason.isEmpty ? '' : ' Nedeni: $reason'}'
        '${action == null || action.isEmpty ? '' : ' Yapmanız gereken: $action'}'
        '$trace';
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Bilgiler alınırken'));
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Kayıt işlemi'));
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Güncelleme işlemi'));
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Silme işlemi'));
    }
    if (response.body.isEmpty) return const {};
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  // ─── İşletme giderleri (mazot, bakım, kira, sigorta...) ─────────────────
  // Kurumdan bağımsız genel finans modülü: tüm kurumlar aynı uçları
  // kullanır (/api/finance/expenses).
  Future<Map<String, dynamic>> expenses({
    DateTime? from,
    DateTime? to,
    String? category,
    String? vehicleId,
  }) {
    final q = <String, String>{};
    if (from != null) q['from'] = from.toUtc().toIso8601String();
    if (to != null) q['to'] = to.toUtc().toIso8601String();
    if (category != null && category.isNotEmpty) q['category'] = category;
    if (vehicleId != null && vehicleId.isNotEmpty) q['vehicleId'] = vehicleId;
    final query = q.isEmpty
        ? ''
        : '?${q.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
    return _get('/api/finance/expenses$query');
  }

  Future<Map<String, dynamic>> createExpense(Map<String, dynamic> body) =>
      _post('/api/finance/expenses', body);
  Future<Map<String, dynamic>> updateExpense(
    String id,
    Map<String, dynamic> body,
  ) => _put('/api/finance/expenses/$id', body);
  Future<Map<String, dynamic>> deleteExpense(String id) =>
      _delete('/api/finance/expenses/$id');
}
