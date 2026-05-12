import {
  Bell,
  CheckSquare,
  Gavel,
  Lock,
  ShieldCheck,
} from "lucide-react";

export const legalConsentVersion = "2026-05-02.kvkk.v1";

export const legalDocuments = [
  {
    title: "KVKK Aydınlatma Metni",
    summary:
      "Kişisel verilerin kim tarafından, hangi amaçlarla, hangi hukuki sebeplerle işlendiğini ve haklarınızı açıklar.",
    icon: ShieldCheck,
    sections: [
      {
        title: "Veri sorumlusu",
        bullets: [
          "CourseIntellect platformunu kullanan eğitim kurumu veri sorumlusudur. Uygulama geliştiricisi ve teknik hizmet sağlayıcılar, kurumun talimatları doğrultusunda veri işleyen olarak görev alabilir.",
          "Kurum adı, adresi, iletişim kanalı ve varsa temsilci bilgileri kurum tarafından tamamlanmalıdır.",
        ],
      },
      {
        title: "İşlenen veri kategorileri",
        bullets: [
          "Kimlik ve iletişim bilgileri: ad soyad, kullanıcı adı, e-posta, telefon, veli/öğrenci bağlantısı.",
          "Eğitim ve operasyon bilgileri: sınıf, şube, devamsızlık, sınav, ödev, içerik kullanımı, görüşme ve duyuru kayıtları.",
          "Finans bilgileri: tahsilat, taksit, fatura, makbuz ve bakiye bilgileri.",
          "Teknik güvenlik bilgileri: oturum, cihaz, bildirim tokenı, IP, işlem zamanı ve denetim kayıtları.",
          "Özel nitelikli veri işlenmesi gerekiyorsa yalnızca KVKK madde 6 kapsamındaki şartlarla ve gerekli güvenlik tedbirleriyle işlenir.",
        ],
      },
      {
        title: "Amaçlar ve hukuki sebepler",
        bullets: [
          "Eğitim hizmetinin yürütülmesi, öğrenci gelişiminin takip edilmesi, veli bilgilendirmesi, ölçme-değerlendirme, finans ve muhasebe süreçlerinin işletilmesi.",
          "Hukuki sebepler: sözleşmenin kurulması veya ifası, kanuni yükümlülük, hakkın tesisi/kullanılması/korunması, meşru menfaat ve gerekli hallerde açık rıza.",
          "Açık rızaya dayalı işlemler, aydınlatma metninden ayrı şekilde ve belirli konular için alınır.",
        ],
      },
      {
        title: "Aktarım ve saklama",
        bullets: [
          "Veriler; yetkili kamu kurumları, ödeme/finans hizmet sağlayıcıları, bildirim altyapısı, barındırma, yedekleme ve teknik destek sağlayıcılarıyla amaçla sınırlı paylaşılabilir.",
          "Yurt dışına aktarım gerekiyorsa KVKK madde 9 kapsamındaki aktarım şartları ve gerekli güvenceler sağlanmadan aktarım yapılmamalıdır.",
          "Veriler, ilgili mevzuatta öngörülen süre veya işleme amacı için gerekli süre boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir.",
        ],
      },
      {
        title: "İlgili kişi hakları",
        bullets: [
          "KVKK madde 11 kapsamında verinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amaca uygun kullanımı öğrenme, aktarılan üçüncü kişileri bilme hakkınız vardır.",
          "Eksik veya yanlış verilerin düzeltilmesini, şartları varsa silinmesini veya yok edilmesini, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteyebilirsiniz.",
          "Otomatik analiz sonucuna itiraz edebilir, kanuna aykırı işleme nedeniyle zarara uğramanız halinde tazminat talep edebilirsiniz.",
        ],
      },
    ],
  },
  {
    title: "Açık Rıza ve İzin Tercihleri",
    summary:
      "Zorunlu hizmet süreçleri dışında kalan bildirim, iletişim ve bazı veri kullanımları için ayrı tercih verir.",
    icon: CheckSquare,
    sections: [
      {
        title: "Zorunlu olmayan açık rıza konuları",
        bullets: [
          "Kampanya, tanıtım, etkinlik ve ticari elektronik ileti gönderilmesi.",
          "Mobil/masaüstü anlık bildirimlerle duyuru, ödeme hatırlatma, sınav, ödev ve görüşme bilgilendirmesi yapılması.",
          "Hizmet kalitesini artırmak için kullanım istatistiklerinin toplulaştırılmış analizlerde kullanılması.",
        ],
      },
      {
        title: "Rızanın niteliği",
        bullets: [
          "Açık rıza belirli bir konuya ilişkin, bilgilendirmeye dayalı ve özgür iradeyle verilmelidir.",
          "Rıza vermemeniz, zorunlu eğitim ve hesap hizmetlerini kullanmanıza tek başına engel değildir; yalnızca ilgili isteğe bağlı işlem yapılmaz.",
          "Açık rızanızı dilediğiniz zaman geri alabilirsiniz. Geri alma ileriye dönük sonuç doğurur.",
        ],
      },
    ],
  },
  {
    title: "Kullanım Koşulları",
    summary:
      "Hesap güvenliği, yetkili kullanım, içerik paylaşımı ve kurum kurallarına ilişkin temel şartları içerir.",
    icon: Gavel,
    sections: [
      {
        title: "Hesap ve güvenlik",
        bullets: [
          "Kullanıcı hesabı kişiye özeldir; parola, doğrulama kodu ve oturum bilgileri üçüncü kişilerle paylaşılmamalıdır.",
          "Yetkisiz erişim, veri indirme, ekran görüntüsüyle kişisel veri yayma veya başka kullanıcı adına işlem yapma yasaktır.",
          "Kurum, güvenlik ve denetim amacıyla işlem kayıtlarını tutabilir.",
        ],
      },
      {
        title: "İçerik ve sorumluluk",
        bullets: [
          "Ders materyali, sınav, mesaj, belge ve duyuru içerikleri yalnızca eğitim ve kurum süreçleri için kullanılmalıdır.",
          "Kişisel veri, özel nitelikli veri veya üçüncü kişilere ait gizli bilgi paylaşırken asgari veri ilkesi gözetilmelidir.",
          "Kurum, mevzuat ve iç politika gereği aykırı içerikleri kaldırabilir veya erişimi sınırlandırabilir.",
        ],
      },
    ],
  },
  {
    title: "Gizlilik ve Çerez/Bildirim Politikası",
    summary:
      "Oturum, cihaz, yerel depolama, bildirim tokenı ve güvenlik kayıtlarının nasıl kullanıldığını açıklar.",
    icon: Lock,
    sections: [
      {
        title: "Teknik veriler",
        bullets: [
          "Uygulama oturum bilgisini, tema tercihini, yasal onay durumunu ve bildirim ayarlarını cihazda güvenli yerel depolamada saklayabilir.",
          "Bildirimlerin çalışması için cihaz bildirim tokenı ve platform bilgisi sunucuya kaydedilebilir.",
          "Güvenlik, hata giderme ve denetim amacıyla IP, cihaz, tarih-saat ve işlem kayıtları tutulabilir.",
        ],
      },
      {
        title: "Bildirimler",
        bullets: [
          "İşlem güvenliği, hesap, ders, sınav, ödeme ve kurum duyuruları hizmetin parçası olarak gönderilebilir.",
          "Tanıtım veya kampanya niteliğindeki iletiler için ayrı açık rıza/iletişim izni gerekir.",
          "Cihaz bildirim izni işletim sistemi ayarlarından ayrıca kapatılabilir.",
        ],
      },
    ],
  },
];

export const optionalConsentItems = [
  {
    key: "marketing",
    title: "Ticari/etkinlik ileti izni",
    description:
      "Kampanya, etkinlik ve tanıtım amaçlı e-posta/SMS gönderimine açık rıza veriyorum.",
    icon: Bell,
  },
  {
    key: "push",
    title: "Masaüstü bildirim izni",
    description:
      "Duyuru, sınav, ödev, ödeme ve görüşme hatırlatmalarının masaüstü bildirimiyle gönderilmesine izin veriyorum.",
    icon: Bell,
  },
  {
    key: "analytics",
    title: "Kullanım analitiği izni",
    description:
      "Hizmet kalitesini artırmak için kullanım verilerimin toplulaştırılmış analizlerde kullanılmasına izin veriyorum.",
    icon: ShieldCheck,
  },
];
