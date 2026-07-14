/// Rol + sekme bazlı onboarding içerik kataloğu (TR).
///
/// - [roleIntro]: karşılama karuselinin ilk kartı (role özel hoş geldin metni).
/// - [tabDetail]: sekme bazlı detaylı anlatım — hem karşılama karuselindeki
///   sekme kartlarında hem de sekmeye ilk geçişte açılan tanıtım sheet'inde
///   kullanılır. Anahtar: rol etiketi → sekme etiketi (TR).
library;

class RoleIntro {
  final String title;
  final String body;

  const RoleIntro({required this.title, required this.body});
}

const Map<String, RoleIntro> roleIntros = {
  'Yönetici': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Kurum yönetim uygulamanıza hoş geldiniz. Alttaki sekmelerle panel, '
        'akademik işler, finans, operasyon ve raporlar arasında gezinirsiniz.\n\n'
        'Bu kısa tanıtım her sekmenin ne işe yaradığını gösterir. Ayrıca her '
        'sekmeye ilk geçişinizde o bölümün kısa açıklaması otomatik açılır.\n\n'
        'İpucu: Alt menüye uzun basarak bulunduğunuz sekmenin tanıtımını '
        'istediğiniz zaman yeniden açabilirsiniz.',
  ),
  'Öğrenci': RoleIntro(
    title: 'Hoş geldin! 🎓',
    body:
        'Öğrenci uygulamana hoş geldin. Derslerin, sınavların, rehberlik ve '
        'mesajların alttaki sekmelerde.\n\nBu kısa tanıtım sana her sekmenin ne '
        'işe yaradığını gösterecek. Alt menüye uzun basarsan bulunduğun '
        'sekmenin tanıtımını tekrar açabilirsin.',
  ),
  'Öğretmen': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Öğretmen uygulamanıza hoş geldiniz. Program, onaylar, görevler ve '
        'mesajlaşma alttaki sekmelerde.\n\nHer sekmeye ilk geçişinizde kısa bir '
        'tanıtım açılır; alt menüye uzun basarak tekrar izleyebilirsiniz.',
  ),
  'Veli': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Veli uygulamanıza hoş geldiniz. Çocuğunuzun devamsızlığı, duyurular, '
        'ödemeler ve okulla mesajlaşmanız alttaki sekmelerde.\n\nHer sekmeye ilk '
        'geçişinizde kısa bir tanıtım açılır; alt menüye uzun basarak tekrar '
        'izleyebilirsiniz.',
  ),
  'Muhasebeci': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Muhasebe uygulamanıza hoş geldiniz. Tahsilatlar, taksitler, defter ve '
        'dışa aktarma araçları alttaki sekmelerde.\n\nHer sekmeye ilk geçişte '
        'kısa bir tanıtım açılır; alt menüye uzun basarak tekrar izleyebilirsiniz.',
  ),
  'İdari Birimler': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'İdari personel uygulamanıza hoş geldiniz. Kayıtlar, duyurular, '
        'raporlar ve mesajlaşma alttaki sekmelerde.\n\nHer sekmeye ilk geçişte '
        'kısa bir tanıtım açılır; alt menüye uzun basarak tekrar izleyebilirsiniz.',
  ),
  'Rehberlik Öğretmeni': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Rehberlik uygulamanıza hoş geldiniz. Vaka merkezi, randevular, '
        'program ve raporlar alttaki sekmelerde.\n\nHer sekmeye ilk geçişte kısa '
        'bir tanıtım açılır; alt menüye uzun basarak tekrar izleyebilirsiniz.',
  ),
  'Sürücü Adayı': RoleIntro(
    title: 'Hoş geldin! 🚗',
    body:
        'Sürücü kursu uygulamana hoş geldin. Direksiyon randevuların, kurs '
        'dosyan, ödemelerin ve sınavların alttaki sekmelerde.\n\n'
        'Sırayla şunlar olur: evrakların onaylanır → direksiyon dersleri '
        'başlar → e-sınav ve direksiyon sınavına girersin → mezun olursun.\n\n'
        'Alt menüye uzun basarsan bulunduğun sekmenin tanıtımını tekrar '
        'açabilirsin.',
  ),
  'Direksiyon Öğretmeni': RoleIntro(
    title: 'Hoş geldiniz! 🚗',
    body:
        'Direksiyon eğitmeni uygulamanıza hoş geldiniz. Günlük ders '
        'programınız, ders başlatma/bitirme ve kursiyer değerlendirmeleri '
        'alttaki sekmelerde.\n\nHer sekmeye ilk geçişinizde kısa bir tanıtım '
        'açılır; alt menüye uzun basarak tekrar izleyebilirsiniz.',
  ),
  'Sürücü Kursu': RoleIntro(
    title: 'Hoş geldiniz! 👋',
    body:
        'Sürücü kursu yönetim uygulamanıza hoş geldiniz. Panel, operasyon, '
        'planlama, eğitim/sınav, mezuniyet ve finans alttaki sekmelerde.\n\n'
        'Bu kısa tanıtım her sekmenin ne işe yaradığını gösterir. Alt menüye '
        'uzun basarak bulunduğunuz sekmenin tanıtımını istediğiniz zaman '
        'yeniden açabilirsiniz.',
  ),
};

