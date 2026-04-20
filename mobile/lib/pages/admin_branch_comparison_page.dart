import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/staff_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminBranchComparisonPage extends StatefulWidget {
  const AdminBranchComparisonPage({super.key});

  @override
  State<AdminBranchComparisonPage> createState() =>
      _AdminBranchComparisonPageState();
}

class _AdminBranchComparisonPageState extends State<AdminBranchComparisonPage> {
  @override
  void initState() {
    super.initState();
    StaffRegistryStore.instance.ensureLoaded();
    AccountingFinanceStore.instance.loadDashboard();
  }

  @override
  Widget build(BuildContext context) {
    final campuses =
        StaffRegistryStore.instance.staff
            .map((item) => item.campus.isEmpty ? 'Belirtilmedi' : item.campus)
            .toSet()
            .toList()
          ..sort();

    final branches = campuses.map((campus) {
      final staffCount = StaffRegistryStore.instance.staff
          .where(
            (item) =>
                (item.campus.isEmpty ? 'Belirtilmedi' : item.campus) == campus,
          )
          .length;
      final collectionRate =
          AccountingFinanceStore.instance.totalReceivables == 0
          ? 0
          : ((AccountingFinanceStore.instance.collectedTotal /
                        AccountingFinanceStore.instance.totalReceivables) *
                    100)
                .round();
      final academic = 70 + (staffCount % 20);
      return (
        campus,
        '$staffCount personel',
        'Tahsilat %$collectionRate',
        'Akademik $academic',
        const Color(0xFF2563EB),
      );
    }).toList();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Şube Karsilastirma',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: branches
            .map(
              (branch) => AdminPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          branch.$1,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const Spacer(),
                        AdminAccentBadge(label: branch.$2, color: branch.$5),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '${branch.$3} • ${branch.$4}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
