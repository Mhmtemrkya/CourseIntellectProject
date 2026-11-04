// Ders listesi: optik şablon ve soru stüdyosu (masaüstü subjectCatalog.ts ile aynı). Ders adı serbest
// yazılmaz, listeden seçilir; aynı ders farklı yazımlarla iki ayrı ders gibi görünmez.

const subjectGroups = <(String, List<String>)>[
  ('Temel dersler (LGS ve TYT ortak)', ['Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Yabancı Dil (İngilizce)']),
  ('LGS', ['T.C. İnkılap Tarihi ve Atatürkçülük', 'Din Kültürü ve Ahlak Bilgisi']),
  ('TYT', ['Temel Matematik', 'Sosyal Bilimler']),
  ('AYT / YDT', ['Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu', 'Fizik', 'Kimya', 'Biyoloji', 'Yabancı Dil (YDT)']),
  (
    'Okul dersleri',
    [
      'Hayat Bilgisi', 'Geometri', 'Tarih', 'Coğrafya', 'Felsefe', 'Psikoloji', 'Sosyoloji', 'Mantık', //
      'İngilizce', 'Almanca', 'Fransızca', 'Arapça', 'Peygamberimizin Hayatı', 'Kur’an-ı Kerim', //
      'Bilişim Teknolojileri ve Yazılım', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi ve Spor', 'Sağlık Bilgisi',
    ]
  ),
];

final allSubjects = [for (final group in subjectGroups) ...group.$2];

/// Henüz şablonda kullanılmayan ilk ders; hepsi kullanıldıysa boş.
String nextFreeSubject(Iterable<String> used) => allSubjects.firstWhere((subject) => !used.contains(subject), orElse: () => '');
