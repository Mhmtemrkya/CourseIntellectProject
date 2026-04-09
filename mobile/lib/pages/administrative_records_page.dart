import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'administrative_documents_page.dart';
import 'admin_parent_registration_page.dart';
import 'admin_role_management_page.dart';
import 'admin_staff_registration_page.dart';
import 'admin_student_registration_page.dart';
import 'admin_students_page.dart';

class AdministrativeRecordsPage extends StatefulWidget {
  const AdministrativeRecordsPage({super.key});

  @override
  State<AdministrativeRecordsPage> createState() => _AdministrativeRecordsPageState();
}

class _AdministrativeRecordsPageState extends State<AdministrativeRecordsPage> {
  final _students = StudentRegistryStore.instance;
  final _staff = StaffRegistryStore.instance;

  List<_ParentContactRecord> get _parents {
    final grouped = <String, _ParentContactRecord>{};
    for (final student in _students.students) {
      if (student.parentName.trim().isEmpty) continue;
      final key = '${student.parentName.trim().toLowerCase()}|${student.parentEmail.trim().toLowerCase()}';
      final current = grouped[key];
      if (current == null) {
        grouped[key] = _ParentContactRecord(
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          parentEmail: student.parentEmail,
          childNames: [student.fullName],
        );
      } else {
        current.childNames.add(student.fullName);
      }
    }
    return grouped.values.toList()..sort((a, b) => a.parentName.compareTo(b.parentName));
  }

  @override
  void initState() {
    super.initState();
    _students.addListener(_refresh);
    _staff.addListener(_refresh);
  }

  @override
  void dispose() {
    _students.removeListener(_refresh);
    _staff.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Kayıtlar', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Kayıt merkezi',
            title: 'Öğrenci ve personel kayıt süreçlerini tek yerden yönetin.',
            description: 'Yeni kayıt açabilir, mevcut kayıtları izleyebilir ve öğrenci listesine geçiş yapabilirsiniz.',
            colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AdminHeroMetric(label: 'Öğrenci', value: '${_students.students.length}'),
              AdminHeroMetric(label: 'Veli', value: '${_parents.length}'),
              AdminHeroMetric(label: 'Personel', value: '${_staff.personnel.length}'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Öğrenci Kaydı',
                  subtitle: 'TC, okul, veli ve giriş bilgileri',
                  icon: Icons.person_add_alt_1_outlined,
                  color: const Color(0xFF2563EB),
                  onTap: () => _openPage(const AdminStudentRegistrationPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Veli Kaydı',
                  subtitle: 'Veli odaklı kayıt ekranı',
                  icon: Icons.family_restroom_outlined,
                  color: const Color(0xFF7C3AED),
                  onTap: () => _openPage(const AdminParentRegistrationPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Personel Kaydı',
                  subtitle: 'Öğretmen ve idari personel ekleme',
                  icon: Icons.badge_outlined,
                  color: const Color(0xFF7C3AED),
                  onTap: () => _openPage(const AdminStaffRegistrationPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Rol Yönetimi',
                  subtitle: 'Yetki ve erişimleri düzenle',
                  icon: Icons.admin_panel_settings_outlined,
                  color: const Color(0xFF0F766E),
                  onTap: () => _openPage(const AdminRoleManagementPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Evrak Takibi',
                  subtitle: 'Eksik belge ve sözleşmeleri izle',
                  icon: Icons.folder_open_outlined,
                  color: const Color(0xFFB45309),
                  onTap: () => _openPage(const AdministrativeDocumentsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Veli Listesi'),
                const SizedBox(height: 12),
                ..._parents.take(6).map(
                  (parent) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF7C3AED).withValues(alpha: 0.12),
                      child: Text(parent.parentName.characters.first),
                    ),
                    title: Text(parent.parentName),
                    subtitle: Text(
                      '${parent.childNames.join(", ")}${parent.parentPhone.isNotEmpty ? " • ${parent.parentPhone}" : ""}',
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Personel Listesi'),
                const SizedBox(height: 12),
                ..._staff.staff.take(6).map(
                  (staff) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF0F766E).withValues(alpha: 0.12),
                      child: Text(staff.fullName.characters.first),
                    ),
                    title: Text(staff.fullName),
                    subtitle: Text('${staff.roleType} • ${staff.branchOrDepartment}'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminSectionTitle(
                  title: 'Öğrenci Listesi',
                  actionLabel: 'Detaylı Aç',
                  onAction: () => _openPage(const AdminStudentsPage()),
                ),
                const SizedBox(height: 12),
                ..._students.students.take(6).map(
                  (student) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.12),
                      child: Text(student.fullName.characters.first),
                    ),
                    title: Text(student.fullName),
                    subtitle: Text('${student.className} • ${student.parentName}'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _openPage(const AdminStudentsPage()),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'İdari Kontroller'),
                const SizedBox(height: 12),
                _infoTile(context, 'Otomatik giriş bilgisi', 'Her yeni kayıt sonrası kullanıcı adı ve şifre otomatik üretilir.'),
                _infoTile(context, 'Veli iletişim hazırlığı', 'Kaydı tamamlanan öğrenci için veli iletişim kartı hazır olur.'),
                _infoTile(context, 'Evrak takip mantığı', 'Eksik bilgi varsa öğrenci detayında idari not alanından görülebilir.'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
      child: AdminPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Widget _infoTile(BuildContext context, String title, String detail) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(detail, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4)),
        ],
      ),
    );
  }

  void _openPage(Widget page) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => page),
    );
  }
}

class _ParentContactRecord {
  final String parentName;
  final String parentPhone;
  final String parentEmail;
  final List<String> childNames;

  _ParentContactRecord({
    required this.parentName,
    required this.parentPhone,
    required this.parentEmail,
    required this.childNames,
  });
}
