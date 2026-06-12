import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../services/badge_catalog.dart';

/// Yeni kazanılan rozet(ler) için animasyonlu kutlama modalı.
/// Birden fazla rozet açıldıysa sırayla gösterir (en fazla 6 tanesi).
Future<void> showBadgeUnlockModal(
  BuildContext context,
  List<BadgeRecord> badges,
) {
  if (badges.isEmpty) return Future.value();
  const maxShown = 6;
  final shown = badges.take(maxShown).toList();
  final extraCount = badges.length - shown.length;

  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierLabel: 'Rozet',
    barrierColor: Colors.black.withValues(alpha: 0.72),
    transitionDuration: const Duration(milliseconds: 260),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(opacity: animation, child: child);
    },
    pageBuilder: (context, animation, secondaryAnimation) {
      return _BadgeUnlockView(badges: shown, extraCount: extraCount);
    },
  );
}

class _BadgeUnlockView extends StatefulWidget {
  final List<BadgeRecord> badges;
  final int extraCount;

  const _BadgeUnlockView({required this.badges, required this.extraCount});

  @override
  State<_BadgeUnlockView> createState() => _BadgeUnlockViewState();
}

class _BadgeUnlockViewState extends State<_BadgeUnlockView>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _pulse;
  late final AnimationController _rays;
  int _index = 0;

  BadgeRecord get _badge => widget.badges[_index];
  bool get _isLast => _index >= widget.badges.length - 1;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    )..forward();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _rays = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    )..repeat();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _pulse.dispose();
    _rays.dispose();
    super.dispose();
  }

  void _next() {
    if (_isLast) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _index++);
    _entrance
      ..reset()
      ..forward();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final badge = _badge;
    final color = badge.category.color;

    final scale = CurvedAnimation(parent: _entrance, curve: Curves.elasticOut);
    final fadeIn = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0.25, 1, curve: Curves.easeOut),
    );

    return SafeArea(
      child: Center(
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: theme.dividerColor),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.30),
                  blurRadius: 48,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.badges.length > 1)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Rozet ${_index + 1} / ${widget.badges.length}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                SizedBox(
                  width: 196,
                  height: 196,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      RotationTransition(
                        turns: _rays,
                        child: AnimatedBuilder(
                          animation: _pulse,
                          builder: (context, child) => Opacity(
                            opacity: 0.55 + 0.45 * _pulse.value,
                            child: child,
                          ),
                          child: CustomPaint(
                            size: const Size(196, 196),
                            painter: _RayBurstPainter(color: color),
                          ),
                        ),
                      ),
                      ScaleTransition(
                        scale: scale,
                        child: _BadgeShield(badge: badge, size: 124),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                FadeTransition(
                  opacity: fadeIn,
                  child: Column(
                    children: [
                      Text(
                        'YENİ ROZET KAZANDIN!',
                        style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        badge.name,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        alignment: WrapAlignment.center,
                        children: [
                          _chip(
                            theme,
                            icon: badge.category.icon,
                            label: badge.category.name,
                            color: color,
                          ),
                          _chip(
                            theme,
                            icon: Icons.bolt_rounded,
                            label: '${badge.xpThreshold} XP',
                            color: const Color(0xFFFF7A1A),
                          ),
                          _chip(
                            theme,
                            icon: Icons.tag_rounded,
                            label: badge.code,
                            color:
                                theme.textTheme.bodySmall?.color ?? Colors.grey,
                          ),
                        ],
                      ),
                      if (_isLast && widget.extraCount > 0) ...[
                        const SizedBox(height: 12),
                        Text(
                          've ${widget.extraCount} rozet daha kazandın!',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    onPressed: _next,
                    style: FilledButton.styleFrom(backgroundColor: color),
                    icon: Icon(
                      _isLast
                          ? Icons.check_rounded
                          : Icons.arrow_forward_rounded,
                    ),
                    label: Text(_isLast ? 'Harika!' : 'Sonraki Rozet'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(
    ThemeData theme, {
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Kalkan görünümlü rozet — listelerde ve modalda ortak kullanılır.
class BadgeShield extends StatelessWidget {
  final BadgeRecord badge;
  final double size;
  final bool locked;

  const BadgeShield({
    super.key,
    required this.badge,
    this.size = 64,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    return locked
        ? _LockedShield(size: size)
        : _BadgeShield(badge: badge, size: size);
  }
}

class _BadgeShield extends StatelessWidget {
  final BadgeRecord badge;
  final double size;

  const _BadgeShield({required this.badge, required this.size});

  @override
  Widget build(BuildContext context) {
    final color = badge.category.color;
    final dark = HSLColor.fromColor(color)
        .withLightness(
          (HSLColor.fromColor(color).lightness - 0.22).clamp(0.0, 1.0),
        )
        .toColor();
    return Container(
      width: size,
      height: size * 1.12,
      decoration: ShapeDecoration(
        shape: _ShieldBorder(
          side: BorderSide(
            color: Colors.white.withValues(alpha: 0.85),
            width: size * 0.035,
          ),
        ),
        gradient: LinearGradient(
          colors: [color, dark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shadows: [
          BoxShadow(
            color: color.withValues(alpha: 0.55),
            blurRadius: size * 0.22,
            offset: Offset(0, size * 0.06),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(badge.category.icon, color: Colors.white, size: size * 0.40),
          SizedBox(height: size * 0.04),
          Text(
            badge.code,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: size * 0.15,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _LockedShield extends StatelessWidget {
  final double size;

  const _LockedShield({required this.size});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final base = isDark ? const Color(0xFF2A3A55) : const Color(0xFFCBD5E1);
    return Container(
      width: size,
      height: size * 1.12,
      decoration: ShapeDecoration(
        shape: _ShieldBorder(
          side: BorderSide(color: theme.dividerColor, width: size * 0.03),
        ),
        color: base.withValues(alpha: isDark ? 0.5 : 0.6),
      ),
      child: Icon(
        Icons.lock_rounded,
        color: isDark ? Colors.white38 : const Color(0xFF64748B),
        size: size * 0.34,
      ),
    );
  }
}

/// Beş köşeli klasik kalkan formu.
class _ShieldBorder extends ShapeBorder {
  final BorderSide side;

  const _ShieldBorder({this.side = BorderSide.none});

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(side.width);

  Path _shieldPath(Rect rect) {
    final w = rect.width;
    final h = rect.height;
    final path = Path()
      ..moveTo(rect.left + w * 0.5, rect.top)
      ..lineTo(rect.left + w * 0.96, rect.top + h * 0.14)
      ..lineTo(rect.left + w * 0.96, rect.top + h * 0.55)
      ..quadraticBezierTo(
        rect.left + w * 0.96,
        rect.top + h * 0.82,
        rect.left + w * 0.5,
        rect.top + h,
      )
      ..quadraticBezierTo(
        rect.left + w * 0.04,
        rect.top + h * 0.82,
        rect.left + w * 0.04,
        rect.top + h * 0.55,
      )
      ..lineTo(rect.left + w * 0.04, rect.top + h * 0.14)
      ..close();
    return path;
  }

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      _shieldPath(rect.deflate(side.width));

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      _shieldPath(rect);

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none) return;
    final paint = Paint()
      ..color = side.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = side.width;
    canvas.drawPath(_shieldPath(rect.deflate(side.width / 2)), paint);
  }

  @override
  ShapeBorder scale(double t) => _ShieldBorder(side: side.scale(t));
}

/// Rozetin arkasında dönen ışık huzmeleri.
class _RayBurstPainter extends CustomPainter {
  final Color color;

  const _RayBurstPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const rayCount = 12;
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color.withValues(alpha: 0.34), color.withValues(alpha: 0.0)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    for (var i = 0; i < rayCount; i++) {
      final angle = (i / rayCount) * 2 * math.pi;
      const halfWidth = math.pi / rayCount * 0.45;
      final path = Path()
        ..moveTo(center.dx, center.dy)
        ..lineTo(
          center.dx + radius * math.cos(angle - halfWidth),
          center.dy + radius * math.sin(angle - halfWidth),
        )
        ..lineTo(
          center.dx + radius * math.cos(angle + halfWidth),
          center.dy + radius * math.sin(angle + halfWidth),
        )
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _RayBurstPainter oldDelegate) =>
      oldDelegate.color != color;
}
