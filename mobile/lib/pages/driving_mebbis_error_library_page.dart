import 'package:flutter/material.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';

class DrivingMebbisErrorLibraryPage extends StatefulWidget {
  const DrivingMebbisErrorLibraryPage({super.key});
  @override
  State<DrivingMebbisErrorLibraryPage> createState() =>
      _DrivingMebbisErrorLibraryPageState();
}

class _DrivingMebbisErrorLibraryPageState
    extends State<DrivingMebbisErrorLibraryPage> {
  final _search = TextEditingController();
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _canManage = false;
  String? _error;
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
      final p = await DrivingPermissionsStore.instance.load();
      final d = await DrivingSchoolApiService.instance.mebbisErrorLibrary(
        search: _search.text,
      );
      if (mounted) {
        setState(() {
          _canManage = p.can(DrivingPermissions.mebbisManage);
          _data = d;
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

  Future<String?> _note(String title) async {
    final c = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: c,
          maxLength: 1000,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(hintText: 'Kişisel veri yazmayın'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, c.text.trim()),
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    c.dispose();
    return result;
  }

  Future<void> _sync() async {
    try {
      await DrivingSchoolApiService.instance.syncMebbisErrorDefaults();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _open(String id) async {
    try {
      var detail = await DrivingSchoolApiService.instance.mebbisErrorDetail(id);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (sheetContext) => StatefulBuilder(
          builder: (context, setSheet) {
            final def = Map<String, dynamic>.from(detail['definition'] as Map);
            final rows = (detail['occurrences'] as List? ?? []).cast<Map>();
            Future<void> refresh() async {
              detail = await DrivingSchoolApiService.instance.mebbisErrorDetail(
                id,
              );
              setSheet(() {});
              await _load();
            }

            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: .88,
              maxChildSize: .96,
              builder: (_, scroll) => ListView(
                controller: scroll,
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    '${def['title']}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Olası neden',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text('${def['possibleCause']}'),
                  const SizedBox(height: 16),
                  const Text(
                    'Çözüm adımları',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  ...((def['resolutionSteps'] as List? ?? []).map(
                    (x) => ListTile(
                      dense: true,
                      leading: const Icon(Icons.check_circle_outline),
                      title: Text('$x'),
                    ),
                  )),
                  if (_canManage)
                    FilledButton.icon(
                      onPressed: () async {
                        final n = await _note('Bu hata için olay notu');
                        if (n != null && n.length >= 5) {
                          await DrivingSchoolApiService.instance
                              .reportMebbisError(id, n);
                          await refresh();
                        }
                      },
                      icon: const Icon(Icons.add_alert),
                      label: const Text('Bu hatayı kaydet'),
                    ),
                  const SizedBox(height: 20),
                  Text(
                    'İlgili kayıtlar (${detail['total']})',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  ...rows.map((raw) {
                    final x = Map<String, dynamic>.from(raw);
                    final resolved = x['resolvedAtUtc'] != null;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              x['studentName'] == null
                                  ? 'Genel işlem'
                                  : '${x['studentName']} • #${x['studentNumber']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text('${x['note']}'),
                            if (x['resolutionNote']?.toString().isNotEmpty ==
                                true)
                              Text(
                                'Çözüm: ${x['resolutionNote']}',
                                style: const TextStyle(color: Colors.green),
                              ),
                            if (_canManage && !resolved)
                              TextButton(
                                onPressed: () async {
                                  final n = await _note('Uygulanan çözüm');
                                  if (n != null && n.length >= 5) {
                                    await DrivingSchoolApiService.instance
                                        .resolveMebbisError(
                                          '${x['id']}',
                                          n,
                                          x['version'] as int,
                                        );
                                    await refresh();
                                  }
                                },
                                child: const Text('Çözüldü olarak işaretle'),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            );
          },
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = (_data?['items'] as List? ?? []).cast<Map>();
    final summary = Map<String, dynamic>.from(_data?['summary'] as Map? ?? {});
    return Scaffold(
      appBar: AppBar(
        title: const Text('MEBBİS Hata Kütüphanesi'),
        actions: [
          if (_canManage)
            IconButton(
              onPressed: _sync,
              tooltip: 'Varsayılan rehberi kur',
              icon: const Icon(Icons.sync),
            ),
        ],
      ),
      body: _loading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    controller: _search,
                    maxLength: 100,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Hata, kod veya neden ara',
                      suffixIcon: IconButton(
                        onPressed: _load,
                        icon: const Icon(Icons.arrow_forward),
                      ),
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    children: [
                      Chip(label: Text('${summary['total'] ?? 0} kart')),
                      Chip(
                        label: Text('${summary['occurrences'] ?? 0} görülme'),
                      ),
                      Chip(label: Text('${summary['unresolved'] ?? 0} açık')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (items.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Henüz hata kartı yok. Yetkili personel varsayılan rehberi kurabilir.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  else
                    ...items.map((raw) {
                      final x = Map<String, dynamic>.from(raw);
                      return Card(
                        child: ListTile(
                          onTap: () => _open('${x['id']}'),
                          leading: Icon(
                            x['severity'] == 'Blocking'
                                ? Icons.error_outline
                                : Icons.warning_amber,
                            color: x['severity'] == 'Blocking'
                                ? Colors.red
                                : Colors.orange,
                          ),
                          title: Text(
                            '${x['title']}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            '${x['description']}\n${x['occurrenceCount']} kez • ${x['unresolvedCount']} açık',
                          ),
                          isThreeLine: true,
                          trailing: const Icon(Icons.chevron_right),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
