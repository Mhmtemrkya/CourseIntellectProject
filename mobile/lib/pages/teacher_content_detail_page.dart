import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../services/api_config.dart';
import '../services/content_api_service.dart';
import '../services/content_store.dart';

class TeacherContentDetailPage extends StatefulWidget {
  final ContentRecord content;
  final Future<void> Function()? onContentChanged;

  const TeacherContentDetailPage({
    super.key,
    required this.content,
    this.onContentChanged,
  });

  @override
  State<TeacherContentDetailPage> createState() =>
      _TeacherContentDetailPageState();
}

class _TeacherContentDetailPageState extends State<TeacherContentDetailPage> {
  late ContentRecord _content;
  VideoPlayerController? _videoController;
  bool _saving = false;
  double _playbackSpeed = 1.0;
  VoidCallback? _videoListener;
  bool _videoLoading = false;
  String? _videoError;

  @override
  void initState() {
    super.initState();
    _content = widget.content;
    _initVideo();
  }

  @override
  void dispose() {
    if (_videoListener != null) {
      _videoController?.removeListener(_videoListener!);
    }
    _videoController?.dispose();
    super.dispose();
  }

  Uri? get _fileUri {
    final url = _content.fileUrl;
    if (url != null && url.trim().isNotEmpty) {
      return Uri.tryParse(ApiConfig.resolveAssetUrl(url));
    }

    final fileName = _content.fileName;
    if (fileName == null || fileName.trim().isEmpty) return null;
    final trimmed = fileName.trim();
    if (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/')) {
      return Uri.tryParse(ApiConfig.resolveAssetUrl(trimmed));
    }
    return Uri.tryParse(
      '${ApiConfig.baseUrl}/uploads/teacher-content/${Uri.encodeComponent(trimmed)}',
    );
  }

  Future<void> _initVideo() async {
    if (_videoListener != null) {
      _videoController?.removeListener(_videoListener!);
      _videoListener = null;
    }
    await _videoController?.dispose();
    _videoController = null;
    if (_content.fileType.toLowerCase() != 'video' || _fileUri == null) {
      if (mounted) {
        setState(() {
          _videoLoading = false;
          _videoError = _content.fileType.toLowerCase() == 'video'
              ? 'Video dosya bağlantısı bulunamadı.'
              : null;
        });
      }
      return;
    }
    if (mounted) {
      setState(() {
        _videoLoading = true;
        _videoError = null;
      });
    }
    try {
      final controller = VideoPlayerController.networkUrl(_fileUri!);
      await controller.initialize();
      controller.setLooping(false);
      await controller.setPlaybackSpeed(_playbackSpeed);
      _videoListener = () {
        if (mounted) {
          setState(() {});
        }
      };
      controller.addListener(_videoListener!);
      if (!mounted) {
        controller.removeListener(_videoListener!);
        await controller.dispose();
        return;
      }
      setState(() {
        _videoController = controller;
        _videoLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _videoLoading = false;
        _videoError =
            'Video oynatılamadı. Bağlantıyı kontrol edip tekrar deneyin.';
      });
    }
  }

