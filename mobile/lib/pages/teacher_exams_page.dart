import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/teacher_exam_edit_page.dart';
import 'package:student/pages/teacher_exam_live_camera_page.dart';
import 'package:student/pages/teacher_exam_results_page.dart';
import 'package:student/pages/teacher_exam_score_entry_page.dart';
import 'package:student/pages/teacher_create_exam_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/responsive_overlays.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherExamsPage extends StatefulWidget {
  const TeacherExamsPage({super.key});

  @override
  State<TeacherExamsPage> createState() => _TeacherExamsPageState();
}

class _TeacherExamsPageState extends State<TeacherExamsPage> {
  int selectedTab = 0;
  bool _loading = true;
  String _teacherName = '';

  final List<String> tabs = ["Yaklaşan Sınavlar", "Tamamlananlar"];

  final List<Map<String, dynamic>> upcomingExams = [];
  final List<Map<String, dynamic>> completedExams = [];

  String _decodeText(String? value) {
    return (value ?? '')
        .replaceAll('&#xFC;', 'ü')
        .replaceAll('&#xDC;', 'Ü')
        .replaceAll('&#xE7;', 'ç')
        .replaceAll('&#xC7;', 'Ç')
        .replaceAll('&#x131;', 'ı')
        .replaceAll('&#x130;', 'İ')
        .replaceAll('&#xF6;', 'ö')
        .replaceAll('&#xD6;', 'Ö')
        .replaceAll('&#x15F;', 'ş')
        .replaceAll('&#x15E;', 'Ş')
        .replaceAll('&#x11F;', 'ğ')
        .replaceAll('&#x11E;', 'Ğ')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&Ccedil;', 'Ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&Scedil;', 'Ş')
        .replaceAll('&nbsp;', ' ');
  }

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  Future<void> _loadExams() async {
    final session = await AuthSessionStore.instance.load();
    final examResults = await SchoolFeedApiService.instance.fetchExamResults();
    final planned = await PlannedExamApiService.instance.fetchPlannedExams(
      teacherName: session?.fullName,
    );
    final grouped = <String, List<dynamic>>{};
    for (final item in examResults) {
      final key =
          '${item.examTitle}|${item.className}|${item.subject}|${item.date}';
      grouped.putIfAbsent(key, () => []).add(item);
    }
    completedExams
      ..clear()
      ..addAll(
        grouped.values.map((items) {
          final first = items.first;
          final totalScore = items.fold<num>(
            0,
            (sum, item) => sum + (item as dynamic).score,
          );
          final average = totalScore / items.length;
          return {
            "title": first.examTitle,
            "type": first.type,
            "className": first.className,
            "subject": first.subject,
            "date": first.date,
            "questionCount": items.length,
            "duration": "-",
            "status": "Tamamlandi",
            "statusColor": const Color(0xFF69C36D),
            "accentColor": const Color(0xFF69C36D),
            "avgScore": average.toStringAsFixed(0),
            "sourceType": "Sınav Sonuçları",
            "sources": const <Map<String, String>>[],
          };
        }).toList(),
      );
    upcomingExams
      ..clear()
      ..addAll(
        planned.map(
          (item) => {
            "id": item.id,
            "title": item.title,
            "type": item.type,
            "className": item.className,
            "subject": item.subject,
            "date": item.date,
            "questionCount": item.questionCount,
            "duration": item.duration,
            "status": item.status,
            "statusColor": const Color(0xFF4E8DF5),
            "accentColor": const Color(0xFFFF7A00),
            "sourceType": item.sourceType,
            "sources": item.sources
                .map(
                  (source) => {
                    "title": source.title,
                    "type": source.type,
                    "subject": source.subject ?? item.subject,
                  },
                )
                .toList(),
          },
        ),
      );
    if (!mounted) return;
    setState(() {
      _teacherName = session?.fullName ?? _teacherName;
      _loading = false;
    });
  }

