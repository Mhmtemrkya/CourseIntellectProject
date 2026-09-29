// Kayıt ekranlarında meslek seçimi için ortak liste. Türkçe alfabetik sıralanır ve
// "Öğrenci" de dahil tüm yaygın meslekleri kapsar. Listede olmayan meslekler için
// "Diğer" seçilir ve serbest metin girilir. Tek kaynak: hem sürücü kursu kayıt
// sihirbazı hem de kursiyer düzenleme ekranı buradan okur.

export const OTHER_PROFESSION = 'Diğer';

const RAW_PROFESSIONS = [
  'Öğrenci', 'Öğretmen', 'Akademisyen', 'Doktor', 'Hemşire', 'Ebe', 'Sağlık teknisyeni',
  'Fizyoterapist', 'Diyetisyen', 'Psikolog', 'Eczacı', 'Diş hekimi', 'Veteriner',
  'Mühendis', 'Makine mühendisi', 'Elektrik-elektronik mühendisi', 'İnşaat mühendisi',
  'Bilgisayar mühendisi', 'Endüstri mühendisi', 'Ziraat mühendisi', 'Harita mühendisi',
  'Mimar', 'İç mimar', 'Şehir plancısı', 'Tekniker', 'Teknisyen',
  'Yazılım geliştirici', 'Bilgisayar programcısı', 'Grafik tasarımcı', 'Web tasarımcı',
  'Avukat', 'Hakim', 'Savcı', 'Noter', 'Muhasebeci', 'Mali müşavir', 'Bankacı',
  'Sigortacı', 'Borsa/finans uzmanı', 'İnsan kaynakları uzmanı', 'Yönetici', 'Müdür',
  'Memur', 'Sekreter', 'Sağlık memuru', 'Din görevlisi', 'Sosyal hizmet uzmanı',
  'Polis', 'Asker', 'İtfaiyeci', 'Güvenlik görevlisi', 'Zabıta',
  'Pilot', 'Kabin memuru', 'Kaptan', 'Denizci', 'Şoför', 'Kaptan şoför', 'Kurye',
  'Esnaf', 'Tüccar', 'Satış temsilcisi', 'Pazarlamacı', 'Emlakçı', 'Bakkal', 'Manav',
  'Kasap', 'Fırıncı', 'Aşçı', 'Garson', 'Barista', 'Otelci', 'Turizm rehberi',
  'Çiftçi', 'Hayvancılık', 'Bahçıvan', 'Balıkçı', 'Ormancı',
  'İşçi', 'İnşaat işçisi', 'İnşaat ustası', 'Marangoz', 'Mobilyacı', 'Elektrikçi',
  'Tesisatçı', 'Sıhhi tesisatçı', 'Kaynakçı', 'Tornacı', 'Boyacı', 'Sıvacı',
  'Fayansçı', 'Cam ustası', 'Oto tamircisi', 'Oto elektrikçisi', 'Lastikçi',
  'Terzi', 'Kuaför', 'Berber', 'Güzellik uzmanı', 'Manikürcü',
  'Gazeteci', 'Fotoğrafçı', 'Kameraman', 'Editör', 'Yazar', 'Çevirmen',
  'Sanatçı', 'Müzisyen', 'Ressam', 'Oyuncu', 'Sporcu', 'Antrenör',
  'Temizlik görevlisi', 'Bakıcı', 'Çocuk bakıcısı', 'Aşçı yardımcısı',
  'Ev hanımı', 'Emekli', 'İşsiz', 'Serbest meslek',
];

// Türkçe alfabetik sırala; "Öğrenci" listede kalır, "Diğer" her zaman en sonda gösterilir.
export const PROFESSIONS = [...new Set(RAW_PROFESSIONS)]
  .sort((a, b) => a.localeCompare(b, 'tr'))
  .concat(OTHER_PROFESSION);
