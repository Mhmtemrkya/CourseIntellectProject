import 'package:flutter/material.dart';

import '../services/student_xp_service.dart';

class AchievementsWidget extends StatefulWidget {
  final int refreshKey;

  const AchievementsWidget({super.key, required this.refreshKey});

  @override
  State<AchievementsWidget> createState() => _AchievementsWidgetState();
}

class _AchievementsWidgetState extends State<AchievementsWidget> {
  int xp = 0;
  int streak = 0;
  List<String> unlockedIds = [];
  List<Map<String, dynamic>> unlockedAchievements = [];
  bool _achievementToastOpen = false;
  List<String> _previousUnlockedIds = [];

  final List<Map<String, dynamic>> allAchievements = [
    {
      "id": "first_xp",
      "title": "İlk XP",
      "subtitle": "25 XP'ye ulastin ve ilk ilerlemeni kaydettin.",
      "icon": Icons.bolt_rounded,
      "color": Color(0xFFFFB020),
      "type": "xp",
      "threshold": 25,
    },
    {
      "id": "quiz_starter",
      "title": "Quiz Başlangıç",
      "subtitle": "Yaklasik 3 quizlik ilerleme yakaladin.",
      "icon": Icons.quiz_rounded,
      "color": Color(0xFF2563EB),
      "type": "xp",
      "threshold": 100,
    },
    {
      "id": "quiz_master",
      "title": "Quiz Ustasi",
      "subtitle": "5+ quiz seviyesinde XP topladin.",
      "icon": Icons.emoji_events_rounded,
      "color": Color(0xFFFF7A00),
      "type": "xp",
      "threshold": 200,
    },
    {
      "id": "streak_3",
      "title": "Alev Serisi",
      "subtitle": "3 gün ust uste plan tamamladin.",
      "icon": Icons.local_fire_department_rounded,
      "color": Color(0xFFEF4444),
      "type": "streak",
      "threshold": 3,
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadAchievements();
  }

  @override
  void didUpdateWidget(covariant AchievementsWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshKey != widget.refreshKey) {
      _loadAchievements();
    }
  }

  Future<void> _loadAchievements() async {
    final progress = await StudentXpService.getProgress();
    final currentXp = progress.$1;
    final currentStreak = progress.$2;

    final currentUnlocked = allAchievements.where((achievement) {
      final type = achievement["type"] as String;
      final threshold = achievement["threshold"] as int;
      if (type == "xp") {
        return currentXp >= threshold;
      }
      return currentStreak >= threshold;
    }).toList();

    final newUnlocks = currentUnlocked
        .where(
          (achievement) => !_previousUnlockedIds.contains(achievement["id"]),
        )
        .toList();

    if (!mounted) return;

    setState(() {
      xp = currentXp;
      streak = currentStreak;
      unlockedIds = currentUnlocked
          .map((item) => item["id"] as String)
          .toList();
      unlockedAchievements = currentUnlocked;
    });
    _previousUnlockedIds = List<String>.from(unlockedIds);

    if (newUnlocks.isNotEmpty && mounted) {
      for (final achievement in newUnlocks) {
        await Future<void>.delayed(const Duration(milliseconds: 180));
        if (!mounted) return;
        if (_achievementToastOpen) continue;
        _showAchievementToast(achievement);
      }
    }
  }

  void _showAchievementToast(Map<String, dynamic> achievement) {
    _achievementToastOpen = true;
    final color = achievement["color"] as Color;
    final icon = achievement["icon"] as IconData;
    final title = achievement["title"] as String;
    final subtitle = achievement["subtitle"] as String;

    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) {
      _achievementToastOpen = false;
      return;
    }

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          elevation: 0,
          backgroundColor: Colors.transparent,
          duration: const Duration(milliseconds: 2600),
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          dismissDirection: DismissDirection.up,
          content: _AchievementSnackContent(
            color: color,
            icon: icon,
            title: title,
            subtitle: subtitle,
            xp: xp,
          ),
        ),
      ).closed.whenComplete(() {
        _achievementToastOpen = false;
      });
  }

  @override
  Widget build(BuildContext context) {
    final nextAchievement = allAchievements.firstWhere(
      (achievement) => !unlockedIds.contains(achievement["id"]),
      orElse: () => {
        "title": "Tüm Rozetler Açıldı",
        "subtitle": "Yeni hedefler için quiz ve planlara devam et.",
        "icon": Icons.workspace_premium_rounded,
        "color": const Color(0xFF10B981),
        "type": "xp",
        "threshold": xp,
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              "Başarılar",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const Spacer(),
            Text(
              "$xp XP • $streak gün seri",
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 168,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              ...unlockedAchievements.map((achievement) => _badge(achievement)),
              _nextBadge(nextAchievement),
            ],
          ),
        ),
      ],
    );
  }

  Widget _badge(Map<String, dynamic> achievement) {
    final color = achievement["color"] as Color;
    return Container(
      width: 210,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.18),
            color.withValues(alpha: 0.08),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: color,
            child: Icon(achievement["icon"] as IconData, color: Colors.white),
          ),
          const SizedBox(height: 14),
          Text(
            achievement["title"] as String,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            achievement["subtitle"] as String,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _nextBadge(Map<String, dynamic> achievement) {
    final color = achievement["color"] as Color;
    final threshold = achievement["threshold"] as int? ?? xp;
    final progress = threshold == 0 ? 1.0 : (xp / threshold).clamp(0.0, 1.0);

    return Container(
      width: 210,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.16),
            child: Icon(achievement["icon"] as IconData, color: color),
          ),
          const SizedBox(height: 14),
          Text(
            "Sıradaki Rozet",
            style: TextStyle(
              color: Colors.grey.shade700,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            achievement["title"] as String,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            threshold > 0 ? "$xp / $threshold XP" : "Tüm rözetler tamam",
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              return Align(
                alignment: Alignment.centerLeft,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOutCubic,
                  width: constraints.maxWidth * progress,
                  height: 10,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AchievementSnackContent extends StatefulWidget {
  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;
  final int xp;

  const _AchievementSnackContent({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.xp,
  });

  @override
  State<_AchievementSnackContent> createState() =>
      _AchievementSnackContentState();
}

class _AchievementSnackContentState extends State<_AchievementSnackContent>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..forward();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFCFCFD),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                AnimatedBuilder(
                  animation: _progressController,
                  builder: (context, child) {
                    return FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: 1 - _progressController.value,
                      child: Container(
                        height: 4,
                        decoration: BoxDecoration(
                          color: widget.color,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Stack(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: widget.color.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(widget.icon, color: widget.color, size: 28),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.95),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.white.withValues(alpha: 0.8),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Yeni başarı açıldı",
                        style: TextStyle(
                          color: widget.color,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.title,
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "${widget.xp} XP seviyesine ulastin",
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
