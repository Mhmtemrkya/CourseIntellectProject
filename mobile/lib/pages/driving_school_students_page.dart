import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

const _statusLabels = {
  'PreRegistered': 'Ön kayıt',
  'DocumentsPending': 'Evrak bekliyor',
  'Active': 'Aktif',
  'TheoryOngoing': 'Teorik eğitimde',
  'PracticeOngoing': 'Direksiyonda',
  'ExamPending': 'Sınav bekliyor',
  'Graduated': 'Mezun',
  'Suspended': 'Askıda',
  'Cancelled': 'İptal',
};

String _statusLabel(dynamic status) => _statusLabels['$status'] ?? '$status';
String _transmission(dynamic v) => (v == 'Manual' || v == 1) ? 'Manuel' : 'Otomatik';

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
  const DrivingSchoolStudentsPage({super.key});

  @override
  State<DrivingSchoolStudentsPage> createState() => _DrivingSchoolStudentsPageState();
}

class _DrivingSchoolStudentsPageState extends State<DrivingSchoolStudentsPage> {
  final _service = DrivingSchoolApiService.instance;
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _groups = [];
  int _ungroupedCount = 0;
  String _search = '';
  String _groupFilter = 'all'; // 'all' | 'ungrouped' | <groupId>
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;

  bool _selectMode = false;
  final Set<String> _selected = {};
  String? _assignTarget;
  bool _assigning = false;

  bool get _canManageGroups => _permissions.can(DrivingPermissions.studentUpdate);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _service.students();
      final permissions = await DrivingPermissionsStore.instance.load();
      Map<String, dynamic>? groupData;
      try {
        groupData = await _service.studentGroups();
      } catch (_) {
        groupData = null;
      }
      if (!mounted) return;
      setState(() {
        _students = rows;
        _permissions = permissions;
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

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    return _students.where((s) {
      final groupId = s['groupId'];
      if (_groupFilter == 'ungrouped' && groupId != null) return false;
      if (_groupFilter != 'all' && _groupFilter != 'ungrouped' && '$groupId' != _groupFilter) {
        return false;
      }
      if (term.isNotEmpty && !'${s['fullName'] ?? ''}'.toLowerCase().contains(term)) {
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
    final nameCtrl = TextEditingController();
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
              decoration: InputDecoration(labelText: 'Grup adı'.tr, hintText: 'Örn. Temmuz 2026 grubu'),
            ),
            TextField(
              controller: descCtrl,
              maxLength: 500,
              decoration: InputDecoration(labelText: 'Açıklama (opsiyonel)'.tr),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
          FilledButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.length < 2) return;
              try {
                await _service.createStudentGroup(name, description: descCtrl.text.trim());
                if (dialogContext.mounted) Navigator.pop(dialogContext, true);
              } catch (e) {
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    SnackBar(content: Text('$e')),
                  );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Grup oluşturuldu.'.tr)),
        );
      }
      await _load();
    }
  }

