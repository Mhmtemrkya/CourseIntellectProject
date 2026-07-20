import 'dart:math' as math;

import 'package:student/i18n/app_locale.dart';
import 'package:flutter/material.dart';
import '../features/assistant/presentation/assistant_page.dart';

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

const _monthsTr = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const _weekdaysTr = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const _periodNoun = {
  'day': 'gün',
  'week': 'hafta',
  'month': 'ay',
  'year': 'yıl',
};

DateTime? _parseTrDate(String value) {
  final raw = value.replaceAll(' • ', ' ').trim();
  if (raw.isEmpty) return null;
  final match = RegExp(
    r'(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?',
  ).firstMatch(raw);
  if (match == null) return null;
  return DateTime(
    int.parse(match.group(3)!),
    int.parse(match.group(2)!),
    int.parse(match.group(1)!),
    match.group(4) != null ? int.parse(match.group(4)!) : 0,
    match.group(5) != null ? int.parse(match.group(5)!) : 0,
  );
}

class _Range {
  final DateTime start;
  final DateTime end;
  const _Range(this.start, this.end);

  bool contains(DateTime? date) =>
      date != null && !date.isBefore(start) && !date.isAfter(end);
}

_Range _periodRange(String period, DateTime anchor) {
  switch (period) {
    case 'day':
      final start = DateTime(anchor.year, anchor.month, anchor.day);
      return _Range(start, start.add(const Duration(days: 1) - const Duration(milliseconds: 1)));
    case 'week':
      final offset = (anchor.weekday + 6) % 7;
      final start = DateTime(anchor.year, anchor.month, anchor.day - offset);
      return _Range(start, start.add(const Duration(days: 7) - const Duration(milliseconds: 1)));
    case 'year':
      return _Range(DateTime(anchor.year, 1, 1), DateTime(anchor.year, 12, 31, 23, 59, 59));
    default:
      final start = DateTime(anchor.year, anchor.month, 1);
      return _Range(start, DateTime(anchor.year, anchor.month + 1, 0, 23, 59, 59));
  }
}

DateTime _shiftAnchor(String period, DateTime anchor, int delta) {
  switch (period) {
    case 'day':
      return anchor.add(Duration(days: delta));
    case 'week':
      return anchor.add(Duration(days: 7 * delta));
    case 'year':
      return DateTime(anchor.year + delta, anchor.month, anchor.day);
    default:
      return DateTime(anchor.year, anchor.month + delta, 1);
  }
}

String _periodLabel(String period, DateTime anchor) {
  switch (period) {
    case 'day':
      return '${anchor.day.toString().padLeft(2, '0')}.${anchor.month.toString().padLeft(2, '0')}.${anchor.year}';
    case 'week':
      final range = _periodRange('week', anchor);
      return '${range.start.day} ${_monthsTr[range.start.month - 1].substring(0, 3)} – ${range.end.day} ${_monthsTr[range.end.month - 1].substring(0, 3)}';
    case 'year':
      return '${anchor.year}';
    default:
      return '${_monthsTr[anchor.month - 1]} ${anchor.year}';
  }
}

class _Bucket {
  final String label;
  final String fullLabel;
  final int income;
  final int expense;
  final int salary;
  final int invoice;
  final int count;

  const _Bucket({
    required this.label,
    required this.fullLabel,
    required this.income,
    required this.expense,
    required this.salary,
    required this.invoice,
    required this.count,
  });

  int get net => income - expense;
}

