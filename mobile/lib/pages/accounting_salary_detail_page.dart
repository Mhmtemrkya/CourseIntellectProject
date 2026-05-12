import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingSalaryDetailPage extends StatefulWidget {
  final SalaryRecord salary;

  const AccountingSalaryDetailPage({super.key, required this.salary});

  @override
  State<AccountingSalaryDetailPage> createState() =>
      _AccountingSalaryDetailPageState();
}

class _AccountingSalaryDetailPageState
    extends State<AccountingSalaryDetailPage> {
  late SalaryRecord _salary;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _salary = widget.salary;
  }

  Future<void> _openEdit() async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => _SalaryEditDialog(salary: _salary),
    );
    if (result == null) return;
    try {
      await AccountingFinanceStore.instance.updateSalary(
        id: _salary.id,
        employee: result['employee']!,
        role: result['role']!,
        amount: result['amount']!,
        payDate: result['payDate']!,
        status: result['status']!,
      );
      if (!mounted) return;
      final refreshed = AccountingFinanceStore.instance.salaries.firstWhere(
        (item) => item.id == _salary.id,
        orElse: () => _salary,
      );
      setState(() => _salary = refreshed);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Bordro güncellendi.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Güncelleme başarısız: $error')));
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bordroyu Sil'),
        content: Text(
          '${_salary.employee} bordrosunu silmek istediginize emin misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB42318),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _deleting = true);
    try {
      await AccountingFinanceStore.instance.deleteSalary(_salary.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Bordro silindi.')));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Silme başarısız: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = _salary;

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Bordro Detayi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Düzenle',
            icon: const Icon(Icons.edit_outlined),
            onPressed: _deleting || current.id.isEmpty ? null : _openEdit,
          ),
          IconButton(
            tooltip: 'Sil',
            icon: _deleting
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(
                    Icons.delete_outline_rounded,
                    color: Color(0xFFB42318),
                  ),
            onPressed: _deleting || current.id.isEmpty ? null : _confirmDelete,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: current.role,
            title: current.employee,
            description:
                'Bordro tutarı, ödeme tarihi ve onay ilerlemesi bu ekranda izlenir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(label: 'Tutar', value: current.amount),
              AccountingHeroMetric(label: 'Durum', value: current.status),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Bordro Özeti'),
                const SizedBox(height: 14),
                _row(context, 'Personel', current.employee),
                _row(context, 'Pozisyon', current.role),
                _row(context, 'Ödeme Tarihi', current.payDate),
                _row(context, 'Bordro Tutarı', current.amount),
                _row(context, 'Durum', current.status),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'İşlem Adımları'),
                const SizedBox(height: 14),
                _step(
                  context,
                  const Color(0xFF0F766E),
                  'Bordro hazırlandı',
                  'Ödeme planı muhasebe birimi tarafından oluşturuldu.',
                ),
                _step(
                  context,
                  const Color(0xFF2563EB),
                  'Onay takibi',
                  current.status == 'Planlandı' || current.status == 'Ödendi'
                      ? 'Bordro onayı tamamlandı ve ödeme akışına alındı.'
                      : 'Bordro yönetiçi onayını bekliyor.',
                ),
                _step(
                  context,
                  const Color(0xFF7C3AED),
                  'Banka dosyası',
                  'Banka aktarımı ve bordro PDF çıktısı hazır tutuluyor.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _step(
    BuildContext context,
    Color color,
    String title,
    String subtitle,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.check_circle_outline_rounded, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SalaryEditDialog extends StatefulWidget {
  final SalaryRecord salary;

  const _SalaryEditDialog({required this.salary});

  @override
  State<_SalaryEditDialog> createState() => _SalaryEditDialogState();
}

class _SalaryEditDialogState extends State<_SalaryEditDialog> {
  late final TextEditingController _employee;
  late final TextEditingController _role;
  late final TextEditingController _amount;
  late final TextEditingController _payDate;
  late String _status;

  @override
  void initState() {
    super.initState();
    _employee = TextEditingController(text: widget.salary.employee);
    _role = TextEditingController(text: widget.salary.role);
    _amount = TextEditingController(text: widget.salary.amount);
    _payDate = TextEditingController(text: widget.salary.payDate);
    _status = widget.salary.status;
  }

  @override
  void dispose() {
    _employee.dispose();
    _role.dispose();
    _amount.dispose();
    _payDate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Bordro Düzenle'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _employee,
              decoration: const InputDecoration(labelText: 'Personel'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _role,
              decoration: const InputDecoration(labelText: 'Pozisyon'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _amount,
              decoration: const InputDecoration(labelText: 'Tutar'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _payDate,
              decoration: const InputDecoration(labelText: 'Ödeme Tarihi'),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(labelText: 'Durum'),
              items: const [
                DropdownMenuItem(value: 'Bekliyor', child: Text('Bekliyor')),
                DropdownMenuItem(value: 'Planlandı', child: Text('Planlandı')),
                DropdownMenuItem(value: 'Ödendi', child: Text('Ödendi')),
                DropdownMenuItem(
                  value: 'Reddedildi',
                  child: Text('Reddedildi'),
                ),
              ],
              onChanged: (v) => setState(() => _status = v ?? _status),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Vazgeç'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'employee': _employee.text.trim(),
            'role': _role.text.trim(),
            'amount': _amount.text.trim(),
            'payDate': _payDate.text.trim(),
            'status': _status,
          }),
          child: const Text('Kaydet'),
        ),
      ],
    );
  }
}
