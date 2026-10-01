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
    // Resmi TCKN checksum (10. ve 11. hane). Eskiden kontrol edilmiyordu:
    // mobil, backend'in reddettiği geçersiz numarayı kabul edip kaydı son anda
    // hataya düşürüyordu.
    if (!_isValidTcChecksum(text)) {
      return 'Geçerli bir TC Kimlik No girin';
    }
    return null;
  }

  static bool _isValidTcChecksum(String digits) {
    final d = digits.split('').map(int.parse).toList();
    final odd = d[0] + d[2] + d[4] + d[6] + d[8];
    final even = d[1] + d[3] + d[5] + d[7];
    var tenth = (odd * 7 - even) % 10;
    if (tenth < 0) tenth += 10;
    if (tenth != d[9]) return false;
    return (odd + even + d[9]) % 10 == d[10];
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
