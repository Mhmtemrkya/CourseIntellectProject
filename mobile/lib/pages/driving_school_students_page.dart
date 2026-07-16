import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
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
  String _search = '';

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
      if (!mounted) return;
      setState(() => _students = rows);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    if (term.isEmpty) return _students;
    return _students
        .where((s) => '${s['fullName'] ?? ''}'.toLowerCase().contains(term))
        .toList();
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

  @override
  Widget build(BuildContext context) {
    final activeCount = _students
        .where((s) => s['status'] != 'Graduated' && s['status'] != 'Cancelled')
        .length;
    final graduated = _students.where((s) => s['status'] == 'Graduated').length;

    return DrivingScaffold(
      appBar: AppBar(title: Text('Öğrenciler'.tr)),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? DrivingErrorState(error: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DrivingHero(
                    eyebrow: 'KURSİYERLER'.tr,
                    title: 'Öğrenciler'.tr,
                    description:
                        'Bir kursiyere dokunarak sisteme yüklenen belgelerini inceleyin.'.tr,
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
                  const SizedBox(height: 14),
                  if (_filtered.isEmpty)
                    DrivingEmptyState(
                      icon: Icons.groups_rounded,
                      title: _search.isEmpty
                          ? 'Henüz kursiyer yok.'.tr
                          : 'Eşleşen kursiyer yok.'.tr,
                    )
                  else
                    ..._filtered.map(
                      (s) => DrivingListRow(
                        icon: Icons.person_rounded,
                        title: '${s['fullName'] ?? '—'}',
                        subtitle:
                            '${s['licenseClass'] ?? ''} • ${_transmission(s['transmissionType'])} • ${s['remainingDrivingMinutes'] ?? 0} dk kaldı',
                        trailing: DrivingStatusPill(
                          label: _statusLabel(s['status']),
                          tone: DrivingTone.accent,
                        ),
                        onTap: () => _openStudent(s),
                      ),
                    ),
                ],
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

  @override
  void initState() {
    super.initState();
    _future = DrivingSchoolApiService.instance.studentDetail(widget.profileId);
  }

  Future<void> _openFile(String? url) async {
    if (url == null || url.isEmpty) return;
    final resolved = ApiConfig.resolveAssetUrl(url);
    final uri = Uri.tryParse(resolved);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
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