List<_Range> _bucketRanges(String period, DateTime anchor) {
  switch (period) {
    case 'day':
      return List.generate(8, (i) {
        final start = DateTime(anchor.year, anchor.month, anchor.day, i * 3);
        return _Range(start, start.add(const Duration(hours: 3) - const Duration(milliseconds: 1)));
      });
    case 'week':
      final offset = (anchor.weekday + 6) % 7;
      final monday = DateTime(anchor.year, anchor.month, anchor.day - offset);
      return List.generate(7, (i) {
        final start = monday.add(Duration(days: i));
        return _Range(start, start.add(const Duration(days: 1) - const Duration(milliseconds: 1)));
      });
    case 'year':
      return List.generate(12, (i) {
        return _Range(DateTime(anchor.year, i + 1, 1), DateTime(anchor.year, i + 2, 0, 23, 59, 59));
      });
    default:
      // Ay → haftalık kovalar (1. Hafta ... )
      final daysInMonth = DateTime(anchor.year, anchor.month + 1, 0).day;
      final ranges = <_Range>[];
      var day = 1;
      while (day <= daysInMonth) {
        final endDay = math.min(day + 6, daysInMonth);
        ranges.add(_Range(
          DateTime(anchor.year, anchor.month, day),
          DateTime(anchor.year, anchor.month, endDay, 23, 59, 59),
        ));
        day = endDay + 1;
      }
      return ranges;
  }
}

String _bucketLabel(String period, _Range range, int index) {
  switch (period) {
    case 'day':
      return '${range.start.hour.toString().padLeft(2, '0')}h';
    case 'week':
      return _weekdaysTr[(range.start.weekday + 6) % 7];
    case 'year':
      return _monthsTr[range.start.month - 1].substring(0, 3);
    default:
      return '${index + 1}.H';
  }
}

String _bucketFullLabel(String period, _Range range, int index) {
  switch (period) {
    case 'day':
      return '${range.start.hour.toString().padLeft(2, '0')}:00 – ${(range.start.hour + 3) % 24}:00';
    case 'week':
      return '${_weekdaysTr[(range.start.weekday + 6) % 7]} · ${range.start.day} ${_monthsTr[range.start.month - 1].substring(0, 3)}';
    case 'year':
      return '${_monthsTr[range.start.month - 1]} ${range.start.year}';
    default:
      return '${index + 1}. Hafta (${range.start.day}–${range.end.day})';
  }
}

class AccountingHomePage extends StatefulWidget {
  const AccountingHomePage({super.key});

  @override
  State<AccountingHomePage> createState() => _AccountingHomePageState();
}

class _AccountingHomePageState extends State<AccountingHomePage> {
  final _store = AccountingFinanceStore.instance;

  String _period = 'month';
  DateTime _anchor = DateTime.now();

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

  bool _isPaid(String status) {
    final s = status.toLowerCase();
    return s.contains('öden') ||
        s.contains('oden') ||
        s.contains('paid') ||
        s.contains('tahsil');
  }

  int _sumAmount(Iterable<String> amounts) =>
      amounts.fold<int>(0, (sum, a) => sum + _store.parseAmount(a));

  // "Gider" toplamına katılmayan faturalar: öğrenci/kurs ücreti (gelir belgesi) ve
  // maaş/bordro (maaş gideri zaten ayrı "Maaş" listesinden sayılıyor → çift sayım önlenir).
  bool _isExpenseInvoice(InvoiceRecord invoice) {
    final c = invoice.category.toLowerCase();
    const excludedMarkers = [
      'öğrenci', 'ogrenci', 'kurs', 'ücret', 'ucret', 'tahsil', 'gelir',
      'maaş', 'maas', 'bordro', 'personel', 'payroll',
    ];
    return !excludedMarkers.any(c.contains);
  }

  // --- Seçili döneme göre türetilmiş veriler ---
  List<CollectionRecord> get _periodCollections {
    final range = _periodRange(_period, _anchor);
    return _store.collections
        .where((c) => range.contains(_parseTrDate(c.time)))
        .toList();
  }

  List<InstallmentRecord> get _periodInstallments {
    final range = _periodRange(_period, _anchor);
    return _store.installments
        .where((i) => range.contains(_parseTrDate(i.due)))
        .toList();
  }

