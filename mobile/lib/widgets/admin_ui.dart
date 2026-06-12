import 'package:flutter/material.dart';
import 'adaptive_scaffold.dart';
import 'responsive_layout.dart';

class AdminScaffold extends StatelessWidget {
  final PreferredSizeWidget? appBar;
  final Widget child;
  final Widget? floatingActionButton;

  const AdminScaffold({
    super.key,
    this.appBar,
    required this.child,
    this.floatingActionButton,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final hasSidebar = SidebarState.of(context);
    final showFallbackBackButton =
        !hasSidebar && appBar == null && Navigator.of(context).canPop();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: hasSidebar ? null : appBar,
      floatingActionButton: floatingActionButton,
      body: Stack(
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? const [
                        Color(0xFF08111F),
                        Color(0xFF0B1628),
                        Color(0xFF10223A),
                      ]
                    : const [
                        Color(0xFFF8FAFC),
                        Color(0xFFF1F5F9),
                        Color(0xFFFFF7ED),
                      ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: ResponsiveContent(child: child),
          ),
          if (showFallbackBackButton)
            Positioned(
              top: MediaQuery.paddingOf(context).top + 10,
              left: 12,
              child: Material(
                color: theme.cardColor.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(16),
                elevation: 10,
                child: IconButton(
                  tooltip: 'Geri',
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_ios_new_rounded),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class AdminHeroCard extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String description;
  final List<Widget> metrics;
  final List<Color> colors;

  const AdminHeroCard({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.metrics,
    this.colors = const [Color(0xFF08111F), Color(0xFFFF7A1A)],
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colors.first,
            Color.lerp(colors.first, colors.last, 0.22) ?? colors.first,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: colors.last.withValues(alpha: 0.24),
            blurRadius: 34,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: colors.last.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: colors.last.withValues(alpha: 0.28)),
            ),
            child: Text(
              eyebrow,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
              height: 1.45,
            ),
          ),
          if (metrics.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(children: metrics),
          ],
        ],
      ),
    );
  }
}

class AdminHeroMetric extends StatelessWidget {
  final String label;
  final String value;

  const AdminHeroMetric({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.white70,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AdminPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const AdminPanel({super.key, required this.child, this.padding, this.margin});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      margin: margin,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor.withValues(
          alpha: theme.brightness == Brightness.dark ? 0.86 : 0.96,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.72)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(
              alpha: theme.brightness == Brightness.dark ? 0.18 : 0.06,
            ),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class AdminSectionTitle extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const AdminSectionTitle({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class AdminAccentBadge extends StatelessWidget {
  final String label;
  final Color color;

  const AdminAccentBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800),
      ),
    );
  }
}
