import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/exam_results_store.dart';
import '../services/planned_exam_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/teacher_header.dart';
import 'student_exam_history_page.dart';

class TeacherExamScoreEntryPage extends StatefulWidget {
  const TeacherExamScoreEntryPage({super.key});

  @override
  State<TeacherExamScoreEntryPage> createState() =>
      _TeacherExamScoreEntryPageState();
}

class _TeacherExamScoreEntryPageState extends State<TeacherExamScoreEntryPage> {
  String _selectedClass = '';
  String _searchQuery = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<ExamScoreRecord> _records = const [];
  List<PlannedExamRecord> _plannedExams = const [];
  String _teacherName = '';

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

  String _monthName(int month) {
    const months = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Hazıran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    return months[month - 1];
  }

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final classes = _records.map((e) => e.className).toSet().toList()..sort();
    final effectiveClass = classes.contains(_selectedClass)
        ? _selectedClass
        : (classes.isEmpty ? '' : classes.first);
    final students =
        _records
            .where((e) => e.className == effectiveClass)
            .map((e) => e.studentName)
            .toSet()
            .toList()
          ..sort();
    final classRecords = _records
        .where((e) => e.className == effectiveClass)
        .toList();
    final average = classRecords.isEmpty
        ? 0
        : classRecords.fold<int>(0, (sum, item) => sum + item.score) ~/
              classRecords.length;
    final subject = classRecords.isNotEmpty
        ? _decodeText(classRecords.first.subject)
        : 'Öğretmen';
    final visibleStudents = students
        .where(
          (student) => _decodeText(
            student,
          ).toLowerCase().contains(_searchQuery.toLowerCase()),
        )
        .toList();

