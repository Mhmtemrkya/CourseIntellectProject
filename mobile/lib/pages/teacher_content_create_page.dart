import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/content_api_service.dart';
import '../services/content_store.dart';
import '../services/student_registry_store.dart';

class _PlaylistOption {
  const _PlaylistOption({
    required this.key,
    required this.title,
    required this.nextOrder,
  });

  final String key;
  final String title;
  final int nextOrder;
}

class TeacherContentCreatePage extends StatefulWidget {
  const TeacherContentCreatePage({super.key});

  @override
  State<TeacherContentCreatePage> createState() =>
      _TeacherContentCreatePageState();
}

class _TeacherContentCreatePageState extends State<TeacherContentCreatePage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _subjectController = TextEditingController();
  final _teacherController = TextEditingController();
  final _infoController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _fileType = 'Video';
  PlatformFile? _pickedFile;
  String? _pickedFileName;
  List<String> _classOptions = const [];
  String _selectedClass = '';
  List<_PlaylistOption> _playlistOptions = const [];
  String _playlistMode = 'single';
  String _selectedPlaylistKey = '';
  final _playlistTitleController = TextEditingController();
  final _playlistOrderController = TextEditingController(text: '1');
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _subjectController.dispose();
    _teacherController.dispose();
    _infoController.dispose();
    _descriptionController.dispose();
    _playlistTitleController.dispose();
    _playlistOrderController.dispose();
    super.dispose();
  }

  Future<void> _loadSession() async {
    await StudentRegistryStore.instance.ensureLoaded();
    await ContentApiService.instance
        .fetchContents(visibleOnly: false)
        .catchError((_) => <ContentRecord>[]);
    final session = await AuthSessionStore.instance.load();
    final classes =
        StudentRegistryStore.instance.students
            .map((item) => item.className)
            .toSet()
            .toList()
          ..sort();
    final teacherName = session?.fullName.trim().toLowerCase() ?? '';
    final playlistMap = <String, _PlaylistOption>{};
    for (final item in ContentStore.instance.contents) {
      if (!item.isVideo ||
          item.playlistKey == null ||
          item.playlistTitle == null) {
        continue;
      }
      if (teacherName.isNotEmpty &&
          item.teacher.trim().toLowerCase() != teacherName) {
        continue;
      }
      final existing = playlistMap[item.playlistKey!];
      final nextOrder = (item.playlistOrder ?? 0) + 1;
      playlistMap[item.playlistKey!] = _PlaylistOption(
        key: item.playlistKey!,
        title: item.playlistTitle!,
        nextOrder: existing == null
            ? nextOrder
            : (existing.nextOrder > nextOrder ? existing.nextOrder : nextOrder),
      );
    }
    final playlistOptions = playlistMap.values.toList()
      ..sort(
        (left, right) =>
            left.title.toLowerCase().compareTo(right.title.toLowerCase()),
      );
    if (!mounted) return;
    setState(() {
      _teacherController.text = session?.fullName ?? _teacherController.text;
      _classOptions = classes;
      _selectedClass = classes.isEmpty ? '' : classes.first;
      _playlistOptions = playlistOptions;
      _selectedPlaylistKey = playlistOptions.isEmpty
          ? ''
          : playlistOptions.first.key;
      _playlistOrderController.text = playlistOptions.isEmpty
          ? '1'
          : playlistOptions.first.nextOrder.toString();
    });
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const [
        'pdf',
        'doc',
        'docx',
        'ppt',
        'pptx',
        'mp4',
        'mov',
        'm4v',
      ],
    );
    if (!mounted) return;
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.single;
      final fileName = file.name;
      final ext = fileName.contains('.')
          ? fileName.split('.').last.toLowerCase()
          : '';
      final nameWithoutExt = fileName.contains('.')
          ? fileName.substring(0, fileName.lastIndexOf('.'))
          : fileName;

      setState(() {
        _pickedFile = file;
        _pickedFileName = fileName;
      });

      final detectedType = switch (ext) {
        'mp4' || 'mov' || 'm4v' => 'Video',
        'pdf' => 'PDF',
        'doc' || 'docx' => 'Word',
        'ppt' || 'pptx' => 'PowerPoint',
        _ => 'Dosya',
      };
      setState(() => _fileType = detectedType);

      if (_titleController.text.trim().isEmpty) {
        _titleController.text = nameWithoutExt.replaceAll(RegExp(r'[_-]'), ' ');
      }

      final sizeStr = _formatBytes(file.size);
      if (_infoController.text.trim().isEmpty) {
        _infoController.text = 'Boyut: $sizeStr';
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      setState(() {
        _saving = true;
      });
      final uploaded = _pickedFile != null
          ? await ContentApiService.instance.uploadContentAsset(
              file: _pickedFile!,
            )
          : null;
      _PlaylistOption? selectedPlaylist;
      for (final option in _playlistOptions) {
        if (option.key == _selectedPlaylistKey) {
          selectedPlaylist = option;
          break;
        }
      }
      final shouldUsePlaylist =
          _fileType == 'Video' && _playlistMode != 'single';
      final playlistKey = shouldUsePlaylist
          ? (_playlistMode == 'existing'
                ? selectedPlaylist?.key
                : 'playlist-${DateTime.now().millisecondsSinceEpoch}')
          : null;
      final playlistTitle = shouldUsePlaylist
          ? (_playlistMode == 'existing'
                ? selectedPlaylist?.title
                : _playlistTitleController.text.trim())
          : null;
      final playlistOrder = shouldUsePlaylist
          ? int.tryParse(_playlistOrderController.text.trim()) == null
                ? 1
                : int.parse(_playlistOrderController.text.trim()).clamp(1, 999)
          : null;
      await ContentApiService.instance.createContent(
        ContentRecord(
          subject: _subjectController.text.trim(),
          title: _titleController.text.trim(),
          teacher: _teacherController.text.trim(),
          info: _infoController.text.trim(),
          progress: 0,
          fileType: _fileType,
          grade: _selectedClass,
          views: '0 görüntülenme',
          size: uploaded != null
              ? _formatBytes(uploaded.size)
              : (_pickedFileName ?? _defaultSizeLabel()),
          description: _descriptionController.text.trim(),
          fileName: uploaded?.fileName ?? _pickedFileName,
          fileUrl: uploaded?.fileUrl,
          playlistKey: playlistKey,
          playlistTitle: playlistTitle,
          playlistOrder: playlistOrder,
          publishStatus: 'Aktif',
        ),
      );
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 32),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
          ),
          child: Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF16A34A),
                    size: 34,
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'İçerik yayınlandı',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  'Yeni içerik öğrenci panelinde görünmeye başladı.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.color?.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(dialogContext);
                      navigator.pop();
                    },
                    child: const Text('İçerik Yönetimine Dön'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Yeni İçerik',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFFF59E0B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.18),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'İçerik yükleme merkezi',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Video, PDF, Word veya PowerPoint içeriğini tek akışta ekleyip doğrudan öğrenci panelinde yayınlayabilirsin.',
                    style: TextStyle(color: Colors.white70, height: 1.45),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            _sectionCard(
              title: 'Temel Bilgiler',
              child: Column(
                children: [
                  TextFormField(
                    controller: _titleController,
                    validator: _requiredValidator,
                    decoration: const InputDecoration(
                      labelText: 'İçerik Başlığı',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _subjectController,
                          validator: _requiredValidator,
                          decoration: const InputDecoration(
                            labelText: 'Ders',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _selectedClass,
                          decoration: const InputDecoration(
                            labelText: 'Sınıf',
                            border: OutlineInputBorder(),
                          ),
                          items: _classOptions
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text(item),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() {
                              _selectedClass = value;
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _teacherController,
                    validator: _requiredValidator,
                    decoration: const InputDecoration(
                      labelText: 'Öğretmen',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _sectionCard(
              title: 'Yayın Ayrıntıları',
              child: Column(
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _fileType,
                    decoration: const InputDecoration(
                      labelText: 'Dosya Türü',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Video', child: Text('Video')),
                      DropdownMenuItem(value: 'PDF', child: Text('PDF')),
                      DropdownMenuItem(value: 'Word', child: Text('Word')),
                      DropdownMenuItem(
                        value: 'PowerPoint',
                        child: Text('PowerPoint'),
                      ),
                      DropdownMenuItem(value: 'Dosya', child: Text('Dosya')),
                    ],
                    onChanged: (value) =>
                        setState(() => _fileType = value ?? _fileType),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _infoController,
                    validator: _requiredValidator,
                    decoration: InputDecoration(
                      labelText: _fileType == 'Video'
                          ? 'Video Süresi'
                          : 'Sayfa / Slayt Bilgisi',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descriptionController,
                    validator: _requiredValidator,
                    minLines: 4,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'İçerik Açıklaması',
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_fileType == 'Video') ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Oynatma Listesi',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(
                                value: 'single',
                                label: Text('Tek Video'),
                              ),
                              ButtonSegment(
                                value: 'new',
                                label: Text('Yeni Liste'),
                              ),
                              ButtonSegment(
                                value: 'existing',
                                label: Text('Mevcut Liste'),
                              ),
                            ],
                            selected: {_playlistMode},
                            onSelectionChanged: (selection) {
                              final value = selection.first;
                              setState(() {
                                _playlistMode = value;
                                if (value == 'existing' &&
                                    _playlistOptions.isNotEmpty) {
                                  _selectedPlaylistKey =
                                      _playlistOptions.first.key;
                                  _playlistOrderController.text =
                                      _playlistOptions.first.nextOrder
                                          .toString();
                                }
                                if (value == 'single') {
                                  _playlistTitleController.clear();
                                  _playlistOrderController.text = '1';
                                }
                              });
                            },
                          ),
                          if (_playlistMode == 'new') ...[
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _playlistTitleController,
                              validator: (value) {
                                if (_fileType == 'Video' &&
                                    _playlistMode == 'new' &&
                                    (value == null || value.trim().isEmpty)) {
                                  return 'Liste başlığı girin';
                                }
                                return null;
                              },
                              decoration: const InputDecoration(
                                labelText: 'Liste Başlığı',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _playlistOrderController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Video Sırası',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                          if (_playlistMode == 'existing') ...[
                            const SizedBox(height: 12),
                            if (_playlistOptions.isEmpty)
                              const Text(
                                'Henüz oluşturulmuş video listesi yok. Önce yeni liste başlatın.',
                              )
                            else ...[
                              DropdownButtonFormField<String>(
                                initialValue: _selectedPlaylistKey.isEmpty
                                    ? _playlistOptions.first.key
                                    : _selectedPlaylistKey,
                                decoration: const InputDecoration(
                                  labelText: 'Mevcut Liste',
                                  border: OutlineInputBorder(),
                                ),
                                items: _playlistOptions
                                    .map(
                                      (item) => DropdownMenuItem(
                                        value: item.key,
                                        child: Text(item.title),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (value) {
                                  if (value == null) return;
                                  _PlaylistOption? option;
                                  for (final item in _playlistOptions) {
                                    if (item.key == value) {
                                      option = item;
                                      break;
                                    }
                                  }
                                  setState(() {
                                    _selectedPlaylistKey = value;
                                    _playlistOrderController.text =
                                        (option?.nextOrder ?? 1).toString();
                                  });
                                },
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _playlistOrderController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Video Sırası',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            _sectionCard(
              title: 'Dosya Ekle',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFFF59E0B,
                            ).withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.attach_file_rounded,
                            color: Color(0xFFF59E0B),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _pickedFileName ?? 'Henüz dosya seçilmedi',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.color
                                  ?.withValues(alpha: 0.78),
                            ),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _saving ? null : _pickFile,
                          icon: const Icon(Icons.upload_file_rounded),
                          label: const Text('Dosya Seç'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Desteklenen türler: Video, PDF, Word ve PowerPoint',
                    style: TextStyle(
                      color: Theme.of(
                        context,
                      ).textTheme.bodySmall?.color?.withValues(alpha: 0.72),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: 54,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.publish_rounded),
                label: Text(_saving ? 'Yükleniyor...' : 'İçeriği Yayınla'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  String? _requiredValidator(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Bu alan zorunludur';
    }
    return null;
  }

  String _defaultSizeLabel() {
    switch (_fileType) {
      case 'PDF':
        return '2.4 MB';
      case 'Word':
        return '1.8 MB';
      case 'PowerPoint':
        return '6.2 MB';
      default:
        return '245 MB';
    }
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return _defaultSizeLabel();
    final megaBytes = bytes / (1024 * 1024);
    if (megaBytes >= 1) {
      return '${megaBytes.toStringAsFixed(megaBytes >= 10 ? 0 : 1)} MB';
    }

    final kiloBytes = bytes / 1024;
    return '${kiloBytes.toStringAsFixed(kiloBytes >= 10 ? 0 : 1)} KB';
  }
}
