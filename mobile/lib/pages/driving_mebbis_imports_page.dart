import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingMebbisImportsPage extends StatefulWidget {
  const DrivingMebbisImportsPage({super.key});
  @override
  State<DrivingMebbisImportsPage> createState() =>
      _DrivingMebbisImportsPageState();
}

class _DrivingMebbisImportsPageState extends State<DrivingMebbisImportsPage> {
  static const _types = <String, String>{
    'CandidateList': 'MEBBİS aday listesi',
    'ExamResults': 'Sınav sonuçları',
    'CertificateNumbers': 'Sertifika numaraları',
    'TermList': 'Dönem listesi',
    'StudentStatuses': 'Kursiyer durumları',
  };
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _detail;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  PlatformFile? _file;
  String _type = 'CandidateList';
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
        DrivingSchoolApiService.instance.mebbisImports(),
        DrivingPermissionsStore.instance.load(),
      ]);
      final value = results[0] as Map<String, dynamic>;
      final groups = value['groups'] as List? ?? const [];
      if (mounted) {
        setState(() {
          _data = value;
          _permissions = results[1] as DrivingPermissionSnapshot;
          if (_groupId.isEmpty && groups.isNotEmpty) {
            _groupId = '${groups.first['id']}';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = '$e'.replaceFirst('Bad state: ', ''));
      }
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
    if (_file == null || (_type != 'TermList' && _groupId.isEmpty)) return;
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance.previewMebbisImport(
        _file!,
        _type,
        _groupId.isEmpty ? null : _groupId,
      );
      await _load();
      await _open('${value['id']}');
      _message('Önizleme hazır; sistem kayıtları henüz değişmedi.');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _open(String id) async {
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance.mebbisImportDetail(
        id,
      );
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
      await DrivingSchoolApiService.instance.applyMebbisImport(
        '${session['id']}',
        (session['previewVersion'] as num).toInt(),
        _excluded.toList(),
      );
      _message('Onaylanan değişiklikler uygulandı.');
      await _load();
      await _open('${session['id']}');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<String?> _reason() async {
    final c = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Önizlemeyi reddet'),
        content: TextField(
          controller: c,
          minLines: 3,
          maxLines: 6,
          maxLength: 1000,
          decoration: const InputDecoration(
            hintText: 'En az 10 karakter gerekçe',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () {
              final v = c.text.trim();
              if (v.length >= 10) Navigator.pop(context, v);
            },
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
    c.dispose();
    return result;
  }

  Future<void> _reject() async {
    final reason = await _reason();
    if (reason == null) return;
    final session = Map<String, dynamic>.from(_detail!['session'] as Map);
    setState(() => _saving = true);
    try {
      await DrivingSchoolApiService.instance.rejectMebbisImport(
        '${session['id']}',
        (session['previewVersion'] as num).toInt(),
        reason,
      );
      _detail = null;
      await _load();
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
        content: Text(value.replaceFirst('Bad state: ', '')),
        backgroundColor: error ? Colors.red : null,
      ),
    );
  }

  List<Map<String, dynamic>> get _rows =>
      (_detail?['rows'] as List? ?? const [])
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();

  @override
  Widget build(BuildContext context) {
    final groups = (_data?['groups'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    final items = (_data?['items'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    return DrivingScaffold(
      appBar: AppBar(
        title: const Text('MEBBİS’ten Geri Aktarım'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      child: _loading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                const DrivingHero(
                  eyebrow: 'Güvenli İçe Aktarım',
                  title: 'Önizle, Karşılaştır, Onayla',
                  description:
                      'Dosya yüklemek tek başına hiçbir sistem kaydını değiştirmez.',
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Dosya türü'),
                  items: _types.entries
                      .map(
                        (x) => DropdownMenuItem(
                          value: x.key,
                          child: Text(x.value),
                        ),
                      )
                      .toList(),
                  onChanged: (x) => setState(() => _type = x ?? _type),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _groupId.isEmpty ? null : _groupId,
                  decoration: InputDecoration(
                    labelText:
                        'Dönem${_type == 'TermList' ? ' (isteğe bağlı)' : ''}',
                  ),
                  items: groups
                      .map(
                        (x) => DropdownMenuItem(
                          value: '${x['id']}',
                          child: Text('${x['name']}'),
                        ),
                      )
                      .toList(),
                  onChanged: (x) => setState(() => _groupId = x ?? ''),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _pick,
                  icon: const Icon(Icons.attach_file),
                  label: Text(
                    _file?.name ?? 'CSV veya XLSX seç · en fazla 5 MB',
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed:
                      !_permissions.can(DrivingPermissions.mebbisManage) ||
                          _file == null ||
                          _saving ||
                          (_type != 'TermList' && _groupId.isEmpty)
                      ? null
                      : _preview,
                  icon: const Icon(Icons.preview_rounded),
                  label: const Text('Güvenli önizleme oluştur'),
                ),
                if (_detail != null) ...[
                  const SizedBox(height: 18),
                  _previewPanel(),
                ],
                const SizedBox(height: 18),
                const DrivingSectionTitle(title: 'Geçmiş geri aktarımlar'),
                const SizedBox(height: 8),
                if (items.isEmpty)
                  const DrivingEmptyState(
                    icon: Icons.file_open_outlined,
                    title: 'Henüz geri aktarım yok',
                  )
                else
                  ...items.map(
                    (x) => Card(
                      child: ListTile(
                        onTap: () => _open('${x['id']}'),
                        leading: const Icon(Icons.table_view_rounded),
                        title: Text(
                          _types['${x['importType']}'] ?? '${x['importType']}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${x['fileName']} · ${x['totalRows']} satır',
                        ),
                        trailing: Chip(label: Text('${x['status']}')),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _previewPanel() {
    final s = Map<String, dynamic>.from(_detail!['session'] as Map);
    final ready = s['status'] == 'PreviewReady';
    return DrivingPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_types['${s['importType']}']} · ${s['fileName']}',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          Text(
            'SHA-256: ${s['sha256']}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _chip('Toplam', s['totalRows'], Colors.blue),
              _chip('Eşleşen', s['matchedRows'], Colors.green),
              _chip('Bulunamayan', s['notFoundRows'], Colors.grey),
              _chip('Çelişki', s['conflictRows'], Colors.red),
              _chip('Değişecek', s['changeRows'], Colors.orange),
              _chip('Yeni', s['newRows'], Colors.purple),
            ],
          ),
          const SizedBox(height: 12),
          ..._rows.map((row) {
            final changes = _jsonList(row['changesJson']);
            final messages = _jsonList(row['messagesJson']);
            final selectable =
                row['classification'] == 'Change' ||
                row['classification'] == 'New';
            return Card(
              child: CheckboxListTile(
                value: selectable && !_excluded.contains('${row['id']}'),
                onChanged: !ready || !selectable
                    ? null
                    : (_) => setState(() {
                        final id = '${row['id']}';
                        _excluded.contains(id)
                            ? _excluded.remove(id)
                            : _excluded.add(id);
                      }),
                title: Text(
                  '${row['rowNumber']}. ${row['classification']}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  [
                    if (changes.isNotEmpty) '${changes.length} alan değişecek',
                    ...messages.map((x) => '$x'),
                  ].join(' · '),
                ),
                secondary: Icon(
                  row['classification'] == 'Conflict' ||
                          row['classification'] == 'Invalid'
                      ? Icons.error
                      : row['classification'] == 'New'
                      ? Icons.person_add
                      : Icons.compare_arrows,
                  color:
                      row['classification'] == 'Conflict' ||
                          row['classification'] == 'Invalid'
                      ? Colors.red
                      : Colors.blue,
                ),
              ),
            );
          }),
          if (ready)
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : _reject,
                    child: const Text('Reddet'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed:
                        !_permissions.can(DrivingPermissions.mebbisVerify) ||
                            _saving
                        ? null
                        : _apply,
                    child: const Text('Seçilenleri uygula'),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _chip(String label, dynamic value, Color color) => Chip(
    avatar: CircleAvatar(
      backgroundColor: color.withValues(alpha: .14),
      child: Text(
        '${value ?? 0}',
        style: TextStyle(color: color, fontSize: 10),
      ),
    ),
    label: Text(label),
  );
  List<dynamic> _jsonList(dynamic value) {
    try {
      return jsonDecode('$value') as List;
    } catch (_) {
      return const [];
    }
  }
}
