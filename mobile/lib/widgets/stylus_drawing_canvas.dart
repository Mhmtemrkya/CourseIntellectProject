import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Apple Pencil ve stylus destekli cizim canvas'i.
/// iPad ve tablet cihazlarda basinc hassasiyeti ile cizim yapilabilir.
/// Telefonda parmakla da kullanilabilir.
class StylusDrawingCanvas extends StatefulWidget {
  final Color initialColor;
  final double initialStrokeWidth;

  const StylusDrawingCanvas({
    super.key,
    this.initialColor = Colors.black,
    this.initialStrokeWidth = 2.0,
  });

  /// Modal olarak canvas'i acar
  static Future<ui.Image?> open(BuildContext context) {
    return showModalBottomSheet<ui.Image>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: const StylusDrawingCanvas(),
          );
        },
      ),
    );
  }

  @override
  State<StylusDrawingCanvas> createState() => _StylusDrawingCanvasState();
}

class _StylusDrawingCanvasState extends State<StylusDrawingCanvas> {
  final List<_DrawingStroke> _strokes = [];
  _DrawingStroke? _currentStroke;
  late Color _selectedColor;
  late double _strokeWidth;
  bool _isEraser = false;

  static const _colors = [
    Colors.black,
    Color(0xFF00354F),
    Color(0xFFD9790B),
    Colors.red,
    Colors.blue,
    Colors.green,
    Colors.purple,
  ];

  @override
  void initState() {
    super.initState();
    _selectedColor = widget.initialColor;
    _strokeWidth = widget.initialStrokeWidth;
  }

  void _onPointerDown(PointerDownEvent event) {
    final point = _StrokePoint(
      position: event.localPosition,
      pressure: event.pressure,
    );
    setState(() {
      _currentStroke = _DrawingStroke(
        color: _isEraser ? Colors.white : _selectedColor,
        baseWidth: _isEraser ? 20.0 : _strokeWidth,
        points: [point],
      );
    });
  }

  void _onPointerMove(PointerMoveEvent event) {
    if (_currentStroke == null) return;
    final point = _StrokePoint(
      position: event.localPosition,
      pressure: event.pressure,
    );
    setState(() {
      _currentStroke!.points.add(point);
    });
  }

  void _onPointerUp(PointerUpEvent event) {
    if (_currentStroke == null) return;
    setState(() {
      _strokes.add(_currentStroke!);
      _currentStroke = null;
    });
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() => _strokes.removeLast());
  }

  void _clear() {
    setState(() => _strokes.clear());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      children: [
        // ---- Handle bar ----
        Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 4),
          child: Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),

        // ---- Toolbar ----
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              // Renk secici
              ..._colors.map((color) => Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() {
                        _selectedColor = color;
                        _isEraser = false;
                      }),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _selectedColor == color && !_isEraser
                                ? theme.colorScheme.primary
                                : Colors.grey.withValues(alpha: 0.3),
                            width: _selectedColor == color && !_isEraser ? 3 : 1,
                          ),
                        ),
                      ),
                    ),
                  )),
              const SizedBox(width: 8),
              // Silgi
              _ToolButton(
                icon: Icons.auto_fix_high_rounded,
                isActive: _isEraser,
                onTap: () => setState(() => _isEraser = !_isEraser),
              ),
              const SizedBox(width: 4),
              // Geri al
              _ToolButton(
                icon: Icons.undo_rounded,
                onTap: _undo,
              ),
              const SizedBox(width: 4),
              // Temizle
              _ToolButton(
                icon: Icons.delete_outline_rounded,
                onTap: _clear,
              ),
              const Spacer(),
              // Kalinlik slider
              SizedBox(
                width: 100,
                child: Slider(
                  value: _strokeWidth,
                  min: 1,
                  max: 12,
                  onChanged: (v) => setState(() => _strokeWidth = v),
                  activeColor: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
        ),

        // ---- Canvas ----
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Colors.grey.withValues(alpha: 0.2),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Listener(
                onPointerDown: _onPointerDown,
                onPointerMove: _onPointerMove,
                onPointerUp: _onPointerUp,
                child: CustomPaint(
                  painter: _DrawingPainter(
                    strokes: _strokes,
                    currentStroke: _currentStroke,
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Tool Button ────────────────────────────────────────────────────────────

class _ToolButton extends StatelessWidget {
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;

  const _ToolButton({
    required this.icon,
    this.isActive = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isActive
              ? theme.colorScheme.primary.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 20,
          color: isActive ? theme.colorScheme.primary : theme.iconTheme.color,
        ),
      ),
    );
  }
}

// ─── Data Models ────────────────────────────────────────────────────────────

class _StrokePoint {
  final Offset position;
  final double pressure;

  const _StrokePoint({required this.position, required this.pressure});
}

class _DrawingStroke {
  final Color color;
  final double baseWidth;
  final List<_StrokePoint> points;

  _DrawingStroke({
    required this.color,
    required this.baseWidth,
    required this.points,
  });
}

// ─── Custom Painter ─────────────────────────────────────────────────────────

class _DrawingPainter extends CustomPainter {
  final List<_DrawingStroke> strokes;
  final _DrawingStroke? currentStroke;

  _DrawingPainter({required this.strokes, this.currentStroke});

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      _drawStroke(canvas, stroke);
    }
    if (currentStroke != null) {
      _drawStroke(canvas, currentStroke!);
    }
  }

  void _drawStroke(Canvas canvas, _DrawingStroke stroke) {
    if (stroke.points.isEmpty) return;

    final paint = Paint()
      ..color = stroke.color
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    if (stroke.points.length == 1) {
      final p = stroke.points.first;
      final w = stroke.baseWidth * _pressureToWidth(p.pressure);
      paint.strokeWidth = w;
      canvas.drawPoints(ui.PointMode.points, [p.position], paint);
      return;
    }

    for (int i = 0; i < stroke.points.length - 1; i++) {
      final p0 = stroke.points[i];
      final p1 = stroke.points[i + 1];
      // Basinc hassasiyeti: Apple Pencil basinci 0-1 arasi
      final avgPressure = (p0.pressure + p1.pressure) / 2;
      paint.strokeWidth = stroke.baseWidth * _pressureToWidth(avgPressure);
      canvas.drawLine(p0.position, p1.position, paint);
    }
  }

  double _pressureToWidth(double pressure) {
    // Basinc 0'da ince, 1'de kalin. Minimum 0.4x, maksimum 2.5x
    if (pressure <= 0) return 1.0;
    return 0.4 + (pressure * 2.1);
  }

  @override
  bool shouldRepaint(covariant _DrawingPainter oldDelegate) => true;
}
