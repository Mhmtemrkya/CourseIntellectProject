import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

/// Sınav giriş kapısında öğrencinin kamerasını gerçek olarak açıp gösterir.
/// Kamera başarıyla açıldığında [onReady] çağrılır.
class ExamCameraPreview extends StatefulWidget {
  final VoidCallback? onReady;

  const ExamCameraPreview({super.key, this.onReady});

  @override
  State<ExamCameraPreview> createState() => _ExamCameraPreviewState();
}

class _ExamCameraPreviewState extends State<ExamCameraPreview> {
  CameraController? _controller;
  String? _error;
  bool _initializing = true;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    setState(() {
      _initializing = true;
      _error = null;
    });
    try {
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
        ResolutionPreset.medium,
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
      });
      widget.onReady?.call();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Kameraya erişilemedi. Lütfen izin verip tekrar dene.';
        _initializing = false;
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_initializing) {
      return Container(
        height: 180,
        decoration: BoxDecoration(
          color: Colors.black12,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    final controller = _controller;
    if (_error != null || controller == null) {
      return Container(
        height: 180,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.red.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.withValues(alpha: 0.25)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.videocam_off_rounded, color: Colors.red),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Kamera açılamadı',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Colors.red),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _initCamera,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Tekrar Dene'),
            ),
          ],
        ),
      );
    }

    final previewSize = controller.value.previewSize;
    return SizedBox(
      height: 180,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: previewSize?.height ?? 180,
            height: previewSize?.width ?? 180,
            child: CameraPreview(controller),
          ),
        ),
      ),
    );
  }
}
