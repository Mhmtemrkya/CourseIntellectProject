import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingMebbisReconciliationsPage extends StatefulWidget {
  const DrivingMebbisReconciliationsPage({super.key});

  @override
  State<DrivingMebbisReconciliationsPage> createState() =>
      _DrivingMebbisReconciliationsPageState();
}

class _DrivingMebbisReconciliationsPageState
    extends State<DrivingMebbisReconciliationsPage> {
  static const _classes = <String, String>{
    '': 'Tümü',
    'Matched': 'Eşleşiyor',
    'CourseOnly': 'Yalnız bizde',
    'MebbisOnly': 'Yalnız MEBBİS’te',
    'Different': 'Farklı',
  };
  static const _codes = <String, String>{
    'GeneralInfo': 'Genel bilgi',
    'LicenseClass': 'Ehliyet sınıfı',
    'Term': 'Dönem',
    'CertificateNo': 'Sertifika no',
    'ExamResult': 'Sınav sonucu',
    'StudentStatus': 'Kursiyer durumu',
    'DuplicateIdentity': 'Mükerrer kimlik',
    'MissingIdentity': 'Kimlik eksik',
    'MissingInMebbis': 'MEBBİS’te yok',
    'MissingInCourseIntellect': 'CourseIntellect’te yok',
  };
  static const _fields = <String, String>{
    'fullName': 'Ad soyad',
    'phone': 'Telefon',
    'motherName': 'Anne adı',
    'fatherName': 'Baba adı',
    'birthPlace': 'Doğum yeri',
    'education': 'Öğrenim',
    'serialNo': 'Kimlik seri no',
    'licenseClass': 'Ehliyet sınıfı',
    'termYear': 'Dönem yılı',
    'termNumber': 'Dönem no',
    'termCode': 'Dönem kodu',
    'certificateNo': 'Sertifika no',
    'examResult': 'Sınav sonucu',
    'studentStatus': 'Kursiyer durumu',
  };

  Map<String, dynamic>? _data;
  Map<String, dynamic>? _detail;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  String _groupId = '';
  String _sourceId = '';
  String _filter = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<dynamic> get _groups => _data?['groups'] as List? ?? const [];
  List<dynamic> get _sources => (_data?['sources'] as List? ?? const [])
      .where((x) => '${x['studentGroupId']}' == _groupId)
      .toList();

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
        DrivingSchoolApiService.instance.mebbisReconciliations(),
        DrivingPermissionsStore.instance.load(),
      ]);
      if (!mounted) return;
      setState(() {
        _data = result[0] as Map<String, dynamic>;
        _permissions = result[1] as DrivingPermissionSnapshot;
        if (_groupId.isEmpty && _groups.isNotEmpty) {
          final active = _groups.where((x) => x['isActive'] == true);
          _groupId =
              '${(active.isNotEmpty ? active.first : _groups.first)['id']}';
        }
        if (!_sources.any((x) => '${x['id']}' == _sourceId)) {
          _sourceId = _sources.isEmpty ? '' : '${_sources.first['id']}';
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    if (_groupId.isEmpty || _sourceId.isEmpty) return;
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance
          .createMebbisReconciliation(_groupId, _sourceId);
      await _load();
      await _open('${value['id']}', filter: '');
      _message('Mutabakat tamamlandı; hiçbir kayıt değiştirilmedi.');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _open(String id, {String? filter}) async {
    setState(() => _saving = true);
    try {
      final selected = filter ?? _filter;
      final value = await DrivingSchoolApiService.instance
          .mebbisReconciliationDetail(id, classification: selected);
      if (mounted) {
        setState(() {
          _detail = value;
          _filter = selected;
        });
      }
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('MEBBİS Mutabakatı'),
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
                      'CourseIntellect dönemi ile MEBBİS listelerini kimlik üzerinden, kayıtları değiştirmeden karşılaştırır. Kimlik numaraları maskeli gösterilir.',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DrivingPanel(
                    child: Column(
                      children: [
                        DropdownButtonFormField<String>(
                          initialValue: _groupId.isEmpty ? null : _groupId,
                          decoration: const InputDecoration(labelText: 'Dönem'),
                          items: _groups
                              .map(
                                (x) => DropdownMenuItem(
                                  value: '${x['id']}',
                                  child: Text('${x['name']}'),
                                ),
                              )
                              .toList(),
                          onChanged: (value) => setState(() {
                            _groupId = value ?? '';
                            _sourceId = '';
                            if (_sources.isNotEmpty) {
                              _sourceId = '${_sources.first['id']}';
                            }
                          }),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          key: ValueKey('$_groupId-$_sourceId'),
                          initialValue: _sourceId.isEmpty ? null : _sourceId,
                          decoration: const InputDecoration(
                            labelText: 'MEBBİS aday listesi',
                          ),
                          items: _sources
                              .map(
                                (x) => DropdownMenuItem(
                                  value: '${x['id']}',
                                  child: Text(
                                    '${x['fileName']} · ${x['totalRows']} satır',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _sourceId = value ?? ''),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed:
                                !_permissions.can(
                                      DrivingPermissions.mebbisManage,
                                    ) ||
                                    _sourceId.isEmpty ||
                                    _saving
                                ? null
                                : _create,
                            icon: const Icon(Icons.compare_arrows_rounded),
                            label: const Text('Mutabakatı çalıştır'),
                          ),
                        ),
                        if (_groupId.isNotEmpty && _sources.isEmpty) ...[
                          const SizedBox(height: 10),
                          const Text(
                            'Bu döneme ait aday listesi yok. Önce Geri Aktarım ekranından listeyi yükleyin.',
                            style: TextStyle(color: Colors.orange),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (_detail != null) ...[
                    const SizedBox(height: 12),
                    _resultPanel(),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    'Mutabakat geçmişi',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final x in _data?['items'] as List? ?? const [])
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.history_rounded),
                        title: Text(
                          _groupName('${x['studentGroupId']}'),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${x['totalRows']} kayıt · ${x['differentRows']} farklı',
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
    final run = Map<String, dynamic>.from(_detail!['reconciliation'] as Map);
    final rows = _detail!['rows'] as List? ?? const [];
    return DrivingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Mutabakat sonucu',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _count('Toplam', run['totalRows'], Colors.blue),
              _count('Eşleşen', run['matchedRows'], Colors.green),
              _count('Yalnız bizde', run['courseOnlyRows'], Colors.orange),
              _count('Yalnız MEBBİS’te', run['mebbisOnlyRows'], Colors.purple),
              _count('Farklı', run['differentRows'], Colors.red),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<String>(
              segments: _classes.entries
                  .map((x) => ButtonSegment(value: x.key, label: Text(x.value)))
                  .toList(),
              selected: {_filter},
              onSelectionChanged: (value) =>
                  _open('${run['id']}', filter: value.first),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${_detail!['filteredTotal']} kayıt · kimlik numaraları maskeli',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Divider(height: 24),
          for (final raw in rows) _row(Map<String, dynamic>.from(raw as Map)),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> row) {
    final codes = _list(row['differenceCodesJson']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        title: Text(
          '${row['displayName']}'.isEmpty
              ? 'Adsız kayıt'
              : '${row['displayName']}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${_classes['${row['classification']}']} · ${row['maskedIdentity']}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          if (codes.isNotEmpty)
            Wrap(
              spacing: 5,
              children: codes
                  .map((x) => Chip(label: Text(_codes['$x'] ?? '$x')))
                  .toList(),
            ),
          const SizedBox(height: 8),
          _snapshot('CourseIntellect', row['courseSnapshotJson']),
          const SizedBox(height: 8),
          _snapshot('MEBBİS', row['mebbisSnapshotJson']),
        ],
      ),
    );
  }

  Widget _snapshot(String title, dynamic encoded) {
    final value = _map(encoded);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).colorScheme.surfaceContainerHighest.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          if (value.isEmpty)
            const Text('—')
          else
            for (final item in value.entries.where(
              (x) => '${x.value}'.isNotEmpty,
            ))
              Text('${_fields[item.key] ?? item.key}: ${item.value}'),
        ],
      ),
    );
  }

  Widget _count(String label, dynamic value, Color color) => Chip(
    avatar: CircleAvatar(backgroundColor: color, radius: 5),
    label: Text('$label: ${value ?? 0}'),
  );
  String _groupName(String id) {
    for (final x in _groups) {
      if ('${x['id']}' == id) return '${x['name']}';
    }
    return 'Dönem';
  }

  List<dynamic> _list(dynamic value) {
    try {
      return jsonDecode('$value') as List? ?? const [];
    } catch (_) {
      return const [];
    }
  }

  Map<String, dynamic> _map(dynamic value) {
    try {
      return Map<String, dynamic>.from(jsonDecode('$value') as Map);
    } catch (_) {
      return {};
    }
  }
}
