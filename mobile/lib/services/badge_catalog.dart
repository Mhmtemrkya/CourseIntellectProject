import 'package:flutter/material.dart';

/// 300 başarı rozeti kataloğu.
///
/// 10 kategori x 30 rozet. Rozetler XP kazanım durumuna göre sırayla açılır:
/// n. rozetin eşiği `25n + 0.75n²` (5'e yuvarlanır). XP backend'de tutulduğu
/// için mobil ve desktop aynı kataloğu kullanarak senkron çalışır.
class BadgeCategory {
  final String id;
  final String name;
  final Color color;
  final IconData icon;

  const BadgeCategory({
    required this.id,
    required this.name,
    required this.color,
    required this.icon,
  });
}

class BadgeRecord {
  /// 1..300 arası küresel sıra numarası.
  final int id;
  final String name;
  final BadgeCategory category;
  final int xpThreshold;

  /// Kategori içi kademe (0..29) — görsel parlaklık/derece için.
  final int tier;

  const BadgeRecord({
    required this.id,
    required this.name,
    required this.category,
    required this.xpThreshold,
    required this.tier,
  });

  String get code => id.toString().padLeft(3, '0');
}

class BadgeCatalog {
  static const int total = 300;
  static const int perCategory = 30;

  static const List<BadgeCategory> categories = [
    BadgeCategory(
      id: 'akademik',
      name: 'Akademik',
      color: Color(0xFF3B82F6),
      icon: Icons.school_rounded,
    ),
    BadgeCategory(
      id: 'odev',
      name: 'Ödev',
      color: Color(0xFF22C55E),
      icon: Icons.assignment_turned_in_rounded,
    ),
    BadgeCategory(
      id: 'sureklilik',
      name: 'Süreklilik',
      color: Color(0xFFF59E0B),
      icon: Icons.local_fire_department_rounded,
    ),
    BadgeCategory(
      id: 'performans',
      name: 'Performans',
      color: Color(0xFFA855F7),
      icon: Icons.insights_rounded,
    ),
    BadgeCategory(
      id: 'kesif',
      name: 'Keşif',
      color: Color(0xFF06B6D4),
      icon: Icons.explore_rounded,
    ),
    BadgeCategory(
      id: 'sosyal',
      name: 'Sosyal',
      color: Color(0xFFEC4899),
      icon: Icons.groups_rounded,
    ),
    BadgeCategory(
      id: 'ozel',
      name: 'Özel',
      color: Color(0xFFF97316),
      icon: Icons.workspace_premium_rounded,
    ),
    BadgeCategory(
      id: 'etkinlik',
      name: 'Etkinlik',
      color: Color(0xFFEF4444),
      icon: Icons.emoji_events_rounded,
    ),
    BadgeCategory(
      id: 'genel',
      name: 'Genel',
      color: Color(0xFF2563EB),
      icon: Icons.star_rounded,
    ),
    BadgeCategory(
      id: 'zirve',
      name: 'Zirve',
      color: Color(0xFFEAB308),
      icon: Icons.military_tech_rounded,
    ),
  ];

