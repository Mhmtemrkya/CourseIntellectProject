import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import 'admin_accounting_registration_page.dart';
import 'accounting_approvals_page.dart';
import 'accounting_exports_page.dart';
import 'accounting_home_page.dart';
import 'accounting_overdue_page.dart';
import 'accounting_receipts_page.dart';
import 'driving_expenses_page.dart';
import 'student_finance_account_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/student_finance_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminFinancePage extends StatefulWidget {
  const AdminFinancePage({super.key});

  @override
  State<AdminFinancePage> createState() => _AdminFinancePageState();
}

class _AdminFinancePageState extends State<AdminFinancePage> {
  final _store = AccountingFinanceStore.instance;
  final _studentSearchController = TextEditingController();
  Map<String, dynamic>? _financeDash;
  bool _sendingReminders = false;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _store.loadDashboard();
    _loadFinanceDashboard();
  }

  Future<void> _loadFinanceDashboard() async {
    try {
      final data = await StudentFinanceApiService.instance.getDashboard();
      if (mounted) setState(() => _financeDash = data);
    } catch (_) {
      // Sessizce geç; yeni finans modeli verisi yoksa kart gizlenir.
    }
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _studentSearchController.dispose();
    super.dispose();
  }

  String _tl(dynamic value) {
    final number = (value is num) ? value : double.tryParse('$value') ?? 0;
    return '${number.toStringAsFixed(0)} ₺';
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _sendReminders() async {
    setState(() => _sendingReminders = true);
    try {
      final r = await StudentFinanceApiService.instance.sendReminders();
      _snack('${r['notified'] ?? 0} bilgilendirme gönderildi (${r['overdueCount'] ?? 0} geciken).');
    } catch (e) {
      _snack('Hatırlatma gönderilemedi: $e');
    } finally {
      if (mounted) setState(() => _sendingReminders = false);
    }
  }

  void _openAccount() {
    final name = _studentSearchController.text.trim();
    if (name.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => StudentFinanceAccountPage(studentName: name)),
    );
  }

  Future<void> _payrollDialog() async {
    final controller = TextEditingController();
    Map<String, dynamic>? result;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Bordro Hesapla'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(hintText: 'Brüt maaş (₺)'.tr),
              ),
              if (result != null) ...[
                const SizedBox(height: 12),
                _kv('Net', _tl(result!['net'])),
                _kv('SGK İşçi', _tl(result!['sgkEmployee'])),
                _kv('Gelir Vergisi', _tl(result!['incomeTax'])),
                _kv('İşveren Maliyeti', _tl(result!['totalEmployerCost'])),
              ],
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Kapat')),
            ElevatedButton(
              onPressed: () async {
                final gross = double.tryParse(controller.text.trim());
                if (gross == null || gross <= 0) return;
                final r = await StudentFinanceApiService.instance.calculatePayroll(gross);
                setLocal(() => result = r);
              },
              child: const Text('Hesapla'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dashMetric(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        ],
      );

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text(k, style: const TextStyle(color: Colors.grey)), Text(v, style: const TextStyle(fontWeight: FontWeight.w700))],
        ),
      );

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final financeRows = [
      (
        'Toplam Alacak',
        _store.formatAmount(_store.totalReceivables),
        const Color(0xFF14532D),
      ),
      (
        'Tahsil Edilen',
        _store.formatAmount(_store.collectedTotal),
        const Color(0xFF2563EB),
      ),
      (
        'Bekleyen',
        _store.formatAmount(_store.pendingTotal),
        const Color(0xFFB45309),
      ),
      (
        'Geciken',
        _store.formatAmount(_store.overdueTotal),
        const Color(0xFFB42318),
      ),
    ];

    final actions = [
      _AdminFinanceAction(
        'Tahsilatlar',
        'Güncel ödeme hareketleri',
        Icons.payments_outlined,
        const Color(0xFF14532D),
        const AccountingReceiptsPage(),
      ),
      _AdminFinanceAction(
        'Onaylar',
        'Finans ve indirim onaylari',
        Icons.verified_user_outlined,
        const Color(0xFF475569),
        const AccountingApprovalsPage(
          canApprove: true,
          pageTitle: 'Yönetici Onayları',
        ),
      ),
      _AdminFinanceAction(
        'Giderler',
        'Kira, fatura, mazot ve gider faturaları',
        Icons.receipt_long_outlined,
        const Color(0xFFE11D48),
        const DrivingExpensesPage(),
      ),
      _AdminFinanceAction(
        'Dışa Aktar',
        'PDF / Excel ciktilari',
        Icons.ios_share_outlined,
        const Color(0xFF4F46E5),
        const AccountingExportsPage(),
      ),
      _AdminFinanceAction(
        'Gecikenler',
        'Riskli ödeme listesi',
        Icons.warning_amber_rounded,
        const Color(0xFFB42318),
        const AccountingOverduePage(),
      ),
      _AdminFinanceAction(
        'Muhasebe Kaydı',
        'Sadece yönetiçi yeni muhasebe hesabı açar',
        Icons.person_add_alt_1_rounded,
        const Color(0xFF0F766E),
        const AdminAccountingRegistrationPage(),
      ),
    ];

    final riskCount = _store.installments
        .where((item) => item.status == 'Geciken')
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Finans Kontrolu',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Finans görünümü',
            title:
                'Tahsilat, onay ve riskli bakiye akışlarını yönetiçi perspektifiyle izleyin.'.tr,
            description:
                'Muhasebe modülundeki hareketler özetlenir ve kritik finans süreçleri doğrudan açılır.',
            metrics: [
              AdminHeroMetric(
                label: 'Nakit Sagligi',
                value: riskCount == 0 ? 'Dengede' : 'Izleme',
              ),
              AdminHeroMetric(label: 'Riskli Kayıt'.tr, value: '$riskCount'),
            ],
          ),
          const SizedBox(height: 16),
          ...financeRows.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: item.$3.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(Icons.monetization_on_outlined, color: item.$3),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.$1,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    item.$2,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: item.$3,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_financeDash != null) ...[
            const SizedBox(height: 18),
            AdminSectionTitle(title: 'Kayıt Finansmanı (Öğrenci Cari)'.tr),
            const SizedBox(height: 12),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: _dashMetric('Tahsilat Oranı', '%${_financeDash!['collectionRatePercent'] ?? 0}')),
                      Expanded(child: _dashMetric('Kalan Alacak', _tl(_financeDash!['outstandingTotal']))),
                      Expanded(child: _dashMetric('Geciken', _tl(_financeDash!['overdueTotal']))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Yaşlandırma (Aging)'.tr, style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 6),
                  ...((_financeDash!['aging'] as List<dynamic>? ?? []).map((raw) {
                    final b = Map<String, dynamic>.from(raw as Map);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${b['label']} (${b['count']})'),
                          Text(_tl(b['amount']), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    );
                  })),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _sendingReminders ? null : _sendReminders,
                      icon: const Icon(Icons.notifications_active_outlined),
                      label: Text(_sendingReminders ? 'Gönderiliyor...' : 'Ödeme Hatırlatması Gönder'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _studentSearchController,
                          decoration: InputDecoration(hintText: 'Öğrenci adıyla cari aç'.tr, isDense: true),
                          onSubmitted: (_) => _openAccount(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(onPressed: _openAccount, child: Text('Aç'.tr)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(onPressed: _payrollDialog, icon: const Icon(Icons.calculate_outlined), label: const Text('Bordro Hesapla')),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          const AdminSectionTitle(title: 'Finans Aksiyonlari'),
          const SizedBox(height: 12),
          ...actions.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => item.page),
                ),
                child: AdminPanel(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: item.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(item.icon, color: item.color),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.subtitle,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountingHomePage()),
            ),
            icon: const Icon(Icons.open_in_new_rounded),
            label: Text('Muhasebe Modülünü Aç'.tr),
          ),
        ],
      ),
    );
  }
}

class _AdminFinanceAction {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Widget page;

  _AdminFinanceAction(
    this.title,
    this.subtitle,
    this.icon,
    this.color,
    this.page,
  );
}
