import 'package:flutter/foundation.dart';

class AppEnv {
  AppEnv._();

  static const String environment = String.fromEnvironment(
    'COURSE_INTELLECT_ENV',
    defaultValue: 'development',
  );

  static const String productionApiUrl = String.fromEnvironment(
    'COURSE_INTELLECT_PROD_API_URL',
    defaultValue: '',
  );

  static const String stagingApiUrl = String.fromEnvironment(
    'COURSE_INTELLECT_STAGING_API_URL',
    defaultValue: '',
  );

  static bool get isProduction =>
      environment.toLowerCase() == 'production' || kReleaseMode;

  static bool get isStaging => environment.toLowerCase() == 'staging';
}
