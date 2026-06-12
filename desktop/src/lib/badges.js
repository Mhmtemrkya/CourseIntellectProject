// 300 başarı rozeti kataloğu.
//
// 10 kategori x 30 rozet. Rozetler XP kazanım durumuna göre sırayla açılır:
// n. rozetin eşiği `25n + 0.75n²` (5'e yuvarlanır). XP backend'de tutulduğu
// için mobil ve desktop aynı kataloğu kullanarak senkron çalışır.
// NOT: Bu katalog mobile/lib/services/badge_catalog.dart ile birebir aynıdır;
// birini değiştirirsen diğerini de güncelle.

export const BADGE_TOTAL = 300;
export const BADGES_PER_CATEGORY = 30;

export const BADGE_CATEGORIES = [
  { id: 'akademik', name: 'Akademik', color: '#3B82F6', icon: 'GraduationCap' },
  { id: 'odev', name: 'Ödev', color: '#22C55E', icon: 'ClipboardCheck' },
  { id: 'sureklilik', name: 'Süreklilik', color: '#F59E0B', icon: 'Flame' },
  { id: 'performans', name: 'Performans', color: '#A855F7', icon: 'TrendingUp' },
  { id: 'kesif', name: 'Keşif', color: '#06B6D4', icon: 'Compass' },
  { id: 'sosyal', name: 'Sosyal', color: '#EC4899', icon: 'Users' },
  { id: 'ozel', name: 'Özel', color: '#F97316', icon: 'Crown' },
  { id: 'etkinlik', name: 'Etkinlik', color: '#EF4444', icon: 'Trophy' },
  { id: 'genel', name: 'Genel', color: '#2563EB', icon: 'Star' },
  { id: 'zirve', name: 'Zirve', color: '#EAB308', icon: 'Medal' },
];

