import 'package:flutter/services.dart';

/// Kayıt formlarında ortak input kalıpları.
/// TC kimlik: yalnızca rakam, en fazla 11 hane.
/// Telefon: yalnızca rakam, 10 hane (+90 öneki alanda sabit gösterilir).
class AppInputFormatters {
  AppInputFormatters._();

  static List<TextInputFormatter> tcKimlik() => [
    FilteringTextInputFormatter.digitsOnly,
    LengthLimitingTextInputFormatter(11),
  ];

  static List<TextInputFormatter> phone() => [
    FilteringTextInputFormatter.digitsOnly,
    LengthLimitingTextInputFormatter(10),
  ];

  static List<TextInputFormatter> digits({int? maxLength}) => [
    FilteringTextInputFormatter.digitsOnly,
    if (maxLength != null) LengthLimitingTextInputFormatter(maxLength),
  ];

  static String? validateTcKimlik(String? value, {bool required = true}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return required ? 'TC Kimlik No zorunludur' : null;
    }
    if (text.length != 11) {
      return 'TC Kimlik No 11 haneli olmalıdır';
    }
    if (text.startsWith('0')) {
      return 'TC Kimlik No 0 ile başlayamaz';
    }
    return null;
  }

  static String? validatePhone(String? value, {bool required = true}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return required ? 'Telefon zorunludur' : null;
    }
    if (text.length != 10) {
      return 'Telefon 10 haneli olmalıdır (örn: 5xx xxx xx xx)';
    }
    if (!text.startsWith('5')) {
      return 'Cep telefonu 5 ile başlamalıdır';
    }
    return null;
  }
}
