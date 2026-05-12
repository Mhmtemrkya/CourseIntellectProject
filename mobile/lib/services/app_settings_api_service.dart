import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class AppSettingRecord {
  final String key;
  final String value;
  final String type;
  final String category;
  final String description;

  const AppSettingRecord({
    required this.key,
    required this.value,
    this.type = 'string',
    this.category = 'general',
    this.description = '',
  });

  factory AppSettingRecord.fromMap(Map<String, dynamic> map) {
    return AppSettingRecord(
      key: map['key'] as String? ?? '',
      value: map['value'] as String? ?? '',
      type: map['type'] as String? ?? 'string',
      category: map['category'] as String? ?? 'general',
      description: map['description'] as String? ?? '',
    );
  }
}

class AppSettingsApiService {
  AppSettingsApiService._();

  static final AppSettingsApiService instance = AppSettingsApiService._();

  Future<List<AppSettingRecord>> fetchAll({String? category}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');

    final path = category != null
        ? '/api/appsettings?category=$category'
        : '/api/appsettings';
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Ayarlar alınamadı (${response.statusCode}).');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map(
          (item) =>
              AppSettingRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<void> upsert(List<Map<String, String>> items) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/appsettings'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(items),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Ayarlar kaydedilemedi (${response.statusCode}).');
    }
  }
}
