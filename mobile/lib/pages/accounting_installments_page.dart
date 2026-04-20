import 'package:flutter/material.dart';

import 'accounting_installment_detail_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/responsive_overlays.dart';

class AccountingInstallmentsPage extends StatefulWidget {
  const AccountingInstallmentsPage({super.key});

  @override
  State<AccountingInstallmentsPage> createState() =>
      _AccountingInstallmentsPageState();
}

class _AccountingInstallmentsPageState
    extends State<AccountingInstallmentsPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;
  String _filter = 'Tümü';

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
    StudentRegistryStore.instance.ensureLoaded().then((_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _store.installments
        .where((plan) => _filter == 'Tümü' || plan.status == _filter)
        .toList();

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Taksitler',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewPlanSheet,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Yeni Plan'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Taksit planlama',
            title:
                'Bekleyen, alınan ve geciken taksitleri aylık akışla izleyin.',
            description:
                'Yeni taksit planı oluştururken ilk taksit, başlangıç tarihi ve notlar aynı formda yönetilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF7C3AED)],
            metrics: [
              AccountingHeroMetric(
                label: 'Bekleyen',
                value:
                    '${_store.installments.where((item) => item.status == 'Bekleyen').length} plan',
              ),
              AccountingHeroMetric(
                label: 'Geciken',
                value:
                    '${_store.installments.where((item) => item.status == 'Geciken').length} plan',
              ),
            ],
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: ['Tümü', 'Bekleyen', 'Alınan', 'Geciken', 'Sonraki Ay']
                  .map(
                    (status) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: AccountingFilterChip(
                        label: status,
                        selected: _filter == status,
                        onTap: () => setState(() => _filter = status),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          ...filtered.map((plan) => _planCard(context, plan)),
        ],
      ),
    );
  }

  Widget _planCard(BuildContext context, InstallmentRecord plan) {
    final color = switch (plan.status) {
      'Alınan' => const Color(0xFF0F766E),
      'Geciken' => const Color(0xFFB42318),
      'Sonraki Ay' => const Color(0xFF7C3AED),
      _ => const Color(0xFF2563EB),
    };

    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              AccountingInstallmentDetailPage(student: plan.student),
        ),
      ),
      child: AccountingPanel(
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.calendar_month_outlined, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plan.student,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${plan.status} • ${plan.due}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  plan.amount,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Icon(Icons.chevron_right_rounded, color: color),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showNewPlanSheet() {
    final students =
        StudentRegistryStore.instance.students
            .map((item) => item.fullName)
            .where((item) => item.trim().isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    String selectedStudent = students.isNotEmpty ? students.first : '';
    final totalController = TextEditingController(text: '120000');
    final countController = TextEditingController(text: '12');
    final startDateController = TextEditingController(text: '01.04.2026');
    final firstInstallmentController = TextEditingController(text: '10000');
    final noteController = TextEditingController();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return ResponsiveSheetContainer(
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.of(sheetContext).viewInsets.bottom + 24,
            ),
            decoration: BoxDecoration(
              color: Theme.of(sheetContext).scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(30),
              ),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const AccountingHeroCard(
                    eyebrow: 'Yeni plan',
                    title: 'Taksit planını kontrollü şekilde oluşturun.',
                    description:
                        'Öğrenci, toplam tutar, taksit sayısı ve ilk taksit bilgisine göre aylık yapı hazırlanır.',
                    colors: [Color(0xFF0F172A), Color(0xFF7C3AED)],
                    metrics: [
                      AccountingHeroMetric(label: 'Plan', value: 'Aylık'),
                      AccountingHeroMetric(label: 'Önizleme', value: 'Aktif'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  AccountingPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Plan formu',
                          style: Theme.of(sheetContext).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          initialValue: selectedStudent.isEmpty
                              ? null
                              : selectedStudent,
                          decoration: const InputDecoration(
                            labelText: 'Öğrenci',
                            border: OutlineInputBorder(),
                          ),
                          items: students
                              .map(
                                (value) => DropdownMenuItem(
                                  value: value,
                                  child: Text(value),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              selectedStudent = value ?? selectedStudent,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: totalController,
                          decoration: const InputDecoration(
                            labelText: 'Toplam Tutar',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: countController,
                          decoration: const InputDecoration(
                            labelText: 'Taksit Sayısı',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: startDateController,
                          decoration: const InputDecoration(
                            labelText: 'Başlangıç Tarihi',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: firstInstallmentController,
                          decoration: const InputDecoration(
                            labelText: 'İlk Taksit Tutarı',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        AccountingPanel(
                          padding: const EdgeInsets.all(14),
                          child: Text(
                            'Aylara göre bölme önizlemesi: ilk taksit ₺${firstInstallmentController.text}, kalan tutar eşit bölünecek.',
                            style: Theme.of(sheetContext).textTheme.bodyMedium,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: noteController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Not',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: () async {
                              if (selectedStudent.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Plan oluşturmak için önce öğrenci kaydı gerekir.',
                                    ),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                                return;
                              }
                              final messenger = ScaffoldMessenger.of(context);
                              Navigator.pop(sheetContext);
                              try {
                                await _store.addInstallment(
                                  student: selectedStudent,
                                  amount: firstInstallmentController.text,
                                  due: startDateController.text,
                                  note: noteController.text,
                                );
                                if (!mounted) return;
                                messenger.showSnackBar(
                                  const SnackBar(
                                    content: Text('Taksit planı oluşturuldu.'),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              } catch (error) {
                                if (!mounted) return;
                                messenger.showSnackBar(
                                  SnackBar(
                                    content: Text(error.toString()),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            },
                            child: const Text('Taksit Planını Oluştur'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
