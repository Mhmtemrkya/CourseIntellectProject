import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/consent_alert_banner.dart';
import '../widgets/driving_ui.dart';
import 'consent_center_page.dart';
import 'driving_student_registration_page.dart';

const _statusLabels = {
  'PreRegistered': 'Ön kayıt',
  'DocumentsPending': 'Evrak bekliyor',
  'Active': 'Aktif',
  'TheoryOngoing': 'Teorik eğitimde',
  'PracticeOngoing': 'Direksiyonda',
  'ExamPending': 'Sınav bekliyor',
  'GraduationPending': 'Mezuniyet onayında',
  'Graduated': 'Mezun',
  'Suspended': 'Askıda',
  'Cancelled': 'İptal',
};

const _trMonths = [
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

// Gruplar aylık açılır; yeni grup adına bu ayı öner (ör. "Temmuz 2026").
String _currentMonthGroupName() {
  final now = DateTime.now();
  return '${_trMonths[now.month - 1]} ${now.year}';
}

String _statusLabel(dynamic status) => _statusLabels['$status'] ?? '$status';
String _transmission(dynamic v) =>
    (v == 'Manual' || v == 1) ? 'Manuel' : 'Otomatik';

String _dateOnly(dynamic value) {
  final raw = '${value ?? ''}';
  if (raw.isEmpty) return '—';
  final d = DateTime.tryParse(raw);
  if (d == null) return '—';
  final l = d.toLocal();
  return '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')}.${l.year}';
}

({String label, DrivingTone tone}) _documentTone(dynamic status) {
  switch ('$status') {
    case 'Approved':
      return (label: 'Onaylı', tone: DrivingTone.success);
    case 'PendingApproval':
      return (label: 'Onay bekliyor', tone: DrivingTone.warning);
    case 'Rejected':
      return (label: 'Reddedildi', tone: DrivingTone.danger);
    case 'Missing':
      return (label: 'Eksik', tone: DrivingTone.danger);
    case 'Expired':
      return (label: 'Süresi doldu', tone: DrivingTone.accent);
    default:
      return (label: '$status', tone: DrivingTone.neutral);
  }
}

class DrivingSchoolStudentsPage extends StatefulWidget {
  const DrivingSchoolStudentsPage({super.key, this.initialGroupId});

  final String? initialGroupId;

  @override
  State<DrivingSchoolStudentsPage> createState() =>
      _DrivingSchoolStudentsPageState();
}

class _DrivingSchoolStudentsPageState extends State<DrivingSchoolStudentsPage> {
  final _service = DrivingSchoolApiService.instance;
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _groups = [];
  // Peşinatı beklenen kursiyer adları (liste profileId taşıdığından ada göre eşleşir).
  Set<String> _pendingNames = {};
  int _ungroupedCount = 0;
  String _search = '';
  String _groupFilter = 'all'; // 'all' | 'ungrouped' | <groupId>
  // Durum filtresi — varsayılan yalnız AKTİF kursiyerler. Mezun olanlar otomatik
  // pasife düşer ve ana listede görünmez; çiplerden "Mezun" / "Askıda / İptal"
  // seçilerek görülebilir. 'active' | 'graduated' | 'inactive' | 'all'
  String _statusFilter = 'active';
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;

  bool _selectMode = false;
  final Set<String> _selected = {};
  String? _assignTarget;
  bool _assigning = false;

  bool get _canManageGroups =>
      _permissions.can(DrivingPermissions.studentUpdate);
  bool get _canCreate => _permissions.can(DrivingPermissions.studentCreate);
  bool get _canDeactivate =>
      _permissions.can(DrivingPermissions.studentDeactivate);

