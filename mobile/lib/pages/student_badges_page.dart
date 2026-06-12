import 'package:flutter/material.dart';

import '../services/badge_catalog.dart';
import '../services/student_xp_service.dart';
import '../widgets/badge_unlock_modal.dart';
import '../widgets/responsive_layout.dart';

/// 300 başarı rozetinin tamamı — XP'ye göre sırayla açılır.
class StudentBadgesPage extends StatefulWidget {
  const StudentBadgesPage({super.key});

  @override
  State<StudentBadgesPage> createState() => _StudentBadgesPageState();
}

class _StudentBadgesPageState extends State<StudentBadgesPage> {
  int _xp = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final xp = await StudentXpService.getXp();
      if (!mounted) return;
      setState(() {
        _xp = xp;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unlockedCount = BadgeCatalog.unlockedCount(_xp);
    final nextBadge = BadgeCatalog.nextBadge(_xp);
    final prevThreshold = unlockedCount == 0
        ? 0
        : BadgeCatalog.xpThresholdFor(unlockedCount);
    final nextProgress = nextBadge == null
        ? 1.0
        : ((_xp - prevThreshold) / (nextBadge.xpThreshold - prevThreshold))
              .clamp(0.0, 1.0);

    return Scaffold(
      appBar: AppBar(title: const Text('Başarı Rozetleri')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                child: ResponsiveContent(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(22),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          gradient: const LinearGradient(
                            colors: [Color(0xFF08111F), Color(0xFFFF7A1A)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '300 BAŞARI ROZETİ',
                              style: theme.textTheme.titleLarge?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Her soru, her ödev, her adım seni zirveye taşır.',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                _heroMetric(
                                  '$unlockedCount / ${BadgeCatalog.total}',
                                  'Açılan Rozet',
                                ),
                                const SizedBox(width: 10),
                                _heroMetric('$_xp XP', 'Toplam XP'),
                              ],
                            ),
                            if (nextBadge != null) ...[
                              const SizedBox(height: 14),
                              Text(
                                'Sıradaki: ${nextBadge.name} • ${nextBadge.xpThreshold} XP',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  value: nextProgress,
                                  minHeight: 10,
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.24,
                                  ),
                                  valueColor:
                                      const AlwaysStoppedAnimation<Color>(
                                        Colors.white,
                                      ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      ...BadgeCatalog.categories.map(
                        (category) => _categorySection(theme, category),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _heroMetric(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _categorySection(ThemeData theme, BadgeCategory category) {
    final badges = BadgeCatalog.badgesForCategory(category);
    final unlocked = badges.where((badge) => _xp >= badge.xpThreshold).length;

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: theme.dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: category.color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(category.icon, color: category.color, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    category.name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: category.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$unlocked / ${badges.length}',
                    style: TextStyle(
                      color: category.color,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = (constraints.maxWidth / 76).floor().clamp(
                  4,
                  10,
                );
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: badges.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 8,
                    childAspectRatio: 0.72,
                  ),
                  itemBuilder: (context, index) {
                    final badge = badges[index];
                    final isUnlocked = _xp >= badge.xpThreshold;
                    return GestureDetector(
                      onTap: () => _showBadgeDetail(badge, isUnlocked),
                      child: Column(
                        children: [
                          Expanded(
                            child: BadgeShield(
                              badge: badge,
                              size: 46,
                              locked: !isUnlocked,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            badge.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: isUnlocked
                                  ? theme.textTheme.bodyMedium?.color
                                  : theme.textTheme.bodySmall?.color,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showBadgeDetail(BadgeRecord badge, bool isUnlocked) {
    final theme = Theme.of(context);
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              BadgeShield(badge: badge, size: 84, locked: !isUnlocked),
              const SizedBox(height: 14),
              Text(
                badge.name,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '${badge.category.name} • Rozet ${badge.code}',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              Text(
                isUnlocked
                    ? 'Bu rozeti ${badge.xpThreshold} XP eşiğini geçerek kazandın.'
                    : 'Açmak için ${badge.xpThreshold} XP gerekiyor. '
                          '${(badge.xpThreshold - _xp).clamp(0, 1 << 31)} XP kaldı.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Tamam'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
