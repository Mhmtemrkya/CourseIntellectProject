import 'package:flutter/foundation.dart';

class AppEnv {
  AppEnv._();

  static const String environment = String.fromEnvironment(
    'COURSE_INTELLECT_ENV',
    defaultValue: 'development',
  );

  static const String productionApiUrl = String.fromEnvironment(
    'COURSE_INTELLECT_PROD_API_URL',
    defaultValue: 'https://maydanozasist.schoolasist.com',
  );

  static const String stagingApiUrl = String.fromEnvironment(
    'COURSE_INTELLECT_STAGING_API_URL',
    defaultValue: '',
  );

  /// Canlı ders görüşme (Jitsi) oda tabanı. Deploy'da `--dart-define` ile
  /// değiştirilir; varsayılan `https://meet.schoolasist.com`. Backend de aynı
  /// tabanı `LiveRoom:MeetBaseUrl` config'inden üretir.
  static const String meetBaseUrl = String.fromEnvironment(
    'COURSE_INTELLECT_MEET_BASE_URL',
    defaultValue: 'https://meet.schoolasist.com',
  );

  /// Şema (https://) olmadan görüntülenmek üzere görüşme sunucusu ana adı.
  static String get meetHost =>
      meetBaseUrl.replaceFirst(RegExp(r'^https?://'), '').replaceAll(RegExp(r'/+$'), '');

  static bool get isProduction =>
      environment.toLowerCase() == 'production' || kReleaseMode;

  static bool get isStaging => environment.toLowerCase() == 'staging';
}
