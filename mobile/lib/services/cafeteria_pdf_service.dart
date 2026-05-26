import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import 'cafeteria_api_service.dart';

class CafeteriaPdfService {
  CafeteriaPdfService._();

  static Future<void> generateAndShare(CafeteriaWeek week) async {
    final regularData = await rootBundle.load(
      'assets/fonts/Roboto-Regular.ttf',
    );
    final boldData = await rootBundle.load('assets/fonts/Roboto-Bold.ttf');
    final regular = pw.Font.ttf(regularData);
    final bold = pw.Font.ttf(boldData);
    final document = pw.Document(
      theme: pw.ThemeData.withFont(base: regular, bold: bold),
    );

    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        header: (_) => pw.Container(
          padding: const pw.EdgeInsets.only(bottom: 14),
          decoration: const pw.BoxDecoration(
            border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300)),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'COURSE INTELLECT',
                    style: pw.TextStyle(
                      color: PdfColor.fromInt(0xFFF97316),
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 11,
                      letterSpacing: 1.1,
                    ),
                  ),
                  pw.Text(
                    'Haftalık Yemek Programı',
                    style: pw.TextStyle(
                      fontSize: 20,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ],
              ),
              pw.Text(
                '${_date(week.weekStart)} - ${_date(week.weekEnd)}',
                style: const pw.TextStyle(
                  color: PdfColors.grey700,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
        footer: (context) => pw.Container(
          padding: const pw.EdgeInsets.only(top: 10),
          decoration: const pw.BoxDecoration(
            border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300)),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Course Intellect Yemekhane Sistemi',
                style: const pw.TextStyle(
                  fontSize: 9,
                  color: PdfColors.grey600,
                ),
              ),
              pw.Text(
                'Sayfa ${context.pageNumber} / ${context.pagesCount}',
                style: const pw.TextStyle(
                  fontSize: 9,
                  color: PdfColors.grey600,
                ),
              ),
            ],
          ),
        ),
        build: (_) => [
          pw.SizedBox(height: 18),
          ...List.generate(7, (dayIndex) {
            final date = week.weekStart.add(Duration(days: dayIndex));
            final breakfast = _findMeal(week, date, 'Breakfast');
            final lunch = _findMeal(week, date, 'Lunch');
            return pw.Container(
              margin: const pw.EdgeInsets.only(bottom: 12),
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                borderRadius: pw.BorderRadius.circular(10),
                border: pw.Border.all(color: PdfColors.grey300),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    '${_days[dayIndex]} - ${_date(date)}',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Expanded(
                        child: _mealBlock(
                          'Kahvaltı',
                          breakfast,
                          PdfColor.fromInt(0xFFF97316),
                        ),
                      ),
                      pw.SizedBox(width: 12),
                      pw.Expanded(
                        child: _mealBlock(
                          'Öğle Yemeği',
                          lunch,
                          PdfColor.fromInt(0xFF059669),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
          pw.SizedBox(height: 8),
          _nutritionSummary(week),
        ],
      ),
    );

    final directory = await getTemporaryDirectory();
    final file = File(
      '${directory.path}/yemek-programi-${_fileDate(week.weekStart)}.pdf',
    );
    await file.writeAsBytes(await document.save());
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: 'Course Intellect haftalık yemek programı',
      ),
    );
  }

  static pw.Widget _mealBlock(
    String title,
    CafeteriaMealEntry? meal,
    PdfColor color,
  ) {
    final items = meal?.items ?? const <String>[];
    return pw.Container(
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        color: PdfColor(color.red, color.green, color.blue, 0.07),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            title,
            style: pw.TextStyle(color: color, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text(
            '${meal?.startTime ?? '--:--'} - ${meal?.endTime ?? '--:--'}',
            style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
          ),
          pw.SizedBox(height: 6),
          if (items.isEmpty)
            pw.Text(
              'Menü girilmedi',
              style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
            )
          else
            ...items.map(
              (item) =>
                  pw.Text('• $item', style: const pw.TextStyle(fontSize: 10)),
            ),
          pw.SizedBox(height: 6),
          pw.Text(
            '${meal?.calories ?? 0} kcal',
            style: pw.TextStyle(
              fontWeight: pw.FontWeight.bold,
              color: color,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _nutritionSummary(CafeteriaWeek week) {
    final calories =
        week.meals.fold<int>(0, (sum, meal) => sum + meal.calories) ~/ 7;
    final protein =
        week.meals.fold<double>(0, (sum, meal) => sum + meal.proteinGrams) / 7;
    final carbohydrate =
        week.meals.fold<double>(
          0,
          (sum, meal) => sum + meal.carbohydrateGrams,
        ) /
        7;
    final fat =
        week.meals.fold<double>(0, (sum, meal) => sum + meal.fatGrams) / 7;
    final fiber =
        week.meals.fold<double>(0, (sum, meal) => sum + meal.fiberGrams) / 7;
    return pw.Container(
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: PdfColor.fromInt(0xFFF8FAFC),
        borderRadius: pw.BorderRadius.circular(10),
        border: pw.Border.all(color: PdfColors.grey300),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            'Günlük Besin Değerleri Ortalaması',
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 10),
          pw.Text(
            'Kalori: $calories kcal    Protein: ${protein.toStringAsFixed(0)} g    Karbonhidrat: ${carbohydrate.toStringAsFixed(0)} g    Yağ: ${fat.toStringAsFixed(0)} g    Lif: ${fiber.toStringAsFixed(0)} g',
            style: const pw.TextStyle(fontSize: 10),
          ),
        ],
      ),
    );
  }

  static CafeteriaMealEntry? _findMeal(
    CafeteriaWeek week,
    DateTime date,
    String type,
  ) {
    for (final meal in week.meals) {
      if (meal.date.year == date.year &&
          meal.date.month == date.month &&
          meal.date.day == date.day &&
          meal.mealType == type) {
        return meal;
      }
    }
    return null;
  }

  static const _days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];
  static const _months = [
    '',
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];

  static String _date(DateTime date) =>
      '${date.day} ${_months[date.month]} ${date.year}';
  static String _fileDate(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
