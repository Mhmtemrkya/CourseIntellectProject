import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/accounting_api_service.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';
import 'package:student/utils/format.dart';

class AccountingSalaryFormPage extends StatefulWidget {
  const AccountingSalaryFormPage({super.key});

  @override
  State<AccountingSalaryFormPage> createState() =>
      _AccountingSalaryFormPageState();
}

class _AccountingSalaryFormPageState extends State<AccountingSalaryFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _employeeController = TextEditingController();
  final _roleController = TextEditingController();
  final _amountController = TextEditingController();
  final _dateController = TextEditingController(text: '28 Mart 2026');
  final _reasonController = TextEditingController();
  final _sgkEmployeeController = TextEditingController();
  final _unemploymentController = TextEditingController();
  final _incomeTaxController = TextEditingController();
  final _stampTaxController = TextEditingController();
  final _sgkEmployerController = TextEditingController();
  final _employerCostController = TextEditingController();
  final List<_PayrollItemDraft> _customItems = [];
  bool _payrollActive = false;
  bool _calculating = false;

  @override
  void dispose() {
    _employeeController.dispose();
    _roleController.dispose();
    _amountController.dispose();
    _dateController.dispose();
    _reasonController.dispose();
    _sgkEmployeeController.dispose();
    _unemploymentController.dispose();
    _incomeTaxController.dispose();
    _stampTaxController.dispose();
    _sgkEmployerController.dispose();
    _employerCostController.dispose();
    for (final item in _customItems) {
      item.dispose();
    }
    super.dispose();
  }

  double _number(String value) {
    var normalized = value.replaceAll('₺', '').replaceAll(' ', '').trim();
    if (normalized.contains(',') && normalized.contains('.')) {
      normalized = normalized.replaceAll('.', '').replaceAll(',', '.');
    } else if (normalized.contains(',')) {
      normalized = normalized.replaceAll(',', '.');
    }
    return double.tryParse(normalized) ?? 0;
  }

  String _money(dynamic value) {
    final amount = value is num ? value.toDouble() : _number('$value');
    return amount.toStringAsFixed(2);
  }

  double get _netSalary {
    final gross = _number(_amountController.text);
    final legalDeductions =
        _number(_sgkEmployeeController.text) +
        _number(_unemploymentController.text) +
        _number(_incomeTaxController.text) +
        _number(_stampTaxController.text);
    final additions = _customItems
        .where((item) => item.isAddition)
        .fold<double>(0, (sum, item) => sum + _number(item.amount.text));
    final deductions = _customItems
        .where((item) => !item.isAddition)
        .fold<double>(0, (sum, item) => sum + _number(item.amount.text));
    return (gross + additions - legalDeductions - deductions)
        .clamp(0, double.infinity)
        .toDouble();
  }

  Future<void> _calculatePayroll() async {
    final gross = _number(_amountController.text);
    if (gross <= 0) {
      _showMessage('Önce geçerli bir brüt maaş girin.');
      return;
    }
    setState(() => _calculating = true);
    try {
      final result = await AccountingApiService.instance.calculatePayroll(
        grossSalary: gross,
        employee: _employeeController.text.trim().isEmpty
            ? null
            : _employeeController.text.trim(),
        year: DateTime.now().year,
      );
      if (!mounted) return;
      setState(() {
        _payrollActive = true;
        _sgkEmployeeController.text = _money(result['sgkEmployee']);
        _unemploymentController.text = _money(result['unemploymentEmployee']);
        _incomeTaxController.text = _money(result['incomeTax']);
        _stampTaxController.text = _money(result['stampTax']);
        _sgkEmployerController.text = _money(result['sgkEmployer']);
        _employerCostController.text = _money(result['totalEmployerCost']);
      });
    } catch (error) {
      _showMessage('Bordro hesaplanamadı: $error');
    } finally {
      if (mounted) setState(() => _calculating = false);
    }
  }

  void _startManualPayroll() {
    final gross = _number(_amountController.text);
    if (gross <= 0) {
      _showMessage('Önce geçerli bir brüt maaş girin.');
      return;
    }
    setState(() {
      _payrollActive = true;
      _sgkEmployeeController.text = '0.00';
      _unemploymentController.text = '0.00';
      _incomeTaxController.text = '0.00';
      _stampTaxController.text = '0.00';
      _sgkEmployerController.text = '0.00';
      _employerCostController.text = gross.toStringAsFixed(2);
    });
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: AppHeader(title: 'Yeni Bordro Oluştur'.tr),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Bordro hazırlığı',
            title: 'Personel için yeni maaş ödeme planını oluşturun.'.tr,
            description:
                'Kayıt sonrası bordro listeye düşer ve yönetiçi onayına gönderilir.',
            colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(label: 'Durum', value: 'Bekliyor'),
              AccountingHeroMetric(label: 'Akış'.tr, value: 'Onay süreci'),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _employeeController,
                    decoration: InputDecoration(labelText: 'Personel Adı'.tr),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Personel adı girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _roleController,
                    decoration: const InputDecoration(labelText: 'Pozisyon'),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Pozisyon girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Brüt Maaş'),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Tutar girin'
                        : null,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _calculating ? null : _calculatePayroll,
                          icon: _calculating
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.calculate_outlined),
                          label: const Text('Otomatik Hesapla'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _calculating ? null : _startManualPayroll,
                          icon: const Icon(Icons.edit_note_rounded),
                          label: const Text('Manuel Gir'),
                        ),
                      ),
                    ],
                  ),
                  if (_payrollActive) ...[
                    const SizedBox(height: 16),
                    _buildPayrollEditor(context),
                  ],
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _dateController,
                    decoration: InputDecoration(labelText: 'Ödeme Tarihi'.tr),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Tarih girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 4,
                    decoration: InputDecoration(labelText: 'Not / Gerekçe'.tr),
                    validator: (value) =>
                        !_payrollActive &&
                            (value == null || value.trim().isEmpty)
                        ? 'Açıklama girin'
                        : null,
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submit,
                      child: Text('Bordroyu Oluştur'.tr),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    if (_customItems.any(
      (item) => _number(item.amount.text) > 0 && item.label.text.trim().isEmpty,
    )) {
      _showMessage('Tutar girilen özel bordro kalemlerine ad verin.');
      return;
    }

    final reason = _reasonController.text.trim();
    final customSummary = _customItems
        .where(
          (item) =>
              item.label.text.trim().isNotEmpty &&
              _number(item.amount.text) > 0,
        )
        .map(
          (item) =>
              '${item.label.text.trim()}: ${item.isAddition ? '+' : '-'}${formatMoney(item.amount.text)}',
        )
        .join(', ');
    final breakdown = _payrollActive
        ? 'Brüt ${formatMoney(_amountController.text)} → Net ${formatMoney(_netSalary)} '
              '(SGK ${formatMoney(_sgkEmployeeController.text)}, İşsizlik ${formatMoney(_unemploymentController.text)}, '
              'Gelir V. ${formatMoney(_incomeTaxController.text)}, Damga ${formatMoney(_stampTaxController.text)}'
              '${customSummary.isEmpty ? '' : '; Özel kalemler: $customSummary'})'
        : '';

    Navigator.pop(context, {
      'employee': _employeeController.text.trim(),
      'role': _roleController.text.trim(),
      'amount': _amountController.text.trim(),
      'payDate': _dateController.text.trim(),
      'reason': [
        reason,
        breakdown,
      ].where((item) => item.isNotEmpty).join(' — '),
    });
  }

  Widget _buildPayrollEditor(BuildContext context) {
    final fields = <(String, TextEditingController)>[
      ('SGK İşçi', _sgkEmployeeController),
      ('İşsizlik İşçi', _unemploymentController),
      ('Gelir Vergisi', _incomeTaxController),
      ('Damga Vergisi', _stampTaxController),
      ('SGK İşveren', _sgkEmployerController),
      ('Toplam İşveren Maliyeti', _employerCostController),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Düzenlenebilir Bordro Kırılımı',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            'Hesaplanan tutarları değiştirebilir veya yeni kalem ekleyebilirsiniz.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          ...fields.map(
            (field) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: TextFormField(
                controller: field.$2,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(labelText: '${field.$1} (TL)'),
                onChanged: (_) => setState(() {}),
              ),
            ),
          ),
          ..._customItems.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      controller: item.label,
                      decoration: const InputDecoration(labelText: 'Kalem adı'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: item.amount,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(labelText: 'Tutar'),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  IconButton(
                    tooltip: item.isAddition ? 'Ek ödeme' : 'Kesinti',
                    onPressed: () =>
                        setState(() => item.isAddition = !item.isAddition),
                    icon: Icon(
                      item.isAddition
                          ? Icons.add_circle_outline
                          : Icons.remove_circle_outline,
                      color: item.isAddition ? Colors.green : Colors.red,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Kalemi kaldır',
                    onPressed: () {
                      setState(() => _customItems.remove(item));
                      item.dispose();
                    },
                    icon: const Icon(Icons.delete_outline_rounded),
                  ),
                ],
              ),
            ),
          ),
          OutlinedButton.icon(
            onPressed: () =>
                setState(() => _customItems.add(_PayrollItemDraft())),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Özel Kalem Ekle'),
          ),
          const Divider(height: 28),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Net Maaş',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                formatMoney(_netSalary),
                style: const TextStyle(
                  color: Color(0xFF0F766E),
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayrollItemDraft {
  final label = TextEditingController();
  final amount = TextEditingController();
  bool isAddition = false;

  void dispose() {
    label.dispose();
    amount.dispose();
  }
}
