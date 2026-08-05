// Rol + sayfa bazlı onboarding tur kataloğu.
//
// İki tur türü vardır:
//  1. WELCOME_TOURS  — role özel karşılama turu: ilk girişte uygulamanın
//     bölümlerini sidebar üzerinde tek tek göstererek "neyi nerede yapacağını" öğretir.
//  2. PAGE_TOURS     — sayfa turları: kullanıcı bir sayfayı İLK KEZ açtığında
//     o sayfanın ne işe yaradığını ve nasıl kullanılacağını adım adım anlatır.
//
// Hedef seçiciler data-testid üzerinden çalışır; hedef bulunamazsa adım
// otomatik olarak ortalanmış karta düşer (tur asla kırılmaz).

const nav = (path) => `[data-testid="nav-${path.replace(/\//g, '-').slice(1)}"]`;
const TOPBAR_SEARCH = '[data-testid="search-button"]';
const TOPBAR_NOTIFICATIONS = '[data-testid="notifications-button"]';
const TOPBAR_USER = '[data-testid="user-menu"]';
const SIDEBAR = '[data-testid="sidebar"]';
const PAGE_TITLE = 'main h1';

// ─────────────────────────────────────────────────────────────────────────────
// KARŞILAMA TURLARI (rol bazlı)
// ─────────────────────────────────────────────────────────────────────────────

