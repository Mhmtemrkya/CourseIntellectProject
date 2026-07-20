import 'dart:io';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingDocumentReviewQueuePage extends StatefulWidget {
  const DrivingDocumentReviewQueuePage({super.key});

  @override
  State<DrivingDocumentReviewQueuePage> createState() =>
      _DrivingDocumentReviewQueuePageState();
}

class _DrivingDocumentReviewQueuePageState
    extends State<DrivingDocumentReviewQueuePage> {
  final _search = TextEditingController();
  Map<String, dynamic>? _data;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  bool _loading = true;
  String? _error;
  String _status = 'ActionRequired';
  String _type = '';
  String _saving = '';

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
      if (!permissions.can(DrivingPermissions.studentDocumentView)) {
        throw StateError('Evrak kuyruğu görüntüleme yetkiniz yok.');
      }
      final data = await DrivingSchoolApiService.instance.documentReviewQueue(
        status: _status,
        documentType: _type,
        search: _search.text,
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

  Future<void> _open(Map<String, dynamic> item) async {
    try {
      final bytes = await DrivingSchoolApiService.instance
          .downloadStudentDocument('${item['id']}');
      final rawName = '${item['fileName'] ?? 'belge'}'.replaceAll(
        RegExp(r'[^a-zA-Z0-9._-]'),
        '_',
      );
      final file = File(
        '${(await getTemporaryDirectory()).path}/${item['id']}-$rawName',
      );
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) throw StateError(result.message);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Belge açılamadı: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _review(Map<String, dynamic> item, String action) async {
    final reason = TextEditingController(
      text: '${item['rejectionReason'] ?? ''}',
    );
    final note = TextEditingController(text: '${item['reviewNote'] ?? ''}');
    DateTime? expires = DateTime.tryParse('${item['expiresAtUtc'] ?? ''}');
    final payload = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final needsReason = action == 'Reject' || action == 'RequestReupload';
          return AlertDialog(
            title: Text(
              action == 'Approve'
                  ? 'Belgeyi onayla'
                  : action == 'Reject'
                  ? 'Belgeyi reddet'
                  : action == 'RequestReupload'
                  ? 'Yeniden yükleme iste'
                  : 'Belge bilgilerini güncelle',
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Son geçerlilik tarihi'),
                    subtitle: Text(
                      expires == null
                          ? 'Belirlenmedi'
                          : '${expires!.day.toString().padLeft(2, '0')}.${expires!.month.toString().padLeft(2, '0')}.${expires!.year}',
                    ),
                    trailing: const Icon(Icons.event),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: dialogContext,
                        firstDate: DateTime.now().add(const Duration(days: 1)),
                        lastDate: DateTime.now().add(
                          const Duration(days: 365 * 20),
                        ),
                        initialDate: expires?.isAfter(DateTime.now()) == true
                            ? expires!
                            : DateTime.now().add(const Duration(days: 180)),
                      );
                      if (picked != null) {
                        setDialogState(() => expires = picked);
                      }
                    },
                  ),
                  TextField(
                    controller: note,
                    maxLength: 1000,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Personel iç notu',
                      helperText: 'Kursiyere gösterilmez',
                    ),
                  ),
                  if (needsReason)
                    TextField(
                      controller: reason,
                      maxLength: 500,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Gerekçe',
                        helperText:
                            'Kursiyere mobil bildirim olarak gönderilir',
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Vazgeç'),
              ),
              FilledButton(
                onPressed: () {
                  if (needsReason && reason.text.trim().length < 5) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(
                        content: Text('Gerekçe en az 5 karakter olmalıdır.'),
                      ),
                    );
                    return;
                  }
                  Navigator.pop(dialogContext, {
                    'action': action,
                    'rejectionReason': reason.text.trim(),
                    'note': note.text.trim(),
                    'expiresAtUtc': expires?.toUtc().toIso8601String(),
                    'expectedVersion':
                        (item['reviewVersion'] as num?)?.toInt() ?? 0,
                  });
                },
                child: const Text('Kaydet'),
              ),
            ],
          );
        },
      ),
    );
    reason.dispose();
    note.dispose();
    if (payload == null) return;
    setState(() => _saving = '${item['id']}');
    try {
      await DrivingSchoolApiService.instance.reviewStudentDocument(
        '${item['id']}',
        payload,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Evrak işlemi tamamlandı.')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
      await _load();
    } finally {
      if (mounted) setState(() => _saving = '');
    }
  }

  Color _color(String status) => switch (status) {
    'Approved' => Colors.green,
    'Rejected' || 'Expired' => Colors.red,
    'ReuploadRequested' => Colors.deepOrange,
    _ => Colors.amber.shade800,
  };
  String _label(String status) => switch (status) {
    'Approved' => 'Onaylandı',
    'Rejected' => 'Reddedildi',
    'Expired' => 'Süresi doldu',
    'ReuploadRequested' => 'Yeniden yükleme istendi',
    _ => 'Onay bekliyor',
  };

  @override
  Widget build(BuildContext context) {
    final items = (_data?['items'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    final summary = Map<String, dynamic>.from(
      _data?['summary'] as Map? ?? const {},
    );
    final types = (_data?['documentTypes'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    return DrivingScaffold(
      appBar: AppBar(
        title: const Text('Evrak Onay Kuyruğu'),
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
              child: FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: Text(_error!),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _stat('Onay', summary['pending'], Colors.amber),
                      _stat(
                        'Yeniden yükleme',
                        summary['reuploadRequested'],
                        Colors.deepOrange,
                      ),
                      _stat('Reddedilen', summary['rejected'], Colors.red),
                      _stat('Süresi dolan', summary['expired'], Colors.red),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _search,
                    maxLength: 100,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      counterText: '',
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Kursiyer adı veya numarası',
                      suffixIcon: IconButton(
                        onPressed: _load,
                        icon: const Icon(Icons.arrow_forward),
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
                          items: const [
                            DropdownMenuItem(
                              value: 'ActionRequired',
                              child: Text('İşlem gerekenler'),
                            ),
                            DropdownMenuItem(
                              value: 'PendingApproval',
                              child: Text('Onay bekleyen'),
                            ),
                            DropdownMenuItem(
                              value: 'ReuploadRequested',
                              child: Text('Yeniden yükleme'),
                            ),
                            DropdownMenuItem(
                              value: 'Rejected',
                              child: Text('Reddedilen'),
                            ),
                            DropdownMenuItem(
                              value: 'Expired',
                              child: Text('Süresi dolan'),
                            ),
                            DropdownMenuItem(
                              value: 'Approved',
                              child: Text('Onaylı'),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() => _status = v ?? 'ActionRequired');
                            _load();
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _type,
                          decoration: const InputDecoration(labelText: 'Belge'),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('Tümü'),
                            ),
                            ...types.map(
                              (x) => DropdownMenuItem(
                                value: '${x['value']}',
                                child: Text(
                                  '${x['label']}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() => _type = v ?? '');
                            _load();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (items.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: Text('Bu filtrede belge yok.')),
                      ),
                    )
                  else
                    ...items.map(_card),
                ],
              ),
            ),
    );
  }

  Widget _stat(String label, dynamic value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(
      '${(value as num?)?.toInt() ?? 0} $label',
      style: TextStyle(color: color, fontWeight: FontWeight.w800),
    ),
  );

  Widget _card(Map<String, dynamic> item) {
    final status = '${item['status']}';
    final color = _color(status);
    final busy = _saving == '${item['id']}';
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item['studentName']} • #${item['studentNumber']}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        '${item['label']}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        _label(status),
                        style: TextStyle(
                          color: color,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => _open(item),
                  tooltip: 'Belgeyi güvenli aç',
                  icon: const Icon(Icons.visibility),
                ),
              ],
            ),
            Text(
              'Yüklendi: ${DateTime.parse('${item['uploadedAtUtc']}').toLocal().toString().split('.').first}',
              style: const TextStyle(fontSize: 11),
            ),
            if ('${item['rejectionReason'] ?? ''}'.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  'Son gerekçe: ${item['rejectionReason']}',
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                ),
              ),
            if (_permissions.can(DrivingPermissions.studentDocumentReview))
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    FilledButton.icon(
                      onPressed: busy ? null : () => _review(item, 'Approve'),
                      icon: const Icon(Icons.check),
                      label: const Text('Onayla'),
                    ),
                    OutlinedButton.icon(
                      onPressed: busy ? null : () => _review(item, 'Reject'),
                      icon: const Icon(Icons.close),
                      label: const Text('Reddet'),
                    ),
                    OutlinedButton.icon(
                      onPressed: busy
                          ? null
                          : () => _review(item, 'RequestReupload'),
                      icon: const Icon(Icons.replay),
                      label: const Text('Yeniden iste'),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => _review(item, 'UpdateDetails'),
                      child: const Text('Tarih / not'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