  @override
  void initState() {
    super.initState();
    _groupFilter = widget.initialGroupId ?? 'all';
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      var rows = await _service.students();
      if (rows.isEmpty) {
        try {
          final repair = await _service.repairSingleBranchRecords();
          final updated = (repair['updated'] as num?)?.toInt() ?? 0;
          if (updated > 0) {
            rows = await _service.students();
          }
        } catch (_) {
          // Şube müdürü veya çok şubeli kurumda onarım uygulanmaz; normal boş
          // liste davranışı korunur.
        }
      }
      final permissions = await DrivingPermissionsStore.instance.load();
      Map<String, dynamic>? groupData;
      try {
        groupData = await _service.studentGroups();
      } catch (_) {
        groupData = null;
      }
      List<Map<String, dynamic>> pending;
      try {
        pending = await _service.pendingDownPayments();
      } catch (_) {
        pending = <Map<String, dynamic>>[];
      }
      if (!mounted) return;
      setState(() {
        _students = rows;
        _permissions = permissions;
        _pendingNames = pending
            .map((r) => '${r['studentName'] ?? ''}'.trim().toLowerCase())
            .toSet();
        _groups = ((groupData?['groups'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _ungroupedCount = (groupData?['ungroupedCount'] as num?)?.toInt() ?? 0;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _activeGroups =>
      _groups.where((g) => g['isActive'] == true).toList();

  // Pasif sayılan (ana listede gizlenen) durumlar.
  static const _passiveStatuses = {'Graduated', 'Suspended', 'Cancelled'};

  bool _statusMatches(dynamic status) {
    final value = '$status';
    switch (_statusFilter) {
      case 'graduated':
        return value == 'Graduated';
      case 'inactive':
        return value == 'Suspended' || value == 'Cancelled';
      case 'all':
        return true;
      case 'active':
      default:
        return !_passiveStatuses.contains(value);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    return _students.where((s) {
      if (!_statusMatches(s['status'])) return false;
      final groupId = s['groupId'];
      if (_groupFilter == 'ungrouped' && groupId != null) return false;
      if (_groupFilter != 'all' &&
          _groupFilter != 'ungrouped' &&
          '$groupId' != _groupFilter) {
        return false;
      }
      if (term.isNotEmpty &&
          !'${s['fullName'] ?? ''}'.toLowerCase().contains(term)) {
        return false;
      }
      return true;
    }).toList();
  }

  void _openStudent(Map<String, dynamic> student) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _StudentDocumentsSheet(
        profileId: '${student['id']}',
        fallbackName: '${student['fullName'] ?? 'Kursiyer'}',
      ),
    );
  }

  void _exitSelectMode() {
    setState(() {
      _selectMode = false;
      _selected.clear();
      _assignTarget = null;
    });
  }

  void _toggleSelect(String id) {
    setState(() {
      if (_selected.contains(id)) {
        _selected.remove(id);
      } else {
        _selected.add(id);
      }
    });
  }

  Future<void> _createGroupDialog() async {
    final nameCtrl = TextEditingController(text: _currentMonthGroupName());
    final descCtrl = TextEditingController();
    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Yeni Kursiyer Grubu'.tr),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              maxLength: 120,
              decoration: InputDecoration(
                labelText: 'Grup adı'.tr,
                hintText: 'Örn. Temmuz 2026 grubu',
              ),
            ),
            TextField(
              controller: descCtrl,
              maxLength: 500,
              decoration: InputDecoration(labelText: 'Açıklama (opsiyonel)'.tr),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.length < 2) return;
              try {
                final now = DateTime.now();
                await _service.createStudentGroup(
                  name,
                  description: descCtrl.text.trim(),
                  termYear: now.year,
                  termNumber: now.month,
                );
                if (dialogContext.mounted) Navigator.pop(dialogContext, true);
              } catch (e) {
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(
                    dialogContext,
                  ).showSnackBar(SnackBar(content: Text('$e')));
                }
              }
            },
            child: Text('Oluştur'.tr),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
    descCtrl.dispose();
    if (created == true) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Grup oluşturuldu.'.tr)));
      }
      await _load();
    }
  }

