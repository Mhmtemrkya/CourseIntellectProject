import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/admin_directory_api_service.dart';
import '../services/consent_api_service.dart';
import '../widgets/consent_dispatch_sheet.dart';

const _pollInterval = Duration(milliseconds: 2500);

/// Yüklenen PDF için üst sınır; sunucu da 12 MB'da keser.
const _maxPdfBytes = 12 * 1024 * 1024;

const _statusLabels = {
  'Draft': 'Hazırlanıyor',
  'AwaitingSignature': 'İmza bekleniyor',
  'Signed': 'İmzalandı',
  'Cancelled': 'İptal',
};

/// Okul tarafı Sözleşme & Formlar ekranı (masaüstündeki /forms sayfasının eşi).
///
/// Kurumun sözleşme/izin belgesi PDF olarak yüklenir, öğrenci seçilip imza
/// tabletine gönderilir, imzalanan belge buradan paylaşılır. Onam Merkezi'nden
/// farkı: yalnız bir akışa BAĞLI şablonları değil, tanımlı TÜM belgeleri listeler.
class SchoolContractFormsPage extends StatefulWidget {
  const SchoolContractFormsPage({super.key});

  @override
  State<SchoolContractFormsPage> createState() => _SchoolContractFormsPageState();
}

class _SchoolContractFormsPageState extends State<SchoolContractFormsPage> {
  Timer? _timer;
  final _searchController = TextEditingController();

  List<AdminStudentRecord> _students = const [];
  List<Map<String, dynamic>> _templates = const [];
  List<Map<String, dynamic>> _stations = const [];
  List<Map<String, dynamic>> _forms = const [];

