import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/widgets.dart' as pw;

pw.ThemeData? _cached;

/// Türkçe karakterli PDF teması. pdf paketinin varsayılan fontu (Helvetica)
/// ş, ğ, ı, İ glifleri içermez; öğrenci/veli adları bozuk basılırdı.
Future<pw.ThemeData> turkishPdfTheme() async {
  final cached = _cached;
  if (cached != null) return cached;
  final regular = pw.Font.ttf(
    await rootBundle.load('assets/fonts/Roboto-Regular.ttf'),
  );
  final bold = pw.Font.ttf(await rootBundle.load('assets/fonts/Roboto-Bold.ttf'));
  return _cached = pw.ThemeData.withFont(
    base: regular,
    bold: bold,
    italic: regular,
    boldItalic: bold,
  );
}
