import 'package:flutter/material.dart';

import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingSalaryFormPage extends StatefulWidget {
  const AccountingSalaryFormPage({super.key});

  @override
  State<AccountingSalaryFormPage> createState() => _AccountingSalaryFormPageState();
}

class _AccountingSalaryFormPageState extends State<AccountingSalaryFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _employeeController = TextEditingController();
  final _roleController = TextEditingController();
  final _amountController = TextEditingController();
  final _dateController = TextEditingController(text: '28 Mart 2026');
  final _reasonController = TextEditingController();

  @override
  void dispose() {
    _employeeController.dispose();
    _roleController.dispose();
    _amountController.dispose();
    _dateController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: const AppHeader(title: 'Yeni Bordro Oluştur'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AccountingHeroCard(
            eyebrow: 'Bordro hazırlığı',
            title: 'Personel için yeni maaş ödeme planını oluşturun.',
            description: 'Kayıt sonrası bordro listeye düşer ve yönetici onayına gönderilir.',
            colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(label: 'Durum', value: 'Bekliyor'),
              AccountingHeroMetric(label: 'Akış', value: 'Onay süreci'),
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
                    decoration: const InputDecoration(labelText: 'Personel Adı'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Personel adı girin' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _roleController,
                    decoration: const InputDecoration(labelText: 'Pozisyon'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Pozisyon girin' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _amountController,
                    decoration: const InputDecoration(labelText: 'Tutar'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Tutar girin' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _dateController,
                    decoration: const InputDecoration(labelText: 'Ödeme Tarihi'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Tarih girin' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Not / Gerekçe'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Açıklama girin' : null,
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submit,
                      child: const Text('Bordroyu Oluştur'),
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

    Navigator.pop(
      context,
      {
        'employee': _employeeController.text.trim(),
        'role': _roleController.text.trim(),
        'amount': _amountController.text.trim(),
        'payDate': _dateController.text.trim(),
        'reason': _reasonController.text.trim(),
      },
    );
  }
}
