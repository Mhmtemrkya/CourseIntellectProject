import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class CourseRecord {
  final String id;
  final String name;
  final String description;
  final String category;
  final String price;
  final String duration;
  final String level;
  final bool isActive;

  const CourseRecord({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.price,
    required this.duration,
    required this.level,
    required this.isActive,
  });

  factory CourseRecord.fromMap(Map<String, dynamic> map) {
    return CourseRecord(
      id: (map['id'] ?? '').toString(),
      name: map['name'] as String? ?? '',
      description: map['description'] as String? ?? '',
      category: map['category'] as String? ?? '',
      price: (map['price'] ?? 0).toString(),
      duration: map['duration'] as String? ?? '',
      level: map['level'] as String? ?? '',
      isActive: map['isActive'] as bool? ?? true,
    );
  }
}

class CoursesApiService {
  CoursesApiService._();

  static final CoursesApiService instance = CoursesApiService._();

  Future<List<CourseRecord>> fetchAll({String? search, bool? isActive}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');

    final params = <String>[];
    if (search != null && search.isNotEmpty) params.add('search=$search');
    if (isActive != null) params.add('isActive=$isActive');
    final query = params.isEmpty ? '' : '?${params.join('&')}';

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/courses$query'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Kurslar alınamadı (${response.statusCode}).');
    }
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map(
          (item) =>
              CourseRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<CourseRecord> create({
    required String name,
    required String description,
    required String category,
    required String price,
    required String duration,
    required String level,
    required bool isActive,
  }) async {
    final response = await _authorizedJson('POST', '/api/courses', {
      'name': name,
      'description': description,
      'category': category,
      'price': double.tryParse(price) ?? 0,
      'duration': duration,
      'level': level,
      'isActive': isActive,
    });
    return CourseRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<CourseRecord> update({
    required String id,
    required String name,
    required String description,
    required String category,
    required String price,
    required String duration,
    required String level,
    required bool isActive,
  }) async {
    final response = await _authorizedJson('PUT', '/api/courses/$id', {
      'name': name,
      'description': description,
      'category': category,
      'price': double.tryParse(price) ?? 0,
      'duration': duration,
      'level': level,
      'isActive': isActive,
    });
    return CourseRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> delete(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');
    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/courses/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Kurs silinemedi (${response.statusCode}).');
    }
  }

  Future<http.Response> _authorizedJson(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session.accessToken}',
    };
    final encoded = jsonEncode(body);
    final response = method == 'POST'
        ? await http.post(uri, headers: headers, body: encoded)
        : await http.put(uri, headers: headers, body: encoded);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Kurs işlemi başarısız (${response.statusCode}).');
    }
    return response;
  }
}
