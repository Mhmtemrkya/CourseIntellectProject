import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/schedule_api_service.dart';
import '../widgets/directory_list.dart';
import 'student_exam_history_page.dart';

/// Öğretmenin KENDİ öğrencileri — masaüstündeki `/t/students` karşılığı.
///
/// Sorumlu olunan sınıflar ders programından çözülür (öğretmenin adına yazılı
/// dersler); böylece ayrı bir atama tablosuna gerek kalmaz. Öğretmen yalnız
/// okur: pasifleştirme/düzenleme yoktur.
class TeacherStudentsPage extends StatefulWidget {
  const TeacherStudentsPage({super.key});

  @override
  State<TeacherStudentsPage> createState() => _TeacherStudentsPageState();
}

class _TeacherStudentsPageState extends State<TeacherStudentsPage> {
  List<AdminStudentRecord> _students = const [];
  List<String> _myClasses = const [];
  Map<String, Set<String>> _lessonsByClass = const {};
  bool _loading = true;
  String? _error;
  String _search = '';
  String _classFilter = directoryAll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _normalize(String? value) => (value ?? '').trim().toLowerCase();

  Future<void> _load() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      final schedule = await ScheduleApiService.instance.fetchEntries();

      final me = _normalize(session?.fullName);
      final mine = schedule
          .where((row) => _normalize(row.teacher) == me)
          .toList();
      final classes =
          mine
              .map((row) => row.className.trim())
              .where((value) => value.isNotEmpty)
              .toSet()
              .toList()
            ..sort();
      final lessons = <String, Set<String>>{};
      for (final row in mine) {
        final className = row.className.trim();
        final subject = row.subject.trim();
        if (className.isEmpty || subject.isEmpty) continue;
        lessons.putIfAbsent(className, () => <String>{}).add(subject);
      }

      if (!mounted) return;
      setState(() {
        _students = students;
        _myClasses = classes;
        _lessonsByClass = lessons;
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

  List<AdminStudentRecord> get _filtered {
    final classKeys = _myClasses.map(_normalize).toSet();
    final query = _search.trim().toLowerCase();
    return _students.where((student) {
      final status = student.status.toLowerCase();
      if (status == 'passive' || status == 'pasif') return false;
      if (classKeys.isNotEmpty &&
          !classKeys.contains(_normalize(student.className))) {
        return false;
      }
      if (_classFilter != directoryAll && student.className != _classFilter) {
        return false;
      }
      if (query.isEmpty) return true;
      return '${student.fullName} ${student.parentName}'.toLowerCase().contains(
        query,
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    final mineCount = _students.where((student) {
      final classKeys = _myClasses.map(_normalize).toSet();
      return classKeys.isEmpty ||
          classKeys.contains(_normalize(student.className));
    }).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Öğrencilerim'.tr,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: DirectoryList<AdminStudentRecord>(
        title: 'Öğrencilerim',
        subtitle: _myClasses.isEmpty
            ? '$mineCount ${'öğrenci'.tr}'
            : '${_myClasses.join(', ')} · $mineCount ${'öğrenci'.tr}',
        loading: _loading,
        error: _error,
        onRefresh: _load,
        stats: [
          DirectoryStat(
            label: 'Öğrencim',
            value: '$mineCount',
            caption: '${_myClasses.length} ${'sınıf'.tr}',
            icon: Icons.groups_outlined,
            color: const Color(0xFF2563EB),
          ),
          DirectoryStat(
            label: 'Sınıf Sayısı',
            value: '${_myClasses.length}',
            caption: 'Derse girdiğim şube',
            icon: Icons.meeting_room_outlined,
            color: const Color(0xFF7C3AED),
          ),
        ],
        searchHint: 'Öğrenci ara...',
        onSearchChanged: (value) => setState(() => _search = value),
        filters: [
          DirectoryFilter(
            label: 'Tüm Sınıflar',
            value: _classFilter,
            options: _myClasses,
            onChanged: (value) => setState(() => _classFilter = value),
          ),
        ],
        rows: rows,
        totalLabel: (total) => '${'Toplam'.tr} $total ${'öğrenci'.tr}',
        emptyTitle: 'Öğrenci bulunamadı',
        emptyDescription:
            'Aramanıza uyan öğrenci yok. Farklı bir sınıf deneyin.',
        blankTitle: _myClasses.isEmpty
            ? 'Size atanmış sınıf yok'
            : 'Sınıflarınızda öğrenci yok',
        blankDescription: _myClasses.isEmpty
            ? 'Ders programında adınıza yazılmış bir sınıf yok. Yönetimden ders programınızı kontrol edin.'
            : 'Sınıflarınıza öğrenci kaydedildiğinde bu liste otomatik dolar.',
        rowBuilder: (context, student) => DirectoryRowCard(
          title: student.fullName,
          subtitle: student.schoolNumber.isEmpty
              ? student.className
              : '${student.className} · ${'Öğrenci No'.tr}: ${student.schoolNumber}',
          metrics: [
            (
              icon: Icons.menu_book_outlined,
              label: 'Ders',
              value: (_lessonsByClass[student.className] ?? const <String>{})
                  .join(', '),
            ),
            (
              icon: Icons.person_outline_rounded,
              label: 'Veli',
              value: student.parentName,
            ),
            (
              icon: Icons.phone_outlined,
              label: 'Telefon',
              value: student.parentPhone,
            ),
          ],
          actions: [
            IconButton(
              tooltip: 'Sınav geçmişi'.tr,
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => StudentExamHistoryPage(
                    studentName: student.fullName,
                    title: '${student.fullName} · ${'Sınav Geçmişi'.tr}',
                  ),
                ),
              ),
              icon: const Icon(Icons.assignment_outlined),
            ),
          ],
        ),
      ),
    );
  }
}