  // Geciken kayıtlar da seçili döneme göre (vadesi bu döneme düşen + gecikmiş).
  List<InstallmentRecord> get _overdueInstallments {
    final range = _periodRange(_period, _anchor);
    final now = DateTime.now();
    return _store.installments.where((i) {
      final due = _parseTrDate(i.due);
      if (!range.contains(due)) return false;
      return i.status == 'Geciken' ||
          (due != null && due.isBefore(now) && !_isPaid(i.status));
    }).toList();
  }

  int get _periodCollected =>
      _sumAmount(_periodCollections.map((c) => c.amount));

  int get _periodExpense {
    final range = _periodRange(_period, _anchor);
    final salary = _sumAmount(
      _store.salaries
          .where((s) => range.contains(_parseTrDate(s.payDate)))
          .map((s) => s.amount),
    );
    final invoice = _sumAmount(
      _store.invoices
          .where((i) => range.contains(_parseTrDate(i.subtitle)) && _isExpenseInvoice(i))
          .map((i) => i.amount),
    );
    return salary + invoice;
  }

  int get _periodUnpaidDue => _sumAmount(
        _periodInstallments
            .where((i) => !_isPaid(i.status))
            .map((i) => i.amount),
      );

  int get _periodTarget => _periodCollected + _periodUnpaidDue;

  int get _periodRate {
    final target = _periodTarget;
    if (target <= 0) return _periodCollected > 0 ? 100 : 0;
    return math.min(100, ((_periodCollected / target) * 100).round());
  }

  int get _periodOverdueTotal =>
      _sumAmount(_overdueInstallments.map((i) => i.amount));

  int get _periodCash => _sumAmount(
        _periodCollections
            .where((c) => c.method.toLowerCase().contains('nakit'))
            .map((c) => c.amount),
      );

  int get _periodCardBank {
    const keys = ['kart', 'card', 'pos', 'havale', 'eft', 'bank', 'banka', 'transfer'];
    return _sumAmount(
      _periodCollections
          .where((c) => keys.any((k) => c.method.toLowerCase().contains(k)))
          .map((c) => c.amount),
    );
  }

  int get _prevCollected {
    final range = _periodRange(_period, _shiftAnchor(_period, _anchor, -1));
    return _sumAmount(
      _store.collections
          .where((c) => range.contains(_parseTrDate(c.time)))
          .map((c) => c.amount),
    );
  }

