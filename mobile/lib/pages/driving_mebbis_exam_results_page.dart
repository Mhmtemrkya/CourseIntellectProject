import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingMebbisExamResultsPage extends StatefulWidget {
  const DrivingMebbisExamResultsPage({super.key});

  @override
  State<DrivingMebbisExamResultsPage> createState() =>
      _DrivingMebbisExamResultsPageState();
}

class _DrivingMebbisExamResultsPageState
    extends State<DrivingMebbisExamResultsPage> {
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _detail;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  PlatformFile? _file;
  String _groupId = '';
  final Set<String> _excluded = {};
  bool _createFees = true;
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
        DrivingSchoolApiService.instance.mebbisExamResults(),
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
        'ExamResults',
        _groupId,
      );
      await _load();
      await _open('${value['id']}');
      _message('Önizleme hazır; hiçbir sonuç veya ücret değiştirilmedi.');
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
          .mebbisExamResultDetail(id);
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
        createRetryFees: _createFees,
      );
      _message(
        '${result['applied']} sonuç uygulandı; ${result['retryRequired']} tekrar gerekiyor.',
      );
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
        title: const Text('Sınav Sonucu Mutabakatı'),
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
                      'TC kimlik, sınav hakkı, önceki sonuç, puan, tekrar sınavı ve finans etkisi toplu işlemden önce birlikte kontrol edilir.',
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
                          onChanged: (value) =>
                              setState(() => _groupId = value ?? ''),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: _saving ? null : _pick,
                          icon: const Icon(Icons.attach_file_rounded),
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
                            icon: const Icon(Icons.preview_rounded),
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
                        leading: const Icon(Icons.file_present_rounded),
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
    final ready = session['status'] == 'PreviewReady';
    final selectable = rows
        .where((x) => x['classification'] == 'Change')
        .length;
    return DrivingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${session['fileName']}',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _count('Geçti', summary['passed'], Colors.green),
              _count('Kaldı', summary['failed'], Colors.red),
              _count('Puan farkı', summary['scoreMismatch'], Colors.orange),
              _count('Tekrar', summary['retryRequired'], Colors.blue),
              _count('Hak doldu', summary['outOfAttempts'], Colors.red),
            ],
          ),
          const SizedBox(height: 8),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Tekrar sınav ücretlerini oluştur'),
            subtitle: Text(
              '${summary['feeCandidates']} kursiyer · ${summary['feeTotal']} ₺ · ${summary['mandatoryExtraLesson']} zorunlu ek ders',
            ),
            value: _createFees,
            onChanged: ready
                ? (value) => setState(() => _createFees = value)
                : null,
          ),
          if ((summary['contractMissing'] as num? ?? 0) > 0)
            Text(
              '${summary['contractMissing']} kursiyerin sözleşmesi eksik; ücret oluşturulamaz.',
              style: const TextStyle(color: Colors.orange),
            ),
          if (ready) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    !_permissions.can(DrivingPermissions.mebbisVerify) ||
                        _saving ||
                        selectable == _excluded.length
                    ? null
                    : _apply,
                icon: const Icon(Icons.verified_user_rounded),
                label: const Text('Seçilen sonuçları uygula'),
              ),
            ),
          ],
          const Divider(height: 24),
          for (final raw in rows)
            _row(Map<String, dynamic>.from(raw as Map), ready),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> row, bool ready) {
    final id = '${row['rowId']}';
    final canSelect = row['classification'] == 'Change';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        leading: Checkbox(
          value: canSelect && !_excluded.contains(id),
          onChanged: !ready || !canSelect
              ? null
              : (_) => setState(() {
                  _excluded.contains(id)
                      ? _excluded.remove(id)
                      : _excluded.add(id);
                }),
        ),
        title: Text(
          '${row['name']}'.isEmpty ? 'Adsız kayıt' : '${row['name']}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${row['incomingPassed'] == true
              ? 'Geçti'
              : row['incomingPassed'] == false
              ? 'Kaldı'
              : 'Belirsiz'} · ${row['maskedIdentity']} · ${row['classification']}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          _line(
            'Sınav',
            '${row['examTitle'] ?? '—'} (${row['examType'] ?? '—'})',
          ),
          _line(
            'Hak',
            '${row['attemptNo']} / 4 · ${row['remainingAttempts']} kalan',
          ),
          _line(
            'Önceki',
            '${row['previousResult'] ?? '—'} · puan ${row['previousScore'] ?? '—'}',
          ),
          _line(
            'MEBBİS',
            '${row['incomingPassed'] == true ? 'Geçti' : 'Kaldı'} · puan ${row['importedScore'] ?? '—'}',
          ),
          _line('İşlem', '${row['message']}'),
          if (row['retryRequired'] == true)
            _line(
              'Tekrar ücreti',
              row['feeWillBeCreated'] == true
                  ? '${row['feeAmount']} ₺'
                  : row['contractMissing'] == true
                  ? 'Sözleşme eksik'
                  : 'Ücretsiz',
            ),
          if ((row['extraLessonMinutes'] as num? ?? 0) > 0)
            _line(
              'Zorunlu ek ders',
              '${row['extraLessonMinutes']} dk · ${row['extraLessonFee']} ₺',
            ),
        ],
      ),
    );
  }

  Widget _line(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 95,
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        Expanded(child: Text(value)),
      ],
    ),
  );
  Widget _count(String label, dynamic value, Color color) => Chip(
    avatar: CircleAvatar(backgroundColor: color, radius: 5),
    label: Text('$label: ${value ?? 0}'),
  );
}
