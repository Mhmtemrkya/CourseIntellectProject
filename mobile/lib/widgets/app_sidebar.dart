import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme_provider.dart';
import 'course_intellect_logo.dart';

/// Desktop uygulamasındaki ModernSidebar'in Flutter karşılığı.
/// Gradient arka plan, logo, navigasyon ögeleri ve kullanıcı bilgisi içerir.
class AppSidebar extends StatelessWidget {
  final List<SidebarDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final String? userName;
  final String? userRole;

  const AppSidebar({
    super.key,
    required this.destinations,
    required this.selectedIndex,
    required this.onDestinationSelected,
    this.userName,
    this.userRole,
  });

  static const double width = 280;

  // Desktop app ile aynı gradient: #00354F → #002a40 → #001f30
  static const _gradientColors = [
    Color(0xFF00354F),
    Color(0xFF002A40),
    Color(0xFF001F30),
  ];

  @override
  Widget build(BuildContext context) {
    final tp = context.watch<ThemeProvider>();

    return Container(
      width: width,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: _gradientColors,
        ),
      ),
      child: Column(
        children: [
          // ---- LOGO SECTION ----
          _LogoSection(tenantLogo: tp.tenantLogo, tenantName: tp.tenantName),

          // ---- NAV ITEMS ----
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              itemCount: destinations.length,
              itemBuilder: (context, index) {
                final dest = destinations[index];
                final isSelected = index == selectedIndex;
                return _NavItem(
                  icon: dest.icon,
                  label: dest.label,
                  color: dest.color,
                  isSelected: isSelected,
                  onTap: () => onDestinationSelected(index),
                );
              },
            ),
          ),

          // ---- USER INFO ----
          if (userName != null)
            _UserSection(
              name: userName!,
              role: userRole ?? '',
              brandAccent: tp.brandAccent,
            ),

          // ---- FOOTER LOGO ----
          const _FooterLogo(),
        ],
      ),
    );
  }
}

// ─── Data class ─────────────────────────────────────────────────────────────

class SidebarDestination {
  final IconData icon;
  final String label;
  final Color color;

  const SidebarDestination({
    required this.icon,
    required this.label,
    this.color = Colors.white,
  });
}

// ─── Logo Section ───────────────────────────────────────────────────────────

class _LogoSection extends StatelessWidget {
  final String? tenantLogo;
  final String tenantName;

  const _LogoSection({this.tenantLogo, required this.tenantName});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Row(
        children: [
          // Tenant logo veya varsayılan ikon
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              gradient: const LinearGradient(
                colors: [Color(0xFFD9790B), Color(0xFFF59E0B)],
              ),
            ),
            child: tenantLogo != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      tenantLogo!,
                      width: 36,
                      height: 36,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.school_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.school_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              tenantName.isNotEmpty ? tenantName : 'CourseIntellect',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Nav Item ───────────────────────────────────────────────────────────────

class _NavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovering = true),
        onExit: (_) => setState(() => _hovering = false),
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: widget.isSelected
                  ? Colors.white.withValues(alpha: 0.14)
                  : _hovering
                  ? Colors.white.withValues(alpha: 0.07)
                  : Colors.transparent,
            ),
            child: Row(
              children: [
                Icon(
                  widget.icon,
                  size: 20,
                  color: widget.isSelected
                      ? widget.color
                      : Colors.white.withValues(alpha: 0.7),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    widget.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: widget.isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: widget.isSelected
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                ),
                if (widget.isSelected)
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: widget.color,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── User Section ───────────────────────────────────────────────────────────

class _UserSection extends StatelessWidget {
  final String name;
  final String role;
  final Color brandAccent;

  const _UserSection({
    required this.name,
    required this.role,
    required this.brandAccent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              gradient: LinearGradient(
                colors: [brandAccent, brandAccent.withValues(alpha: 0.7)],
              ),
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (role.isNotEmpty)
                  Text(
                    role,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 11,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Footer Logo ────────────────────────────────────────────────────────────

class _FooterLogo extends StatelessWidget {
  const _FooterLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Column(
        children: [
          const CourseIntellectLogo(scale: 0.22, compact: true),
          const SizedBox(height: 4),
          Text(
            'CourseIntellect',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.35),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}
