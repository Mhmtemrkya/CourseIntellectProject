// ─── Ders listesi (optik şablon, soru stüdyosu) ──────────────────────────────
// Ders adı serbest yazılmaz, bu listeden seçilir. Böylece aynı ders farklı yazımlarla
// ("Fen", "Fen Bil.") iki ayrı ders gibi görünmez ve konu analizinde tek yerde toplanır.
// Sunucudaki konu kataloğunun ders anahtarları bu adlarla birebir aynıdır (backend testi denetler).

export interface SubjectGroup { label: string; subjects: string[] }

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { label: 'Temel dersler (LGS ve TYT ortak)', subjects: ['Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Yabancı Dil (İngilizce)'] },
  { label: 'LGS', subjects: ['T.C. İnkılap Tarihi ve Atatürkçülük', 'Din Kültürü ve Ahlak Bilgisi'] },
  { label: 'TYT', subjects: ['Temel Matematik', 'Sosyal Bilimler'] },
  {
    label: 'AYT / YDT',
    subjects: ['Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu', 'Fizik', 'Kimya', 'Biyoloji', 'Yabancı Dil (YDT)'],
  },
  {
    label: 'Okul dersleri',
    subjects: [
      'Hayat Bilgisi', 'Geometri', 'Tarih', 'Coğrafya', 'Felsefe', 'Psikoloji', 'Sosyoloji', 'Mantık',
      'İngilizce', 'Almanca', 'Fransızca', 'Arapça', 'Peygamberimizin Hayatı', 'Kur’an-ı Kerim',
      'Bilişim Teknolojileri ve Yazılım', 'Teknoloji ve Tasarım', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi ve Spor', 'Sağlık Bilgisi',
    ],
  },
];

export const ALL_SUBJECTS: string[] = SUBJECT_GROUPS.flatMap((group) => group.subjects);

/** Henüz şablonda kullanılmayan ilk ders; hepsi kullanıldıysa boş. */
export function nextFreeSubject(used: readonly string[]): string {
  return ALL_SUBJECTS.find((subject) => !used.includes(subject)) ?? '';
}
