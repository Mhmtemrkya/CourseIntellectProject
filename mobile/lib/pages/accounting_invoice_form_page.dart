import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingInvoiceFormPage extends StatefulWidget {
  const AccountingInvoiceFormPage({super.key});

  @override
  State<AccountingInvoiceFormPage> createState() =>
      _AccountingInvoiceFormPageState();
}

class _AccountingInvoiceFormPageState extends State<AccountingInvoiceFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _invoiceNumberController = TextEditingController();
  final _counterpartyController = TextEditingController();
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();

  String _category = 'Öğrenci Faturaları';
  String _issueDate = DateTime.now().toIso8601String().split('T').first;
  String _dueDate = DateTime.now().toIso8601String().split('T').first;
  bool _isPaid = false;
  String _paymentMethod = 'Nakit';

  @override
  void dispose() {
    _invoiceNumberController.dispose();
    _counterpartyController.dispose();
    _titleController.dispose();
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: AppHeader(title: 'Yeni Fatura Oluştur'.tr),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Fatura kaydı',
            title: 'Kurumunuz için eksiksiz bir fatura kaydı oluşturun.',
            description:
                'Fatura bilgilerini ve ödeme durumunu kaydederken belirleyin. Ödenmemiş faturayı ödeme geldiğinde güncelleyebilirsiniz.',
            colors: const [Color(0xFF08111F), Color(0xFFFF7A1A)],
            metrics: [
              AccountingHeroMetric(
                label: 'Ödeme',
                value: _isPaid ? 'Ödendi' : 'Ödenmedi',
              ),
              const AccountingHeroMetric(
                label: 'Numara',
                value: 'Otomatik / Manuel',
              ),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _category,
                    decoration: const InputDecoration(
                      labelText: 'Fatura kategorisi',
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'Öğrenci Faturaları',
                        child: Text('Öğrenci Faturaları'),
                      ),
                      DropdownMenuItem(
                        value: 'Dershane Mekan Giderleri',
                        child: Text('Mekân ve İşletme Giderleri'),
                      ),
                      DropdownMenuItem(
                        value: 'Diğer Gider Faturaları',
                        child: Text('Diğer Gider Faturaları'),
                      ),
                      DropdownMenuItem(
                        value: 'Maaş Faturaları',
                        child: Text('Personel ve Maaş Giderleri'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _category = value ?? _category),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _counterpartyController,
                    decoration: const InputDecoration(
                      labelText: 'İlgili kişi / kurum *',
                      hintText: 'Öğrenci, veli veya tedarikçi',
                    ),
                    validator: _required('İlgili kişi veya kurumu girin'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _invoiceNumberController,
                    decoration: const InputDecoration(
                      labelText: 'Fatura numarası',
                      hintText: 'Boş bırakılırsa otomatik oluşturulur',
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _titleController,
                    decoration: const InputDecoration(
                      labelText: 'Fatura başlığı *',
                      hintText: 'Örn. Temmuz 2026 eğitim hizmeti',
                    ),
                    validator: _required('Fatura başlığını girin'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Toplam tutar (₺) *',
                    ),
                    validator: (value) {
                      final normalized = (value ?? '').replaceAll(',', '.');
                      final amount = double.tryParse(normalized);
                      return amount == null || amount <= 0
                          ? 'Sıfırdan büyük geçerli bir tutar girin'
                          : null;
                    },
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: 'Fatura tarihi',
                          value: _issueDate,
                          onChanged: (value) =>
                              setState(() => _issueDate = value),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _DateField(
                          label: 'Son ödeme tarihi',
                          value: _dueDate,
                          onChanged: (value) =>
                              setState(() => _dueDate = value),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Açıklama / kurum içi not',
                    ),
                  ),
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Ödeme durumu *',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: false,
                        icon: Icon(Icons.schedule_rounded),
                        label: Text('Ödenmedi'),
                      ),
                      ButtonSegment(
                        value: true,
                        icon: Icon(Icons.check_circle_outline_rounded),
                        label: Text('Ödendi'),
                      ),
                    ],
                    selected: {_isPaid},
                    onSelectionChanged: (value) =>
                        setState(() => _isPaid = value.first),
                  ),
                  if (_isPaid) ...[
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(
                      initialValue: _paymentMethod,
                      decoration: const InputDecoration(
                        labelText: 'Ödeme yöntemi *',
                      ),
                      items: const [
                        DropdownMenuItem(value: 'Nakit', child: Text('Nakit')),
                        DropdownMenuItem(
                          value: 'Kredi Kartı',
                          child: Text('Kredi Kartı'),
                        ),
                        DropdownMenuItem(
                          value: 'Havale/EFT',
                          child: Text('Havale / EFT'),
                        ),
                        DropdownMenuItem(value: 'Çek', child: Text('Çek')),
                      ],
                      onChanged: (value) => setState(
                        () => _paymentMethod = value ?? _paymentMethod,
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: 12),
                    const Text(
                      'Ödeme geldiğinde fatura detayındaki “Ödendi olarak işaretle” işlemini kullanabilirsiniz.',
                      style: TextStyle(color: Color(0xFFB45309)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _submit,
                      icon: const Icon(Icons.receipt_long_rounded),
                      label: const Text('Faturayı Kaydet'),
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

  FormFieldValidator<String> _required(String message) =>
      (value) => value == null || value.trim().isEmpty ? message : null;

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_dueDate.compareTo(_issueDate) < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Son ödeme tarihi fatura tarihinden önce olamaz.'),
        ),
      );
      return;
    }

    Navigator.pop(context, {
      'invoiceNumber': _invoiceNumberController.text.trim(),
      'counterparty': _counterpartyController.text.trim(),
      'title': _titleController.text.trim(),
      'category': _category,
      'amount': _amountController.text.trim(),
      'date': _issueDate,
      'dueDate': _dueDate,
      'reason': _reasonController.text.trim(),
      'isPaid': _isPaid.toString(),
      'paymentMethod': _paymentMethod,
    });
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final String value;
  final ValueChanged<String> onChanged;

  const _DateField({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final initial = DateTime.tryParse(value) ?? DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime(2020),
          lastDate: DateTime(2100),
        );
        if (picked != null) {
          onChanged(picked.toIso8601String().split('T').first);
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Text(value),
      ),
    );
  }
}