  List<_Bucket> get _flowBuckets {
    final ranges = _bucketRanges(_period, _anchor);
    return List.generate(ranges.length, (index) {
      final range = ranges[index];
      final coll = _store.collections
          .where((c) => range.contains(_parseTrDate(c.time)))
          .toList();
      final salary = _sumAmount(
        _store.salaries
            .where((s) => range.contains(_parseTrDate(s.payDate)))
            .map((s) => s.amount),
      );
      final invoice = _sumAmount(
        _store.invoices
            .where((i) => range.contains(_parseTrDate(i.subtitle)) && _isExpenseInvoice(i))
            .map((i) => i.amount),
      );
      return _Bucket(
        label: _bucketLabel(_period, range, index),
        fullLabel: _bucketFullLabel(_period, range, index),
        income: _sumAmount(coll.map((c) => c.amount)),
        expense: salary + invoice,
        salary: salary,
        invoice: invoice,
        count: coll.length,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final modules = _modules();

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Muhasebe Paneli',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'SchoolAsist Asistan',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AssistantPage())),
            icon: const Icon(Icons.auto_awesome_rounded),
          ),
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
              _periodSelector(context),
              const SizedBox(height: 16),
              _summaryCards(context),
              const SizedBox(height: 18),
              _flowChartSection(context),
              const SizedBox(height: 18),
              ResponsiveLayout.isTablet(context)
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: _rateCard(context)),
                        const SizedBox(width: 16),
                        Expanded(child: _goalCard(context)),
                      ],
                    )
                  : Column(
                      children: [
                        _rateCard(context),
                        const SizedBox(height: 16),
                        _goalCard(context),
                      ],
                    ),
              const SizedBox(height: 18),
              _operationQuickActions(context),
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
      eyebrow: '${_periodLabel(_period, _anchor)} finans özeti',
      title:
          'Tahsilat akışları, onay bekleyen işlemler ve riskli bakiyeler tek panelde.'.tr,
      description:
          'Bu ${_periodNoun[_period]}: ${_periodCollections.length} tahsilat, ${_store.approvals.where((item) => item.status == 'Bekliyor').length} bekleyen onay ve ${_overdueInstallments.length} geciken plan izleniyor.',
      metrics: [
        AccountingHeroMetric(
          label: 'Tahsilat',
          value: _store.formatAmount(_periodCollected),
        ),
        AccountingHeroMetric(
          label: 'Net Akış'.tr,
          value: _store.formatAmount(_periodCollected - _periodExpense),
        ),
      ],
    );
  }

  Widget _periodSelector(BuildContext context) {
    final theme = Theme.of(context);
    return AccountingPanel(
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in const [
                ['day', 'Günlük'],
                ['week', 'Haftalık'],
                ['month', 'Aylık'],
                ['year', 'Yıllık'],
              ])
                AccountingFilterChip(
                  label: entry[1],
                  selected: _period == entry[0],
                  onTap: () => setState(() {
                    _period = entry[0];
                    _anchor = DateTime.now();
                  }),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              IconButton(
                onPressed: () => setState(
                  () => _anchor = _shiftAnchor(_period, _anchor, -1),
                ),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Expanded(
                child: Text(
                  _periodLabel(_period, _anchor),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => setState(
                  () => _anchor = _shiftAnchor(_period, _anchor, 1),
                ),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryCards(BuildContext context) {
    final net = _periodCollected - _periodExpense;
    final cards = [
      _SummaryMetric(
        'Dönem Tahsilatı',
        _store.formatAmount(_periodCollected),
        const Color(0xFF0F766E),
        Icons.payments_outlined,
      ),
      _SummaryMetric(
        'Dönem Gideri',
        _store.formatAmount(_periodExpense),
        const Color(0xFFB42318),
        Icons.account_balance_outlined,
      ),
      _SummaryMetric(
        'Net Akış',
        '${net >= 0 ? '+' : ''}${_store.formatAmount(net)}',
        net >= 0 ? const Color(0xFF2563EB) : const Color(0xFFB45309),
        net >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded,
      ),
      _SummaryMetric(
        'Geciken',
        _store.formatAmount(_periodOverdueTotal),
        const Color(0xFFB45309),
        Icons.warning_amber_rounded,
      ),
    ];
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: cards.map((card) => _summaryCard(context, card)).toList(),
    );
  }

  Widget _summaryCard(BuildContext context, _SummaryMetric card) {
    final width = ResponsiveLayout.itemWidth(
      context,
      spacing: 12,
      phone: 2,
      tablet: 2,
      largeTablet: 4,
    );
    return SizedBox(
      width: width,
      child: AccountingPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: card.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(card.icon, color: card.color),
            ),
            const SizedBox(height: 12),
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
    );
  }

  Widget _flowChartSection(BuildContext context) {
    final buckets = _flowBuckets;
    return AccountingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Gelir - Gider Grafiği'.tr,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const _LegendDot(color: Color(0xFF10B981), label: 'Gelir'),
              const SizedBox(width: 10),
              const _LegendDot(color: Color(0xFFF43F5E), label: 'Gider'),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${_periodLabel(_period, _anchor)} · bir sütuna dokununca ne geldi / ne gitti detayı açılır',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _miniTotal(
                  context,
                  'Toplam Gelir',
                  _store.formatAmount(_periodCollected),
                  const Color(0xFF10B981),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniTotal(
                  context,
                  'Toplam Gider',
                  _store.formatAmount(_periodExpense),
                  const Color(0xFFF43F5E),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniTotal(
                  context,
                  'Net',
                  '${_periodCollected - _periodExpense >= 0 ? '+' : ''}${_store.formatAmount(_periodCollected - _periodExpense)}',
                  _periodCollected - _periodExpense >= 0
                      ? const Color(0xFF10B981)
                      : const Color(0xFFF43F5E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _FlowChart(buckets: buckets, formatAmount: _store.formatAmount),
        ],
      ),
    );
  }

  Widget _miniTotal(BuildContext context, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _rateCard(BuildContext context) {
    final rate = _periodRate;
    return AccountingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tahsilat Oranı'.tr,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Bu ${_periodNoun[_period]} beklenenin tahsil edilen oranı',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          Center(child: _RingGauge(value: rate)),
          const SizedBox(height: 16),
          _rateRow(context, Icons.savings_outlined, 'Tahsil edilen',
              _store.formatAmount(_periodCollected), const Color(0xFF10B981)),
          const SizedBox(height: 8),
          _rateRow(context, Icons.event_outlined, 'Bekleyen (vade)',
              _store.formatAmount(_periodUnpaidDue), const Color(0xFFB45309)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _miniTotal(context, 'Nakit',
                    _store.formatAmount(_periodCash), const Color(0xFF2563EB)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniTotal(context, 'Kart / Havale',
                    _store.formatAmount(_periodCardBank), const Color(0xFF7C3AED)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _rateRow(BuildContext context, IconData icon, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _goalCard(BuildContext context) {
    final rate = _periodRate;
    final prev = _prevCollected;
    final change = prev > 0
        ? (((_periodCollected - prev) / prev) * 100).round()
        : null;
    return AccountingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tahsilat Hedefi',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Bu ${_periodNoun[_period]} için beklenen hedef',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF7A1A).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.flag_outlined, color: Color(0xFFFF7A1A)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _store.formatAmount(_periodCollected),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: const Color(0xFFFF7A1A),
            ),
          ),
          Text(
            'Hedef: ${_store.formatAmount(_periodTarget)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: rate / 100,
              minHeight: 10,
              backgroundColor: Theme.of(context)
                  .colorScheme
                  .surfaceContainerHighest
                  .withValues(alpha: 0.5),
              valueColor: const AlwaysStoppedAnimation(Color(0xFFFF7A1A)),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('%$rate tamamlandı',
                  style: Theme.of(context).textTheme.bodySmall),
              Text('Kalan: ${_store.formatAmount(math.max(0, _periodTarget - _periodCollected))}',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _miniTotal(
                  context,
                  'Önceki ${_periodNoun[_period]}',
                  _store.formatAmount(prev),
                  const Color(0xFF64748B),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniTotal(
                  context,
                  'Değişim',
                  change == null ? '—' : '${change >= 0 ? '+' : ''}%$change',
                  change == null
                      ? const Color(0xFF64748B)
                      : change >= 0
                          ? const Color(0xFF10B981)
                          : const Color(0xFFF43F5E),
                ),
              ),
            ],
          ),
        ],
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

  Widget _operationQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                subtitle: 'Günlük ödeme planları'.tr,
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
                subtitle: 'Banka ve kasa denetimi'.tr,
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

  Widget _leftColumn(BuildContext context) {
    final collections = _periodCollections;
    final overdue = _overdueInstallments;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(context, 'Tahsilatlar', 'Tümünü Gör', () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AccountingReceiptsPage()),
          );
        }),
        const SizedBox(height: 12),
        AccountingPanel(
          child: collections.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text(
                    'Bu ${_periodNoun[_period]} tahsilat yok.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                )
              : Column(
                  children: collections.take(4).map((item) {
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
          child: overdue.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text(
                    'Geciken ödeme yok.'.tr,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                )
              : Column(
                  children: overdue.take(3).map((item) {
                    return _listRow(
                      context,
                      title: item.student,
                      subtitle: '${item.due} • geciken plan',
                      amount: item.amount,
                      color: const Color(0xFFB42318),
                      highlight: true,
                    );
                  }).toList(),
                ),
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

  List<_ModuleCard> _modules() => [
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
          'Toplu İşlem Merkezi',
          'Toplu tahsilat ve toplu mesaj akışı',
          Icons.groups_outlined,
          const Color(0xFF14532D),
          const AccountingBulkActionsPage(),
        ),
        _ModuleCard(
          'Makbuz Arşivi',
          'Tüm tahsilat belgelerine tek yerden erişim',
          Icons.folder_copy_outlined,
          const Color(0xFF7C3AED),
          const AccountingReceiptArchivePage(),
        ),
        _ModuleCard(
          'Gecikme Senaryoları',
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
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 5),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _FlowChart extends StatefulWidget {
  final List<_Bucket> buckets;
  final String Function(int) formatAmount;

  const _FlowChart({required this.buckets, required this.formatAmount});

  @override
  State<_FlowChart> createState() => _FlowChartState();
}

class _FlowChartState extends State<_FlowChart> {
  int? _selected;

  @override
  Widget build(BuildContext context) {
    final buckets = widget.buckets;
    final theme = Theme.of(context);
    if (buckets.isEmpty || buckets.every((b) => b.income == 0 && b.expense == 0)) {
      return Container(
        height: 150,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
        ),
        child: Text('Bu dönem için veri yok.'.tr,
            style: theme.textTheme.bodyMedium),
      );
    }

    final maxValue = math.max(
      1,
      buckets
          .map((b) => math.max(b.income, b.expense))
          .fold<int>(1, math.max),
    );
    final selected = _selected != null && _selected! < buckets.length
        ? buckets[_selected!]
        : null;

    return Column(
      children: [
        SizedBox(
          height: 180,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return GestureDetector(
                onTapDown: (details) {
                  final ratio = details.localPosition.dx / constraints.maxWidth;
                  final index = (ratio * buckets.length)
                      .floor()
                      .clamp(0, buckets.length - 1);
                  setState(() => _selected = index);
                },
                child: CustomPaint(
                  size: Size(constraints.maxWidth, 180),
                  painter: _FlowChartPainter(
                    buckets: buckets,
                    maxValue: maxValue.toDouble(),
                    selectedIndex: _selected,
                    gridColor: theme.dividerColor.withValues(alpha: 0.4),
                    labelColor: theme.textTheme.bodySmall?.color ??
                        Colors.grey,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        if (selected != null)
          _detailCard(context, selected)
        else
          Text(
            'Detay için bir sütuna dokun.'.tr,
            style: theme.textTheme.bodySmall,
          ),
      ],
    );
  }

  Widget _detailCard(BuildContext context, _Bucket bucket) {
    final theme = Theme.of(context);
    final net = bucket.net;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF020B1F).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(bucket.fullLabel,
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          _detailRow(context, '↑ Ne geldi',
              widget.formatAmount(bucket.income), const Color(0xFF10B981)),
          _detailRow(context, '↓ Ne gitti',
              widget.formatAmount(bucket.expense), const Color(0xFFF43F5E)),
          const Divider(height: 16),
          _detailRow(context, '• Maaş gideri',
              widget.formatAmount(bucket.salary), theme.textTheme.bodySmall?.color),
          _detailRow(context, '• Fatura gideri',
              widget.formatAmount(bucket.invoice), theme.textTheme.bodySmall?.color),
          _detailRow(context, '• Tahsilat adedi', '${bucket.count} işlem',
              theme.textTheme.bodySmall?.color),
          const Divider(height: 16),
          _detailRow(
            context,
            'Net',
            '${net >= 0 ? '+' : ''}${widget.formatAmount(net)}',
            net >= 0 ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
            bold: true,
          ),
        ],
      ),
    );
  }

  Widget _detailRow(BuildContext context, String label, String value, Color? color,
      {bool bold = false}) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
              )),
          Text(value,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: color,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
              )),
        ],
      ),
    );
  }
}

class _FlowChartPainter extends CustomPainter {
  final List<_Bucket> buckets;
  final double maxValue;
  final int? selectedIndex;
  final Color gridColor;
  final Color labelColor;

  _FlowChartPainter({
    required this.buckets,
    required this.maxValue,
    required this.selectedIndex,
    required this.gridColor,
    required this.labelColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const padBottom = 22.0;
    const padTop = 6.0;
    final plotH = size.height - padBottom - padTop;
    final slot = size.width / buckets.length;
    final barW = (slot * 0.28).clamp(3.0, 18.0);

    // Izgara çizgileri
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final y = padTop + plotH * (i / 4);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final incomePaint = Paint()..color = const Color(0xFF10B981);
    final expensePaint = Paint()..color = const Color(0xFFF43F5E);

    for (var i = 0; i < buckets.length; i++) {
      final bucket = buckets[i];
      final cx = slot * i + slot / 2;

      if (selectedIndex == i) {
        final hl = Paint()..color = const Color(0xFFFF7A1A).withValues(alpha: 0.1);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(slot * i + 2, padTop, slot - 4, plotH),
            const Radius.circular(8),
          ),
          hl,
        );
      }

      final incomeH = (bucket.income / maxValue) * plotH;
      final expenseH = (bucket.expense / maxValue) * plotH;
      final baseY = padTop + plotH;

      _bar(canvas, cx - barW - 1, baseY, barW, incomeH, incomePaint);
      _bar(canvas, cx + 1, baseY, barW, expenseH, expensePaint);

      // X etiketi
      final tp = TextPainter(
        text: TextSpan(
          text: bucket.label,
          style: TextStyle(color: labelColor, fontSize: 9),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(cx - tp.width / 2, size.height - padBottom + 6));
    }
  }

  void _bar(Canvas canvas, double left, double baseY, double w, double h, Paint paint) {
    final height = math.max(2.0, h);
    final rect = RRect.fromRectAndCorners(
      Rect.fromLTWH(left, baseY - height, w, height),
      topLeft: const Radius.circular(3),
      topRight: const Radius.circular(3),
    );
    canvas.drawRRect(rect, paint);
  }

  @override
  bool shouldRepaint(covariant _FlowChartPainter oldDelegate) {
    return oldDelegate.buckets != buckets ||
        oldDelegate.selectedIndex != selectedIndex ||
        oldDelegate.maxValue != maxValue;
  }
}

class _RingGauge extends StatelessWidget {
  final int value;

  const _RingGauge({required this.value});

  @override
  Widget build(BuildContext context) {
    final tone = value >= 80
        ? const Color(0xFF10B981)
        : value >= 50
            ? const Color(0xFFF59E0B)
            : const Color(0xFFF43F5E);
    return SizedBox(
      width: 140,
      height: 140,
      child: CustomPaint(
        painter: _RingGaugePainter(
          value: value / 100,
          color: tone,
          trackColor: Theme.of(context).dividerColor.withValues(alpha: 0.35),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '%$value',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  color: tone,
                ),
              ),
              Text(
                'Tahsilat',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingGaugePainter extends CustomPainter {
  final double value;
  final Color color;
  final Color trackColor;

  _RingGaugePainter({
    required this.value,
    required this.color,
    required this.trackColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 9;
    const startAngle = math.pi * 0.75;
    const sweepAngle = math.pi * 1.5;

    final track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    final progress = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawArc(rect, startAngle, sweepAngle, false, track);
    canvas.drawArc(rect, startAngle, sweepAngle * value.clamp(0, 1), false, progress);
  }

  @override
  bool shouldRepaint(covariant _RingGaugePainter oldDelegate) {
    return oldDelegate.value != value || oldDelegate.color != color;
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