  Future<void> _assign(String? groupId) async {
    if (_selected.isEmpty) return;
    setState(() => _assigning = true);
    try {
      final result = await _service.assignStudentGroup(_selected.toList(), groupId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${result['assigned'] ?? _selected.length} kursiyer güncellendi.')),
        );
      }
      _exitSelectMode();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
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
        title: Text(_selectMode ? '${_selected.length} seçili' : 'Öğrenciler'.tr),
        leading: _selectMode
            ? IconButton(icon: const Icon(Icons.close_rounded), onPressed: _exitSelectMode)
            : null,
        actions: [
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
                              'Kursiyerleri gruplara (dönemlere) ayırın; belgelerini inceleyin.'.tr,
                          icon: Icons.groups_rounded,
                          metrics: [
                            DrivingHeroMetric(label: 'Toplam'.tr, value: '${_students.length}'),
                            const SizedBox(width: 10),
                            DrivingHeroMetric(label: 'Aktif'.tr, value: '$activeCount'),
                            const SizedBox(width: 10),
                            DrivingHeroMetric(label: 'Mezun'.tr, value: '$graduated'),
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
                        _groupFilterChips(),
                        const SizedBox(height: 12),
                        if (_filtered.isEmpty)
                          DrivingEmptyState(
                            icon: Icons.groups_rounded,
                            title: _search.isEmpty && _groupFilter == 'all'
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

  Widget _groupFilterChips() {
    final chips = <Widget>[
      _filterChip('all', 'Tümü'.tr, _students.length),
      ..._activeGroups.map((g) => _filterChip('${g['id']}', '${g['name']}', (g['studentCount'] as num?)?.toInt() ?? 0)),
      if (_ungroupedCount > 0) _filterChip('ungrouped', 'Grupsuz'.tr, _ungroupedCount),
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

  Widget _studentRow(Map<String, dynamic> s) {
    final id = '${s['id']}';
    final checked = _selected.contains(id);
    final groupName = s['groupName'];
    return DrivingListRow(
      icon: _selectMode
          ? (checked ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded)
          : Icons.person_rounded,
      title: '${s['fullName'] ?? '—'}',
      subtitle: [
        '${s['licenseClass'] ?? ''} • ${_transmission(s['transmissionType'])} • ${s['remainingDrivingMinutes'] ?? 0} dk kaldı',
        if (groupName != null) 'Grup: $groupName',
      ].join('\n'),
      trailing: DrivingStatusPill(
        label: _statusLabel(s['status']),
        tone: DrivingTone.accent,
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
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    hintText: 'Grup seçin…'.tr,
                  ),
                  items: _activeGroups
                      .map((g) => DropdownMenuItem(value: '${g['id']}', child: Text('${g['name']}')))
                      .toList(),
                  onChanged: _assigning ? null : (v) => setState(() => _assignTarget = v),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: (_assigning || _assignTarget == null || _selected.isEmpty)
                    ? null
                    : () => _assign(_assignTarget),
                child: Text('Ata'.tr),
              ),
              const SizedBox(width: 6),
              OutlinedButton(
                onPressed: (_assigning || _selected.isEmpty) ? null : () => _assign(null),
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

  const _StudentDocumentsSheet({required this.profileId, required this.fallbackName});

  @override
  State<_StudentDocumentsSheet> createState() => _StudentDocumentsSheetState();
}

class _StudentDocumentsSheetState extends State<_StudentDocumentsSheet> {
  late Future<Map<String, dynamic>> _future;
  bool _canCollect = false;

  @override
  void initState() {
    super.initState();
    _future = DrivingSchoolApiService.instance.studentDetail(widget.profileId);
    DrivingPermissionsStore.instance.load().then((p) {
      if (mounted) setState(() => _canCollect = p.can(DrivingPermissions.financeCollect));
    });
  }

  void _reload() {
    setState(() {
      _future = DrivingSchoolApiService.instance.studentDetail(widget.profileId);
    });
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
    final theoryCtrl = TextEditingController(text: '${(overview['theoryExamFee'] as num?)?.toInt() ?? 0}');
    final drivingCtrl = TextEditingController(text: '${(overview['drivingExamFee'] as num?)?.toInt() ?? 0}');
    var theoryPaid = overview['theoryExamFeePaid'] == true;
    var drivingPaid = overview['drivingExamFeePaid'] == true;

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text('Sınav ücretleri'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: theoryCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: '${'Teorik (e-sınav)'.tr} (₺)'),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Teorik ödendi'.tr),
                  value: theoryPaid,
                  onChanged: (v) => setDialogState(() => theoryPaid = v),
                ),
                TextField(
                  controller: drivingCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: '${'Direksiyon sınavı'.tr} (₺)'),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Direksiyon ödendi'.tr),
                  value: drivingPaid,
                  onChanged: (v) => setDialogState(() => drivingPaid = v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
            FilledButton(
              onPressed: () async {
                try {
                  await DrivingSchoolApiService.instance.updateExamFees(
                    widget.profileId,
                    theoryExamFee: num.tryParse(theoryCtrl.text.trim()) ?? 0,
                    drivingExamFee: num.tryParse(drivingCtrl.text.trim()) ?? 0,
                    theoryExamFeePaid: theoryPaid,
                    drivingExamFeePaid: drivingPaid,
                  );
                  if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                } catch (e) {
                  if (dialogContext.mounted) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text('$e')));
                  }
                }
              },
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    theoryCtrl.dispose();
    drivingCtrl.dispose();
    if (saved == true) _reload();
  }

  Widget _examFeeRow(String label, dynamic fee, bool paid) {
    final amount = (fee as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
          Text(_money(fee), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
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
            child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
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
            return const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
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
                '${overview?['fullName'] ?? widget.fallbackName}',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              if (overview != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${overview['packageName'] != null ? '${overview['packageName']} • ' : ''}${overview['licenseClass'] ?? ''} • ${_transmission(overview['transmissionType'])} • ${_statusLabel(overview['status'])}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
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
                _licenseLine('Geçmek istediği sınıf'.tr, overview!['targetLicenseClass'] ?? overview['licenseClass']),
                _licenseLine('Önceki belge no'.tr, overview['existingLicenseNumber']),
                _licenseLine('Önceki sınıf(lar)'.tr, overview['existingLicenseClasses']),
                _licenseLine('Veriliş'.tr, _dateOnly(overview['licenseIssueDate'])),
                _licenseLine('Son geçerlilik'.tr, _dateOnly(overview['licenseExpiryDate'])),
                _licenseLine('Veren makam'.tr, overview['licenseIssuePlace']),
              ],
              // Sınav ücretleri
              if (overview != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: DrivingSectionTitle(title: 'Sınav ücretleri'.tr)),
                    if (_canCollect)
                      TextButton.icon(
                        onPressed: () => _editExamFees(overview),
                        icon: const Icon(Icons.edit_rounded, size: 16),
                        label: Text('Düzenle'.tr),
                      ),
                  ],
                ),
                _examFeeRow('Teorik (e-sınav)'.tr, overview['theoryExamFee'], overview['theoryExamFeePaid'] == true),
                _examFeeRow('Direksiyon sınavı'.tr, overview['drivingExamFee'], overview['drivingExamFeePaid'] == true),
              ],
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: (complete ? const Color(0xFF10B981) : const Color(0xFFF59E0B)).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Icon(
                      complete ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                      color: complete ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        complete
                            ? 'Kurs dosyası tamam — tüm zorunlu evraklar onaylı.'.tr
                            : '${documents?['missingCount'] ?? 0} eksik, ${documents?['pendingCount'] ?? 0} onay bekliyor.',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const DrivingSectionTitle(title: 'Belgeler'),
              const SizedBox(height: 8),
              if (items.isEmpty)
                DrivingEmptyState(icon: Icons.folder_off_rounded, title: 'Belge yok.'.tr)
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
                      if (item['expiresAtUtc'] != null) 'Geçerlilik: ${_dateOnly(item['expiresAtUtc'])}',
                      if (item['rejectionReason'] != null) 'Ret: ${item['rejectionReason']}',
                    ].join(' • '),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (fileUrl != null && fileUrl.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.open_in_new_rounded, size: 18),
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
}
