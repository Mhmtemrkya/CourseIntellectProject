import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/staff_registry_store.dart';
import '../widgets/directory_list.dart';
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
    final filtered = _filtered;
    final staff = _store.staff;
    final active = staff.where((record) => _isActive(record.status)).length;
    final teachers = staff
        .where((record) => record.roleType == 'Öğretmen')
        .length;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Personeller'.tr,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openRegistration,
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: Text('Yeni Personel'.tr),
      ),
      body: DirectoryList<StaffRegistryRecord>(
        title: 'Personeller',
        subtitle: '$active ${'personeliniz bulunuyor'.tr}',
        loading: _isRefreshing,
        onRefresh: _refresh,
        stats: [
          DirectoryStat(
            label: 'Toplam Personel',
            value: '${staff.length}',
            caption: 'Tüm kadro',
            icon: Icons.groups_outlined,
            color: const Color(0xFF2563EB),
          ),
          DirectoryStat(
            label: 'Aktif Personel',
            value: '$active',
            caption: 'Giriş yapabilir',
            icon: Icons.verified_user_outlined,
            color: const Color(0xFF059669),
          ),
          DirectoryStat(
            label: 'Öğretmen',
            value: '$teachers',
            caption: 'Akademik kadro',
            icon: Icons.school_outlined,
            color: const Color(0xFF7C3AED),
          ),
          DirectoryStat(
            label: 'Pasif Personel',
            value: '${staff.length - active}',
            caption: 'Girişi kapalı',
            icon: Icons.person_off_outlined,
            color: const Color(0xFFB42318),
          ),
        ],
        searchHint: 'Personel ara...',
        onSearchChanged: (value) => setState(() => _search = value),
        filters: [
          DirectoryFilter(
            label: 'Tüm Roller',
            value: _roleFilter == 'Tümü' ? directoryAll : _roleFilter,
            options: _roleOptions.where((item) => item != 'Tümü').toList(),
            onChanged: (value) => setState(
              () => _roleFilter = value == directoryAll ? 'Tümü' : value,
            ),
          ),
          DirectoryFilter(
            label: 'Tüm Durumlar',
            value: _statusFilter == 'Tümü' ? directoryAll : _statusFilter,
            options: _statusOptions.where((item) => item != 'Tümü').toList(),
            onChanged: (value) => setState(
              () => _statusFilter = value == directoryAll ? 'Tümü' : value,
            ),
          ),
        ],
        rows: filtered,
        totalLabel: (total) => '${'Toplam'.tr} $total ${'personel'.tr}',
        emptyTitle: 'Personel bulunamadı',
        emptyDescription:
            'Aramanıza uyan personel yok. Farklı bir rol deneyin.',
        blankTitle: 'Henüz personel kaydınız yok',
        blankDescription:
            'Öğretmen, sekreter ve yönetici hesapları buradan açılır; her personel kendi rolüyle giriş yapar.',
        rowBuilder: (context, record) {
          final passive = !_isActive(record.status);
          return DirectoryRowCard(
            title: record.fullName,
            subtitle: record.username.isEmpty
                ? record.roleType
                : '${record.roleType} · ${record.username}',
            trailingBadge: passive ? 'Pasif'.tr : 'Aktif'.tr,
            badgeColor: passive
                ? const Color(0xFFB42318)
                : const Color(0xFF059669),
            onTap: () => _openDetail(record),
            metrics: [
              (
                icon: Icons.badge_outlined,
                label: 'Birim',
                value: record.branchOrDepartment,
              ),
              (
                icon: Icons.phone_outlined,
                label: 'Telefon',
                value: record.phone,
              ),
              (
                icon: Icons.event_outlined,
                label: 'Başlangıç',
                value: record.startDate,
              ),
            ],
            actions: [
              IconButton(
                tooltip: 'Detay'.tr,
                onPressed: () => _openDetail(record),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
              // Pasifleştirme listede kalmalı: hesap silinmez, girişi kapanır.
              IconButton(
                tooltip: passive ? 'Aktifleştir'.tr : 'Pasifleştir'.tr,
                onPressed: () => _toggleStatus(record),
                icon: Icon(
                  passive
                      ? Icons.person_add_alt_1_outlined
                      : Icons.person_off_outlined,
                  color: passive
                      ? const Color(0xFF059669)
                      : const Color(0xFFB42318),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _toggleStatus(StaffRegistryRecord record) async {
    final passive = !_isActive(record.status);
    try {
      await _store.updateStatus(
        username: record.username,
        status: passive ? 'Aktif' : 'Pasif',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            passive
                ? 'Personel aktifleştirildi.'.tr
                : 'Personel pasife alındı (giriş yapamaz).'.tr,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}
