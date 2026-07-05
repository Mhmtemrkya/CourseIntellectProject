import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';
import 'student_exam_history_page.dart';

/// Öğrenci sınavlarının SALT GÖRÜNTÜLEME ekranı.
/// Erişim kapsamı:
///  - Kurum yöneticisi / idari birim: tüm sınıflar
///  - Rehberlik öğretmeni: tüm sınıflar
///  - Sınıf danışmanı (atanan sınıf öğretmeni): yalnızca kendi sınıfı
/// Bu ekrandan not girişi, düzenleme veya silme yapılamaz.
class TeacherStudentExamsPage extends StatefulWidget {
  const TeacherStudentExamsPage({super.key});

  @override
  State<TeacherStudentExamsPage> createState() =>
      _TeacherStudentExamsPageState();
}

class _TeacherStudentExamsPageState extends State<TeacherStudentExamsPage> {
  bool _loading = true;
  String? _error;
  String? _accessMessage;
  bool _fullAccess = false;
  String _homeroomClass = '';
  String _selectedClass = 'Tümü';
  List<ExamScoreRecord> _records = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _normalize(String value) => value
      .trim()
      .toLowerCase()
      .replaceAll('ç', 'c')
      .replaceAll('ğ', 'g')
      .replaceAll('ı', 'i')
      .replaceAll('ö', 'o')
      .replaceAll('ş', 's')
      .replaceAll('ü', 'u');

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _accessMessage = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) {
        throw Exception('Oturum bulunamadı.');
      }

      final roles = {session.primaryRole, ...session.extraRoles};
      var fullAccess =
          roles.contains('Admin') || roles.contains('Administrative');
      var homeroom = '';

      if (!fullAccess) {
        // Öğretmen: kendi personel kaydından danışman sınıfı / branşı çöz.
        final staff = await AdminDirectoryApiService.instance.fetchStaff(
          role: 'Teacher',
        );
        final me = staff
            .where(
              (item) =>
                  _normalize(item.username) == _normalize(session.username) ||
                  _normalize(item.fullName) == _normalize(session.fullName),
            )
            .cast<AdminStaffRecord?>()
            .firstOrNull;
        final branch = _normalize(me?.departmentOrBranch ?? '');
        if (branch.contains('rehber')) {
          fullAccess = true;
        }
        homeroom = (me?.homeroomClass ?? '').trim();
        if (_normalize(homeroom).contains('yok')) {
          homeroom = '';
        }
      }

      if (!fullAccess && homeroom.isEmpty) {
        if (!mounted) return;
        setState(() {
          _accessMessage =
              'Bu ekran sınıf danışmanları, rehberlik öğretmenleri ve kurum '
              'yöneticileri içindir. Sana atanmış bir danışman sınıfı '
              'bulunmuyor.';
          _loading = false;
        });
        return;
      }

      final results = await SchoolFeedApiService.instance.fetchExamResults(
        className: fullAccess ? null : homeroom,
      );
      if (!mounted) return;
      setState(() {
        _fullAccess = fullAccess;
        _homeroomClass = homeroom;
        _records = results;
        _selectedClass = fullAccess ? 'Tümü' : homeroom;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<ExamScoreRecord> get _visibleRecords {
    if (_selectedClass == 'Tümü') return _records;
    return _records
        .where((item) => item.className == _selectedClass)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final classes = [
      'Tümü',
      ..._records.map((item) => item.className).toSet().toList()..sort(),
    ];
    final studentsByName = <String, List<ExamScoreRecord>>{};
    for (final record in _visibleRecords) {
      studentsByName.putIfAbsent(record.studentName, () => []).add(record);
    }
    final studentNames = studentsByName.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: Text('Öğrenci Sınavları'.tr),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _messageView(theme, _error!, retry: true)
          : _accessMessage != null
          ? _messageView(theme, _accessMessage!)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  ResponsiveContent(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(24),
                            gradient: const LinearGradient(
                              colors: [Color(0xFF08111F), Color(0xFFFF7A1A)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.visibility_rounded,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'SALT GÖRÜNTÜLEME'.tr,
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.9,
                                      ),
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      letterSpacing: 1.1,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _fullAccess
                                    ? 'Tüm öğrencilerin sınav sonuçları'
                                    : '$_homeroomClass sınıfının sınav sonuçları',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Bu ekrandan not değişikliği yapılamaz; sonuçlar yalnızca incelenir.'.tr,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.85),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (_fullAccess)
                          DropdownButtonFormField<String>(
                            initialValue:
                                classes.contains(_selectedClass)
                                ? _selectedClass
                                : 'Tümü',
                            decoration: InputDecoration(
                              labelText: 'Sınıf Filtresi'.tr,
                            ),
                            items: classes
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item,
                                    child: Text(item),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) => setState(
                              () => _selectedClass = value ?? 'Tümü',
                            ),
                          ),
                        if (_fullAccess) const SizedBox(height: 12),
                        Text(
                          '${studentNames.length} öğrenci • ${_visibleRecords.length} sonuç',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (studentNames.isEmpty)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: theme.cardColor,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: theme.dividerColor),
                            ),
                            child: Text(
                              'Bu kapsamda kayıtlı sınav sonucu bulunmuyor.'.tr,
                              textAlign: TextAlign.center,
                            ),
                          )
                        else
                          ...studentNames.map(
                            (name) => _studentCard(
                              theme,
                              name,
                              studentsByName[name]!,
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

  Widget _messageView(ThemeData theme, String message, {bool retry = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline_rounded, size: 44),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            if (retry) ...[
              const SizedBox(height: 14),
              FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
            ],
          ],
        ),
      ),
    );
  }

  Widget _studentCard(
    ThemeData theme,
    String studentName,
    List<ExamScoreRecord> records,
  ) {
    final average = records.isEmpty
        ? 0
        : records.fold<int>(0, (sum, item) => sum + item.score) ~/
              records.length;
    final latest = records.first;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.dividerColor),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 6,
        ),
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.14),
          foregroundColor: theme.colorScheme.primary,
          child: Text(studentName.isEmpty ? '?' : studentName[0]),
        ),
        title: Text(
          studentName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${latest.className} • ${records.length} sınav • Ortalama %$average',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => StudentExamHistoryPage(
                studentName: studentName,
                title: '$studentName • Sınav Geçmişi',
              ),
            ),
          );
        },
      ),
    );
  }
}
