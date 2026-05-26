import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class CafeteriaApiException implements Exception {
  final String message;

  const CafeteriaApiException(this.message);

  @override
  String toString() => message;
}

class CafeteriaMealEntry {
  final DateTime date;
  final String mealType;
  final String startTime;
  final String endTime;
  final List<String> items;
  final int calories;
  final double proteinGrams;
  final double carbohydrateGrams;
  final double fatGrams;
  final double fiberGrams;
  final List<String> allergens;
  final String description;

  const CafeteriaMealEntry({
    required this.date,
    required this.mealType,
    required this.startTime,
    required this.endTime,
    required this.items,
    required this.calories,
    required this.proteinGrams,
    required this.carbohydrateGrams,
    required this.fatGrams,
    required this.fiberGrams,
    required this.allergens,
    required this.description,
  });

  factory CafeteriaMealEntry.fromJson(Map<String, dynamic> json) {
    return CafeteriaMealEntry(
      date: DateTime.parse(json['date'] as String),
      mealType: (json['mealType'] as String?) ?? 'Breakfast',
      startTime: (json['startTime'] as String?) ?? '',
      endTime: (json['endTime'] as String?) ?? '',
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      calories: (json['calories'] as num?)?.toInt() ?? 0,
      proteinGrams: (json['proteinGrams'] as num?)?.toDouble() ?? 0,
      carbohydrateGrams: (json['carbohydrateGrams'] as num?)?.toDouble() ?? 0,
      fatGrams: (json['fatGrams'] as num?)?.toDouble() ?? 0,
      fiberGrams: (json['fiberGrams'] as num?)?.toDouble() ?? 0,
      allergens: (json['allergens'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      description: (json['description'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'date': _dateText(date),
    'mealType': mealType,
    'startTime': startTime,
    'endTime': endTime,
    'items': items,
    'calories': calories,
    'proteinGrams': proteinGrams,
    'carbohydrateGrams': carbohydrateGrams,
    'fatGrams': fatGrams,
    'fiberGrams': fiberGrams,
    'allergens': allergens,
    'description': description,
  };

  CafeteriaMealEntry copyWith({
    List<String>? items,
    int? calories,
    double? proteinGrams,
    double? carbohydrateGrams,
    double? fatGrams,
    double? fiberGrams,
    List<String>? allergens,
    String? description,
  }) {
    return CafeteriaMealEntry(
      date: date,
      mealType: mealType,
      startTime: startTime,
      endTime: endTime,
      items: items ?? this.items,
      calories: calories ?? this.calories,
      proteinGrams: proteinGrams ?? this.proteinGrams,
      carbohydrateGrams: carbohydrateGrams ?? this.carbohydrateGrams,
      fatGrams: fatGrams ?? this.fatGrams,
      fiberGrams: fiberGrams ?? this.fiberGrams,
      allergens: allergens ?? this.allergens,
      description: description ?? this.description,
    );
  }
}

class CafeteriaWeek {
  final String? id;
  final DateTime weekStart;
  final DateTime weekEnd;
  final String note;
  final List<CafeteriaMealEntry> meals;

  const CafeteriaWeek({
    required this.id,
    required this.weekStart,
    required this.weekEnd,
    required this.note,
    required this.meals,
  });

  factory CafeteriaWeek.fromJson(Map<String, dynamic> json) {
    return CafeteriaWeek(
      id: json['id'] as String?,
      weekStart: DateTime.parse(json['weekStart'] as String),
      weekEnd: DateTime.parse(json['weekEnd'] as String),
      note: (json['note'] as String?) ?? '',
      meals: (json['meals'] as List<dynamic>? ?? const [])
          .map(
            (meal) => CafeteriaMealEntry.fromJson(
              Map<String, dynamic>.from(meal as Map),
            ),
          )
          .toList(),
    );
  }

  CafeteriaWeek copyWith({List<CafeteriaMealEntry>? meals}) {
    return CafeteriaWeek(
      id: id,
      weekStart: weekStart,
      weekEnd: weekEnd,
      note: note,
      meals: meals ?? this.meals,
    );
  }

  Map<String, dynamic> toJson() => {
    'weekStart': _dateText(weekStart),
    'note': note,
    'meals': meals.map((meal) => meal.toJson()).toList(),
  };
}

class CafeteriaApiService {
  CafeteriaApiService._();

  static final CafeteriaApiService instance = CafeteriaApiService._();

  Future<CafeteriaWeek> getWeek(DateTime weekStart) async {
    final response = await _authorized(
      'GET',
      '/api/cafeteria/week?weekStart=${_dateText(weekStart)}',
    );
    return CafeteriaWeek.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<CafeteriaWeek> saveWeek(CafeteriaWeek week) async {
    final response = await _authorized(
      'POST',
      '/api/cafeteria/weeks',
      body: week.toJson(),
    );
    return CafeteriaWeek.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<http.Response> _authorized(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const CafeteriaApiException(
        'Oturum bulunamadı. Lütfen yeniden giriş yapın.',
      );
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session.accessToken}',
    };
    final response = method == 'POST'
        ? await http.post(uri, headers: headers, body: jsonEncode(body))
        : await http.get(uri, headers: headers);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String? message;
      try {
        message =
            (jsonDecode(response.body) as Map<String, dynamic>)['message']
                as String?;
      } catch (_) {}
      throw CafeteriaApiException(
        message ?? 'Yemekhane işlemi başarısız oldu (${response.statusCode}).',
      );
    }
    return response;
  }
}

String _dateText(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}
