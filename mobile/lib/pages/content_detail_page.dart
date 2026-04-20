import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../services/api_config.dart';
import '../services/content_store.dart';
import '../widgets/responsive_layout.dart';

class ContentDetailPage extends StatefulWidget {
  final String title;
  final String subject;
  final String teacher;
  final String info;
  final bool isVideo;
  final String fileType;
  final String description;
  final String? fileName;
  final String? fileUrl;
  final String? size;
  final String? grade;
  final List<ContentRecord> playlist;

  const ContentDetailPage({
    super.key,
    required this.title,
    required this.subject,
    required this.teacher,
    required this.info,
    required this.isVideo,
    required this.fileType,
    required this.description,
    this.fileName,
    this.fileUrl,
    this.size,
    this.grade,
    this.playlist = const [],
  });

  @override
  State<ContentDetailPage> createState() => _ContentDetailPageState();
}

class _ContentDetailPageState extends State<ContentDetailPage>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> fadeAnim;
  late Animation<Offset> slideAnim;
  VideoPlayerController? _videoController;
  ContentRecord? _currentVideoRecord;
  double _playbackSpeed = 1.0;
  VoidCallback? _videoListener;
  bool _videoLoading = false;
  String? _videoError;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    fadeAnim = Tween<double>(begin: 0, end: 1).animate(_controller);

    slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(_controller);

    _currentVideoRecord = _resolveCurrentRecord();
    _controller.forward();
    _initVideo();
  }

  @override
  void dispose() {
    if (_videoListener != null) {
      _videoController?.removeListener(_videoListener!);
    }
    _videoController?.dispose();
    _controller.dispose();
    super.dispose();
  }

  bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  ContentRecord? _resolveCurrentRecord() {
    final currentFileName = widget.fileName?.trim();
    for (final item in widget.playlist) {
      if (currentFileName != null &&
          currentFileName.isNotEmpty &&
          item.fileName == currentFileName) {
        return item;
      }
      if (item.title == widget.title && item.subject == widget.subject) {
        return item;
      }
    }
    return null;
  }

  Uri? get _fileUri {
    final url = _currentVideoRecord?.fileUrl ?? widget.fileUrl;
    if (url != null && url.trim().isNotEmpty) {
      return Uri.tryParse(ApiConfig.resolveAssetUrl(url));
    }

    final fileName = _currentVideoRecord?.fileName ?? widget.fileName;
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
    if (!widget.isVideo || _fileUri == null) {
      if (mounted) {
        setState(() {
          _videoLoading = false;
          _videoError = widget.isVideo
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
      await controller.play();
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

  Future<void> _playPlaylistItem(ContentRecord item) async {
    setState(() {
      _currentVideoRecord = item;
    });
    await _initVideo();
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

  @override
  Widget build(BuildContext context) {
    final accent = _accentColor();
    final currentTitle = _currentVideoRecord?.title ?? widget.title;
    final currentSubject = _currentVideoRecord?.subject ?? widget.subject;
    final currentTeacher = _currentVideoRecord?.teacher ?? widget.teacher;
    final currentInfo = _currentVideoRecord?.info ?? widget.info;
    final currentDescription =
        _currentVideoRecord?.description ?? widget.description;
    final currentFileType = _currentVideoRecord?.fileType ?? widget.fileType;
    final currentGrade = _currentVideoRecord?.grade ?? widget.grade;
    final currentFileName =
        _currentVideoRecord?.fileName ?? widget.fileName ?? widget.fileType;
    final currentSize = _currentVideoRecord?.size ?? widget.size;
    final hasInlineVideo =
        widget.isVideo && _videoController?.value.isInitialized == true;
    final currentPlaylistIndex = widget.playlist.indexWhere(
      (item) =>
          item.fileName == (_currentVideoRecord?.fileName ?? widget.fileName),
    );
    final nextPlaylistItem =
        widget.playlist.length > 1 &&
            currentPlaylistIndex >= 0 &&
            currentPlaylistIndex < widget.playlist.length - 1
        ? widget.playlist[currentPlaylistIndex + 1]
        : (widget.playlist.length > 1
              ? widget.playlist.firstWhere(
                  (item) =>
                      item.fileName !=
                      (_currentVideoRecord?.fileName ?? widget.fileName),
                  orElse: () => widget.playlist.first,
                )
              : null);

    return Scaffold(
      appBar: AppBar(title: Text(currentTitle)),
      body: FadeTransition(
        opacity: fadeAnim,
        child: SlideTransition(
          position: slideAnim,
          child: SingleChildScrollView(
            child: ResponsiveContent(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    color: Colors.black,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Stack(
                          children: [
                            if (hasInlineVideo)
                              AspectRatio(
                                aspectRatio:
                                    _videoController!.value.aspectRatio,
                                child: GestureDetector(
                                  behavior: HitTestBehavior.opaque,
                                  onTap: _togglePlayback,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      VideoPlayer(_videoController!),
                                      Positioned(
                                        top: 14,
                                        left: 14,
                                        right: 14,
                                        child: Row(
                                          children: [
                                            _heroPill(currentFileType),
                                            if (currentGrade != null) ...[
                                              const SizedBox(width: 8),
                                              _heroPill(currentGrade),
                                            ],
                                            const Spacer(),
                                            IconButton(
                                              style: IconButton.styleFrom(
                                                backgroundColor: Colors.black
                                                    .withValues(alpha: 0.42),
                                                foregroundColor: Colors.white,
                                              ),
                                              onPressed: () =>
                                                  _openFile(download: true),
                                              icon: const Icon(
                                                Icons.download_rounded,
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            _speedMenu(
                                              color: Colors.white,
                                              onSelected: (speed) =>
                                                  _setPlaybackSpeed(speed),
                                            ),
                                            const SizedBox(width: 6),
                                            IconButton(
                                              style: IconButton.styleFrom(
                                                backgroundColor: Colors.black
                                                    .withValues(alpha: 0.42),
                                                foregroundColor: Colors.white,
                                              ),
                                              onPressed: _openFullscreenVideo,
                                              icon: const Icon(
                                                Icons.fullscreen_rounded,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Positioned(
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                Colors.transparent,
                                                Colors.black.withValues(
                                                  alpha: 0.88,
                                                ),
                                              ],
                                              begin: Alignment.topCenter,
                                              end: Alignment.bottomCenter,
                                            ),
                                          ),
                                          child: Padding(
                                            padding: const EdgeInsets.fromLTRB(
                                              12,
                                              28,
                                              12,
                                              10,
                                            ),
                                            child: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                        999,
                                                      ),
                                                  child: VideoProgressIndicator(
                                                    _videoController!,
                                                    allowScrubbing: true,
                                                    padding: EdgeInsets.zero,
                                                    colors: VideoProgressColors(
                                                      playedColor: accent,
                                                      bufferedColor: Colors
                                                          .white
                                                          .withValues(
                                                            alpha: 0.35,
                                                          ),
                                                      backgroundColor: Colors
                                                          .white
                                                          .withValues(
                                                            alpha: 0.18,
                                                          ),
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(height: 10),
                                                Row(
                                                  children: [
                                                    IconButton(
                                                      onPressed:
                                                          _togglePlayback,
                                                      color: Colors.white,
                                                      icon: Icon(
                                                        _videoController!
                                                                .value
                                                                .isPlaying
                                                            ? Icons
                                                                  .pause_rounded
                                                            : Icons
                                                                  .play_arrow_rounded,
                                                      ),
                                                    ),
                                                    IconButton(
                                                      onPressed: () => _seekBy(
                                                        const Duration(
                                                          seconds: -10,
                                                        ),
                                                      ),
                                                      color: Colors.white,
                                                      icon: const Icon(
                                                        Icons.replay_10_rounded,
                                                      ),
                                                    ),
                                                    IconButton(
                                                      onPressed: () => _seekBy(
                                                        const Duration(
                                                          seconds: 10,
                                                        ),
                                                      ),
                                                      color: Colors.white,
                                                      icon: const Icon(
                                                        Icons
                                                            .forward_10_rounded,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Expanded(
                                                      child: Text(
                                                        '${_formatDuration(_videoController!.value.position)} / ${_formatDuration(_videoController!.value.duration)}',
                                                        style: const TextStyle(
                                                          color: Colors.white,
                                                          fontWeight:
                                                              FontWeight.w700,
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      if (!_videoController!.value.isPlaying)
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
                              )
                            else
                              Container(
                                height: 240,
                                width: double.infinity,
                                color: Colors.black,
                                child: Center(
                                  child: widget.isVideo
                                      ? _videoPlaceholder()
                                      : Icon(
                                          _iconForType(),
                                          size: 88,
                                          color: Colors.white.withValues(
                                            alpha: 0.94,
                                          ),
                                        ),
                                ),
                              ),
                          ],
                        ),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.black,
                                accent.withValues(alpha: 0.18),
                              ],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                currentTitle,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  height: 1.08,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '$currentSubject • $currentTeacher',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 20,
                              backgroundColor: accent.withValues(alpha: 0.12),
                              child: Icon(
                                Icons.ondemand_video_rounded,
                                color: accent,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    currentTeacher,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '$currentSubject • ${currentGrade ?? 'Tüm sınıflar'}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.color
                                          ?.withValues(alpha: 0.72),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  currentInfo,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  currentSize ?? currentFileType,
                                  style: TextStyle(
                                    color: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.color
                                        ?.withValues(alpha: 0.68),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _youtubeMetaPill(
                                Icons.folder_rounded,
                                currentFileName,
                              ),
                              const SizedBox(width: 8),
                              if (currentSize != null) ...[
                                _youtubeMetaPill(
                                  Icons.storage_rounded,
                                  currentSize,
                                ),
                                const SizedBox(width: 8),
                              ],
                              _youtubeMetaPill(
                                Icons.video_library_rounded,
                                currentFileType,
                              ),
                              const SizedBox(width: 8),
                              _youtubeMetaPill(
                                Icons.queue_play_next_rounded,
                                '${widget.playlist.isEmpty ? 1 : widget.playlist.length} video',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          "İçerik Açıklaması",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          currentDescription,
                          style: TextStyle(
                            color: Theme.of(context).textTheme.bodyMedium?.color
                                ?.withValues(alpha: 0.72),
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (widget.isVideo && widget.playlist.length > 1) ...[
                          Row(
                            children: [
                              const Text(
                                "Oynatma Listesi",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Spacer(),
                              if (nextPlaylistItem != null)
                                TextButton.icon(
                                  onPressed: () =>
                                      _playPlaylistItem(nextPlaylistItem),
                                  icon: const Icon(Icons.skip_next_rounded),
                                  label: const Text('Sıradaki'),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ...widget.playlist.map((item) {
                            final selected =
                                (_currentVideoRecord?.fileName ??
                                    widget.fileName) ==
                                item.fileName;
                            return Container(
                              margin: const EdgeInsets.only(bottom: 2),
                              decoration: BoxDecoration(
                                color: selected
                                    ? accent.withValues(alpha: 0.08)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                leading: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Container(
                                    width: 72,
                                    height: 44,
                                    color: accent.withValues(
                                      alpha: selected ? 0.24 : 0.14,
                                    ),
                                    child: Icon(
                                      selected
                                          ? Icons.equalizer_rounded
                                          : Icons.play_arrow_rounded,
                                      color: accent,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  item.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  'Bolum ${item.playlistOrder ?? 1} • ${item.subject}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: selected
                                    ? Icon(
                                        Icons.more_vert_rounded,
                                        color: accent,
                                      )
                                    : null,
                                onTap: () => _playPlaylistItem(item),
                              ),
                            );
                          }),
                          const SizedBox(height: 10),
                        ],
                        if (!widget.isVideo) ...[
                          const SizedBox(height: 8),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _youtubeAction(
                                  icon: Icons.open_in_new_rounded,
                                  label: 'Ac',
                                  onTap: _fileUri == null
                                      ? null
                                      : () => _openFile(download: false),
                                ),
                                const SizedBox(width: 10),
                                _youtubeAction(
                                  icon: Icons.download_rounded,
                                  label: 'Indir',
                                  onTap: _fileUri == null
                                      ? null
                                      : () => _openFile(download: true),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _youtubeMetaPill(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark(context)
            ? const Color(0xFF171B22)
            : const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: Theme.of(context).textTheme.bodySmall?.color,
          ),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 160),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _youtubeAction({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    Widget? child,
  }) {
    if (child != null) {
      return child;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isDark(context)
              ? const Color(0xFF171B22)
              : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
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

  Widget _heroPill(String label) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 150),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.48),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _speedMenu({required ValueChanged<double> onSelected, Color? color}) {
    final foreground = color ?? _accentColor();
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

  IconData _iconForType() {
    switch (widget.fileType) {
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

  Color _accentColor() {
    switch (_currentVideoRecord?.fileType ?? widget.fileType) {
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
}
