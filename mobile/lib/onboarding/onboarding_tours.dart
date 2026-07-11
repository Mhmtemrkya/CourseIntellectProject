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
};

const Map<String, Map<String, String>> tabDetails = {
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
