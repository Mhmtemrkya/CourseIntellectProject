import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';

class ResponsiveLayout {
  static bool isTablet(BuildContext context) {
    return MediaQuery.of(context).size.width >= 768;
  }

  static bool isLargeTablet(BuildContext context) {
    return MediaQuery.of(context).size.width >= 1100;
  }

  static bool isDesktop(BuildContext context) {
    return MediaQuery.of(context).size.width >= 1100 || isDesktopPlatform;
  }

  /// macOS, Windows, Linux gibi masaustu platformda mi
  static bool get isDesktopPlatform {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.linux;
  }

  /// iPad veya Android tablet mi (dokunmatik buyuk ekran)
  static bool get isTabletPlatform {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.android;
  }

  /// Sidebar gosterilmeli mi: macOS her zaman, iPad/tablet yatay modda genis ekranda
  static bool shouldShowSidebar(BuildContext context) {
    if (isDesktopPlatform) return true;
    return MediaQuery.of(context).size.width >= 1100;
  }

  /// Apple Pencil / Stylus destegi olan platform mu
  static bool get supportsStylusInput {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.iOS;
  }

  static double contentMaxWidth(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width >= 1366) return 1320;
    if (width >= 1100) return 1180;
    if (width >= 768) return 960;
    return width;
  }

  static int columns(
    BuildContext context, {
    int phone = 1,
    int tablet = 2,
    int largeTablet = 3,
  }) {
    if (isLargeTablet(context)) return largeTablet;
    if (isTablet(context)) return tablet;
    return phone;
  }
}

/// Kartları sütunlara dizen ızgara. Genişlik ekrandan değil, ızgaranın
/// gerçekten aldığı alandan (LayoutBuilder) hesaplanır: sayfa dolgusu ekran
/// genişliğinden düşülmezse iki kart sığmaz ve Wrap her kartı ayrı satıra atar.
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({
    super.key,
    required this.children,
    this.spacing = 12,
    this.runSpacing,
    this.phone = 1,
    this.tablet = 2,
    this.largeTablet = 3,
  });

  final List<Widget> children;
  final double spacing;
  final double? runSpacing;
  final int phone;
  final int tablet;
  final int largeTablet;

  @override
  Widget build(BuildContext context) {
    final count = ResponsiveLayout.columns(
      context,
      phone: phone,
      tablet: tablet,
      largeTablet: largeTablet,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        // Kesirli piksel yuvarlaması son kartı alt satıra itmesin.
        final width = ((constraints.maxWidth - spacing * (count - 1)) / count)
            .floorToDouble();
        return Wrap(
          spacing: spacing,
          runSpacing: runSpacing ?? spacing,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}

class ResponsiveContent extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;

  const ResponsiveContent({super.key, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: ResponsiveLayout.contentMaxWidth(context),
        ),
        child: Padding(padding: padding ?? EdgeInsets.zero, child: child),
      ),
    );
  }
}
