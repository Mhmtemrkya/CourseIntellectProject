import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

/// Yeni maaş kaydı: personele ödenecek tutar doğrudan yazılır (vergi/SGK
/// hesaplayıcısı yok). Kayıt yönetici onayına gider; onaylanınca maaş
/// detayından "Ödendi" kaydedilir.
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
  final _dateController = TextEditingController();
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

  double _number(String value) {
    var normalized = value.replaceAll('₺', '').replaceAll(' ', '').trim();
    if (normalized.contains(',') && normalized.contains('.')) {
      normalized = normalized.replaceAll('.', '').replaceAll(',', '.');
    } else if (normalized.contains(',')) {
      normalized = normalized.replaceAll(',', '.');
    }
    return double.tryParse(normalized) ?? 0;
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
                'Kayıt sonrası bordro listeye düşer ve yönetici onayına gönderilir.',
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
                    decoration: const InputDecoration(
                      labelText: 'Maaş Tutarı (TL)',
                      helperText: 'Personele ödenecek tutar',
                    ),
                    validator: (value) => _number(value ?? '') <= 0
                        ? 'Geçerli bir tutar girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _dateController,
                    decoration: InputDecoration(
                      labelText: 'Dönem / Ödeme Tarihi'.tr,
                      hintText: '01.11.2026',
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Tarih girin'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: InputDecoration(labelText: 'Not / Gerekçe'.tr),
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
    final reason = _reasonController.text.trim();
    Navigator.pop(context, {
      'employee': _employeeController.text.trim(),
      'role': _roleController.text.trim(),
      'amount': _amountController.text.trim(),
      'payDate': _dateController.text.trim(),
      'reason': reason.isEmpty
          ? '${_dateController.text.trim()} bordrosu'
          : reason,
    });
  }
}
