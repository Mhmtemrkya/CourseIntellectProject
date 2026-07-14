import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

/// Sürücü adayının kurs dosyası. Eksik ve reddedilen belgeler en üstte durur;
/// ret nedeni aynen gösterilir ki aday doğru belgeyi yeniden yüklesin.
class DrivingStudentDocumentsPage extends StatefulWidget {
  const DrivingStudentDocumentsPage({super.key});

  @override
  State<DrivingStudentDocumentsPage> createState() =>
      _DrivingStudentDocumentsPageState();
}

class _DrivingStudentDocumentsPageState
    extends State<DrivingStudentDocumentsPage> {
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Map<String, dynamic> _file = const {};

  /// Son geçerlilik tarihi zorunlu olan belgeler (backend de aynısını zorlar).
  static const _expiringTypes = {
    'HealthReport',
    'CriminalRecord',
    'ExistingLicense',
  };

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
      final data = await DrivingSchoolApiService.instance.myDocuments();
      if (mounted) setState(() => _file = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _items => ((_file['items'] as List?) ?? const [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();

  /// Eksik → reddedilen → süresi dolmuş → onay bekleyen → onaylı sırasıyla.
  int _priority(String status) => switch (status) {
    'Missing' => 0,
    'Rejected' => 1,
    'Expired' => 2,
    'PendingApproval' => 3,
    _ => 4,
  };

  (Color, IconData, String) _tone(String status) => switch (status) {
    'Approved' => (Colors.green, Icons.verified_rounded, 'Onaylandı'),
    'PendingApproval' => (
      Colors.amber,
      Icons.hourglass_top_rounded,
      'Onay bekliyor',
    ),
    'Rejected' => (Colors.red, Icons.cancel_rounded, 'Reddedildi'),
    'Expired' => (
      Colors.orange,
      Icons.event_busy_rounded,
      'Süresi doldu',
    ),
    _ => (Colors.red, Icons.upload_file_rounded, 'Eksik'),
  };

  Future<void> _upload(Map<String, dynamic> item) async {
    final type = '${item['documentType']}';
    DateTime? expires;

    if (_expiringTypes.contains(type)) {
      expires = await showDatePicker(
        context: context,
        firstDate: DateTime.now(),
        lastDate: DateTime.now().add(const Duration(days: 365 * 10)),
        initialDate: DateTime.now().add(const Duration(days: 180)),
        helpText: '${item['label']} son geçerlilik tarihi',
      );
      if (expires == null) return; // tarih girilmeden bu belge yüklenemez
    }

    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    final file = picked?.files.firstOrNull;
    if (file == null) return;

    setState(() => _busy = true);
    try {
      final url = await DrivingSchoolApiService.instance.uploadVehicleDocument(
        file,
        folder: 'driving-student-documents',
      );
      await DrivingSchoolApiService.instance.uploadMyDocument({
        'documentType': type,
        'fileUrl': url,
        'fileName': file.name,
        'expiresAtUtc': expires?.toUtc().toIso8601String(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Belge yüklendi, kurum onayı bekleniyor.'.tr),
          ),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Belge yüklenemedi: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items
      ..sort(
        (a, b) => _priority(
          '${a['status']}',
        ).compareTo(_priority('${b['status']}')),
      );
    final missing = (_file['missingCount'] as num?)?.toInt() ?? 0;
    final complete = _file['complete'] == true;

    return DrivingScaffold(
      appBar: AppBar(title: Text('Evraklarım'.tr)),
      child: _loading
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
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    color: complete
                        ? Colors.green.withValues(alpha: 0.1)
                        : Colors.amber.withValues(alpha: 0.1),
                    child: ListTile(
                      leading: Icon(
                        complete
                            ? Icons.check_circle_rounded
                            : Icons.warning_amber_rounded,
                        color: complete ? Colors.green : Colors.amber.shade800,
                      ),
                      title: Text(
                        complete
                            ? 'Dosyanız tamam'
                            : '$missing zorunlu evrak eksik',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      subtitle: Text(
                        complete
                            ? 'Tüm zorunlu belgeleriniz onaylandı.'
                            : 'Dosyanız tamamlanmadan direksiyon eğitimine başlayamazsınız.',
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...items.map((item) {
                    final status = '${item['status']}';
                    final (color, icon, label) = _tone(status);
                    final canUpload = status != 'Approved';
                    final reason = '${item['rejectionReason'] ?? ''}';
                    final expiresAt = item['expiresAtUtc'];

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(icon, color: color),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${item['label']}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      Text(
                                        label,
                                        style: TextStyle(
                                          color: color,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (item['required'] == true)
                                  const Chip(
                                    label: Text(
                                      'Zorunlu',
                                      style: TextStyle(fontSize: 11),
                                    ),
                                    visualDensity: VisualDensity.compact,
                                  ),
                              ],
                            ),
                            if (expiresAt != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  'Geçerlilik: ${DateTime.parse('$expiresAt').toLocal().toString().split(' ').first}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            if (reason.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.red.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    'Ret nedeni: $reason',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.red,
                                    ),
                                  ),
                                ),
                              ),
                            if (canUpload)
                              Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: FilledButton.icon(
                                  onPressed: _busy ? null : () => _upload(item),
                                  icon: const Icon(Icons.upload_rounded),
                                  label: Text(
                                    status == 'Missing'
                                        ? 'Belgeyi yükle'
                                        : 'Yeniden yükle',
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
  }
}
