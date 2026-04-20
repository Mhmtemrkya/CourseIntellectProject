import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/responsive_layout.dart';
import 'accounting_audit_log_page.dart';
import 'accounting_bulk_actions_page.dart';
import 'accounting_cash_report_page.dart';
import 'accounting_collection_calendar_page.dart';
import 'accounting_discount_page.dart';
import 'accounting_exports_page.dart';
import 'accounting_installments_page.dart';
import 'accounting_invoices_page.dart';
import 'accounting_ledger_page.dart';
import 'accounting_messages_page.dart';
import 'accounting_notifications_page.dart';
import 'accounting_overdue_page.dart';
import 'accounting_overdue_rules_page.dart';
import 'accounting_receipt_archive_page.dart';
import 'accounting_receipts_page.dart';
import 'accounting_reconciliation_page.dart';
import 'accounting_salary_page.dart';

class AccountingHomePage extends StatefulWidget {
  const AccountingHomePage({super.key});

  @override
  State<AccountingHomePage> createState() => _AccountingHomePageState();
}

class _AccountingHomePageState extends State<AccountingHomePage> {
  final _store = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = [
      _SummaryMetric(
        'Toplam Alacak',
        _store.formatAmount(_store.totalReceivables),
        const Color(0xFF0F766E),
        Icons.account_balance_wallet_outlined,
      ),
      _SummaryMetric(
        'Tahsil Edilen',
        _store.formatAmount(_store.collectedTotal),
        const Color(0xFF2563EB),
        Icons.payments_outlined,
      ),
      _SummaryMetric(
        'Bekleyen',
        _store.formatAmount(_store.pendingTotal),
        const Color(0xFFB45309),
        Icons.pending_actions_outlined,
      ),
      _SummaryMetric(
        'Geciken',
        _store.formatAmount(_store.overdueTotal),
        const Color(0xFFB42318),
        Icons.warning_amber_rounded,
      ),
    ];

