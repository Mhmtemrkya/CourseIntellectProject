import 'package:flutter/material.dart';

class CourseIntellectLogo extends StatelessWidget {
  final double scale;
  final bool showWordmark;
  final bool compact;

  const CourseIntellectLogo({
    super.key,
    this.scale = 1,
    this.showWordmark = true,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final height = compact ? 108 * scale : 168 * scale;
    final width = compact ? 160 * scale : 248 * scale;

    if (!showWordmark) {
      return Image.asset(
        'assets/logo/course_intellect.png',
        width: width,
        height: height,
        fit: BoxFit.contain,
      );
    }

    return Image.asset(
      'assets/logo/course_intellect.png',
      width: width,
      height: height,
      fit: BoxFit.contain,
    );
  }
}
