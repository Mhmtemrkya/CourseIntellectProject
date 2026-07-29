import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

/// Onam / izin formu uçları (/api/consent).
///
/// Okuma yollarında paket kapısı yoktur: paket düşse bile daha önce imzalanmış
/// belgeler görüntülenip indirilebilir. Öğrenci ve veli rolleri bu uçlara
/// erişemez (sunucu rol beyaz listesi uygular).
class ConsentApiService {
  ConsentApiService._();
  static final instance = ConsentApiService._();

  String _errorMessage(http.Response response, String operation) {
    Map<String, dynamic>? payload;
    try {
      payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    } catch (_) {}

    final serverMessage = payload?['message']?.toString().trim() ?? '';
    if (serverMessage.isNotEmpty) return serverMessage;

    return switch (response.statusCode) {
      401 => 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
      403 => 'Bu işlem için yetkiniz bulunmuyor.',
      404 => 'İstenen kayıt bulunamadı.',
      409 => 'İşlem güncel kayıtla çakıştı. Bilgileri yenileyip tekrar deneyin.',
      _ => '$operation tamamlanamadı.',
    };
  }

  Future<Map<String, String>> _headers({bool json = false}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    return {
      'Authorization': 'Bearer ${session.accessToken}',
      if (json) 'Content-Type': 'application/json',
      ...ScopeHeaders.merged,
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    return query == null || query.isEmpty
        ? uri
        : uri.replace(queryParameters: {...uri.queryParameters, ...query});
  }

  /// 204 (bekleyen form yok) durumunda null döner — tablet ekranı sıfırlamaz.
  Future<Map<String, dynamic>?> _getOrNull(
    String path, [
    Map<String, String>? query,
  ]) async {
    final response = await http.get(_uri(path, query), headers: await _headers());
    if (response.statusCode == 204) return null;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Bilgiler alınırken'));
    }
    if (response.body.isEmpty) return null;
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? query]) async {
    final result = await _getOrNull(path, query);
    return result ?? const {};
  }

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final response = await http.get(_uri(path), headers: await _headers());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Liste alınırken'));
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! List) return const [];
    return decoded.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      _uri(path),
      headers: await _headers(json: true),
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Kayıt işlemi'));
    }
    if (response.body.isEmpty) return const {};
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
      _uri(path),
      headers: await _headers(json: true),
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Güncelleme işlemi'));
    }
    if (response.body.isEmpty) return const {};
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<void> _delete(String path) async {
    final response = await http.delete(_uri(path), headers: await _headers());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Silme işlemi'));
    }
  }

  // ─── Şablonlar ve yüklenen belgeler ────────────────────────────────────────

  Future<List<Map<String, dynamic>>> templates({bool includeInactive = false}) =>
      _getList('/api/consent/templates?includeInactive=$includeInactive');

  /// Hazır PDF yükler; sunucu içeriği doğrulayıp künyesini döner.
  Future<Map<String, dynamic>> uploadDocument(
    List<int> bytes,
    String fileName,
  ) async {
    final request = http.MultipartRequest('POST', _uri('/api/consent/documents'))
      ..headers.addAll(await _headers())
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: fileName));

    final response = await http.Response.fromStream(await request.send());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Belge yüklenirken'));
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> createTemplate(Map<String, dynamic> payload) =>
      _post('/api/consent/templates', payload);

  /// Yüklenmiş belgenin kendisi — şablon önizlemesi.
  Future<Uint8List> document(String documentId) async {
    final response = await http.get(
      _uri('/api/consent/documents/$documentId'),
      headers: await _headers(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Belge açılırken'));
    }
    return response.bodyBytes;
  }

  // ─── Öğrenci kayıtları ─────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> studentForms(String studentProfileId) =>
      _getList('/api/consent/students/$studentProfileId');

  Future<Map<String, dynamic>> status(
    String studentProfileId, {
    String? contextKind,
    String? contextKey,
    String? contextRefId,
  }) =>
      _get('/api/consent/students/$studentProfileId/status', {
        'contextKind': ?contextKind,
        'contextKey': ?contextKey,
        'contextRefId': ?contextRefId,
      });

  Future<Map<String, dynamic>> appointmentStatus(String appointmentId) =>
      _get('/api/consent/appointments/$appointmentId/status');

  Future<Map<String, dynamic>> form(String id) => _get('/api/consent/forms/$id');

  Future<Map<String, dynamic>> createForm({
    required String templateId,
    required String studentProfileId,
    required String contextKind,
    String? contextKey,
    String? contextRefId,
    String? contextLabel,
    String? staffNotes,
  }) =>
      _post('/api/consent/forms', {
        'templateId': templateId,
        'studentProfileId': studentProfileId,
        'contextKind': contextKind,
        'contextKey': contextKey,
        'contextRefId': contextRefId,
        'contextLabel': contextLabel,
        'staffNotes': staffNotes,
      });

  Future<Map<String, dynamic>> updateForm(String id, String staffNotes) =>
      _put('/api/consent/forms/$id', {'staffNotes': staffNotes});

  Future<void> cancelForm(String id) => _delete('/api/consent/forms/$id');

  Future<Uint8List> formPdf(String id) async {
    final response = await http.get(
      _uri('/api/consent/forms/$id/pdf'),
      headers: await _headers(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Belge indirilirken'));
    }
    return response.bodyBytes;
  }

  /// Kaydın dayandığı ÖZGÜN PDF (imza sayfası eklenmemiş hâli). Tablet, imza
  /// almadan önce bunu gösterir; metin kaynaklı kayıtta sunucu 404 döner.
  Future<Uint8List> formDocument(String id) async {
    final response = await http.get(
      _uri('/api/consent/forms/$id/document'),
      headers: await _headers(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(_errorMessage(response, 'Belge açılırken'));
    }
    return response.bodyBytes;
  }

  // ─── İmza oturumu ──────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> dispatchToStation(String id, String stationName) =>
      _post('/api/consent/forms/$id/session', {'stationName': stationName});

  Future<void> revokeSession(String id) => _delete('/api/consent/forms/$id/session');

  Future<List<Map<String, dynamic>>> stations() => _getList('/api/consent/stations');

  /// Tablet yoklaması: yalnız KENDİ adına gönderilmiş formu döndürür.
  /// Bekleyen form yoksa null.
  Future<Map<String, dynamic>?> pollStation(String station) =>
      _getOrNull('/api/consent/station/pending', {'station': station});

  Future<Map<String, dynamic>> sign(
    String sessionToken, {
    required List<int> checkedItems,
    String? signatureImage,
    String? signerName,
    String? signerRelation,
  }) =>
      _post('/api/consent/session/$sessionToken/sign', {
        'checkedItems': checkedItems,
        'signatureImage': signatureImage,
        'signerName': signerName,
        'signerRelation': signerRelation,
      });
}
