import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingCollectionCalendarPage extends StatefulWidget {
  const AccountingCollectionCalendarPage({super.key});

  @override
  State<AccountingCollectionCalendarPage> createState() =>
      _AccountingCollectionCalendarPageState();
}

class _AccountingCollectionCalendarPageState
    extends State<AccountingCollectionCalendarPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;

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
    final monthlyPlans = _buildMonthlyPlans();

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Tahsilat Takvimi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Aylık tahsilat görünümü',
            title:
                'Her ay için planlanan ve gerçekleşen tahsilatları öğrenci bazında izleyin.',
            description:
                'Tarih, öğrenci adı, tahsil edilen tutar ve tahsil edilmediyse durum bilgisi aynı akışta gösterilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0EA5E9)],
            metrics: [
              AccountingHeroMetric(
                label: 'Ay',
                value: '${monthlyPlans.length}',
              ),
              AccountingHeroMetric(
                label: 'Tahsil Edildi',
                value: '${_store.collections.length}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (monthlyPlans.isEmpty)
            const AccountingPanel(
              child: Text(
                'Henüz gösterilecek tahsilat veya taksit kaydı bulunmuyor.',
              ),
            )
          else
            ...monthlyPlans.map((section) => _monthSection(context, section)),
        ],
      ),
    );
  }

  Widget _monthSection(
    BuildContext context,
    _MonthlyCollectionSection section,
  ) {
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.calendar_month_rounded,
                  color: Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      section.monthLabel,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${section.paidCount} tahsil edildi • ${section.unpaidCount} tahsil edilmedi',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...section.rows.map((row) => _calendarRow(context, row)),
        ],
      ),
    );
  }

  Widget _calendarRow(BuildContext context, _CalendarRow row) {
    final isPaid = row.isPaid;
    final color = isPaid ? const Color(0xFF15803D) : const Color(0xFFB42318);
    final background = isPaid
        ? const Color(0xFFDCFCE7)
        : const Color(0xFFFEE4E2);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPaid ? Icons.check_rounded : Icons.schedule_rounded,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.studentName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '${row.dateLabel} • ${row.statusLabel}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  row.detailLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                row.amountLabel,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
              if (row.secondaryAmountLabel.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  row.secondaryAmountLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  List<_MonthlyCollectionSection> _buildMonthlyPlans() {
    final rowsByMonth = <String, List<_CalendarRow>>{};
    final collectionsByMonthAndStudent = <String, List<CollectionRecord>>{};

    for (final collection in _store.collections) {
      final parsed = _parseDate(collection.time);
      if (parsed == null) {
        continue;
      }
      final monthKey = _monthKey(parsed);
      final mapKey = '$monthKey::${collection.name.trim().toLowerCase()}';
      collectionsByMonthAndStudent
          .putIfAbsent(mapKey, () => [])
          .add(collection);
    }

    for (final installment in _store.installments) {
      final dueDate = _parseDate(installment.due);
      if (dueDate == null) {
        continue;
      }

      final monthKey = _monthKey(dueDate);
      final collectionKey =
          '$monthKey::${installment.student.trim().toLowerCase()}';
      final matchedCollections = [
        ...?collectionsByMonthAndStudent[collectionKey],
      ]..sort((a, b) => _compareDatesDesc(a.time, b.time));

      final latestCollection = matchedCollections.isEmpty
          ? null
          : matchedCollections.first;
      final isPaid = latestCollection != null;

      rowsByMonth
          .putIfAbsent(monthKey, () => [])
          .add(
            _CalendarRow(
              studentName: installment.student,
              dateLabel: isPaid
                  ? _safeDateLabel(latestCollection.time)
                  : _safeDateLabel(installment.due),
              statusLabel: isPaid ? 'Tahsil edildi' : 'Tahsil edilmedi',
              amountLabel: isPaid
                  ? latestCollection.amount
                  : installment.amount,
              secondaryAmountLabel: isPaid ? 'Plan: ${installment.amount}' : '',
              detailLabel: isPaid
                  ? '${latestCollection.method} ile tahsil edildi'
                  : 'Vade tarihi geçti, tahsilat kaydı bulunmuyor.',
              isPaid: isPaid,
            ),
          );
    }

    final sections = rowsByMonth.entries.map((entry) {
      final rows = [...entry.value]..sort((a, b) => _compareCalendarRows(a, b));
      return _MonthlyCollectionSection(
        monthKey: entry.key,
        monthLabel: _monthLabel(entry.key),
        rows: rows,
      );
    }).toList()..sort((a, b) => b.monthKey.compareTo(a.monthKey));

    return sections;
  }

  int _compareCalendarRows(_CalendarRow a, _CalendarRow b) {
    final dateCompare = _compareDatesAsc(a.dateLabel, b.dateLabel);
    if (dateCompare != 0) {
      return dateCompare;
    }
    return a.studentName.compareTo(b.studentName);
  }

  int _compareDatesAsc(String left, String right) {
    final leftDate = _parseDate(left);
    final rightDate = _parseDate(right);
    if (leftDate == null && rightDate == null) {
      return left.compareTo(right);
    }
    if (leftDate == null) {
      return 1;
    }
    if (rightDate == null) {
      return -1;
    }
    return leftDate.compareTo(rightDate);
  }

  int _compareDatesDesc(String left, String right) =>
      _compareDatesAsc(right, left);

  DateTime? _parseDate(String raw) {
    final text = raw.trim();
    if (text.isEmpty) {
      return null;
    }

    final sanitized = text.split(' ').first;
    final dottedParts = sanitized.split('.');
    if (dottedParts.length == 3) {
      final day = int.tryParse(dottedParts[0]);
      final month = int.tryParse(dottedParts[1]);
      final year = int.tryParse(dottedParts[2]);
      if (day != null && month != null && year != null) {
        return DateTime(year, month, day);
      }
    }

    final dashedParts = sanitized.split('-');
    if (dashedParts.length == 3) {
      final year = int.tryParse(dashedParts[0]);
      final month = int.tryParse(dashedParts[1]);
      final day = int.tryParse(dashedParts[2]);
      if (day != null && month != null && year != null) {
        return DateTime(year, month, day);
      }
    }

    return null;
  }

  String _monthKey(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    return '${date.year}-$month';
  }

  String _monthLabel(String monthKey) {
    final parts = monthKey.split('-');
    if (parts.length != 2) {
      return monthKey;
    }
    const monthNames = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Hazıran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    if (year == null || month == null || month < 1 || month > 12) {
      return monthKey;
    }
    return '${monthNames[month - 1]} $year';
  }

  String _safeDateLabel(String value) {
    final parsed = _parseDate(value);
    if (parsed == null) {
      return value;
    }
    final day = parsed.day.toString().padLeft(2, '0');
    final month = parsed.month.toString().padLeft(2, '0');
    return '$day.$month.${parsed.year}';
  }
}

class _MonthlyCollectionSection {
  final String monthKey;
  final String monthLabel;
  final List<_CalendarRow> rows;

  const _MonthlyCollectionSection({
    required this.monthKey,
    required this.monthLabel,
    required this.rows,
  });

  int get paidCount => rows.where((row) => row.isPaid).length;
  int get unpaidCount => rows.where((row) => !row.isPaid).length;
}

class _CalendarRow {
  final String studentName;
  final String dateLabel;
  final String statusLabel;
  final String detailLabel;
  final String amountLabel;
  final String secondaryAmountLabel;
  final bool isPaid;

  const _CalendarRow({
    required this.studentName,
    required this.dateLabel,
    required this.statusLabel,
    required this.detailLabel,
    required this.amountLabel,
    required this.secondaryAmountLabel,
    required this.isPaid,
  });
}
