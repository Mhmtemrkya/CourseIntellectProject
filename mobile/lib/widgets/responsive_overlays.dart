import 'package:flutter/material.dart';

import 'responsive_layout.dart';

class ResponsiveSheetContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;

  const ResponsiveSheetContainer({
    super.key,
    required this.child,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: ResponsiveLayout.isTablet(context) ? 720 : double.infinity,
        ),
        child: Padding(
          padding: padding ?? EdgeInsets.zero,
          child: child,
        ),
      ),
    );
  }
}

class ResponsiveDialogContainer extends StatelessWidget {
  final Widget child;
  final double maxWidth;

  const ResponsiveDialogContainer({
    super.key,
    required this.child,
    this.maxWidth = 520,
  });

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: ResponsiveLayout.isTablet(context) ? maxWidth : 420,
      ),
      child: child,
    );
  }
}