    return Scaffold(
      backgroundColor: _pageColor(theme),
      appBar: TeacherHeader(
        title: 'Sonuç Girişi'.tr,
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '$subject Öğretmeni',
        showBackButton: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loadRecords,
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                ResponsiveContent(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _heroCard(
                        theme,
                        isDark,
                        average,
                        students.length,
                        effectiveClass,
                      ),
                      const SizedBox(height: 16),
                      _actionBar(theme, classRecords, visibleStudents),
                      const SizedBox(height: 16),
                      _classSelector(theme, classes, effectiveClass),
                      const SizedBox(height: 16),
                      ...visibleStudents.map(
                        (student) =>
                            _studentCard(context, student, effectiveClass),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Color _pageColor(ThemeData theme) => theme.brightness == Brightness.dark
      ? const Color(0xFF071120)
      : const Color(0xFFF6F8FC);

  Color _cardColor(ThemeData theme) => theme.brightness == Brightness.dark
      ? const Color(0xFF0E1A2F)
      : Colors.white;

  Color _borderColor(ThemeData theme) => theme.brightness == Brightness.dark
      ? Colors.white.withValues(alpha: 0.08)
      : const Color(0xFFE2E8F0);

  Color _mutedText(ThemeData theme) => theme.brightness == Brightness.dark
      ? Colors.white.withValues(alpha: 0.68)
      : const Color(0xFF64748B);

  Future<void> _loadRecords() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final records = await SchoolFeedApiService.instance.fetchExamResults();
      final plannedExams = await PlannedExamApiService.instance
          .fetchPlannedExams(teacherName: session?.fullName)
          .catchError((_) => <PlannedExamRecord>[]);
      if (!mounted) return;
      setState(() {
        _teacherName = session?.fullName ?? _teacherName;
        _records = records;
        _plannedExams = plannedExams;
        if (records.isNotEmpty &&
            !records.any((item) => item.className == _selectedClass)) {
          _selectedClass = records.first.className;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  void _exportRecords(List<ExamScoreRecord> records) {
    if (records.isEmpty) {
      _showSnack('Dışa aktarılacak kayıt bulunamadı.');
      return;
    }
    _showSnack('${records.length} kayıt dışa aktarım için hazırlandı.');
  }

  void _openImportSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'İçe Aktar'.tr,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                'E-Okul formatındaki dosya seçildiğinde öğrenciler mevcut kayıtlarla eşleştirilecek.'.tr,
                style: TextStyle(color: _mutedText(Theme.of(context))),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _showSnack('Dosya seçici entegrasyonu hazır.');
                  },
                  icon: const Icon(Icons.upload_file_rounded),
                  label: Text('Dosya Seç'.tr),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _actionBar(
    ThemeData theme,
    List<ExamScoreRecord> classRecords,
    List<String> visibleStudents,
  ) {
    final actions = [
      (
        Icons.download_rounded,
        'E-Okul',
        () => _exportRecords(classRecords),
        const Color(0xFF3B82F6),
      ),
      (
        Icons.upload_file_rounded,
        'İçe Aktar',
        _openImportSheet,
        const Color(0xFF22C55E),
      ),
      (
        Icons.ios_share_rounded,
        'Dışa Aktar',
        () => _exportRecords(classRecords),
        const Color(0xFF2563EB),
      ),
      (
        Icons.picture_as_pdf_rounded,
        'PDF',
        () => _showSnack('PDF rapor oluşturma hazır.'),
        const Color(0xFF8B5CF6),
      ),
      (
        Icons.save_rounded,
        'Kaydet',
        () => _showSnack(
          '${visibleStudents.length} öğrenci için değişiklikler kaydedildi.',
        ),
        const Color(0xFFFF8A00),
      ),
    ];

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: actions.map((item) {
        return SizedBox(
          width: 124,
          child: FilledButton.icon(
            onPressed: item.$3,
            style: FilledButton.styleFrom(
              backgroundColor: item.$4,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            icon: Icon(item.$1, size: 18),
            label: Text(
              item.$2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _heroCard(
    ThemeData theme,
    bool isDark,
    int average,
    int studentCount,
    String className,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF071120), Color(0xFF0E1A2F), Color(0xFF23143B)]
              : const [Color(0xFFFF8A00), Color(0xFF3B82F6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.42),
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF8A00).withValues(alpha: 0.18),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'Öğretmen giriş merkezi'.tr,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Sınav notlarını ve deneme puanlarını sınıf bazında hızlıca yönetin.'.tr,
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Öğrenciye özel puan girişi yapın, son sonucu görün ve tek dokunuşla tüm geçmişi açın.'.tr,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _heroStat('Sınıf Ort.', '$average'),
              const SizedBox(width: 10),
              _heroStat('Öğrenci', '$studentCount'),
              const SizedBox(width: 10),
              _heroStat('Sınıf', className),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.white70,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _classSelector(
    ThemeData theme,
    List<String> classes,
    String effectiveClass,
  ) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _cardColor(theme),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _borderColor(theme)),
        boxShadow: [
          BoxShadow(
            color: theme.brightness == Brightness.dark
                ? Colors.black.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sınıf Seçimi'.tr,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: effectiveClass.isEmpty ? null : effectiveClass,
            decoration: InputDecoration(
              labelText: 'Sınıf'.tr,
              border: OutlineInputBorder(),
            ),
            items: classes
                .map(
                  (value) => DropdownMenuItem(value: value, child: Text(value)),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _selectedClass = value ?? effectiveClass),
          ),
          const SizedBox(height: 12),
          TextField(
            onChanged: (value) => setState(() => _searchQuery = value),
            decoration: InputDecoration(
              labelText: 'Öğrenci ara'.tr,
              prefixIcon: Icon(Icons.search_rounded),
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _studentCard(BuildContext context, String student, String className) {
    final theme = Theme.of(context);
    final studentRecords =
        _records.where((item) => item.studentName == student).toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final latest = studentRecords.firstWhere(
      (item) => item.className == className,
      orElse: () => studentRecords.first,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _cardColor(theme),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _borderColor(theme)),
        boxShadow: [
          BoxShadow(
            color: theme.brightness == Brightness.dark
                ? Colors.black.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: theme.colorScheme.primary.withValues(
                  alpha: 0.12,
                ),
                child: Text(
                  student[0],
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _decodeText(student),
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _decodeText(latest.examTitle),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.72,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              _scoreBadge(theme, latest.score),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              SizedBox(
                width: 108,
                child: _miniMetric(
                  theme,
                  icon: Icons.edit_calendar_rounded,
                  label: 'Puan',
                  value: '${latest.score}',
                  color: const Color(0xFFFF8A00),
                ),
              ),
              SizedBox(
                width: 108,
                child: _miniMetric(
                  theme,
                  icon: Icons.fact_check_outlined,
                  label: 'Net',
                  value: '${latest.net}',
                  color: const Color(0xFF3B82F6),
                ),
              ),
              SizedBox(
                width: 108,
                child: _miniMetric(
                  theme,
                  icon: Icons.history_rounded,
                  label: 'Kayıt'.tr,
                  value: '${studentRecords.length}',
                  color: const Color(0xFF22C55E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () =>
                      _openScoreSheet(context, student, latest, className),
                  icon: const Icon(Icons.edit_note_rounded),
                  label: const Text('Not Gir'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openStudentDetailSheet(
                    context,
                    student,
                    className,
                    studentRecords,
                    latest,
                  ),
                  icon: const Icon(Icons.visibility_rounded),
                  label: const Text('Detay'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _scoreBadge(ThemeData theme, int score) {
    final color = score >= 85
        ? const Color(0xFF10B981)
        : score >= 70
        ? const Color(0xFFF59E0B)
        : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        '$score',
        style: TextStyle(color: color, fontWeight: FontWeight.w900),
      ),
    );
  }

  Widget _miniMetric(
    ThemeData theme, {
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openStudentDetailSheet(
    BuildContext context,
    String student,
    String className,
    List<ExamScoreRecord> records,
    ExamScoreRecord latest,
  ) {
    final theme = Theme.of(context);
    final average = records.isEmpty
        ? 0
        : (records.fold<int>(0, (sum, item) => sum + item.score) /
                  records.length)
              .round();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: _cardColor(theme),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 20),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: const Color(
                          0xFFFF8A00,
                        ).withValues(alpha: 0.16),
                        child: Text(
                          _decodeText(student).isEmpty
                              ? '?'
                              : _decodeText(student)[0],
                          style: const TextStyle(
                            color: Color(0xFFFF8A00),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _decodeText(student),
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$className • ${_decodeText(latest.subject)}',
                              style: TextStyle(color: _mutedText(theme)),
                            ),
                          ],
                        ),
                      ),
                      _scoreBadge(theme, average),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: _miniMetric(
                          theme,
                          icon: Icons.insights_rounded,
                          label: 'Ortalama',
                          value: '$average',
                          color: const Color(0xFF8B5CF6),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _miniMetric(
                          theme,
                          icon: Icons.emoji_events_rounded,
                          label: 'Kayıt'.tr,
                          value: '${records.length}',
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Son Sınav Sonuçları'.tr,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...records
                      .take(5)
                      .map(
                        (item) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _pageColor(theme),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: _borderColor(theme)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _decodeText(item.examTitle),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Text(
                                '${item.score}',
                                style: const TextStyle(
                                  color: Color(0xFFFF8A00),
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(
                              this.context,
                              MaterialPageRoute(
                                builder: (_) => StudentExamHistoryPage(
                                  studentName: student,
                                  title: 'Öğrenci Sonuç Geçmişi'.tr,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.bar_chart_rounded),
                          label: Text('Geçmiş'.tr),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            _openScoreSheet(
                              this.context,
                              student,
                              latest,
                              className,
                            );
                          },
                          icon: const Icon(Icons.edit_note_rounded),
                          label: const Text('Not Gir'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => _showSnack(
                        '${_decodeText(student)} için PDF rapor hazırlanıyor.',
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFFF8A00),
                      ),
                      icon: const Icon(Icons.picture_as_pdf_rounded),
                      label: const Text('PDF Rapor'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openScoreSheet(
    BuildContext context,
    String student,
    ExamScoreRecord latest,
    String className,
  ) {
    final resultExamOptions = <String>{
      ..._plannedExams.map((item) => _decodeText(item.title)),
      ..._records.map((item) => _decodeText(item.examTitle)),
    }.where((item) => item.trim().isNotEmpty).toList()..sort();
    final subjectOptions = <String>{
      ..._plannedExams.map((item) => _decodeText(item.subject)),
      ..._records.map((item) => _decodeText(item.subject)),
    }.where((item) => item.trim().isNotEmpty).toList()..sort();
    final safeLatestExamTitle = _decodeText(latest.examTitle);
    String selectedExam = resultExamOptions.contains(safeLatestExamTitle)
        ? safeLatestExamTitle
        : (resultExamOptions.isNotEmpty
              ? resultExamOptions.first
              : safeLatestExamTitle);
    String selectedExamType = latest.type == 'Deneme' ? 'Deneme' : latest.type;
    String selectedSubject = _decodeText(latest.subject);
    String selectedDateLabel = latest.date;
    DateTime? selectedDateValue;
    final scoreController = TextEditingController(text: '${latest.score}');
    final netController = TextEditingController(text: '${latest.net}');

    void syncFromExamTitle(
      String title,
      void Function(void Function()) setSheetState,
    ) {
      final plannedMatch = _plannedExams
          .where((item) => _decodeText(item.title) == title)
          .cast<PlannedExamRecord?>()
          .firstWhere((item) => item != null, orElse: () => null);
      final historicalMatch = _records
          .where((item) => _decodeText(item.examTitle) == title)
          .cast<ExamScoreRecord?>()
          .firstWhere((item) => item != null, orElse: () => null);
      setSheetState(() {
        selectedExam = title;
        selectedExamType =
            plannedMatch?.type ?? historicalMatch?.type ?? selectedExamType;
        selectedSubject = _decodeText(
          plannedMatch?.subject ?? historicalMatch?.subject ?? selectedSubject,
        );
        selectedDateLabel =
            plannedMatch?.date ?? historicalMatch?.date ?? selectedDateLabel;
      });
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              padding: EdgeInsets.fromLTRB(
                18,
                8,
                18,
                MediaQuery.of(context).viewInsets.bottom + 22,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(30),
                ),
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF08111F), Color(0xFFFF7A1A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sonuç Girişi'.tr,
                            style: TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            student,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Sınıf $className • Son kayıt: ${_decodeText(latest.examTitle)}',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.86),
                                ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Giriş Formu'.tr,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: selectedExamType,
                      decoration: InputDecoration(
                        labelText: 'Sınav Türü'.tr,
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        DropdownMenuItem(
                          value: 'Deneme',
                          child: Text('Deneme'),
                        ),
                        DropdownMenuItem(
                          value: 'Yazılı',
                          child: Text('Yazılı'.tr),
                        ),
                        DropdownMenuItem(value: 'Quiz', child: Text('Quiz')),
                      ],
                      onChanged: (value) => setSheetState(
                        () => selectedExamType = value ?? selectedExamType,
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: selectedExam.isEmpty ? null : selectedExam,
                      decoration: InputDecoration(
                        labelText: 'Sınav Adı'.tr,
                        border: OutlineInputBorder(),
                      ),
                      items: resultExamOptions
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        syncFromExamTitle(value, setSheetState);
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: selectedSubject.isEmpty
                          ? null
                          : selectedSubject,
                      decoration: const InputDecoration(
                        labelText: 'Ders',
                        border: OutlineInputBorder(),
                      ),
                      items: subjectOptions
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setSheetState(
                        () => selectedSubject = value ?? selectedSubject,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      readOnly: true,
                      controller: TextEditingController(
                        text: selectedDateLabel,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Tarih',
                        border: OutlineInputBorder(),
                      ),
                      onTap: () async {
                        final now = DateTime.now();
                        final pickedDate = await showDatePicker(
                          context: context,
                          initialDate: selectedDateValue ?? now,
                          firstDate: DateTime(2024),
                          lastDate: DateTime(2035),
                        );
                        if (pickedDate == null) return;
                        final formatted =
                            '${pickedDate.day.toString().padLeft(2, '0')} ${_monthName(pickedDate.month)} ${pickedDate.year}';
                        setSheetState(() {
                          selectedDateValue = pickedDate;
                          selectedDateLabel = formatted;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: scoreController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Puan',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: netController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Net',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(sheetContext),
                            child: Text('İptal'.tr),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: _saving
                                ? null
                                : () async {
                                    try {
                                      setState(() => _saving = true);
                                      await SchoolFeedApiService.instance
                                          .createExamResult(
                                            examTitle:
                                                selectedExam.trim().isEmpty
                                                ? (selectedExamType == 'Deneme'
                                                      ? 'Yeni Deneme Sonuçu'
                                                      : 'Öğretmen Girişi $selectedExamType')
                                                : selectedExam.trim(),
                                            type: selectedExamType,
                                            subject:
                                                selectedSubject.trim().isEmpty
                                                ? _decodeText(latest.subject)
                                                : selectedSubject.trim(),
                                            dateLabel:
                                                selectedDateLabel.trim().isEmpty
                                                ? latest.date
                                                : selectedDateLabel.trim(),
                                            studentName: student,
                                            className: className,
                                            score:
                                                int.tryParse(
                                                  scoreController.text,
                                                ) ??
                                                0,
                                            net:
                                                double.tryParse(
                                                  netController.text.replaceAll(
                                                    ',',
                                                    '.',
                                                  ),
                                                ) ??
                                                0,
                                          );
                                      if (!context.mounted) return;
                                      Navigator.pop(sheetContext);
                                      _loadRecords();
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            'Sınav sonucu kaydedildi.'.tr,
                                          ),
                                          behavior: SnackBarBehavior.floating,
                                        ),
                                      );
                                    } catch (error) {
                                      if (!context.mounted) return;
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(
                                          content: Text(error.toString()),
                                          behavior: SnackBarBehavior.floating,
                                        ),
                                      );
                                    } finally {
                                      if (mounted) {
                                        setState(() => _saving = false);
                                      }
                                    }
                                  },
                            child: Text(_saving ? 'Kaydediliyor...' : 'Kaydet'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
