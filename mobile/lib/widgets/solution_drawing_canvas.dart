import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

typedef StrokeSaved = FutureOr<void> Function(Map<String, dynamic> stroke);
typedef SnapshotSaved = FutureOr<void> Function(String dataUrl);

class SolutionDrawingCanvas extends StatefulWidget {
  final StrokeSaved? onStrokeSaved;
  final SnapshotSaved? onSnapshotSaved;
  final String? initialSnapshotUrl;

  const SolutionDrawingCanvas({
    super.key,
    this.onStrokeSaved,
    this.onSnapshotSaved,
    this.initialSnapshotUrl,
  });

  @override
  State<SolutionDrawingCanvas> createState() => _SolutionDrawingCanvasState();
}

/// Açık ve koyu temayla uyumlu çizim tuvali paleti.
class _CanvasPalette {
  final Color shell;
  final Color paper;
  final Color paperDeep;
  final Color border;
  final Color grid;
  final Color ink;
  final Color ringSelected;
  final Color ringUnselected;

  static const orange = Color(0xFFFF9D2E);

  const _CanvasPalette._({
    required this.shell,
    required this.paper,
    required this.paperDeep,
    required this.border,
    required this.grid,
    required this.ink,
    required this.ringSelected,
    required this.ringUnselected,
  });

  static const _dark = _CanvasPalette._(
    shell: Color(0xFF182A45),
    paper: Color(0xFF1A2D49),
    paperDeep: Color(0xFF223B5D),
    border: Color(0xFF3A5278),
    grid: Color(0x14FFFFFF),
    ink: Color(0xFFF8FAFC),
    ringSelected: Colors.white,
    ringUnselected: Colors.white24,
  );

  static const _light = _CanvasPalette._(
    shell: Colors.white,
    paper: Color(0xFFF8FAFC),
    paperDeep: Color(0xFFEDF2F9),
    border: Color(0xFFE2E8F0),
    grid: Color(0x140F172A),
    ink: Color(0xFF0F172A),
    ringSelected: Color(0xFF0F172A),
    ringUnselected: Color(0x3D0F172A),
  );

  static _CanvasPalette of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? _dark : _light;
}

class _SolutionDrawingCanvasState extends State<SolutionDrawingCanvas> {
  final GlobalKey _canvasKey = GlobalKey();
  final List<_CanvasStroke> _strokes = [];
  final List<_CanvasStroke> _redoStack = [];
  _CanvasStroke? _activeStroke;
  Color _color = const Color(0xFFFF8A1C);
  double _width = 4;
  String _tool = 'pen';
  bool _grid = true;
  bool _showInitialSnapshot = true;

  void _start(PointerDownEvent event) {
    setState(() {
      _redoStack.clear();
      _activeStroke = _CanvasStroke(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        tool: _tool,
        color: _tool == 'eraser' ? Colors.transparent : _color,
        width: _tool == 'highlighter' ? _width * 3 : _width,
        opacity: _tool == 'highlighter' ? 0.32 : 1,
        points: [
          _StrokePoint(
            offset: event.localPosition,
            pressure: event.pressure,
            kind: event.kind.name,
          ),
        ],
      );
    });
  }

  void _move(PointerMoveEvent event) {
    if (_activeStroke == null) return;
    setState(() {
      _activeStroke!.points.add(
        _StrokePoint(
          offset: event.localPosition,
          pressure: event.pressure,
          kind: event.kind.name,
        ),
      );
    });
  }

  Future<void> _end(PointerUpEvent event) async {
    final stroke = _activeStroke;
    if (stroke == null) return;
    setState(() {
      _strokes.add(stroke);
      _activeStroke = null;
    });
    if (stroke.points.length > 1) {
      await widget.onStrokeSaved?.call(stroke.toJson());
      await _emitSnapshot();
    }
  }

