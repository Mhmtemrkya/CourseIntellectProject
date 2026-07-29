import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'responsive_layout.dart';
import '../theme_provider.dart';
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
    final tenantLogo = context.watch<ThemeProvider>().tenantLogo;

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
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (tenantLogo != null) ...[
            Container(
              width: isTablet ? 54 : 44,
              height: isTablet ? 38 : 32,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: theme.dividerColor),
              ),
              child: Image.network(
                tenantLogo,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(width: 10),
          ],
          Flexible(
            child: Text(
              title,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: theme.textTheme.bodyLarge?.color,
                fontWeight: FontWeight.bold,
                fontSize: isTablet ? 22 : 18,
              ),
            ),
          ),
        ],
      ),
      centerTitle: !isTablet,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(72);
}
