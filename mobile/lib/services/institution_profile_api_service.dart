import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

/// Kurum künyesi — ekstre, makbuz ve resmî belgelerin başlığında görünen kurum
/// bilgileri. Kuruma özel (tenant) saklanır; masaüstündeki "Ayarlar > Kurum
/// Künyesi" ekranıyla aynı uçtur.
class InstitutionProfileApiService {
  InstitutionProfileApiService._();

  static final InstitutionProfileApiService instance =
      InstitutionProfileApiService._();

  Future<Map<String, dynamic>> fetch() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/institution-profile'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Kurum künyesi alınamadı (${response.statusCode}).');
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> save(Map<String, String> profile) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/institution-profile'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(profile),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Kurum künyesi kaydedilemedi (${response.statusCode}).');
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }
}
