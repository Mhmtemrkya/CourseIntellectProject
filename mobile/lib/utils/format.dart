/// Biçimlendirme tek kaynağı: para, sayı ve tarih.
///
/// Masaüstündeki `desktop/src/lib/format.js` ile AYNI kuralları uygular; aynı
/// tutar/tarih iki platformda birebir aynı görünür:
///  - para  → "12.500 TL" (tam sayıda kuruş yok), "12.500,50 TL"
///  - tarih → "02.08.2026"
///  - saat  → "14:35"
library;

const Map<String, String> currencyLabels = {
  'TRY': 'TL',
  'TL': 'TL',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
};

/// "12.500,50", "1,234.56", "₺3.000" gibi girdileri sayıya çevirir.
double parseMoney(Object? value) {
  if (value is num) return value.toDouble();
  if (value == null) return 0;

  final raw = value.toString().replaceAll(RegExp(r'[^\d.,-]'), '').trim();
  if (raw.isEmpty) return 0;

  final lastComma = raw.lastIndexOf(',');
  final lastDot = raw.lastIndexOf('.');
  String normalized;
  if (lastComma > -1 && lastComma > lastDot) {
    // Türkçe yazım: nokta binlik, virgül ondalık.
    normalized = raw.replaceAll('.', '').replaceFirst(',', '.');
  } else if (lastComma > -1) {
    normalized = raw.replaceAll(',', '');
  } else if (lastDot > -1) {
    // Virgül yok: "3.000" ÜÇ BİN demektir; "12.5" ondalık kalır.
    final tail = raw.substring(lastDot + 1);
    normalized = RegExp(r'^\d{3}$').hasMatch(tail) ? raw.replaceAll('.', '') : raw;
  } else {
    normalized = raw;
  }

  return double.tryParse(normalized) ?? 0;
}

/// Binlik ayırıcı nokta, ondalık virgül: 1.234.567 · 12,50
String formatNumber(Object? value, {int? decimals}) {
  final amount = value is num ? value.toDouble() : parseMoney(value);
  final digits = decimals ?? (amount == amount.roundToDouble() ? 0 : 2);
  final fixed = amount.abs().toStringAsFixed(digits);
  final parts = fixed.split('.');

  final buffer = StringBuffer();
  final whole = parts.first;
  for (var i = 0; i < whole.length; i += 1) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write('.');
    buffer.write(whole[i]);
  }

  final sign = amount < 0 ? '-' : '';
  return parts.length > 1 ? '$sign$buffer,${parts[1]}' : '$sign$buffer';
}

/// Para: "12.500 TL"
String formatMoney(
  Object? value, {
  String currency = 'TRY',
  bool showCurrency = true,
  int? decimals,
}) {
  final text = formatNumber(value, decimals: decimals);
  if (!showCurrency) return text;
  final label = currencyLabels[currency.toUpperCase()] ?? currency;
  return '$text $label';
}

/// İşaretli para: "+1.000 TL" / "−250 TL"
String formatMoneySigned(Object? value, {String currency = 'TRY'}) {
  final amount = value is num ? value.toDouble() : parseMoney(value);
  final text = formatMoney(amount.abs(), currency: currency);
  if (amount == 0) return text;
  return '${amount > 0 ? '+' : '−'}$text';
}

/// Girdi ne olursa olsun geçerli bir DateTime ya da null.
DateTime? toDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());

  final raw = value.toString().trim();
  if (raw.isEmpty) return null;
  // "2026-08-02 14:35" gibi boşluklu değerler DateTime.parse'ta hata verir.
  return DateTime.tryParse(raw.contains(' ') && raw.contains('-')
      ? raw.replaceFirst(' ', 'T')
      : raw);
}

String _pad(int value) => value.toString().padLeft(2, '0');

/// 02.08.2026
String formatDate(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${_pad(date.day)}.${_pad(date.month)}.${date.year}';
}

/// 14:35
String formatTime(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${_pad(date.hour)}:${_pad(date.minute)}';
}

/// 02.08.2026 14:35
String formatDateTime(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${formatDate(date)} ${formatTime(date)}';
}

const List<String> _monthNames = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const List<String> _weekdayShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/// 2 Ağustos 2026
String formatDateLong(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${date.day} ${_monthNames[date.month - 1]} ${date.year}';
}

/// Ağustos 2026
String formatMonthYear(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${_monthNames[date.month - 1]} ${date.year}';
}

/// 02.08 Paz
String formatDayShort(Object? value, {String fallback = '—'}) {
  final date = toDate(value)?.toLocal();
  if (date == null) return fallback;
  return '${_pad(date.day)}.${_pad(date.month)} ${_weekdayShort[date.weekday - 1]}';
}
