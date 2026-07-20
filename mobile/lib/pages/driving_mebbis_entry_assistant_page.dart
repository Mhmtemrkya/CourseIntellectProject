import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';

class DrivingMebbisEntryAssistantPage extends StatefulWidget {
  const DrivingMebbisEntryAssistantPage({super.key, required this.profileId});

  final String profileId;

  @override
  State<DrivingMebbisEntryAssistantPage> createState() =>
      _DrivingMebbisEntryAssistantPageState();
}

class _DrivingMebbisEntryAssistantPageState
    extends State<DrivingMebbisEntryAssistantPage> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _completing = false;
  bool _inspectingPhoto = false;
  String _saving = '';
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
      final permissions = await DrivingPermissionsStore.instance.load();
      if (!permissions.can(DrivingPermissions.mebbisManage)) {
        throw StateError('MEBBİS giriş asistanı yetkiniz yok.');
      }
      final data = await DrivingSchoolApiService.instance.mebbisEntryAssistant(
        widget.profileId,
      );
      if (mounted) setState(() => _data = data);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Bad state: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copy(Map<String, dynamic> field) async {
    if (field['hasValue'] != true) return;
    await Clipboard.setData(ClipboardData(text: '${field['value']}'));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${field['label']} panoya kopyalandı.')),
      );
    }
  }

  Future<void> _toggle(Map<String, dynamic> field) async {
    final key = '${field['key']}';
    setState(() => _saving = key);
    try {
      await DrivingSchoolApiService.instance.updateMebbisEntryField(
        widget.profileId,
        key,
        field['completed'] != true,
        (field['version'] as num?)?.toInt() ?? 0,
      );
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

  Future<void> _complete() async {
    final workItem = Map<String, dynamic>.from(
      _data?['workItem'] as Map? ?? const {},
    );
    setState(() => _completing = true);
    try {
      await DrivingSchoolApiService.instance.completeMebbisEntryAssistant(
        widget.profileId,
        (workItem['version'] as num?)?.toInt() ?? 0,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('MEBBİS girişi tamamlandı; ikinci kontrole hazır.'),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
        await _load();
      }
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  Future<void> _inspectPhoto() async {
    setState(() => _inspectingPhoto = true);
    try {
      await DrivingSchoolApiService.instance.inspectMebbisPhoto(
        widget.profileId,
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fotoğraf kalite denetimi tamamlandı.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _inspectingPhoto = false);
    }
  }

  Future<void> _shareMebbisPhoto(Map<String, dynamic> inspection) async {
    try {
      final bytes = await DrivingSchoolApiService.instance.downloadMebbisPhoto(
        '${inspection['id']}',
      );
      final directory = await getTemporaryDirectory();
      final file = File(
        '${directory.path}/mebbis-fotograf-${widget.profileId}.jpg',
      );
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path)],
          text: 'MEBBİS için hazırlanmış biyometrik fotoğraf',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fotoğraf paylaşılamadı: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MEBBİS Giriş Asistanı'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _data == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Yeniden dene'),
                    ),
                  ],
                ),
              ),
            )
          : _content(),
    );
  }

  Widget _content() {
    final data = _data!;
    final fields = (data['fields'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    final progress = Map<String, dynamic>.from(
      data['progress'] as Map? ?? const {},
    );
    final missing = (data['readinessMissing'] as List? ?? const [])
        .map((x) => '$x')
        .toList();
    final quality = Map<String, dynamic>.from(
      data['quality'] as Map? ?? const {},
    );
    final photoInspection = data['photoInspection'] is Map
        ? Map<String, dynamic>.from(data['photoInspection'] as Map)
        : null;
    final percent = (progress['percent'] as num?)?.toDouble() ?? 0;
    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${data['studentName']}',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                Text('Kursiyer #${data['studentNumber']}'),
                const SizedBox(height: 12),
                _warning('${data['warning']}'),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${progress['completed']}/${progress['total']} alan • %${percent.toInt()}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(value: percent / 100),
                      ],
                    ),
                  ),
                ),
                if (missing.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _missingCard(missing),
                ],
                const SizedBox(height: 8),
                _photoInspectionPanel(photoInspection),
                if (quality.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _qualityPanel(quality),
                ],
                const SizedBox(height: 8),
                ...fields.asMap().entries.map(
                  (entry) => _fieldCard(entry.key + 1, entry.value),
                ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(
                top: BorderSide(color: Theme.of(context).dividerColor),
              ),
            ),
            child: FilledButton.icon(
              onPressed: data['canComplete'] == true && !_completing
                  ? _complete
                  : null,
              icon: _completing
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.verified_rounded),
              label: const Text('Girişi tamamla'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _warning(String text) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.amber.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.security_rounded, color: Colors.amber),
        const SizedBox(width: 8),
        Expanded(child: Text('$text Pano içeriğini işlem sonunda temizleyin.')),
      ],
    ),
  );

  Widget _missingCard(List<String> missing) => Card(
    color: Colors.red.withValues(alpha: .06),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Eksik kayıt/evraklar',
            style: TextStyle(fontWeight: FontWeight.w800, color: Colors.red),
          ),
          const SizedBox(height: 6),
          ...missing.map((x) => Text('• $x')),
        ],
      ),
    ),
  );

  Widget _fieldCard(int index, Map<String, dynamic> field) {
    final completed = field['completed'] == true;
    final hasValue = field['hasValue'] == true;
    final completedAt = DateTime.tryParse(
      '${field['completedAtUtc']}',
    )?.toLocal();
    return Card(
      color: completed ? Colors.green.withValues(alpha: .06) : null,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$index. ${field['label']}',
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 4),
            SelectableText(
              hasValue ? '${field['value']}' : 'Bilgi eksik',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: hasValue ? null : Colors.red,
              ),
            ),
            if (completed) ...[
              const SizedBox(height: 5),
              Text(
                '${field['completedByName'] ?? 'Yetkili kullanıcı'}${completedAt == null ? '' : ' • ${completedAt.day.toString().padLeft(2, '0')}.${completedAt.month.toString().padLeft(2, '0')}.${completedAt.year} ${completedAt.hour.toString().padLeft(2, '0')}:${completedAt.minute.toString().padLeft(2, '0')}'}',
                style: const TextStyle(fontSize: 11, color: Colors.green),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: hasValue ? () => _copy(field) : null,
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: const Text('Kopyala'),
                ),
                FilledButton.tonalIcon(
                  onPressed: hasValue && _saving != '${field['key']}'
                      ? () => _toggle(field)
                      : null,
                  icon: Icon(completed ? Icons.check_circle : Icons.check),
                  label: Text(completed ? 'Girildi' : 'Girdim'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _photoInspectionPanel(Map<String, dynamic>? inspection) {
    final overall = '${inspection?['overall'] ?? 'Orange'}';
    final checks = (inspection?['checks'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    final color = _qualityColor(overall);
    return Card(
      color: color.withValues(alpha: .06),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.face_retouching_natural_rounded),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Fotoğraf Uygunluk Denetimi',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            const Text(
              'Yüz, ışık, arka plan, ölçü ve güncellik cihazdan dışarı gönderilmeden sunucudaki yerel modelle kontrol edilir. Orijinal korunur.',
              style: TextStyle(fontSize: 11),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _inspectingPhoto ? null : _inspectPhoto,
                  icon: _inspectingPhoto
                      ? const SizedBox.square(
                          dimension: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.document_scanner_rounded),
                  label: Text(
                    inspection == null
                        ? 'Fotoğrafı denetle'
                        : 'Yeniden denetle',
                  ),
                ),
                if (inspection?['mebbisCopyAvailable'] == true)
                  OutlinedButton.icon(
                    onPressed: () => _shareMebbisPhoto(inspection!),
                    icon: const Icon(Icons.ios_share_rounded),
                    label: const Text('İndir / paylaş'),
                  ),
              ],
            ),
            if (inspection == null) ...[
              const SizedBox(height: 10),
              const Text(
                'Güncel fotoğraf için otomatik denetim kaydı yok.',
                style: TextStyle(
                  color: Colors.deepOrange,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ] else ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  Chip(
                    label: Text(_qualityLabel(overall)),
                    side: BorderSide.none,
                    backgroundColor: color.withValues(alpha: .14),
                  ),
                  Chip(
                    label: Text(
                      '${inspection['width']}×${inspection['height']}',
                    ),
                    side: BorderSide.none,
                  ),
                  Chip(
                    label: Text('${inspection['faceCount']} yüz'),
                    side: BorderSide.none,
                  ),
                  if (inspection['mebbisCopyAvailable'] == true)
                    const Chip(
                      label: Text('600×800 JPEG hazır'),
                      side: BorderSide.none,
                    ),
                ],
              ),
              ...checks.map((check) {
                final checkColor = _qualityColor('${check['severity']}');
                return Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(top: 7),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: checkColor.withValues(alpha: .07),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: checkColor.withValues(alpha: .3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${check['title']}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${check['message']}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  Color _qualityColor(String severity) => switch (severity) {
    'Red' => Colors.red,
    'Orange' => Colors.deepOrange,
    'Yellow' => Colors.amber.shade800,
    _ => Colors.green,
  };

  String _qualityLabel(String severity) => switch (severity) {
    'Red' => 'Kırmızı • Girişi engeller',
    'Orange' => 'Turuncu • Personel kontrolü',
    'Yellow' => 'Sarı • Uyarı',
    _ => 'Yeşil • Hazır',
  };

  Widget _qualityPanel(Map<String, dynamic> quality) {
    final overall = '${quality['overall'] ?? 'Red'}';
    final checks = (quality['checks'] as List? ?? const [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
    return Card(
      color: _qualityColor(overall).withValues(alpha: .06),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'MEBBİS Veri Kalitesi',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                Chip(
                  side: BorderSide.none,
                  backgroundColor: _qualityColor(
                    overall,
                  ).withValues(alpha: .14),
                  label: Text(
                    _qualityLabel(overall),
                    style: TextStyle(
                      color: _qualityColor(overall),
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
            const Text(
              'Kırmızı sonuçlar sunucu tarafından MEBBİS girişine kapatılır.',
              style: TextStyle(fontSize: 11),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _qualityCount(
                  'Engelleyici',
                  quality['blockingCount'],
                  Colors.red,
                ),
                _qualityCount(
                  'Kontrol',
                  quality['reviewCount'],
                  Colors.deepOrange,
                ),
                _qualityCount(
                  'Uyarı',
                  quality['warningCount'],
                  Colors.amber.shade800,
                ),
                _qualityCount('Başarılı', quality['passedCount'], Colors.green),
              ],
            ),
            const SizedBox(height: 10),
            ...checks.map((check) {
              final severity = '${check['severity']}';
              final color = _qualityColor(severity);
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 7),
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .07),
                  border: Border.all(color: color.withValues(alpha: .35)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${check['category']} • ${check['title']}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${check['message']}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _qualityCount(String label, dynamic value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      '${(value as num?)?.toInt() ?? 0} $label',
      style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11),
    ),
  );
}
