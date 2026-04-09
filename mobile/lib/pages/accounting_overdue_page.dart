import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'accounting_chat_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingOverduePage extends StatefulWidget {
  const AccountingOverduePage({super.key});

  @override
  State<AccountingOverduePage> createState() => _AccountingOverduePageState();
}

class _AccountingOverduePageState extends State<AccountingOverduePage> {
  final _store = AccountingFinanceStore.instance;
  final TextEditingController _searchController = TextEditingController();
  String _selectedClass = 'Tümü';

  @override
  void initState() {
    super.initState();
    _store.ensureOverdueAlerts();
    StudentRegistryStore.instance.ensureLoaded();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final overdueItems = _store.installments.where((item) => item.status == 'Geciken').toList();
    final classes = ['Tümü', ...{for (final item in overdueItems) _studentClass(item.student)}];
    final filtered = overdueItems.where((item) {
      final matchesClass = _selectedClass == 'Tümü' || _studentClass(item.student) == _selectedClass;
      final query = _searchController.text.toLowerCase();
      final matchesSearch = query.isEmpty || item.student.toLowerCase().contains(query);
      return matchesClass && matchesSearch;
    }).toList();

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Geciken Ödemeler'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Riskli bakiye takibi',
            title: 'Gecikmiş ödemeleri sınıf ve öğrenci bazında filtreleyin, hızlı aksiyon alın.',
            description: 'Mesaj, arama ve hatırlatma akışları aynı kart içinde kullanılabilir.',
            colors: const [Color(0xFF0F172A), Color(0xFFB42318)],
            metrics: [
              AccountingHeroMetric(label: 'Geciken Tutar', value: _store.formatAmount(_store.overdueTotal)),
              AccountingHeroMetric(label: 'Kritik Kayıt', value: '${filtered.length}'),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Öğrenci ara', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClass,
                  decoration: const InputDecoration(labelText: 'Sınıf', border: OutlineInputBorder()),
                  items: classes.map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
                  onChanged: (value) => setState(() => _selectedClass = value ?? 'Tümü'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...filtered.map((item) => _overdueCard(context, item)),
        ],
      ),
    );
  }

  Widget _overdueCard(BuildContext context, InstallmentRecord item) {
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(item.student, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              ),
              Text(item.amount, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900, color: const Color(0xFFB42318))),
            ],
          ),
          const SizedBox(height: 4),
          Text('${_studentClass(item.student)} • ${item.due} gecikme', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonalIcon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AccountingChatPage(user: '${item.student} Velisi'),
                  ),
                ),
                icon: const Icon(Icons.message_outlined),
                label: const Text('Mesaj Gönder'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _callParent(context, item.student),
                icon: const Icon(Icons.call_outlined),
                label: const Text('Ara'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  _store.addFinanceNotification(
                    title: '${item.student} icin odeme hatirlatmasi',
                    message: 'Sayin veli, ${item.student} ogrencimize ait ${item.amount} tutarli odeme gecikmistir. Lutfen okul muhasebesi ile iletisime geciniz.',
                  );
                  _showSnack(context, 'Hatırlatma bildirimi veliye iletildi.');
                },
                icon: const Icon(Icons.notifications_active_outlined),
                label: const Text('Hatırlat'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _callParent(BuildContext context, String student) async {
    final phoneNumber = _parentPhone(student);
    final uri = Uri(scheme: 'tel', path: phoneNumber);

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
      return;
    }

    if (!context.mounted) {
      return;
    }

    _showSnack(context, 'Arama ekranı açılamadı.');
  }

  String _studentClass(String student) {
    try {
      return StudentRegistryStore.instance.students
          .firstWhere((item) => item.fullName == student)
          .className;
    } catch (_) {
      return 'Tümü';
    }
  }

  String _parentPhone(String student) {
    try {
      return StudentRegistryStore.instance.students
          .firstWhere((item) => item.fullName == student)
          .parentPhone;
    } catch (_) {
      return '+905550000000';
    }
  }
}
