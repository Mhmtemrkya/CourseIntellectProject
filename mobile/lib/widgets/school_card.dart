import 'package:flutter/material.dart';
import 'card_system.dart';

/// Content-card counterpart to VividMetricCard. Keeps controls and body readable.
class SchoolCard extends StatelessWidget {
  const SchoolCard({super.key, this.child, this.title, this.color, this.shadowColor,
    this.surfaceTintColor, this.elevation, this.shape, this.borderOnForeground = true,
    this.margin, this.clipBehavior, this.semanticContainer = true});
  final Widget? child;
  final String? title;
  final Color? color;
  final Color? shadowColor;
  final Color? surfaceTintColor;
  final double? elevation;
  final ShapeBorder? shape;
  final bool borderOnForeground;
  final EdgeInsetsGeometry? margin;
  final Clip? clipBehavior;
  final bool semanticContainer;

  @override
  Widget build(BuildContext context) => Card(
    color: color,
    shadowColor: shadowColor,
    surfaceTintColor: surfaceTintColor,
    elevation: elevation,
    shape: shape,
    borderOnForeground: borderOnForeground,
    margin: margin,
    clipBehavior: clipBehavior ?? Clip.antiAlias,
    semanticContainer: semanticContainer,
    child: DecoratedBox(
      decoration: contentCardDecoration(context, title: title ?? cardTitleOf(child)),
      child: child,
    ),
  );
}