  Future<void> _togglePlayback() async {
    final controller = _videoController;
    if (controller == null) return;
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _setPlaybackSpeed(double speed) async {
    final controller = _videoController;
    if (controller == null) return;
    await controller.setPlaybackSpeed(speed);
    if (mounted) {
      setState(() {
        _playbackSpeed = speed;
      });
    }
  }

  Future<void> _seekBy(Duration offset) async {
    final controller = _videoController;
    if (controller == null || !controller.value.isInitialized) return;
    final duration = controller.value.duration;
    final position = controller.value.position;
    var target = position + offset;
    if (target < Duration.zero) target = Duration.zero;
    if (target > duration) target = duration;
    await controller.seekTo(target);
  }

  Future<void> _openFullscreenVideo() async {
    final controller = _videoController;
    if (controller == null) return;
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> syncPlayback(Future<void> Function() action) async {
              await action();
              if (mounted) {
                setState(() {});
              }
              setDialogState(() {});
            }

            Future<void> updateSpeed(double speed) async {
              await _setPlaybackSpeed(speed);
              setDialogState(() {});
            }

            return Dialog.fullscreen(
              backgroundColor: Colors.black,
              child: SafeArea(
                child: Stack(
                  children: [
                    Center(
                      child: AspectRatio(
                        aspectRatio: controller.value.aspectRatio == 0
                            ? 16 / 9
                            : controller.value.aspectRatio,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => syncPlayback(_togglePlayback),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              VideoPlayer(controller),
                              if (!controller.value.isPlaying)
                                Center(
                                  child: Container(
                                    padding: const EdgeInsets.all(18),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(
                                        alpha: 0.42,
                                      ),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.play_arrow_rounded,
                                      color: Colors.white,
                                      size: 40,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 12,
                      left: 12,
                      right: 12,
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () => Navigator.of(dialogContext).pop(),
                            icon: const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                            ),
                          ),
                          const Spacer(),
                          _speedMenu(
                            color: Colors.white,
                            onSelected: (speed) => updateSpeed(speed),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accent = _accentForType(_content.fileType);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('İçerik Detayı'),
        actions: [
          IconButton(
            tooltip: 'Sil',
            onPressed: _saving ? null : _deleteContent,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    accent.withValues(alpha: 0.96),
                    accent.withValues(alpha: 0.72),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.18),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Icon(
                          _iconForType(_content.fileType),
                          color: Colors.white,
                          size: 28,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          _content.fileType,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(
                    _content.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${_content.subject} • ${_content.grade}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _heroChip(Icons.remove_red_eye_rounded, _content.views),
                      _heroChip(Icons.storage_rounded, _content.size),
                      _heroChip(Icons.schedule_rounded, _content.info),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            _sectionCard(
              context,
              title: 'Yayın Bilgileri',
              child: Column(
                children: [
                  _detailRow('Öğretmen', _content.teacher),
                  _detailRow('Ders', _content.subject),
                  _detailRow('Sınıf', _content.grade),
                  _detailRow('Dosya Türü', _content.fileType),
                  _detailRow('Yayın Durumu', _content.publishStatus),
                  _detailRow(
                    'Dosya',
                    _content.fileName ?? 'Sisteme yüklenen içerik',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (_content.fileType.toLowerCase() == 'video') ...[
              if (_videoController?.value.isInitialized == true) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: AspectRatio(
                    aspectRatio: _videoController!.value.aspectRatio,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _togglePlayback,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          VideoPlayer(_videoController!),
                          if (!_videoController!.value.isPlaying)
                            Center(
                              child: Container(
                                padding: const EdgeInsets.all(18),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.42),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.play_arrow_rounded,
                                  color: Colors.white,
                                  size: 40,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _togglePlayback,
                        icon: Icon(
                          _videoController!.value.isPlaying
                              ? Icons.pause_circle_filled_rounded
                              : Icons.play_circle_fill_rounded,
                        ),
                        label: Text(
                          _videoController!.value.isPlaying
                              ? 'Videoyu Duraklat'
                              : 'Videoyu Oynat',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    _speedMenu(onSelected: (speed) => _setPlaybackSpeed(speed)),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _openFullscreenVideo,
                      icon: const Icon(Icons.fullscreen_rounded),
                      label: const Text('Tam Ekran'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: VideoProgressIndicator(
                    _videoController!,
                    allowScrubbing: true,
                    padding: EdgeInsets.zero,
                    colors: VideoProgressColors(
                      playedColor: accent,
                      bufferedColor: accent.withValues(alpha: 0.24),
                      backgroundColor: accent.withValues(alpha: 0.12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Text(
                      _formatDuration(_videoController!.value.position),
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.78,
                        ),
                      ),
                    ),
                    const Spacer(),
                    OutlinedButton.icon(
                      onPressed: () => _seekBy(const Duration(seconds: -10)),
                      icon: const Icon(Icons.replay_10_rounded),
                      label: const Text('10 sn'),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: () => _seekBy(const Duration(seconds: 10)),
                      icon: const Icon(Icons.forward_10_rounded),
                      label: const Text('10 sn'),
                    ),
                    const Spacer(),
                    Text(
                      _formatDuration(_videoController!.value.duration),
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.78,
                        ),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    height: 220,
                    width: double.infinity,
                    color: Colors.black,
                    alignment: Alignment.center,
                    child: _videoPlaceholder(),
                  ),
                ),
              ],
              const SizedBox(height: 14),
            ],
            _sectionCard(
              context,
              title: 'İçerik Açıklaması',
              child: Text(
                _content.description,
                style: TextStyle(
                  height: 1.55,
                  color: theme.textTheme.bodyMedium?.color?.withValues(
                    alpha: 0.76,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            _sectionCard(
              context,
              title: 'Yayın Durumu',
              child: Row(
                children: [
                  Expanded(
                    child: _miniMetric(
                      label: 'Öğrenci Görünümü',
                      value: _content.publishStatus,
                      accent: _statusColor(_content.publishStatus),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _miniMetric(
                      label: 'Ilerleme',
                      value: '%${(_content.progress * 100).round()}',
                      accent: accent,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _openEditSheet,
                    icon: const Icon(Icons.edit_rounded),
                    label: const Text('Düzenle'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openPublishStatusSheet,
                    icon: const Icon(Icons.campaign_rounded),
                    label: const Text('Yayın Durumu'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _fileUri == null
                        ? null
                        : () => _openFile(download: false),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: const Text('Dosyayı Aç'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _fileUri == null
                        ? null
                        : () => _openFile(download: true),
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Indir'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF171B22) : Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: accent.withValues(alpha: 0.12)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: accent.withValues(alpha: 0.12),
                    child: Icon(Icons.school_rounded, color: accent),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Bu içerik öğrenci panelindeki İçerikler sayfasında anında görünür. Öğrenci kartına tıklandığında detaylar bu bilgiyle açılır.',
                      style: TextStyle(
                        color: theme.textTheme.bodyMedium?.color?.withValues(
                          alpha: 0.74,
                        ),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openFile({required bool download}) async {
    final uri = _fileUri;
    if (uri == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bu içerik için dosya bulunamadı.')),
      );
      return;
    }

    final launched = await launchUrl(
      uri,
      mode: download
          ? LaunchMode.externalApplication
          : LaunchMode.externalApplication,
    );

    if (!launched && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Dosya açılamadı.')));
    }
  }

  Future<void> _openEditSheet() async {
    if (_saving) return;
    final formKey = GlobalKey<FormState>();
    final titleController = TextEditingController(text: _content.title);
    final subjectController = TextEditingController(text: _content.subject);
    final gradeController = TextEditingController(text: _content.grade);
    final teacherController = TextEditingController(text: _content.teacher);
    final infoController = TextEditingController(text: _content.info);
    final descriptionController = TextEditingController(
      text: _content.description,
    );
    String selectedType = _content.fileType;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                8,
                16,
                MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              _accentForType(
                                selectedType,
                              ).withValues(alpha: 0.96),
                              _accentForType(
                                selectedType,
                              ).withValues(alpha: 0.72),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'İçeriği Düzenle',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Başlık, ders, sınıf, tür ve açıklama alanlarını bu ekrandan güncelleyebilirsin.',
                              style: TextStyle(
                                color: Colors.white70,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: titleController,
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
                              controller: subjectController,
                              validator: _requiredValidator,
                              decoration: const InputDecoration(
                                labelText: 'Ders',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: gradeController,
                              validator: _requiredValidator,
                              decoration: const InputDecoration(
                                labelText: 'Sınıf',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: teacherController,
                        validator: _requiredValidator,
                        decoration: const InputDecoration(
                          labelText: 'Öğretmen',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: selectedType,
                        decoration: const InputDecoration(
                          labelText: 'Dosya Türü',
                          border: OutlineInputBorder(),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'Video',
                            child: Text('Video'),
                          ),
                          DropdownMenuItem(value: 'PDF', child: Text('PDF')),
                          DropdownMenuItem(value: 'Word', child: Text('Word')),
                          DropdownMenuItem(
                            value: 'PowerPoint',
                            child: Text('PowerPoint'),
                          ),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          setSheetState(() {
                            selectedType = value;
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: infoController,
                        validator: _requiredValidator,
                        decoration: const InputDecoration(
                          labelText: 'Süre / Sayfa / Slayt',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: descriptionController,
                        validator: _requiredValidator,
                        minLines: 4,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'İçerik Açıklaması',
                          border: OutlineInputBorder(),
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _saving
                              ? null
                              : () {
                                  if (!formKey.currentState!.validate()) {
                                    return;
                                  }

                                  final updated = _content.copyWith(
                                    title: titleController.text.trim(),
                                    subject: subjectController.text.trim(),
                                    grade: gradeController.text.trim(),
                                    teacher: teacherController.text.trim(),
                                    fileType: selectedType,
                                    info: infoController.text.trim(),
                                    description: descriptionController.text
                                        .trim(),
                                  );

                                  _saveUpdatedContent(
                                    updated,
                                    context,
                                    'İçerik bilgileri güncellendi.',
                                  );
                                },
                          icon: const Icon(Icons.save_rounded),
                          label: Text(
                            _saving
                                ? 'Kaydediliyor...'
                                : 'Değişiklikleri Kaydet',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    titleController.dispose();
    subjectController.dispose();
    gradeController.dispose();
    teacherController.dispose();
    infoController.dispose();
    descriptionController.dispose();
  }

  Future<void> _openPublishStatusSheet() async {
    if (_saving) return;
    String selectedStatus = _content.publishStatus;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          _statusColor(selectedStatus).withValues(alpha: 0.96),
                          _statusColor(selectedStatus).withValues(alpha: 0.72),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Yayın Durumu',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _statusDescription(selectedStatus),
                          style: const TextStyle(
                            color: Colors.white70,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ...['Aktif', 'Pasif', 'Taslak'].map(
                    (status) => _statusOption(
                      status: status,
                      selected: selectedStatus == status,
                      color: _statusColor(status),
                      onTap: () {
                        setSheetState(() {
                          selectedStatus = status;
                        });
                      },
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving
                          ? null
                          : () {
                              final updated = _content.copyWith(
                                publishStatus: selectedStatus,
                              );
                              _saveStatusContent(updated, context);
                            },
                      icon: const Icon(Icons.check_circle_rounded),
                      label: Text(
                        _saving ? 'Kaydediliyor...' : 'Durumu Kaydet',
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _saveUpdatedContent(
    ContentRecord updated,
    BuildContext sheetContext,
    String message,
  ) async {
    if (_saving) return;
    FocusScope.of(sheetContext).unfocus();
    if (mounted) {
      setState(() {
        _saving = true;
      });
    }
    try {
      final saved = await ContentApiService.instance.updateContent(updated);
      if (!mounted) return;
      setState(() {
        _content = saved;
        _saving = false;
      });
      await _initVideo();
      await widget.onContentChanged?.call();
      if (!mounted || !sheetContext.mounted) return;
      if (Navigator.of(sheetContext).canPop()) {
        Navigator.of(sheetContext).pop();
      }
      _showInfo(context, message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _saveStatusContent(
    ContentRecord updated,
    BuildContext sheetContext,
  ) async {
    if (_saving) return;
    FocusScope.of(sheetContext).unfocus();
    if (mounted) {
      setState(() {
        _saving = true;
      });
    }
    try {
      if (updated.id == null) {
        throw const ContentApiException('İçerik kimliği bulunamadı.');
      }
      final saved = await ContentApiService.instance.updateStatus(
        id: updated.id!,
        publishStatus: updated.publishStatus,
      );
      if (!mounted) return;
      setState(() {
        _content = saved;
        _saving = false;
      });
      await _initVideo();
      await widget.onContentChanged?.call();
      if (!mounted || !sheetContext.mounted) return;
      if (Navigator.of(sheetContext).canPop()) {
        Navigator.of(sheetContext).pop();
      }
      _showInfo(context, 'Yayın durumu güncellendi.');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Widget _sectionCard(
    BuildContext context, {
    required String title,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
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

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 98,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _videoPlaceholder() {
    if (_videoLoading) {
      return const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Colors.white),
          SizedBox(height: 14),
          Text(
            'Video yükleniyor...',
            style: TextStyle(
              color: Colors.white70,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      );
    }

    if (_videoError != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.play_circle_outline_rounded,
              color: Colors.white,
              size: 58,
            ),
            const SizedBox(height: 12),
            Text(
              _videoError!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _initVideo,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Tekrar Dene'),
            ),
          ],
        ),
      );
    }

    return const Icon(
      Icons.play_circle_fill_rounded,
      size: 88,
      color: Colors.white,
    );
  }

  Widget _heroChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniMetric({
    required String label,
    required String value,
    required Color accent,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: accent, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _statusOption({
    required String status,
    required bool selected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: selected ? 0.16 : 0.08),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? color : color.withValues(alpha: 0.16),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: color.withValues(alpha: 0.16),
              child: Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: color,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    status,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _statusDescription(status),
                    style: const TextStyle(color: Colors.grey, height: 1.35),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _speedMenu({required ValueChanged<double> onSelected, Color? color}) {
    final foreground = color ?? _accentForType(_content.fileType);
    return PopupMenuButton<double>(
      tooltip: 'Hız',
      onSelected: onSelected,
      itemBuilder: (context) => const [
        PopupMenuItem(value: 0.75, child: Text('0.75x')),
        PopupMenuItem(value: 1.0, child: Text('1.0x')),
        PopupMenuItem(value: 1.25, child: Text('1.25x')),
        PopupMenuItem(value: 1.5, child: Text('1.5x')),
        PopupMenuItem(value: 2.0, child: Text('2.0x')),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: foreground.withValues(alpha: 0.22)),
          color: foreground.withValues(alpha: color == null ? 0.08 : 0.12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.speed_rounded, size: 18, color: foreground),
            const SizedBox(width: 6),
            Text(
              '${_playbackSpeed.toStringAsFixed(_playbackSpeed == _playbackSpeed.roundToDouble() ? 0 : 2)}x',
              style: TextStyle(color: foreground, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final totalSeconds = duration.inSeconds;
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  void _showInfo(BuildContext context, String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _deleteContent() async {
    final id = _content.id;
    if (id == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('İçeriği Sil'),
        content: Text('"${_content.title}" silinsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() {
      _saving = true;
    });

    try {
      await ContentApiService.instance.deleteContent(id);
      await widget.onContentChanged?.call();
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('İçerik silindi')));
    } on ContentApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  String? _requiredValidator(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Bu alan zorunludur';
    }
    return null;
  }

  String _statusDescription(String status) {
    switch (status) {
      case 'Pasif':
        return 'İçerik öğretmen panelinde kalır ancak öğrenci ekranında görünmez.';
      case 'Taslak':
        return 'İçerik henüz yayınlanmaya hazır değil, son kontroller bekleniyor.';
      default:
        return 'İçerik öğrenci ekranında aktif olarak listelenir ve açılabilir.';
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Pasif':
        return const Color(0xFFEF4444);
      case 'Taslak':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF16A34A);
    }
  }

  Color _accentForType(String type) {
    switch (type) {
      case 'PDF':
        return const Color(0xFFF59E0B);
      case 'Word':
        return const Color(0xFF4F46E5);
      case 'PowerPoint':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFF2563EB);
    }
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'PDF':
        return Icons.picture_as_pdf_rounded;
      case 'Word':
        return Icons.description_rounded;
      case 'PowerPoint':
        return Icons.slideshow_rounded;
      default:
        return Icons.play_circle_fill_rounded;
    }
  }
}