  static const Map<String, List<String>> _names = {
    'akademik': [
      'İlk Adım',
      'Meraklı',
      'Öğrenmeye Aç',
      'Keşifçi',
      'Dikkatli',
      'Planlı',
      'Düzenli',
      'Disiplinli',
      'Azimli',
      'Kararlı',
      'Çalışkan',
      'Bilgi Avcısı',
      'Analitik Zihin',
      'Problem Çözücü',
      'Mantıklı',
      'Yaratıcı',
      'Çözüm Üretici',
      'Hızlı Kavrayıcı',
      'Uzman Adayı',
      'Üst Düzey',
      'Akademisyen',
      'Zirve',
      'Efsane',
      'Bilge',
      'Usta',
      'Akademi Yıldızı',
      'Akademi Onuru',
      'Akademi Kralı',
      'Akademi İmparatoru',
      'Akademi Şampiyonu',
    ],
    'odev': [
      'İlk Ödevim',
      'Sorumluluk',
      'Ödev Avcısı',
      'Planlayıcı',
      'Zamanında',
      'Düzenli Teslim',
      'Titiz',
      'Detaycı',
      'Odaklı',
      'Araştırmacı',
      'Not Tutucu',
      'Kaynakçı',
      'Hazırlıklı',
      'Çözüm Odaklı',
      'Yaratıcı Çözüm',
      'Mükemmeliyetçi',
      'Üstün Çalışkan',
      'Yüksek Performans',
      'Ödev Şampiyonu',
      'Ödev Lideri',
      'Ödev Kralı',
      'Ödev Efsanesi',
      'Ödev Bilgesi',
      'Ödev Ustası',
      'Görev Bilinci',
      'Görev Uzmanı',
      'Görev Şampiyonu',
      'Görev Kralı',
      'Görev İmparatoru',
      'Görev Efsanesi',
    ],
    'sureklilik': [
      'İlk Gün',
      '3 Gün',
      '7 Gün',
      '14 Gün',
      '21 Gün',
      '30 Gün',
      '45 Gün',
      '60 Gün',
      '75 Gün',
      '100 Gün',
      '150 Gün',
      '250 Gün',
      '300 Gün',
      '365 Gün',
      'Alışkanlık',
      'Haftalık Kahraman',
      'Ayın Yıldızı',
      'Sadık Öğrenci',
      'Motivasyon',
      'İstikrar',
      'Disiplin Gücü',
      'Süreklilik Yıldızı',
      'Azim Ustası',
      'Azim Şampiyonu',
      'Kararlılık Abidesi',
      'Süreklilik Bilgesi',
      'Süreklilik Ustası',
      'Süreklilik Kralı',
      'Süreklilik İmparatoru',
      'Süreklilik Efsanesi',
    ],
    'performans': [
      'İlk Doğru',
      '5 Doğru',
      '10 Doğru',
      '25 Doğru',
      '50 Doğru',
      '100 Doğru',
      '250 Doğru',
      '500 Doğru',
      '1000 Doğru',
      'Hatasız',
      'Yüksek Skor',
      'Mükemmel',
      'Sınav Ustası',
      'Deneme Şampiyonu',
      'Net Uzmanı',
      'Zaman Ustası',
      'Konsantrasyon',
      'Performans Canavarı',
      'Skor Avcısı',
      'Rekorcu',
      'Yıldız Performans',
      'Üstün Zihin',
      'Zeka Küpü',
      'Beyin Fırtınası',
      'Dahi',
      'Zirve Performans',
      'Performans Kralı',
      'Performans Bilgesi',
      'Performans İmparatoru',
      'Performans Efsanesi',
    ],
    'kesif': [
      'İlk Keşif',
      'Meraklı Gezgin',
      'Yeni Başlayan',
      'Konu Kaşifi',
      'Bilgi Kaşifi',
      'Kaynak Avcısı',
      'İçerik Gezgini',
      'Video İzleyici',
      'Makale Okuyucu',
      'Podcast Dinleyici',
      'Soru Kaşifi',
      'Fikir Üretici',
      'Deneysel',
      'Analizci',
      'Keşif Ustası',
      'Bilgi Toplayıcı',
      'Kütüphane Canavarı',
      'İçerik Şampiyonu',
      'Keşif Lideri',
      'Bilgi Avcısı',
      'Merak Ustası',
      'Keşif Yıldızı',
      'Zihin Gezgini',
      'Öğrenme Gezgini',
      'Keşif Bilgesi',
      'Keşif Kralı',
      'Keşif Şampiyonu',
      'Keşif Onuru',
      'Keşif İmparatoru',
      'Keşif Efsanesi',
    ],
    'sosyal': [
      'İlk Paylaşım',
      'Yardımsever',
      'Destekçi',
      'Takım Oyuncusu',
      'Arkadaş Canlısı',
      'Grup Çalışanı',
      'Yorum Yazan',
      'Beğeni Ustası',
      'Topluluk Üyesi',
      'Sohbetçi',
      'Motivasyon Kaynağı',
      'Bilgi Paylaşımcısı',
      'Rehber',
      'Lider Ruh',
      'İlham Veren',
      'Topluluk Lideri',
      'Sosyal Kelebek',
      'Sosyal Kahraman',
      'İletişim Ustası',
      'Takım Lideri',
      'Topluluk Yıldızı',
      'Sosyal Şampiyon',
      'İtibarlı Üye',
      'Sosyal Bilge',
      'Topluluk Ustası',
      'Sosyal Kral',
      'Topluluk Kralı',
      'Sosyal İmparator',
      'Topluluk Onuru',
      'Topluluk Efsanesi',
    ],
    'ozel': [
      'Doğum Günü',
      'Quiz Ustası',
      'Etkinlik Katılımcısı',
      'Yarışmacı',
      'İlk Etkinlik',
      'Canlı Ders Katılımcısı',
      'Soru Yazan',
      'İçerik Üretici',
      'Beta Testçi',
      'Geri Bildirimci',
      'Elmas Üye',
      'VIP Üye',
      'Sadakat Üyesi',
      'Premium',
      'Erken Erişim',
      'Rozet Avcısı',
      'Koleksiyoncu',
      'Her Yerde Hazır',
      'Süper Kullanıcı',
      'Efsane Üye',
      'Platin Üye',
      'Altın Üye',
      'Gümüş Üye',
      'Bronz Üye',
      'Özel Davetli',
      'Kurucu Üye',
      'Özel Yıldız',
      'Özel Şampiyon',
      'Kurucu Katılımcı',
      'Efsane Koleksiyoncu',
    ],
    'etkinlik': [
      'İlk Katılım',
      'Maratoncu',
      'Sınav Maratonu',
      'Çözüm Maratonu',
      'Hafta Sonu Savaşçısı',
      'Kamp Katılımcısı',
      'Turnuva Oyuncusu',
      'Zorlu Görev',
      '30 Dakika Şampiyonu',
      '1 Saatlik Savaşçı',
      '3 Saatlik Odak',
      '5 Saatlik Odak',
      'Günlük Görevci',
      'Haftalık Görevci',
      'Aylık Görevci',
      'Zirveye Yarışan',
      'Etkinlik Ustası',
      'Turnuva Şampiyonu',
      'Lider Tablosu',
      'Zirveye Tırmanan',
      'Etkinlik Yıldızı',
      'Etkinlik Şampiyonu',
      'Altın Şampiyon',
      'Altın Yarışmacı',
      'Turnuva Kralı',
      'Etkinlik Kralı',
      'Etkinlik Bilgesi',
      'Etkinlik Onuru',
      'Turnuva Efsanesi',
      'Etkinlik Efsanesi',
    ],
    'genel': [
      'İlk Rozet',
      'Rozet Meraklısı',
      'Hedef Belirleyen',
      'Hedefe Odaklı',
      'Planlı Öğrenci',
      'Başlangıç',
      'Yükseliş',
      'Gelişim',
      'İlerleyen',
      'Uzmanlaşan',
      'Seviye Atlayan',
      'Usta Adayı',
      'Bilgelik Yolcusu',
      'Mükemmellik',
      'Akademik Güç',
      'Bilginin Gücü',
      'Zirve Yolcusu',
      'Bilgi Ustası',
      'Zirve Adayı',
      'Bilgeler Arasında',
      'Onur Listesi',
      'Mükemmel Öğrenci',
      'Genel Yıldız',
      'Genel Şampiyon',
      'Genel Bilge',
      'Genel Usta',
      'Genel Kral',
      'Genel Onur',
      'Zirve Bilgesi',
      'Zirve Efsanesi',
    ],
    'zirve': [
      'Efsaneler Kulübü',
      'Zirve Kulübü',
      'Akademi Onuru',
      'Bilgelik Tacı',
      'Efsane Taç',
      'Zirve Tacı',
      'İmparator',
      'Bilgelik İmparatoru',
      'Akademi İmparatoru',
      'Zirve İmparatoru',
      'Eğitimin Efendisi',
      'Bilginin Efendisi',
      'Akademi Efendisi',
      'Zirvenin Efendisi',
      'Bilgelik Efsanesi',
      'Akademik Zafer',
      'Bilginin Zaferi',
      'Zirve Gücü',
      'Zirve Yolculuğu',
      'Dünyanın En İyisi',
      'Zamanların En İyisi',
      'Eğitimin En İyisi',
      'Bilgelik Kralı',
      'Akademi Kralı',
      'Efsanevi Kral',
      'Efsanevi Onur',
      'Eğitimin Onuru',
      'Bilginin Onuru',
      'Zirvenin Onuru',
      'Zirve Efsanesi',
    ],
  };

