import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/exam_manage_sheet.dart';
import 'package:student/pages/teacher_create_exam_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/exam_results_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/exam_list_row.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/teacher_header.dart';

/// Sınavlar — masaüstündeki `/exams` ekranının mobil karşılığı.
///
/// Omurga PLANLI SINAV kayıtlarıdır; künyesi olmayıp yalnız sonucu girilmiş eski
/// kayıtlar da başlığa göre türetilip listeye eklenir (aksi hâlde girilmiş
/// sonuçlar hiçbir yerde görünmez). Satırdaki tek "Yönet" butonu tüm işlemleri
/// içeren pencereyi açar.
class TeacherExamsPage extends StatefulWidget {
  const TeacherExamsPage({super.key});

  @override
  State<TeacherExamsPage> createState() => _TeacherExamsPageState();
}

class _TeacherExamsPageState extends State<TeacherExamsPage> {
  static const _all = 'all';

  bool _loading = true;
  String? _error;
  String _teacherName = '';
  bool _canManage = true;

  List<PlannedExamRecord> _planned = const [];
  List<ExamScoreRecord> _results = const [];

  String _search = '';
  String _subjectFilter = _all;
  String _classFilter = _all;
  String _typeFilter = _all;
  String _statusFilter = _all;

  @override
  void initState() {
    super.initState();
    _load();
  }

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
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&nbsp;', ' ');
  }

  Future<void> _load() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final role = (session?.primaryRole ?? '').toLowerCase();
      // Öğretmen yalnız kendi sınavlarını görür; yönetici/idare tüm kurumu görür.
      final isTeacherOnly = role == 'teacher';
      final planned = await PlannedExamApiService.instance.fetchPlannedExams(
        teacherName: isTeacherOnly ? session?.fullName : null,
      );
      final results = await SchoolFeedApiService.instance.fetchExamResults();
      if (!mounted) return;
      setState(() {
        _teacherName = session?.fullName ?? '';
        _canManage = role != 'student' && role != 'parent';
        _planned = planned;
        _results = results;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  /// Sunucudan gelen tür adı enum olabilir (Written/MockExam); listede Türkçe gösterilir.
  String _typeLabel(String? raw) {
    switch ((raw ?? '').toLowerCase()) {
      case 'written':
        return 'Yazılı';
      case 'mockexam':
        return 'Deneme';
      case 'oral':
        return 'Sözlü';
      case 'quiz':
        return 'Quiz';
      case 'unit':
        return 'Ünite';
      case 'project':
        return 'Proje';
      default:
        return (raw == null || raw.isEmpty) ? 'Yazılı' : raw;
    }
  }

  List<ExamRowData> get _rows {
    final rows = <ExamRowData>[];
    for (final exam in _planned) {
      final examResults = _results
          .where((row) => row.examTitle == exam.title)
          .toList();
      final average =
          exam.averageScore ??
          (examResults.isEmpty
              ? null
              : examResults.fold<int>(0, (sum, row) => sum + row.score) /
                    examResults.length);
      rows.add(
        ExamRowData(
          id: exam.id,
          title: _decodeText(exam.title),
          type: _typeLabel(exam.type),
          subject: _decodeText(exam.subject),
          className: exam.className,
          dateLabel: exam.date,
          startTime: exam.startTime,
          duration: exam.duration,
          questionCount: exam.questionCount,
          status: exam.status,
          attendancePresent: exam.attendancePresent,
          attendanceTotal: exam.attendanceTotal,
          averageScore: average == null
              ? null
              : (average * 10).roundToDouble() / 10,
          resultCount: exam.resultCount ?? examResults.length,
        ),
      );
    }

    final knownTitles = _planned.map((exam) => exam.title.toLowerCase()).toSet();
    final orphanTitles = _results
        .map((row) => row.examTitle)
        .where((title) => !knownTitles.contains(title.toLowerCase()))
        .toSet();
    for (final title in orphanTitles) {
      final examResults = _results
          .where((row) => row.examTitle == title)
          .toList();
      final first = examResults.first;
      final average =
          examResults.fold<int>(0, (sum, row) => sum + row.score) /
          examResults.length;
      rows.add(
        ExamRowData(
          id: null,
          title: _decodeText(title),
          type: _typeLabel(first.type),
          subject: _decodeText(first.subject),
          className: first.className,
          dateLabel: first.date,
          startTime: '',
          duration: '',
          questionCount: 0,
          status: 'Tamamlandı',
          attendancePresent: examResults.length,
          attendanceTotal: examResults.length,
          averageScore: (average * 10).roundToDouble() / 10,
          resultCount: examResults.length,
        ),
      );
    }
    return rows;
  }

  List<ExamRowData> _filter(List<ExamRowData> rows) {
    final query = _search.trim().toLowerCase();
    return rows.where((row) {
      if (query.isNotEmpty &&
          !'${row.title} ${row.subject} ${row.className}'
              .toLowerCase()
              .contains(query)) {
        return false;
      }
      if (_subjectFilter != _all && row.subject != _subjectFilter) return false;
      if (_classFilter != _all &&
          examClassKey(row.className) != examClassKey(_classFilter)) {
        return false;
      }
      if (_typeFilter != _all && row.type != _typeFilter) return false;
      if (_statusFilter != _all && row.status != _statusFilter) return false;
      return true;
    }).toList();
  }

  Future<void> _createExam() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const TeacherCreateExamPage()),
    );
    if (!mounted || result == null) return;
    try {
      await PlannedExamApiService.instance.createPlannedExam({
        'title': result['title'],
        'type': result['type'],
        'className': result['className'],
        'subject': result['subject'],
        'dateLabel': result['date'],
        'duration': result['duration'],
        'questionCount': result['questionCount'],
        'lateEntryLimitMinutes': result['lateEntryLimitMinutes'],
        'liveLinkUrl': result['liveLinkUrl'],
        'requireCamera': result['requireCamera'],
        'requireFullscreen': result['requireFullscreen'],
        'blockTabChange': result['blockTabChange'],
        'blockCopyPaste': result['blockCopyPaste'],
        'teacherName': _teacherName,
        'sourceType': result['sourceType'],
        'sources': result['sources'],
      });
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Sınav oluşturuldu.'.tr)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final rows = _rows;
    final filtered = _filter(rows);
    final completed = rows
        .where((row) => row.status.toLowerCase() == 'tamamlandı')
        .length;
    final rate = rows.isEmpty
        ? 0
        : (completed / rows.length * 1000).round() / 10;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: 'Sınavlar'.tr,
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: 'Sınav sonuç girişi ve mevcut kayıtlar'.tr,
        showBackButton: true,
      ),
      floatingActionButton: _canManage
          ? FloatingActionButton.extended(
              onPressed: _createExam,
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text('Yeni Sınav'.tr),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            if (_loading) const LinearProgressIndicator(),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(_error!),
              ),
            ResponsiveContent(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _statTile(
                        theme,
                        Icons.assignment_outlined,
                        const Color(0xFF2563EB),
                        'Toplam Sınav',
                        '${rows.length}',
                        'Tüm zamanlar',
                      ),
                      const SizedBox(width: 10),
                      _statTile(
                        theme,
                        Icons.check_circle_outline_rounded,
                        const Color(0xFF059669),
                        'Tamamlanan',
                        '$completed',
                        '%$rate tamamlandı',
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Sınav ara...'.tr,
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (value) => setState(() => _search = value),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _filterChip(
                        'Tüm Dersler',
                        _subjectFilter,
                        rows.map((row) => row.subject).toSet().toList(),
                        (value) => setState(() => _subjectFilter = value),
                      ),
                      _filterChip(
                        'Tüm Sınıflar',
                        _classFilter,
                        rows.map((row) => row.className).toSet().toList(),
                        (value) => setState(() => _classFilter = value),
                      ),
                      _filterChip(
                        'Tüm Türler',
                        _typeFilter,
                        rows.map((row) => row.type).toSet().toList(),
                        (value) => setState(() => _typeFilter = value),
                      ),
                      _filterChip(
                        'Tüm Durumlar',
                        _statusFilter,
                        rows.map((row) => row.status).toSet().toList(),
                        (value) => setState(() => _statusFilter = value),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (!_loading && filtered.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: theme.cardColor,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Column(
                        children: [
                          Text(
                            'Kayıtlı sınav bulunamadı'.tr,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Filtreleri değiştirin veya yeni bir sınav oluşturun.'
                                .tr,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ...filtered.map(
                    (row) => ExamListRow(
                      row: row,
                      onManage: () => showExamManageSheet(
                        context,
                        exam: row,
                        results: _results,
                        canEditResults: _canManage,
                        onChanged: _load,
                      ),
                    ),
                  ),
                  if (filtered.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        '${'Toplam'.tr} ${filtered.length} ${'sınav'.tr}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statTile(
    ThemeData theme,
    IconData icon,
    Color color,
    String label,
    String value,
    String caption,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 19),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.tr,
                    style: theme.textTheme.labelSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    caption.tr,
                    style: theme.textTheme.labelSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(
    String label,
    String value,
    List<String> options,
    ValueChanged<String> onChanged,
  ) {
    final selected = value != _all;
    return PopupMenuButton<String>(
      onSelected: onChanged,
      itemBuilder: (_) => [
        PopupMenuItem(value: _all, child: Text(label.tr)),
        ...options
            .where((option) => option.trim().isNotEmpty)
            .map((option) => PopupMenuItem(value: option, child: Text(option))),
      ],
      child: Chip(
        label: Text(selected ? value : label.tr),
        avatar: const Icon(Icons.filter_list_rounded, size: 16),
        backgroundColor: selected
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
            : null,
      ),
    );
  }
}
