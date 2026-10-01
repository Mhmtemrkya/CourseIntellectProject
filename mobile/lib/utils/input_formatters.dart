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

  /// E-posta: boş opsiyoneldir; dolu gelince biçim doğrulanır.
  static String? validateEmail(String? value, {bool required = false}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return required ? 'E-posta zorunludur' : null;
    }
    final lower = text.toLowerCase();
    if (lower.length < 6 ||
        lower.length > 180 ||
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$').hasMatch(lower)) {
      return 'Geçerli bir e-posta girin';
    }
    return null;
  }

  /// Doğum tarihi gg.aa.yyyy: geçerli tarih, gelecekte değil, son 120 yıl içinde.
  static String? validateBirthDate(String? value, {bool required = false}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return required ? 'Doğum tarihi zorunludur' : null;
    }
    final m = RegExp(r'^(\d{2})\.(\d{2})\.(\d{4})$').firstMatch(text);
    if (m == null) {
      return 'gg.aa.yyyy biçiminde girin';
    }
    final day = int.parse(m.group(1)!);
    final month = int.parse(m.group(2)!);
    final year = int.parse(m.group(3)!);
    final parsed = DateTime(year, month, day);
    // DateTime taşmayı sessizce düzeltir (32.01 → 01.02); gerçek tarih mi kontrol.
    if (parsed.year != year || parsed.month != month || parsed.day != day) {
      return 'Geçersiz tarih';
    }
    final now = DateTime.now();
    if (parsed.isAfter(now)) {
      return 'Doğum tarihi gelecekte olamaz';
    }
    if (parsed.isBefore(DateTime(now.year - 120))) {
      return 'Doğum tarihi geçersiz';
    }
    return null;
  }

  /// gg.aa.yyyy maskesi: yalnız rakam, otomatik nokta.
  static List<TextInputFormatter> birthDate() => [
    FilteringTextInputFormatter.digitsOnly,
    LengthLimitingTextInputFormatter(8),
    _DateTextFormatter(),
  ];

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

/// Rakamları gg.aa.yyyy olarak biçimler; kullanıcı nokta yazmak zorunda kalmaz.
class _DateTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length && i < 8; i++) {
      if (i == 2 || i == 4) buffer.write('.');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
