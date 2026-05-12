import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/message_api_service.dart';
import '../services/student_registry_store.dart';
import '../services/uploads_api_service.dart';
import '../widgets/admin_ui.dart';
import 'administrative_document_detail_page.dart';

class AdministrativeDocumentsPage extends StatefulWidget {
  const AdministrativeDocumentsPage({super.key});

  @override
  State<AdministrativeDocumentsPage> createState() =>
      _AdministrativeDocumentsPageState();
}

class _AdministrativeDocumentsPageState
    extends State<AdministrativeDocumentsPage> {
  final _store = StudentRegistryStore.instance;
  final _searchController = TextEditingController();
  String _statusFilter = 'Tümü';

  @override
  void initState() {
    super.initState();
    _store.ensureLoaded();
    _store.addListener(_refresh);
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final records = _documentRecords();
    final waitingCount = records
        .where((item) => item.status == 'Eksik Evrak')
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Evrak Takibi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Evrak Yükle',
            icon: const Icon(Icons.upload_file_rounded),
            onPressed: _uploadDocument,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Evrak kontrolü',
            title:
                'Kayıt dosyaları, veli sözleşmeleri ve eksik belge süreçlerini yönetin.',
            description:
                'Öğrenci bazlı evrak durumu, eksik belge ve sözleşme takibi bu ekranda toplanır.',
            colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AdminHeroMetric(
                label: 'Toplam Dosya',
                value: '${records.length}',
              ),
              AdminHeroMetric(label: 'Eksik', value: '$waitingCount kayıt'),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Öğrenci veya veli ara...',
              prefixIcon: Icon(Icons.search_rounded),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: ['Tümü', 'Tamamlandı', 'Eksik Evrak', 'Sözleşme Bekliyor']
                .map(
                  (item) => ChoiceChip(
                    label: Text(item),
                    selected: _statusFilter == item,
                    onSelected: (_) => setState(() => _statusFilter = item),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          ...records.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.studentName,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      AdminAccentBadge(
                        label: item.status,
                        color: item.status == 'Tamamlandı'
                            ? const Color(0xFF14532D)
                            : item.status == 'Eksik Evrak'
                            ? const Color(0xFFB45309)
                            : const Color(0xFF2563EB),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item.className} • ${item.parentName}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  _docRow(context, 'TC / Kimlik', item.identityReady),
                  _docRow(context, 'Okul Bilgisi', item.schoolReady),
                  _docRow(context, 'Veli Sözleşmesi', item.contractReady),
                  _docRow(context, 'İletişim Evrakı', item.contactReady),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    AdministrativeDocumentDetailPage(
                                      studentName: item.studentName,
                                      className: item.className,
                                      parentName: item.parentName,
                                      status: item.status,
                                      identityReady: item.identityReady,
                                      schoolReady: item.schoolReady,
                                      contractReady: item.contractReady,
                                      contactReady: item.contactReady,
                                    ),
                              ),
                            );
                          },
                          child: const Text('Detayı Aç'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => _sendReminder(item),
                          child: const Text('Hatırlat'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _docRow(BuildContext context, String label, bool isReady) {
    final color = isReady ? const Color(0xFF14532D) : const Color(0xFFB45309);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            isReady
                ? Icons.check_circle_rounded
                : Icons.pending_actions_rounded,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
          Text(
            isReady ? 'Hazır' : 'Bekliyor',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  List<_AdministrativeDocumentRecord> _documentRecords() {
    final query = _searchController.text.trim().toLowerCase();
    return _store.students
        .map(
          (student) => _AdministrativeDocumentRecord(
            studentName: student.fullName,
            className: student.className,
            parentName: student.parentName,
            identityReady: student.tcNo.length == 11,
            schoolReady: student.currentSchool.isNotEmpty,
            contractReady: student.parentEmail.isNotEmpty,
            contactReady: student.parentPhone.isNotEmpty,
          ),
        )
        .where((item) {
          final statusMatch =
              _statusFilter == 'Tümü' || item.status == _statusFilter;
          final text =
              '${item.studentName} ${item.parentName} ${item.className}'
                  .toLowerCase();
          final queryMatch = query.isEmpty || text.contains(query);
          return statusMatch && queryMatch;
        })
        .toList();
  }

  Future<void> _uploadDocument() async {
    final students = _store.students;
    String? selectedStudentName = students.isNotEmpty
        ? students.first.fullName
        : null;
    String folder = 'documents';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (builderContext, setDialogState) => AlertDialog(
            title: const Text('Evrak Yükle'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (students.isEmpty)
                  const Text('Önce öğrenci kaydı olmalıdır.')
                else
                  DropdownButtonFormField<String>(
                    initialValue: selectedStudentName,
                    decoration: const InputDecoration(labelText: 'Öğrenci'),
                    items: students
                        .map(
                          (student) => DropdownMenuItem(
                            value: student.fullName,
                            child: Text(student.fullName),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setDialogState(() => selectedStudentName = value),
                  ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: folder,
                  decoration: const InputDecoration(labelText: 'Kategori'),
                  items: const [
                    DropdownMenuItem(
                      value: 'documents',
                      child: Text('Genel Evrak'),
                    ),
                    DropdownMenuItem(
                      value: 'identity',
                      child: Text('TC / Kimlik'),
                    ),
                    DropdownMenuItem(
                      value: 'contract',
                      child: Text('Sozlesme'),
                    ),
                    DropdownMenuItem(
                      value: 'school',
                      child: Text('Okul Belgesi'),
                    ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => folder = value ?? 'documents'),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Vazgec'),
              ),
              FilledButton(
                onPressed: students.isEmpty
                    ? null
                    : () => Navigator.pop(dialogContext, true),
                child: const Text('Dosya Seç'),
              ),
            ],
          ),
        );
      },
    );

    if (confirmed != true || selectedStudentName == null) return;

    final pickResult = await FilePicker.platform.pickFiles(type: FileType.any);
    if (pickResult == null || pickResult.files.isEmpty) return;
    final picked = pickResult.files.single;
    final path = picked.path;
    if (path == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Dosyaya erisilemedi.')));
      return;
    }

    if (!mounted) return;
    final scaffold = ScaffoldMessenger.of(context);
    scaffold.showSnackBar(
      SnackBar(
        content: Text('${picked.name} yükleniyor...'),
        duration: const Duration(seconds: 2),
      ),
    );

    try {
      final asset = await UploadsApiService.instance.uploadFile(
        file: File(path),
        folder: '$folder/${_slug(selectedStudentName!)}',
      );
      if (!mounted) return;
      scaffold.showSnackBar(
        SnackBar(content: Text('${asset.fileName} yüklendi.')),
      );
    } catch (error) {
      if (!mounted) return;
      scaffold.showSnackBar(
        SnackBar(content: Text('Yükleme başarısız: $error')),
      );
    }
  }

  String _slug(String value) {
    final lowered = value.trim().toLowerCase();
    final buffer = StringBuffer();
    for (final ch in lowered.codeUnits) {
      final char = String.fromCharCode(ch);
      if (RegExp(r'[a-z0-9]').hasMatch(char)) {
        buffer.write(char);
      } else if (char == ' ' || char == '-' || char == '_') {
        buffer.write('-');
      }
    }
    final result = buffer
        .toString()
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
    return result.isEmpty ? 'unknown' : result;
  }

  Future<void> _sendReminder(_AdministrativeDocumentRecord item) async {
    final draft =
        'Merhaba ${item.parentName}, ${item.studentName} için kayıt dosyasında eksik evrak görünüyor. Belgeleri en kısa sürede tamamlamanızı rica ederiz.';
    try {
      final thread = await MessageApiService.instance.createOrGetThread(
        contactName: item.parentName,
        contactRole: 'Parent',
      );
      await MessageApiService.instance.sendMessage(
        threadId: thread.id,
        text: draft,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${item.parentName} için evrak hatırlatması gönderildi.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Hatırlatma gönderilemedi: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _AdministrativeDocumentRecord {
  final String studentName;
  final String className;
  final String parentName;
  final bool identityReady;
  final bool schoolReady;
  final bool contractReady;
  final bool contactReady;

  const _AdministrativeDocumentRecord({
    required this.studentName,
    required this.className,
    required this.parentName,
    required this.identityReady,
    required this.schoolReady,
    required this.contractReady,
    required this.contactReady,
  });

  String get status {
    final readyCount = [
      identityReady,
      schoolReady,
      contractReady,
      contactReady,
    ].where((item) => item).length;
    if (readyCount == 4) return 'Tamamlandı';
    if (!contractReady) return 'Sözleşme Bekliyor';
    return 'Eksik Evrak';
  }
}
