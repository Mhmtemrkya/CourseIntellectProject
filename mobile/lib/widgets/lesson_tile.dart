import 'package:flutter/material.dart';
import 'responsive_layout.dart';

class LessonTile extends StatelessWidget {
  final String time;
  final String title;
  final String teacher;

  const LessonTile({
    super.key,
    required this.time,
    required this.title,
    required this.teacher,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isTablet = ResponsiveLayout.isTablet(context);

    return Container(
      margin: EdgeInsets.only(bottom: isTablet ? 14 : 10),
      padding: EdgeInsets.all(isTablet ? 20 : 16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: theme.brightness == Brightness.dark
                ? Colors.black.withValues(alpha: 0.25)
                : Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            constraints: BoxConstraints(
              minWidth: isTablet ? 88 : 0,
            ),
            padding: EdgeInsets.symmetric(
              horizontal: isTablet ? 14 : 12,
              vertical: isTablet ? 12 : 10,
            ),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              time,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.primary,
                fontSize: isTablet ? 15 : 14,
              ),
            ),
          ),
          SizedBox(width: isTablet ? 18 : 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: isTablet ? 17 : 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  teacher,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: isTablet ? 14 : 13,
                    color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: theme.iconTheme.color?.withValues(alpha: 0.8),
          ),
        ],
      ),
    );
  }
}
