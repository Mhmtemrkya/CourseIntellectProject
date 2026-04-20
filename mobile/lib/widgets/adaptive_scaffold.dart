import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import 'app_sidebar.dart';
import 'responsive_layout.dart';

/// Sidebar gorunup gorunmedigini alt widget'lara iletir.
/// Sayfalar bunu kontrol ederek AppBar'larini gizleyebilir.
class SidebarState extends InheritedWidget {
  final bool hasSidebar;

  const SidebarState({
    super.key,
    required this.hasSidebar,
    required super.child,
  });

  static bool of(BuildContext context) {
    final state = context.dependOnInheritedWidgetOfExactType<SidebarState>();
    return state?.hasSidebar ?? false;
  }

  @override
  bool updateShouldNotify(SidebarState oldWidget) =>
      hasSidebar != oldWidget.hasSidebar;
}

/// Platforma ve ekran genisligine gore sidebar veya bottom navigation gosterir.
///
/// - macOS: Her zaman sidebar (desktop görünümü)
/// - iPad / tablet landscape (>= 1100px): Sidebar
/// - Telefon / dar ekran: Bottom navigation
class AdaptiveScaffold extends StatefulWidget {
  final List<AdaptiveDestination> destinations;
  final String? userName;
  final String? userRole;

  const AdaptiveScaffold({
    super.key,
    required this.destinations,
    this.userName,
    this.userRole,
  });

  @override
  State<AdaptiveScaffold> createState() => _AdaptiveScaffoldState();
}

class _AdaptiveScaffoldState extends State<AdaptiveScaffold> {
  int _currentIndex = 0;
  late final List<Widget?> _pages;

  @override
  void initState() {
    super.initState();
    _pages = List<Widget?>.filled(widget.destinations.length, null);
  }

  void _changePage(int index) {
    setState(() => _currentIndex = index);
  }

  Widget _buildPage(int index) {
    _pages[index] ??= widget.destinations[index].pageBuilder(context);
    return _pages[index]!;
  }

  Widget _buildPageStack() {
    return Stack(
      children: List.generate(widget.destinations.length, (index) {
        final page = index == _currentIndex ? _buildPage(index) : _pages[index];
        return Offstage(
          offstage: _currentIndex != index,
          child: TickerMode(
            enabled: _currentIndex == index,
            child: page ?? const SizedBox.shrink(),
          ),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final useSidebar = ResponsiveLayout.shouldShowSidebar(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await handleBottomNavBack(
          context,
          currentIndex: _currentIndex,
          onSelectRoot: _changePage,
        );
      },
      child: SidebarState(
        hasSidebar: useSidebar,
        child: useSidebar ? _buildDesktopLayout() : _buildMobileLayout(),
      ),
    );
  }

  // ─── Desktop / Large Tablet Layout ──────────────────────────────────────

  Widget _buildDesktopLayout() {
    return Scaffold(
      body: Row(
        children: [
          AppSidebar(
            destinations: widget.destinations
                .map(
                  (d) => SidebarDestination(
                    icon: d.icon,
                    label: d.label,
                    color: d.sidebarColor ?? Colors.white,
                  ),
                )
                .toList(),
            selectedIndex: _currentIndex,
            onDestinationSelected: _changePage,
            userName: widget.userName,
            userRole: widget.userRole,
          ),
          // Desktop app'teki gibi ince ayırıcı çizgi
          Container(
            width: 1,
            color: Theme.of(context).dividerColor.withValues(alpha: 0.15),
          ),
          // Ana içerik alanı
          Expanded(child: _buildPageStack()),
        ],
      ),
    );
  }

  // ─── Mobile / Phone Layout ──────────────────────────────────────────────

  Widget _buildMobileLayout() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: _buildPageStack(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _changePage,
        type: BottomNavigationBarType.fixed,
        backgroundColor: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        selectedItemColor: context.watch<ThemeProvider>().brandAccent,
        unselectedItemColor: isDark ? Colors.grey[400] : Colors.grey[600],
        items: widget.destinations
            .map(
              (d) =>
                  BottomNavigationBarItem(icon: Icon(d.icon), label: d.label),
            )
            .toList(),
      ),
    );
  }
}

// ─── Destination model ──────────────────────────────────────────────────────

class AdaptiveDestination {
  final IconData icon;
  final String label;
  final WidgetBuilder pageBuilder;

  /// Sidebar'daki ikon rengi (mobil bottom nav'da kullanilmaz)
  final Color? sidebarColor;

  const AdaptiveDestination({
    required this.icon,
    required this.label,
    required this.pageBuilder,
    this.sidebarColor,
  });
}
