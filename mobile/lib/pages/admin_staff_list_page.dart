import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import 'admin_staff_detail_page.dart';
import 'admin_staff_registration_page.dart';

class AdminStaffListPage extends StatefulWidget {
  const AdminStaffListPage({super.key});

  @override
  State<AdminStaffListPage> createState() => _AdminStaffListPageState();
}

class _AdminStaffListPageState extends State<AdminStaffListPage> {
  final _store = StaffRegistryStore.instance;
  final _searchController = TextEditingController();

  String _roleFilter = 'Tümü';
  String _statusFilter = 'Tümü';
  String _search = '';
  bool _isRefreshing = false;

  static const _roleOptions = ['Tümü', 'Öğretmen', 'Personel', 'Muhasebeci'];
  static const _statusOptions = ['Tümü', 'Aktif', 'Pasif'];

  @override
  void initState() {
    super.initState();
    _store.addListener(_onStoreChanged);
    _store.ensureLoaded();
  }

  @override
  void dispose() {
    _store.removeListener(_onStoreChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onStoreChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _refresh() async {
    setState(() => _isRefreshing = true);
    try {
      await _store.refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Yenileme başarısız: $error')));
    } finally {
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  List<StaffRegistryRecord> get _filtered {
    final list = _store.staff;
    return list.where((record) {
      if (_roleFilter != 'Tümü' && record.roleType != _roleFilter) return false;
      if (_statusFilter == 'Aktif' && !_isActive(record.status)) return false;
      if (_statusFilter == 'Pasif' && _isActive(record.status)) return false;
      if (_search.isEmpty) return true;
      final query = _search.toLowerCase();
      return record.fullName.toLowerCase().contains(query) ||
          record.username.toLowerCase().contains(query) ||
          record.branchOrDepartment.toLowerCase().contains(query) ||
          record.email.toLowerCase().contains(query);
    }).toList();
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';

  Future<void> _openRegistration() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AdminStaffRegistrationPage()),
    );
    if (!mounted) return;
    await _refresh();
  }

  Future<void> _openDetail(StaffRegistryRecord record) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AdminStaffDetailPage(staffId: record.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Personel Yönetimi'),
        actions: [
          IconButton(
            onPressed: _isRefreshing ? null : _refresh,
            icon: _isRefreshing
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
        onPressed: _openRegistration,
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Yeni Personel'),
      ),
      body: !_store.isLoaded
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TextField(
                            controller: _searchController,
                            onChanged: (value) =>
                                setState(() => _search = value),
                            decoration: InputDecoration(
                              hintText:
                                  'Ad, kullanıcı adı, departman veya e-posta ara…',
                              prefixIcon: const Icon(Icons.search),
                              filled: true,
                              fillColor: theme.scaffoldBackgroundColor,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _FilterChipGroup(
                                  label: 'Rol',
                                  options: _roleOptions,
                                  selected: _roleFilter,
                                  onChanged: (value) =>
                                      setState(() => _roleFilter = value),
                                ),
                                const SizedBox(width: 12),
                                _FilterChipGroup(
                                  label: 'Durum',
                                  options: _statusOptions,
                                  selected: _statusFilter,
                                  onChanged: (value) =>
                                      setState(() => _statusFilter = value),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            '${filtered.length} kayıt',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.textTheme.bodySmall?.color
                                  ?.withValues(alpha: 0.7),
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                      ),
                    ),
                  ),
                  if (filtered.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text(
                            'Filtrelere uyan personel bulunamadı.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    )
                  else
                    SliverList.builder(
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final record = filtered[index];
                        return _StaffTile(
                          record: record,
                          onTap: () => _openDetail(record),
                        );
                      },
                    ),
                  const SliverToBoxAdapter(child: SizedBox(height: 96)),
                ],
              ),
            ),
    );
  }
}

class _FilterChipGroup extends StatelessWidget {
  final String label;
  final List<String> options;
  final String selected;
  final ValueChanged<String> onChanged;

  const _FilterChipGroup({
    required this.label,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$label:', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(width: 8),
        ...options.map(
          (option) => Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              label: Text(option),
              selected: selected == option,
              onSelected: (_) => onChanged(option),
            ),
          ),
        ),
      ],
    );
  }
}

class _StaffTile extends StatelessWidget {
  final StaffRegistryRecord record;
  final VoidCallback onTap;

  const _StaffTile({required this.record, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isActive = record.status == 'Aktif' || record.status == 'Active';
    final initials = _initials(record.fullName);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Material(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: theme.colorScheme.primary.withValues(
                    alpha: 0.12,
                  ),
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        record.fullName.isEmpty ? '(Ad yok)' : record.fullName,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${record.roleType} • ${record.branchOrDepartment.isEmpty ? 'Belirtilmemiş' : record.branchOrDepartment}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.textTheme.bodySmall?.color?.withValues(
                            alpha: 0.72,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: (isActive ? Colors.green : Colors.grey).withValues(
                      alpha: 0.15,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    isActive ? 'Aktif' : 'Pasif',
                    style: TextStyle(
                      color: isActive
                          ? Colors.green.shade800
                          : Colors.grey.shade700,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}
