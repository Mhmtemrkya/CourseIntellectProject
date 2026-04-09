import 'package:flutter/material.dart';

import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingInvoiceFormPage extends StatefulWidget {
  const AccountingInvoiceFormPage({super.key});

  @override
  State<AccountingInvoiceFormPage> createState() => _AccountingInvoiceFormPageState();
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
      appBar: const AppHeader(title: 'Yeni Fatura Oluştur'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AccountingHeroCard(
            eyebrow: 'Belge üretimi',
            title: 'Yeni fatura veya gider kaydını tek akışta oluşturun.',
            description: 'Kayıt oluşturulduğunda listeye düşer ve gerekiyorsa onay sürecine girer.',
            colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AccountingHeroMetric(label: 'Durum', value: 'Taslak'),
              AccountingHeroMetric(label: 'Çıkış', value: 'Onaya düşer'),
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
                    decoration: const InputDecoration(labelText: 'Belge Kategorisi'),
                    items: const [
                      DropdownMenuItem(value: 'Öğrenci Faturaları', child: Text('Öğrenci Faturaları')),
                      DropdownMenuItem(value: 'Dershane Mekan Giderleri', child: Text('Dershane Mekan Giderleri')),
                      DropdownMenuItem(value: 'Diğer Gider Faturaları', child: Text('Diğer Gider Faturaları')),
                      DropdownMenuItem(value: 'Maaş Faturaları', child: Text('Maaş Faturaları')),
                    ],
                    onChanged: (value) => setState(() => _category = value ?? _category),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _titleController,
                    decoration: const InputDecoration(labelText: 'Belge Başlığı'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Başlık girin' : null,
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
                    decoration: const InputDecoration(labelText: 'Tarih'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Tarih girin' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Açıklama / Gerekçe'),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Açıklama girin' : null,
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submit,
                      child: const Text('Kaydı Oluştur'),
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
        'title': _titleController.text.trim(),
        'category': _category,
        'amount': _amountController.text.trim(),
        'date': _dateController.text.trim(),
        'reason': _reasonController.text.trim(),
      },
    );
  }
}
