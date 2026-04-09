import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'admin_announcements_page.dart';
import 'admin_staff_registration_page.dart';
import 'admin_student_registration_page.dart';
import 'admin_students_page.dart';

class AdminAdministrativeUnitsPage extends StatefulWidget {
  const AdminAdministrativeUnitsPage({super.key});

  @override
  State<AdminAdministrativeUnitsPage> createState() => _AdminAdministrativeUnitsPageState();
}

class _AdminAdministrativeUnitsPageState extends State<AdminAdministrativeUnitsPage> {
  final _store = StudentRegistryStore.instance;
  final _staffStore = StaffRegistryStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _staffStore.addListener(_refresh);
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _staffStore.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final latestStudents = _store.students.take(3).toList();
    final latestStaff = _staffStore.staff.take(2).toList();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Idari Birimler', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Idari operasyon',
            title: 'Kayit, duyuru ve ogrenci evrak akislarini tek merkezden yonetin.',
            description: 'Yonetici birimi yeni ogrenci kaydi acabilir, kurumsal duyuru yayina alabilir ve son kayitlari aninda izleyebilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AdminHeroMetric(label: 'Kayitli Ogrenci', value: '${_store.students.length}'),
              AdminHeroMetric(label: 'Kadro', value: '${_staffStore.staff.length} aktif profil'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Yeni Ogrenci Kaydi',
                  subtitle: 'Tum alanlariyla kapsamli kayit ac',
                  icon: Icons.person_add_alt_1_outlined,
                  color: const Color(0xFF2563EB),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminStudentRegistrationPage()),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Ogretmen / Personel',
                  subtitle: 'Kadro kaydi ve profil olusturma',
                  icon: Icons.groups_2_outlined,
                  color: const Color(0xFF7C3AED),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminStaffRegistrationPage()),
                  ),
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
                  title: 'Duyuru Olustur',
                  subtitle: 'Ogrenci, veli ve ogretmene yayinla',
                  icon: Icons.campaign_outlined,
                  color: const Color(0xFFB45309),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminAnnouncementsPage()),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminSectionTitle(
                  title: 'Son Kayitlar',
                  actionLabel: 'Tumunu Gor',
                  onAction: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminStudentsPage()),
                  ),
                ),
                const SizedBox(height: 12),
                ...latestStudents.map((student) => _studentPreview(context, student)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Son Kadro Kayitlari'),
                const SizedBox(height: 12),
                ...latestStaff.map((person) => _staffPreview(context, person)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                AdminSectionTitle(title: 'Idari Kontrol Noktalari'),
                SizedBox(height: 12),
                _AdministrativeHint(
                  title: 'Evrak Tamamlama',
                  detail: 'TC, okul bilgisi, veli iletisim ve program alani kayit aninda tamamlanir.',
                ),
                _AdministrativeHint(
                  title: 'Giris Bilgisi Uretimi',
                  detail: 'Kayit sonrasi ogrenciye otomatik kullanici adi ve sifre olusturulur.',
                ),
                _AdministrativeHint(
                  title: 'Kurumsal Duyuru Aksiyonu',
                  detail: 'Yeni kayit sonrasi ogrenci ve veliye yonelik hos geldiniz duyurusu planlanabilir.',
                ),
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
            const SizedBox(height: 14),
            Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4)),
          ],
        ),
      ),
    );
  }

  Widget _studentPreview(BuildContext context, StudentRegistryRecord student) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.12),
              child: Text(student.fullName.characters.first, style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(student.fullName, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('${student.className} • ${student.currentSchool}', style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            AdminAccentBadge(label: student.status, color: const Color(0xFF14532D)),
          ],
        ),
      ),
    );
  }

  Widget _staffPreview(BuildContext context, StaffRegistryRecord person) {
    final color = person.roleType == 'Öğretmen' ? const Color(0xFF2563EB) : const Color(0xFF7C3AED);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.12),
              child: Text(person.fullName.characters.first, style: TextStyle(color: color, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(person.fullName, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('${person.roleType} • ${person.branchOrDepartment} • ${person.campus}', style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            AdminAccentBadge(label: person.status, color: color),
          ],
        ),
      ),
    );
  }
}

class _AdministrativeHint extends StatelessWidget {
  final String title;
  final String detail;

  const _AdministrativeHint({
    required this.title,
    required this.detail,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 2),
            child: Icon(Icons.check_circle_outline_rounded, size: 18, color: Color(0xFF14532D)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(detail, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
