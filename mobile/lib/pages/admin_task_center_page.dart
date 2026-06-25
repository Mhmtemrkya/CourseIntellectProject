import 'package:flutter/material.dart';

import 'admin_branch_comparison_page.dart';
import 'admin_staff_registration_page.dart';
import 'accounting_approvals_page.dart';
import 'teacher_meeting_approvals_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/meeting_request_store.dart';
import '../services/staff_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminTaskCenterPage extends StatefulWidget {
  const AdminTaskCenterPage({super.key});

  @override
  State<AdminTaskCenterPage> createState() => _AdminTaskCenterPageState();
}

class _AdminTaskCenterPageState extends State<AdminTaskCenterPage> {
  bool _loadingTasks = true;
  List<Map<String, dynamic>> _backendTasks = const [];

  @override
  void initState() {
    super.initState();
    StaffRegistryStore.instance.ensureLoaded();
    AccountingFinanceStore.instance.loadDashboard();
    MeetingRequestStore.instance.ensureLoaded();
    _loadBackendTasks();
  }

  Future<void> _loadBackendTasks() async {
    try {
      final tasks = await AdminWorkflowApiService.instance.getTasks();
      if (!mounted) return;
      setState(() {
        _backendTasks = tasks;
        _loadingTasks = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingTasks = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pendingApprovals = AccountingFinanceStore.instance.approvals
        .where((item) => item.status == 'Bekliyor')
        .length;
    final pendingStaff = StaffRegistryStore.instance.staff
        .where((item) => item.status != 'Active' && item.status != 'Aktif')
        .length;
    final pendingMeetings = MeetingRequestStore.instance.requests
        .where((item) => item.status == 'Bekliyor')
        .length;
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
          pageTitle: 'Yönetici Onayları',
        ),
      ),
      _AdminTaskItem(
        title: '$pendingStaff personel kaydı tamamlanacak',
        category: 'İdari',
        color: const Color(0xFF2563EB),
        page: const AdminStaffRegistrationPage(),
      ),
      _AdminTaskItem(
        title: '$pendingMeetings veli görüşme talebi dönüş bekliyor',
        category: 'İletişim',
        color: const Color(0xFF14532D),
        page: const TeacherMeetingApprovalsPage(),
      ),
      _AdminTaskItem(
        title: '$campusCount kampus için sube görünümü güncel',
        category: 'Raporlama',
        color: const Color(0xFF7C3AED),
        page: const AdminBranchComparisonPage(),
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Canlı Görev Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          ...tasks.map(
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
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      Text(
                        task.category,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
          ),
          const SizedBox(height: 12),
          const AdminSectionTitle(title: 'Oluşturulan Görevler'),
          const SizedBox(height: 12),
          if (_loadingTasks)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else if (_backendTasks.isEmpty)
            const AdminPanel(child: Text('Henüz oluşturulmuş idari görev yok.'))
          else
            ..._backendTasks.map((task) => AdminPanel(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${task['title'] ?? 'Görev'}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          Text(_statusLabel('${task['status'] ?? ''}'), style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('${task['assignedToName'] ?? 'Atanmamış'} • ${task['category'] ?? 'Genel'}'),
                      const SizedBox(height: 4),
                      Text('Başlangıç: ${_fmt(task['startDateUtc'])} • Bitiş: ${_fmt(task['endDateUtc'])}'),
                      if ('${task['rejectionReason'] ?? ''}'.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text('Mazeret: ${task['rejectionReason']}'),
                        ),
                      ],
                    ],
                  ),
                )),
        ],
      ),
    );
  }

  String _statusLabel(String status) {
    return switch (status) {
      'PendingAcceptance' => 'Kabul bekliyor',
      'Accepted' => 'Kabul edildi',
      'Rejected' => 'Kabul edilmedi',
      'Done' => 'Tamamlandı',
      _ => status.isEmpty ? '—' : status,
    };
  }

  String _fmt(dynamic value) {
    final date = DateTime.tryParse('$value');
    if (date == null) return '—';
    return '${date.day}.${date.month}.${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
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