  Future<void> _createExam() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const TeacherCreateExamPage()),
    );
    if (!mounted || result == null) return;

    try {
      await PlannedExamApiService.instance.createPlannedExam({
        "title": result["title"],
        "type": result["type"],
        "className": result["className"],
        "subject": result["subject"],
        "dateLabel": result["date"],
        "duration": result["duration"],
        "questionCount": result["questionCount"],
        "lateEntryLimitMinutes": result["lateEntryLimitMinutes"],
        "liveLinkUrl": result["liveLinkUrl"],
        "requireCamera": result["requireCamera"],
        "requireFullscreen": result["requireFullscreen"],
        "blockTabChange": result["blockTabChange"],
        "blockCopyPaste": result["blockCopyPaste"],
        "teacherName": _teacherName,
        "sourceType": result["sourceType"],
        "sources": result["sources"],
      });
      await _loadExams();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Planlı sınav oluşturuldu.".tr)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _showExamDetail(Map<String, dynamic> exam) {
    final theme = Theme.of(context);
    final sources = (exam["sources"] as List?) ?? [];

    showModalBottomSheet(
      context: context,
      backgroundColor: theme.cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return ResponsiveSheetContainer(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Wrap(
              runSpacing: 14,
              children: [
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Text(
                  _decodeText(exam["title"] as String?),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                _detailRow("Ders", _decodeText(exam["subject"] as String?)),
                _detailRow("Sınıf", exam["className"] as String),
                _detailRow("Tür", _decodeText(exam["type"] as String?)),
                _detailRow("Tarih", exam["date"] as String),
                _detailRow("Soru", "${exam["questionCount"]}"),
                _detailRow("Süre", exam["duration"] as String),
                _detailRow("Kaynak", exam["sourceType"] as String? ?? "-"),
                if (exam["avgScore"] != null)
                  _detailRow("Ortalama", exam["avgScore"] as String),
                if (sources.isNotEmpty) ...[
                  Text(
                    "Seçilen İçerikler".tr,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  ...sources.map(
                    (item) => Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        _decodeText(item["title"] as String?),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    child: const Text("Kapat"),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value) {
    return Builder(
      builder: (context) {
        final theme = Theme.of(context);

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.scaffoldBackgroundColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 90,
                child: Text(
                  "$label:",
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Expanded(child: Text(value)),
            ],
          ),
        );
      },
    );
  }

  void _deleteExam(List<Map<String, dynamic>> list, int index) {
    final title = list[index]["title"] as String;
    final id = list[index]["id"] as String?;

    () async {
      if (id != null && id.isNotEmpty) {
        try {
          await PlannedExamApiService.instance.deletePlannedExam(id);
        } catch (error) {
          if (!mounted) return;
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(error.toString())));
          return;
        }
      }

      if (!mounted) return;
      setState(() {
        list.removeAt(index);
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("$title silindi")));
    }();
  }

  Future<void> _showExamActions(
    Map<String, dynamic> exam,
    int index,
    List<Map<String, dynamic>> sourceList,
  ) async {
    final isPlanned = selectedTab == 0;
    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sınav İşlemleri'.tr,
                style: Theme.of(sheetContext).textTheme.labelLarge?.copyWith(
                  color: Theme.of(
                    sheetContext,
                  ).textTheme.bodySmall?.color?.withValues(alpha: 0.68),
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _decodeText(exam['title'] as String?),
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 16),
              ...[
                'Görüntüle',
                if (isPlanned) 'Düzenle',
                'Sonuç Gir',
                'Sonuçları İncele',
                if (isPlanned) 'Kamera',
                if (isPlanned) 'Yoklama',
                'PDF',
                'Kopyala',
                if (isPlanned) 'Sil',
              ].map(
                (label) => SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () => Navigator.pop(sheetContext, label),
                    style: TextButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      foregroundColor: label == 'Sil' ? Colors.redAccent : null,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 15,
                      ),
                    ),
                    child: Text(
                      label.tr,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || action == null) return;
    switch (action) {
      case 'Görüntüle':
        _showExamDetail(exam);
        return;
      case 'Düzenle':
        final updatedExam = await Navigator.push<Map<String, dynamic>>(
          context,
          MaterialPageRoute(builder: (_) => TeacherExamEditPage(exam: exam)),
        );
        if (updatedExam != null && mounted) {
          setState(() => sourceList[index] = updatedExam);
        }
        return;
      case 'Sonuç Gir':
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const TeacherExamScoreEntryPage()),
        );
        return;
      case 'Sonuçları İncele':
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => TeacherExamResultsPage(exam: exam)),
        );
        return;
      case 'Kamera':
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TeacherExamLiveCameraPage(
              examId: (exam['id'] as String?) ?? '',
              examTitle: _decodeText(exam['title'] as String?),
            ),
          ),
        );
        return;
      case 'Yoklama':
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sınav yoklaması kamera ekranından takip edilir.'.tr),
          ),
        );
        return;
      case 'PDF':
        await _shareExamPdf(exam);
        return;
      case 'Kopyala':
        await Clipboard.setData(
          ClipboardData(
            text: [
              exam['title'],
              exam['subject'],
              exam['className'],
              exam['date'],
              exam['duration'],
            ].whereType<Object>().join(' • '),
          ),
        );
        return;
      case 'Sil':
        _deleteExam(sourceList, index);
        return;
    }
  }

  Future<void> _shareExamPdf(Map<String, dynamic> exam) async {
    final document = pw.Document();
    document.addPage(
      pw.Page(
        build: (_) => pw.Padding(
          padding: const pw.EdgeInsets.all(28),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Sinav Ozeti',
                style: pw.TextStyle(
                  fontSize: 22,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 20),
              ...[
                ['Sinav', _decodeText(exam['title'] as String?)],
                ['Ders', _decodeText(exam['subject'] as String?)],
                ['Sinif', exam['className']?.toString() ?? '-'],
                ['Tur', _decodeText(exam['type'] as String?)],
                ['Tarih', exam['date']?.toString() ?? '-'],
                ['Sure', exam['duration']?.toString() ?? '-'],
                ['Soru', exam['questionCount']?.toString() ?? '-'],
                ['Durum', exam['status']?.toString() ?? '-'],
              ].map(
                (row) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 10),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.SizedBox(
                        width: 90,
                        child: pw.Text(
                          row[0],
                          style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                        ),
                      ),
                      pw.Expanded(child: pw.Text(row[1])),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final directory = await getTemporaryDirectory();
    final file = File(
      '${directory.path}/sinav_${DateTime.now().millisecondsSinceEpoch}.pdf',
    );
    await file.writeAsBytes(await document.save());
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: _decodeText(exam['title'] as String?),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final currentList = selectedTab == 0 ? upcomingExams : completedExams;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sınavlarım".tr,
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${completedExams.length} tamamlanan sınav',
        showBackButton: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createExam,
        backgroundColor: theme.colorScheme.primary,
        foregroundColor: Colors.white,
        label: Text('Sınav Oluştur'.tr),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 16),
                  child: LinearProgressIndicator(),
                ),
              _heroCard(theme, isDark),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TeacherExamScoreEntryPage(),
                    ),
                  ),
                  child: Text('Sınav Notu / Deneme Puanı Gir'.tr),
                ),
              ),
              const SizedBox(height: 18),
              _tabBar(theme),
              const SizedBox(height: 18),
              if (currentList.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    children: [
                      Text(
                        selectedTab == 0
                            ? 'Henüz sınav oluşturulmamış'
                            : 'Henüz tamamlanmış sınav yok',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        selectedTab == 0
                            ? 'Öğrencilerin başarısını ölçmek için ilk sınavını oluştur.'
                            : 'Sınavlar tamamlandığında sonuçlar burada görünecek.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: selectedTab == 0 ? _createExam : _loadExams,
                        child: Text(
                          selectedTab == 0 ? 'Sınav Oluştur' : 'Yenile',
                        ),
                      ),
                    ],
                  ),
                ),
              ...currentList.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;

                return _examCard(
                  theme,
                  isDark,
                  item,
                  index,
                  selectedTab == 0 ? upcomingExams : completedExams,
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFA24A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF7A00).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Sınav Yönetimi".tr,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            "Yaklaşan sınavlarını planla, tamamlanan sınavları analiz et ve tüm süreci tek ekrandan yönet."
                .tr,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat("${upcomingExams.length}", "Yaklaşan"),
              const SizedBox(width: 12),
              _heroStat("${completedExams.length}", "Tamamlanan"),
              const SizedBox(width: 12),
              _heroStat(
                "${completedExams.isEmpty ? 0 : completedExams.length}",
                "Rapor",
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabBar(ThemeData theme) {
    return Row(
      children: List.generate(tabs.length, (index) {
        final selected = selectedTab == index;

        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
            },
            child: Container(
              margin: EdgeInsets.only(right: index == 0 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                tabs[index],
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: selected
                      ? Colors.white
                      : theme.textTheme.bodyMedium?.color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _examCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
    int index,
    List<Map<String, dynamic>> sourceList,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0B1728) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.10)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_decodeText(item["subject"] as String?)} • ${_decodeText(item["type"] as String?)}',
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.68),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            _decodeText(item["title"] as String?),
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            [
              item["className"],
              item["date"],
              item["duration"],
              '${item["questionCount"]} soru',
              item["status"],
            ].whereType<Object>().join(' • '),
            style: theme.textTheme.bodySmall?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              onPressed: () => _showExamActions(item, index, sourceList),
              child: Text('Yönet'.tr),
            ),
          ),
        ],
      ),
    );
  }
}