    final modules = [
      _ModuleCard(
        'Öğrenci Cari Hesapları',
        'Sınıf, toplam ücret, ödenen, kalan',
        Icons.groups_2_outlined,
        const Color(0xFF2563EB),
        const AccountingLedgerPage(),
      ),
      _ModuleCard(
        'Tahsilatlar',
        'Güncel ödeme hareketleri ve yeni tahsilat',
        Icons.point_of_sale_outlined,
        const Color(0xFF0F766E),
        const AccountingReceiptsPage(),
      ),
      _ModuleCard(
        'Taksitler',
        'Bekleyen, geciken ve yeni planlar',
        Icons.calendar_month_outlined,
        const Color(0xFF7C3AED),
        const AccountingInstallmentsPage(),
      ),
      _ModuleCard(
        'Faturalar ve Makbuzlar',
        'Öğrenci, mekan, gider ve maaş kayıtları',
        Icons.receipt_long_outlined,
        const Color(0xFFB45309),
        const AccountingInvoicesPage(),
      ),
      _ModuleCard(
        'İndirim ve Burs',
        'Aktif indirim, burs ve önizleme',
        Icons.workspace_premium_outlined,
        const Color(0xFF0891B2),
        const AccountingDiscountPage(),
      ),
      _ModuleCard(
        'Geciken Ödemeler',
        'Arama, filtre ve iletişim aksiyonları',
        Icons.notifications_active_outlined,
        const Color(0xFFB42318),
        const AccountingOverduePage(),
      ),
      _ModuleCard(
        'Mesajlar',
        'Veli ve öğrenci finans iletişimi',
        Icons.chat_bubble_outline_rounded,
        const Color(0xFF14532D),
        const AccountingMessagesPage(),
      ),
      _ModuleCard(
        'Dışa Aktar',
        'Excel, PDF ve hazır rapor çıkışları',
        Icons.ios_share_outlined,
        const Color(0xFF4F46E5),
        const AccountingExportsPage(),
      ),
      _ModuleCard(
        'Maaş Ödemeleri',
        'Personel maaş ve banka planlaması',
        Icons.badge_outlined,
        const Color(0xFF1D4ED8),
        const AccountingSalaryPage(),
      ),
      _ModuleCard(
        'Tahsilat Takvimi',
        'Gün bazlı beklenen ödeme görünümü',
        Icons.calendar_today_outlined,
        const Color(0xFF2563EB),
        const AccountingCollectionCalendarPage(),
      ),
      _ModuleCard(
        'Toplu Islem Merkezi',
        'Toplu tahsilat ve toplu mesaj akışı',
        Icons.groups_outlined,
        const Color(0xFF14532D),
        const AccountingBulkActionsPage(),
      ),
      _ModuleCard(
        'Makbuz Arsivi',
        'Tüm tahsilat belgelerine tek yerden erişim',
        Icons.folder_copy_outlined,
        const Color(0xFF7C3AED),
        const AccountingReceiptArchivePage(),
      ),
      _ModuleCard(
        'Gecikme Senaryolari',
        'Otomatik hatırlatma ve eskalasyon kuralları',
        Icons.rule_folder_outlined,
        const Color(0xFFB45309),
        const AccountingOverdueRulesPage(),
      ),
      _ModuleCard(
        'Kasa Dağılımı',
        'Nakit, kart ve havale kırılımı',
        Icons.pie_chart_outline_rounded,
        const Color(0xFF0891B2),
        const AccountingCashReportPage(),
      ),
      _ModuleCard(
        'Mutabakat',
        'Banka, POS ve kasa eşleştirme merkezi',
        Icons.compare_arrows_outlined,
        const Color(0xFF4F46E5),
        const AccountingReconciliationPage(),
      ),
    ];

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Muhasebe Paneli',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountingExportsPage()),
            ),
            icon: const Icon(Icons.download_outlined),
          ),
          IconButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const AccountingNotificationsPage(),
              ),
            ),
            icon: Badge(
              isLabelVisible: _store.notifications
                  .where((item) => item.unread)
                  .isNotEmpty,
              child: const Icon(Icons.notifications_none_rounded),
            ),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_store.lastError != null) ...[
                AccountingPanel(
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFB42318),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_store.lastError!)),
                      TextButton(
                        onPressed: _store.loadDashboard,
                        child: const Text('Yenile'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              _heroCard(),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: cards
                    .map((card) => _summaryCard(context, card))
                    .toList(),
              ),
              const SizedBox(height: 18),
              ResponsiveLayout.isTablet(context)
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: _leftColumn(context)),
                        const SizedBox(width: 20),
                        Expanded(child: _rightColumn(context, modules)),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _leftColumn(context),
                        const SizedBox(height: 18),
                        _rightColumn(context, modules),
                      ],
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroCard() {
    return AccountingHeroCard(
      eyebrow: 'Günlük finans özeti',
      title:
          'Tahsilat akışları, onay bekleyen işlemler ve riskli bakiyeler tek panelde.',
      description:
          'Toplam ${_store.collections.length} tahsilat, ${_store.approvals.where((item) => item.status == 'Bekliyor').length} bekleyen onay ve ${_store.installments.where((item) => item.status == 'Geciken').length} geciken plan izleniyor.',
      metrics: [
        AccountingHeroMetric(
          label: 'Tahsilat',
          value: _store.formatAmount(_store.collectedTotal),
        ),
        AccountingHeroMetric(
          label: 'Bekleyen Onay',
          value:
              '${_store.approvals.where((item) => item.status == 'Bekliyor').length} kayıt',
        ),
      ],
    );
  }

  Widget _summaryCard(BuildContext context, _SummaryMetric card) {
    final width = ResponsiveLayout.itemWidth(
      context,
      spacing: 12,
      phone: 1,
      tablet: 2,
      largeTablet: 4,
    );
    return SizedBox(
      width: width,
      child: AccountingPanel(
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: card.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(card.icon, color: card.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    card.title,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: card.color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    card.value,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(
    BuildContext context,
    String title,
    String action,
    VoidCallback onTap,
  ) {
    return AccountingSectionTitle(
      title: title,
      actionLabel: action,
      onAction: onTap,
    );
  }

  Widget _listRow(
    BuildContext context, {
    required String title,
    required String subtitle,
    required String amount,
    required Color color,
    bool highlight = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight
            ? color.withValues(alpha: 0.08)
            : Theme.of(
                context,
              ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Text(
            amount,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickAction(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Widget page,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () =>
          Navigator.push(context, MaterialPageRoute(builder: (_) => page)),
      child: AccountingPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Widget _leftColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(context, 'Son Tahsilatlar', 'Tümünü Gör', () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AccountingReceiptsPage()),
          );
        }),
        const SizedBox(height: 12),
        AccountingPanel(
          child: Column(
            children: _store.collections.take(3).map((item) {
              return _listRow(
                context,
                title: item.name,
                subtitle: '${item.className} • ${item.method} • ${item.time}',
                amount: item.amount,
                color: const Color(0xFF0F766E),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 18),
        _sectionTitle(context, 'Geciken Ödemeler', 'Detay', () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AccountingOverduePage()),
          );
        }),
        const SizedBox(height: 12),
        AccountingPanel(
          child: Column(
            children: _store.installments
                .where((item) => item.status == 'Geciken')
                .take(3)
                .map((item) {
                  return _listRow(
                    context,
                    title: item.student,
                    subtitle: '${item.due} • geciken plan',
                    amount: item.amount,
                    color: const Color(0xFFB42318),
                    highlight: true,
                  );
                })
                .toList(),
          ),
        ),
        const SizedBox(height: 18),
        _sectionTitle(context, 'Operasyon', 'Kayıtlar', () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AccountingAuditLogPage()),
          );
        }),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _quickAction(
                context,
                title: 'Bildirimler',
                subtitle:
                    '${_store.notifications.where((item) => item.unread).length} okunmamış',
                icon: Icons.notifications_active_outlined,
                color: const Color(0xFF14532D),
                page: const AccountingNotificationsPage(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _quickAction(
                context,
                title: 'Audit Log',
                subtitle: '${_store.auditLogs.length} işlem',
                icon: Icons.history_rounded,
                color: const Color(0xFF4F46E5),
                page: const AccountingAuditLogPage(),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _quickAction(
                context,
                title: 'Tahsilat Takvimi',
                subtitle: 'Günlük ödeme planları',
                icon: Icons.calendar_month_outlined,
                color: const Color(0xFF2563EB),
                page: const AccountingCollectionCalendarPage(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _quickAction(
                context,
                title: 'Mutabakat',
                subtitle: 'Banka ve kasa denetimi',
                icon: Icons.compare_arrows_outlined,
                color: const Color(0xFF4F46E5),
                page: const AccountingReconciliationPage(),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _rightColumn(BuildContext context, List<_ModuleCard> modules) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(context, 'Muhasebe Modülleri', 'Cari Hesaplar', () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AccountingLedgerPage()),
          );
        }),
        const SizedBox(height: 12),
        Column(
          children: modules.map((module) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => module.page),
                ),
                child: AccountingPanel(
                  child: Row(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: module.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(module.icon, color: module.color),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              module.title,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              module.subtitle,
                              style: Theme.of(
                                context,
                              ).textTheme.bodySmall?.copyWith(height: 1.4),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _SummaryMetric {
  final String title;
  final String value;
  final Color color;
  final IconData icon;

  _SummaryMetric(this.title, this.value, this.color, this.icon);
}

class _ModuleCard {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Widget page;

  _ModuleCard(this.title, this.subtitle, this.icon, this.color, this.page);
}