  static List<BadgeRecord>? _cache;

  /// XP eşiğine göre artan sırada 300 rozetin tamamı.
  static List<BadgeRecord> get all {
    final cached = _cache;
    if (cached != null) return cached;
    final list = <BadgeRecord>[];
    for (var n = 1; n <= total; n++) {
      final category = categories[(n - 1) ~/ perCategory];
      final tier = (n - 1) % perCategory;
      list.add(
        BadgeRecord(
          id: n,
          name: _names[category.id]![tier],
          category: category,
          xpThreshold: xpThresholdFor(n),
          tier: tier,
        ),
      );
    }
    _cache = List.unmodifiable(list);
    return _cache!;
  }

  /// n. rozetin XP eşiği (5'e yuvarlanmış `25n + 0.75n²`).
  static int xpThresholdFor(int n) {
    final raw = 25 * n + 0.75 * n * n;
    return (raw / 5).round() * 5;
  }

  /// Verilen XP ile açılmış rozet sayısı (rozetler sıralı açılır).
  static int unlockedCount(int xp) {
    var low = 0;
    var high = total;
    while (low < high) {
      final mid = (low + high + 1) ~/ 2;
      if (xpThresholdFor(mid) <= xp) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /// Açılacak bir sonraki rozet; hepsi açıldıysa null.
  static BadgeRecord? nextBadge(int xp) {
    final count = unlockedCount(xp);
    return count >= total ? null : all[count];
  }

  static List<BadgeRecord> badgesForCategory(BadgeCategory category) {
    return all
        .where((badge) => badge.category.id == category.id)
        .toList(growable: false);
  }
}