const BADGE_NAMES = {
  akademik: [
    'İlk Adım', 'Meraklı', 'Öğrenmeye Aç', 'Keşifçi', 'Dikkatli',
    'Planlı', 'Düzenli', 'Disiplinli', 'Azimli', 'Kararlı',
    'Çalışkan', 'Bilgi Avcısı', 'Analitik Zihin', 'Problem Çözücü',
    'Mantıklı', 'Yaratıcı', 'Çözüm Üretici', 'Hızlı Kavrayıcı',
    'Uzman Adayı', 'Üst Düzey', 'Akademisyen', 'Zirve', 'Efsane',
    'Bilge', 'Usta', 'Akademi Yıldızı', 'Akademi Onuru',
    'Akademi Kralı', 'Akademi İmparatoru', 'Akademi Şampiyonu',
  ],
  odev: [
    'İlk Ödevim', 'Sorumluluk', 'Ödev Avcısı', 'Planlayıcı', 'Zamanında',
    'Düzenli Teslim', 'Titiz', 'Detaycı', 'Odaklı', 'Araştırmacı',
    'Not Tutucu', 'Kaynakçı', 'Hazırlıklı', 'Çözüm Odaklı',
    'Yaratıcı Çözüm', 'Mükemmeliyetçi', 'Üstün Çalışkan',
    'Yüksek Performans', 'Ödev Şampiyonu', 'Ödev Lideri', 'Ödev Kralı',
    'Ödev Efsanesi', 'Ödev Bilgesi', 'Ödev Ustası', 'Görev Bilinci',
    'Görev Uzmanı', 'Görev Şampiyonu', 'Görev Kralı',
    'Görev İmparatoru', 'Görev Efsanesi',
  ],
  sureklilik: [
    'İlk Gün', '3 Gün', '7 Gün', '14 Gün', '21 Gün', '30 Gün', '45 Gün',
    '60 Gün', '75 Gün', '100 Gün', '150 Gün', '250 Gün', '300 Gün',
    '365 Gün', 'Alışkanlık', 'Haftalık Kahraman', 'Ayın Yıldızı',
    'Sadık Öğrenci', 'Motivasyon', 'İstikrar', 'Disiplin Gücü',
    'Süreklilik Yıldızı', 'Azim Ustası', 'Azim Şampiyonu',
    'Kararlılık Abidesi', 'Süreklilik Bilgesi', 'Süreklilik Ustası',
    'Süreklilik Kralı', 'Süreklilik İmparatoru', 'Süreklilik Efsanesi',
  ],
  performans: [
    'İlk Doğru', '5 Doğru', '10 Doğru', '25 Doğru', '50 Doğru',
    '100 Doğru', '250 Doğru', '500 Doğru', '1000 Doğru', 'Hatasız',
    'Yüksek Skor', 'Mükemmel', 'Sınav Ustası', 'Deneme Şampiyonu',
    'Net Uzmanı', 'Zaman Ustası', 'Konsantrasyon', 'Performans Canavarı',
    'Skor Avcısı', 'Rekorcu', 'Yıldız Performans', 'Üstün Zihin',
    'Zeka Küpü', 'Beyin Fırtınası', 'Dahi', 'Zirve Performans',
    'Performans Kralı', 'Performans Bilgesi', 'Performans İmparatoru',
    'Performans Efsanesi',
  ],
  kesif: [
    'İlk Keşif', 'Meraklı Gezgin', 'Yeni Başlayan', 'Konu Kaşifi',
    'Bilgi Kaşifi', 'Kaynak Avcısı', 'İçerik Gezgini', 'Video İzleyici',
    'Makale Okuyucu', 'Podcast Dinleyici', 'Soru Kaşifi', 'Fikir Üretici',
    'Deneysel', 'Analizci', 'Keşif Ustası', 'Bilgi Toplayıcı',
    'Kütüphane Canavarı', 'İçerik Şampiyonu', 'Keşif Lideri',
    'Bilgi Avcısı', 'Merak Ustası', 'Keşif Yıldızı', 'Zihin Gezgini',
    'Öğrenme Gezgini', 'Keşif Bilgesi', 'Keşif Kralı', 'Keşif Şampiyonu',
    'Keşif Onuru', 'Keşif İmparatoru', 'Keşif Efsanesi',
  ],
  sosyal: [
    'İlk Paylaşım', 'Yardımsever', 'Destekçi', 'Takım Oyuncusu',
    'Arkadaş Canlısı', 'Grup Çalışanı', 'Yorum Yazan', 'Beğeni Ustası',
    'Topluluk Üyesi', 'Sohbetçi', 'Motivasyon Kaynağı',
    'Bilgi Paylaşımcısı', 'Rehber', 'Lider Ruh', 'İlham Veren',
    'Topluluk Lideri', 'Sosyal Kelebek', 'Sosyal Kahraman',
    'İletişim Ustası', 'Takım Lideri', 'Topluluk Yıldızı',
    'Sosyal Şampiyon', 'İtibarlı Üye', 'Sosyal Bilge', 'Topluluk Ustası',
    'Sosyal Kral', 'Topluluk Kralı', 'Sosyal İmparator', 'Topluluk Onuru',
    'Topluluk Efsanesi',
  ],
  ozel: [
    'Doğum Günü', 'Quiz Ustası', 'Etkinlik Katılımcısı', 'Yarışmacı',
    'İlk Etkinlik', 'Canlı Ders Katılımcısı', 'Soru Yazan',
    'İçerik Üretici', 'Beta Testçi', 'Geri Bildirimci', 'Elmas Üye',
    'VIP Üye', 'Sadakat Üyesi', 'Premium', 'Erken Erişim', 'Rozet Avcısı',
    'Koleksiyoncu', 'Her Yerde Hazır', 'Süper Kullanıcı', 'Efsane Üye',
    'Platin Üye', 'Altın Üye', 'Gümüş Üye', 'Bronz Üye', 'Özel Davetli',
    'Kurucu Üye', 'Özel Yıldız', 'Özel Şampiyon', 'Kurucu Katılımcı',
    'Efsane Koleksiyoncu',
  ],
  etkinlik: [
    'İlk Katılım', 'Maratoncu', 'Sınav Maratonu', 'Çözüm Maratonu',
    'Hafta Sonu Savaşçısı', 'Kamp Katılımcısı', 'Turnuva Oyuncusu',
    'Zorlu Görev', '30 Dakika Şampiyonu', '1 Saatlik Savaşçı',
    '3 Saatlik Odak', '5 Saatlik Odak', 'Günlük Görevci',
    'Haftalık Görevci', 'Aylık Görevci', 'Zirveye Yarışan',
    'Etkinlik Ustası', 'Turnuva Şampiyonu', 'Lider Tablosu',
    'Zirveye Tırmanan', 'Etkinlik Yıldızı', 'Etkinlik Şampiyonu',
    'Altın Şampiyon', 'Altın Yarışmacı', 'Turnuva Kralı',
    'Etkinlik Kralı', 'Etkinlik Bilgesi', 'Etkinlik Onuru',
    'Turnuva Efsanesi', 'Etkinlik Efsanesi',
  ],
  genel: [
    'İlk Rozet', 'Rozet Meraklısı', 'Hedef Belirleyen', 'Hedefe Odaklı',
    'Planlı Öğrenci', 'Başlangıç', 'Yükseliş', 'Gelişim', 'İlerleyen',
    'Uzmanlaşan', 'Seviye Atlayan', 'Usta Adayı', 'Bilgelik Yolcusu',
    'Mükemmellik', 'Akademik Güç', 'Bilginin Gücü', 'Zirve Yolcusu',
    'Bilgi Ustası', 'Zirve Adayı', 'Bilgeler Arasında', 'Onur Listesi',
    'Mükemmel Öğrenci', 'Genel Yıldız', 'Genel Şampiyon', 'Genel Bilge',
    'Genel Usta', 'Genel Kral', 'Genel Onur', 'Zirve Bilgesi',
    'Zirve Efsanesi',
  ],
  zirve: [
    'Efsaneler Kulübü', 'Zirve Kulübü', 'Akademi Onuru', 'Bilgelik Tacı',
    'Efsane Taç', 'Zirve Tacı', 'İmparator', 'Bilgelik İmparatoru',
    'Akademi İmparatoru', 'Zirve İmparatoru', 'Eğitimin Efendisi',
    'Bilginin Efendisi', 'Akademi Efendisi', 'Zirvenin Efendisi',
    'Bilgelik Efsanesi', 'Akademik Zafer', 'Bilginin Zaferi',
    'Zirve Gücü', 'Zirve Yolculuğu', 'Dünyanın En İyisi',
    'Zamanların En İyisi', 'Eğitimin En İyisi', 'Bilgelik Kralı',
    'Akademi Kralı', 'Efsanevi Kral', 'Efsanevi Onur', 'Eğitimin Onuru',
    'Bilginin Onuru', 'Zirvenin Onuru', 'Zirve Efsanesi',
  ],
};