  AdminStudentRecord? _selected;
  bool _loading = true;
  bool _uploading = false;
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
    _searchController.dispose();
    super.dispose();
  }

  void _snack(Object message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message.toString().replaceFirst('Bad state: ', ''))),
    );
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      final templates = await ConsentApiService.instance.templates();
      final stations = await ConsentApiService.instance
          .stations()
          .catchError((_) => <Map<String, dynamic>>[]);
      if (!mounted) return;
      setState(() {
        _students = students;
        _templates = templates;
        _stations = stations;
        _loading = false;
      });
      await _loadForms(silent: true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack(error);
    }
  }

  Future<void> _loadForms({bool silent = false}) async {
    final student = _selected;
    if (student == null) {
      setState(() => _forms = const []);
      return;
    }
    try {
      final forms = await ConsentApiService.instance.studentForms(student.id);
      final stations = await ConsentApiService.instance
          .stations()
          .catchError((_) => <Map<String, dynamic>>[]);
      if (!mounted) return;

      // İmza az önce mi geldi? Yeşil şerit bunun için çizilir.
      final fresh = forms.where((form) =>
          form['status'] == 'Signed' &&
          _previousStatuses[form['id'].toString()] == 'AwaitingSignature');

      setState(() {
        if (fresh.isNotEmpty) _justSigned = fresh.first['title']?.toString();
        _previousStatuses = {
          for (final form in forms) form['id'].toString(): form['status'].toString(),
        };
        _forms = forms;
        _stations = stations;
      });
      _syncPolling();
    } catch (error) {
      if (!silent) _snack(error);
    }
  }

  /// Yalnız imza beklenirken yoklanır; boşta ağ trafiği üretilmez.
  void _syncPolling() {
    final awaiting = _forms.any((form) => form['status'] == 'AwaitingSignature');
    if (awaiting) {
      _timer ??= Timer.periodic(_pollInterval, (_) => _loadForms(silent: true));
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  List<AdminStudentRecord> get _filtered {
    final needle = _searchController.text.trim().toLowerCase();
    if (needle.isEmpty) return _students;
    return _students
        .where((student) =>
            '${student.fullName} ${student.schoolNumber} ${student.className}'
                .toLowerCase()
                .contains(needle))
        .toList();
  }

  /// Şablonun bu öğrencideki EN GÜNCEL kaydı: imzalı varsa o, yoksa en yenisi.
  Map<String, dynamic>? _formOf(String templateId) {
    final candidates =
        _forms.where((form) => form['templateId']?.toString() == templateId).toList();
    if (candidates.isEmpty) return null;
    candidates.sort((a, b) {
      final signedA = a['status'] == 'Signed';
      final signedB = b['status'] == 'Signed';
      if (signedA != signedB) return signedA ? -1 : 1;
      final dateA = DateTime.tryParse(
              (a['signedAtUtc'] ?? a['createdAtUtc'] ?? '').toString()) ??
          DateTime(1970);
      final dateB = DateTime.tryParse(
              (b['signedAtUtc'] ?? b['createdAtUtc'] ?? '').toString()) ??
          DateTime(1970);
      return dateB.compareTo(dateA);
    });
    return candidates.first;
  }

  // ── PDF yükleme ───────────────────────────────────────────────────────────

  Future<void> _uploadPdf() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      withData: true,
    );
    final files = picked?.files ?? const <PlatformFile>[];
    if (files.isEmpty || files.first.bytes == null) return;
    final file = files.first;
    if (file.bytes!.length > _maxPdfBytes) {
      _snack('PDF en fazla 12 MB olabilir.');
      return;
    }

    final title = await _askTitle(file.name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), ''));
    if (title == null || title.trim().isEmpty) return;

    setState(() => _uploading = true);
    try {
      // Önce belge yüklenir (sunucu içeriği doğrular), sonra şablona bağlanır.
      final document =
          await ConsentApiService.instance.uploadDocument(file.bytes!, file.name);
      await ConsentApiService.instance.createTemplate({
        'title': title.trim(),
        'body': '',
        'checkItems': const ['Belgenin tamamını okudum.', 'Şartları kabul ediyorum.'],
        'requiresSignature': true,
        'signerRole': 'Parent',
        'isActive': true,
        'sortOrder': 0,
        'bindings': const [],
        'sourceKind': 'Pdf',
        'documentId': document['id'],
      });
      _snack('Belge yüklendi: ${document['fileName']} · ${document['pageCount']} sayfa');
      await _load();
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<String?> _askTitle(String initial) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Belge başlığı'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Örn. Okul Kayıt Sözleşmesi',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Yükle'),
          ),
        ],
      ),
    );
  }

  // ── İmza akışı ────────────────────────────────────────────────────────────

  Future<void> _dispatch(Map<String, dynamic> template, Map<String, dynamic>? existing) async {
    final student = _selected;
    if (student == null) return;

    setState(() => _busyId = template['id'].toString());
    try {
      Map<String, dynamic> form;
      var createdHere = false;
      if (existing != null && existing['status'] == 'Draft') {
        form = await ConsentApiService.instance.form(existing['id'].toString());
      } else {
        final bindings = (template['bindings'] as List?) ?? const [];
        final binding = bindings.isEmpty
            ? null
            : Map<String, dynamic>.from(bindings.first as Map);
        form = await ConsentApiService.instance.createForm(
          templateId: template['id'].toString(),
          studentProfileId: student.id,
          contextKind: binding?['contextKind']?.toString() ?? 'SchoolEnrollment',
          contextKey: binding?['contextKey']?.toString(),
          contextLabel: student.className.isEmpty ? null : student.className,
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
        await ConsentApiService.instance
            .cancelForm(form['id'].toString())
            .catchError((_) {});
      }
      await _loadForms(silent: true);
    } catch (error) {
      if (mounted) setState(() => _busyId = null);
      _snack(error);
    }
  }

  Future<void> _revoke(String formId) async {
    setState(() => _busyId = formId);
    try {
      await ConsentApiService.instance.revokeSession(formId);
      await _loadForms(silent: true);
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _share(String formId, String title) async {
    setState(() => _busyId = formId);
    try {
      // İmzalı PDF sunucuda üretilir (özgün belge + imza tutanağı sayfası).
      final bytes = await ConsentApiService.instance.formPdf(formId);
      final directory = await getTemporaryDirectory();
      final file = File(
        '${directory.path}/${_selected?.fullName ?? 'ogrenci'}-$title.pdf'.replaceAll(' ', '-'),
      );
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: title));
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _previewTemplate(Map<String, dynamic> template) async {
    try {
      final documentId = template['documentId']?.toString();
      if (documentId == null) return;
      final bytes = await ConsentApiService.instance.document(documentId);
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/onam-sablon-$documentId.pdf');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } catch (error) {
      _snack(error);
    }
  }

  // ── Görünüm ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sözleşme & Formlar'),
        actions: [
          IconButton(
            tooltip: 'PDF yükle',
            onPressed: _uploading ? null : _uploadPdf,
            icon: _uploading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file),
          ),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_justSigned != null)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text('Form imzalandı: $_justSigned'),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: _selected == null
                      ? TextField(
                          controller: _searchController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.search),
                            hintText: 'Ad, okul no veya sınıf ara…',
                            border: OutlineInputBorder(),
                          ),
                        )
                      : ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            _selected!.fullName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(_selected!.className.isEmpty ? 'Sınıf yok' : _selected!.className),
                          trailing: TextButton(
                            onPressed: () {
                              setState(() {
                                _selected = null;
                                _forms = const [];
                                _previousStatuses = {};
                              });
                              _timer?.cancel();
                              _timer = null;
                            },
                            child: const Text('Değiştir'),
                          ),
                        ),
                ),
                Expanded(
                  child: _selected == null
                      ? _buildStudentList()
                      : _buildTemplateList(theme),
                ),
              ],
            ),
    );
  }

  Widget _buildStudentList() {
    final students = _filtered;
    if (students.isEmpty) {
      return const Center(child: Text('Öğrenci bulunamadı.'));
    }
    return ListView.builder(
      itemCount: students.length,
      itemBuilder: (context, index) {
        final student = students[index];
        return ListTile(
          leading: CircleAvatar(
            child: Text(student.schoolNumber.isEmpty ? '?' : student.schoolNumber),
          ),
          title: Text(student.fullName),
          subtitle: Text(student.className.isEmpty ? 'Sınıf yok' : student.className),
          onTap: () {
            setState(() {
              _selected = student;
              _previousStatuses = {};
            });
            _loadForms();
          },
        );
      },
    );
  }

  Widget _buildTemplateList(ThemeData theme) {
    if (_templates.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Henüz tanımlı belge yok. Sağ üstteki yükle simgesiyle kurumun sözleşmesini ekleyin.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadForms,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: _templates.length,
        itemBuilder: (context, index) {
          final template = _templates[index];
          final form = _formOf(template['id'].toString());
          final status = form?['status']?.toString();
          final isPdf = template['sourceKind']?.toString() == 'Pdf';
          final busy = _busyId == template['id'].toString() || _busyId == form?['id'];

          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(isPdf ? Icons.picture_as_pdf_outlined : Icons.description_outlined),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          template['title']?.toString() ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Chip(
                        label: Text(
                          isPdf ? 'PDF · ${template['documentPageCount']} sayfa' : 'Sistem metni',
                        ),
                        visualDensity: VisualDensity.compact,
                      ),
                      Text(
                        status == null ? 'Gönderilmedi' : (_statusLabels[status] ?? status),
                        style: theme.textTheme.bodySmall,
                      ),
                      if (form?['signedAtUtc'] != null)
                        Text(
                          DateTime.parse(form!['signedAtUtc'].toString())
                              .toLocal()
                              .toString()
                              .substring(0, 16),
                          style: theme.textTheme.bodySmall,
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (isPdf)
                        TextButton(
                          onPressed: () => _previewTemplate(template),
                          child: const Text('Belgeyi gör'),
                        ),
                      const SizedBox(width: 8),
                      if (status == 'Signed') ...[
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () => _share(
                                    form!['id'].toString(),
                                    template['title']?.toString() ?? 'belge',
                                  ),
                          child: const Text('İmzalı PDF'),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: busy ? null : () => _dispatch(template, null),
                          child: const Text('Yeniden al'),
                        ),
                      ] else if (status == 'AwaitingSignature')
                        OutlinedButton(
                          onPressed: busy ? null : () => _revoke(form!['id'].toString()),
                          child: const Text('Geri al'),
                        )
                      else
                        FilledButton(
                          onPressed: busy ? null : () => _dispatch(template, form),
                          child: const Text('İmzaya gönder'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