const Map<String, Map<String, String>> tabDetails = {
  'Sürücü Adayı': {
    'Programım':
        'Direksiyon randevularınız, kalan ders hakkınız ve öğretmen '
        'değerlendirmeleriniz burada. Yaklaşan dersinizin saatini, aracını ve '
        'buluşma noktasını buradan görürsünüz.',
    'Ödemelerim':
        'Taksit planınız, kalan borcunuz ve makbuzlarınız burada.\n\n'
        '• Gecikmiş taksitiniz varsa en üstte uyarı çıkar.\n'
        '• Ek direksiyon dersi, sınav ücreti gibi ek kalemler ayrı listelenir.\n'
        '• Borcunuz kurumun belirlediği eşiği aşarsa yeni randevu alamayabilirsiniz.',
    'Evraklarım':
        'Kurs dosyanız: kimlik, sağlık raporu, adli sicil ve diğer zorunlu '
        'belgeler.\n\n'
        '• Eksik ve reddedilen belgeler en üstte listelenir.\n'
        '• Bir belge reddedildiyse nedeni burada yazar; doğrusunu yükleyin.\n'
        '• Sağlık raporu ve adli sicil gibi süreli belgelerde geçerlilik '
        'tarihi sorulur.\n'
        '• Dosyanız tamamlanmadan direksiyon eğitimine başlayamazsınız.',
    'Randevu Talebi':
        'Yeni direksiyon dersi ister veya mevcut randevunuzu erteletmek '
        'istersiniz.\n\n'
        '• Talebiniz doğrudan randevu açmaz; kurum onaylayınca kesinleşir.\n'
        '• Uygun saatler, kalan ders hakkınıza ve eğitmen/araç uygunluğuna '
        'göre listelenir.\n'
        '• Onaylanan her talep ders hakkınızdan düşer.',
    'Eğitim & Sınav':
        'Teorik ders programınız, yoklamanız ve sınavlarınız burada.\n\n'
        '• Devamsızlığınız kurumun belirlediği eşiği aşarsa mezun olamazsınız.\n'
        '• Önce e-sınavı geçmeniz, sonra direksiyon sınavına girmeniz gerekir.\n'
        '• Sınavdan kaldıysanız tekrar sınav hakkınız buradan planlanır.',
    'Mezuniyet':
        'Mezuniyet kontrol listeniz: evrak, teorik devam, direksiyon saati, '
        'sınavlar ve finans.\n\n'
        '• Tüm koşullar tamamlanınca kurum sizi mezun eder.\n'
        '• Sertifikanız hazır olduğunda buradan görüntüleyip indirebilirsiniz.',
    'Konu Anlatımı':
        'Trafik ve ilk yardım konularının video ve doküman anlatımları. '
        'Sınavlara buradan çalışabilirsiniz.',
    'Soru Bankası':
        'E-sınav hazırlığı için soru çözün. Yanlışlarınız kaydedilir; tekrar '
        'çalışmanız gereken konular size önerilir.',
    'Profil':
        'Hesap bilgileriniz, tema/dil ayarları ve çıkış.',
  },
  'Direksiyon Öğretmeni': {
    'Derslerim':
        'Günlük direksiyon ders programınız. Güne buradan başlarsınız.\n\n'
        '• Derse çıkmadan önce ARAÇ ÖN KONTROLÜNÜ yapın (fren, lastik, ışık, '
        'sıvılar) ve başlangıç kilometresini girin.\n'
        '• "Dersi Başlat" dediğiniz an ders sayacı işler; bitirdiğinizde '
        'harcanan süre kursiyerin ders hakkından düşer.\n'
        '• Kursiyer gelmediyse ders saati geçtikten sonra DEVAMSIZLIK '
        'işaretleyin — hakkı kurum kuralına göre yanar.\n'
        '• Ders sonunda 24 kriterli değerlendirmeyi doldurun; kursiyer bunu '
        'kendi ekranında görür.',
    'Teorik & Sınav':
        'Teorik derslerin yoklaması ve sınav sonuçları.\n\n'
        '• Yoklamada katıldı/geç kaldı/katılmadı/mazeretli seçebilirsiniz.\n'
        '• Devamsızlık mezuniyet koşulunu doğrudan etkiler; dikkatli girin.',
    'Konu Anlatımı':
        'Kursiyerlerinizle paylaştığınız video ve doküman içerikleri. Okul '
        'tarafındaki içerik altyapısının aynısını kullanır.',
    'Soru Bankası':
        'E-sınav hazırlığı için soru ekleyip kursiyerlere yönlendirebilirsiniz.',
    'Profil':
        'Hesap bilgileriniz, tema/dil ayarları ve çıkış.',
  },
  'Sürücü Kursu': {
    'Panel':
        'Kursunuzun günlük nabzı: aktif kursiyer, bugünkü dersler, filo '
        'durumu ve tahsilat tek ekranda.\n\n'
        '• Operasyon uyarıları bölümü kritik olanı öne çıkarır: süresi dolan '
        'araç evrakı, eksik kursiyer belgesi, bakımdaki araç.',
    'Operasyon':
        'Eğitim paketleri ve filo yönetimi.\n\n'
        '• Paket = direksiyon + teorik ders süresi ve fiyat. Kursiyer kaydında '
        'seçilen paket, ders hakkını belirler.\n'
        '• Araç eklerken muayene ve sigorta bitiş tarihi zorunludur; süresi '
        'dolan araç randevuya OTOMATİK kapanır.\n'
        '• Arıza/hasar bildirilen ve "güvenle kullanılamaz" işaretlenen araç '
        'da kullanım dışına alınır.',
    'Planlama':
        'Randevu oluşturma, onaylama ve kursiyerlerden gelen talepler.\n\n'
        '• Çakışma, ders hakkı, araç uygunluğu ve çalışma saati kuralları '
        'sunucuda zorunlu denetlenir.\n'
        '• Bir kural engel çıkarırsa yalnızca yetkili yönetici, GEREKÇE '
        'yazarak kuralı aşabilir; bu işlem denetim kaydına yazılır.\n'
        '• Randevu açıldığı anda ders dakikaları rezerve edilir.',
    'Eğitim & Sınav':
        'Teorik sınıflar, ders programı, yoklama ve sınav yönetimi.\n\n'
        '• Sınıf açın, kursiyerleri atayın, dersleri planlayın ve yoklama alın.\n'
        '• E-sınav ve direksiyon sınavı oturumları komisyonuyla birlikte '
        'tanımlanır; sonuç girildiğinde kursiyere bildirim gider.\n'
        '• Direksiyon sınavına yalnızca e-sınavı geçmiş kursiyer eklenebilir.',
    'Mezuniyet':
        'Mezuniyet kontrol listesi ve sertifika işlemleri.\n\n'
        '• Evrak, teorik devam, direksiyon saati, sınav ve finans koşulları '
        'tek listede kontrol edilir.\n'
        '• Koşul eksikken mezun etmek için İKİ AYRI YÖNETİCİNİN onayladığı '
        'istisna talebi gerekir.\n'
        '• Sertifika PDF olarak üretilir; teslim edildiğinde işaretleyin.',
    'Konu Anlatımı':
        'Trafik ve ilk yardım içerikleri. Okul tarafındaki içerik yönetiminin '
        'aynısını kullanır.',
    'Soru Bankası':
        'E-sınav hazırlığı için soru stüdyosu ve sınav altyapısı.',
    'Finans':
        'Sözleşmeler, taksitler ve tahsilatlar.\n\n'
        '• Ek direksiyon dersi satışı hem ücreti hem ders dakikasını aynı '
        'işlemde ekler.\n'
        '• Borcu kurumun belirlediği eşiği aşan kursiyer yeni randevu alamaz.\n'
        '• Tüm finansal hareketler denetim kaydına yazılır.',
    'Profil':
        'Hesap bilgileriniz, tema/dil ayarları ve çıkış.',
  },
  'Yönetici': {
    'Panel':
        'Kurumunuzun günlük nabzı: öğrenci sayıları, yoklama durumu, tahsilat '
        'özeti ve bekleyen işler tek ekranda. Güne buradan başlayın.',
    'Akademik':
        'Öğrenciler, öğretmenler, sınıflar ve sınavların yönetimi.\n\n'
        '• Öğrenci/personel kayıtları buradan açılır; sistem otomatik kullanıcı '
        'adı ve şifre üretir.\n'
        '• Kurumdan ayrılan kişiyi silmek yerine PASİFE ALIN — girişi kapanır, '
        'geçmiş verisi korunur.',
    'Finans':
        'Kayıt sözleşmeleri, taksitler ve tahsilatlar.\n\n'
        '• Ödemeler en eski vadeli taksitten başlayarak otomatik mahsup edilir.\n'
        '• Tüm finansal hareketler denetim kaydına yazılır.',
    'Operasyon':
        'Birimler/şubeler, görevler, onaylar, evrak ve duyurular.\n\n'
        '• Denetim kayıtlarında kim-ne zaman-ne yaptı sorusunun yanıtı vardır; '
        'birden fazla şubeniz varsa kayıtları şube şube inceleyebilirsiniz.\n'
        '• Şube müdürü yalnızca kendi şubesinin verisini görür.',
    'Raporlar':
        'Akademik ve operasyonel raporlar: sınav analizleri, devamsızlık ve '
        'karşılaştırmalar. PDF olarak paylaşabilirsiniz.',
    'Profil':
        'Hesap bilgileriniz, tema/dil ayarları ve çıkış. Kurum ve şube '
        'değiştirme (birden fazla yetkiniz varsa) da buradadır.',
  },
  'Öğrenci': {
    'Ana Sayfa':
        'Bugünkü program, yaklaşan sınavlar, bekleyen ödevler ve duyurular '
        'tek ekranda. Her sabah buraya bakman yeterli.',
    'İçerikler':
        'Öğretmenlerinin paylaştığı notlar, videolar ve dokümanlar. '
        'Beğendiklerini favorilere ekleyebilir, çevrimdışı erişim için '
        'indirebilirsin.',
    'Sınavlarım':
        'Yaklaşan sınavların ve sonuçların burada. Online sınavlara buradan '
        'girersin; süre dolunca cevapların otomatik kaydedilir.',
    'Deneme':
        'Açık denemeleri çöz; biter bitmez sonucunu ve analizini gör. Yanlış '
        'yaptığın sorular "Yanlışlarım"da birikir — tekrar çözerek eksik kapat.',
    'Rehberlik':
        'Rehber öğretmeninden randevu iste, sana atanan çalışma planlarını '
        'takip et.',
    'Kütüphane':
        'Kütüphanedeki kitapları ara; ödünç aldıklarını ve iade tarihlerini gör.',
    'Mesajlar':
        'Öğretmenlerinle mesajlaş; takıldığın soruları sorabilirsin.',
    'Profil':
        'Profilin, rozetlerin, tema ve bildirim ayarların burada.',
  },
  'Öğretmen': {
    'Ana Sayfa':
        'Bugünkü dersleriniz, bekleyen işler ve duyurular tek ekranda.',
    'Program':
        'Haftalık ders programınız. Değişiklikler anında yansır.',
    'Onaylar':
        'Veli görüşme talepleri ve size gelen onay istekleri burada; '
        'onaylayın ya da yeni zaman önerin.',
    'Görevlerim':
        'Size atanan nöbet ve görevler; tamamlandıkça işaretleyin.',
    'Kütüphane':
        'Kütüphane kataloğu; ödünç işlemlerinizi görürsünüz.',
    'Mesajlar':
        'Öğrenci, veli ve yönetimle mesajlaşma. Öğrenci soruları da buraya düşer.',
    'Profil':
        'Hesap bilgileriniz, tema/dil ve bildirim ayarları.',
  },
  'Veli': {
    'Ana Sayfa':
        'Çocuğunuzun günlük özeti: bugünkü yoklama, son sınav sonuçları ve '
        'duyurular. Birden fazla çocuğunuz varsa üstten geçiş yaparsınız.',
    'Devamsızlık':
        'Gün gün yoklama kayıtları. Devamsızlık işlendiğinde anında bildirim '
        'alırsınız; mazeret bildirimini buradan iletebilirsiniz.',
    'Duyurular':
        'Okuldan gelen duyurular ve haberler.',
    'Ödemeler':
        'Taksit planı, ödenenler ve kalan bakiye. Makbuzlarınızı görüntüleyip '
        'indirebilirsiniz.',
    'Rehberlik':
        'Rehber öğretmenden randevu isteyin; çocuğunuzla ilgili görüşme '
        'geçmişini takip edin.',
    'Kütüphane':
        'Çocuğunuzun ödünç aldığı kitaplar ve iade tarihleri.',
    'Mesajlar':
        'Öğretmenler ve okul yönetimiyle mesajlaşma.',
    'Profil':
        'Hesap bilgileriniz, bildirim tercihleri ve çıkış.',
  },
  'Muhasebeci': {
    'Panel':
        'Günlük tahsilat, bekleyen taksitler ve kasa özeti tek ekranda.',
    'Tahsilatlar':
        'Alınan tüm ödemeler: tarih, yöntem, makbuz numarası. Yeni tahsilat '
        'girişi ve iade işlemleri buradan yapılır.',
    'Taksitler':
        'Tüm taksit planları vade sırasıyla; geciken taksitler işaretlenir.',
    'Defter':
        'Tüm finansal hareketlerin kronolojik dökümü; mutabakat için kullanın.',
    'Mesajlar':
        'Yönetim ve velilerle mesajlaşma.',
    'Dışa Aktar':
        'Finansal verileri Excel/PDF olarak dışa aktarın.',
    'Profil':
        'Hesap bilgileriniz ve ayarlar.',
  },
  'İdari Birimler': {
    'Panel':
        'Günlük operasyon özeti: bekleyen işler, son kayıtlar ve duyurular.',
    'Kayıtlar':
        'Öğrenci ve personel kayıt işlemleri. Kayıtta sistem otomatik '
        'kullanıcı adı/şifre üretir; bilgileri paylaşabilirsiniz.',
    'Duyurular':
        'Hedef kitle seçerek duyuru yayınlayın; ilgili panellere anında düşer.',
    'Mesajlar':
        'Kurum içi mesajlaşma.',
    'Kütüphane':
        'Kütüphane kataloğu ve ödünç işlemleri.',
    'Raporlar':
        'Operasyonel raporlar ve dökümler.',
    'Profil':
        'Hesap bilgileriniz ve ayarlar.',
  },
  'Rehberlik Öğretmeni': {
    'Vaka Merkezi':
        'Takip ettiğiniz öğrenciler ve görüşme kayıtları. Not görünürlüğü '
        'sizde: özel notları yalnızca siz görürsünüz.',
    'Randevular':
        'Öğrenci ve velilerden gelen randevu talepleri; onaylayın ya da yeni '
        'zaman önerin.',
    'Program':
        'Haftalık programınız ve planlı görüşmeleriniz.',
    'Rapor':
        'Görüşme yoğunluğu ve öğrenci gelişim raporları.',
    'Kütüphane':
        'Kütüphane kataloğu.',
    'Mesajlar':
        'Öğrenci, veli ve yönetimle mesajlaşma.',
    'Profil':
        'Hesap bilgileriniz ve ayarlar.',
  },
};

/// Sekme etiketi için detay metni; katalogda yoksa genel bir açıklama üretir.
String tabDetailFor(String? role, String label) {
  final byRole = tabDetails[role ?? ''];
  final detail = byRole?[label];
  if (detail != null) return detail;
  return '"$label" bölümüne hoş geldiniz. Bu sekmedeki içerik ve işlemler '
      'rolünüze göre düzenlenmiştir; ekranı keşfetmekten çekinmeyin.';
}
