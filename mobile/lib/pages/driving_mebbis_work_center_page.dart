import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/api_config.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';
import 'driving_mebbis_entry_assistant_page.dart';
import 'driving_document_review_queue_page.dart';
import 'driving_term_opening_wizard_page.dart';
import 'driving_transfer_packages_page.dart';
import 'driving_mebbis_imports_page.dart';
import 'driving_mebbis_reconciliations_page.dart';
import 'driving_mebbis_exam_results_page.dart';
import 'driving_mebbis_certificate_numbers_page.dart';

class DrivingMebbisWorkCenterPage extends StatefulWidget {
  const DrivingMebbisWorkCenterPage({super.key});

  @override
  State<DrivingMebbisWorkCenterPage> createState() =>
      _DrivingMebbisWorkCenterPageState();
}

class _DrivingMebbisWorkCenterPageState
    extends State<DrivingMebbisWorkCenterPage> {
  static const _statusLabels = <String, String>{
    'Preparing': 'Hazırlanıyor',
    'Ready': 'MEBBİS’e hazır',
    'EntryPending': 'Giriş bekliyor',
    'Entered': 'MEBBİS’e girildi',
    'Verified': 'Doğrulandı',
    'Error': 'Hatalı',
    'CorrectionPending': 'Düzeltme bekliyor',
  };
  static const _typeLabels = <String, String>{
    'CandidateRegistration': 'Aday kaydı',
    'DocumentApproval': 'Evrak onayı',
    'TermAssignment': 'Dönem ataması',
    'ExamResult': 'Sınav sonucu',
    'CertificateNumber': 'Sertifika numarası',
    'TermDeadline': 'Dönem son tarihi',
    'Reconciliation': 'Mutabakat',
  };
  static const _next = <String, List<String>>{
    'Preparing': ['Ready'],
    'Ready': ['EntryPending'],
    'EntryPending': ['Entered'],
    'Entered': ['Verified'],
    'Verified': [],
    'Error': ['CorrectionPending'],
    'CorrectionPending': ['Ready'],
  };

  final _search = TextEditingController();
  Map<String, dynamic>? _data;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  bool _loading = true;
  String? _error;
  String _status = '';
  String _type = '';
  String _saving = '';
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final permissions = await DrivingPermissionsStore.instance.load();
      if (!permissions.can(DrivingPermissions.mebbisView)) {
        throw StateError('MEBBİS İş Merkezi görüntüleme yetkiniz yok.');
      }
      if (permissions.can(DrivingPermissions.mebbisManage)) {
        try {
          await DrivingSchoolApiService.instance.syncMebbisWorkCenter();
        } catch (_) {
          // Başka kullanıcı aynı anda eşitlediyse güncel liste yine okunabilir.
        }
      }
      final data = await DrivingSchoolApiService.instance.mebbisWorkCenter(
        status: _status,
        type: _type,
        search: _search.text,
        page: _page,
      );
      if (mounted) {
        setState(() {
          _permissions = permissions;
          _data = data;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Bad state: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _export() async {
    setState(() => _saving = 'export');
    try {
      final bytes = await DrivingSchoolApiService.instance
          .downloadMebbisWorkCenter(
            status: _status,
            type: _type,
            search: _search.text,
          );
      final date = DateTime.now().toIso8601String().substring(0, 10);
      final name = 'mebbis-is-merkezi-$date.csv';
      final file = File('${(await getTemporaryDirectory()).path}/$name');
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'text/csv')],
          title: 'MEBBİS İş Merkezi',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  Future<String?> _reason(String title) async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          maxLength: 1000,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(
            labelText: 'Gerekçe',
            hintText: 'En az 10 karakter',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.length >= 10) Navigator.pop(context, text);
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    controller.dispose();
    return value;
  }

  Future<void> _change(Map<String, dynamic> item, String target) async {
    var reason = '';
    if (target == 'Error' || target == 'CorrectionPending') {
      final resolved = await _reason(
        target == 'Error' ? 'Hata/uyuşmazlık bildir' : 'Düzeltmeye al',
      );
      if (resolved == null) return;
      reason = resolved;
    }
    final key = '${item['workType']}-${item['subjectId']}';
    setState(() => _saving = key);
    try {
      await DrivingSchoolApiService.instance.changeMebbisWorkStatus(
        '${item['workType']}',
        '${item['subjectId']}',
        target,
        (item['version'] as num?)?.toInt() ?? 0,
        reason: reason,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('MEBBİS iş durumu güncellendi.')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  Color _statusColor(String status) => switch (status) {
    'Verified' => Colors.green,
    'Error' => Colors.red,
    'CorrectionPending' => Colors.deepOrange,
    'Entered' => Colors.blue,
    'Ready' => Colors.lightBlue,
    'EntryPending' => Colors.purple,
    _ => Colors.amber,
  };

  @override
  Widget build(BuildContext context) {
    final summary = Map<String, dynamic>.from(
      _data?['summary'] as Map? ?? const {},
    );
    final items = (_data?['items'] as List? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final deadlines = (_data?['deadlines'] as List? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final pagination = Map<String, dynamic>.from(
      _data?['pagination'] as Map? ?? const {},
    );
    final totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;
    return DrivingScaffold(
      appBar: AppBar(
        title: const Text('MEBBİS İş Merkezi'),
        actions: [
          IconButton(
            tooltip: 'Filtrelenen listeyi indir',
            onPressed:
                _permissions.can(DrivingPermissions.reportExport) &&
                    _saving != 'export'
                ? _export
                : null,
            icon: _saving == 'export'
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download_rounded),
          ),
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      child: _loading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.lock_outline_rounded, size: 48),
                    const SizedBox(height: 12),
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Yeniden Dene'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.calendar_month_rounded),
                      title: const Text(
                        'Dönem Açma Sihirbazı',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Kontenjan, kursiyer, evrak ve teorik programı sekiz adımda doğrulayın.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _permissions.can(DrivingPermissions.mebbisManage)
                          ? () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    const DrivingTermOpeningWizardPage(),
                              ),
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.workspace_premium_rounded),
                      title: const Text(
                        'Sertifika No Toplu Aktarımı',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'MEBBİS listesini TC/kursiyer numarasıyla eşleştirip mükerrerleri güvenle engelleyin.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const DrivingMebbisCertificateNumbersPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.fact_check_rounded),
                      title: const Text(
                        'Sınav Sonucu Mutabakatı',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'MEBBİS sonuçlarını hak, puan, tekrar sınavı ve ücret etkisiyle kontrol edin.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DrivingMebbisExamResultsPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.compare_arrows_rounded),
                      title: const Text(
                        'MEBBİS Mutabakatı',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Dönem listesini karşılaştırın; eksik ve farklı kayıtları anında görün.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const DrivingMebbisReconciliationsPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.file_open_rounded),
                      title: const Text(
                        'MEBBİS’ten Geri Aktarım',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Excel/CSV dosyasını önizleyip onaylanan değişiklikleri uygulayın.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DrivingMebbisImportsPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.archive_rounded),
                      title: const Text(
                        'MEBBİS Aktarım Paketleri',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Dönem CSV paketlerini sürümlü ve güvenli arşivde yönetin.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DrivingTransferPackagesPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.fact_check_rounded),
                      title: const Text(
                        'Evrak Onay Kuyruğu',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Sağlık, diploma, kimlik ve diğer MEBBİS belgelerini inceleyin.',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const DrivingDocumentReviewQueuePage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _summary(summary),
                  if (deadlines.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Card(
                      color: Colors.amber.withValues(alpha: .08),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Yaklaşan dönem son tarihleri',
                              style: TextStyle(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 8),
                            ...deadlines.map(
                              (x) => Text(
                                '• ${x['title']} — ${x['overdue'] == true ? '${(x['daysRemaining'] as num).abs()} gün geçti' : '${x['daysRemaining']} gün'}',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: _search,
                    maxLength: 100,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) {
                      setState(() => _page = 1);
                      _load();
                    },
                    decoration: InputDecoration(
                      counterText: '',
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Kursiyer veya referans ara',
                      suffixIcon: IconButton(
                        onPressed: () {
                          setState(() => _page = 1);
                          _load();
                        },
                        icon: const Icon(Icons.arrow_forward_rounded),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _status,
                          decoration: const InputDecoration(labelText: 'Durum'),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('Tümü'),
                            ),
                            ..._statusLabels.entries.map(
                              (x) => DropdownMenuItem(
                                value: x.key,
                                child: Text(x.value),
                              ),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() {
                              _status = v ?? '';
                              _page = 1;
                            });
                            _load();
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _type,
                          decoration: const InputDecoration(
                            labelText: 'İş türü',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('Tümü'),
                            ),
                            ..._typeLabels.entries.map(
                              (x) => DropdownMenuItem(
                                value: x.key,
                                child: Text(x.value),
                              ),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() {
                              _type = v ?? '';
                              _page = 1;
                            });
                            _load();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (items.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Column(
                          children: [
                            Icon(
                              Icons.verified_rounded,
                              color: Colors.green,
                              size: 42,
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Bu filtrede açık iş yok.',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ...items.map(_itemCard),
                  if (totalPages > 1) ...[
                    const SizedBox(height: 8),
                    _pagination(),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _pagination() {
    final pagination = Map<String, dynamic>.from(
      _data?['pagination'] as Map? ?? const {},
    );
    final total = (pagination['total'] as num?)?.toInt() ?? 0;
    final totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(
              'Toplam $total kayıt · Sayfa $_page/$totalPages',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _loading || _page <= 1
                        ? null
                        : () {
                            setState(() => _page--);
                            _load();
                          },
                    icon: const Icon(Icons.chevron_left_rounded),
                    label: const Text('Önceki'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _loading || _page >= totalPages
                        ? null
                        : () {
                            setState(() => _page++);
                            _load();
                          },
                    icon: const Icon(Icons.chevron_right_rounded),
                    label: const Text('Sonraki'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _summary(Map<String, dynamic> s) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      _metric(
        'Açık iş',
        ((s['total'] as num?)?.toInt() ?? 0) -
            ((s['verified'] as num?)?.toInt() ?? 0),
        Icons.pending_actions_rounded,
        Colors.blue,
      ),
      _metric(
        'Eksik bilgi',
        (s['missingInformation'] as num?)?.toInt() ?? 0,
        Icons.warning_amber_rounded,
        Colors.amber,
      ),
      _metric(
        'Evrak onayı',
        (s['documentApproval'] as num?)?.toInt() ?? 0,
        Icons.description_rounded,
        Colors.purple,
      ),
      _metric(
        'Hatalı',
        ((s['error'] as num?)?.toInt() ?? 0) +
            ((s['correctionPending'] as num?)?.toInt() ?? 0),
        Icons.error_outline_rounded,
        Colors.red,
      ),
    ],
  );

  Widget _metric(String label, int value, IconData icon, Color color) =>
      SizedBox(
        width: 150,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: color.withValues(alpha: .12),
                  child: Icon(icon, color: color),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$value',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(label, style: const TextStyle(fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

  Widget _itemCard(Map<String, dynamic> item) {
    final status = '${item['status']}';
    final key = '${item['workType']}-${item['subjectId']}';
    final canManage = _permissions.can(DrivingPermissions.mebbisManage);
    final actions =
        ('${item['workType']}' == 'TermDeadline'
                ? const <String>[]
                : (_next[status] ?? const []))
            .where(
              (x) =>
                  canManage &&
                  (x != 'Verified' ||
                      _permissions.can(DrivingPermissions.mebbisVerify)),
            )
            .toList();
    final missing = (item['missing'] as List? ?? const [])
        .map((x) => '$x')
        .toList();
    final rawPhoto = '${item['photoUrl'] ?? ''}';
    final photoUrl = rawPhoto.isEmpty
        ? ''
        : rawPhoto.startsWith('http')
        ? rawPhoto
        : '${ApiConfig.baseUrl}$rawPhoto';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (photoUrl.isNotEmpty) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      photoUrl,
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 48,
                        height: 48,
                        color: Theme.of(context).colorScheme.primaryContainer,
                        child: const Icon(Icons.person_rounded),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item['title']}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        '${item['reference']}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Chip(
                  side: BorderSide.none,
                  backgroundColor: _statusColor(status).withValues(alpha: .12),
                  label: Text(
                    _statusLabels[status] ?? status,
                    style: TextStyle(
                      color: _statusColor(status),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _typeLabels['${item['workType']}'] ?? '${item['category']}',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            if (missing.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 5,
                runSpacing: 5,
                children: missing
                    .map(
                      (x) => Chip(
                        label: Text(x, style: const TextStyle(fontSize: 11)),
                        visualDensity: VisualDensity.compact,
                      ),
                    )
                    .toList(),
              ),
            ],
            if ('${item['errorReason']}'.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Hata: ${item['errorReason']}',
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: actions
                    .map(
                      (target) => OutlinedButton(
                        onPressed: _saving == key
                            ? null
                            : () => _change(item, target),
                        child: Text(_statusLabels[target] ?? target),
                      ),
                    )
                    .toList(),
              ),
            ],
            if (canManage &&
                '${item['workType']}' == 'CandidateRegistration' &&
                item['studentDrivingProfileId'] != null &&
                status != 'Verified') ...[
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => DrivingMebbisEntryAssistantPage(
                        profileId: '${item['studentDrivingProfileId']}',
                      ),
                    ),
                  );
                  if (mounted) await _load();
                },
                icon: const Icon(Icons.content_copy_rounded),
                label: const Text('Giriş Asistanı'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
