import 'package:flutter/material.dart';
import 'responsive_layout.dart';
import '../utils/session_navigation.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool goHomeOnBack;

  const AppHeader({super.key, required this.title, this.goHomeOnBack = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isTablet = ResponsiveLayout.isTablet(context);
    final toolbarHeight = isTablet ? 72.0 : kToolbarHeight;

    return AppBar(
      backgroundColor: theme.scaffoldBackgroundColor,
      elevation: 0,
      toolbarHeight: toolbarHeight,
      titleSpacing: isTablet ? 8 : NavigationToolbar.kMiddleSpacing,
      iconTheme: IconThemeData(color: theme.textTheme.bodyLarge?.color),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: () async {
          if (!goHomeOnBack && Navigator.canPop(context)) {
            Navigator.pop(context);
            return;
          }

          await logoutToRoleSelect(context);
        },
      ),
      title: Text(
        title,
        style: TextStyle(
          color: theme.textTheme.bodyLarge?.color,
          fontWeight: FontWeight.bold,
          fontSize: isTablet ? 22 : 18,
        ),
      ),
      centerTitle: !isTablet,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(72);
}
