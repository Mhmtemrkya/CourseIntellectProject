import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_directory_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/directory_list.dart';
import 'admin_parent_contact_page.dart';

/// Veliler — masaüstündeki `/parents` ekranının mobil karşılığı.
///
/// Veli listesi öğrenci kayıtlarından türetilir (bir velinin birden fazla
/// çocuğu tek satırda toplanır); iletişim ve çocuk bilgisi aynı satırda görünür.
class _ParentRow {
  final String name;
  final String phone;
  final String email;
  final List<AdminStudentRecord> children;

  const _ParentRow({
    required this.name,
    required this.phone,
    required this.email,
    required this.children,
  });

  List<String> get classNames => children
      .map((child) => child.className)
      .where((value) => value.trim().isNotEmpty)
      .toSet()
      .toList();
}

class AdminParentsPage extends StatefulWidget {
  const AdminParentsPage({super.key});

  @override
  State<AdminParentsPage> createState() => _AdminParentsPageState();
}

class _AdminParentsPageState extends State<AdminParentsPage> {
  List<AdminStudentRecord> _students = const [];
  bool _loading = true;
  String? _error;
  String _search = '';
  String _classFilter = directoryAll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      if (!mounted) return;
      setState(() {
        _students = students;
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

  List<_ParentRow> get _parents {
    final grouped = <String, List<AdminStudentRecord>>{};
    for (final student in _students) {
      final name = student.parentName.trim();
      if (name.isEmpty) continue;
      grouped.putIfAbsent(name.toLowerCase(), () => []).add(student);
    }
    final rows = grouped.values.map((children) {
      final first = children.first;
      return _ParentRow(
        name: first.parentName,
        phone: first.parentPhone,
        email: first.parentEmail,
        children: children,
      );
    }).toList()..sort((a, b) => a.name.compareTo(b.name));
    return rows;
  }

  List<_ParentRow> get _filtered {
    final query = _search.trim().toLowerCase();
    return _parents.where((parent) {
      if (query.isNotEmpty &&
          !'${parent.name} ${parent.phone} ${parent.email}'
              .toLowerCase()
              .contains(query)) {
        return false;
      }
      if (_classFilter != directoryAll &&
          !parent.classNames.contains(_classFilter)) {
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
        status: student.status == 'Active' ? 'Aktif' : 'Pasif',
      );

  @override
  Widget build(BuildContext context) {
    final parents = _parents;
    final rows = _filtered;
    final childCount = parents.fold<int>(
      0,
      (sum, parent) => sum + parent.children.length,
    );
    final withPhone = parents.where((parent) => parent.phone.isNotEmpty).length;

    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Veliler'.tr,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: DirectoryList<_ParentRow>(
        title: 'Veliler',
        subtitle: '${parents.length} ${'veliniz bulunuyor'.tr}',
        loading: _loading,
        error: _error,
        onRefresh: _load,
        stats: [
          DirectoryStat(
            label: 'Toplam Veli',
            value: '${parents.length}',
            caption: 'Tüm zamanlar',
            icon: Icons.groups_outlined,
            color: const Color(0xFF2563EB),
          ),
          DirectoryStat(
            label: 'Bağlı Öğrenci',
            value: '$childCount',
            caption: 'Veli-öğrenci eşleşmesi',
            icon: Icons.school_outlined,
            color: const Color(0xFF7C3AED),
          ),
          DirectoryStat(
            label: 'Telefonu Olan',
            value: '$withPhone',
            caption: 'Ulaşılabilir veli',
            icon: Icons.phone_outlined,
            color: const Color(0xFF059669),
          ),
          DirectoryStat(
            label: 'Telefonsuz',
            value: '${parents.length - withPhone}',
            caption: 'İletişim eksik',
            icon: Icons.phone_disabled_outlined,
            color: const Color(0xFFB45309),
          ),
        ],
        searchHint: 'Veli ara...',
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
        totalLabel: (total) => '${'Toplam'.tr} $total ${'veli'.tr}',
        emptyTitle: 'Veli bulunamadı',
        emptyDescription:
            'Aramanıza uyan veli yok. Farklı bir sınıf veya durum deneyin.',
        blankTitle: 'Henüz veli kaydınız yok',
        blankDescription:
            'Veliler ayrı ayrı eklenmez: öğrenci kaydı sırasında girilen veli bilgisinden otomatik oluşur.',
        rowBuilder: (context, parent) => DirectoryRowCard(
          title: parent.name,
          subtitle: parent.children.map((child) => child.fullName).join(', '),
          trailingBadge: '${parent.children.length} ${'öğrenci'.tr}',
          metrics: [
            (icon: Icons.phone_outlined, label: 'Telefon', value: parent.phone),
            (
              icon: Icons.mail_outline_rounded,
              label: 'E-posta',
              value: parent.email,
            ),
            (
              icon: Icons.meeting_room_outlined,
              label: 'Sınıf',
              value: parent.classNames.join(', '),
            ),
          ],
          actions: [
            IconButton(
              tooltip: 'Veli İletişimi'.tr,
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AdminParentContactPage(
                    student: _mapped(parent.children.first),
                  ),
                ),
              ),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
            ),
          ],
        ),
      ),
    );
  }
}
