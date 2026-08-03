import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import 'admin_parent_contact_page.dart';
import 'admin_student_detail_page.dart';
import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/directory_list.dart';

/// Öğrenciler — masaüstündeki `/students` ekranının mobil karşılığı.
///
/// Pasifleştirme listeden yapılabilir; kurum yöneticisi ve şube müdürü ayrıca
/// seçtiği öğrencileri dönem sonunda üst sınıfa taşıyabilir.
class AdminStudentsPage extends StatefulWidget {
  const AdminStudentsPage({super.key});

  @override
  State<AdminStudentsPage> createState() => _AdminStudentsPageState();
}

class _AdminStudentsPageState extends State<AdminStudentsPage> {
  List<AdminStudentRecord> _students = const [];
  List<String> _classes = const [];
  bool _loading = true;
  String? _error;
  String _search = '';
  String _classFilter = directoryAll;
  bool _canPromote = false;
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final role = (session?.primaryRole ?? '').toLowerCase();
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      List<String> classes;
      try {
        classes = await AdminDirectoryApiService.instance.fetchClasses();
      } catch (_) {
        classes = const [];
      }
      if (!mounted) return;
      setState(() {
        _students = students;
        _classes = classes;
        // Sınıf yükseltme yalnız kurum yöneticisi ve şube müdüründe.
        _canPromote = role == 'admin' || role == 'branchmanager';
        _loading = false;
        _error = null;
      });
    } on AdminDirectoryApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  bool _isPassive(AdminStudentRecord student) {
    final status = student.status.toLowerCase();
    return status == 'passive' || status == 'pasif';
  }

  List<AdminStudentRecord> get _filtered {
    final query = _search.trim().toLowerCase();
    return _students.where((student) {
      final haystack =
          '${student.fullName} ${student.parentName} ${student.username} ${student.schoolNumber}'
              .toLowerCase();
      if (query.isNotEmpty && !haystack.contains(query)) return false;
      if (_classFilter != directoryAll && student.className != _classFilter) {
        return false;
      }
      return true;
    }).toList();
  }

  StudentRegistryRecord _mapped(AdminStudentRecord student) =>
      StudentRegistryRecord(
        id: student.id,
        fullName: student.fullName,
        tcNo: student.tcNo,
        className: student.className,
        currentSchool: student.currentSchool,
        schoolNumber: student.schoolNumber,
        birthDate: student.birthDate,
        programType: student.programType,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail,
        address: student.address,
        note: student.note,
        username: student.username,
        password: 'Güvenli sekilde saklaniyor',
        status: _isPassive(student) ? 'Pasif' : 'Aktif',
      );

  Future<void> _toggleStatus(AdminStudentRecord student) async {
    final passive = _isPassive(student);
    try {
      await AdminDirectoryApiService.instance.updateUserStatus(
        username: student.username,
        isActive: passive,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            passive
                ? 'Öğrenci aktifleştirildi.'.tr
                : 'Öğrenci pasife alındı (giriş yapamaz).'.tr,
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _promote() async {
    if (_selected.isEmpty) return;
    var target = _classes.isNotEmpty ? _classes.first : '';
    final chosen = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (builderContext, setDialogState) => AlertDialog(
          title: Text('Sınıf yükseltme'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_selected.length} öğrenci seçili. Zaten hedef sınıfta olanlar atlanır.',
              ),
              const SizedBox(height: 12),
              if (_classes.isEmpty)
                Text('Kayıtlı sınıf yok.'.tr)
              else
                DropdownButtonFormField<String>(
                  initialValue: target,
                  decoration: InputDecoration(
                    labelText: 'Hedef sınıf'.tr,
                    border: const OutlineInputBorder(),
                  ),
                  items: _classes
                      .map(
                        (item) =>
                            DropdownMenuItem(value: item, child: Text(item)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => target = value ?? target),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: _classes.isEmpty
                  ? null
                  : () => Navigator.pop(dialogContext, target),
              child: Text('Sınıfa taşı'.tr),
            ),
          ],
        ),
      ),
    );
    if (chosen == null || chosen.isEmpty) return;

    try {
      final result = await AdminDirectoryApiService.instance.promoteStudents(
        studentUserIds: _selected.toList(),
        targetClassName: chosen,
      );
      if (!mounted) return;
      final promoted = (result['promoted'] as num?)?.toInt() ?? 0;
      final skipped = (result['alreadyInClass'] as List?)?.length ?? 0;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '$promoted öğrenci $chosen sınıfına taşındı.'
            '${skipped > 0 ? ' $skipped öğrenci zaten bu sınıftaydı.' : ''}',
          ),
        ),
      );
      setState(_selected.clear);
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    final active = _students.where((student) => !_isPassive(student)).length;
    final passive = _students.length - active;
    final classCount = _students
        .map((student) => student.className)
        .where((value) => value.trim().isNotEmpty)
        .toSet()
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Öğrenciler'.tr,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: _canPromote && _selected.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _promote,
              icon: const Icon(Icons.arrow_upward_rounded),
              label: Text('${_selected.length} öğrenciyi yükselt'),
            )
          : null,
      child: DirectoryList<AdminStudentRecord>(
        title: 'Öğrenciler',
        subtitle: '$active ${'öğrenciniz bulunuyor'.tr}',
        loading: _loading,
        error: _error,
        onRefresh: _load,
        stats: [
          DirectoryStat(
            label: 'Toplam Öğrenci',
            value: '${_students.length}',
            caption: 'Tüm zamanlar',
            icon: Icons.groups_outlined,
            color: const Color(0xFF2563EB),
          ),
          DirectoryStat(
            label: 'Aktif Öğrenci',
            value: '$active',
            caption:
                '%${_students.isEmpty ? 0 : (active / _students.length * 100).round()}',
            icon: Icons.verified_user_outlined,
            color: const Color(0xFF059669),
          ),
          DirectoryStat(
            label: 'Sınıf Sayısı',
            value: '$classCount',
            caption: 'Öğrencisi olan sınıf',
            icon: Icons.meeting_room_outlined,
            color: const Color(0xFF7C3AED),
          ),
          DirectoryStat(
            label: 'Pasif Öğrenci',
            value: '$passive',
            caption: 'Girişi kapalı',
            icon: Icons.person_off_outlined,
            color: const Color(0xFFB42318),
          ),
        ],
        searchHint: 'Öğrenci ara...',
        onSearchChanged: (value) => setState(() => _search = value),
        filters: [
          DirectoryFilter(
            label: 'Tüm Sınıflar',
            value: _classFilter,
            options: _students
                .map((student) => student.className)
                .where((value) => value.trim().isNotEmpty)
                .toSet()
                .toList(),
            onChanged: (value) => setState(() => _classFilter = value),
          ),
        ],
        rows: rows,
        totalLabel: (total) => '${'Toplam'.tr} $total ${'öğrenci'.tr}',
        emptyTitle: 'Öğrenci bulunamadı',
        emptyDescription:
            'Aramanıza uyan öğrenci yok. Farklı bir sınıf veya durum deneyin.',
        blankTitle: 'Henüz öğrenci kaydınız yok',
        blankDescription:
            'İlk öğrenciyi kaydettiğinizde yoklama, sınav ve tahsilat ekranları da çalışmaya başlar.',
        rowBuilder: (context, student) {
          final passiveRow = _isPassive(student);
          final selected = _selected.contains(student.userId);
          return DirectoryRowCard(
            title: student.fullName,
            subtitle: student.schoolNumber.isEmpty
                ? student.username
                : '${'Öğrenci No'.tr}: ${student.schoolNumber}',
            trailingBadge: passiveRow ? 'Pasif'.tr : 'Aktif'.tr,
            badgeColor: passiveRow
                ? const Color(0xFFB42318)
                : const Color(0xFF059669),
            metrics: [
              (
                icon: Icons.meeting_room_outlined,
                label: 'Sınıf',
                value: student.className,
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
              if (_canPromote && student.userId.isNotEmpty)
                IconButton(
                  tooltip: selected
                      ? 'Seçimi kaldır'.tr
                      : 'Sınıf yükseltme için seç'.tr,
                  onPressed: () => setState(() {
                    if (selected) {
                      _selected.remove(student.userId);
                    } else {
                      _selected.add(student.userId);
                    }
                  }),
                  icon: Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    color: selected
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
                ),
              IconButton(
                tooltip: 'Detay'.tr,
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          AdminStudentDetailPage(student: _mapped(student)),
                    ),
                  );
                  if (!mounted) return;
                  await _load();
                },
                icon: const Icon(Icons.badge_outlined),
              ),
              IconButton(
                tooltip: 'Veli İletişimi'.tr,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        AdminParentContactPage(student: _mapped(student)),
                  ),
                ),
                icon: const Icon(Icons.chat_bubble_outline_rounded),
              ),
              // Pasifleştirme listede kalmalı: hesap silinmez, girişi kapanır.
              IconButton(
                tooltip: passiveRow ? 'Aktifleştir'.tr : 'Pasifleştir'.tr,
                onPressed: () => _toggleStatus(student),
                icon: Icon(
                  passiveRow
                      ? Icons.person_add_alt_1_outlined
                      : Icons.person_off_outlined,
                  color: passiveRow
                      ? const Color(0xFF059669)
                      : const Color(0xFFB42318),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
