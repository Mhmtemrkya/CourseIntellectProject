import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:file_picker/file_picker.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';
import '../services/uploads_api_service.dart';

class DrivingGraduationPage extends StatefulWidget {
  const DrivingGraduationPage({super.key});
  @override
  State<DrivingGraduationPage> createState() => _DrivingGraduationPageState();
}

class _DrivingGraduationPageState extends State<DrivingGraduationPage> {
  bool _loading = true, _saving = false;
  String? _error;
  Map<String, dynamic> _data = const {}, _checklists = {};
  Map<String, dynamic> _settings = const {};
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  List<Map<String, dynamic>> _list(String key) =>
      (_data[key] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  Map<String, dynamic>? get _certificateSetup =>
      _data['certificateSetup'] is Map
      ? Map<String, dynamic>.from(_data['certificateSetup'] as Map)
      : null;
  String _certificateSetupDetail() {
    final setup = _certificateSetup;
    if (setup == null) return '';
    if (setup['complete'] == true) {
      return '${setup['directorName']} • ${setup['directorTitle']} • Asgari devam %${setup['minimumTheoryAttendancePercent']}';
    }
    const labels = {
      'directorName': 'Müdür adı',
      'directorTitle': 'Müdür unvanı',
      'logoUrl': 'Kurum logosu',
      'signatureUrl': 'İmza görseli',
      'primaryColor': 'Sertifika rengi',
    };
    final missing = (setup['missingFields'] as List? ?? const [])
        .map((x) => labels['$x'] ?? '$x')
        .join(', ');
    return missing.isEmpty && setup['approved'] != true
        ? 'Sertifika önizlemesi kurum yöneticisi onayı bekliyor.'
        : missing;
  }

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
      final result = await Future.wait([
        DrivingSchoolApiService.instance.graduationOverview(),
        DrivingPermissionsStore.instance.load(),
        DrivingSchoolApiService.instance.drivingSettings(),
      ]);
      final permissions = result[1] as DrivingPermissionSnapshot;
      final settings = Map<String, dynamic>.from(
        result[2] as Map<String, dynamic>,
      );
      if (permissions.can(DrivingPermissions.settingsManage)) {
        final certificate = await DrivingSchoolApiService.instance
            .certificateSettings();
        settings.addAll({
          'certificateDirectorName': certificate['directorName'],
          'certificateDirectorTitle': certificate['directorTitle'],
          'certificateLogoUrl': certificate['logoUrl'],
          'certificateSignatureUrl': certificate['signatureUrl'],
          'certificatePrimaryColor': certificate['primaryColor'],
          'minimumTheoryAttendancePercent':
              certificate['minimumTheoryAttendancePercent'],
          'excusedAbsencePolicy': certificate['excusedAbsencePolicy'],
          'certificateSettingsApproved': certificate['approved'],
        });
      }
      if (mounted) {
        setState(() {
          _data = result[0] as Map<String, dynamic>;
          _permissions = permissions;
          _settings = settings;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _check(String id) async {
    try {
      final value = await DrivingSchoolApiService.instance.graduationChecklist(
        id,
      );
      if (mounted) setState(() => _checklists = {..._checklists, id: value});
    } catch (e) {
      _message('$e', error: true);
    }
  }

  void _message(String value, {bool error = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(value),
          backgroundColor: error ? Colors.red : null,
        ),
      );
    }
  }

  Future<void> _run(Future<dynamic> Function() action, String success) async {
    setState(() => _saving = true);
    try {
      await action();
      _message(success);
      await _load();
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _date(dynamic raw) {
    final d = DateTime.tryParse('$raw')?.toLocal();
    return d == null ? '-' : '${d.day}.${d.month}.${d.year}';
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(
      title: Text('Mezuniyet & Belgeler'.tr),
      actions: [
        if (_permissions.can(DrivingPermissions.settingsManage))
          IconButton(
            tooltip: 'Sertifika önizlemesi',
            icon: const Icon(Icons.picture_as_pdf_rounded),
            onPressed: _saving ? null : _shareCertificatePreview,
          ),
        if (_permissions.can(DrivingPermissions.settingsManage) &&
            _certificateSetup != null &&
            _certificateSetup?['approved'] != true &&
            (_certificateSetup?['missingFields'] as List? ?? const []).isEmpty)
          IconButton(
            tooltip: 'Önizlemeyi onayla',
            icon: const Icon(Icons.approval_rounded),
            onPressed: _saving ? null : _approveCertificateSettings,
          ),
        if (_permissions.can(DrivingPermissions.settingsManage))
          IconButton(
            tooltip: 'Mezuniyet ve sertifika ayarları',
            icon: const Icon(Icons.tune_rounded),
            onPressed: _saving ? null : _configureSettings,
          ),
      ],
    ),
    child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton(onPressed: _load, child: Text(_error!)),
          )
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                if (_certificateSetup != null)
                  Card(
                    color: _certificateSetup?['complete'] == true
                        ? Colors.green.withValues(alpha: .08)
                        : Colors.orange.withValues(alpha: .10),
                    child: ListTile(
                      leading: Icon(
                        _certificateSetup?['complete'] == true
                            ? Icons.verified_rounded
                            : Icons.warning_amber_rounded,
                        color: _certificateSetup?['complete'] == true
                            ? Colors.green
                            : Colors.orange,
                      ),
                      title: Text(
                        _certificateSetup?['complete'] == true
                            ? 'Kurum ve sertifika bilgileri hazır'
                            : 'Kurum bilgileri tamamlanmalı',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      subtitle: Text(_certificateSetupDetail()),
                      trailing:
                          _permissions.can(DrivingPermissions.settingsManage)
                          ? IconButton(
                              icon: const Icon(Icons.tune_rounded),
                              onPressed: _configureSettings,
                            )
                          : null,
                    ),
                  ),
                const Text(
                  'Mezuniyet kontrolü',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
                const Text(
                  'Evrak, eğitim, sınav, finans ve açık randevu koşulları otomatik doğrulanır.',
                ),
                const SizedBox(height: 14),
                ..._list('students').map((student) {
                  final id = '${student['id']}';
                  final graduation = _list('graduations')
                      .where((x) => '${x['studentDrivingProfileId']}' == id)
                      .firstOrNull;
                  final certificates = _list('certificates')
                      .where((x) => '${x['studentDrivingProfileId']}' == id)
                      .toList();
                  final checklist = _checklists[id] as Map<String, dynamic>?;
                  final requests = _list('actionRequests')
                      .where((x) => '${x['studentDrivingProfileId']}' == id)
                      .toList();
                  final items = (checklist?['items'] as List? ?? const [])
                      .map((e) => Map<String, dynamic>.from(e as Map))
                      .toList();
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const CircleAvatar(
                                child: Icon(Icons.workspace_premium_rounded),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${student['fullName']}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    Text(
                                      '${student['licenseClass']} • ${student['status']}',
                                    ),
                                  ],
                                ),
                              ),
                              Chip(
                                label: Text(
                                  '${graduation?['status'] ?? 'Kontrol Bekliyor'}',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: _saving ? null : () => _check(id),
                            icon: const Icon(Icons.fact_check_rounded),
                            label: Text('Kontrol Listesini Çalıştır'.tr),
                          ),
                          if (items.isNotEmpty) ...[
                            const Divider(),
                            ...items.map(
                              (x) => ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  x['completed'] == true
                                      ? Icons.check_circle
                                      : Icons.error_outline,
                                  color: x['completed'] == true
                                      ? Colors.green
                                      : Colors.orange,
                                ),
                                title: Text(
                                  '${x['label']}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text('${x['detail']}'),
                              ),
                            ),
                          ],
                          if (_permissions.can(
                                DrivingPermissions.graduationManage,
                              ) &&
                              checklist?['eligible'] == true &&
                              graduation?['graduatedAtUtc'] == null)
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: _saving
                                    ? null
                                    : () => _run(
                                        () => DrivingSchoolApiService.instance
                                            .graduateStudent(
                                              id,
                                              'Mobil kontrol listesi tamamlandı.',
                                            ),
                                        'Kursiyer mezun edildi.',
                                      ),
                                icon: const Icon(Icons.school_rounded),
                                label: Text('Kursiyeri Mezun Et'.tr),
                              ),
                            ),
                          if (_permissions.can(
                                DrivingPermissions.graduationOverrideRequest,
                              ) &&
                              checklist != null &&
                              checklist['eligible'] != true)
                            OutlinedButton.icon(
                              onPressed: _saving
                                  ? null
                                  : () => _requestOverride(id, items),
                              icon: const Icon(Icons.rule_rounded),
                              label: Text('İki Onaylı İstisna Talebi'.tr),
                            ),
                          if (graduation?['graduatedAtUtc'] != null)
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'Mezuniyet tarihi: ${_date(graduation?['graduatedAtUtc'])}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                if (_permissions.can(
                                  DrivingPermissions.graduationRevokeRequest,
                                ))
                                  IconButton(
                                    tooltip: 'Mezuniyeti geri alma talebi',
                                    icon: const Icon(Icons.undo_rounded),
                                    onPressed: () => _requestRevocation(id),
                                  ),
                              ],
                            ),
                          if (_permissions.can(
                                DrivingPermissions.certificateIssue,
                              ) &&
                              graduation?['graduatedAtUtc'] != null &&
                              certificates.isEmpty)
                            Wrap(
                              spacing: 8,
                              children: [
                                FilledButton.tonal(
                                  onPressed: () => _run(
                                    () => DrivingSchoolApiService.instance
                                        .issueCertificate(id, 'Completion'),
                                    'Tamamlama belgesi oluşturuldu.',
                                  ),
                                  child: Text('Tamamlama Belgesi'.tr),
                                ),
                                OutlinedButton(
                                  onPressed: () => _run(
                                    () => DrivingSchoolApiService.instance
                                        .issueCertificate(id, 'Achievement'),
                                    'Başarı belgesi oluşturuldu.',
                                  ),
                                  child: Text('Başarı Belgesi'.tr),
                                ),
                              ],
                            ),
                          ...requests.map(
                            (request) => Card(
                              color: Theme.of(context)
                                  .colorScheme
                                  .tertiaryContainer
                                  .withValues(alpha: .35),
                              child: ListTile(
                                title: Text(
                                  '${request['actionType']} • ${request['status']}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                subtitle: Text('${request['reason']}'),
                                trailing:
                                    _permissions.can(
                                          DrivingPermissions
                                              .graduationOverrideApprove,
                                        ) &&
                                        [
                                          'Pending',
                                          'FirstApproved',
                                        ].contains(request['status'])
                                    ? PopupMenuButton<String>(
                                        onSelected: (value) => _decideRequest(
                                          '${request['id']}',
                                          value == 'approve',
                                        ),
                                        itemBuilder: (_) => [
                                          PopupMenuItem(
                                            value: 'approve',
                                            child: Text('Onayla'.tr),
                                          ),
                                          PopupMenuItem(
                                            value: 'reject',
                                            child: Text('Reddet'.tr),
                                          ),
                                        ],
                                      )
                                    : null,
                              ),
                            ),
                          ),
                          ...certificates.map(
                            (certificate) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.file_present_rounded),
                              title: Text('${certificate['documentNumber']}'),
                              subtitle: Text(
                                '${certificate['type']} • v${certificate['version'] ?? 1} • ${certificate['status'] ?? 'Active'} • ${certificate['deliveryStatus']}',
                              ),
                              trailing: PopupMenuButton<String>(
                                onSelected: (value) {
                                  if (value == 'share') {
                                    _shareCertificate(certificate);
                                  }
                                  if (value == 'deliver') {
                                    _deliver(certificate);
                                  }
                                  if (value == 'reissue') {
                                    _certificateReason(certificate, false);
                                  }
                                  if (value == 'revoke') {
                                    _certificateReason(certificate, true);
                                  }
                                },
                                itemBuilder: (_) => [
                                  PopupMenuItem(
                                    value: 'share',
                                    child: Text('PDF indir / paylaş'.tr),
                                  ),
                                  if (_permissions.can(
                                        DrivingPermissions.certificateDeliver,
                                      ) &&
                                      certificate['deliveryStatus'] !=
                                          'Delivered')
                                    PopupMenuItem(
                                      value: 'deliver',
                                      child: Text('Teslim edildi'.tr),
                                    ),
                                  if (_permissions.can(
                                        DrivingPermissions.certificateIssue,
                                      ) &&
                                      certificate['status'] == 'Active')
                                    PopupMenuItem(
                                      value: 'reissue',
                                      child: Text('Yeniden bas'.tr),
                                    ),
                                  if (_permissions.can(
                                        DrivingPermissions.certificateRevoke,
                                      ) &&
                                      certificate['status'] == 'Active')
                                    PopupMenuItem(
                                      value: 'revoke',
                                      child: Text('İptal et'.tr),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
  );

  Future<void> _deliver(Map<String, dynamic> certificate) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Belge teslimi'.tr),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Teslim alan kişi'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text('Teslim Et'.tr),
          ),
        ],
      ),
    );
    if (ok == true && controller.text.trim().length >= 3) {
      await _run(
        () => DrivingSchoolApiService.instance.deliverCertificate(
          '${certificate['id']}',
          controller.text.trim(),
          '',
        ),
        'Belge teslim edildi.',
      );
    }
  }

  Future<String?> _ask(String title, String label, int minimum) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: label),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text('Devam'.tr),
          ),
        ],
      ),
    );
    final value = controller.text.trim();
    if (ok == true && value.length >= minimum) return value;
    if (ok == true) {
      _message('Gerekçe en az $minimum karakter olmalıdır.', error: true);
    }
    return null;
  }

  Future<void> _shareCertificate(Map<String, dynamic> certificate) async {
    try {
      final bytes = await DrivingSchoolApiService.instance.downloadCertificate(
        '${certificate['id']}',
      );
      final safeName = '${certificate['documentNumber']}'.replaceAll(
        RegExp(r'[^A-Za-z0-9_-]'),
        '_',
      );
      final file = File(
        '${(await getTemporaryDirectory()).path}/$safeName.pdf',
      );
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'application/pdf')],
          subject: 'Sürücü kursu belgesi ${certificate['documentNumber']}',
        ),
      );
    } catch (e) {
      _message('$e', error: true);
    }
  }

  Future<void> _requestOverride(
    String id,
    List<Map<String, dynamic>> items,
  ) async {
    final reason = await _ask('Mezuniyet istisnası', 'Ayrıntılı gerekçe', 20);
    if (reason == null) return;
    final keys = items
        .where(
          (x) =>
              x['completed'] != true &&
              const [
                'documents',
                'theory',
                'practice',
                'finance',
                'schedule',
              ].contains(x['key']),
        )
        .map((x) => '${x['key']}')
        .toList();
    if (keys.isEmpty) {
      _message('İstisnaya açık eksik madde yok.', error: true);
      return;
    }
    await _run(
      () => DrivingSchoolApiService.instance.requestGraduationOverride(
        id,
        reason,
        keys,
      ),
      'İki onaylı istisna talebi açıldı.',
    );
  }

  Future<void> _requestRevocation(String id) async {
    final reason = await _ask('Mezuniyeti geri al', 'Ayrıntılı gerekçe', 20);
    if (reason != null) {
      await _run(
        () => DrivingSchoolApiService.instance.requestGraduationRevocation(
          id,
          reason,
        ),
        'Geri alma talebi açıldı.',
      );
    }
  }

  Future<void> _decideRequest(String id, bool approve) async {
    final note = await _ask(
      approve ? 'Talebi onayla' : 'Talebi reddet',
      'Karar notu',
      approve ? 3 : 10,
    );
    if (note != null) {
      await _run(
        () => DrivingSchoolApiService.instance.decideGraduationAction(
          id,
          approve,
          note,
        ),
        'Karar kaydedildi.',
      );
    }
  }

  Future<void> _certificateReason(
    Map<String, dynamic> certificate,
    bool revoke,
  ) async {
    final reason = await _ask(
      revoke ? 'Sertifikayı iptal et' : 'Sertifikayı yeniden bas',
      'Gerekçe',
      10,
    );
    if (reason != null) {
      await _run(
        () => revoke
            ? DrivingSchoolApiService.instance.revokeCertificate(
                '${certificate['id']}',
                reason,
              )
            : DrivingSchoolApiService.instance.reissueCertificate(
                '${certificate['id']}',
                reason,
              ),
        revoke ? 'Sertifika iptal edildi.' : 'Yeni belge sürümü oluşturuldu.',
      );
    }
  }

  Future<void> _shareCertificatePreview() async {
    try {
      final bytes = await DrivingSchoolApiService.instance.certificatePreview();
      final file = File(
        '${(await getTemporaryDirectory()).path}/sertifika-onizleme.pdf',
      );
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'application/pdf')],
          subject: 'Sertifika önizlemesi',
        ),
      );
    } catch (e) {
      _message('$e', error: true);
    }
  }

  Future<void> _approveCertificateSettings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Sertifika tasarımını onayla'.tr),
        content: const Text(
          'PDF önizlemesini, kurum logosunu, müdür adı/unvanını ve imzayı kontrol ettiğinizi onaylıyor musunuz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text('Kontrol Ettim, Onayla'.tr),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _run(
        DrivingSchoolApiService.instance.approveCertificateSettings,
        'Sertifika tasarımı onaylandı.',
      );
    }
  }

  Future<void> _configureSettings() async {
    final attendance = TextEditingController(
      text: '${_settings['minimumTheoryAttendancePercent'] ?? 80}',
    );
    final director = TextEditingController(
      text: '${_settings['certificateDirectorName'] ?? ''}',
    );
    final title = TextEditingController(
      text: '${_settings['certificateDirectorTitle'] ?? 'Kurum Müdürü'}',
    );
    final color = TextEditingController(
      text: '${_settings['certificatePrimaryColor'] ?? '#173B57'}',
    );
    var policy =
        '${_settings['excusedAbsencePolicy'] ?? 'ExcludeFromCalculation'}';
    var logoUrl = '${_settings['certificateLogoUrl'] ?? ''}';
    var signatureUrl = '${_settings['certificateSignatureUrl'] ?? ''}';

    Future<String?> pickAsset() async {
      final result = await FilePicker.platform.pickFiles(type: FileType.image);
      final path = result?.files.single.path;
      if (path == null) return null;
      final file = File(path);
      if (await file.length() > 5 * 1024 * 1024) {
        _message('Görsel en fazla 5 MB olabilir.', error: true);
        return null;
      }
      final uploaded = await UploadsApiService.instance.uploadFile(
        file: file,
        folder: 'driving-certificate-assets',
      );
      return uploaded.fileUrl;
    }

    final save = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Mezuniyet & belge ayarları'.tr),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: attendance,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Asgari teorik devam (%)',
                    ),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: policy,
                    decoration: const InputDecoration(
                      labelText: 'Mazeretli devamsızlık',
                    ),
                    items: [
                      DropdownMenuItem(
                        value: 'ExcludeFromCalculation',
                        child: Text('Hesaplamadan çıkar'.tr),
                      ),
                      DropdownMenuItem(
                        value: 'CountsAsPresent',
                        child: Text('Katıldı say'.tr),
                      ),
                      DropdownMenuItem(
                        value: 'CountsAsAbsent',
                        child: Text('Devamsız say'.tr),
                      ),
                    ],
                    onChanged: (value) => policy = value ?? policy,
                  ),
                  TextField(
                    controller: director,
                    decoration: const InputDecoration(
                      labelText: 'Kurum müdürü',
                    ),
                  ),
                  TextField(
                    controller: title,
                    decoration: const InputDecoration(
                      labelText: 'Müdür unvanı',
                    ),
                  ),
                  TextField(
                    controller: color,
                    decoration: const InputDecoration(
                      labelText: 'Belge rengi (#RRGGBB)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.business_rounded),
                    title: Text('Kurum logosu'.tr),
                    subtitle: Text(logoUrl.isEmpty ? 'Seçilmedi' : 'Yüklendi'),
                    trailing: OutlinedButton(
                      onPressed: () async {
                        final url = await pickAsset();
                        if (url != null) {
                          setDialogState(() => logoUrl = url);
                        }
                      },
                      child: Text('Seç'.tr),
                    ),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.draw_rounded),
                    title: Text('Müdür imzası'.tr),
                    subtitle: Text(
                      signatureUrl.isEmpty ? 'Seçilmedi' : 'Yüklendi',
                    ),
                    trailing: OutlinedButton(
                      onPressed: () async {
                        final url = await pickAsset();
                        if (url != null) {
                          setDialogState(() => signatureUrl = url);
                        }
                      },
                      child: Text('Seç'.tr),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    if (save != true) return;
    final minimum = double.tryParse(attendance.text.replaceAll(',', '.'));
    if (minimum == null ||
        minimum < 0 ||
        minimum > 100 ||
        !RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(color.text.trim())) {
      _message('Devam oranı veya renk biçimi geçersiz.', error: true);
      return;
    }
    if (director.text.trim().length < 2 ||
        title.text.trim().length < 2 ||
        logoUrl.isEmpty ||
        signatureUrl.isEmpty) {
      _message('Müdür, unvan, kurum logosu ve imza zorunludur.', error: true);
      return;
    }
    final payload = <String, dynamic>{
      'minimumTheoryAttendancePercent': minimum,
      'excusedAbsencePolicy': policy,
      'directorName': director.text.trim(),
      'directorTitle': title.text.trim(),
      'primaryColor': color.text.trim().toUpperCase(),
      'logoUrl': logoUrl,
      'signatureUrl': signatureUrl,
    };
    await _run(
      () => DrivingSchoolApiService.instance.updateCertificateSettings(payload),
      'Mezuniyet ve belge ayarları kaydedildi.',
    );
  }
}
