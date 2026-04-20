import 'package:flutter/material.dart';

import 'admin_administrative_units_page.dart';
import 'admin_announcements_page.dart';
import 'admin_branch_detail_page.dart';
import 'admin_personnel_approvals_page.dart';
import 'admin_staff_list_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminOperationsPage extends StatefulWidget {
  const AdminOperationsPage({super.key});

  @override
  State<AdminOperationsPage> createState() => _AdminOperationsPageState();
}

class _AdminOperationsPageState extends State<AdminOperationsPage> {
  final _students = StudentRegistryStore.instance;
  final _staff = StaffRegistryStore.instance;
  final _finance = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _students.addListener(_refresh);
    _staff.addListener(_refresh);
    _finance.addListener(_refresh);
    _students.ensureLoaded();
    _staff.ensureLoaded();
    _finance.loadDashboard();
    AttendanceService.instance.refresh();
  }

  @override
  void dispose() {
    _students.removeListener(_refresh);
    _staff.removeListener(_refresh);
    _finance.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final campusCount = _staff.staff
        .map((item) => item.campus)
        .where((item) => item.isNotEmpty)
        .toSet()
        .length;
    final pendingPersonnel = _staff.staff
        .where((item) => item.status != 'Active' && item.status != 'Aktif')
        .length;
    final pendingStudents = _students.students
        .where((item) => item.status != 'Active' && item.status != 'Aktif')
        .length;
    final overdueCount = _finance.installments
        .where((item) => item.status == 'Geciken')
        .length;
    final absentCount = AttendanceService.instance
        .all()
        .where((item) => item.status == 'Devamsiz')
        .length;

    final operations = [
      (
        'Şube Yönetimi',
        '$campusCount aktif kampus görünüyor',
        Icons.apartment_outlined,
        const Color(0xFF2563EB),
      ),
      (
        'Insan Kaynaklari',
        '$pendingPersonnel personel durumu izleniyor',
        Icons.groups_outlined,
        const Color(0xFF14532D),
      ),
      (
        'İdari Birimler',
        '$pendingStudents öğrenci kaydı kontrol bekliyor',
        Icons.admin_panel_settings_outlined,
        const Color(0xFF0F766E),
      ),
      (
        'Duyuru Merkezi',
        '${_finance.notifications.length} bildirim/duyuru akışına bagli',
        Icons.campaign_outlined,
        const Color(0xFFB45309),
      ),
      (
        'Destek ve IT',
        '$overdueCount finans ve $absentCount devamsızlık sinyali',
        Icons.support_agent_outlined,
        const Color(0xFF7C3AED),
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Operasyon Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Kurumsal operasyon',
            title:
                'Şube, insan kaynağı ve günlük operasyon akışlarını yönetin.',
            description:
                'Yönetici panelinde saha işleyişi, destek süreçleri ve iç iletişim aynı çatı altında izlenir.',
            metrics: [
              AdminHeroMetric(label: 'Aktif Şube', value: '$campusCount'),
              AdminHeroMetric(
                label: 'Açık Talep',
                value: '${pendingPersonnel + pendingStudents + overdueCount}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...operations.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () =>
                    _openOperationAction(context, item.$1, item.$2, item.$4),
                child: AdminPanel(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: item.$4.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(item.$3, color: item.$4),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.$1,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.$2,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminPersonnelApprovalsPage(),
                    ),
                  ),
                  icon: const Icon(Icons.fact_check_outlined),
                  label: const Text('Onay Merkezi'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showSnack(
                    context,
                    'Operasyon görev listesi paylaşildi.',
                  ),
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Görev Plani'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openOperationAction(
    BuildContext context,
    String title,
    String subtitle,
    Color color,
  ) {
    if (title == 'Şube Yönetimi') {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AdminBranchDetailPage(
            branchName: 'Merkez Kampüs',
            summary: subtitle,
            color: color,
          ),
        ),
      );
      return;
    }

    if (title == 'Insan Kaynaklari') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AdminStaffListPage()),
      );
      return;
    }

    if (title == 'Duyuru Merkezi') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AdminAnnouncementsPage()),
      );
      return;
    }

    if (title == 'İdari Birimler') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AdminAdministrativeUnitsPage()),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminAccentBadge(label: title, color: color),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: Theme.of(
                    sheetContext,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  style: Theme.of(
                    sheetContext,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sheetAction(
                        sheetContext,
                        'Detay görünümünu ac',
                        Icons.open_in_new_rounded,
                      ),
                      const SizedBox(height: 10),
                      _sheetAction(
                        sheetContext,
                        'Sorumlulara görev oluştur',
                        Icons.task_alt_rounded,
                      ),
                      const SizedBox(height: 10),
                      _sheetAction(
                        sheetContext,
                        'Özet raporu paylaş',
                        Icons.share_outlined,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetAction(BuildContext context, String title, IconData icon) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () {
        Navigator.pop(context);
        _showSnack(context, '$title işlemi hazırlandi.');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 12),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }
}
