import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/student_xp_service.dart';

class HeaderWidget extends StatefulWidget {
  const HeaderWidget({super.key});

  @override
  State<HeaderWidget> createState() => _HeaderWidgetState();
}

class _HeaderWidgetState extends State<HeaderWidget> {
  int xp = 0;
  String firstName = 'Öğrenci';

  @override
  void initState() {
    super.initState();
    _loadXp();
  }

  @override
  void didUpdateWidget(covariant HeaderWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    _loadXp();
  }

  Future<void> _loadXp() async {
    final session = await AuthSessionStore.instance.load();
    final currentXp = await StudentXpService.getXp();
    if (!mounted) return;
    setState(() {
      xp = currentXp;
      firstName = (session?.fullName.split(' ').firstOrNull ?? 'Öğrenci')
          .trim();
    });
  }

  @override
  Widget build(BuildContext context) {
    final level = (xp ~/ 100) + 1;
    final levelBase = (level - 1) * 100;
    final progressInLevel = ((xp - levelBase) / 100).clamp(0.0, 1.0);
    final greeting = _greetingByHour();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "👋 $greeting, $firstName!",
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        Text(
          "Bugün harika şeyler öğrenmeye hazır mısın?",
          style: TextStyle(color: Colors.grey.shade500),
        ),
        const SizedBox(height: 12),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: progressInLevel),
          duration: const Duration(seconds: 1),
          builder: (context, value, _) => ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: LinearProgressIndicator(value: value, minHeight: 12),
          ),
        ),
        const SizedBox(height: 6),
        Text("Seviye $level • $xp XP"),
      ],
    );
  }

  String _greetingByHour() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) {
      return 'Günaydın';
    }
    if (hour >= 12 && hour < 18) {
      return 'İyi Günler';
    }
    if (hour >= 18 && hour < 22) {
      return 'Iyi Aksamlar';
    }
    return 'İyi Geceler';
  }
}