// n. rozetin XP eşiği (5'e yuvarlanmış `25n + 0.75n²`).
export function badgeXpThreshold(n) {
  return Math.round((25 * n + 0.75 * n * n) / 5) * 5;
}

let cachedBadges = null;

// XP eşiğine göre artan sırada 300 rozetin tamamı.
export function getAllBadges() {
  if (cachedBadges) return cachedBadges;
  const list = [];
  for (let n = 1; n <= BADGE_TOTAL; n += 1) {
    const category = BADGE_CATEGORIES[Math.floor((n - 1) / BADGES_PER_CATEGORY)];
    const tier = (n - 1) % BADGES_PER_CATEGORY;
    list.push({
      id: n,
      code: String(n).padStart(3, '0'),
      name: BADGE_NAMES[category.id][tier],
      category,
      tier,
      xpThreshold: badgeXpThreshold(n),
    });
  }
  cachedBadges = list;
  return list;
}

// Verilen XP ile açılmış rozet sayısı (rozetler sıralı açılır).
export function unlockedBadgeCount(xp) {
  const value = Number(xp) || 0;
  let low = 0;
  let high = BADGE_TOTAL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (badgeXpThreshold(mid) <= value) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

// Açılacak bir sonraki rozet; hepsi açıldıysa null.
export function nextBadge(xp) {
  const count = unlockedBadgeCount(xp);
  return count >= BADGE_TOTAL ? null : getAllBadges()[count];
}

function seenKey(user) {
  const id = (user?.username || user?.email || user?.name || 'ogrenci')
    .toString()
    .toLowerCase();
  return `badgeSeenCount:${id}`;
}

export function getSeenBadgeCount(user) {
  try {
    return Number(localStorage.getItem(seenKey(user))) || 0;
  } catch {
    return 0;
  }
}

export function setSeenBadgeCount(user, count) {
  try {
    localStorage.setItem(seenKey(user), String(count));
  } catch {
    // localStorage erişilemiyorsa kutlama bir sonraki oturumda tekrarlanır.
  }
}

// XP değiştiğinde yeni açılan rozetleri döndürür ve görüldü sayacını günceller.
// Kutlaması gösterilecek rozet yoksa boş dizi döner.
export function collectNewBadges(xp, user) {
  const unlocked = unlockedBadgeCount(xp);
  const seen = getSeenBadgeCount(user);
  if (unlocked <= seen) return [];
  setSeenBadgeCount(user, unlocked);
  return getAllBadges().slice(seen, unlocked);
}
