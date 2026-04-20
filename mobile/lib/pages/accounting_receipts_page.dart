import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/responsive_overlays.dart';

class AccountingReceiptsPage extends StatefulWidget {
  const AccountingReceiptsPage({super.key});

  @override
  State<AccountingReceiptsPage> createState() => _AccountingReceiptsPageState();
}

class _AccountingReceiptsPageState extends State<AccountingReceiptsPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;
  final StudentRegistryStore _studentStore = StudentRegistryStore.instance;

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
                'Ödeme hareketlerini tek ekranda yönetin ve yeni tahsilatı güvenli akışla tamamlayın.',
            description:
                'Kart, havale, nakit ve POS tahsilatları için hızlı giriş ve makbuz üretimi hazır.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(
                label: 'Toplam',
                value: _store.formatAmount(_store.collectedTotal),
              ),
              AccountingHeroMetric(
                label: 'İşlem',
                value: '${_store.collections.length}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          _summaryCard(context),
          const SizedBox(height: 16),
          ..._store.collections.map((item) => _collectionCard(context, item)),
        ],
      ),
    );
  }

  Widget _summaryCard(BuildContext context) {
    return AccountingPanel(
      child: Row(
        children: [
          Expanded(
            child: _summaryItem(
              context,
              'Toplam',
              _store.formatAmount(_store.collectedTotal),
            ),
          ),
          Expanded(
            child: _summaryItem(
              context,
              'İşlem',
              '${_store.collections.length}',
            ),
          ),
          Expanded(
            child: _summaryItem(
              context,
              'Ortalama',
              _store.collections.isEmpty
                  ? '₺0'
                  : _store.formatAmount(
                      _store.collectedTotal ~/ _store.collections.length,
                    ),
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
              title: const Text('Tahsilatı Düzenle'),
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
              title: const Text('Tahsilatı Sil'),
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
                    decoration: const InputDecoration(
                      labelText: 'Ödeme Türü',
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
                          const SnackBar(
                            content: Text('Tahsilat güncellendi.'),
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

  void _showNewCollectionSheet() {
    final studentOptions = _studentStore.students;
    String selectedStudent = studentOptions.firstOrNull?.fullName ?? '';
    String selectedClass = studentOptions.firstOrNull?.className ?? '';
    String selectedMethod = 'Kredi Kartı';
    final amountController = TextEditingController();
    final noteController = TextEditingController();

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
                      const AccountingHeroCard(
                        eyebrow: 'Yeni kayıt',
                        title:
                            'Tahsilatı hızlı ama kontrollü şekilde oluşturun.',
                        description:
                            'Öğrenci, tutar ve ödeme yöntemi seçildikten sonra kayıt onay ekranına alınır.',
                        colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
                        metrics: [
                          AccountingHeroMetric(label: 'Akış', value: '2 adım'),
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
                              initialValue: selectedStudent,
                              decoration: const InputDecoration(
                                labelText: 'Öğrenci',
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
                              decoration: const InputDecoration(
                                labelText: 'Sınıf',
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
                              decoration: const InputDecoration(
                                labelText: 'Ödeme Türü',
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
                                child: const Text('Tahsilatı Tamamla'),
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
                          'Tahsilatı onaylayın',
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
                          child: const Text('Vazgeç'),
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
                        'Başarılı Tahsilat',
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
                                const SnackBar(
                                  content: Text(
                                    'Tahsilat özeti paylaşıma hazırlandı.',
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                            icon: const Icon(Icons.share_outlined),
                            label: const Text('Paylaş'),
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
                            label: const Text('Makbuzu PDF İndir'),
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
