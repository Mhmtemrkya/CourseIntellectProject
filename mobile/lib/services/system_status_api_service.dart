import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';

class SystemStatus {
  final bool maintenanceMode;
  final String? maintenanceMessage;
  final DateTime? maintenanceSinceUtc;

  const SystemStatus({
    required this.maintenanceMode,
    this.maintenanceMessage,
    this.maintenanceSinceUtc,
  });

  static const SystemStatus normal = SystemStatus(maintenanceMode: false);

  factory SystemStatus.fromJson(Map<String, dynamic> json) {
    final raw = json['data'] is Map<String, dynamic> ? json['data'] as Map<String, dynamic> : json;
    final since = raw['maintenanceSinceUtc'];
    return SystemStatus(
      maintenanceMode: raw['maintenanceMode'] == true,
      maintenanceMessage: raw['maintenanceMessage']?.toString(),
      maintenanceSinceUtc: since is String && since.isNotEmpty
          ? DateTime.tryParse(since)
          : null,
    );
  }
}

class SystemStatusApiService {
  Future<SystemStatus> fetchStatus() async {
    final candidates = ApiConfig.candidateBaseUrls.toSet();
    for (final base in candidates) {
      try {
        final url = Uri.parse('$base/api/system/status');
        final response = await http
            .get(url, headers: {'Accept': 'application/json'})
            .timeout(const Duration(seconds: 5));
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic>) {
            return SystemStatus.fromJson(decoded);
          }
        }
      } on TimeoutException {
        continue;
      } catch (_) {
        continue;
      }
    }
    return SystemStatus.normal;
  }
}