  Future<void> _emitSnapshot() async {
    if (widget.onSnapshotSaved == null) return;
    await Future<void>.delayed(const Duration(milliseconds: 60));
    final boundary =
        _canvasKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return;
    final image = await boundary.toImage(pixelRatio: 2);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final bytes = byteData?.buffer.asUint8List();
    if (bytes == null) return;
    await widget.onSnapshotSaved!(
      'data:image/png;base64,${base64Encode(bytes)}',
    );
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() => _redoStack.add(_strokes.removeLast()));
    _emitSnapshot();
  }

  void _redo() {
    if (_redoStack.isEmpty) return;
    setState(() => _strokes.add(_redoStack.removeLast()));
    _emitSnapshot();
  }

  void _clear() {
    setState(() {
      _redoStack.addAll(_strokes);
      _strokes.clear();
      _showInitialSnapshot = false;
    });
    _emitSnapshot();
  }

  @override
  Widget build(BuildContext context) {
    final palette = _CanvasPalette.of(context);
    final colors = [
      const Color(0xFFFF8A1C),
      const Color(0xFF60A5FA),
      const Color(0xFF34D399),
      const Color(0xFFA78BFA),
      palette.ink,
      const Color(0xFFEF4444),
    ];

    return Container(
      decoration: BoxDecoration(
        color: palette.shell,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _ToolChip(
                    icon: Icons.edit_rounded,
                    label: 'Kalem',
                    active: _tool == 'pen',
                    onTap: () => setState(() => _tool = 'pen'),
                  ),
                  _ToolChip(
                    icon: Icons.highlight_rounded,
                    label: 'Fosfor',
                    active: _tool == 'highlighter',
                    onTap: () => setState(() => _tool = 'highlighter'),
                  ),
                  _ToolChip(
                    icon: Icons.auto_fix_high_rounded,
                    label: 'Silgi',
                    active: _tool == 'eraser',
                    onTap: () => setState(() => _tool = 'eraser'),
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: _undo,
                    icon: const Icon(Icons.undo_rounded),
                  ),
                  IconButton(
                    onPressed: _redo,
                    icon: const Icon(Icons.redo_rounded),
                  ),
                  IconButton(
                    onPressed: _clear,
                    icon: const Icon(Icons.delete_outline_rounded),
                  ),
                ],
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                ...colors.map(
                  (item) => GestureDetector(
                    onTap: () => setState(() {
                      _color = item;
                      if (_tool == 'eraser') _tool = 'pen';
                    }),
                    child: Container(
                      width: 28,
                      height: 28,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: item,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _color == item
                              ? palette.ringSelected
                              : palette.ringUnselected,
                          width: _color == item ? 3 : 1,
                        ),
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  width: 130,
                  child: Slider(
                    value: _width,
                    min: 1,
                    max: 16,
                    activeColor: _CanvasPalette.orange,
                    onChanged: (value) => setState(() => _width = value),
                  ),
                ),
                Text('${_width.toStringAsFixed(0)}px'),
                const SizedBox(width: 8),
                FilterChip(
                  selected: _grid,
                  label: const Text('Kareli'),
                  onSelected: (value) => setState(() => _grid = value),
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(14),
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: palette.paper,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: palette.border),
              ),
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 3.2,
                child: RepaintBoundary(
                  key: _canvasKey,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CustomPaint(
                        painter: _SolutionCanvasPainter(
                          palette: palette,
                          strokes: const [],
                          activeStroke: null,
                          showGrid: _grid,
                        ),
                      ),
                      if (_showInitialSnapshot &&
                          (widget.initialSnapshotUrl ?? '').isNotEmpty)
                        Image.network(
                          widget.initialSnapshotUrl!,
                          fit: BoxFit.fill,
                          errorBuilder: (_, _, _) => const SizedBox.shrink(),
                        ),
                      Listener(
                        onPointerDown: _start,
                        onPointerMove: _move,
                        onPointerUp: _end,
                        onPointerCancel: (_) =>
                            setState(() => _activeStroke = null),
                        child: CustomPaint(
                          painter: _SolutionCanvasPainter(
                            palette: palette,
                            strokes: _strokes,
                            activeStroke: _activeStroke,
                            showGrid: false,
                            drawBackground: false,
                          ),
                          child: const SizedBox.expand(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _ToolChip({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        selected: active,
        avatar: Icon(icon, size: 16),
        label: Text(label),
        selectedColor: const Color(0xFFFF8A1C).withValues(alpha: 0.22),
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class _SolutionCanvasPainter extends CustomPainter {
  final _CanvasPalette palette;
  final List<_CanvasStroke> strokes;
  final _CanvasStroke? activeStroke;
  final bool showGrid;
  final bool drawBackground;

  const _SolutionCanvasPainter({
    required this.palette,
    required this.strokes,
    required this.activeStroke,
    required this.showGrid,
    this.drawBackground = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (drawBackground) {
      final background = Paint()
        ..shader = LinearGradient(
          colors: [palette.paper, palette.paperDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(Offset.zero & size);
      canvas.drawRect(Offset.zero & size, background);
    }

    if (showGrid) {
      final gridPaint = Paint()
        ..color = palette.grid
        ..strokeWidth = 1;
      for (double x = 0; x < size.width; x += 24) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
      }
      for (double y = 0; y < size.height; y += 24) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      }
    }

    for (final stroke in strokes) {
      _drawStroke(canvas, stroke);
    }
    if (activeStroke != null) {
      _drawStroke(canvas, activeStroke!);
    }
  }

  void _drawStroke(Canvas canvas, _CanvasStroke stroke) {
    if (stroke.points.length < 2) return;
    final paint = Paint()
      ..color = stroke.tool == 'eraser'
          ? palette.paper
          : stroke.color.withValues(alpha: stroke.opacity)
      ..strokeWidth = stroke.width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..moveTo(stroke.points.first.offset.dx, stroke.points.first.offset.dy);
    for (var index = 1; index < stroke.points.length - 1; index += 1) {
      final current = stroke.points[index].offset;
      final next = stroke.points[index + 1].offset;
      path.quadraticBezierTo(
        current.dx,
        current.dy,
        (current.dx + next.dx) / 2,
        (current.dy + next.dy) / 2,
      );
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SolutionCanvasPainter oldDelegate) {
    return oldDelegate.strokes != strokes ||
        oldDelegate.activeStroke != activeStroke ||
        oldDelegate.showGrid != showGrid ||
        oldDelegate.palette != palette;
  }
}

class _CanvasStroke {
  final String id;
  final String tool;
  final Color color;
  final double width;
  final double opacity;
  final List<_StrokePoint> points;

  const _CanvasStroke({
    required this.id,
    required this.tool,
    required this.color,
    required this.width,
    required this.opacity,
    required this.points,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tool': tool,
      'color':
          '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}',
      'width': width,
      'opacity': opacity,
      'pressure': points.isEmpty ? 0.5 : points.last.pressure,
      'points': points.map((item) => item.toJson()).toList(),
      'createdAt': DateTime.now().toIso8601String(),
    };
  }
}

class _StrokePoint {
  final Offset offset;
  final double pressure;
  final String kind;

  const _StrokePoint({
    required this.offset,
    required this.pressure,
    required this.kind,
  });

  Map<String, dynamic> toJson() {
    return {
      'x': offset.dx,
      'y': offset.dy,
      'pressure': pressure,
      'pointerType': kind,
      't': DateTime.now().millisecondsSinceEpoch,
    };
  }
}
