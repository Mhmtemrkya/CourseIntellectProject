import 'package:flutter/material.dart';

import '../widgets/adaptive_scaffold.dart';
import 'onboarding_tours.dart';

/// Rol bazlı karşılama karuseli: ilk kart hoş geldin, ardından her sekme için
/// bir kart (ikon + başlık + detay). Tam ekran dialog olarak açılır.
Future<void> showWelcomeTour(
  BuildContext context, {
  required String? userRole,
  required List<AdaptiveDestination> destinations,
}) async {
  final intro = roleIntros[userRole ?? ''] ??
      const RoleIntro(
        title: 'Hoş geldiniz! 👋',
        body:
            'Uygulamaya hoş geldiniz. Bu kısa tanıtım alttaki sekmelerin ne işe '
            'yaradığını gösterir. Alt menüye uzun basarak bulunduğunuz sekmenin '
            'tanıtımını istediğiniz zaman yeniden açabilirsiniz.',
      );

  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierLabel: 'Tanıtım',
    barrierColor: Colors.black.withValues(alpha: 0.6),
    transitionDuration: const Duration(milliseconds: 260),
    transitionBuilder: (context, animation, secondary, child) {
      return FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.96, end: 1).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: child,
        ),
      );
    },
    pageBuilder: (context, animation, secondaryAnimation) => _WelcomeTourDialog(
      intro: intro,
      userRole: userRole,
      destinations: destinations,
    ),
  );
}

class _WelcomeTourDialog extends StatefulWidget {
  final RoleIntro intro;
  final String? userRole;
  final List<AdaptiveDestination> destinations;

  const _WelcomeTourDialog({
    required this.intro,
    required this.userRole,
    required this.destinations,
  });

  @override
  State<_WelcomeTourDialog> createState() => _WelcomeTourDialogState();
}

class _WelcomeTourDialogState extends State<_WelcomeTourDialog> {
  final PageController _controller = PageController();
  int _index = 0;

  int get _pageCount => widget.destinations.length + 1;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_index >= _pageCount - 1) {
      Navigator.of(context).pop();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _previous() {
    if (_index == 0) return;
    _controller.previousPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildIntroCard(ThemeData theme) {
    return _TourCard(
      icon: Icons.auto_awesome_rounded,
      iconColor: theme.colorScheme.primary,
      title: widget.intro.title,
      body: widget.intro.body,
    );
  }

  Widget _buildDestinationCard(ThemeData theme, AdaptiveDestination d) {
    return _TourCard(
      icon: d.icon,
      iconColor: d.sidebarColor ?? theme.colorScheme.primary,
      title: d.label,
      body: tabDetailFor(widget.userRole, d.label),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLast = _index == _pageCount - 1;

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480, maxHeight: 560),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Material(
              color: theme.dialogTheme.backgroundColor ??
                  theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(24),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8, right: 8),
                      child: TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(
                          'Atla',
                          style: TextStyle(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.55),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: PageView(
                      controller: _controller,
                      onPageChanged: (value) =>
                          setState(() => _index = value),
                      children: [
                        _buildIntroCard(theme),
                        ...widget.destinations
                            .map((d) => _buildDestinationCard(theme, d)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                    child: Row(
                      children: [
                        // İlerleme noktaları
                        Expanded(
                          child: Wrap(
                            spacing: 5,
                            children: List.generate(_pageCount, (i) {
                              final active = i == _index;
                              return AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: active ? 18 : 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  color: active
                                      ? theme.colorScheme.primary
                                      : theme.colorScheme.onSurface
                                          .withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              );
                            }),
                          ),
                        ),
                        if (_index > 0)
                          TextButton(
                            onPressed: _previous,
                            child: const Text('Geri'),
                          ),
                        const SizedBox(width: 4),
                        FilledButton(
                          onPressed: _next,
                          child: Text(isLast ? 'Başlayalım' : 'İleri'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TourCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String body;

  const _TourCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Icon(icon, size: 36, color: iconColor),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: SingleChildScrollView(
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                  height: 1.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sekmeye ilk geçişte açılan kompakt tanıtım sheet'i.
Future<void> showTabIntroSheet(
  BuildContext context, {
  required String? userRole,
  required AdaptiveDestination destination,
}) async {
  final theme = Theme.of(context);
  final color = destination.sidebarColor ?? theme.colorScheme.primary;

  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
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
                      destination.label,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(
                    tabDetailFor(userRole, destination.label),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.72),
                      height: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Anladım'),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
