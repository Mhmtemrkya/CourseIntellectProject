import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

class CredentialsPdfService {
  CredentialsPdfService._();

  static pw.Font? _cachedRegularFont;
  static pw.Font? _cachedBoldFont;

  static Future<pw.Font?> _loadFont(String path) async {
    try {
      final data = await rootBundle.load(path);
      return pw.Font.ttf(data);
    } catch (_) {
      return null;
    }
  }

  static Future<({pw.Font? regular, pw.Font? bold})> _loadUnicodeFonts() async {
    _cachedRegularFont ??= await _loadFont('assets/fonts/Roboto-Regular.ttf');
    _cachedBoldFont ??= await _loadFont('assets/fonts/Roboto-Bold.ttf');
    // Roboto yüklenemezse ArialUnicode fallback
    if (_cachedRegularFont == null) {
      _cachedRegularFont = await _loadFont('assets/fonts/ArialUnicode.ttf');
      _cachedBoldFont ??= _cachedRegularFont;
    }
    return (regular: _cachedRegularFont, bold: _cachedBoldFont);
  }

  static Future<File> generateAndShare({
    required String tenantName,
    required String fullName,
    required String role,
    required String username,
    required String temporaryPassword,
    String? className,
    String? extra,
  }) async {
    final fonts = await _loadUnicodeFonts();
    final regularFont = fonts.regular;
    final boldFont = fonts.bold ?? regularFont;

    Uint8List? logoBytes;
    try {
      final data = await rootBundle.load('assets/logo/course_intellect2.png');
      logoBytes = data.buffer.asUint8List();
    } catch (_) {}

    final pdf = pw.Document(
      theme: regularFont != null
          ? pw.ThemeData.withFont(
              base: regularFont,
              bold: boldFont,
              italic: regularFont,
              boldItalic: boldFont,
            )
          : null,
    );

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(0),
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Container(
                color: PdfColor.fromInt(0xFF0F172A),
                padding: const pw.EdgeInsets.all(24),
                child: pw.Row(
                  children: [
                    if (logoBytes != null)
                      pw.SizedBox(
                        width: 50,
                        height: 50,
                        child: pw.Image(pw.MemoryImage(logoBytes)),
                      ),
                    pw.SizedBox(width: 16),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'CourseIntellect',
                          style: pw.TextStyle(
                            color: PdfColors.white,
                            fontSize: 22,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Hesap Bilgileriniz',
                          style: pw.TextStyle(
                            color: PdfColors.indigo200,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 24),
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(horizontal: 24),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      tenantName,
                      style: pw.TextStyle(
                        fontSize: 16,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.SizedBox(height: 4),
                    pw.Text(
                      'Oluşturma Tarihi: ${_formatDate(DateTime.now())}',
                      style: const pw.TextStyle(
                        fontSize: 10,
                        color: PdfColors.grey700,
                      ),
                    ),
                    pw.SizedBox(height: 24),
                    _row('Ad Soyad', fullName),
                    _row('Rol', role),
                    if (className != null && className.isNotEmpty)
                      _row('Sınıf', className),
                    _row('Kullanıcı Adı', username),
                    pw.SizedBox(height: 16),
                    pw.Container(
                      width: double.infinity,
                      padding: const pw.EdgeInsets.all(16),
                      decoration: pw.BoxDecoration(
                        color: PdfColor.fromInt(0xFFF3F4F6),
                        borderRadius:
                            const pw.BorderRadius.all(pw.Radius.circular(8)),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'Geçici Şifre',
                            style: pw.TextStyle(
                              fontSize: 11,
                              color: PdfColors.grey700,
                            ),
                          ),
                          pw.SizedBox(height: 8),
                          pw.Text(
                            temporaryPassword,
                            style: pw.TextStyle(
                              fontSize: 22,
                              fontWeight: pw.FontWeight.bold,
                              letterSpacing: 2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    pw.SizedBox(height: 16),
                    pw.Container(
                      width: double.infinity,
                      padding: const pw.EdgeInsets.all(14),
                      decoration: pw.BoxDecoration(
                        color: PdfColor.fromInt(0xFFFEF3C7),
                        borderRadius:
                            const pw.BorderRadius.all(pw.Radius.circular(8)),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'Önemli Uyarı',
                            style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold,
                              fontSize: 11,
                              color: PdfColor.fromInt(0xFF78350F),
                            ),
                          ),
                          pw.SizedBox(height: 6),
                          pw.Text(
                            'İlk girişinizde şifre değişikliği yapmanız zorunludur.',
                            style: const pw.TextStyle(fontSize: 10),
                          ),
                          pw.Text(
                            'Bu şifreyi güvenli bir yerde saklayın ve kimseyle paylaşmayın.',
                            style: const pw.TextStyle(fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                    if (extra != null && extra.isNotEmpty) ...[
                      pw.SizedBox(height: 16),
                      pw.Text(
                        extra,
                        style: const pw.TextStyle(
                          fontSize: 10,
                          color: PdfColors.grey700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              pw.Spacer(),
              pw.Padding(
                padding: const pw.EdgeInsets.all(24),
                child: pw.Text(
                  'CourseIntellect • Eğitim Yönetim Platformu',
                  style: const pw.TextStyle(
                    fontSize: 9,
                    color: PdfColors.grey400,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );

    final bytes = await pdf.save();
    final dir = await getTemporaryDirectory();
    final safeName =
        fullName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-');
    final file = File('${dir.path}/courseintellect-$safeName-bilgileri.pdf');
    await file.writeAsBytes(bytes);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: '$fullName için CourseIntellect hesap bilgileri',
      ),
    );
    return file;
  }

  static pw.Widget _row(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Row(
        children: [
          pw.SizedBox(
            width: 140,
            child: pw.Text(
              label,
              style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                fontSize: 11,
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              value,
              style: const pw.TextStyle(fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDate(DateTime date) {
    final dd = date.day.toString().padLeft(2, '0');
    final mm = date.month.toString().padLeft(2, '0');
    return '$dd.$mm.${date.year}';
  }
}
