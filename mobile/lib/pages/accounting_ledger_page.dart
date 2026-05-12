import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingLedgerPage extends StatefulWidget {
  const AccountingLedgerPage({super.key});

  @override
  State<AccountingLedgerPage> createState() => _AccountingLedgerPageState();
}

class _AccountingLedgerPageState extends State<AccountingLedgerPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;
  final StudentRegistryStore _studentStore = StudentRegistryStore.instance;
  String _selectedClass = 'Tümü';
  String _selectedStatus = 'Tümü';
  final TextEditingController _searchController = TextEditingController();

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
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = _buildStudents();
    final classes = [
      'Tümü',
      ...{for (final student in students) student['class']!},
    ];
    final filtered = students.where((student) {
      final matchesClass =
          _selectedClass == 'Tümü' || student['class'] == _selectedClass;
      final matchesStatus =
          _selectedStatus == 'Tümü' || student['status'] == _selectedStatus;
      final query = _searchController.text.trim().toLowerCase();
      final matchesSearch =
          query.isEmpty || student['name']!.toLowerCase().contains(query);
      return matchesClass && matchesStatus && matchesSearch;
    }).toList();

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Öğrenci Cari Hesapları'),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            AccountingHeroCard(
              eyebrow: 'Cari görünüm',
              title:
                  'Öğrenci bakiyelerini sınıf, durum ve kalan tutara göre yönetin.',
              description:
                  'Cari hesap listesi günlük tahsilat ve risk durumuna göre filtrelenebilir.',
              colors: const [Color(0xFF0F172A), Color(0xFF1D4ED8)],
              metrics: [
                AccountingHeroMetric(
                  label: 'Açık Bakiye',
                  value: _store.formatAmount(
                    filtered.fold<int>(
                      0,
                      (sum, item) =>
                          sum + _store.parseAmount(item['remaining']!),
                    ),
                  ),
                ),
                AccountingHeroMetric(
                  label: 'Tamamlanan',
                  value:
                      '${filtered.where((item) => item['status'] == 'Tamamlandı').length} öğrenci',
                ),
              ],
            ),
            const SizedBox(height: 16),
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
            _filterCard(context, classes),
            const SizedBox(height: 16),
            ...filtered.map((student) => _ledgerCard(context, student)),
          ],
        ),
      ),
    );
  }

  Widget _filterCard(BuildContext context, List<String> classes) {
    return AccountingPanel(
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Öğrenci ara',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedClass,
                  decoration: const InputDecoration(
                    labelText: 'Sınıf',
                    border: OutlineInputBorder(),
                  ),
                  items: classes
                      .map(
                        (value) =>
                            DropdownMenuItem(value: value, child: Text(value)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _selectedClass = value ?? 'Tümü'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedStatus,
                  decoration: const InputDecoration(
                    labelText: 'Durum',
                    border: OutlineInputBorder(),
                  ),
                  items: const ['Tümü', 'Aktif', 'Tamamlandı', 'Gecikmeli']
                      .map(
                        (value) =>
                            DropdownMenuItem(value: value, child: Text(value)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _selectedStatus = value ?? 'Tümü'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ledgerCard(BuildContext context, Map<String, String> student) {
    final statusColor = switch (student['status']) {
      'Tamamlandı' => const Color(0xFF0F766E),
      'Gecikmeli' => const Color(0xFFB42318),
      _ => const Color(0xFF2563EB),
    };

    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  student['name']!,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              Chip(
                label: Text(student['status']!),
                side: BorderSide.none,
                backgroundColor: statusColor.withValues(alpha: 0.12),
                labelStyle: TextStyle(color: statusColor),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(student['class']!, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _moneyTile(
                  context,
                  'Toplam Ücret',
                  student['total']!,
                  const Color(0xFF1D4ED8),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _moneyTile(
                  context,
                  'Ödenen',
                  student['paid']!,
                  const Color(0xFF0F766E),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _moneyTile(
                  context,
                  'Kalan',
                  student['remaining']!,
                  const Color(0xFFB45309),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _moneyTile(
    BuildContext context,
    String title,
    String value,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  List<Map<String, String>> _buildStudents() {
    final studentKeys = <String, StudentRegistryRecord>{};
    for (final student in _studentStore.students) {
      studentKeys[_normalizeLedgerKey(student.fullName)] = student;
      studentKeys[_normalizeLedgerKey(student.username)] = student;
    }

    final names = <String>{
      ..._studentStore.students.map((item) => item.fullName),
      ..._store.collections.map((item) => item.name),
      ..._store.installments.map((item) => item.student),
    };

    final rows = names.map((name) {
      final registryStudent = studentKeys[_normalizeLedgerKey(name)];
      final studentCollections = _store.collections
          .where(
            (item) => _matchesLedgerStudent(item.name, name, registryStudent),
          )
          .toList();
      final studentInstallments = _store.installments
          .where(
            (item) =>
                _matchesLedgerStudent(item.student, name, registryStudent),
          )
          .toList();
      final className =
          registryStudent?.className ??
          studentCollections.map((item) => item.className).firstOrNull ??
          'Genel';
      final paid = studentCollections.fold<int>(
        0,
        (sum, item) => sum + _store.parseAmount(item.amount),
      );
      final planned = studentInstallments.fold<int>(
        0,
        (sum, item) => sum + _store.parseAmount(item.amount),
      );
      final remainingValue = planned - paid;
      final overdue = studentInstallments.any(
        (item) => item.status == 'Geciken',
      );
      final status = overdue
          ? 'Gecikmeli'
          : remainingValue <= 0 && planned > 0
          ? 'Tamamlandı'
          : 'Aktif';

      return {
        'name': registryStudent?.fullName ?? name,
        'class': className,
        'total': _store.formatAmount(planned),
        'paid': _store.formatAmount(paid),
        'remaining': _store.formatAmount(
          remainingValue < 0 ? 0 : remainingValue,
        ),
        'status': status,
      };
    }).toList();

    rows.sort((a, b) => a['name']!.compareTo(b['name']!));
    return rows;
  }

  bool _matchesLedgerStudent(
    String rawValue,
    String name,
    StudentRegistryRecord? registryStudent,
  ) {
    final candidate = _normalizeLedgerKey(rawValue);
    if (candidate.isEmpty) {
      return false;
    }

    if (candidate == _normalizeLedgerKey(name)) {
      return true;
    }

    if (registryStudent == null) {
      return false;
    }

    return candidate == _normalizeLedgerKey(registryStudent.fullName) ||
        candidate == _normalizeLedgerKey(registryStudent.username);
  }

  String _normalizeLedgerKey(String? value) {
    return (value ?? '')
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u')
        .replaceAll('-', '')
        .replaceAll(' ', '');
  }
}
