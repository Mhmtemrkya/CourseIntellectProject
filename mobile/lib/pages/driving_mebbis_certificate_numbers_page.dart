import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingMebbisCertificateNumbersPage extends StatefulWidget {
  const DrivingMebbisCertificateNumbersPage({super.key});
  @override
  State<DrivingMebbisCertificateNumbersPage> createState() =>
      _DrivingMebbisCertificateNumbersPageState();
}

class _DrivingMebbisCertificateNumbersPageState
    extends State<DrivingMebbisCertificateNumbersPage> {
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _detail;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  PlatformFile? _file;
  String _groupId = '';
  final Set<String> _excluded = {};
  bool _loading = true;
  bool _saving = false;
  String? _error;

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
      final results = await Future.wait([
        DrivingSchoolApiService.instance.mebbisCertificateNumbers(),
        DrivingPermissionsStore.instance.load(),
      ]);
      if (!mounted) return;
      final value = results[0] as Map<String, dynamic>;
      final groups = value['groups'] as List? ?? const [];
      setState(() {
        _data = value;
        _permissions = results[1] as DrivingPermissionSnapshot;
        if (_groupId.isEmpty && groups.isNotEmpty) {
          final active = groups.where((x) => x['isActive'] == true);
          _groupId =
              '${(active.isNotEmpty ? active.first : groups.first)['id']}';
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pick() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['csv', 'xlsx'],
      withData: true,
    );
    final file = result?.files.single;
    if (file == null) return;
    if (file.size > 5 * 1024 * 1024) {
      _message('Dosya 5 MB sınırını aşıyor.', error: true);
      return;
    }
    setState(() => _file = file);
  }

  Future<void> _preview() async {
    if (_file == null || _groupId.isEmpty) return;
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance.previewMebbisImport(
        _file!,
        'CertificateNumbers',
        _groupId,
      );
      await _load();
      await _open('${value['id']}');
      _message('Önizleme hazır; henüz hiçbir sertifika değiştirilmedi.');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _open(String id) async {
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance
          .mebbisCertificateNumberDetail(id);
      if (mounted) {
        setState(() {
          _detail = value;
          _excluded.clear();
        });
      }
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _apply() async {
    final session = Map<String, dynamic>.from(_detail!['session'] as Map);
    setState(() => _saving = true);
    try {
      final result = await DrivingSchoolApiService.instance.applyMebbisImport(
        '${session['id']}',
        (session['previewVersion'] as num).toInt(),
        _excluded.toList(),
      );
      _message('${result['applied']} sertifika numarası işlendi.');
      await _load();
      await _open('${session['id']}');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String value, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(value),
        backgroundColor: error ? Colors.red.shade700 : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final groups = _data?['groups'] as List? ?? const [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sertifika No Toplu Aktarımı'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _error != null && _data == null
          ? Center(child: Text(_error!, textAlign: TextAlign.center))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  const DrivingPanel(
                    child: Text(
                      'MEBBİS sertifika listesini TC kimlik veya kursiyer numarasıyla eşleştirin. Dosya ve sistem mükerrerleri toplu onaya kapatılır.',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DrivingPanel(
                    child: Column(
                      children: [
                        DropdownButtonFormField<String>(
                          initialValue: _groupId.isEmpty ? null : _groupId,
                          decoration: const InputDecoration(labelText: 'Dönem'),
                          items: groups
                              .map(
                                (x) => DropdownMenuItem(
                                  value: '${x['id']}',
                                  child: Text('${x['name']}'),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _groupId = v ?? ''),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: _saving ? null : _pick,
                          icon: const Icon(Icons.attach_file),
                          label: Text(_file?.name ?? 'CSV/XLSX dosyası seç'),
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed:
                                !_permissions.can(
                                      DrivingPermissions.mebbisManage,
                                    ) ||
                                    _file == null ||
                                    _groupId.isEmpty ||
                                    _saving
                                ? null
                                : _preview,
                            icon: const Icon(Icons.preview),
                            label: const Text('Güvenli önizleme'),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_detail != null) ...[
                    const SizedBox(height: 12),
                    _resultPanel(),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    'Aktarım geçmişi',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  for (final x in _data?['imports'] as List? ?? const [])
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.workspace_premium),
                        title: Text(
                          '${x['fileName']}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${x['totalRows']} satır · ${x['status']}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _open('${x['id']}'),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _resultPanel() {
    final session = Map<String, dynamic>.from(_detail!['session'] as Map);
    final summary = Map<String, dynamic>.from(_detail!['summary'] as Map);
    final rows = _detail!['rows'] as List? ?? const [];
    final actionable = rows.where((x) => x['canApply'] == true).length;
    final canApprove =
        _permissions.can(DrivingPermissions.mebbisVerify) &&
        _permissions.can(DrivingPermissions.graduationManage);
    return DrivingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${session['fileName']}',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          Text(
            '${session['status']} · Önizleme v${session['previewVersion']}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _metric('Toplam', summary['total']),
              _metric('İşlenecek', summary['toUpdate']),
              _metric('Mükerrer', summary['duplicates'], danger: true),
              _metric('Kişi yok', summary['missingPeople'], danger: true),
              _metric(
                'Sertifika yok',
                summary['missingCertificates'],
                danger: true,
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final raw in rows)
            _row(
              Map<String, dynamic>.from(raw as Map),
              session['status'] == 'PreviewReady',
            ),
          if (session['status'] == 'PreviewReady')
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: FilledButton.icon(
                onPressed:
                    !canApprove || _saving || actionable == _excluded.length
                    ? null
                    : _apply,
                icon: const Icon(Icons.verified_user),
                label: Text(
                  'Seçilenleri toplu onayla (${actionable - _excluded.length})',
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> row, bool ready) {
    final id = '${row['rowId']}';
    final selectable = row['canApply'] == true;
    final messages = (row['messages'] as List? ?? const []).join(' ');
    return Card(
      margin: const EdgeInsets.only(top: 8),
      child: CheckboxListTile(
        value: selectable && !_excluded.contains(id),
        onChanged: !selectable || !ready
            ? null
            : (_) => setState(
                () => _excluded.contains(id)
                    ? _excluded.remove(id)
                    : _excluded.add(id),
              ),
        title: Text(
          '${row['name'] ?? 'Bulunamadı'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${row['studentNumber'] ?? 'Kursiyer no yok'} · ${row['documentNumber'] ?? 'Belge yok'}\n${row['currentMebbisNumber']?.toString().isNotEmpty == true ? row['currentMebbisNumber'] : '—'} → ${row['incomingMebbisNumber'] ?? '—'}\n${messages.isEmpty ? row['classification'] : messages}',
        ),
        secondary: Icon(
          row['duplicate'] == true
              ? Icons.error_rounded
              : selectable
              ? Icons.check_circle_rounded
              : Icons.info_outline,
          color: row['duplicate'] == true
              ? Colors.red
              : selectable
              ? Colors.green
              : Colors.orange,
        ),
        controlAffinity: ListTileControlAffinity.leading,
      ),
    );
  }

  Widget _metric(String label, dynamic value, {bool danger = false}) => Chip(
    avatar: danger && (value as num? ?? 0) > 0
        ? const Icon(Icons.warning_amber, size: 16)
        : null,
    label: Text('$label: ${value ?? 0}'),
  );
}
