import 'dart:async';
import 'package:student/i18n/app_locale.dart';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../services/exam_camera_realtime_service.dart';

/// Öğretmenin planlı sınav için canlı kamera izleme ızgarası. Öğrencilerin sınav
/// ekranından gönderdiği periyodik kareleri (snapshot) gerçek zamanlı gösterir.
class TeacherExamLiveCameraPage extends StatefulWidget {
  final String examId;
  final String examTitle;

  const TeacherExamLiveCameraPage({
    super.key,
    required this.examId,
    required this.examTitle,
  });

  @override
  State<TeacherExamLiveCameraPage> createState() =>
      _TeacherExamLiveCameraPageState();
}

class _LiveFeed {
  final String name;
  final Uint8List bytes;
  final DateTime at;
  _LiveFeed({required this.name, required this.bytes, required this.at});
}

class _TeacherExamLiveCameraPageState extends State<TeacherExamLiveCameraPage> {
  static const _staleAfter = Duration(seconds: 15);

  final Map<String, _LiveFeed> _feeds = {};
  StreamSubscription<ExamCameraFrame>? _subscription;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    ExamCameraRealtimeService.instance.joinMonitor(widget.examId);
    _subscription = ExamCameraRealtimeService.instance.frameStream.listen(
      _onFrame,
    );
    _ticker = Timer.periodic(
      const Duration(seconds: 3),
      (_) {
        if (mounted) setState(() {});
      },
    );
  }

  void _onFrame(ExamCameraFrame frame) {
    if (!mounted || frame.examId != widget.examId) return;
    final bytes = _decode(frame.frame);
    if (bytes == null) return;
    final key = frame.studentUsername.isNotEmpty
        ? frame.studentUsername
        : frame.studentName;
    setState(() {
      _feeds[key] = _LiveFeed(
        name: frame.studentName.isNotEmpty
            ? frame.studentName
            : frame.studentUsername,
        bytes: bytes,
        at: frame.at,
      );
    });
  }

  Uint8List? _decode(String dataUrl) {
    try {
      final comma = dataUrl.indexOf(',');
      final b64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
      return base64Decode(b64);
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _subscription?.cancel();
    ExamCameraRealtimeService.instance.leaveMonitor(widget.examId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final now = DateTime.now();
    final entries = _feeds.entries.toList()
      ..sort((a, b) => a.value.name.toLowerCase().compareTo(
            b.value.name.toLowerCase(),
          ));
    final liveCount = entries
        .where((e) => now.difference(e.value.at) < _staleAfter)
        .length;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Canlı Kamera — ${widget.examTitle}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Wrap(
              spacing: 10,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _chip(
                  '$liveCount canlı',
                  const Color(0xFF16A34A),
                  filled: true,
                ),
                _chip('${entries.length} öğrenci bağlandı', theme.hintColor),
                Text(
                  "Görüntüler ~4 sn'de bir yenilenir.".tr,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Expanded(
            child: entries.isEmpty
                ? _emptyState(theme)
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 260,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.82,
                    ),
                    itemCount: entries.length,
                    itemBuilder: (context, index) {
                      final feed = entries[index].value;
                      final stale = now.difference(feed.at) >= _staleAfter;
                      return _feedCard(theme, feed, stale);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, Color color, {bool filled = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: filled ? 0.15 : 0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (filled) ...[
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _feedCard(ThemeData theme, _LiveFeed feed, bool stale) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.black,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.memory(
                    feed.bytes,
                    fit: BoxFit.cover,
                    gaplessPlayback: true,
                    color: stale ? Colors.black54 : null,
                    colorBlendMode: stale ? BlendMode.darken : null,
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: stale
                            ? Colors.black.withValues(alpha: 0.6)
                            : const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        stale ? 'Bekleniyor' : 'Canlı',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Text(
                feed.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.videocam_off_rounded, size: 44, color: theme.hintColor),
          const SizedBox(height: 12),
          Text('Henüz kamera yayını yok.'.tr, style: theme.textTheme.titleSmall),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Öğrenciler kameralı sınava girince görüntüleri burada canlı belirir.'.tr,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
