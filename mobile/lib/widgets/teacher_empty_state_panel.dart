import 'package:flutter/material.dart';

class TeacherEmptyStatePanel extends StatelessWidget {
  const TeacherEmptyStatePanel({
    super.key,
    required this.title,
    required this.description,
    required this.accentColor,
    required this.mainIcon,
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.tipTitle,
    this.tipDescription,
    this.floatingIcons = const [],
  });

  final String title;
  final String description;
  final Color accentColor;
  final IconData mainIcon;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final String? tipTitle;
  final String? tipDescription;
  final List<IconData> floatingIcons;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final icons = floatingIcons.isEmpty
        ? const [
            Icons.description_outlined,
            Icons.image_outlined,
            Icons.play_circle_outline_rounded,
          ]
        : floatingIcons;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 26),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF07101C) : Colors.white,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : const Color(0xFFE2E8F0),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.30 : 0.07),
            blurRadius: 34,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 200,
            child: LayoutBuilder(
              builder: (context, constraints) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned.fill(
                      child: CustomPaint(
                        painter: _EmptyOrbitPainter(
                          isDark: isDark,
                          accentColor: accentColor,
                        ),
                      ),
                    ),
                    Positioned(top: 18, child: _cloudUpload(accentColor)),
                    Positioned(top: 88, child: _openBook(isDark, accentColor)),
                    Positioned(
                      left: 18,
                      top: 60,
                      child: _floatingIcon(icons[0], accentColor, isDark),
                    ),
                    Positioned(
                      right: 22,
                      top: 74,
                      child: _floatingIcon(
                        icons.length > 1 ? icons[1] : Icons.auto_awesome,
                        const Color(0xFF2563EB),
                        isDark,
                      ),
                    ),
                    Positioned(
                      right: 54,
                      bottom: 24,
                      child: _floatingIcon(
                        icons.length > 2 ? icons[2] : Icons.insights_rounded,
                        const Color(0xFF22C55E),
                        isDark,
                        size: 46,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 4),
          Icon(mainIcon, color: accentColor, size: 30),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontWeight: FontWeight.w900,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.72)
                  : const Color(0xFF475569),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 24),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFF97316),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                onPressed: onPrimary,
                icon: const Icon(Icons.add_rounded),
                label: Text(
                  primaryLabel,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              if (secondaryLabel != null && onSecondary != null)
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark
                        ? Colors.white
                        : const Color(0xFF111827),
                    side: BorderSide(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.14)
                          : const Color(0xFFE2E8F0),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 14,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: onSecondary,
                  icon: const Icon(Icons.upload_file_outlined),
                  label: Text(
                    secondaryLabel!,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
            ],
          ),
          if (tipDescription != null) ...[
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.035)
                    : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.lightbulb_outline_rounded,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (tipTitle != null) ...[
                          Text(
                            tipTitle!,
                            style: TextStyle(
                              color: isDark
                                  ? Colors.white
                                  : const Color(0xFF111827),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        Text(
                          tipDescription!,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                height: 1.45,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.70)
                                    : const Color(0xFF475569),
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _cloudUpload(Color accentColor) {
    return Icon(
      Icons.cloud_upload_outlined,
      size: 66,
      color: Colors.white.withValues(alpha: 0.92),
      shadows: [
        Shadow(color: accentColor.withValues(alpha: 0.78), blurRadius: 24),
      ],
    );
  }

  Widget _openBook(bool isDark, Color accentColor) {
    return SizedBox(
      width: 160,
      height: 92,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 126,
            height: 58,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? const [Color(0xFF263247), Color(0xFF0E1624)]
                    : const [Color(0xFFE2E8F0), Color(0xFFCBD5E1)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(38),
              ),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.34),
                  blurRadius: 34,
                  spreadRadius: 2,
                ),
              ],
            ),
          ),
          Positioned(
            top: 12,
            left: 18,
            child: Transform.rotate(angle: 0.16, child: _pageWing(isDark)),
          ),
          Positioned(
            top: 12,
            right: 18,
            child: Transform.rotate(angle: -0.16, child: _pageWing(isDark)),
          ),
          Container(
            width: 12,
            height: 78,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accentColor.withValues(alpha: 0.95),
                  accentColor.withValues(alpha: 0),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pageWing(bool isDark) {
    return Container(
      width: 72,
      height: 44,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1D293B) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Colors.white.withValues(alpha: isDark ? 0.08 : 0.42),
        ),
      ),
    );
  }

  Widget _floatingIcon(
    IconData icon,
    Color color,
    bool isDark, {
    double size = 52,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.035)
            : Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.28)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Icon(icon, color: color, size: size * 0.44),
    );
  }
}

class _EmptyOrbitPainter extends CustomPainter {
  const _EmptyOrbitPainter({required this.isDark, required this.accentColor});

  final bool isDark;
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.58);
    final rect = Rect.fromCenter(
      center: center,
      width: size.width * 0.72,
      height: 92,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = (isDark ? Colors.white : const Color(0xFF64748B)).withValues(
        alpha: isDark ? 0.18 : 0.16,
      );

    final path = Path()..addOval(rect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 4), paint);
        distance += 12;
      }
    }

    final glowPaint = Paint()
      ..color = accentColor.withValues(alpha: isDark ? 0.28 : 0.16)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 34);
    canvas.drawCircle(center.translate(0, -8), 54, glowPaint);
  }

  @override
  bool shouldRepaint(covariant _EmptyOrbitPainter oldDelegate) {
    return oldDelegate.isDark != isDark ||
        oldDelegate.accentColor != accentColor;
  }
}
