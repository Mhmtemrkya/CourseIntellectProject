import 'package:flutter/material.dart';

import 'responsive_overlays.dart';

class PremiumModalShell extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String? description;
  final List<Color> colors;
  final Widget child;
  final EdgeInsetsGeometry? contentPadding;

  const PremiumModalShell({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.child,
    this.description,
    this.colors = const [Color(0xFF0F172A), Color(0xFF2563EB)],
    this.contentPadding,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ResponsiveSheetContainer(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        padding:
            contentPadding ??
            EdgeInsets.fromLTRB(
              18,
              8,
              18,
              MediaQuery.of(context).viewInsets.bottom + 24,
            ),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: colors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eyebrow,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (description != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        description!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.84),
                          height: 1.45,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
