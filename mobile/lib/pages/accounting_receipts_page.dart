import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/responsive_overlays.dart';

const _monthOptions = <String, String>{
  'all': 'Tüm Aylar',
  '1': 'Ocak',
  '2': 'Şubat',
  '3': 'Mart',
  '4': 'Nisan',
  '5': 'Mayıs',
  '6': 'Haziran',
  '7': 'Temmuz',
  '8': 'Ağustos',
  '9': 'Eylül',
  '10': 'Ekim',
  '11': 'Kasım',
  '12': 'Aralık',
};

DateTime? _parseFinanceDate(String value) {
  final raw = value.trim();
  if (raw.isEmpty) return null;

  final trMatch = RegExp(r'(\d{1,2})\.(\d{1,2})\.(\d{4})').firstMatch(raw);
  if (trMatch != null) {
    return DateTime(
      int.parse(trMatch.group(3)!),
      int.parse(trMatch.group(2)!),
      int.parse(trMatch.group(1)!),
    );
  }

  final isoMatch = RegExp(r'(\d{4})-(\d{1,2})-(\d{1,2})').firstMatch(raw);
  if (isoMatch != null) {
    return DateTime(
      int.parse(isoMatch.group(1)!),
      int.parse(isoMatch.group(2)!),
      int.parse(isoMatch.group(3)!),
    );
  }

  return DateTime.tryParse(raw);
}

bool _monthMatches(String value, String monthFilter) {
  if (monthFilter == 'all') return true;
  final date = _parseFinanceDate(value);
  return date != null && date.month == int.tryParse(monthFilter);
}

class AccountingReceiptsPage extends StatefulWidget {
  const AccountingReceiptsPage({super.key});

  @override
  State<AccountingReceiptsPage> createState() => _AccountingReceiptsPageState();
}

