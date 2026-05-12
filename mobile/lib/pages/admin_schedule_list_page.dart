import 'package:flutter/material.dart';

import '../services/schedule_api_service.dart';
import '../services/schedule_store.dart';
import 'admin_class_management_page.dart';
import 'admin_schedule_edit_page.dart';

class AdminScheduleListPage extends StatefulWidget {
  const AdminScheduleListPage({super.key});

  @override
  State<AdminScheduleListPage> createState() => _AdminScheduleListPageState();
}

class _AdminScheduleListPageState extends State<AdminScheduleListPage> {
  final _store = ScheduleStore.instance;

  String? _classFilter;
  String? _teacherFilter;
  String? _dayFilter;

  static const _days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];

  @override
  void initState() {
    super.initState();
    _store.addListener(_onStoreChanged);
    _store.ensureLoaded();
  }

  @override
  void dispose() {
    _store.removeListener(_onStoreChanged);
    super.dispose();
  }

  void _onStoreChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _openCreate() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AdminScheduleEditPage()),
    );
  }

  Future<void> _openEdit(ScheduleEntryApiRecord record) async {
    if (record.isReadOnly) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Eski kayıtlar salt okunurdur, düzenlenemez.'),
        ),
      );
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => AdminScheduleEditPage(entry: record)),
    );
  }

  Future<void> _confirmDelete(ScheduleEntryApiRecord record) async {
    if (record.isReadOnly) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Eski kayıtlar silinemez.')));
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Kaydı sil'),
        content: Text(
          '${record.className} • ${record.day} ${record.time} (${record.subject}) silinsin mi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _store.deleteEntry(record.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Kayıt silindi.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Silinemedi: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final grouped = _store.groupedByClass(
      classFilter: _classFilter,
      teacherFilter: _teacherFilter,
      dayFilter: _dayFilter,
    );
    final classes = grouped.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ders Programı'),
        actions: [
          IconButton(
            tooltip: 'Sınıf Ekle',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const AdminClassManagementPage(),
              ),
            ),
            icon: const Icon(Icons.class_outlined),
          ),
          IconButton(
            onPressed: _store.isLoading ? null : _store.refresh,
            icon: _store.isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.add),
        label: const Text('Yeni Ders'),
      ),
      body: !_store.isLoaded && _store.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _store.refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                children: [
                  if (_store.lastError != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _store.lastError!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  _buildFilters(theme),
                  const SizedBox(height: 12),
                  Text(
                    '${_store.entries.where(_entryMatchesFilters).length} kayıt • ${classes.length} sınıf',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.7,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (classes.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Center(
                        child: Text(
                          _store.entries.isEmpty
                              ? 'Henüz ders programı kaydı yok. Yeni eklemek için + butonunu kullanın.'
                              : 'Seçilen filtrelere uyan ders bulunamadı.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    )
                  else
                    ...classes.map(
                      (className) => _classSection(
                        theme,
                        className,
                        grouped[className] ?? [],
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  bool _entryMatchesFilters(ScheduleEntryApiRecord entry) {
    if (_classFilter != null &&
        _classFilter!.isNotEmpty &&
        entry.className != _classFilter) {
      return false;
    }
    if (_teacherFilter != null &&
        _teacherFilter!.isNotEmpty &&
        entry.teacher != _teacherFilter) {
      return false;
    }
    if (_dayFilter != null &&
        _dayFilter!.isNotEmpty &&
        entry.day != _dayFilter) {
      return false;
    }
    return true;
  }

  Widget _buildFilters(ThemeData theme) {
    final classOptions = _store.classNames;
    final teacherOptions = _store.teacherNames;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _dropdownFilter(
            label: 'Sınıf',
            value: _classFilter,
            options: classOptions,
            onChanged: (value) => setState(() => _classFilter = value),
          ),
          const SizedBox(width: 8),
          _dropdownFilter(
            label: 'Öğretmen',
            value: _teacherFilter,
            options: teacherOptions,
            onChanged: (value) => setState(() => _teacherFilter = value),
          ),
          const SizedBox(width: 8),
          _dropdownFilter(
            label: 'Gün',
            value: _dayFilter,
            options: _days,
            onChanged: (value) => setState(() => _dayFilter = value),
          ),
          if (_classFilter != null ||
              _teacherFilter != null ||
              _dayFilter != null) ...[
            const SizedBox(width: 8),
            TextButton.icon(
              onPressed: () => setState(() {
                _classFilter = null;
                _teacherFilter = null;
                _dayFilter = null;
              }),
              icon: const Icon(Icons.clear, size: 18),
              label: const Text('Temizle'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _dropdownFilter({
    required String label,
    required String? value,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          value: value,
          hint: Text(label),
          items: [
            DropdownMenuItem<String?>(
              value: null,
              child: Text('Tüm ${label.toLowerCase()}lar'),
            ),
            ...options.map(
              (option) =>
                  DropdownMenuItem<String?>(value: option, child: Text(option)),
            ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _classSection(
    ThemeData theme,
    String className,
    List<ScheduleEntryApiRecord> items,
  ) {
    final sorted = [...items]
      ..sort((a, b) {
        final dayCompare = _dayIndex(a.day).compareTo(_dayIndex(b.day));
        if (dayCompare != 0) return dayCompare;
        return a.time.compareTo(b.time);
      });

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Row(
              children: [
                Icon(Icons.class_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  className,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                Text(
                  '${sorted.length} ders',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 0),
          ...sorted.map((entry) => _entryTile(theme, entry)),
        ],
      ),
    );
  }

  Widget _entryTile(ThemeData theme, ScheduleEntryApiRecord entry) {
    return InkWell(
      onTap: () => _openEdit(entry),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Row(
          children: [
            Container(
              width: 56,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                children: [
                  Text(
                    entry.day.length >= 3
                        ? entry.day.substring(0, 3)
                        : entry.day,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    entry.time,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          entry.subject,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (entry.isReadOnly) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Salt okunur',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${entry.teacher} • ${entry.room}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.7,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (!entry.isReadOnly)
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20),
                onPressed: () => _confirmDelete(entry),
                color: Colors.red.shade700,
              )
            else
              const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }

  int _dayIndex(String day) {
    const order = {
      'Pazartesi': 1,
      'Salı': 2,
      'Çarşamba': 3,
      'Perşembe': 4,
      'Cuma': 5,
    };
    return order[day] ?? 99;
  }
}
