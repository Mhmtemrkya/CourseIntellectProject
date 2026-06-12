import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../widgets/badge_unlock_modal.dart';
import 'auth_session_store.dart';
import 'badge_catalog.dart';
import 'student_xp_service.dart';

/// Kullanıcının kutlaması gösterilmiş rozet sayısını cihazda saklar.
/// XP backend'de tutulduğu için rozet durumu platformlar arası senkrondur;
/// burada yalnızca "bu cihazda hangi kutlamalar gösterildi" bilgisi tutulur.
class BadgeProgressStore {
  static String _key(String username) =>
      'badge_seen_count_${username.toLowerCase()}';

  static Future<int> getSeenCount(String username) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_key(username)) ?? 0;
  }

  static Future<void> setSeenCount(String username, int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_key(username), count);
  }
}

/// XP değiştiğinde yeni açılan rozetleri tespit edip kutlama modalını açar.
class BadgeUnlockService {
  static bool _showing = false;

  /// [xp] verilmezse backend'den güncel XP çekilir. Yeni rozet açıldıysa
  /// animasyonlu kutlama modalı gösterilir ve görüldü sayacı güncellenir.
  static Future<void> checkAndCelebrate(BuildContext context, {int? xp}) async {
    if (_showing) return;
    final session = await AuthSessionStore.instance.load();
    if (session == null) return;

    int currentXp;
    try {
      currentXp = xp ?? await StudentXpService.getXp();
    } catch (_) {
      return;
    }

    final unlocked = BadgeCatalog.unlockedCount(currentXp);
    final seen = await BadgeProgressStore.getSeenCount(session.username);
    if (unlocked <= seen) return;

    final newBadges = BadgeCatalog.all.sublist(seen, unlocked);
    await BadgeProgressStore.setSeenCount(session.username, unlocked);

    if (!context.mounted) return;
    _showing = true;
    try {
      await showBadgeUnlockModal(context, newBadges);
    } finally {
      _showing = false;
    }
  }
}
