import 'package:flutter/material.dart';
import 'responsive_layout.dart';

class TeacherHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String teacherName;
  final String subtitle;
  final bool showBackButton;
  final VoidCallback? onNotificationTap;

  const TeacherHeader({
    super.key,
    required this.title,
    required this.teacherName,
    required this.subtitle,
    this.showBackButton = false,
    this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isTablet = ResponsiveLayout.isTablet(context);
    final toolbarHeight = isTablet ? 92.0 : kToolbarHeight;

    return AppBar(
      backgroundColor: theme.scaffoldBackgroundColor,
      elevation: 0,
      toolbarHeight: toolbarHeight,
      automaticallyImplyLeading: false,
      leading: showBackButton
          ? IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
            )
          : null,
      titleSpacing: showBackButton ? 0 : 16,
      title: Row(
        children: [
          CircleAvatar(
            radius: isTablet ? 24 : 22,
            backgroundImage: NetworkImage("https://i.pravatar.cc/150?img=12"),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  teacherName,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: isTablet ? 20 : 18,
                  ),
                ),
                if (title.isNotEmpty && isTablet)
                  Text(
                    title,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: isTablet ? 13 : 12,
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          onPressed: onNotificationTap ?? () {},
          icon: const Icon(Icons.notifications_none_rounded),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(92);
}
