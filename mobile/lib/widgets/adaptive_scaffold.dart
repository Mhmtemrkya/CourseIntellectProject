import 'package:flutter/material.dart';
import '../onboarding/onboarding_store.dart';
import '../onboarding/onboarding_ui.dart';
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
    // Onboarding: ilk kare çizildikten sonra karşılama turu / sekme tanıtımı.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowOnboarding());
  }

  void _changePage(int index) {
    setState(() => _currentIndex = index);
    _maybeShowTabIntro(index);
  }

  // ─── Onboarding ─────────────────────────────────────────────────────────

  String get _welcomeTourId => 'welcome:${widget.userRole ?? 'genel'}';

  String _tabTourId(int index) =>
      'tab:${widget.userRole ?? 'genel'}:${widget.destinations[index].label}';

  Future<void> _maybeShowOnboarding() async {
    final store = OnboardingStore.instance;
    if (!await store.hasSeen(_welcomeTourId)) {
      if (!mounted) return;
      await showWelcomeTour(
        context,
        userRole: widget.userRole,
        destinations: widget.destinations,
      );
      await store.markSeen(_welcomeTourId);
      // Karşılama turu tüm sekmeleri zaten anlattı; sekme tanıtımlarını
      // tekrar tekrar açmamak için görüldü say.
      for (var i = 0; i < widget.destinations.length; i++) {
        await store.markSeen(_tabTourId(i));
      }
      return;
    }
    await _maybeShowTabIntro(_currentIndex);
  }

  Future<void> _maybeShowTabIntro(int index) async {
    final store = OnboardingStore.instance;
    final tourId = _tabTourId(index);
    if (await store.hasSeen(tourId)) return;
    if (!mounted || _currentIndex != index) return;
    await showTabIntroSheet(
      context,
      userRole: widget.userRole,
      destination: widget.destinations[index],
    );
    await store.markSeen(tourId);
  }

  // Alt menüye / kenar menüye uzun basış: bulunulan sekmenin tanıtımını yeniden açar.
  void _replayCurrentTabIntro() {
    showTabIntroSheet(
      context,
      userRole: widget.userRole,
      destination: widget.destinations[_currentIndex],
    );
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
          GestureDetector(
            onLongPress: _replayCurrentTabIntro,
            child: AppSidebar(
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final navTheme = theme.bottomNavigationBarTheme;

    return Scaffold(
      body: _buildPageStack(),
      bottomNavigationBar: GestureDetector(
        onLongPress: _replayCurrentTabIntro,
        child: DecoratedBox(
        decoration: BoxDecoration(
          color: navTheme.backgroundColor,
          border: Border(
            top: BorderSide(color: theme.dividerColor.withValues(alpha: 0.72)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.32 : 0.08),
              blurRadius: 24,
              offset: const Offset(0, -10),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: _changePage,
            type: BottomNavigationBarType.fixed,
            backgroundColor: navTheme.backgroundColor,
            selectedItemColor: navTheme.selectedItemColor,
            unselectedItemColor: navTheme.unselectedItemColor,
            selectedLabelStyle: navTheme.selectedLabelStyle,
            unselectedLabelStyle: navTheme.unselectedLabelStyle,
            elevation: 0,
            items: widget.destinations
                .map(
                  (d) => BottomNavigationBarItem(
                    icon: Icon(d.icon),
                    label: d.label,
                  ),
                )
                .toList(),
          ),
        ),
        ),
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
