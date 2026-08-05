import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:student/i18n/app_locale.dart';
import '../onboarding/onboarding_store.dart';
import '../onboarding/onboarding_ui.dart';
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

  /// Telefonda alt şeritte kalan sabit sekme sayısı. Fazlası "Daha" ekranına
  /// düşer: 7-9 sekmelik şeritte etiketler okunmuyor, ikonlar birbirine giriyordu.
  static const _pinnedTabs = 4;

  /// "Daha" listesi açık mı? Sekme seçiliyken de açılabilir (kullanıcı listeye
  /// geri döner), bu yüzden `_currentIndex`ten AYRI tutulur.
  bool _showMoreSheet = false;

  /// Şerit taşmıyorsa "Daha" hiç eklenmez — 5 sekme rahat sığıyor.
  bool get _usesMoreTab => widget.destinations.length > _pinnedTabs + 1;

  /// Alt şeritte kaç doğrudan sekme var (Daha hariç).
  int get _visibleTabCount =>
      _usesMoreTab ? _pinnedTabs : widget.destinations.length;

  /// "Daha"ya düşen hedefler ve gerçek indeksleri.
  List<MapEntry<int, AdaptiveDestination>> get _overflowDestinations => [
    for (var i = _visibleTabCount; i < widget.destinations.length; i++)
      MapEntry(i, widget.destinations[i]),
  ];

  @override
  void initState() {
    super.initState();
    _pages = List<Widget?>.filled(widget.destinations.length, null);
    // Onboarding: ilk kare çizildikten sonra karşılama turu / sekme tanıtımı.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowOnboarding());
  }

  void _changePage(int index) {
    setState(() {
      _currentIndex = index;
      _showMoreSheet = false;
    });
    _maybeShowTabIntro(index);
  }

  /// Alt şeritteki dokunuş. Son sıra "Daha" ise sayfa değiştirmez, listeyi açar.
  void _onBarTap(int barIndex) {
    if (_usesMoreTab && barIndex == _visibleTabCount) {
      setState(() => _showMoreSheet = true);
      return;
    }
    _changePage(barIndex);
  }

  // ─── Onboarding ─────────────────────────────────────────────────────────

  String get _welcomeTourId => 'welcome:v2:${widget.userRole ?? 'genel'}';

  String _tabTourId(int index) =>
      'tab:v2:${widget.userRole ?? 'genel'}:${widget.destinations[index].label}';

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

  Widget _buildPageStack({bool showMore = false}) {
    return Stack(
      children: [
        ...List.generate(widget.destinations.length, (index) {
          final active = !showMore && index == _currentIndex;
          final page = index == _currentIndex
              ? _buildPage(index)
              : _pages[index];
          return Offstage(
            offstage: !active,
            child: TickerMode(
              enabled: active,
              child: page ?? const SizedBox.shrink(),
            ),
          );
        }),
        if (showMore)
          _MoreDestinationsPage(
            entries: _overflowDestinations,
            currentIndex: _currentIndex,
            onSelected: _changePage,
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final useSidebar = ResponsiveLayout.shouldShowSidebar(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        // "Daha" listesi açıkken geri, listeyi kapatıp bulunulan sekmeye döner —
        // uygulamadan çıkmaz. Aksi hâlde kullanıcı listeden çıkamıyordu.
        if (_showMoreSheet) {
          setState(() => _showMoreSheet = false);
          return;
        }
        // "Daha" altındaki bir hedefteyken geri, o hedefin geldiği listeye döner.
        if (_usesMoreTab && _currentIndex >= _visibleTabCount) {
          setState(() => _showMoreSheet = true);
          return;
        }
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

    // "Daha" sekmesi, altındaki hedeflerden biri açıkken de seçili görünür:
    // kullanıcı hangi grupta olduğunu şeritten okuyabilsin.
    final barIndex = _showMoreSheet || _currentIndex >= _visibleTabCount
        ? _visibleTabCount
        : _currentIndex;

    return Scaffold(
      body: _buildPageStack(showMore: _showMoreSheet),
      bottomNavigationBar: GestureDetector(
        onLongPress: _replayCurrentTabIntro,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: navTheme.backgroundColor,
            border: Border(
              top: BorderSide(
                color: theme.dividerColor.withValues(alpha: 0.72),
              ),
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _MobileInstitutionBrand(),
                BottomNavigationBar(
                  currentIndex: barIndex,
                  onTap: _onBarTap,
                  type: BottomNavigationBarType.fixed,
                  backgroundColor: navTheme.backgroundColor,
                  selectedItemColor: navTheme.selectedItemColor,
                  unselectedItemColor: navTheme.unselectedItemColor,
                  selectedLabelStyle: navTheme.selectedLabelStyle,
                  unselectedLabelStyle: navTheme.unselectedLabelStyle,
                  elevation: 0,
                  items: [
                    for (final d in widget.destinations.take(_visibleTabCount))
                      BottomNavigationBarItem(
                        icon: Icon(d.icon),
                        label: d.label,
                      ),
                    if (_usesMoreTab)
                      BottomNavigationBarItem(
                        icon: const Icon(Icons.grid_view_rounded),
                        label: 'Daha'.tr,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Daha" ekranı: alt şeride sığmayan hedeflerin listesi.
///
/// Masaüstündeki hub mantığının mobil karşılığı — şerit dört ana işi tutar,
/// gerisi tek bir ekranda başlıklı kartlar hâlinde durur. Seçilen hedef normal
/// bir sekme gibi açılır (yeni rota İTİLMEZ): sayfa durumu korunur, geri
/// tuşunun anlamı değişmez.
class _MoreDestinationsPage extends StatelessWidget {
  final List<MapEntry<int, AdaptiveDestination>> entries;
  final int currentIndex;
  final ValueChanged<int> onSelected;

  const _MoreDestinationsPage({
    required this.entries,
    required this.currentIndex,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Daha'.tr,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: entries.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final entry = entries[index];
          final destination = entry.value;
          final selected = entry.key == currentIndex;
          final color = destination.sidebarColor ?? theme.colorScheme.primary;

          return Material(
            color: selected
                ? color.withValues(alpha: 0.10)
                : theme.cardColor.withValues(
                    alpha: theme.brightness == Brightness.dark ? 0.86 : 0.96,
                  ),
            borderRadius: BorderRadius.circular(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => onSelected(entry.key),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected
                        ? color.withValues(alpha: 0.55)
                        : theme.dividerColor.withValues(alpha: 0.72),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(destination.icon, color: color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        destination.label.tr,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, color: theme.hintColor),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MobileInstitutionBrand extends StatelessWidget {
  const _MobileInstitutionBrand();

  @override
  Widget build(BuildContext context) {
    final branding = context.watch<ThemeProvider>();
    if (branding.tenantLogo == null) return const SizedBox.shrink();

    return Container(
      height: 38,
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 5, 14, 3),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.55),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            constraints: const BoxConstraints(maxWidth: 64),
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(7),
            ),
            child: Image.network(
              branding.tenantLogo!,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
            ),
          ),
          if (branding.tenantName.isNotEmpty) ...[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                branding.tenantName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
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
