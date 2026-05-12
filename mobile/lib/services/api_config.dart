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

  static bool _isHttpsUrl(String value) {
    final uri = Uri.tryParse(value);
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
  }

  static List<String> get candidateBaseUrls {
    const configured = String.fromEnvironment('COURSE_INTELLECT_API_URL');
    if (configured.isNotEmpty) {
      if (AppEnv.isProduction && !_isHttpsUrl(configured)) return const [];
      return [configured];
    }

    if (AppEnv.isProduction) {
      return AppEnv.productionApiUrl.isNotEmpty &&
              _isHttpsUrl(AppEnv.productionApiUrl)
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
    if (_configuredMarketingUrl.isNotEmpty) {
      if (AppEnv.isProduction && !_isHttpsUrl(_configuredMarketingUrl)) {
        return '';
      }
      return _configuredMarketingUrl;
    }

    if (AppEnv.isProduction) {
      return _isHttpsUrl(_productionMarketingUrl) ? _productionMarketingUrl : '';
    }

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

    final uri = Uri.tryParse(raw);
    if (uri != null && uri.hasScheme && uri.host.isNotEmpty) {
      final currentBase = Uri.tryParse(baseUrl);
      if (currentBase != null &&
          currentBase.host.isNotEmpty &&
          (uri.host != currentBase.host || uri.port != currentBase.port) &&
          _isLocalOrPrivateHost(uri.host)) {
        final query = uri.hasQuery ? '?${uri.query}' : '';
        final fragment = uri.fragment.isNotEmpty ? '#${uri.fragment}' : '';
        return '$baseUrl${uri.path}$query$fragment';
      }
      return raw;
    }
    if (raw.startsWith('/')) {
      return '$baseUrl$raw';
    }
    return '$baseUrl/$raw';
  }

  static bool _isLocalOrPrivateHost(String host) {
    if (host == 'localhost' || host == '127.0.0.1') return true;
    if (host == '10.0.2.2' || host == '10.0.3.2') return true;
    final parts = host.split('.');
    if (parts.length != 4) return false;
    final nums = parts.map(int.tryParse).toList();
    if (nums.any((n) => n == null)) return false;
    final a = nums[0]!;
    final b = nums[1]!;
    if (a == 10) return true;
    if (a == 192 && b == 168) return true;
    if (a == 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  static void useBaseUrl(String url) {
    _overrideBaseUrl = url;
  }

  static String? get configurationError {
    if (candidateBaseUrls.isNotEmpty) return null;
    if (AppEnv.isProduction) {
      return 'Production API adresi tanımlı değil veya HTTPS değil. COURSE_INTELLECT_PROD_API_URL HTTPS olarak verilmeli.';
    }
    if (AppEnv.isStaging) {
      return 'Staging API adresi tanımlı değil. COURSE_INTELLECT_STAGING_API_URL verilmeli.';
    }
    return null;
  }
}