  Future<void> _assign(String? groupId) async {
    if (_selected.isEmpty) return;
    setState(() => _assigning = true);
    try {
      final result = await _service.assignStudentGroup(
        _selected.toList(),
        groupId,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${result['assigned'] ?? _selected.length} kursiyer güncellendi.',
            ),
          ),
        );
      }
      _exitSelectMode();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _assigning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = _students
        .where((s) => s['status'] != 'Graduated' && s['status'] != 'Cancelled')
        .length;
    final graduated = _students.where((s) => s['status'] == 'Graduated').length;

    return DrivingScaffold(
      appBar: AppBar(
        title: Text(
          _selectMode ? '${_selected.length} seçili' : 'Öğrenciler'.tr,
        ),
        leading: _selectMode
            ? IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: _exitSelectMode,
              )
            : null,
        actions: [
          if (_canCreate && !_selectMode)
            IconButton(
              tooltip: 'Yeni Kursiyer'.tr,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              onPressed: () async {
                final created = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const DrivingStudentRegistrationPage(),
                  ),
                );
                if (created == true) _load();
              },
            ),
          if (_canManageGroups && !_selectMode) ...[
            IconButton(
              tooltip: 'Grup Oluştur'.tr,
              icon: const Icon(Icons.create_new_folder_rounded),
              onPressed: _createGroupDialog,
            ),
            IconButton(
              tooltip: 'Gruba Ata'.tr,
              icon: const Icon(Icons.layers_rounded),
              onPressed: () => setState(() => _selectMode = true),
            ),
          ],
        ],
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? DrivingErrorState(error: _error!, onRetry: _load)
          : Column(
              children: [
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        DrivingHero(
                          eyebrow: 'KURSİYERLER'.tr,
                          title: 'Öğrenciler'.tr,
                          description:
                              'Kursiyerleri gruplara (dönemlere) ayırın; belgelerini inceleyin.'
                                  .tr,
                          icon: Icons.groups_rounded,
                          metrics: [
                            DrivingHeroMetric(
                              label: 'Toplam'.tr,
                              value: '${_students.length}',
                            ),
                            const SizedBox(width: 10),
                            DrivingHeroMetric(
                              label: 'Aktif'.tr,
                              value: '$activeCount',
                            ),
                            const SizedBox(width: 10),
                            DrivingHeroMetric(
                              label: 'Mezun'.tr,
                              value: '$graduated',
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          onChanged: (v) => setState(() => _search = v),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(Icons.search_rounded),
                            hintText: 'Kursiyer ara...'.tr,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _statusFilterChips(),
                        const SizedBox(height: 8),
                        _groupFilterChips(),
                        const SizedBox(height: 12),
                        if (_filtered.isEmpty)
                          DrivingEmptyState(
                            icon: Icons.groups_rounded,
                            title:
                                _search.isEmpty &&
                                    _groupFilter == 'all' &&
                                    _statusFilter == 'active'
                                ? 'Henüz kursiyer yok.'.tr
                                : 'Eşleşen kursiyer yok.'.tr,
                          )
                        else
                          ..._filtered.map(_studentRow),
                      ],
                    ),
                  ),
                ),
                if (_selectMode) _assignBar(),
              ],
            ),
    );
  }

  Widget _statusFilterChips() {
    final activeCount = _students
        .where((s) => !_passiveStatuses.contains('${s['status']}'))
        .length;
    final graduatedCount = _students
        .where((s) => '${s['status']}' == 'Graduated')
        .length;
    final inactiveCount = _students
        .where(
          (s) =>
              '${s['status']}' == 'Suspended' ||
              '${s['status']}' == 'Cancelled',
        )
        .length;
    final chips = <Widget>[
      _statusChip('active', 'Aktif'.tr, activeCount),
      _statusChip('graduated', 'Mezun'.tr, graduatedCount),
      _statusChip('inactive', 'Askıda / İptal'.tr, inactiveCount),
    ];
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: chips.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) => chips[i],
      ),
    );
  }

  Widget _statusChip(String key, String label, int count) {
    final selected = _statusFilter == key;
    return ChoiceChip(
      selected: selected,
      onSelected: (_) => setState(() => _statusFilter = key),
      label: Text('$label ($count)'),
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 12,
        color: selected ? Colors.white : null,
      ),
      selectedColor: Theme.of(context).colorScheme.primary,
      showCheckmark: false,
    );
  }

  Widget _groupFilterChips() {
    final chips = <Widget>[
      _filterChip('all', 'Tümü'.tr, _students.length),
      ..._activeGroups.map(
        (g) => _filterChip(
          '${g['id']}',
          '${g['name']}',
          (g['studentCount'] as num?)?.toInt() ?? 0,
        ),
      ),
      if (_ungroupedCount > 0)
        _filterChip('ungrouped', 'Beklemede'.tr, _ungroupedCount),
    ];
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: chips.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) => chips[i],
      ),
    );
  }

  Widget _filterChip(String key, String label, int count) {
    final selected = _groupFilter == key;
    return ChoiceChip(
      selected: selected,
      onSelected: (_) => setState(() => _groupFilter = key),
      label: Text('$label ($count)'),
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 12,
        color: selected ? Colors.white : null,
      ),
      selectedColor: Theme.of(context).colorScheme.primary,
      showCheckmark: false,
    );
  }

  void _snack(String msg, {bool error = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: error ? Colors.red : null,
        ),
      );
    }
  }

  // Pasife alma: gerekçe (≥10 karakter) sorulur → Askıya alınır, her yerden
  // gizlenir, yalnız "Askıda / İptal" filtresinde görünür (desktop ile parite).
  Future<void> _deactivate(Map<String, dynamic> s) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Pasife Al'.tr),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '"${s['fullName']}" pasife alınacak. Her yerden gizlenir; yalnız "Askıda / İptal" filtresinde görünür.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Gerekçe (en az 10 karakter)'.tr,
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Pasife Al'.tr),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final reason = controller.text.trim();
    if (reason.length < 10) {
      _snack('Gerekçe en az 10 karakter olmalı.'.tr, error: true);
      return;
    }
    try {
      await DrivingSchoolApiService.instance.updateStudentLifecycle(
        '${s['id']}',
        {'status': 'Suspended', 'reason': reason},
      );
      _snack('Kursiyer pasife alındı.'.tr);
      await _load();
    } catch (e) {
      _snack('$e', error: true);
    }
  }

  Future<void> _reactivate(Map<String, dynamic> s) async {
    try {
      await DrivingSchoolApiService.instance.updateStudentLifecycle(
        '${s['id']}',
        {'automaticStatusEnabled': true},
      );
      _snack('Kursiyer aktifleştirildi.'.tr);
      await _load();
    } catch (e) {
      _snack('$e', error: true);
    }
  }

  Widget _studentRow(Map<String, dynamic> s) {
    final id = '${s['id']}';
    final checked = _selected.contains(id);
    final groupName = s['groupName'];
    final isPassive = _passiveStatuses.contains('${s['status']}');
    final statusReason = '${s['statusChangeReason'] ?? ''}'.trim();
    final isPending = _pendingNames.contains(
      '${s['fullName'] ?? ''}'.trim().toLowerCase(),
    );
    final rawPhoto =
        '${s['displayPhotoUrl'] ?? s['livePhotoUrl'] ?? s['photoUrl'] ?? ''}';
    final photoUrl = rawPhoto.isEmpty
        ? ''
        : rawPhoto.startsWith('http')
        ? rawPhoto
        : '${ApiConfig.baseUrl}$rawPhoto';
    return DrivingListRow(
      icon: _selectMode
          ? (checked
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded)
          : Icons.person_rounded,
      leading: !_selectMode && photoUrl.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                photoUrl,
                width: 42,
                height: 42,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 42,
                  height: 42,
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: const Icon(Icons.person_rounded),
                ),
              ),
            )
          : null,
      title: '${s['fullName'] ?? '—'}',
      subtitle: [
        '${s['licenseClass'] ?? ''} • ${_transmission(s['transmissionType'])} • ${s['remainingDrivingMinutes'] ?? 0} dk kaldı',
        if (groupName != null) 'Grup: $groupName',
        if (isPassive && statusReason.isNotEmpty) 'Sebep: $statusReason',
      ].join('\n'),
      trailing: _selectMode
          ? null
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                DrivingStatusPill(
                  label: _statusLabel(s['status']),
                  tone: isPassive ? DrivingTone.danger : DrivingTone.accent,
                ),
                if (isPending) ...[
                  const SizedBox(height: 4),
                  DrivingStatusPill(
                    label: 'Peşinat bekliyor'.tr,
                    tone: DrivingTone.danger,
                  ),
                ],
                if (_canDeactivate) ...[
                  const SizedBox(height: 2),
                  isPassive
                      ? TextButton.icon(
                          onPressed: () => _reactivate(s),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF10B981),
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: const Size(0, 30),
                          ),
                          icon: const Icon(Icons.restore_rounded, size: 16),
                          label: Text('Aktifleştir'.tr),
                        )
                      : TextButton.icon(
                          onPressed: () => _deactivate(s),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFFEF4444),
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: const Size(0, 30),
                          ),
                          icon: const Icon(Icons.person_off_rounded, size: 16),
                          label: Text('Pasife Al'.tr),
                        ),
                ],
              ],
            ),
      onTap: () => _selectMode ? _toggleSelect(id) : _openStudent(s),
    );
  }

  Widget _assignBar() {
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _assignTarget,
                  isExpanded: true,
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    hintText: 'Grup seçin…'.tr,
                  ),
                  items: _activeGroups
                      .map(
                        (g) => DropdownMenuItem(
                          value: '${g['id']}',
                          child: Text('${g['name']}'),
                        ),
                      )
                      .toList(),
                  onChanged: _assigning
                      ? null
                      : (v) => setState(() => _assignTarget = v),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed:
                    (_assigning || _assignTarget == null || _selected.isEmpty)
                    ? null
                    : () => _assign(_assignTarget),
                child: Text('Ata'.tr),
              ),
              const SizedBox(width: 6),
              OutlinedButton(
                onPressed: (_assigning || _selected.isEmpty)
                    ? null
                    : () => _assign(null),
                child: Text('Çıkar'.tr),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StudentDocumentsSheet extends StatefulWidget {
  final String profileId;
  final String fallbackName;

  const _StudentDocumentsSheet({
    required this.profileId,
    required this.fallbackName,
  });

  @override
  State<_StudentDocumentsSheet> createState() => _StudentDocumentsSheetState();
}

class _StudentDocumentsSheetState extends State<_StudentDocumentsSheet> {
  late Future<Map<String, dynamic>> _future;
  List<Map<String, dynamic>> _mebbisHistory = const [];
  bool _historyLoading = true;
  bool _canCollect = false;
  bool _canUpdateLifecycle = false;
  bool _canDeactivate = false;
  bool _canOverrideDocuments = false;

  @override
  void initState() {
    super.initState();
    _future = DrivingSchoolApiService.instance.studentDetail(widget.profileId);
    _loadMebbisHistory();
    DrivingPermissionsStore.instance.load().then((p) {
      if (mounted) {
        setState(() {
          _canCollect = p.can(DrivingPermissions.financeCollect);
          _canUpdateLifecycle = p.can(DrivingPermissions.studentUpdate);
          _canDeactivate = p.can(DrivingPermissions.studentDeactivate);
          _canOverrideDocuments = p.can(
            DrivingPermissions.overrideStudentDocuments,
          );
        });
      }
    });
  }

  void _reload() {
    setState(() {
      _future = DrivingSchoolApiService.instance.studentDetail(
        widget.profileId,
      );
    });
    _loadMebbisHistory();
  }

  Future<void> _loadMebbisHistory() async {
    try {
      final value = await DrivingSchoolApiService.instance.mebbisHistory(
        widget.profileId,
      );
      if (!mounted) return;
      setState(() {
        _mebbisHistory = ((value['items'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _historyLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _openFile(String? url) async {
    if (url == null || url.isEmpty) return;
    final resolved = ApiConfig.resolveAssetUrl(url);
    final uri = Uri.tryParse(resolved);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _money(dynamic value) {
    final n = value is num ? value : num.tryParse('${value ?? ''}') ?? 0;
    return '₺${n.toStringAsFixed(0)}';
  }

  Future<void> _editExamFees(Map<String, dynamic> overview) async {
    final drivingCtrl = TextEditingController(
      text: '${(overview['drivingExamFee'] as num?)?.toInt() ?? 0}',
    );
    var drivingPaid = overview['drivingExamFeePaid'] == true;
    DateTime? examDate = overview['drivingExamDate'] != null
        ? DateTime.tryParse('${overview['drivingExamDate']}')
        : null;

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text('Direksiyon sınav ücreti'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: drivingCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: '${'Direksiyon sınavı'.tr} (₺)',
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Direksiyon ödendi'.tr),
                  value: drivingPaid,
                  onChanged: (v) => setDialogState(() => drivingPaid = v),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Direksiyon sınav tarihi'.tr),
                  subtitle: Text(
                    examDate != null
                        ? _dateOnly(examDate!.toIso8601String())
                        : '—',
                  ),
                  trailing: const Icon(Icons.event_rounded),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: dialogContext,
                      initialDate: examDate ?? DateTime.now(),
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 365 * 2),
                      ),
                      lastDate: DateTime.now().add(
                        const Duration(days: 365 * 2),
                      ),
                    );
                    if (picked != null) setDialogState(() => examDate = picked);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  await DrivingSchoolApiService.instance.updateExamFees(
                    widget.profileId,
                    theoryExamFee: 0,
                    drivingExamFee: num.tryParse(drivingCtrl.text.trim()) ?? 0,
                    theoryExamFeePaid: false,
                    drivingExamFeePaid: drivingPaid,
                    drivingExamDate: examDate?.toUtc().toIso8601String(),
                  );
                  if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                } catch (e) {
                  if (dialogContext.mounted) {
                    ScaffoldMessenger.of(
                      dialogContext,
                    ).showSnackBar(SnackBar(content: Text('$e')));
                  }
                }
              },
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    drivingCtrl.dispose();
    if (saved == true) _reload();
  }

  Future<void> _editLifecycle(Map<String, dynamic> overview) async {
    var automatic = overview['automaticStatusEnabled'] != false;
    var status = '${overview['status'] ?? 'DocumentsPending'}';
    var allowIncomplete = false;
    final documentsComplete = overview['documentsComplete'] == true;
    final reasonCtrl = TextEditingController();
    final statuses = <String, String>{
      'PreRegistered': 'Ön kayıt',
      'DocumentsPending': 'Evrak bekliyor',
      'Active': 'Aktif',
      'TheoryOngoing': 'Teorik eğitimde',
      'PracticeOngoing': 'Direksiyonda',
      'ExamPending': 'Sınav bekliyor',
      if (_canDeactivate) 'Suspended': 'Pasif / askıda',
      if (_canDeactivate) 'Cancelled': 'İptal',
    };
    if (!statuses.containsKey(status)) status = 'DocumentsPending';

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (_, setLocal) {
          final trainingStatus = const {
            'Active',
            'TheoryOngoing',
            'PracticeOngoing',
            'ExamPending',
          }.contains(status);
          final sensitive =
              const {'Suspended', 'Cancelled'}.contains(status) ||
              (!documentsComplete && allowIncomplete);
          return AlertDialog(
            title: Text('Durum ve uygunluk'.tr),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      documentsComplete
                          ? Icons.verified_rounded
                          : Icons.warning_amber_rounded,
                      color: documentsComplete ? Colors.green : Colors.orange,
                    ),
                    title: Text(
                      documentsComplete
                          ? 'Zorunlu evraklar tamam'
                          : 'Evrak dosyası tamamlanmamış',
                    ),
                    subtitle: !documentsComplete
                        ? Text(
                            ((overview['missingDocuments'] as List?) ??
                                    const [])
                                .join(', '),
                          )
                        : null,
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Otomatik yönetim'.tr),
                    subtitle: const Text(
                      'Evraklar tamamlanınca sistem otomatik aktif eder.',
                    ),
                    value: automatic,
                    onChanged: (v) => setLocal(() {
                      automatic = v;
                      allowIncomplete = false;
                    }),
                  ),
                  if (!automatic) ...[
                    DropdownButtonFormField<String>(
                      initialValue: status,
                      decoration: const InputDecoration(
                        labelText: 'Manuel durum',
                      ),
                      items: statuses.entries
                          .map(
                            (e) => DropdownMenuItem(
                              value: e.key,
                              child: Text(e.value),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setLocal(() {
                        status = v ?? status;
                        allowIncomplete = false;
                      }),
                    ),
                    if (!documentsComplete && trainingStatus)
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: allowIncomplete,
                        onChanged: _canOverrideDocuments
                            ? (v) => setLocal(() => allowIncomplete = v == true)
                            : null,
                        title: const Text(
                          'Eksik evraka rağmen eğitime izin ver',
                        ),
                        subtitle: const Text(
                          'Yetkili istisna ve denetim kaydı oluşturur.',
                        ),
                      ),
                    TextField(
                      controller: reasonCtrl,
                      onChanged: (_) => setLocal(() {}),
                      maxLength: 500,
                      decoration: InputDecoration(
                        labelText: sensitive
                            ? 'Gerekçe (en az 10 karakter)'
                            : 'Gerekçe',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('Vazgeç'.tr),
              ),
              FilledButton(
                onPressed: sensitive && reasonCtrl.text.trim().length < 10
                    ? null
                    : () async {
                        try {
                          await DrivingSchoolApiService.instance
                              .updateStudentLifecycle(widget.profileId, {
                                'status': status,
                                'automaticStatusEnabled': automatic,
                                'allowIncompleteDocuments': allowIncomplete,
                                'reason': reasonCtrl.text.trim(),
                              });
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, true);
                          }
                        } catch (e) {
                          if (dialogContext.mounted) {
                            ScaffoldMessenger.of(
                              dialogContext,
                            ).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        }
                      },
                child: Text('Kaydet'.tr),
              ),
            ],
          );
        },
      ),
    );
    reasonCtrl.dispose();
    if (saved == true) _reload();
  }

  Widget _examRightRow(String label, dynamic right) {
    if (right is! Map) return const SizedBox.shrink();
    final used = (right['used'] as num?)?.toInt() ?? 0;
    final max = (right['max'] as num?)?.toInt() ?? 4;
    final out = right['outOfAttempts'] == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
          Text(
            '$used/$max',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(width: 8),
          DrivingStatusPill(
            label: out
                ? 'Dönem düştü'.tr
                : '${(right['remaining'] as num?)?.toInt() ?? (max - used)} ${'hak kaldı'.tr}',
            tone: out ? DrivingTone.danger : DrivingTone.success,
          ),
        ],
      ),
    );
  }

  Widget _examFeeRow(String label, dynamic fee, bool paid) {
    final amount = (fee as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
          Text(
            _money(fee),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          if (amount > 0) ...[
            const SizedBox(width: 8),
            DrivingStatusPill(
              label: paid ? 'Ödendi'.tr : 'Ödenmedi'.tr,
              tone: paid ? DrivingTone.success : DrivingTone.danger,
            ),
          ],
        ],
      ),
    );
  }

  Widget _photoTile(dynamic url, String label) {
    final raw = '${url ?? ''}';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: raw.isEmpty
              ? Container(
                  width: 92,
                  height: 92,
                  color: Colors.grey.withValues(alpha: 0.2),
                  child: const Icon(Icons.person_rounded, size: 36),
                )
              : Image.network(
                  ApiConfig.resolveAssetUrl(raw),
                  width: 92,
                  height: 92,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    width: 92,
                    height: 92,
                    color: Colors.grey.withValues(alpha: 0.2),
                    child: const Icon(Icons.broken_image_rounded, size: 30),
                  ),
                ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _licenseLine(String label, dynamic value) {
    final text = '${value ?? ''}';
    if (text.isEmpty || text == '—') return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, controller) => FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(),
              ),
            );
          }
          if (snapshot.hasError || snapshot.data == null) {
            return DrivingEmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Belge bilgisi alınamadı.'.tr,
            );
          }
          final data = snapshot.data!;
          final overview = data['overview'] as Map<String, dynamic>?;
          final documents = data['documents'] as Map<String, dynamic>?;
          final items = (documents?['items'] as List?) ?? const [];
          final complete = documents?['complete'] == true;

          return ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Text(
                '${overview?['studentNumber'] != null ? '#${overview!['studentNumber']} ' : ''}${overview?['fullName'] ?? widget.fallbackName}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (overview != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${overview['packageName'] != null ? '${overview['packageName']} • ' : ''}${overview['licenseClass'] ?? ''} • ${_transmission(overview['transmissionType'])} • ${_statusLabel(overview['status'])}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    DrivingStatusPill(
                      label: overview['automaticStatusEnabled'] == true
                          ? 'Otomatik yönetim'
                          : 'Manuel yönetim',
                      tone: DrivingTone.neutral,
                    ),
                    if (overview['trainingOverrideActive'] == true)
                      const DrivingStatusPill(
                        label: 'Yetkili eğitim istisnası',
                        tone: DrivingTone.warning,
                      ),
                    if (_canUpdateLifecycle)
                      OutlinedButton.icon(
                        onPressed: () => _editLifecycle(overview),
                        icon: const Icon(Icons.manage_accounts_rounded),
                        label: Text('Durumu yönet'.tr),
                      ),
                    if ('${overview['studentProfileId'] ?? ''}'.isNotEmpty)
                      OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => ConsentCenterPage(
                              studentProfileId:
                                  '${overview['studentProfileId']}',
                              studentName: '${overview['fullName'] ?? ''}',
                              contextKind: 'DrivingEnrollment',
                              contextKey: '${overview['packageId'] ?? ''}',
                              contextLabel:
                                  '${overview['packageName'] ?? ''} • ${overview['licenseClass'] ?? ''}',
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.draw_outlined),
                        label: Text('Onam formları'.tr),
                      ),
                  ],
                ),
                // Eksik onam formu şeridi — kurum form tanımlamadıysa çizilmez.
                const SizedBox(height: 10),
                ConsentAlertBanner(
                  studentProfileId: '${overview['studentProfileId'] ?? ''}',
                  studentName: '${overview['fullName'] ?? ''}',
                  contextKind: 'DrivingEnrollment',
                  contextKey: '${overview['packageId'] ?? ''}',
                  contextLabel:
                      '${overview['packageName'] ?? ''} • ${overview['licenseClass'] ?? ''}',
                ),
                if ('${overview['identitySerialNo'] ?? ''}'.isNotEmpty ||
                    '${overview['studentPhone'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    [
                      if ('${overview['identitySerialNo'] ?? ''}'.isNotEmpty)
                        '${'Seri no'.tr}: ${overview['identitySerialNo']}',
                      if ('${overview['studentPhone'] ?? ''}'.isNotEmpty)
                        '${'Telefon'.tr}: ${overview['studentPhone']}',
                    ].join(' • '),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if ('${overview['fatherName'] ?? ''}'.isNotEmpty ||
                    '${overview['motherName'] ?? ''}'.isNotEmpty ||
                    '${overview['birthPlace'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    [
                      if ('${overview['fatherName'] ?? ''}'.isNotEmpty)
                        '${'Baba'.tr}: ${overview['fatherName']}',
                      if ('${overview['motherName'] ?? ''}'.isNotEmpty)
                        '${'Anne'.tr}: ${overview['motherName']}',
                      if ('${overview['birthPlace'] ?? ''}'.isNotEmpty)
                        '${'Doğum yeri'.tr}: ${overview['birthPlace']}',
                    ].join(' • '),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                // MEBBİS aday girişi için eksik kalan alanlar.
                if ((data['mebbisMissing'] as List?)?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          size: 16,
                          color: Color(0xFFF59E0B),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${'MEBBİS için eksik'.tr}: ${(data['mebbisMissing'] as List).join(', ')}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if ('${overview['residenceAddress'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.home_rounded, size: 14),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '${'İkametgâh'.tr}: ${overview['residenceAddress']}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
              // İki fotoğraf: biyografik + anlık (web kamera) — görüntü olarak.
              if (overview != null &&
                  ('${overview['photoUrl'] ?? ''}'.isNotEmpty ||
                      '${overview['livePhotoUrl'] ?? ''}'.isNotEmpty)) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    _photoTile(overview['photoUrl'], 'Biyografik'.tr),
                    const SizedBox(width: 12),
                    _photoTile(overview['livePhotoUrl'], 'Anlık'.tr),
                  ],
                ),
              ],
              // Mevcut sürücü belgesi
              if (overview?['hasExistingLicense'] == true) ...[
                const SizedBox(height: 12),
                const DrivingSectionTitle(title: 'Mevcut sürücü belgesi'),
                const SizedBox(height: 6),
                _licenseLine(
                  'Geçmek istediği sınıf'.tr,
                  overview!['targetLicenseClass'] ?? overview['licenseClass'],
                ),
                _licenseLine(
                  'Önceki belge no'.tr,
                  overview['existingLicenseNumber'],
                ),
                _licenseLine(
                  'Önceki sınıf(lar)'.tr,
                  overview['existingLicenseClasses'],
                ),
                _licenseLine('Veren makam'.tr, overview['licenseIssuePlace']),
              ],
              // Sınav ücretleri
              if (overview != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DrivingSectionTitle(title: 'Sınav ücretleri'.tr),
                    ),
                    if (_canCollect)
                      TextButton.icon(
                        onPressed: () => _editExamFees(overview),
                        icon: const Icon(Icons.edit_rounded, size: 16),
                        label: Text('Düzenle'.tr),
                      ),
                  ],
                ),
                _examFeeRow(
                  '${'Direksiyon sınavı'.tr} • ${((data['examRights']?['practice']?['used'] as num?)?.toInt() ?? 1)}. giriş',
                  overview['drivingExamFee'],
                  overview['drivingExamFeePaid'] == true,
                ),
                if (overview['drivingExamDate'] != null)
                  _licenseLine(
                    'Direksiyon sınav tarihi'.tr,
                    _dateOnly(overview['drivingExamDate']),
                  ),
              ],
              // Sınav hakları (mevzuat: her türde en fazla 4)
              if (data['examRights'] != null) ...[
                const SizedBox(height: 12),
                const DrivingSectionTitle(title: 'Sınav hakları'),
                const SizedBox(height: 6),
                _examRightRow(
                  'Teorik (e-sınav)'.tr,
                  data['examRights']['theory'],
                ),
                _examRightRow(
                  'Direksiyon sınavı'.tr,
                  data['examRights']['practice'],
                ),
              ],
              const SizedBox(height: 14),
              const DrivingSectionTitle(title: 'MEBBİS zaman çizelgesi'),
              const SizedBox(height: 8),
              if (_historyLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_mebbisHistory.isEmpty)
                const DrivingEmptyState(
                  icon: Icons.history_toggle_off_rounded,
                  title: 'Henüz MEBBİS işlem kaydı yok.',
                )
              else
                ..._mebbisHistory.map(_mebbisHistoryRow),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color:
                      (complete
                              ? const Color(0xFF10B981)
                              : const Color(0xFFF59E0B))
                          .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Icon(
                      complete
                          ? Icons.check_circle_rounded
                          : Icons.warning_amber_rounded,
                      color: complete
                          ? const Color(0xFF10B981)
                          : const Color(0xFFF59E0B),
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        complete
                            ? 'Kurs dosyası tamam — tüm zorunlu evraklar onaylı.'
                                  .tr
                            : '${documents?['missingCount'] ?? 0} eksik, ${documents?['pendingCount'] ?? 0} onay bekliyor.',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const DrivingSectionTitle(title: 'Belgeler'),
              const SizedBox(height: 8),
              if (items.isEmpty)
                DrivingEmptyState(
                  icon: Icons.folder_off_rounded,
                  title: 'Belge yok.'.tr,
                )
              else
                ...items.map((raw) {
                  final item = Map<String, dynamic>.from(raw as Map);
                  final tone = _documentTone(item['status']);
                  final fileUrl = item['fileUrl'] as String?;
                  return DrivingListRow(
                    icon: Icons.description_rounded,
                    title: '${item['label'] ?? item['documentType']}',
                    subtitle: [
                      if (item['required'] == true) 'Zorunlu',
                      item['uploadedAtUtc'] != null
                          ? 'Yüklendi: ${_dateOnly(item['uploadedAtUtc'])}'
                          : 'Yüklenmedi',
                      if (item['rejectionReason'] != null)
                        'Ret: ${item['rejectionReason']}',
                    ].join(' • '),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (fileUrl != null && fileUrl.isNotEmpty)
                          IconButton(
                            icon: const Icon(
                              Icons.open_in_new_rounded,
                              size: 18,
                            ),
                            onPressed: () => _openFile(fileUrl),
                          ),
                        DrivingStatusPill(label: tone.label, tone: tone.tone),
                      ],
                    ),
                  );
                }),
            ],
          );
        },
      ),
    );
  }

  Widget _mebbisHistoryRow(Map<String, dynamic> item) {
    final severity = '${item['severity'] ?? 'Info'}';
    final color = severity == 'Error'
        ? Colors.red
        : severity == 'Warning'
        ? Colors.orange
        : severity == 'Success'
        ? Colors.green
        : Colors.blue;
    final date = DateTime.tryParse('${item['occurredAtUtc'] ?? ''}')?.toLocal();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item['title'] ?? ''}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                if ('${item['description'] ?? ''}'.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '${item['description']}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  '${date == null ? '—' : '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}'} • ${item['actorName'] ?? 'Sistem'}',
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
