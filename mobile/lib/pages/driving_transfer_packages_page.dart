import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/driving_school_api_service.dart';
import '../services/driving_permissions_store.dart';
import '../widgets/driving_ui.dart';

class DrivingTransferPackagesPage extends StatefulWidget {
  const DrivingTransferPackagesPage({super.key});
  @override
  State<DrivingTransferPackagesPage> createState() =>
      _DrivingTransferPackagesPageState();
}

class _DrivingTransferPackagesPageState
    extends State<DrivingTransferPackagesPage> {
  static const _types = <String, String>{
    'CandidateRegistration': 'Aday kayıt paketi',
    'TermStudentList': 'Dönem kursiyer listesi',
    'TheorySchedule': 'Teorik ders programı',
    'DrivingSchedule': 'Direksiyon ders programı',
    'ExamCandidateList': 'Sınav aday listesi',
    'ExamResultList': 'Sınav sonuç listesi',
    'CertificateList': 'Sertifika listesi',
    'InvoiceList': 'Fatura listesi',
    'MeisStatistics': 'MEİS istatistik paketi',
  };
  Map<String, dynamic>? _data;
  bool _loading = true;
  String _saving = '';
  String _type = 'CandidateRegistration';
  String _groupId = '';
  String? _error;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;

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
        DrivingSchoolApiService.instance.transferPackages(),
        DrivingPermissionsStore.instance.load(),
      ]);
      final value = results[0] as Map<String, dynamic>;
      final permissions = results[1] as DrivingPermissionSnapshot;
      final groups = (value['groups'] as List? ?? const []);
      if (mounted) {
        setState(() {
          _data = value;
          _permissions = permissions;
          if (_groupId.isEmpty && groups.isNotEmpty) {
            final active = groups.cast<Map>().where(
              (x) => x['isActive'] == true,
            );
            _groupId =
                '${(active.isNotEmpty ? active.first : groups.first)['id']}';
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

  Future<void> _create() async {
    if (_groupId.isEmpty) return;
    setState(() => _saving = 'create');
    try {
      await DrivingSchoolApiService.instance.createTransferPackage(
        _type,
        _groupId,
      );
      _message('Yeni paket sürümü güvenli arşive kaydedildi.');
      await _load();
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  Future<void> _share(Map<String, dynamic> item) async {
    final id = '${item['id']}';
    setState(() => _saving = id);
    try {
      final bytes = await DrivingSchoolApiService.instance
          .downloadAuthenticated(
            '/api/driving-school/mebbis/transfer-packages/$id/download',
          );
      final safeName = '${item['fileName']}'.replaceAll(
        RegExp(r'[^a-zA-Z0-9._-]'),
        '_',
      );
      final file = File('${(await getTemporaryDirectory()).path}/$safeName');
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path)], title: safeName),
      );
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  Future<String?> _failureReason() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Aktarım hata sonucu'),
        content: TextField(
          controller: controller,
          maxLength: 2000,
          minLines: 3,
          maxLines: 7,
          decoration: const InputDecoration(hintText: 'En az 10 karakter'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.length >= 10) Navigator.pop(context, value);
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _status(Map<String, dynamic> item, String status) async {
    var reason = '';
    if (status == 'Failed') {
      final value = await _failureReason();
      if (value == null) return;
      reason = value;
    }
    final id = '${item['id']}';
    setState(() => _saving = id);
    try {
      await DrivingSchoolApiService.instance.updateTransferPackageStatus(
        id,
        status,
        (item['statusVersion'] as num?)?.toInt() ?? 0,
        errorResult: reason,
      );
      await _load();
      _message('Aktarım durumu güncellendi.');
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  void _message(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text.replaceFirst('Bad state: ', '')),
        backgroundColor: error ? Colors.red : null,
      ),
    );
  }

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
        title: const Text('MEBBİS Aktarım Paketleri'),
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
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, textAlign: TextAlign.center),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  const DrivingHero(
                    eyebrow: 'MEBBİS',
                    title: 'Sürümlü Aktarım Arşivi',
                    description:
                        'Eski dosyaları ezmeden, bütünlüğü doğrulanmış dönem paketleri oluşturun.',
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: _groupId.isEmpty ? null : _groupId,
                    decoration: const InputDecoration(labelText: 'Dönem'),
                    items: groups
                        .map(
                          (g) => DropdownMenuItem(
                            value: '${g['id']}',
                            child: Text(
                              '${g['name']} · ${g['termYear'] ?? '—'}/${g['termNumber'] ?? '—'}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (x) => setState(() => _groupId = x ?? ''),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _type,
                    decoration: const InputDecoration(labelText: 'Paket türü'),
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
                  FilledButton.icon(
                    onPressed:
                        !_permissions.can(DrivingPermissions.mebbisManage) ||
                            !_permissions.can(
                              DrivingPermissions.reportExport,
                            ) ||
                            _groupId.isEmpty ||
                            _saving == 'create'
                        ? null
                        : _create,
                    icon: const Icon(Icons.add_to_photos_rounded),
                    label: const Text('Yeni sürüm oluştur'),
                  ),
                  const SizedBox(height: 18),
                  if (items.isEmpty)
                    const DrivingEmptyState(
                      icon: Icons.archive_outlined,
                      title: 'Henüz paket yok',
                      message: 'İlk sürümü oluşturduğunuzda burada görünecek.',
                    )
                  else
                    ...items.map(_card),
                ],
              ),
            ),
    );
  }

  Widget _card(Map<String, dynamic> item) {
    final status = '${item['status']}';
    final color = status == 'Transferred'
        ? Colors.green
        : status == 'Failed'
        ? Colors.red
        : Colors.blue;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _types['${item['packageType']}'] ??
                        '${item['packageType']}',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                Chip(
                  side: BorderSide.none,
                  backgroundColor: color.withValues(alpha: .12),
                  label: Text(
                    '$status · v${item['fileVersion']}',
                    style: TextStyle(color: color, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            Text(
              '${item['termYear'] ?? '—'}/${item['termNumber'] ?? '—'} · ${item['studentCount']} kursiyer · ${item['rowCount']} satır',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              '${item['createdByName']} · ${item['fileName']}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              'SHA-256: ${('${item['sha256']}').substring(0, 12)}…',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if ('${item['errorResult']}'.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Hata: ${item['errorResult']}',
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                if (_permissions.can(DrivingPermissions.reportView))
                  OutlinedButton.icon(
                    onPressed: _saving == '${item['id']}'
                        ? null
                        : () => _share(item),
                    icon: const Icon(Icons.ios_share),
                    label: const Text('İndir / Paylaş'),
                  ),
                if (status == 'Generated' &&
                    _permissions.can(DrivingPermissions.mebbisManage))
                  FilledButton(
                    onPressed: _saving == '${item['id']}'
                        ? null
                        : () => _status(item, 'Transferred'),
                    child: const Text('Aktarıldı'),
                  ),
                if (status == 'Generated' &&
                    _permissions.can(DrivingPermissions.mebbisManage))
                  TextButton(
                    onPressed: _saving == '${item['id']}'
                        ? null
                        : () => _status(item, 'Failed'),
                    child: const Text(
                      'Hata bildir',
                      style: TextStyle(color: Colors.red),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
