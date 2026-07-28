import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Dokunmatik imza alanı.
///
/// Neden bu şekilde:
///  • Çizim, ekranın piksel oranıyla (devicePixelRatio) ölçeklenerek dışa
///    aktarılır — yoksa retina tablette imza bulanık çıkar. Oran 3 ile sınırlı.
///  • Dışa aktarırken BEYAZ ZEMİN basılır: şeffaf PNG bazı PDF görüntüleyicilerde
///    siyah kutu olarak görünür.
///  • Tek dokunuş da nokta bırakır (çok kısa imzalar kaybolmasın).
class ConsentSignaturePad extends StatefulWidget {
  final double height;
  final ValueChanged<bool>? onChanged;
  final String hint;

  const ConsentSignaturePad({
    super.key,
    this.height = 220,
    this.onChanged,
    this.hint = 'Parmağınızla buraya imzalayın',
  });

  @override
  State<ConsentSignaturePad> createState() => ConsentSignaturePadState();
}

class ConsentSignaturePadState extends State<ConsentSignaturePad> {
  /// Her eleman bir kesintisiz çizgi; tek dokunuşta tek noktalı çizgi oluşur.
  final List<List<Offset>> _strokes = [];
  final GlobalKey _canvasKey = GlobalKey();

  bool get isEmpty => _strokes.isEmpty;

  void clear() {
    if (_strokes.isEmpty) return;
    setState(_strokes.clear);
    widget.onChanged?.call(false);
  }

  void _start(Offset point) {
    final wasEmpty = _strokes.isEmpty;
    setState(() => _strokes.add([point]));
    if (wasEmpty) widget.onChanged?.call(true);
  }

  void _extend(Offset point) => setState(() => _strokes.last.add(point));

  /// Beyaz zeminli PNG'nin base64 data URL'i. İmza yoksa null döner ki
  /// çağıran taraf "boş imza" göndermesin.
  Future<String?> toDataUrl() async {
    if (_strokes.isEmpty) return null;

    final box = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return null;

    final ratio = MediaQuery.of(context).devicePixelRatio.clamp(1.0, 3.0);
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(ratio);

    // Beyaz zemin — şeffaf PNG bazı görüntüleyicilerde siyah çıkar.
    canvas.drawRect(
      Rect.fromLTWH(0, 0, box.size.width, box.size.height),
      Paint()..color = Colors.white,
    );
    _paintStrokes(canvas, _strokes);

    final image = await recorder.endRecording().toImage(
      (box.size.width * ratio).round(),
      (box.size.height * ratio).round(),
    );
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) return null;

    final bytes = data.buffer.asUint8List();
    return 'data:image/png;base64,${base64Encode(bytes)}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: widget.height,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: theme.dividerColor,
                width: 2,
                strokeAlign: BorderSide.strokeAlignInside,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: GestureDetector(
                onPanStart: (details) => _start(details.localPosition),
                onPanUpdate: (details) => _extend(details.localPosition),
                // Tek dokunuş da imza sayılır.
                onTapDown: (details) => _start(details.localPosition),
                child: CustomPaint(
                  key: _canvasKey,
                  painter: _SignaturePainter(_strokes),
                  child: _strokes.isEmpty
                      ? Center(
                          child: Text(
                            widget.hint,
                            style: TextStyle(
                              color: Colors.grey.shade400,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        )
                      : const SizedBox.expand(),
                ),
              ),
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _strokes.isEmpty ? null : clear,
            child: const Text('Temizle'),
          ),
        ),
      ],
    );
  }
}

/// Ekrandaki çizim ile PNG çıktısı AYNI fonksiyondan basılır; iki ayrı kopya
/// tutulursa biri değişince imza ekranda başka, belgede başka görünür.
void _paintStrokes(Canvas canvas, List<List<Offset>> strokes) {
  final paint = Paint()
    ..color = const Color(0xFF101828)
    ..strokeWidth = 2.6
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;

  for (final stroke in strokes) {
    if (stroke.length == 1) {
      // Tek dokunuş = nokta.
      canvas.drawCircle(
        stroke.first,
        paint.strokeWidth / 2,
        Paint()..color = paint.color,
      );
      continue;
    }
    final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
    for (final point in stroke.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(path, paint);
  }
}

class _SignaturePainter extends CustomPainter {
  final List<List<Offset>> strokes;

  const _SignaturePainter(this.strokes);

  @override
  void paint(Canvas canvas, Size size) => _paintStrokes(canvas, strokes);

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) => true;
}