export const WELCOME_TOURS = {
  admin: {
    id: 'welcome:admin',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Kurum yönetim panelinize hoş geldiniz. Bu kısa tur, hangi işlemi nerede yapacağınızı gösterir.\n\nİpucu: Her sayfada sağ üstteki ? butonuna basarak o sayfanın turunu yeniden açabilirsiniz. Turda İleri/Geri okları ya da klavye ok tuşlarıyla gezinebilirsiniz.',
      },
      {
        target: SIDEBAR,
        title: 'Sol menü: her şeyin merkezi',
        body: 'Tüm modüllere sol menüden ulaşırsınız. Menü, rolünüze ve kurumunuzun paketine göre şekillenir. Başlıklara tıklayarak grupları açıp kapatabilirsiniz.',
      },
      {
        target: nav('/dashboard'),
        title: 'Genel Bakış',
        body: 'Güne buradan başlayın: öğrenci sayıları, yoklama durumu, tahsilat özeti ve bekleyen işler tek ekranda. Kartlara tıklayarak ilgili modüle geçebilirsiniz.',
      },
      {
        target: nav('/students'),
        title: 'Öğrenciler',
        body: 'Öğrenci listesi, detay dosyaları ve durum yönetimi burada.\n\n• Yeni öğrenci kaydı: "Kayıt İşlemleri → Öğrenci Kaydı"\n• Ayrılan öğrenciyi Pasife Al: listede öğrenciye tıklayıp "Pasife Al" — hesap silinmez, girişi engellenir.',
      },
      {
        target: nav('/teachers'),
        title: 'Öğretmenler',
        body: 'Öğretmen kadronuz: branşlar, sınıf atamaları ve iletişim bilgileri. Buradan öğretmen ekleyebilir, düzenleyebilir, ayrılan öğretmeni pasife alabilirsiniz.',
      },
      {
        target: nav('/parents'),
        title: 'Veliler',
        body: 'Veli listesi ve veli giriş hesapları. "Veli Hesapları" bölümünden bir velinin hesabını pasife alabilir ya da yeniden aktifleştirebilirsiniz.',
      },
      {
        target: nav('/classes'),
        title: 'Sınıflar ve Ders Programı',
        body: 'Sınıf yapınızı burada kurarsınız; ders programını da "Ders Programı" sayfasından yönetirsiniz. Sınıflar; öğrenci kaydı, yoklama ve sınavların temelidir — ilk kurulumda buradan başlamanızı öneririz.',
      },
      {
        target: nav('/attendance'),
        title: 'Yoklama',
        body: 'Günlük yoklamalar, devamsızlık raporları ve QR ile yoklama burada. Veliler devamsızlıkları kendi panellerinden anında görür.',
      },
      {
        target: nav('/admin/finance'),
        title: 'Finans',
        body: 'Kayıt sözleşmeleri, taksitler, tahsilatlar ve raporlar. Muhasebe rolündeki personeliniz de kendi panelinden bu modülü kullanır.',
      },
      {
        target: nav('/admin/audit-log'),
        title: 'Kayıt Geçmişi',
        body: 'Kurumunuzda kim, ne zaman, hangi rolle, hangi cihaz ve IP adresinden ne yaptı? Giriş denemeleri ve idari işlemler tek zaman çizelgesinde loglanır. Birden fazla şubeniz varsa kayıtları şube şube inceleyebilirsiniz.',
      },
      {
        target: nav('/scope-management'),
        title: 'Yetki ve Kapsam',
        body: 'Şube müdürü atama, özel roller ve erişim kapsamları. Bir şube müdürü yalnızca kendi şubesinin verilerini görür — bu izolasyon otomatiktir.',
      },
      {
        target: TOPBAR_SEARCH,
        title: 'Hızlı arama',
        body: 'Buradan (veya Cmd/Ctrl+K ile) komut paletini açın: öğrenci, sayfa ya da işlem arayıp saniyeler içinde gidin.',
      },
      {
        target: TOPBAR_NOTIFICATIONS,
        title: 'Bildirimler',
        body: 'Onay bekleyen talepler, yeni mesajlar ve sistem bildirimleri burada toplanır.',
      },
      {
        target: TOPBAR_USER,
        title: 'Hesabınız',
        body: 'Profil, tema (açık/koyu), dil ve çıkış işlemleri burada.\n\nTur bitti! Unutmayın: her sayfaya ilk girişinizde o sayfanın kısa turu otomatik açılır; ? butonuyla istediğiniz zaman tekrar izleyebilirsiniz.',
      },
    ],
  },

  administrative: {
    id: 'welcome:administrative',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'İdari personel panelinize hoş geldiniz. Kayıt işlemleri, evrak, duyurular ve günlük operasyon buradan yürür. Bu tur size ana bölümleri gösterecek.',
      },
      {
        target: SIDEBAR,
        title: 'Sol menü',
        body: 'Yetkiniz dahilindeki tüm modüller sol menüde. Yöneticiniz size özel bir rol tanımladıysa menünüz ona göre sadeleşir.',
      },
      {
        target: nav('/students'),
        title: 'Öğrenciler ve Kayıt',
        body: 'Öğrenci listesine bakabilir, yeni öğrenci kaydı yapabilirsiniz. Kayıt sırasında sistem öğrenci ve veli için otomatik kullanıcı adı/şifre üretir; bilgileri PDF olarak indirebilirsiniz.',
      },
      {
        target: nav('/attendance'),
        title: 'Yoklama',
        body: 'Günlük yoklama girişi ve devamsızlık takibi. Devamsızlık veli paneline otomatik yansır.',
      },
      {
        target: nav('/admin/announcements'),
        title: 'Duyurular',
        body: 'Öğrenci, veli veya öğretmenlere duyuru yayınlayın. Hedef kitleyi seçebilirsiniz.',
      },
      {
        target: nav('/admin/documents'),
        title: 'Evrak Yönetimi',
        body: 'Kurum evraklarını yükleyin, kategorileyin ve arayın.',
      },
      {
        target: TOPBAR_USER,
        title: 'Hesabınız',
        body: 'Profil ve çıkış işlemleri burada.\n\nHer sayfaya ilk girişte kısa bir tanıtım turu açılır; ? butonuyla tekrar izleyebilirsiniz.',
      },
    ],
  },

  finance: {
    id: 'welcome:finance',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Muhasebe panelinize hoş geldiniz. Tahsilattan maaşlara, taksitlerden raporlara tüm finansal akış burada. Bu tur ana bölümleri tanıtır.',
      },
      {
        target: nav('/finance/dashboard'),
        title: 'Finans Özeti',
        body: 'Günlük tahsilat, bekleyen taksitler, geciken ödemeler ve kasa durumu tek ekranda.',
      },
      {
        target: nav('/finance/student-accounts'),
        title: 'Cari Hesaplar',
        body: 'Her öğrencinin sözleşmesi, taksit planı ve ödeme geçmişi. Tahsilat almak için öğrenciyi seçip "Ödeme Al" deyin — makbuz otomatik oluşur.',
      },
      {
        target: nav('/finance/collections'),
        title: 'Tahsilatlar',
        body: 'Alınan tüm ödemelerin listesi. İade gerekirse buradan yapılır; iade edilen tutar taksitlere otomatik geri dağıtılır.',
      },
      {
        target: nav('/finance/late-payments'),
        title: 'Geciken Ödemeler',
        body: 'Vadesi geçen taksitler burada. Velilere toplu hatırlatma gönderebilirsiniz.',
      },
      {
        target: nav('/finance/salary'),
        title: 'Maaşlar',
        body: 'Personel maaş takibi ve ödeme kayıtları.',
      },
      {
        target: nav('/finance/audit-log'),
        title: 'Finans Denetim Kaydı',
        body: 'Tüm finansal işlemlerin izi: kim ne zaman hangi tahsilatı/iadeyi işledi. Şeffaflık ve mutabakat için kullanın.\n\nHer sayfada ? butonuyla o sayfanın turunu açabilirsiniz.',
      },
    ],
  },

  teacher: {
    id: 'welcome:teacher',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Öğretmen panelinize hoş geldiniz. Derslerinizi, sınavlarınızı, ödevlerinizi ve öğrenci iletişiminizi buradan yönetirsiniz. Bu kısa tur size yol gösterecek.',
      },
      {
        target: nav('/dashboard'),
        title: 'Genel Bakış',
        body: 'Bugünkü dersleriniz, bekleyen ödev teslimleri ve son duyurular burada.',
      },
      {
        target: nav('/t/content'),
        title: 'İçerikler',
        body: 'Ders notu, video ve dokümanlarınızı yükleyin; sınıflara göre paylaşın. Öğrenciler kendi panellerinden anında erişir.',
      },
      {
        target: nav('/t/question-bank'),
        title: 'Soru Bankası',
        body: 'Kendi soru havuzunuzu oluşturun: tek tek ekleyin ya da toplu içe aktarın. Sorularınızı sınav ve denemelerde tekrar tekrar kullanabilirsiniz.',
      },
      {
        target: nav('/t/exams'),
        title: 'Sınavlar',
        body: 'Sınav oluşturun, uygulayın ve sonuç girin. "Sınav Stüdyosu" ile soru bankanızdan otomatik sınav derleyebilirsiniz.',
      },
      {
        target: nav('/t/grade-entry'),
        title: 'Not Girişi',
        body: 'Sınav sonuçlarını sınıf bazında hızlıca girin. Sonuçlar öğrenci ve veli paneline otomatik düşer.',
      },
      {
        target: nav('/t/assignments'),
        title: 'Ödevler',
        body: 'Ödev verin, teslimleri takip edin, geri bildirim yazın. Teslim Merkezi\'nde tüm gönderimler tek listede.',
      },
      {
        target: nav('/attendance'),
        title: 'Yoklama',
        body: 'Ders başında yoklamayı buradan alın; QR ile hızlı yoklama da desteklenir.',
      },
      {
        target: nav('/t/questions'),
        title: 'Öğrenci Soruları',
        body: 'Öğrencilerin size ilettiği soruları görün ve yanıtlayın.',
      },
      {
        target: TOPBAR_USER,
        title: 'Hesabınız',
        body: 'Profil ve çıkış burada.\n\nHer sayfaya ilk girişte kısa bir tur açılır; ? ile tekrar izleyebilirsiniz.',
      },
    ],
  },

  student: {
    id: 'welcome:student',
    steps: [
      {
        title: 'Hoş geldin! 🎓',
        body: 'Öğrenci paneline hoş geldin. Derslerin, sınavların, ödevlerin ve çalışma araçların burada. Bu kısa tur sana her şeyin yerini gösterecek.',
      },
      {
        target: nav('/s/dashboard'),
        title: 'Ana Sayfa',
        body: 'Bugünkü program, yaklaşan sınavlar, bekleyen ödevler ve duyurular tek ekranda.',
      },
      {
        target: nav('/s/schedule'),
        title: 'Ders Programı',
        body: 'Haftalık ders programın burada.',
      },
      {
        target: nav('/s/content'),
        title: 'Ders İçerikleri',
        body: 'Öğretmenlerinin paylaştığı notlar, videolar ve dokümanlar. Beğendiklerini favorilere ekleyebilir, kendi notunu tutabilirsin.',
      },
      {
        target: nav('/s/assignments'),
        title: 'Ödevler',
        body: 'Sana verilen ödevleri gör, dosya yükleyerek teslim et, geri bildirimleri oku.',
      },
      {
        target: nav('/s/exams'),
        title: 'Sınavlar ve Denemeler',
        body: 'Yaklaşan sınavların ve online denemelerin burada. "Deneme Sınavları"ndan istediğin zaman pratik yapabilirsin.',
      },
      {
        target: nav('/s/exam-results'),
        title: 'Sonuçlar ve Yanlışlarım',
        body: 'Sınav sonuçlarını ve gelişimini takip et. "Yanlışlarım" sayfası yanlış yaptığın soruları toplar — tekrar çözerek eksiklerini kapat.',
      },
      {
        target: nav('/s/study-plan'),
        title: 'Çalışma Planı',
        body: 'Haftalık çalışma planını oluştur ve takip et.',
      },
      {
        target: nav('/s/question-box'),
        title: 'Soru Kutusu',
        body: 'Takıldığın soruyu fotoğrafla ya da yazıyla öğretmenine gönder; yanıt gelince bildirim alırsın.',
      },
      {
        target: TOPBAR_USER,
        title: 'Hesabın',
        body: 'Profil, tema ve çıkış burada.\n\nHer sayfaya ilk girişte kısa bir tanıtım açılır; ? butonuyla tekrar izleyebilirsin. Başarılar! 🚀',
      },
    ],
  },

  parent: {
    id: 'welcome:parent',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Veli panelinize hoş geldiniz. Çocuğunuzun devamsızlığı, sınav sonuçları, ödemeleri ve okulla iletişiminiz buradan tek ekranda. Bu kısa tur size yol gösterecek.',
      },
      {
        target: nav('/p/dashboard'),
        title: 'Genel Durum',
        body: 'Çocuğunuzun güncel durumu: bugünkü yoklama, son sınav sonuçları ve duyurular.',
      },
      {
        target: nav('/p/children'),
        title: 'Çocuklarım',
        body: 'Birden fazla çocuğunuz kayıtlıysa hepsini burada görür, aralarında geçiş yaparsınız.',
      },
      {
        target: nav('/p/attendance'),
        title: 'Devamsızlık',
        body: 'Gün gün yoklama kayıtları. Devamsızlık olduğunda bildirim alırsınız; mazeret bildirimini "Mazeret Bildir" sayfasından iletebilirsiniz.',
      },
      {
        target: nav('/p/exams'),
        title: 'Sınav Sonuçları',
        body: 'Tüm sınav sonuçları ve gelişim grafikleri.',
      },
      {
        target: nav('/p/payments'),
        title: 'Ödemeler',
        body: 'Taksit planı, yapılan ödemeler ve varsa geciken tutarlar. Makbuzlarınızı "Makbuzlar" sayfasından indirebilirsiniz.',
      },
      {
        target: nav('/p/meetings'),
        title: 'Görüşme Talebi',
        body: 'Öğretmenlerle görüşme talebi oluşturun; onaylanınca bildirim gelir.',
      },
      {
        target: TOPBAR_USER,
        title: 'Hesabınız',
        body: 'Profil ve çıkış burada.\n\nHer sayfaya ilk girişte kısa bir tanıtım açılır; ? butonuyla tekrar izleyebilirsiniz.',
      },
    ],
  },

  superadmin: {
    id: 'welcome:superadmin',
    steps: [
      {
        title: 'Platform Yönetimi 🛠️',
        body: 'Geliştirici/platform yöneticisi paneline hoş geldiniz. Tüm kurumları, paketleri, limitleri ve platform genelindeki log kayıtlarını buradan yönetirsiniz.',
      },
      {
        target: nav('/sa/dashboard'),
        title: 'Platform Özet',
        body: 'Aktif kurumlar, kullanıcı sayıları ve sistem sağlığı tek bakışta.',
      },
      {
        target: nav('/sa/tenants'),
        title: 'Kurumlar',
        body: 'Kurum başvurularını onaylayın, kurum bazında modül açıp kapatın, abonelikleri yönetin.',
      },
      {
        target: nav('/sa/logs'),
        title: 'Log Merkezi',
        body: 'Tüm kurumların denetim kayıtları kurum kurum burada. Bir kuruma tıklayınca şubeleri açılır; şube şube log inceleyebilir, kişi/işlem araması yapabilirsiniz.',
      },
      {
        target: nav('/sa/plans'),
        title: 'Paketler ve Limitler',
        body: 'Abonelik paketlerini ve kurum limitlerini tanımlayın.',
      },
      {
        target: nav('/sa/support'),
        title: 'Destek',
        body: 'Kurumlardan gelen destek talepleri burada.',
      },
    ],
  },

  counselor: {
    id: 'welcome:counselor',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Rehberlik panelinize hoş geldiniz. Öğrenci görüşmeleri, randevular, envanterler ve rehberlik raporları buradan yürür.',
      },
      {
        target: nav('/g/dashboard'),
        title: 'Rehberlik Özeti',
        body: 'Bekleyen randevu talepleri, günün görüşmeleri ve riskli öğrenci uyarıları.',
      },
      {
        target: nav('/g/sessions'),
        title: 'Görüşmeler',
        body: 'Öğrenci görüşme kayıtlarını tutun. Not görünürlüğünü siz belirlersiniz: özel notlar yalnızca size görünür.',
      },
      {
        target: nav('/g/appointments'),
        title: 'Randevular',
        body: 'Öğrenci ve velilerden gelen randevu taleplerini yönetin.',
      },
      {
        target: nav('/g/inventories'),
        title: 'Envanterler',
        body: 'Test ve envanter uygulayın, sonuçları öğrenci dosyasına işleyin.',
      },
      {
        target: nav('/g/planner'),
        title: 'Çalışma Planlayıcı',
        body: 'Öğrencilere bireysel çalışma planı hazırlayın.',
      },
    ],
  },

  cafeteria: {
    id: 'welcome:cafeteria',
    steps: [
      {
        title: 'Hoş geldiniz! 👋',
        body: 'Yemekhane panelinize hoş geldiniz.',
      },
      {
        target: nav('/cafeteria/menu'),
        title: 'Haftalık Menü',
        body: 'Haftalık yemek menüsünü buradan girin; öğrenci ve veliler kendi panellerinden görür.',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SAYFA TURLARI — kullanıcı sayfayı ilk açtığında otomatik gösterilir.
// key: route pathname (tam eşleşme)
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_TOURS = {
  // ── Yönetim ────────────────────────────────────────────────────────────────
  '/dashboard': {
    steps: [
      { title: 'Genel Bakış', body: 'Kurumunuzun günlük nabzı: öğrenci/öğretmen sayıları, bugünkü yoklama oranı, tahsilat özeti ve bekleyen onaylar.\n\nKartlara tıklayarak ilgili modüle doğrudan geçebilirsiniz.' },
      { target: PAGE_TITLE, title: 'Nasıl kullanılır?', body: '• Üstteki kartlar anlık sayıları gösterir.\n• Grafikler haftalık/aylık eğilimleri özetler.\n• Sayfa her açılışta güncel veriyle yüklenir.' },
    ],
  },
  '/students': {
    steps: [
      { title: 'Öğrenciler', body: 'Kurumunuzdaki tüm öğrencilerin listesi. Arama kutusuyla isim/TC/sınıf arayın; filtrelerle sınıf ve duruma göre daraltın.' },
      { target: PAGE_TITLE, title: 'Öğrenci detayı', body: 'Bir öğrenciye tıklayınca sağdan detay paneli açılır: kimlik bilgileri, veli iletişimi, devamsızlık ve sınav özeti.' },
      { title: 'Pasife alma', body: 'Kurumdan ayrılan öğrenciyi silmek yerine PASİFE ALIN:\n\n• Detay panelinde "Pasife Al" butonuna basın.\n• Öğrenci (ve girişi) devre dışı kalır ama tüm geçmiş verisi korunur.\n• Geri dönerse "Aktifleştir" ile tek tıkla açarsınız.\n\nDurum filtresinden pasif öğrencileri ayrıca listeleyebilirsiniz.' },
      { title: 'Yeni kayıt nerede?', body: 'Yeni öğrenci kaydı sol menüde "Öğrenci Kaydı" sayfasından yapılır. Kayıtta öğrenci + veli hesabı otomatik oluşturulur ve giriş bilgileri PDF olarak indirilebilir.' },
    ],
  },
  '/teachers': {
    steps: [
      { title: 'Öğretmenler', body: 'Öğretmen kadronuzun listesi: branş, atanmış sınıflar ve sınıf öğretmenliği bilgisi tek tabloda.' },
      { target: PAGE_TITLE, title: 'İşlemler', body: '• Satıra tıklayın → detay paneli açılır.\n• Sağdaki ⋯ menüsünden "Düzenle" ile bilgileri güncelleyin.\n• "Pasife Al" ile ayrılan öğretmenin girişini kapatın — kayıt silinmez, geçmiş korunur.\n• Durum filtresiyle pasif öğretmenleri görün.' },
      { title: 'Yeni öğretmen', body: '"Yeni Öğretmen" butonuyla kayıt açın: sistem kullanıcı adı/şifre üretir, bilgileri PDF indirebilirsiniz. Branş ve sınıf atamalarını kayıt sırasında ya da sonradan yapabilirsiniz.' },
    ],
  },
  '/parents': {
    steps: [
      { title: 'Veliler', body: 'Öğrenci kayıtlarından türeyen veli listesi: iletişim bilgileri, bağlı öğrenciler ve görüşme sayıları.' },
      { target: '[data-tour="parent-accounts"]', title: 'Veli Hesapları', body: 'Bu bölüm velilerin GİRİŞ HESAPLARINI yönetir:\n\n• Kullanıcı adı ve son giriş zamanını görürsünüz.\n• Kurumdan ayrılan velinin hesabını "Pasife Al" ile kapatın — veli artık giriş yapamaz, açık oturumları düşürülür.\n• Geri dönüşte "Aktifleştir" yeterli.' },
    ],
  },
  '/classes': {
    steps: [
      { title: 'Sınıflar', body: 'Sınıf yapınızı burada kurar ve yönetirsiniz. Sınıflar; öğrenci kaydı, yoklama, ders programı ve sınavların temelidir.' },
      { target: PAGE_TITLE, title: 'Nasıl kullanılır?', body: '• Yeni sınıf ekleyin, ad ve kapasite verin.\n• Sınıfa tıklayarak öğrenci listesini görün.\n• Sınıf silmeden önce öğrencileri başka sınıfa taşıyın.' },
    ],
  },
  '/schedule': {
    steps: [
      { title: 'Ders Programı', body: 'Haftalık ders programını sınıf ve öğretmen bazında oluşturun. Program; öğrenci, veli ve öğretmen panellerine otomatik yansır.' },
      { target: PAGE_TITLE, title: 'İpuçları', body: '• Hücreye tıklayarak ders atayın.\n• Aynı öğretmeni çakışan saate atarsanız sistem uyarır.\n• Değişiklikler anında yayınlanır.' },
    ],
  },
  '/attendance': {
    steps: [
      { title: 'Yoklama', body: 'Günlük yoklama girişi ve devamsızlık takibi. Sınıf seçin, tarih seçin, öğrencileri işaretleyin — hepsi bu.' },
      { target: PAGE_TITLE, title: 'Bilmeniz gerekenler', body: '• Devamsızlık veli paneline otomatik düşer ve bildirim gider.\n• QR yoklama için "Kiosk QR" sayfasını açık bir ekrana koyabilirsiniz; öğrenciler telefonla okutur.\n• Raporlar sekmesinden aylık devamsızlık dökümü alınır.' },
    ],
  },
  '/exams': {
    steps: [
      { title: 'Sınavlar', body: 'Kurum genelindeki sınavların planlanması ve sonuç takibi. Planlanan sınavlar öğrenci/veli panellerinde "yaklaşan sınavlar" olarak görünür.' },
      { target: PAGE_TITLE, title: 'Akış', body: '1. Sınav planlayın (tarih, sınıf, ders).\n2. Öğretmenler sonuçları girer.\n3. Sonuçlar burada ve karne/raporlarda toplanır.' },
    ],
  },
  '/reports': {
    steps: [
      { title: 'Raporlar', body: 'Akademik ve operasyonel raporlar: sınav analizleri, devamsızlık, sınıf karşılaştırmaları. PDF olarak dışa aktarabilirsiniz.' },
    ],
  },
  '/content': {
    steps: [
      { title: 'İçerik Kütüphanesi', body: 'Kurumdaki tüm ders içerikleri: kim ne yüklemiş, hangi sınıfa paylaşılmış. İçerik denetimi ve arşiv buradan.' },
    ],
  },
  '/questions': {
    steps: [
      { title: 'Soru Havuzu', body: 'Kurum genelindeki soru bankası. Öğretmenlerin eklediği soruları görebilir, onay akışını yönetebilirsiniz.' },
    ],
  },
  '/chat': {
    steps: [
      { title: 'Mesajlar', body: 'Kurum içi mesajlaşma: öğretmen, personel, öğrenci ve velilerle yazışın. Mesajlaşma kapsamı rol politikalarına göre sınırlanır.' },
    ],
  },
  '/settings': {
    steps: [
      { title: 'Ayarlar', body: 'Kurum bilgileri, tema/marka rengi, bildirim tercihleri ve dil seçenekleri burada.' },
    ],
  },
  '/admin/finance': {
    steps: [
      { title: 'Finans Yönetimi', body: 'Kayıt sözleşmeleri, taksit planları, tahsilatlar ve finansal raporların yönetici görünümü.' },
      { target: PAGE_TITLE, title: 'Temel akış', body: '1. Öğrenci kaydında sözleşme + taksit planı oluşur.\n2. Tahsilatlar taksitlere otomatik mahsup edilir (en eski vade önce).\n3. Fazla ödeme "Avans" olarak işaretlenir.\n4. Tüm finansal hareketler denetim kaydına yazılır.' },
    ],
  },
  '/admin/audit-log': {
    steps: [
      { title: 'Kayıt Geçmişi', body: 'Kurumunuzdaki kritik işlemlerin tam izi: kim, ne zaman, hangi rolle, hangi cihaz ve IP adresinden ne yaptı.\n\nKapsanan işlemler: giriş denemeleri (başarılı/başarısız), kullanıcı oluşturma/pasifleştirme/silme, rol ve yetki değişiklikleri, öğrenci/personel/veli kayıtları, tahsilat ve iadeler, birim/şube işlemleri, onaylar, evrak ve görevler.\n\nNot: Rol bilgisi bu özellik eklendikten SONRAKİ işlemlerde görünür; daha eski kayıtlarda rol saklanmamıştı.' },
      { target: '[data-tour="audit-branch-summary"]', title: 'Şube kartları', body: 'Birden fazla şubeniz varsa her şubenin kayıt yoğunluğunu buradan görürsünüz. Karta tıklayınca liste o şubeye filtrelenir.\n\nNot: Şube müdürleri bu sayfada YALNIZCA kendi şubelerinin kayıtlarını görür — izolasyon otomatiktir.' },
      { target: '[data-tour="audit-filters"]', title: 'Filtreler', body: 'Kaynak (tüm hareketler / yalnız işlemler / yalnız girişler), kategori, şube ve serbest metin aramasıyla kayıtları daraltın. Arama; kişi adı, işlem, IP adresi ve detay metninde çalışır.\n\nGiriş kayıtları şubeye bağlı tutulmadığı için şube seçtiğinizde listeden çıkarlar.' },
      { target: '[data-tour="audit-list"]', title: 'Kayıt listesi', body: 'Her satırda işlem, kategori, şube, detay ve zaman bilgisi var. Liste sayfalıdır; alttaki Önceki/Sonraki butonlarıyla gezinin.' },
    ],
  },
  '/admin/org-units': {
    steps: [
      { title: 'Birimler ve Şubeler', body: 'Kurumunuzun organizasyon ağacı: şubeler, kampüsler ve idari birimler. Şube müdürü atamaları ve veri izolasyonu bu yapıya dayanır.' },
      { target: PAGE_TITLE, title: 'İpuçları', body: '• Şube ekleyin, sorumlusunu atayın.\n• Kapatılan şubeyi silmek yerine PASİFE alın — geçmiş veriler korunur.\n• Şube müdürü yalnızca kendi şubesinin verilerini görür.' },
    ],
  },
  '/admin/role-management': {
    steps: [
      { title: 'Rol Yönetimi', body: 'Kullanıcı rollerini ve rol politikalarını yönetin: ana rol değiştirme, ek rol atama, modül erişimleri.' },
      { title: 'Özel roller', body: 'Kuruma özel roller (ör. "Kayıt Sorumlusu") oluşturabilirsiniz:\n\n• Taban rol seçin (İdari/Öğretmen/Yemekhane).\n• Erişebileceği modülleri işaretleyin.\n• Personele atayın — menüsü otomatik sadeleşir.\n\nTüm rol değişiklikleri denetim kaydına yazılır.' },
    ],
  },
  '/scope-management': {
    steps: [
      { title: 'Kapsam Yönetimi', body: 'Kimin hangi kurum/şube verisine erişeceğini burada tanımlarsınız. Şube müdürü, bölge sorumlusu ve salt-okunur denetçi gibi senaryolar desteklenir.' },
      { target: PAGE_TITLE, title: 'Güvenlik modeli', body: '• Herkes yalnızca kendi yönettiği kapsamı devredebilir (yetki yükseltme engellidir).\n• Salt-okunur kapsam verilen kullanıcı hiçbir değişiklik yapamaz.\n• Kapsam değişiklikleri denetim kaydına yazılır.' },
    ],
  },
  '/admin/staff-registration': {
    steps: [
      { title: 'Personel Kaydı', body: 'Öğretmen, idari personel, muhasebe ve diğer çalışan kayıtları buradan açılır. Sistem otomatik kullanıcı adı/şifre üretir; PDF indirebilirsiniz.' },
      { target: PAGE_TITLE, title: 'Pasifleştirme', body: 'Alttaki personel listesinde her satırda durum rozeti ve pasife alma/aktifleştirme aksiyonu vardır. Ayrılan personelin girişi kapanır, kaydı ve geçmişi korunur.' },
    ],
  },
  '/admin/student-registration': {
    steps: [
      { title: 'Öğrenci Kaydı', body: 'Yeni öğrenci kaydı: kimlik, sınıf, veli ve (isteğe bağlı) finans bilgileri tek formda.' },
      { target: PAGE_TITLE, title: 'Otomatik hesaplar', body: '• Öğrenci için giriş hesabı otomatik açılır.\n• Veli bilgisi girerseniz veli hesabı da otomatik oluşur ve öğrenciye bağlanır.\n• Giriş bilgilerini PDF olarak indirip teslim edin; ilk girişte şifre değiştirme zorunludur.' },
    ],
  },
  '/admin/branch-registration': {
    steps: [
      { title: 'Şube Kaydı', body: 'Yeni şube/kampüs açılışı. Şube açıldıktan sonra "Kapsam Yönetimi"nden şube müdürü atayabilirsiniz; müdür yalnızca kendi şubesini görür ve yönetir.' },
    ],
  },
  '/admin/operations': {
    steps: [
      { title: 'Operasyon Merkezi', body: 'Günlük operasyonun kontrol paneli: bekleyen onaylar, görevler ve idari işlerin özeti.' },
    ],
  },
  '/admin/task-center': {
    steps: [
      { title: 'Görev Merkezi', body: 'Personele görev atayın, son tarih verin, tamamlanma durumunu izleyin.' },
    ],
  },
  '/admin/kpi': {
    steps: [
      { title: 'KPI Panosu', body: 'Kurumunuzun temel performans göstergeleri: doluluk, tahsilat oranı, devamsızlık eğilimi ve akademik başarı.' },
    ],
  },
  '/admin/personnel-approvals': {
    steps: [
      { title: 'Personel Onayları', body: 'İzin talepleri ve personel kaynaklı onay istekleri burada. Onay/red kararlarınız gerekçesiyle birlikte denetim kaydına yazılır.' },
    ],
  },
  '/admin/staff-hr': {
    steps: [
      { title: 'Personel Özlük (İK)', body: 'Personel özlük dosyaları: izinler, zimmetler ve evraklar.' },
    ],
  },
  '/admin/meetings': {
    steps: [
      { title: 'Görüşme Talepleri', body: 'Velilerden gelen görüşme taleplerini görün, uygun zamana onaylayın ya da not düşerek reddedin.' },
    ],
  },
  '/admin/announcements': {
    steps: [
      { title: 'Duyurular', body: 'Hedef kitle seçerek (tüm kurum, sınıf, rol) duyuru yayınlayın. Duyurular ilgili panellere ve bildirimlere düşer.' },
    ],
  },
  '/admin/documents': {
    steps: [
      { title: 'Evrak Yönetimi', body: 'Kurum evraklarını yükleyin ve kategorileyin. Evrak işlemleri denetim kaydında izlenir.' },
    ],
  },
  '/admin/service-tracking': {
    steps: [
      { title: 'Servis Takibi', body: 'Servis araçları, güzergahlar ve şoförler. Veliler kendi panellerinden servis bilgisini görür.' },
    ],
  },
  '/consolidated': {
    steps: [
      { title: 'Konsolide Görünüm', body: 'Birden fazla şubeniz varsa tüm şubelerin metriklerini tek ekranda karşılaştırın.' },
    ],
  },
  '/admin/global-search': {
    steps: [
      { title: 'Global Arama', body: 'Öğrenci, personel, veli ve kayıtlar arasında kurum genelinde arama yapın.' },
    ],
  },
  '/admin/password-reset-requests': {
    steps: [
      { title: 'Şifre Sıfırlama Talepleri', body: 'Kullanıcıların şifre sıfırlama talepleri buraya düşer; onaylayınca geçici şifre üretilir.' },
    ],
  },

  // ── Finans ────────────────────────────────────────────────────────────────
  '/finance/dashboard': {
    steps: [
      { title: 'Finans Özeti', body: 'Günlük/aylık tahsilat, bekleyen ve geciken taksitler, kasa dağılımı (nakit/kart) tek ekranda.' },
    ],
  },
  '/finance/student-accounts': {
    steps: [
      { title: 'Cari Hesaplar', body: 'Her öğrencinin sözleşme, taksit ve ödeme geçmişi.\n\n• Tahsilat: öğrenciyi seçin → "Ödeme Al" → tutar ve yöntem girin. Ödeme en eski vadeli taksitten başlayarak otomatik mahsup edilir.\n• Makbuz numarası otomatik verilir.' },
    ],
  },
  '/finance/collections': {
    steps: [
      { title: 'Tahsilatlar', body: 'Alınan tüm ödemeler: tarih, yöntem, makbuz no. İade gerekirse buradan işlenir; iade tutarı taksitlere ters dağıtılır ve denetim kaydına yazılır.' },
    ],
  },
  '/finance/installments': {
    steps: [
      { title: 'Taksitler', body: 'Tüm taksit planları vade sırasıyla. Durumlar: Bekliyor / Kısmi / Ödendi.' },
    ],
  },
  '/finance/late-payments': {
    steps: [
      { title: 'Geciken Ödemeler', body: 'Vadesi geçmiş taksitler ve gecikme yaşlandırması. Velilere hatırlatma bildirimi gönderebilirsiniz.' },
    ],
  },
  '/finance/invoices-receipts': {
    steps: [
      { title: 'Makbuz ve Faturalar', body: 'Kesilen makbuzların arşivi; yeniden yazdırma ve PDF indirme buradan.' },
    ],
  },
  '/finance/discounts-scholarships': {
    steps: [
      { title: 'İndirim ve Burslar', body: 'İndirim ve burs tanımları; sözleşmeye uygulandığında net tutar otomatik güncellenir.' },
    ],
  },
  '/finance/salary': {
    steps: [
      { title: 'Maaşlar', body: 'Personel maaş kayıtları ve ödeme takibi.' },
    ],
  },
  '/finance/cash-report': {
    steps: [
      { title: 'Kasa Raporu', body: 'Günlük kasa hareketleri: nakit/kart dağılımı ve gün sonu özeti.' },
    ],
  },
  '/finance/ledger': {
    steps: [
      { title: 'Cari Defter', body: 'Tüm finansal hareketlerin kronolojik dökümü; mutabakat için kullanın.' },
    ],
  },
  '/finance/audit-log': {
    steps: [
      { title: 'Finans Denetim Kaydı', body: 'Finansal işlemlerin izi: kim hangi tahsilatı/iadeyi ne zaman işledi. Yönetici ayrıca merkezi "Denetim Kayıtları" sayfasından tüm kategorileri görebilir.' },
    ],
  },
  '/finance/overdue-rules': {
    steps: [
      { title: 'Gecikme Kuralları', body: 'Gecikme bildirimi ve hatırlatma kurallarını tanımlayın; sistem otomatik uygular.' },
    ],
  },

  // ── Öğretmen ──────────────────────────────────────────────────────────────
  '/t/content': {
    steps: [
      { title: 'İçeriklerim', body: 'Ders materyallerinizi yükleyin (PDF, video, doküman) ve sınıflara paylaşın. Öğrenciler anında erişir; kim ne kadar izledi/inceledi takip edebilirsiniz.' },
    ],
  },
  '/t/question-bank': {
    steps: [
      { title: 'Soru Bankam', body: 'Kişisel soru havuzunuz.\n\n• Tek tek soru ekleyin ya da "Toplu Yükleme" ile içe aktarın.\n• Konu/zorluk etiketleyin.\n• Sorular sınav ve denemelerde tekrar kullanılabilir.' },
    ],
  },
  '/t/question-studio': {
    steps: [
      { title: 'Sınav Stüdyosu', body: 'Soru bankanızdan sınav derleyin: konu ve zorluk dağılımı seçin, sistem otomatik önerir; sürükle-bırak ile düzenleyin.' },
    ],
  },
  '/t/exams': {
    steps: [
      { title: 'Sınavlarım', body: 'Oluşturduğunuz sınavlar ve uygulama durumları. Online uygulanan sınavlarda sonuçlar otomatik hesaplanır.' },
    ],
  },
  '/t/mock-exams': {
    steps: [
      { title: 'Deneme Sınavları', body: 'Deneme oluşturun ve öğrencilere açın; sonuç analizleri sınıf ve öğrenci bazında hazırlanır.' },
    ],
  },
  '/t/grade-entry': {
    steps: [
      { title: 'Not Girişi', body: 'Sınıf seçin, sınav seçin, notları hızlıca girin. Kaydettiğinizde sonuçlar öğrenci ve veli paneline düşer.' },
    ],
  },
  '/t/assignments': {
    steps: [
      { title: 'Ödevler', body: 'Ödev oluşturun: sınıf, açıklama, son teslim tarihi. Teslimler "Teslim Merkezi"nde toplanır; oradan puan ve geri bildirim verirsiniz.' },
    ],
  },
  '/t/submissions': {
    steps: [
      { title: 'Teslim Merkezi', body: 'Tüm ödev teslimleri tek listede: bekleyenler, geç kalanlar, değerlendirilenler. Dosyayı açın, puan verin, geri bildirim yazın.' },
    ],
  },
  '/t/questions': {
    steps: [
      { title: 'Öğrenci Soruları', body: 'Öğrencilerin soru kutusundan gönderdiği sorular. Yanıtınız öğrenciye bildirimle ulaşır.' },
    ],
  },
  '/t/live-lessons': {
    steps: [
      { title: 'Canlı Dersler', body: 'Canlı ders oturumu planlayın ve başlatın; katılım kayıtları otomatik tutulur.' },
    ],
  },
  '/t/reports': {
    steps: [
      { title: 'Raporlarım', body: 'Sınıflarınızın sınav analizleri ve gelişim raporları; PDF alabilirsiniz.' },
    ],
  },
  '/t/duties': {
    steps: [
      { title: 'Nöbet ve Görevler', body: 'Size atanan nöbet ve görevler; takviminizle birlikte görünür.' },
    ],
  },
  '/t/announcements': {
    steps: [
      { title: 'Duyurularım', body: 'Sınıflarınıza duyuru yayınlayın.' },
    ],
  },
  '/t/profile': {
    steps: [
      { title: 'Profilim', body: 'Kişisel bilgileriniz ve şifre değişikliği.' },
    ],
  },

  // ── Öğrenci ───────────────────────────────────────────────────────────────
  '/s/dashboard': {
    steps: [
      { title: 'Ana Sayfan', body: 'Bugünkü dersler, yaklaşan sınavlar, bekleyen ödevler ve duyurular burada toplanır. Her sabah buraya bakman yeterli.' },
    ],
  },
  '/s/content': {
    steps: [
      { title: 'Ders İçerikleri', body: 'Öğretmenlerinin paylaştığı notlar ve videolar.\n\n• Yıldıza basarak favorilere ekle.\n• "Notlarım" ile içeriğe kendi notunu tut.\n• İzlediklerin otomatik işaretlenir.' },
    ],
  },
  '/s/assignments': {
    steps: [
      { title: 'Ödevlerin', body: 'Sana verilen ödevler ve teslim tarihleri. Dosya yükleyerek teslim et; öğretmenin puan ve geri bildirimini burada görürsün.' },
    ],
  },
  '/s/exams': {
    steps: [
      { title: 'Sınavların', body: 'Yaklaşan sınavlar ve online sınav girişleri. Online sınavda süre dolunca cevapların otomatik kaydedilir.' },
    ],
  },
  '/s/mock-exams': {
    steps: [
      { title: 'Denemeler', body: 'Açık denemeleri çöz; biter bitmez sonucunu ve çözüm analizini gör.' },
    ],
  },
  '/s/exam-results': {
    steps: [
      { title: 'Sonuçların', body: 'Tüm sınav sonuçların ve ders bazında gelişim grafiğin.' },
    ],
  },
  '/s/wrong-answers': {
    steps: [
      { title: 'Yanlışlarım', body: 'Yanlış yaptığın sorular otomatik burada birikir. Tekrar çöz, doğru yapınca listeden düşer — eksik kapatmanın en hızlı yolu.' },
    ],
  },
  '/s/study-plan': {
    steps: [
      { title: 'Çalışma Planın', body: 'Haftalık çalışma planını oluştur ve tamamladıklarını işaretle. Rehber öğretmenin de sana plan atayabilir.' },
    ],
  },
  '/s/question-box': {
    steps: [
      { title: 'Soru Kutusu', body: 'Takıldığın soruyu yaz ya da fotoğrafını yükle, öğretmenine gönder. Yanıt gelince bildirim alırsın.' },
    ],
  },
  '/s/question-practice': {
    steps: [
      { title: 'Soru Pratiği', body: 'Konu seçip soru çöz; doğru/yanlış istatistiklerin birikir ve zayıf konuların ortaya çıkar.' },
    ],
  },
  '/s/schedule': {
    steps: [
      { title: 'Ders Programın', body: 'Haftalık programın. Değişiklikler anında yansır.' },
    ],
  },
  '/s/attendance': {
    steps: [
      { title: 'Devamsızlığın', body: 'Yoklama geçmişin gün gün burada.' },
    ],
  },
  '/s/badges': {
    steps: [
      { title: 'Rozetlerin', body: 'Çalıştıkça rozet kazanırsın: soru çözme serileri, ödev teslimleri ve deneme başarıları rozet getirir. 🏅' },
    ],
  },
  '/s/library': {
    steps: [
      { title: 'Kütüphane', body: 'Kütüphanedeki kitapları ara, ödünç aldıklarını ve iade tarihlerini gör.' },
    ],
  },

  // ── Veli ──────────────────────────────────────────────────────────────────
  '/p/dashboard': {
    steps: [
      { title: 'Genel Durum', body: 'Çocuğunuzun günlük özeti: bugünkü yoklama, son sınav sonuçları, yaklaşan ödemeler ve duyurular.' },
    ],
  },
  '/p/attendance': {
    steps: [
      { title: 'Devamsızlık', body: 'Gün gün yoklama kayıtları. Devamsızlık işlendiğinde anında bildirim alırsınız. Mazeret bildirmek için "Mazeret Bildir" sayfasını kullanın.' },
    ],
  },
  '/p/exams': {
    steps: [
      { title: 'Sınav Sonuçları', body: 'Çocuğunuzun tüm sınav sonuçları ve gelişim grafikleri.' },
    ],
  },
  '/p/payments': {
    steps: [
      { title: 'Ödemeler', body: 'Taksit planı, ödenenler ve kalan bakiye. Geciken taksit olursa burada işaretlenir; makbuzlar "Makbuzlar" sayfasında.' },
    ],
  },
  '/p/children': {
    steps: [
      { title: 'Çocuklarım', body: 'Kayıtlı tüm çocuklarınız; aralarında geçiş yaparak her birinin bilgilerini görürsünüz.' },
    ],
  },
  '/p/meetings': {
    steps: [
      { title: 'Görüşmeler', body: 'Öğretmenle görüşme talebi oluşturun; onay durumunu buradan izleyin.' },
    ],
  },
  '/p/weekly-report': {
    steps: [
      { title: 'Haftalık Rapor', body: 'Çocuğunuzun haftalık özeti: devamsızlık, sınavlar, ödev durumu tek raporda.' },
    ],
  },
  '/p/excuse-request': {
    steps: [
      { title: 'Mazeret Bildir', body: 'Devamsızlık için mazeret bildirin; okul yönetimi onayladığında devamsızlık mazeretli sayılır.' },
    ],
  },
  '/p/receipts': {
    steps: [
      { title: 'Makbuzlar', body: 'Yaptığınız ödemelerin makbuzları; PDF indirebilirsiniz.' },
    ],
  },
  '/p/service': {
    steps: [
      { title: 'Servis', body: 'Çocuğunuzun servis güzergahı, aracı ve şoför bilgisi.' },
    ],
  },
  '/p/academic': {
    steps: [
      { title: 'Akademik Durum', body: 'Ders bazında akademik gelişim ve öğretmen değerlendirmeleri.' },
    ],
  },

  // ── Rehberlik ─────────────────────────────────────────────────────────────
  '/g/dashboard': {
    steps: [
      { title: 'Rehberlik Özeti', body: 'Bekleyen randevular, günün görüşmeleri ve takip ettiğiniz öğrenciler.' },
    ],
  },
  '/g/sessions': {
    steps: [
      { title: 'Görüşme Kayıtları', body: 'Öğrenci görüşmelerinizi kaydedin. Not görünürlüğü sizde: "Özel" notları yalnızca siz görürsünüz; "Paylaşımlı" notlar yönetimle paylaşılır.' },
    ],
  },
  '/g/appointments': {
    steps: [
      { title: 'Randevular', body: 'Öğrenci ve velilerden gelen randevu talepleri; onaylayın ya da yeni zaman önerin.' },
    ],
  },
  '/g/inventories': {
    steps: [
      { title: 'Envanterler', body: 'Test/envanter uygulayın; sonuçlar öğrencinin rehberlik dosyasına işlenir.' },
    ],
  },
  '/g/planner': {
    steps: [
      { title: 'Çalışma Planlayıcı', body: 'Öğrenciye özel haftalık çalışma planı hazırlayın; öğrenci kendi panelinden takip eder.' },
    ],
  },
  '/g/reports': {
    steps: [
      { title: 'Rehberlik Raporları', body: 'Görüşme yoğunluğu ve öğrenci gelişim raporları.' },
    ],
  },

  // ── Kütüphane ────────────────────────────────────────────────────────────
  '/library': {
    steps: [
      { title: 'Kütüphane Yönetimi', body: 'Kitap ekleyin (ISBN ile otomatik bilgi çekilir), ödünç verin, iadeleri takip edin. Geciken iadeler için ceza hesaplanır ama finansa otomatik işlenmez — kararı siz verirsiniz.' },
    ],
  },

  // ── Süper Admin ───────────────────────────────────────────────────────────
  '/sa/dashboard': {
    steps: [
      { title: 'Platform Özeti', body: 'Tüm kurumların toplam metrikleri: aktif kurum, kullanıcı sayısı, sistem durumu.' },
    ],
  },
  '/sa/tenants': {
    steps: [
      { title: 'Kurum Yönetimi', body: 'Kurum başvurularını onaylayın/reddedin; kurum bazında modül (özellik) açıp kapatın.' },
    ],
  },
  '/sa/logs': {
    steps: [
      { title: 'Platform Log Merkezi', body: 'Tüm kurumların denetim kayıtları tek yerde.\n\n• Üstteki kartlardan kurum seçin — logları o kuruma filtrelenir.\n• Kurum seçince şube butonları belirir; şube şube inceleyin.\n• Arama kutusu kişi/işlem/detay metninde çalışır.\n• Kurum yöneticileri aynı kayıtları kendi panellerindeki "Denetim Kayıtları" sayfasında görür (yalnızca kendi kurumları).' },
    ],
  },
  '/sa/plans': {
    steps: [
      { title: 'Paketler', body: 'Abonelik paketlerini ve içerdikleri modülleri tanımlayın.' },
    ],
  },
  '/sa/billing': {
    steps: [
      { title: 'Faturalama', body: 'Kurum abonelik faturaları ve ödeme durumları.' },
    ],
  },
  '/sa/limits': {
    steps: [
      { title: 'Limitler', body: 'Kurum bazında kota ve limit ayarları.' },
    ],
  },
  '/sa/system': {
    steps: [
      { title: 'Sistem Ayarları', body: 'Platform geneli yapılandırma: bakım modu, sürüm bilgileri, genel ayarlar.' },
    ],
  },
  '/sa/support': {
    steps: [
      { title: 'Destek Talepleri', body: 'Kurumlardan gelen destek talepleri; yanıtlayın ve durumu güncelleyin.' },
    ],
  },
  '/sa/customization': {
    steps: [
      { title: 'Kurum Özelleştirme', body: 'Kurum bazında marka rengi, logo ve görünüm ayarları.' },
    ],
  },
  '/sa/ai': {
    steps: [
      { title: 'AI Yönetimi', body: 'Yapay zeka özelliklerinin kurum bazında yönetimi ve kullanım istatistikleri.' },
    ],
  },

  // ── Yemekhane ────────────────────────────────────────────────────────────
  '/cafeteria/menu': {
    steps: [
      { title: 'Haftalık Menü', body: 'Haftalık yemek menüsünü girin; öğrenci ve veli panellerinde otomatik yayınlanır.' },
    ],
  },
};

const AREA_GUIDES = {
  institution: {
    overview: 'Bu ekran kurum sahibinin akademik, idari ve operasyonel kararlarını tek bir iş akışında yürütmesi için hazırlanmıştır. Gösterilen kayıtlar aktif kurum ve seçili şube kapsamına göre sunulur.',
    workflow: 'Önerilen kullanım sırası:\n\n1. Üst bölümdeki özet ve uyarıları kontrol edin.\n2. Tarih, şube, sınıf veya durum filtreleri varsa çalışma kapsamını belirleyin.\n3. Listeden ilgili kaydı açıp ayrıntıları doğrulayın.\n4. Değişiklikten sonra sayaç, durum rozeti ve işlem geçmişini yeniden kontrol edin.',
    controls: 'Arama ve filtreleri birlikte kullanarak doğru kayıt kümesine ulaşın. Bir karta veya satıra tıkladığınızda açılan detay ekranında kişi, şube, tarih ve durum bilgisini işlem yapmadan önce karşılaştırın. Boş sonuç görürseniz önce aktif filtreleri temizleyin.',
    safety: 'Kurum ve şube izolasyonu sunucuda uygulanır. Kullanıcıya yalnız rolünün ve paketinin izin verdiği işlemler gösterilir. Pasife alma, yetki, finans ve kayıt değişiklikleri denetim izine yazılır; kalıcı geçmiş gerektiğinde silmek yerine pasife alma akışını kullanın.',
  },
  finance: {
    overview: 'Bu ekran sözleşme, taksit, tahsilat, gider ve mutabakat süreçlerinin ilgili bölümünü yönetir. Tutarları değerlendirirken seçili dönem, ödeme durumu ve şube kapsamını birlikte okuyun.',
    workflow: 'Önerilen finans akışı:\n\n1. Öğrenci veya sözleşmeyi doğrulayın.\n2. Vade, kalan tutar ve önceki tahsilatları inceleyin.\n3. İşlem türünü ve ödeme yöntemini seçin.\n4. Kaydettikten sonra bakiye, taksit durumu ve makbuz hareketini karşılaştırın.\n5. Gün sonunda kasa ve mutabakat raporunu kontrol edin.',
    controls: 'Dönem, durum, sınıf, şube ve metin filtreleri birbirini tamamlar. “Geciken” geçmiş vadeli açık alacağı; “bekleyen” ise seçilen dönemde vadesi gelecek açık alacağı ifade eder. İade veya düzeltme öncesinde orijinal makbuz ve işlem referansını açın.',
    safety: 'Finans kayıtları kurum/şube kapsamında tutulur ve yetkisiz rollerden gizlenir. Tahsilat ve iade gibi kritik hareketler denetim kaydına yazılır. Yanlış kaydı silmek yerine desteklenen iade/düzeltme akışını kullanarak mali izi koruyun.',
  },
  teacher: {
    overview: 'Bu ekran öğretmenin ders, içerik, sınav, ödev veya öğrenci takibi görevlerinden birini yürütür. Görünen sınıflar ve öğrenciler yalnız öğretmenin yetkili olduğu ders kapsamından gelir.',
    workflow: 'Önerilen öğretmen akışı:\n\n1. Sınıf, ders ve tarih seçimini doğrulayın.\n2. Bekleyen öğrenci işlerini ve son teslimleri inceleyin.\n3. İçerik/not/sonuç girişini tamamlayın.\n4. Kaydetme sonrasında yayın ve görünürlük durumunu kontrol edin.\n5. Gerekliyse öğrenci veya veliye açıklayıcı geri bildirim gönderin.',
    controls: 'Sınıf ve ders filtreleri yanlış gruba işlem yapılmasını önler. Taslak, yayınlandı ve tamamlandı durumlarını birbirinden ayırın. Toplu işlemden önce listede görünen öğrenci sayısı ile hedef sınıf mevcudunu karşılaştırın.',
    safety: 'Öğrenci notları, yoklama ve kişisel geri bildirimler eğitim kaydıdır. Yalnız yetkili sınıf ve derslerde işlem yapın; hassas öğrenci bilgilerini serbest açıklama alanlarına gereksiz yere yazmayın.',
  },
  student: {
    overview: 'Bu sayfa öğrencinin ders, ödev, sınav, içerik veya kişisel gelişim sürecinin ilgili bölümünü gösterir. Bilgiler yalnız kendi hesabınıza ve sınıfınıza aittir.',
    workflow: 'Önerilen kullanım:\n\n1. Yaklaşan tarihleri ve öğretmen açıklamalarını okuyun.\n2. İlgili ders veya konu filtresini seçin.\n3. Çalışmanızı tamamlayıp teslim/yayın durumunu kontrol edin.\n4. Sonuç veya geri bildirim geldiyse eksik konuları çalışma planınıza ekleyin.',
    controls: 'Tarih, ders ve durum filtreleri yoğun listeleri sadeleştirir. Taslak bir çalışmanın teslim edilmiş sayılmadığını; süreli sınavlarda sayacın sınav başladıktan sonra durdurulamayabileceğini unutmayın.',
    safety: 'Hesap ve sınav güvenliğiniz için şifrenizi paylaşmayın. Yüklediğiniz dosyada gereksiz kişisel bilgi bulunmamasına dikkat edin; yalnız kendi kayıtlarınıza erişebilirsiniz.',
  },
  parent: {
    overview: 'Bu ekran velinin seçili öğrencisine ait akademik, devam, iletişim veya ödeme bilgisini gösterir. Birden fazla çocuğunuz varsa işlem öncesinde doğru öğrencinin seçili olduğunu kontrol edin.',
    workflow: 'Önerilen veli akışı:\n\n1. Öğrenci seçimini doğrulayın.\n2. Güncel uyarı ve son tarihleri inceleyin.\n3. Gerekli belge, mazeret veya görüşme talebini açıklamasıyla gönderin.\n4. Talebin onay durumunu ve okuldan gelen yanıtı takip edin.',
    controls: 'Tarih ve durum filtreleri geçmiş ile güncel kayıtları ayırır. Bir sonuca itiraz veya açıklama gerekiyorsa ilgili kaydı açarak öğretmen/yönetim iletişim kanalını kullanın.',
    safety: 'Yalnız size bağlı öğrencilerin kayıtları gösterilir. Sağlık, rehberlik ve finans bilgilerini ekran görüntüsü olarak gereksiz kişilerle paylaşmayın; resmi iletişim için uygulamadaki güvenli kanalları kullanın.',
  },
  guidance: {
    overview: 'Bu ekran rehberlik görüşmeleri, randevular, envanterler ve öğrenci takip planlarının ilgili bölümünü yönetir. Görünürlük, rehberlik rolü ve kayıt gizlilik seviyesiyle sınırlandırılır.',
    workflow: 'Önerilen rehberlik akışı:\n\n1. Öğrenci ve randevu bağlamını doğrulayın.\n2. Önceki görüşme ve takip hedeflerini inceleyin.\n3. Görüşme sonucunu uygun gizlilik seviyesiyle kaydedin.\n4. Takip tarihi ve gerekiyorsa yönlendirme oluşturun.\n5. Raporlarda yalnız gerekli toplulaştırılmış bilgiyi paylaşın.',
    controls: 'Randevu durumu, tarih ve öğrenci filtrelerini kullanın. “Özel” not ile yönetimle paylaşılabilen notu bilinçli seçin; görüşme kaydını tamamlamadan önce takip tarihini doğrulayın.',
    safety: 'Rehberlik notları hassas kişisel veridir. Gereksiz tanı veya özel hayat ayrıntısı yazmayın, yalnız görev amacıyla erişin ve paylaşım seviyesini her kayıtta kontrol edin.',
  },
  platform: {
    overview: 'Bu ekran platform yöneticisinin kurum, paket, sistem sağlığı veya destek süreçlerinden birini yönetir. İşlemler tek bir kurumu değil platform genelini etkileyebilir.',
    workflow: 'Önerilen platform akışı:\n\n1. Hedef kurum ve ortamı doğrulayın.\n2. Mevcut yapılandırmayı ve son denetim kayıtlarını inceleyin.\n3. Değişikliği en dar kapsamda uygulayın.\n4. Sonuç metriklerini ve hata kayıtlarını kontrol edin.\n5. Geri dönüş gerektirecek değişiklikleri açıklamasıyla belgeleyin.',
    controls: 'Kurum, plan, durum ve tarih filtrelerini birlikte kullanın. Toplu işlemden önce hedef kurum sayısını ve seçili modülleri yeniden kontrol edin.',
    safety: 'Platform yetkileri yüksek etkilidir. Kurum izolasyonunu aşan işlemleri yalnız açık operasyon gerekçesiyle yapın; rol, paket, bakım ve erişim değişikliklerinin denetim kaydını kontrol edin.',
  },
};

const ROLE_PAGE_TIPS = {
  admin: 'Kurum sahibi için öneri: güne Dashboard uyarılarıyla başlayın; şube, personel ve finans değişikliklerinden sonra Kayıt Geçmişi sayfasından işlemin doğru kullanıcı ve kapsamla yazıldığını doğrulayın.',
  branchmanager: 'Şube yöneticisi için öneri: üst bölümde seçili şubeyi kontrol edin. Kurum geneline ait olduğunu düşündüğünüz bir kayıt görünmüyorsa yetki genişletmeye çalışmak yerine kurum sahibiyle kapsam atamasını doğrulayın.',
  administrative: 'İdari personel için öneri: kayıt ve belge işlemlerinde kişi bilgilerini iki kez doğrulayın; yetkiniz dışındaki finans veya rol işlemlerini ilgili birime yönlendirin.',
  finance: 'Muhasebe için öneri: her tahsilat gününde makbuz, kalan bakiye ve kasa yöntemini birlikte kontrol edin; düzeltmeleri silme yerine iade veya karşı kayıtla yapın.',
  teacher: 'Öğretmen için öneri: sınıf ve ders kapsamını doğrulamadan toplu not, yoklama veya yayın işlemi başlatmayın.',
  student: 'Öğrenci için öneri: tarih sırasına göre yaklaşan işleri tamamlayın ve teslimden sonra durumun “gönderildi/tamamlandı” olduğunu kontrol edin.',
  parent: 'Veli için öneri: birden fazla öğrenciniz varsa mesaj, mazeret ve ödeme işleminden önce üstteki öğrenci seçimini kontrol edin.',
  counselor: 'Rehberlik için öneri: her görüşmede görünürlük seviyesini seçin ve yalnız takip için gerekli bilgileri kaydedin.',
  superadmin: 'Platform yöneticisi için öneri: hedef kurum, ortam ve etki alanını değişiklikten önce ve sonra doğrulayın.',
};

const WELCOME_PLAYBOOKS = {
  admin: [
    { title: 'İlk kurulum sırası', body: 'Kurumunuzu güvenli bir veri yapısıyla başlatmak için Dashboard üzerindeki kurulum kartını izleyin:\n\n1. Şubeyi ve sorumlusunu kaydedin.\n2. Sınıfları tanımlayın.\n3. Öğretmen kadrosunu ekleyin.\n4. Haftalık ders programını kurun.\n5. İlk öğrenci kaydıyla ücret sözleşmesi ve taksit planını oluşturun.\n\nHer adım gerçek kurum verisinden otomatik tamamlanır; ayrıca “tamamlandı” işaretlemeniz gerekmez.' },
    { title: 'Kurum sahibinin günlük kontrolü', body: 'Her gün Dashboard dönemini “Günlük” bırakıp devamsızlık, bekleyen tahsilat ve operasyon uyarılarını inceleyin. Ardından görev/onay akışını temizleyin. Haftalık görünümde personel ve akademik eğilimi, aylık görünümde seçtiğiniz ayın tahsilat–gider dengesini kontrol edin.' },
    { title: 'Şube, rol ve denetim güvenliği', body: 'Şubeler veri sınırıdır; personele doğru şube ve rol atamak görünürlük açısından kritiktir. Kurumdan ayrılan hesabı silmek yerine pasife alın. Rol, şube, kayıt ve finans değişikliklerini Kayıt Geçmişi ekranında kullanıcı, zaman ve kapsam bilgileriyle doğrulayın.' },
  ],
};

function areaFor(pathname) {
  if (pathname.startsWith('/finance/')) return 'finance';
  if (pathname.startsWith('/t/')) return 'teacher';
  if (pathname.startsWith('/s/')) return 'student';
  if (pathname.startsWith('/p/')) return 'parent';
  if (pathname.startsWith('/g/')) return 'guidance';
  if (pathname.startsWith('/sa/')) return 'platform';
  return 'institution';
}

function readablePageName(pathname, config) {
  const configuredTitle = config?.steps?.[0]?.title;
  if (configuredTitle) return configuredTitle;
  const segment = pathname.split('/').filter(Boolean).at(-1) || 'dashboard';
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('tr-TR'));
}

function matchingPageConfig(pathname) {
  if (PAGE_TOURS[pathname]) return PAGE_TOURS[pathname];
  const prefix = Object.keys(PAGE_TOURS)
    .filter((path) => pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? PAGE_TOURS[prefix] : null;
}

function roleTip(roles) {
  const set = new Set(roles || []);
  const order = ['superadmin', 'admin', 'branchmanager', 'finance', 'administrative', 'counselor', 'teacher', 'student', 'parent'];
  return ROLE_PAGE_TIPS[order.find((role) => set.has(role))] || 'Bu sayfada yalnız rolünüzün izin verdiği kayıt ve işlemler görünür. Emin olmadığınız kritik işlemlerde kurum yöneticinizle kapsamı doğrulayın.';
}

// Rol anahtarı → karşılama turu. BranchManager admin menüsünü kullanır.
export function findWelcomeTour(roles) {
  const order = ['superadmin', 'admin', 'counselor', 'teacher', 'finance', 'administrative', 'cafeteria', 'student', 'parent'];
  const set = new Set(roles);
  const key = set.has('branchmanager') ? 'admin' : order.find((role) => set.has(role));
  if (!key) return null;
  const tour = WELCOME_TOURS[key];
  const extra = WELCOME_PLAYBOOKS[key] || [
    { title: 'Önerilen günlük çalışma', body: roleTip(roles) },
    { title: 'Güvenli kullanım', body: 'Her işlemden önce seçili kişi, tarih, kurum/şube ve durum bilgisini doğrulayın. Rolünüz dışında kalan bir işlem gerektiğinde hesabı veya kapsamı değiştirmeye çalışmak yerine yetkili birime yönlendirin.' },
  ];
  return { ...tour, id: `${tour.id}:v2`, steps: [...tour.steps, ...extra] };
}

export function findPageTour(pathname, roles = []) {
  if (!pathname || pathname === '/') return null;
  const config = matchingPageConfig(pathname);
  const area = AREA_GUIDES[areaFor(pathname)];
  const title = readablePageName(pathname, config);
  const specificSteps = config?.steps || [
    { title, body: area.overview },
  ];
  const detailSteps = [
    { title: `${title}: önerilen iş akışı`, body: area.workflow },
    { title: 'Filtreler, detaylar ve doğrulama', body: area.controls },
    { title: 'Güvenli ve izlenebilir kullanım', body: area.safety },
    { title: 'Rolünüz için pratik öneri', body: roleTip(roles) },
  ];
  return { id: `page:v3:${pathname}`, steps: [...specificSteps, ...detailSteps] };
}
