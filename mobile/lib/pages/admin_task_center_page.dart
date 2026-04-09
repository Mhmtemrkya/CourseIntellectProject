import 'package:flutter/material.dart';

import 'admin_branch_comparison_page.dart';
import 'admin_staff_registration_page.dart';
import 'accounting_approvals_page.dart';
import 'teacher_meeting_approvals_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/meeting_request_store.dart';
import '../services/staff_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminTaskCenterPage extends StatefulWidget {
  const AdminTaskCenterPage({super.key});

  @override
  State<AdminTaskCenterPage> createState() => _AdminTaskCenterPageState();
}

class _AdminTaskCenterPageState extends State<AdminTaskCenterPage> {
  @override
  void initState() {
    super.initState();
    StaffRegistryStore.instance.ensureLoaded();
    AccountingFinanceStore.instance.loadDashboard();
    MeetingRequestStore.instance.ensureLoaded();
  }

  @override
  Widget build(BuildContext context) {
    final pendingApprovals =
        AccountingFinanceStore.instance.approvals.where((item) => item.status == 'Bekliyor').length;
    final pendingStaff = StaffRegistryStore.instance.staff
        .where((item) => item.status != 'Active' && item.status != 'Aktif')
        .length;
    final pendingMeetings =
        MeetingRequestStore.instance.requests.where((item) => item.status == 'Bekliyor').length;
    final campusCount = StaffRegistryStore.instance.staff
        .map((item) => item.campus)
        .where((item) => item.isNotEmpty)
        .toSet()
        .length;

    final tasks = [
      _AdminTaskItem(
        title: 'Onay bekleyen $pendingApprovals indirim/finans talebi',
        category: 'Finans',
        color: const Color(0xFFB45309),
        page: const AccountingApprovalsPage(
          canApprove: true,
          pageTitle: 'Yonetici Onaylari',
        ),
      ),
      _AdminTaskItem(
        title: '$pendingStaff personel kaydi tamamlanacak',
        category: 'Idari',
        color: const Color(0xFF2563EB),
        page: const AdminStaffRegistrationPage(),
      ),
      _AdminTaskItem(
        title: '$pendingMeetings veli gorusme talebi donus bekliyor',
        category: 'Iletisim',
        color: const Color(0xFF14532D),
        page: const TeacherMeetingApprovalsPage(),
      ),
      _AdminTaskItem(
        title: '$campusCount kampus icin sube gorunumu guncel',
        category: 'Raporlama',
        color: const Color(0xFF7C3AED),
        page: const AdminBranchComparisonPage(),
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(title: const Text('Canli Gorev Merkezi', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: tasks
            .map(
              (task) => InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => task.page),
                ),
                child: AdminPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Icon(Icons.task_alt_rounded, color: task.color),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          task.title,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      Text(task.category, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _AdminTaskItem {
  final String title;
  final String category;
  final Color color;
  final Widget page;

  const _AdminTaskItem({
    required this.title,
    required this.category,
    required this.color,
    required this.page,
  });
}
