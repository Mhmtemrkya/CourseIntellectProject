import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:student/i18n/app_locale.dart';

import '../services/admin_directory_api_service.dart';
import '../services/exam_results_store.dart';
import '../services/planned_exam_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/responsive_overlays.dart';

/// Masaüstündeki "Yönet" penceresinin mobil karşılığı.
///
/// Liste satırındaki tek butondan açılır; menüdeki her işlem gerçek uca yazar.
/// Yalnız sonucu olup planlı sınav kaydı bulunmayan (eski) kayıtlarda künye
/// düzenleme, yoklama ve silme kapalıdır — [exam.id] boş gelir.
class ExamRowData {
  final String? id;
  final String title;
  final String type;
  final String subject;
  final String className;
  final String dateLabel;
  final String startTime;
  final String duration;
  final int questionCount;
  final String status;
  final int? attendancePresent;
  final int? attendanceTotal;
  final double? averageScore;
  final int resultCount;

  const ExamRowData({
    required this.id,
    required this.title,
    required this.type,
    required this.subject,
    required this.className,
    required this.dateLabel,
    required this.startTime,
    required this.duration,
    required this.questionCount,
    required this.status,
    required this.attendancePresent,
    required this.attendanceTotal,
    required this.averageScore,
    required this.resultCount,
  });

  bool get isPlanned => (id ?? '').isNotEmpty;
}

const examStatuses = ['Taslak', 'Planlandı', 'Tamamlandı', 'İptal'];
const examTypes = ['Yazılı', 'Deneme', 'Ünite', 'Quiz', 'Proje'];

/// "1-A Sınıfı" ile "1-A" aynı sınıftır: karşılaştırmada ek ve işaretler atılır.
String examClassKey(String? value) => (value ?? '')
    .toLowerCase()
    .replaceAll(RegExp(r'sınıfı|sinifi|sınıf|sinif|şubesi|subesi'), '')
    .replaceAll(RegExp(r'[^a-z0-9çğıöşü]'), '');

Color examScoreColor(num? score) {
  final value = score ?? 0;
  if (value >= 85) return const Color(0xFF059669);
  if (value >= 70) return const Color(0xFF2563EB);
  if (value >= 50) return const Color(0xFFD97706);
  return const Color(0xFFDC2626);
}

class _Stats {
  final int count;
  final double average;
  final int highest;
  final int lowest;
  final int passed;
  final List<({String label, int count, Color color})> distribution;

  const _Stats(
    this.count,
    this.average,
    this.highest,
    this.lowest,
    this.passed,
    this.distribution,
  );

  factory _Stats.from(List<ExamScoreRecord> rows) {
    if (rows.isEmpty) {
      return const _Stats(0, 0, 0, 0, 0, [
        (label: '0-49', count: 0, color: Color(0xFFDC2626)),
        (label: '50-69', count: 0, color: Color(0xFFD97706)),
        (label: '70-84', count: 0, color: Color(0xFF2563EB)),
        (label: '85-100', count: 0, color: Color(0xFF059669)),
      ]);
    }
    final scores = rows.map((row) => row.score).toList()..sort();
    final total = scores.fold<int>(0, (sum, value) => sum + value);
    int between(int min, int max) =>
        scores.where((value) => value >= min && value <= max).length;
    return _Stats(
      scores.length,
      (total / scores.length * 10).roundToDouble() / 10,
      scores.last,
      scores.first,
      scores.where((value) => value >= 50).length,
      [
        (label: '0-49', count: between(0, 49), color: const Color(0xFFDC2626)),
        (label: '50-69', count: between(50, 69), color: const Color(0xFFD97706)),
        (label: '70-84', count: between(70, 84), color: const Color(0xFF2563EB)),
        (label: '85-100', count: between(85, 100), color: const Color(0xFF059669)),
      ],
    );
  }
}

/// Sınav yönetim penceresini açar. [onChanged] her başarılı yazma sonrası çağrılır.
Future<void> showExamManageSheet(
  BuildContext context, {
  required ExamRowData exam,
  required List<ExamScoreRecord> results,
  required Future<void> Function() onChanged,
  bool canEditResults = true,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Theme.of(context).cardColor,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (sheetContext) => _ExamManageSheet(
      exam: exam,
      results: results,
      onChanged: onChanged,
      canEditResults: canEditResults,
    ),
  );
}

class _ExamManageSheet extends StatefulWidget {
  final ExamRowData exam;
  final List<ExamScoreRecord> results;
  final Future<void> Function() onChanged;
  final bool canEditResults;

