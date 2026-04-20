import 'package:flutter/foundation.dart';

import 'app_env.dart';

class ApiConfig {
  static const String _localNetworkUrl = String.fromEnvironment(
    'COURSE_INTELLECT_LAN_API_URL',
    defaultValue: 'http://192.168.1.6:5206',
  );

  static const String _configuredMarketingUrl = String.fromEnvironment(
    'COURSE_INTELLECT_MARKETING_URL',
    defaultValue: '',
  );

  static const String _productionMarketingUrl = String.fromEnvironment(
    'COURSE_INTELLECT_PROD_MARKETING_URL',
    defaultValue: '',
  );

  static String? _overrideBaseUrl;

  static List<String> get candidateBaseUrls {
    const configured = String.fromEnvironment('COURSE_INTELLECT_API_URL');
    if (configured.isNotEmpty) return [configured];

    if (AppEnv.isProduction) {
      return AppEnv.productionApiUrl.isNotEmpty
          ? [AppEnv.productionApiUrl]
          : const [];
    }

    if (AppEnv.isStaging) {
      return AppEnv.stagingApiUrl.isNotEmpty
          ? [AppEnv.stagingApiUrl]
          : const [];
    }

    if (kIsWeb) {
      return const [
        'http://localhost:5206',
        'http://127.0.0.1:5206',
        'http://localhost:5199',
        'http://127.0.0.1:5199',
      ];
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return [
          ...?_overrideBaseUrl == null ? null : [_overrideBaseUrl!],
          'http://10.0.2.2:5206',
          'http://10.0.3.2:5206',
          'http://10.0.2.2:5199',
          'http://10.0.3.2:5199',
          _localNetworkUrl,
          'http://127.0.0.1:5206',
          'http://localhost:5206',
          'http://127.0.0.1:5199',
          'http://localhost:5199',
        ];
      case TargetPlatform.iOS:
        return [
          ...?_overrideBaseUrl == null ? null : [_overrideBaseUrl!],
          'http://127.0.0.1:5206',
          'http://localhost:5206',
          'http://127.0.0.1:5199',
          'http://localhost:5199',
          _localNetworkUrl,
        ];
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        return [
          ...?_overrideBaseUrl == null ? null : [_overrideBaseUrl!],
          'http://localhost:5206',
          'http://127.0.0.1:5206',
          'http://localhost:5199',
          'http://127.0.0.1:5199',
          _localNetworkUrl,
        ];
    }
  }

  static String get baseUrl {
    return candidateBaseUrls.isEmpty ? '' : candidateBaseUrls.first;
  }

  static String get marketingBaseUrl {
    if (_configuredMarketingUrl.isNotEmpty) return _configuredMarketingUrl;

    if (AppEnv.isProduction) return _productionMarketingUrl;

    if (kIsWeb) return 'http://localhost:3000';

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3000';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        return 'http://localhost:3000';
    }
  }

  static String resolveAssetUrl(String? path) {
    final raw = (path ?? '').trim();
    if (raw.isEmpty) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    if (raw.startsWith('/')) {
      return '$baseUrl$raw';
    }
    return '$baseUrl/$raw';
  }

  static void useBaseUrl(String url) {
    _overrideBaseUrl = url;
  }

  static String? get configurationError {
    if (candidateBaseUrls.isNotEmpty) return null;
    if (AppEnv.isProduction) {
      return 'Production API adresi tanimli degil. COURSE_INTELLECT_PROD_API_URL verilmeli.';
    }
    if (AppEnv.isStaging) {
      return 'Staging API adresi tanimli degil. COURSE_INTELLECT_STAGING_API_URL verilmeli.';
    }
    return null;
  }
}
