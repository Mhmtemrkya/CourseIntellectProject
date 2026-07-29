import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/consent_api_service.dart';
import '../widgets/consent_dispatch_sheet.dart';

const _pollInterval = Duration(milliseconds: 2500);

const _statusLabels = {
  'Draft': 'Hazırlanıyor',
  'AwaitingSignature': 'İmza bekleniyor',
  'Signed': 'İmzalandı',
  'Cancelled': 'İptal',
};

/// Onam Merkezi — personelin form hazırlayıp tablete gönderdiği, imzayı canlı
/// izlediği ve imzalı belgeyi paylaştığı ekran.
///
/// Öğrenci kartından, randevudan ve cari hesaptan aynı sayfa açılır; bağlam
/// (contextKind/contextKey/contextRefId) dışarıdan verilir.
class ConsentCenterPage extends StatefulWidget {
  final String studentProfileId;
  final String? studentName;
  final String? contextKind;
  final String? contextKey;
  final String? contextRefId;
  final String? contextLabel;

  const ConsentCenterPage({
    super.key,
    required this.studentProfileId,
    this.studentName,
    this.contextKind,
    this.contextKey,
    this.contextRefId,
    this.contextLabel,
  });

  @override
  State<ConsentCenterPage> createState() => _ConsentCenterPageState();
}

class _ConsentCenterPageState extends State<ConsentCenterPage> {
  Timer? _timer;
  Map<String, dynamic>? _status;
  List<Map<String, dynamic>> _stations = const [];
  bool _loading = true;
  String? _busyId;
  String? _justSigned;
  Map<String, String> _previousStatuses = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  List<Map<String, dynamic>> get _requirements =>
      (_status?['requirements'] as List?)
          ?.map((e) => Map<String, dynamic>.from(e as Map))
          .toList() ??
      const [];

  List<Map<String, dynamic>> get _otherForms =>
      (_status?['otherForms'] as List?)
          ?.map((e) => Map<String, dynamic>.from(e as Map))
          .toList() ??
      const [];

  bool get _awaiting =>
      _requirements.any((row) => row['status'] == 'AwaitingSignature');

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final next = await ConsentApiService.instance.status(
        widget.studentProfileId,
        contextKind: widget.contextKind,
        contextKey: widget.contextKey,
        contextRefId: widget.contextRefId,
      );
      final stations = await ConsentApiService.instance.stations().catchError(
            (_) => <Map<String, dynamic>>[],
          );
      if (!mounted) return;

      // İmza az önce mi geldi? Yeşil şerit bunun için çizilir.
      final rows = (next['requirements'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const <Map<String, dynamic>>[];
      final fresh = rows.where((row) =>
          row['status'] == 'Signed' &&
          _previousStatuses[row['templateId'].toString()] == 'AwaitingSignature');

      setState(() {
        if (fresh.isNotEmpty) _justSigned = fresh.first['title']?.toString();
        _previousStatuses = {
          for (final row in rows) row['templateId'].toString(): row['status'].toString(),
        };
        _status = next;
        _stations = stations;
        _loading = false;
      });
      _syncPolling();
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      if (!silent) _snack(error);
    }
  }

