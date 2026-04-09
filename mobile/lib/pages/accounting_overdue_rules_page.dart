import 'package:flutter/material.dart';

import '../widgets/accounting_ui.dart';

class AccountingOverdueRulesPage extends StatefulWidget {
  const AccountingOverdueRulesPage({super.key});

  @override
  State<AccountingOverdueRulesPage> createState() => _AccountingOverdueRulesPageState();
}

class _AccountingOverdueRulesPageState extends State<AccountingOverdueRulesPage> {
  bool day3 = true;
  bool day7 = true;
  bool day15 = false;

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: AppBar(title: const Text('Otomatik Gecikme Senaryolari', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingPanel(
            child: Column(
              children: [
                SwitchListTile(value: day3, onChanged: (v) => setState(() => day3 = v), title: const Text('3. gun hatirlatmasi')),
                SwitchListTile(value: day7, onChanged: (v) => setState(() => day7 = v), title: const Text('7. gun veli mesaji')),
                SwitchListTile(value: day15, onChanged: (v) => setState(() => day15 = v), title: const Text('15. gun yonetici eskalasyonu')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
