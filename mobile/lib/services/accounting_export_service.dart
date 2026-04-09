import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import 'accounting_finance_store.dart';

class AccountingExportFile {
  final File file;
  final String label;

  const AccountingExportFile({
    required this.file,
    required this.label,
  });
}

class AccountingExportService {
  AccountingExportService._();

  static final AccountingExportService instance = AccountingExportService._();

  Future<AccountingExportFile> buildExport({
    required String exportType,
    required AccountingFinanceStore store,
  }) async {
    return switch (exportType) {
      'Excel' => _buildCsv(store),
      'PDF' => _buildPdf(store),
      _ => _buildReceiptPackage(store),
    };
  }

  Future<void> shareExport(AccountingExportFile export) async {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(export.file.path)],
        text: '${export.label} dosyasi hazir.',
      ),
    );
  }

  Future<void> openExport(AccountingExportFile export) async {
    await OpenFilex.open(export.file.path);
  }

  Future<AccountingExportFile> saveExport({
    required AccountingExportFile export,
  }) async {
    final directory = await _resolveExportDirectory();
    final target = File('${directory.path}/${export.file.uri.pathSegments.last}');
    final bytes = await export.file.readAsBytes();
    final saved = await target.writeAsBytes(bytes, flush: true);
    return AccountingExportFile(file: saved, label: export.label);
  }

  Future<AccountingExportFile> _buildCsv(AccountingFinanceStore store) async {
    final lines = <String>[
      'Tip,Ad/Sistem,Kategori/Sınıf,Tutar,Durum/Tarih',
      ...store.collections.map((item) => 'Tahsilat,${_escape(item.name)},${_escape(item.className)},${_escape(item.amount)},${_escape(item.time)}'),
      ...store.installments.map((item) => 'Taksit,${_escape(item.student)},${_escape(item.status)},${_escape(item.amount)},${_escape(item.due)}'),
      ...store.invoices.map((item) => 'Fatura,${_escape(item.title)},${_escape(item.category)},${_escape(item.amount)},${_escape(item.status)}'),
      ...store.salaries.map((item) => 'Bordro,${_escape(item.employee)},${_escape(item.role)},${_escape(item.amount)},${_escape(item.status)}'),
    ];

    final file = await _writeFile(
      'muhasebe_raporu.csv',
      Uint8List.fromList([0xEF, 0xBB, 0xBF, ...lines.join('\n').codeUnits]),
    );
    return AccountingExportFile(file: file, label: 'Excel/CSV');
  }

  Future<AccountingExportFile> _buildPdf(AccountingFinanceStore store) async {
    final regularFont = await _loadPdfFont();
    final document = pw.Document();
    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        theme: pw.ThemeData.withFont(base: regularFont, bold: regularFont),
        build: (context) => [
          pw.Text(
            'CourseIntellect Finans Özeti',
            style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 12),
          pw.Text('Toplam Tahsilat: ${store.formatAmount(store.collectedTotal)}'),
          pw.Text('Bekleyen Tutar: ${store.formatAmount(store.pendingTotal)}'),
          pw.Text('Geciken Tutar: ${store.formatAmount(store.overdueTotal)}'),
          pw.SizedBox(height: 18),
          pw.Text('Son Tahsilatlar', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headers: const ['Öğrenci', 'Sınıf', 'Yöntem', 'Tutar'],
            data: store.collections
                .take(8)
                .map((item) => [item.name, item.className, item.method, item.amount])
                .toList(),
          ),
          pw.SizedBox(height: 18),
          pw.Text('Onay Bekleyenler', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headers: const ['Baslik', 'Kategori', 'Durum'],
            data: store.approvals
                .take(8)
                .map((item) => [item.title, item.category, item.status])
                .toList(),
          ),
        ],
      ),
    );

    final file = await _writeFile('muhasebe_ozeti.pdf', await document.save());
    return AccountingExportFile(file: file, label: 'PDF');
  }

  Future<AccountingExportFile> _buildReceiptPackage(AccountingFinanceStore store) async {
    final regularFont = await _loadPdfFont();
    final document = pw.Document();
    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        theme: pw.ThemeData.withFont(base: regularFont, bold: regularFont),
        build: (context) => [
          pw.Text(
            'Makbuz Paketi',
            style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            headers: const ['No', 'Öğrenci', 'Yöntem', 'Tutar', 'Saat'],
            data: store.collections.asMap().entries.map((entry) {
              final receiptNo = 'TR-2026-${(entry.key + 1).toString().padLeft(3, '0')}';
              final item = entry.value;
              return [receiptNo, item.name, item.method, item.amount, item.time];
            }).toList(),
          ),
        ],
      ),
    );

    final file = await _writeFile('makbuz_paketi.pdf', await document.save());
    return AccountingExportFile(file: file, label: 'Makbuz Paketi');
  }

  Future<File> _writeFile(String fileName, List<int> bytes) async {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/$fileName');
    return file.writeAsBytes(bytes, flush: true);
  }

  Future<Directory> _resolveExportDirectory() async {
    if (Platform.isIOS) {
      final documents = await getApplicationDocumentsDirectory();
      final exportDir = Directory('${documents.path}/Exports');
      if (!await exportDir.exists()) {
        await exportDir.create(recursive: true);
      }
      return exportDir;
    }

    final downloads = await getDownloadsDirectory();
    if (downloads != null) {
      final exportDir = Directory('${downloads.path}/CourseIntellect Exports');
      if (!await exportDir.exists()) {
        await exportDir.create(recursive: true);
      }
      return exportDir;
    }

    final documents = await getApplicationDocumentsDirectory();
    final exportDir = Directory('${documents.path}/Exports');
    if (!await exportDir.exists()) {
      await exportDir.create(recursive: true);
    }
    return exportDir;
  }

  String _escape(String value) {
    final normalized = value.replaceAll('"', '""');
    return '"$normalized"';
  }

  Future<pw.Font> _loadPdfFont() async {
    final fontData = await rootBundle.load('assets/fonts/ArialUnicode.ttf');
    return pw.Font.ttf(fontData);
  }
}
