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
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _dateController = TextEditingController(text: '12 Mart 2026');
  final _reasonController = TextEditingController();

  String _category = 'Öğrenci Faturaları';

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _dateController.dispose();
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
            eyebrow: 'Belge üretimi',
            title: 'Yeni fatura veya gider kaydını tek akışta oluşturun.'.tr,
            description:
                'Kayıt oluşturulduğunda listeye düşer ve gerekiyorsa onay sürecine girer.',
            colors: [Color(0xFF08111F), Color(0xFFFF7A1A)],
            metrics: [
              AccountingHeroMetric(label: 'Durum', value: 'Taslak'),
              AccountingHeroMetric(label: 'Çıkış'.tr, value: 'Onaya düşer'),
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
                      labelText: 'Belge Kategorisi',
                    ),
                    items: [
                      DropdownMenuItem(
                        value: 'Öğrenci Faturaları',
                        child: Text('Öğrenci Faturaları'.tr),
                      ),
                      DropdownMenuItem(
                        value: 'Dershane Mekân Giderleri',
                        child: Text('Dershane Mekân Giderleri'),
                      ),
                      DropdownMenuItem(
                        value: 'Diğer Gider Faturaları',
                        child: Text('Diğer Gider Faturaları'.tr),
                      ),
                      DropdownMenuItem(
                        value: 'Maaş Faturaları',
                        child: Text('Maaş Faturaları'.tr),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _category = value ?? _category),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _titleController,
                    decoration: InputDecoration(
                      labelText: 'Belge Başlığı'.tr,
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Başlık girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _amountController,
                    decoration: const InputDecoration(labelText: 'Tutar'),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Tutar girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _dateController,
                    decoration: const InputDecoration(labelText: 'Tarih'),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Tarih girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: 'Açıklama / Gerekçe'.tr,
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Açıklama girin'
                        : null,
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submit,
                      child: Text('Kaydı Oluştur'.tr),
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

    Navigator.pop(context, {
      'title': _titleController.text.trim(),
      'category': _category,
      'amount': _amountController.text.trim(),
      'date': _dateController.text.trim(),
      'reason': _reasonController.text.trim(),
    });
  }
}
