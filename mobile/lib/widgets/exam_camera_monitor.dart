import 'dart:async';
import 'dart:convert';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/exam_camera_realtime_service.dart';

/// Sınav boyunca köşede duran küçük kamera önizlemesi. Kamerayı açar ve
/// ~4 sn'de bir küçük kare yakalayıp öğretmenin canlı izleme ekranına yayınlar.
class ExamCameraMonitor extends StatefulWidget {
  final String examId;
  final bool active;

  const ExamCameraMonitor({
    super.key,
    required this.examId,
    this.active = true,
  });

  @override
  State<ExamCameraMonitor> createState() => _ExamCameraMonitorState();
}

class _ExamCameraMonitorState extends State<ExamCameraMonitor> {
  CameraController? _controller;
  Timer? _timer;
  String? _error;
  bool _initializing = true;
  bool _streaming = false;
  bool _capturing = false;
  String _username = '';
  String _name = 'Öğrenci';

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final session = await AuthSessionStore.instance.load();
      _username = session?.username ?? '';
      _name = session?.fullName ?? 'Öğrenci';

      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw Exception('Kamera bulunamadı');
      }
      final selected = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        selected,
        ResolutionPreset.low,
        enableAudio: false,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _initializing = false;
        _error = null;
      });
      _timer = Timer.periodic(
        const Duration(seconds: 4),
        (_) => _captureAndPublish(),
      );
      // İlk kareyi kamera ısınınca gönder.
      Future.delayed(const Duration(milliseconds: 1200), _captureAndPublish);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Kameraya erişilemedi';
        _initializing = false;
      });
    }
  }

  Future<void> _captureAndPublish() async {
    final controller = _controller;
    if (controller == null ||
        !controller.value.isInitialized ||
        _capturing ||
        widget.examId.isEmpty ||
        !mounted) {
      return;
    }
    _capturing = true;
    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      final frame = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      await ExamCameraRealtimeService.instance.publishFrame(
        widget.examId,
        _username,
        _name,
        frame,
      );
      if (mounted && !_streaming) {
        setState(() => _streaming = true);
      }
    } catch (_) {
      // Bu kareyi atla; bir sonraki periyotta tekrar denenir.
    } finally {
      _capturing = false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return const SizedBox.shrink();

    return Container(
      width: 120,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            child: Row(
              children: [
                Icon(
                  _error == null
                      ? Icons.videocam_rounded
                      : Icons.videocam_off_rounded,
                  size: 13,
                  color: _error == null
                      ? const Color(0xFFFFB27A)
                      : Colors.redAccent,
                ),
                const SizedBox(width: 4),
                Text(
                  _error == null ? 'Kamera' : 'Kapalı',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                if (_streaming && _error == null)
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xFF22C55E),
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 90,
            width: double.infinity,
            child: _buildPreview(),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    if (_initializing) {
      return const Center(
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    final controller = _controller;
    if (_error != null || controller == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Text(
            _error ?? 'Kamera açılamadı',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.redAccent, fontSize: 9),
          ),
        ),
      );
    }
    final previewSize = controller.value.previewSize;
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: previewSize?.height ?? 120,
        height: previewSize?.width ?? 90,
        child: CameraPreview(controller),
      ),
    );
  }
}