class _AccountingReceiptsPageState extends State<AccountingReceiptsPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;
  final StudentRegistryStore _studentStore = StudentRegistryStore.instance;
  String _viewMode = 'received';
  String _monthFilter = 'all';

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _studentStore.addListener(_refresh);
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
    _studentStore.ensureLoaded();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _studentStore.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredCollections = _store.collections
        .where((item) => _monthMatches(item.time, _monthFilter))
        .toList();
    final filteredPlans = _store.installments
        .where((item) => _monthMatches(item.due, _monthFilter))
        .toList();
    final visibleTotal = _viewMode == 'planned'
        ? filteredPlans.fold<int>(
            0,
            (sum, item) => sum + _plannedCollectionAmount(item),
          )
        : filteredCollections.fold<int>(
            0,
            (sum, item) => sum + _store.parseAmount(item.amount),
          );
    final visibleCount = _viewMode == 'planned'
        ? filteredPlans.length
        : filteredCollections.length;

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Tahsilatlar',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewCollectionSheet,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Yeni Tahsilat'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Tahsilat merkezi',
            title:
                'Ödeme hareketlerini tek ekranda yönetin ve yeni tahsilatı güvenli akışla tamamlayın.'.tr,
            description:
                'Kart, havale, nakit ve POS tahsilatları için hızlı giriş ve makbuz üretimi hazır.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(
                label: 'Toplam',
                value: _store.formatAmount(visibleTotal),
              ),
              AccountingHeroMetric(label: 'İşlem'.tr, value: '$visibleCount'),
            ],
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                AccountingFilterChip(
                  label: 'Alınan Tahsilatlar'.tr,
                  selected: _viewMode == 'received',
                  onTap: () => setState(() => _viewMode = 'received'),
                ),
                const SizedBox(width: 8),
                AccountingFilterChip(
                  label: 'Planlanan Tahsilatlar',
                  selected: _viewMode == 'planned',
                  onTap: () => setState(() => _viewMode = 'planned'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _monthFilter,
            decoration: const InputDecoration(
              labelText: 'Ay filtresi',
              border: OutlineInputBorder(),
            ),
            items: _monthOptions.entries
                .map(
                  (entry) => DropdownMenuItem(
                    value: entry.key,
                    child: Text(entry.value),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _monthFilter = value ?? 'all'),
          ),
          const SizedBox(height: 16),
          _summaryCard(context, visibleTotal, visibleCount),
          const SizedBox(height: 16),
          if (_viewMode == 'received' && filteredCollections.isEmpty)
            AccountingPanel(
              child: Text('Seçili ayda alınan tahsilat bulunamadı.'.tr),
            ),
          if (_viewMode == 'planned' && filteredPlans.isEmpty)
            AccountingPanel(
              child: Text('Seçili ayda planlanan tahsilat bulunamadı.'.tr),
            ),
          if (_viewMode == 'received')
            ...filteredCollections.map((item) => _collectionCard(context, item))
          else
            ...filteredPlans.map(
              (item) => _plannedCollectionCard(context, item),
            ),
        ],
      ),
    );
  }

  Widget _summaryCard(BuildContext context, int total, int count) {
    return AccountingPanel(
      child: Row(
        children: [
          Expanded(
            child: _summaryItem(context, 'Toplam', _store.formatAmount(total)),
          ),
          Expanded(child: _summaryItem(context, 'İşlem', '$count')),
          Expanded(
            child: _summaryItem(
              context,
              'Ortalama',
              count == 0 ? '₺0' : _store.formatAmount(total ~/ count),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryItem(BuildContext context, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 6),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
      ],
    );
  }

  Widget _collectionCard(BuildContext context, CollectionRecord item) {
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _openCollectionActions(item),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.payments_outlined,
                color: Color(0xFF15803D),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.className} • ${item.method} • ${item.time}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  item.amount,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF15803D),
                  ),
                ),
                const SizedBox(height: 6),
                const Icon(Icons.more_horiz_rounded),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _plannedCollectionCard(BuildContext context, InstallmentRecord item) {
    final amount = _plannedCollectionAmount(item);
    final isPaid = item.status == 'Ödendi';
    final color = isPaid ? const Color(0xFF0F766E) : const Color(0xFFB45309);
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.event_available_outlined, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.student,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.status} • Vade: ${item.due}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _store.formatAmount(amount),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
              const SizedBox(height: 6),
              FilledButton.tonal(
                onPressed: isPaid
                    ? null
                    : () => _showNewCollectionSheet(prefillPlan: item),
                child: const Text('Tahsilat Al'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openCollectionActions(CollectionRecord item) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(
              leading: const Icon(
                Icons.edit_outlined,
                color: Color(0xFF2563EB),
              ),
              title: Text('Tahsilatı Düzenle'.tr),
              onTap: () {
                Navigator.pop(context);
                _showEditCollectionSheet(item);
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.delete_outline_rounded,
                color: Color(0xFFDC2626),
              ),
              title: Text('Tahsilatı Sil'.tr),
              onTap: () async {
                final messenger = ScaffoldMessenger.of(this.context);
                Navigator.pop(context);
                await _store.deleteCollection(item.id);
                if (!mounted) return;
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Tahsilat silindi.'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEditCollectionSheet(CollectionRecord item) {
    final amountController = TextEditingController(
      text: item.amount.replaceAll('₺', '').trim(),
    );
    final noteController = TextEditingController(text: item.note);
    var selectedMethod = item.method;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) => ResponsiveSheetContainer(
            child: Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              padding: EdgeInsets.fromLTRB(
                16,
                8,
                16,
                MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(30),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Tutar',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: selectedMethod,
                    decoration: InputDecoration(
                      labelText: 'Ödeme Türü'.tr,
                      border: OutlineInputBorder(),
                    ),
                    items: const ['Kredi Kartı', 'Havale/EFT', 'Nakit']
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setSheetState(
                      () => selectedMethod = value ?? selectedMethod,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Not',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () async {
                        final messenger = ScaffoldMessenger.of(this.context);
                        final navigator = Navigator.of(sheetContext);
                        await _store.updateCollection(
                          id: item.id,
                          name: item.name,
                          className: item.className,
                          amount: amountController.text.trim(),
                          method: selectedMethod,
                          note: noteController.text.trim(),
                        );
                        if (!mounted) return;
                        navigator.pop();
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text('Tahsilat güncellendi.'.tr),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      },
                      child: const Text('Kaydet'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  int _plannedCollectionAmount(InstallmentRecord plan) {
    final remainingMatch = RegExp(
      r'Kalan\s+(.+)$',
      caseSensitive: false,
    ).firstMatch(plan.note);
    if (remainingMatch != null) {
      return _store.parseAmount(remainingMatch.group(1)!);
    }
    if (plan.status == 'Ödendi') return 0;
    return _store.parseAmount(plan.amount);
  }

  void _showNewCollectionSheet({InstallmentRecord? prefillPlan}) {
    final studentOptions = _studentStore.students;
    String selectedStudent =
        prefillPlan?.student ?? studentOptions.firstOrNull?.fullName ?? '';
    String selectedClass =
        studentOptions
            .where((item) => item.fullName == selectedStudent)
            .firstOrNull
            ?.className ??
        '';
    bool hasSelectedStudentOption = studentOptions.any(
      (item) => item.fullName == selectedStudent,
    );
    String selectedMethod = prefillPlan == null ? 'Kredi Kartı' : 'Nakit';
    final amountController = TextEditingController(
      text: prefillPlan == null
          ? ''
          : _plannedCollectionAmount(prefillPlan).toString(),
    );
    final noteController = TextEditingController(
      text: prefillPlan == null
          ? ''
          : (prefillPlan.note.isNotEmpty
                ? prefillPlan.note
                : 'Taksit tahsilatı • ${prefillPlan.due}'),
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return ResponsiveSheetContainer(
              child: Container(
                margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                padding: EdgeInsets.fromLTRB(
                  16,
                  8,
                  16,
                  MediaQuery.of(context).viewInsets.bottom + 24,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(30),
                  ),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AccountingHeroCard(
                        eyebrow: 'Yeni kayıt',
                        title:
                            'Tahsilatı hızlı ama kontrollü şekilde oluşturun.'.tr,
                        description:
                            'Öğrenci, tutar ve ödeme yöntemi seçildikten sonra kayıt onay ekranına alınır.',
                        colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
                        metrics: [
                          AccountingHeroMetric(label: 'Akış'.tr, value: '2 adım'),
                          AccountingHeroMetric(
                            label: 'Makbuz',
                            value: 'QR hazır',
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      AccountingPanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Tahsilat formu',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              initialValue: hasSelectedStudentOption
                                  ? selectedStudent
                                  : null,
                              decoration: InputDecoration(
                                labelText: 'Öğrenci'.tr,
                                border: OutlineInputBorder(),
                              ),
                              items: studentOptions
                                  .map(
                                    (value) => DropdownMenuItem(
                                      value: value.fullName,
                                      child: Text(value.fullName),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) => setSheetState(() {
                                selectedStudent = value ?? selectedStudent;
                                hasSelectedStudentOption = studentOptions.any(
                                  (item) => item.fullName == selectedStudent,
                                );
                                final student = studentOptions
                                    .where(
                                      (item) =>
                                          item.fullName == selectedStudent,
                                    )
                                    .firstOrNull;
                                selectedClass = student?.className ?? '';
                              }),
                            ),
                            const SizedBox(height: 12),
                            InputDecorator(
                              decoration: InputDecoration(
                                labelText: 'Sınıf'.tr,
                                border: OutlineInputBorder(),
                              ),
                              child: Text(
                                selectedClass.isEmpty
                                    ? 'Sınıf bilgisi yok'
                                    : selectedClass,
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: amountController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Tutar',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: selectedMethod,
                              decoration: InputDecoration(
                                labelText: 'Ödeme Türü'.tr,
                                border: OutlineInputBorder(),
                              ),
                              items:
                                  const ['Kredi Kartı', 'Havale/EFT', 'Nakit']
                                      .map(
                                        (value) => DropdownMenuItem(
                                          value: value,
                                          child: Text(value),
                                        ),
                                      )
                                      .toList(),
                              onChanged: (value) => setSheetState(
                                () => selectedMethod = value ?? selectedMethod,
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: noteController,
                              maxLines: 3,
                              decoration: const InputDecoration(
                                labelText: 'Not',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: selectedStudent.isEmpty
                                    ? null
                                    : () => _confirmCollection(
                                        sheetContext,
                                        selectedStudent,
                                        selectedClass,
                                        amountController.text,
                                        selectedMethod,
                                        noteController.text,
                                      ),
                                child: Text('Tahsilatı Tamamla'.tr),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _confirmCollection(
    BuildContext sheetContext,
    String student,
    String className,
    String amount,
    String method,
    String note,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: ResponsiveDialogContainer(
            maxWidth: 420,
            child: AccountingPanel(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEDD5),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.rule_folder_outlined,
                          color: Color(0xFFB45309),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Tahsilatı onaylayın'.tr,
                          style: Theme.of(dialogContext).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    '$student için ₺$amount tutarında $method tahsilatı oluşturulacak.',
                    style: Theme.of(
                      dialogContext,
                    ).textTheme.bodyMedium?.copyWith(height: 1.45),
                  ),
                  const SizedBox(height: 14),
                  AccountingPanel(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        _summaryLine('Öğrenci', student),
                        _summaryLine('Sınıf', className),
                        _summaryLine('Tutar', '₺$amount'),
                        _summaryLine('Yöntem', method),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(dialogContext),
                          child: Text('Vazgeç'.tr),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () async {
                            Navigator.pop(dialogContext);
                            if (sheetContext.mounted) {
                              Navigator.pop(sheetContext);
                            }
                            if (!mounted) return;
                            try {
                              await _store.addCollection(
                                name: student,
                                className: className,
                                amount: amount,
                                method: method == 'Kredi Kartı'
                                    ? 'Kredi Karti'
                                    : method,
                                note: note,
                              );
                              if (!mounted) return;
                              _showSuccessDialog(student, amount, method);
                            } catch (error) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(error.toString())),
                              );
                            }
                          },
                          child: const Text('Evet'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _summaryLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  void _showSuccessDialog(String student, String amount, String method) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 24,
            vertical: 24,
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: Center(
            child: ResponsiveDialogContainer(
              maxWidth: 380,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Theme.of(dialogContext).cardColor,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.14),
                      blurRadius: 28,
                      offset: const Offset(0, 16),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0.8, end: 1),
                        duration: const Duration(milliseconds: 350),
                        builder: (context, value, child) =>
                            Transform.scale(scale: value, child: child),
                        child: Container(
                          width: 66,
                          height: 66,
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1FAE5),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Icon(
                            Icons.check_rounded,
                            color: Color(0xFF047857),
                            size: 34,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Başarılı Tahsilat'.tr,
                        style: Theme.of(dialogContext).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$student için ₺$amount tahsil edildi.\n$method',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: 120,
                        height: 120,
                        child: QrImageView(
                          data: 'receipt:$student:$amount:$method',
                          version: QrVersions.auto,
                          size: 120,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        alignment: WrapAlignment.center,
                        children: [
                          FilledButton.tonalIcon(
                            onPressed: () {
                              Navigator.pop(dialogContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Tahsilat özeti paylaşıma hazırlandı.'.tr,
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                            icon: const Icon(Icons.share_outlined),
                            label: Text('Paylaş'.tr),
                          ),
                          FilledButton.tonalIcon(
                            onPressed: () {
                              Navigator.pop(dialogContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Makbuz PDF olarak indirildi.'),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                            icon: const Icon(Icons.picture_as_pdf_outlined),
                            label: Text('Makbuzu PDF İndir'.tr),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
