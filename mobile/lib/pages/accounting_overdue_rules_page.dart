import 'package:flutter/material.dart';

import '../services/app_settings_api_service.dart';
import '../widgets/accounting_ui.dart';

class AccountingOverdueRulesPage extends StatefulWidget {
  const AccountingOverdueRulesPage({super.key});

  @override
  State<AccountingOverdueRulesPage> createState() =>
      _AccountingOverdueRulesPageState();
}

class _AccountingOverdueRulesPageState
    extends State<AccountingOverdueRulesPage> {
  bool day3 = true;
  bool day7 = true;
  bool day15 = false;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadRules();
  }

  Future<void> _loadRules() async {
    try {
      final items = await AppSettingsApiService.instance.fetchAll(
        category: 'overdue',
      );
      if (!mounted) return;
      final map = {for (final item in items) item.key: item.value};
      setState(() {
        day3 = map['overdue_day3'] != 'false';
        day7 = map['overdue_day7'] != 'false';
        day15 = map['overdue_day15'] == 'true';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _saveRules() async {
    setState(() => _saving = true);
    try {
      await AppSettingsApiService.instance.upsert([
        {
          'key': 'overdue_day3',
          'value': day3.toString(),
          'type': 'bool',
          'category': 'overdue',
          'description': '3. gün hatırlatma',
        },
        {
          'key': 'overdue_day7',
          'value': day7.toString(),
          'type': 'bool',
          'category': 'overdue',
          'description': '7. gün veli mesaji',
        },
        {
          'key': 'overdue_day15',
          'value': day15.toString(),
          'type': 'bool',
          'category': 'overdue',
          'description': '15. gün eskalasyon',
        },
      ]);
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gecikme kuralları kaydedildi.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Kayıt başarısız: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Otomatik Gecikme Senaryolari',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AccountingPanel(
                  child: Column(
                    children: [
                      SwitchListTile(
                        value: day3,
                        onChanged: (v) => setState(() => day3 = v),
                        title: const Text('3. gün hatırlatmasi'),
                      ),
                      SwitchListTile(
                        value: day7,
                        onChanged: (v) => setState(() => day7 = v),
                        title: const Text('7. gün veli mesaji'),
                      ),
                      SwitchListTile(
                        value: day15,
                        onChanged: (v) => setState(() => day15 = v),
                        title: const Text('15. gün yönetiçi eskalasyonu'),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveRules,
                          child: _saving
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Kurallari Kaydet'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
