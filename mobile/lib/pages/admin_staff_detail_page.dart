import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import 'admin_staff_edit_page.dart';

class AdminStaffDetailPage extends StatefulWidget {
  final String staffId;

  const AdminStaffDetailPage({super.key, required this.staffId});

  @override
  State<AdminStaffDetailPage> createState() => _AdminStaffDetailPageState();
}

class _AdminStaffDetailPageState extends State<AdminStaffDetailPage> {
  final _store = StaffRegistryStore.instance;
  bool _isTogglingStatus = false;

  @override
  void initState() {
    super.initState();
    _store.addListener(_onStoreChanged);
  }

  @override
  void dispose() {
    _store.removeListener(_onStoreChanged);
    super.dispose();
  }

  void _onStoreChanged() {
    if (mounted) setState(() {});
  }

  StaffRegistryRecord? get _record {
    return _store.staff
        .where((record) => record.id == widget.staffId)
        .cast<StaffRegistryRecord?>()
        .firstWhere((_) => true, orElse: () => null);
  }

  bool _isActive(StaffRegistryRecord record) =>
      record.status == 'Aktif' || record.status == 'Active';

  Future<void> _toggleStatus(StaffRegistryRecord record) async {
    final nextActive = !_isActive(record);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(nextActive ? 'Aktifleştir' : 'Pasifleştir'),
        content: Text(
          nextActive
              ? '${record.fullName} kullanıcısını tekrar aktifleştirmek istediğine emin misin?'
              : '${record.fullName} kullanıcısını pasifleştirmek istediğine emin misin? Kullanıcı giriş yapamayacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Onayla'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isTogglingStatus = true);
    try {
      await _store.updateStatus(
        username: record.username,
        status: nextActive ? 'Aktif' : 'Pasif',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            nextActive
                ? 'Kullanıcı aktifleştirildi.'
                : 'Kullanıcı pasifleştirildi.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('İşlem başarısız: $error')));
    } finally {
      if (mounted) setState(() => _isTogglingStatus = false);
    }
  }

  Future<void> _openEdit(StaffRegistryRecord record) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => AdminStaffEditPage(staffId: record.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final record = _record;

    if (record == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Personel Detayı')),
        body: const Center(child: Text('Personel kaydı bulunamadı.')),
      );
    }

    final isActive = _isActive(record);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Personel Detayı'),
        actions: [
          IconButton(
            tooltip: 'Düzenle',
            onPressed: () => _openEdit(record),
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HeaderCard(record: record, isActive: isActive),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'İletişim',
            rows: [
              _DetailRow(
                icon: Icons.email_outlined,
                label: 'E-posta',
                value: record.email,
              ),
              _DetailRow(
                icon: Icons.phone_outlined,
                label: 'Telefon',
                value: record.phone,
              ),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Görev Bilgisi',
            rows: [
              _DetailRow(
                icon: Icons.badge_outlined,
                label: 'Kullanıcı Adı',
                value: record.username,
              ),
              _DetailRow(
                icon: Icons.work_outline,
                label: 'Rol',
                value: record.roleType,
              ),
              _DetailRow(
                icon: Icons.apartment_outlined,
                label: 'Kampüs',
                value: record.campus,
              ),
              _DetailRow(
                icon: Icons.account_tree_outlined,
                label: 'Departman / Branş',
                value: record.branchOrDepartment,
              ),
              _DetailRow(
                icon: Icons.class_outlined,
                label: 'Sınıf Öğretmenliği',
                value: record.homeroomClass,
              ),
              if (record.assignedClasses.isNotEmpty)
                _DetailRow(
                  icon: Icons.groups_outlined,
                  label: 'Atanan Sınıflar',
                  value: record.assignedClasses.join(', '),
                ),
              if (record.extraRoles.isNotEmpty)
                _DetailRow(
                  icon: Icons.auto_awesome,
                  label: 'Ek Roller',
                  value: record.extraRoles.join(', '),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Özlük',
            rows: [
              _DetailRow(
                icon: Icons.credit_card_outlined,
                label: 'TC Kimlik',
                value: record.tcNo,
              ),
              _DetailRow(
                icon: Icons.school_outlined,
                label: 'Öğrenim',
                value: record.education,
              ),
              _DetailRow(
                icon: Icons.event_outlined,
                label: 'İşe Başlama',
                value: record.startDate,
              ),
              _DetailRow(
                icon: Icons.family_restroom,
                label: 'Medeni Durum',
                value: record.maritalStatus,
              ),
              _DetailRow(
                icon: Icons.child_care_outlined,
                label: 'Çocuk Sayısı',
                value: record.childCount.toString(),
              ),
              if (record.note.isNotEmpty)
                _DetailRow(
                  icon: Icons.notes_outlined,
                  label: 'Not',
                  value: record.note,
                ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isTogglingStatus
                      ? null
                      : () => _toggleStatus(record),
                  icon: Icon(
                    isActive ? Icons.block : Icons.check_circle_outline,
                  ),
                  label: Text(isActive ? 'Pasifleştir' : 'Aktifleştir'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isActive
                        ? Colors.red.shade700
                        : Colors.green.shade700,
                    side: BorderSide(
                      color: isActive
                          ? Colors.red.shade700
                          : Colors.green.shade700,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _openEdit(record),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Düzenle'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'ID: ${record.id}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final StaffRegistryRecord record;
  final bool isActive;

  const _HeaderCard({required this.record, required this.isActive});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 34,
            backgroundColor: theme.colorScheme.primary,
            child: Text(
              _initials(record.fullName),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            record.fullName.isEmpty ? '(Ad yok)' : record.fullName,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            '${record.roleType} • ${record.branchOrDepartment.isEmpty ? 'Belirtilmemiş' : record.branchOrDepartment}',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: (isActive ? Colors.green : Colors.grey).withValues(
                alpha: 0.18,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              isActive ? 'Aktif' : 'Pasif',
              style: TextStyle(
                color: isActive ? Colors.green.shade800 : Colors.grey.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
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

class _SectionCard extends StatelessWidget {
  final String title;
  final List<_DetailRow> rows;

  const _SectionCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          ...rows,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final displayValue = value.trim().isEmpty ? '—' : value;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.6,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(displayValue, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