  const _ExamManageSheet({
    required this.exam,
    required this.results,
    required this.onChanged,
    required this.canEditResults,
  });

  @override
  State<_ExamManageSheet> createState() => _ExamManageSheetState();
}

class _ExamManageSheetState extends State<_ExamManageSheet> {
  bool _busy = false;
  late String _status = widget.exam.status;

  List<ExamScoreRecord> get _rows => widget.results
      .where((row) => row.examTitle == widget.exam.title)
      .toList();

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) _toast(error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _open(Widget page) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => page),
    );
    if (changed == true) {
      await widget.onChanged();
      if (mounted) Navigator.pop(context);
    }
  }

  Future<void> _changeStatus(String status) => _run(() async {
    await PlannedExamApiService.instance.updatePlannedExam(widget.exam.id!, {
      'status': status,
    });
    if (!mounted) return;
    setState(() => _status = status);
    _toast('Sınav durumu "$status" olarak güncellendi.');
    await widget.onChanged();
  });

  Future<void> _copySummary() async {
    final stats = _Stats.from(_rows);
    await Clipboard.setData(
      ClipboardData(
        text: [
          widget.exam.title,
          '${widget.exam.subject} • ${widget.exam.className}',
          '${widget.exam.dateLabel} ${widget.exam.startTime}'.trim(),
          '${stats.count} sonuç · ortalama ${stats.average}',
        ].where((line) => line.trim().isNotEmpty).join('\n'),
      ),
    );
    if (mounted) _toast('Özet panoya kopyalandı.'.tr);
  }

  Future<void> _sharePdf() => _run(() async {
    final rows = _rows..sort((a, b) => b.score.compareTo(a.score));
    final stats = _Stats.from(rows);
    final document = pw.Document();
    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (_) => [
          pw.Text(
            'SINAV SONUC RAPORU',
            style: pw.TextStyle(
              fontSize: 10,
              letterSpacing: 2,
              color: PdfColors.blue700,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            widget.exam.title,
            style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 16),
          pw.Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _pdfChip('Ders', widget.exam.subject),
              _pdfChip('Sinif', widget.exam.className),
              _pdfChip('Tur', widget.exam.type),
              _pdfChip(
                'Tarih',
                '${widget.exam.dateLabel} ${widget.exam.startTime}'.trim(),
              ),
              _pdfChip('Sure', widget.exam.duration),
              _pdfChip('Soru', '${widget.exam.questionCount}'),
            ],
          ),
          pw.SizedBox(height: 18),
          pw.Row(
            children: [
              _pdfStat('Katilim', '${stats.count}'),
              _pdfStat('Ortalama', '${stats.average}'),
              _pdfStat('En yuksek', '${stats.highest}'),
              _pdfStat('En dusuk', '${stats.lowest}'),
              _pdfStat('Gecen', '${stats.passed}'),
            ],
          ),
          pw.SizedBox(height: 18),
          pw.TableHelper.fromTextArray(
            headers: ['#', 'Ogrenci', 'Sinif', 'Net', 'Puan'],
            headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
            headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
            cellStyle: const pw.TextStyle(fontSize: 10),
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              3: pw.Alignment.centerRight,
              4: pw.Alignment.centerRight,
            },
            data: rows.isEmpty
                ? [
                    ['-', 'Henuz sonuc girilmemis', '', '', ''],
                  ]
                : List.generate(
                    rows.length,
                    (index) => [
                      '${index + 1}',
                      rows[index].studentName,
                      rows[index].className,
                      rows[index].net.toStringAsFixed(2),
                      '${rows[index].score}',
                    ],
                  ),
          ),
        ],
      ),
    );

    final directory = await getTemporaryDirectory();
    final safeName = widget.exam.title
        .replaceAll(RegExp(r'[^\w\s-]'), '')
        .trim()
        .replaceAll(RegExp(r'\s+'), '-')
        .toLowerCase();
    final file = File('${directory.path}/$safeName-sonuc-raporu.pdf');
    await file.writeAsBytes(await document.save());
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: widget.exam.title),
    );
  });

  Future<void> _shareCsv() => _run(() async {
    final rows = _rows..sort((a, b) => b.score.compareTo(a.score));
    final buffer = StringBuffer('﻿Ogrenci,Sinif,Sinav,Ders,Net,Puan\n');
    for (final row in rows) {
      buffer.writeln(
        '"${row.studentName}","${row.className}","${widget.exam.title}",'
        '"${widget.exam.subject}","${row.net}","${row.score}"',
      );
    }
    final directory = await getTemporaryDirectory();
    final file = File(
      '${directory.path}/${widget.exam.title.replaceAll(' ', '-').toLowerCase()}-sonuclar.csv',
    );
    await file.writeAsString(buffer.toString());
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: widget.exam.title),
    );
  });

  Future<void> _confirmDelete() async {
    final rows = _rows;
    final choice = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('"${widget.exam.title}" silinsin mi?'),
        content: Text(
          rows.isEmpty
              ? 'Sınav kaydı kalıcı olarak silinir.'.tr
              : 'Bu sınava girilmiş ${rows.length} sonuç var. Sonuçları koruyabilir veya sınavla birlikte silebilirsiniz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Vazgeç'.tr),
          ),
          if (rows.isNotEmpty)
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, 'keep'),
              child: Text('Sonuçları koru'.tr),
            ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(dialogContext, 'all'),
            child: Text(rows.isEmpty ? 'Sil'.tr : 'Hepsini sil'.tr),
          ),
        ],
      ),
    );
    if (choice == null) return;

    await _run(() async {
      if (choice == 'all') {
        for (final row in rows.where((item) => item.id != null)) {
          await SchoolFeedApiService.instance.deleteExamResult(row.id!);
        }
      }
      await PlannedExamApiService.instance.deletePlannedExam(widget.exam.id!);
      if (!mounted) return;
      _toast('Sınav silindi.'.tr);
      await widget.onChanged();
      if (mounted) Navigator.pop(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final exam = widget.exam;
    final rows = _rows;
    final canPlanned = exam.isPlanned;

    return SafeArea(
      child: ResponsiveSheetContainer(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sınav Yönetimi'.tr,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                exam.title,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                [
                  exam.subject,
                  exam.className,
                  exam.dateLabel,
                ].where((value) => value.trim().isNotEmpty).join(' • '),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              if (_busy) const LinearProgressIndicator(),
              _action(
                icon: Icons.visibility_outlined,
                label: 'Görüntüle',
                description: 'Künye, istatistik ve öğrenci sonuçları',
                trailing: '${rows.length} sonuç',
                onTap: () => _open(_ExamDetailPage(exam: exam, rows: rows)),
              ),
              _action(
                icon: Icons.edit_note_rounded,
                label: 'Sonuç Gir / Düzenle',
                description: 'Sınıf listesiyle toplu puan girişi',
                enabled: widget.canEditResults,
                onTap: () => _open(_ExamScoreEntryPage(exam: exam, rows: rows)),
              ),
              _action(
                icon: Icons.how_to_reg_outlined,
                label: 'Yoklama',
                description: canPlanned
                    ? 'Var / yok / geç kaldı işaretle'
                    : 'Planlı sınav kaydı olmadığı için kapalı',
                enabled: canPlanned && widget.canEditResults,
                onTap: () => _open(_ExamAttendancePage(exam: exam)),
              ),
              _action(
                icon: Icons.tune_rounded,
                label: 'Sınavı Düzenle',
                description: canPlanned
                    ? 'Başlık, ders, sınıf, tarih, süre ve durum'
                    : 'Planlı sınav kaydı olmadığı için kapalı',
                enabled: canPlanned && widget.canEditResults,
                onTap: () => _open(_ExamEditPage(exam: exam)),
              ),
              _action(
                icon: Icons.picture_as_pdf_outlined,
                label: 'PDF Raporu',
                description: 'Sonuç raporunu paylaş',
                onTap: _sharePdf,
              ),
              _action(
                icon: Icons.table_chart_outlined,
                label: 'CSV Paylaş',
                description: 'Sonuç listesini tabloya aktar',
                onTap: _shareCsv,
              ),
              _action(
                icon: Icons.copy_rounded,
                label: 'Özeti Kopyala',
                description: 'Sınav künyesi ve ortalamayı panoya al',
                onTap: _copySummary,
              ),
              _action(
                icon: Icons.delete_outline_rounded,
                label: 'Sınavı Sil',
                description: 'Kayıt listeden kaldırılır',
                enabled: canPlanned && widget.canEditResults,
                destructive: true,
                onTap: _confirmDelete,
              ),
              if (canPlanned && widget.canEditResults) ...[
                const SizedBox(height: 14),
                Text(
                  'DURUM'.tr,
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: examStatuses
                      .map(
                        (status) => ChoiceChip(
                          label: Text(status),
                          selected: _status == status,
                          onSelected: _busy
                              ? null
                              : (_) => _changeStatus(status),
                        ),
                      )
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _action({
    required IconData icon,
    required String label,
    required String description,
    required VoidCallback onTap,
    String? trailing,
    bool enabled = true,
    bool destructive = false,
  }) {
    final theme = Theme.of(context);
    final color = destructive ? Colors.red : theme.colorScheme.primary;
    return Opacity(
      opacity: enabled ? 1 : 0.42,
      child: InkWell(
        onTap: enabled && !_busy ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label.tr,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: destructive ? Colors.red : null,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description.tr,
                      style: theme.textTheme.bodySmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (trailing != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: theme.scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    trailing,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

pw.Widget _pdfChip(String label, String value) => pw.Container(
  padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
  decoration: pw.BoxDecoration(
    color: PdfColors.grey100,
    borderRadius: pw.BorderRadius.circular(8),
  ),
  child: pw.Text(
    '$label: ${value.isEmpty ? '-' : value}',
    style: const pw.TextStyle(fontSize: 10),
  ),
);

pw.Widget _pdfStat(String label, String value) => pw.Expanded(
  child: pw.Container(
    margin: const pw.EdgeInsets.only(right: 6),
    padding: const pw.EdgeInsets.symmetric(vertical: 10),
    decoration: pw.BoxDecoration(
      border: pw.Border.all(color: PdfColors.grey300),
      borderRadius: pw.BorderRadius.circular(8),
    ),
    child: pw.Column(
      children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
        pw.SizedBox(height: 2),
        pw.Text(value, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
      ],
    ),
  ),
);

// ─── Detay ────────────────────────────────────────────────────────────────────
class _ExamDetailPage extends StatelessWidget {
  final ExamRowData exam;
  final List<ExamScoreRecord> rows;

  const _ExamDetailPage({required this.exam, required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sorted = [...rows]..sort((a, b) => b.score.compareTo(a.score));
    final stats = _Stats.from(rows);

    return Scaffold(
      appBar: AppBar(title: Text('Sınav Detayı'.tr)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            exam.title,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _chip(context, 'Ders', exam.subject),
              _chip(context, 'Sınıf', exam.className),
              _chip(context, 'Tür', exam.type),
              _chip(
                context,
                'Tarih',
                '${exam.dateLabel} ${exam.startTime}'.trim(),
              ),
              _chip(context, 'Süre', exam.duration),
              _chip(context, 'Soru', '${exam.questionCount}'),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _stat(context, 'Sonuç', '${stats.count}'),
              _stat(context, 'Ortalama', '${stats.average}'),
              _stat(context, 'En Yüksek', '${stats.highest}'),
              _stat(context, 'En Düşük', '${stats.lowest}'),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Puan dağılımı'.tr,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          ...stats.distribution.map(
            (bucket) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(
                    width: 62,
                    child: Text(
                      bucket.label,
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: stats.count == 0
                            ? 0
                            : bucket.count / stats.count,
                        minHeight: 8,
                        backgroundColor: theme.dividerColor.withValues(
                          alpha: 0.3,
                        ),
                        valueColor: AlwaysStoppedAnimation(bucket.color),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 28,
                    child: Text(
                      '${bucket.count}',
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          if (sorted.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('Bu sınav için henüz sonuç girilmemiş.'.tr),
              ),
            )
          else
            ...sorted.asMap().entries.map(
              (entry) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(
                        '${entry.key + 1}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        entry.value.studentName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      'net ${entry.value.net.toStringAsFixed(2)}',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${entry.value.score}',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: examScoreColor(entry.value.score),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String label, String value) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.tr, style: theme.textTheme.labelSmall),
          Text(
            value.isEmpty ? '—' : value,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String label, String value) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            const SizedBox(height: 2),
            Text(
              label.tr,
              style: theme.textTheme.labelSmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Sonuç girişi ─────────────────────────────────────────────────────────────
class _ExamScoreEntryPage extends StatefulWidget {
  final ExamRowData exam;
  final List<ExamScoreRecord> rows;

  const _ExamScoreEntryPage({required this.exam, required this.rows});

  @override
  State<_ExamScoreEntryPage> createState() => _ExamScoreEntryPageState();
}

class _ExamScoreEntryPageState extends State<_ExamScoreEntryPage> {
  bool _loading = true;
  bool _saving = false;
  String _search = '';
  List<AdminStudentRecord> _roster = const [];
  final Map<String, TextEditingController> _scores = {};
  final Map<String, TextEditingController> _nets = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _scores.values) {
      controller.dispose();
    }
    for (final controller in _nets.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      final key = examClassKey(widget.exam.className);
      final matched = students
          .where((student) => examClassKey(student.className) == key)
          .toList();
      final roster = matched.isEmpty ? students : matched;
      for (final student in roster) {
        final existing = widget.rows
            .where((row) => row.studentName == student.fullName)
            .firstOrNull;
        _scores[student.fullName] = TextEditingController(
          text: existing == null ? '' : '${existing.score}',
        );
        _nets[student.fullName] = TextEditingController(
          text: existing == null ? '' : '${existing.net}',
        );
      }
      if (!mounted) return;
      setState(() {
        _roster = roster;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _save() async {
    final entries = _roster
        .where((student) => (_scores[student.fullName]?.text ?? '').trim().isNotEmpty)
        .toList();
    if (entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('En az bir öğrenciye puan yazın.'.tr)),
      );
      return;
    }

    setState(() => _saving = true);
    var created = 0;
    var updated = 0;
    try {
      for (final student in entries) {
        final score = int.tryParse(_scores[student.fullName]!.text.trim()) ?? 0;
        final net =
            double.tryParse(_nets[student.fullName]!.text.trim().replaceAll(',', '.')) ??
            0;
        final existing = widget.rows
            .where((row) => row.studentName == student.fullName)
            .firstOrNull;

        if (existing?.id != null) {
          await SchoolFeedApiService.instance.updateExamResult(
            id: existing!.id!,
            examTitle: widget.exam.title,
            type: widget.exam.type,
            subject: widget.exam.subject,
            dateLabel: widget.exam.dateLabel,
            className: student.className,
            score: score,
            net: net,
          );
          updated += 1;
        } else {
          await SchoolFeedApiService.instance.createExamResult(
            examTitle: widget.exam.title,
            type: widget.exam.type,
            subject: widget.exam.subject,
            dateLabel: widget.exam.dateLabel,
            studentName: student.fullName,
            className: student.className,
            score: score,
            net: net,
          );
          created += 1;
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$created yeni, $updated güncellenen sonuç kaydedildi.'),
        ),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.trim().toLowerCase();
    final visible = _roster
        .where(
          (student) =>
              query.isEmpty || student.fullName.toLowerCase().contains(query),
        )
        .toList();

    return Scaffold(
      appBar: AppBar(title: Text('Sonuç Girişi'.tr)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Kaydediliyor...'.tr : 'Sonuçları Kaydet'.tr),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: TextField(
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Öğrenci ara...'.tr,
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (value) => setState(() => _search = value),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Puanı boş bırakılan öğrenci kaydedilmez.'.tr,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ),
                Expanded(
                  child: visible.isEmpty
                      ? Center(child: Text('Bu sınıfta öğrenci bulunamadı.'.tr))
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: visible.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (_, index) {
                            final student = visible[index];
                            return Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        student.fullName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(
                                        student.className,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(
                                  width: 72,
                                  child: TextField(
                                    controller: _scores[student.fullName],
                                    keyboardType: TextInputType.number,
                                    textAlign: TextAlign.center,
                                    decoration: const InputDecoration(
                                      labelText: 'Puan',
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                SizedBox(
                                  width: 72,
                                  child: TextField(
                                    controller: _nets[student.fullName],
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                          decimal: true,
                                        ),
                                    textAlign: TextAlign.center,
                                    decoration: const InputDecoration(
                                      labelText: 'Net',
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}

// ─── Yoklama ──────────────────────────────────────────────────────────────────
class _ExamAttendancePage extends StatefulWidget {
  final ExamRowData exam;

  const _ExamAttendancePage({required this.exam});

  @override
  State<_ExamAttendancePage> createState() => _ExamAttendancePageState();
}

class _ExamAttendancePageState extends State<_ExamAttendancePage> {
  bool _loading = true;
  bool _saving = false;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await PlannedExamApiService.instance.fetchAttendance(
        widget.exam.id!,
      );
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await PlannedExamApiService.instance.saveAttendance(
        widget.exam.id!,
        _rows
            .map(
              (row) => {
                'studentUserId': row['studentUserId'],
                'studentUsername': row['studentUsername'],
                'studentName': row['studentName'],
                'className': row['className'],
                'status': row['status'],
              },
            )
            .toList(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${_rows.length} öğrenci için yoklama kaydedildi.')),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    const statuses = [
      ('Present', 'Var'),
      ('Late', 'Geç'),
      ('Absent', 'Yok'),
    ];

    return Scaffold(
      appBar: AppBar(title: Text('Yoklama'.tr)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _saving || _rows.isEmpty ? null : _save,
            child: Text(_saving ? 'Kaydediliyor...'.tr : 'Yoklamayı Kaydet'.tr),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _rows.isEmpty
          ? Center(child: Text('Bu sınav için öğrenci listesi bulunamadı.'.tr))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _rows.length,
              separatorBuilder: (_, _) => const Divider(height: 18),
              itemBuilder: (_, index) {
                final row = _rows[index];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${row['studentName'] ?? ''}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${row['className'] ?? ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      children: statuses
                          .map(
                            (status) => ChoiceChip(
                              label: Text(status.$2.tr),
                              selected: row['status'] == status.$1,
                              onSelected: (_) => setState(
                                () => _rows[index]['status'] = status.$1,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                );
              },
            ),
    );
  }
}

// ─── Künye düzenleme ──────────────────────────────────────────────────────────
class _ExamEditPage extends StatefulWidget {
  final ExamRowData exam;

  const _ExamEditPage({required this.exam});

  @override
  State<_ExamEditPage> createState() => _ExamEditPageState();
}

class _ExamEditPageState extends State<_ExamEditPage> {
  late final TextEditingController _title = TextEditingController(
    text: widget.exam.title,
  );
  late final TextEditingController _subject = TextEditingController(
    text: widget.exam.subject,
  );
  late final TextEditingController _className = TextEditingController(
    text: widget.exam.className,
  );
  late final TextEditingController _date = TextEditingController(
    text: widget.exam.dateLabel,
  );
  late final TextEditingController _startTime = TextEditingController(
    text: widget.exam.startTime,
  );
  late final TextEditingController _duration = TextEditingController(
    text: widget.exam.duration,
  );
  late final TextEditingController _questionCount = TextEditingController(
    text: '${widget.exam.questionCount}',
  );
  late String _type = examTypes.contains(widget.exam.type)
      ? widget.exam.type
      : examTypes.first;
  late String _status = examStatuses.contains(widget.exam.status)
      ? widget.exam.status
      : examStatuses[1];
  bool _saving = false;

  @override
  void dispose() {
    for (final controller in [
      _title,
      _subject,
      _className,
      _date,
      _startTime,
      _duration,
      _questionCount,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty ||
        _subject.text.trim().isEmpty ||
        _className.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Başlık, ders ve sınıf zorunlu.'.tr)),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await PlannedExamApiService.instance.updatePlannedExam(widget.exam.id!, {
        'title': _title.text.trim(),
        'subject': _subject.text.trim(),
        'className': _className.text.trim(),
        'dateLabel': _date.text.trim(),
        'startTime': _startTime.text.trim(),
        'duration': _duration.text.trim(),
        'type': _type,
        'status': _status,
        'questionCount': int.tryParse(_questionCount.text.trim()),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Sınav güncellendi.'.tr)));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Sınavı Düzenle'.tr)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Kaydediliyor...'.tr : 'Kaydet'.tr),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _field(_title, 'Başlık'),
          _field(_subject, 'Ders'),
          _field(_className, 'Sınıf'),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: InputDecoration(
              labelText: 'Tür'.tr,
              border: const OutlineInputBorder(),
            ),
            items: examTypes
                .map(
                  (type) => DropdownMenuItem(value: type, child: Text(type)),
                )
                .toList(),
            onChanged: (value) => setState(() => _type = value ?? _type),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: InputDecoration(
              labelText: 'Durum'.tr,
              border: const OutlineInputBorder(),
            ),
            items: examStatuses
                .map(
                  (status) =>
                      DropdownMenuItem(value: status, child: Text(status)),
                )
                .toList(),
            onChanged: (value) => setState(() => _status = value ?? _status),
          ),
          const SizedBox(height: 12),
          _field(_date, 'Tarih'),
          _field(_startTime, 'Saat'),
          _field(_duration, 'Süre'),
          _field(_questionCount, 'Soru sayısı', number: true),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool number = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: number ? TextInputType.number : null,
        decoration: InputDecoration(
          labelText: label.tr,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