  /// Yalnız imza beklenirken yoklanır; boşta ağ trafiği üretilmez.
  void _syncPolling() {
    if (_awaiting) {
      _timer ??= Timer.periodic(_pollInterval, (_) => _load(silent: true));
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _snack(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.toString().replaceFirst('Bad state: ', ''))),
    );
  }

  Future<void> _openComposer(Map<String, dynamic> requirement) async {
    setState(() => _busyId = requirement['templateId'].toString());
    try {
      final formId = requirement['formId']?.toString();
      Map<String, dynamic> form;
      var createdHere = false;

      if (formId != null && requirement['status'] != 'Cancelled') {
        // Var olan taslakta KAYDIN kendi metni okunur, şablonunki değil:
        // yer tutucular kayıt üretilirken dolduruldu.
        form = await ConsentApiService.instance.form(formId);
      } else {
        form = await ConsentApiService.instance.createForm(
          templateId: requirement['templateId'].toString(),
          studentProfileId: widget.studentProfileId,
          contextKind: widget.contextKind ?? 'General',
          contextKey: widget.contextKey,
          contextRefId: widget.contextRefId,
          contextLabel: widget.contextLabel,
        );
        createdHere = true;
      }
      if (!mounted) return;
      setState(() => _busyId = null);

      final dispatched = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (context) => ConsentDispatchSheet(form: form, stations: _stations),
      );

      // Gönderilmediyse ve taslağı BU açılışta ürettiysek geri al; çöp kalmasın.
      if (dispatched != true && createdHere) {
        await ConsentApiService.instance.cancelForm(form['id'].toString()).catchError((_) {});
      }
      await _load(silent: true);
    } catch (error) {
      if (mounted) setState(() => _busyId = null);
      _snack(error);
    }
  }

  Future<void> _revoke(String formId) async {
    setState(() => _busyId = formId);
    try {
      await ConsentApiService.instance.revokeSession(formId);
      await _load(silent: true);
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _share(String formId, String title) async {
    setState(() => _busyId = formId);
    try {
      // PDF sunucuda üretilir (logolu, kurum künyeli); istemci yalnız paylaşır.
      final bytes = await ConsentApiService.instance.formPdf(formId);
      final directory = await getTemporaryDirectory();
      final name =
          '${widget.studentName ?? 'ogrenci'}-$title.pdf'.replaceAll(' ', '-');
      final file = File('${directory.path}/$name');
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path)], text: title),
      );
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final signed = (_status?['signedCount'] as num?)?.toInt() ?? 0;
    final required = (_status?['requiredCount'] as num?)?.toInt() ?? 0;
    final complete = _status?['complete'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Onam Formları'),
        bottom: widget.studentName == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(24),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(widget.studentName!, style: theme.textTheme.bodySmall),
                ),
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_justSigned != null)
                    _Banner(
                      color: Colors.green,
                      text: 'Form imzalandı: $_justSigned',
                    ),
                  if (required == 0)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Text(
                        'Bu akış için tanımlanmış onam formu yok.\n\n'
                        'Formları masaüstü uygulamada Ayarlar › Onam Formları '
                        'ekranından tanımlayabilirsiniz.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  else ...[
                    _Banner(
                      color: complete ? Colors.green : Colors.amber,
                      text: complete
                          ? '$signed/$required form imzalı — tüm onamlar tamam.'
                          : '$signed/$required form imzalı — eksik onam formu var.',
                    ),
                    const SizedBox(height: 8),
                    ..._requirements.map(_requirementTile),
                  ],
                  if (_otherForms.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text('DİĞER İMZALI FORMLAR', style: theme.textTheme.labelSmall),
                    const SizedBox(height: 4),
                    ..._otherForms.map(
                      (form) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(form['title']?.toString() ?? ''),
                        trailing: TextButton(
                          onPressed: _busyId == form['id']
                              ? null
                              : () => _share(
                                    form['id'].toString(),
                                    form['title']?.toString() ?? 'form',
                                  ),
                          child: const Text('PDF'),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _requirementTile(Map<String, dynamic> row) {
    final status = row['status']?.toString();
    final formId = row['formId']?.toString();
    final templateId = row['templateId'].toString();
    final busy = _busyId == formId || _busyId == templateId;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              row['title']?.toString() ?? '',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _StatusChip(status: status),
                // Yüklenmiş belgeye dayanan formlar ayırt edilebilsin.
                if (row['sourceKind']?.toString() == 'Pdf')
                  const Chip(
                    label: Text('PDF belge'),
                    visualDensity: VisualDensity.compact,
                  ),
                if (status == 'AwaitingSignature' &&
                    (row['stationName']?.toString() ?? '').isNotEmpty)
                  Text(row['stationName'].toString(),
                      style: Theme.of(context).textTheme.bodySmall),
                if (row['signedAtUtc'] != null)
                  Text(
                    DateTime.parse(row['signedAtUtc'].toString())
                        .toLocal()
                        .toString()
                        .substring(0, 16),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: switch (status) {
                'Signed' => [
                    OutlinedButton(
                      onPressed: busy
                          ? null
                          : () => _share(formId!, row['title']?.toString() ?? 'form'),
                      child: const Text('PDF paylaş'),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => _openComposer({...row, 'formId': null}),
                      child: const Text('Yeniden al'),
                    ),
                  ],
                'AwaitingSignature' => [
                    OutlinedButton(
                      onPressed: busy ? null : () => _revoke(formId!),
                      child: const Text('Geri al'),
                    ),
                  ],
                _ => [
                    FilledButton(
                      onPressed: busy ? null : () => _openComposer(row),
                      child: const Text('Formu doldur'),
                    ),
                  ],
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String? status;

  const _StatusChip({this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'Signed' => (Colors.green, 'İmzalandı'),
      'AwaitingSignature' => (Colors.amber, 'İmza bekleniyor'),
      null => (Colors.grey, 'Açılmadı'),
      _ => (Colors.blueGrey, _statusLabels[status] ?? status!),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(color: color.shade800, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final MaterialColor color;
  final String text;

  const _Banner({required this.color, required this.text});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          border: Border.all(color: color.withValues(alpha: 0.35)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          style: TextStyle(color: color.shade800, fontWeight: FontWeight.w600),
        ),
      );
}

/// "Formu doldur" bölmesi: metin önizlemesi, uygulama notu, hedef tablet.
