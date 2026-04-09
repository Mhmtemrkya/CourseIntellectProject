import type { SiteContent } from "@/types/content"

export const defaultContent: SiteContent = {
  navbar: {
    logoText: "CourseIntellect",
    links: [
      { id: "1", label: "Anasayfa", href: "/" },
      { id: "2", label: "Özellikler", href: "/ozellikler" },
      { id: "3", label: "Fiyatlar", href: "/fiyatlar" },
      { id: "4", label: "İndir", href: "/indir" },
      { id: "5", label: "İletişim", href: "/iletisim" },
    ],
    ctaButton: { text: "Hemen Başla", href: "/indir" },
  },

  homepage: {
    hero: {
      badge: "Yeni Nesil Eğitim Platformu",
      title: "Eğitimde Yeni Nesil Deneyim",
      subtitle:
        "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu. Ders takibi, anlık bildirimler ve detaylı raporlarla eğitimi kolaylaştırın.",
      primaryCTA: { text: "Ücretsiz Dene", href: "/indir" },
      secondaryCTA: { text: "Demo İzle", href: "#demo" },
    },
    stats: [
      { id: "1", value: 50000, suffix: "+", label: "Aktif Kullanıcı" },
      { id: "2", value: 500, suffix: "+", label: "Okul" },
      { id: "3", value: 98, suffix: "%", label: "Memnuniyet" },
      { id: "4", value: 1000000, suffix: "+", label: "Ders Saati" },
    ],
    features: {
      sectionTitle: "Güçlü Özellikler",
      sectionSubtitle: "Eğitim süreçlerinizi kolaylaştıran kapsamlı araçlar",
      items: [
        {
          id: "1",
          icon: "BookOpen",
          title: "Akıllı Ders Takibi",
          description: "Derslerinizi planlayın, takip edin ve öğrenci ilerlemesini anlık izleyin.",
          category: "teacher",
        },
        {
          id: "2",
          icon: "Bell",
          title: "Anlık Bildirimler",
          description: "Ödev, sınav ve duyurulardan anında haberdar olun.",
          category: "all",
        },
        {
          id: "3",
          icon: "BarChart3",
          title: "Detaylı Raporlar",
          description: "Performans analizleri ve özelleştirilebilir raporlar oluşturun.",
          category: "admin",
        },
        {
          id: "4",
          icon: "Users",
          title: "Veli Portalı",
          description: "Veliler çocuklarının eğitim sürecini yakından takip edebilir.",
          category: "parent",
        },
        {
          id: "5",
          icon: "Calendar",
          title: "Takvim Yönetimi",
          description: "Sınav, ödev ve etkinlik takvimini kolayca yönetin.",
          category: "all",
        },
        {
          id: "6",
          icon: "MessageSquare",
          title: "Anlık Mesajlaşma",
          description: "Öğretmen, öğrenci ve veliler arasında güvenli iletişim.",
          category: "all",
        },
        {
          id: "7",
          icon: "FileText",
          title: "Ödev Yönetimi",
          description: "Ödevleri oluşturun, dağıtın ve değerlendirin.",
          category: "teacher",
        },
        {
          id: "8",
          icon: "Award",
          title: "Başarı Rozetleri",
          description: "Öğrencileri motive eden gamification özellikleri.",
          category: "student",
        },
      ],
    },
    platforms: {
      sectionTitle: "Her Platformda Yanınızda",
      sectionSubtitle: "Masaüstü ve mobil uygulamalarımızla her yerden erişin",
      desktop: {
        id: "desktop",
        name: "Masaüstü Uygulaması",
        description: "Windows ve macOS için güçlü masaüstü uygulaması. .NET MAUI teknolojisi ile geliştirildi.",
        icon: "Monitor",
        downloadUrl: "/indir",
        version: "2.1.0",
        requirements: ["Windows 10/11 veya macOS 12+", "4 GB RAM", "500 MB disk alanı"],
      },
      mobile: {
        id: "mobile",
        name: "Mobil Uygulama",
        description: "iOS ve Android için optimize edilmiş mobil uygulama. Flutter ile geliştirildi.",
        icon: "Smartphone",
        downloadUrl: "/indir",
        version: "2.1.0",
        requirements: ["iOS 14+ veya Android 8+", "2 GB RAM", "150 MB depolama"],
      },
    },
    howItWorks: {
      sectionTitle: "Nasıl Çalışır?",
      sectionSubtitle: "3 kolay adımda başlayın",
      steps: [
        {
          id: "1",
          step: 1,
          title: "Hesap Oluşturun",
          description: "Ücretsiz hesabınızı oluşturun ve okulunuzu kaydedin.",
        },
        {
          id: "2",
          step: 2,
          title: "Kurulum Yapın",
          description: "Sınıflarınızı, öğrencilerinizi ve derslerinizi ekleyin.",
        },
        {
          id: "3",
          step: 3,
          title: "Kullanmaya Başlayın",
          description: "Hemen eğitim süreçlerinizi yönetmeye başlayın.",
        },
      ],
    },
    testimonials: {
      sectionTitle: "Kullanıcılarımız Ne Diyor?",
      sectionSubtitle: "Binlerce eğitimcinin güvendiği platform",
      items: [
        {
          id: "1",
          name: "Ahmet Yılmaz",
          role: "Matematik Öğretmeni",
          company: "Ankara Koleji",
          quote:
            "CourseIntellect sayesinde öğrenci takibi çok kolaylaştı. Artık her öğrencinin gelişimini anlık olarak izleyebiliyorum.",
        },
        {
          id: "2",
          name: "Fatma Demir",
          role: "Okul Müdürü",
          company: "İstanbul Özel Okulu",
          quote:
            "Okul yönetimi için harika bir araç. Raporlama özellikleri muhteşem, velilerle iletişim hiç bu kadar kolay olmamıştı.",
        },
        {
          id: "3",
          name: "Mehmet Kaya",
          role: "Veli",
          quote:
            "Çocuğumun okuldaki durumunu artık çok yakından takip edebiliyorum. Öğretmenlerle iletişim kurmak da çok kolay.",
        },
      ],
    },
    faq: {
      sectionTitle: "Sıkça Sorulan Sorular",
      sectionSubtitle: "Merak ettiklerinizi yanıtlıyoruz",
      items: [
        {
          id: "1",
          question: "CourseIntellect ücretsiz mi?",
          answer:
            "Temel özelliklerimizi ücretsiz olarak kullanabilirsiniz. Gelişmiş özellikler için uygun fiyatlı paketlerimize göz atabilirsiniz.",
        },
        {
          id: "2",
          question: "Hangi cihazlarda kullanabilirim?",
          answer:
            "Windows, macOS masaüstü uygulamalarımız ve iOS, Android mobil uygulamalarımız mevcuttur. Ayrıca web tarayıcınızdan da erişebilirsiniz.",
        },
        {
          id: "3",
          question: "Verilerim güvende mi?",
          answer:
            "Evet, tüm verileriniz 256-bit SSL şifreleme ile korunmaktadır. KVKK uyumlu altyapımızla verileriniz güvende.",
        },
        {
          id: "4",
          question: "Teknik destek sağlıyor musunuz?",
          answer:
            "Evet, 7/24 teknik destek ekibimiz size yardımcı olmak için hazır. E-posta, telefon veya canlı sohbet ile bize ulaşabilirsiniz.",
        },
        {
          id: "5",
          question: "Okulum için özel fiyatlandırma alabilir miyim?",
          answer:
            "Evet, kurumsal müşterilerimiz için özel fiyatlandırma seçeneklerimiz mevcuttur. Satış ekibimizle iletişime geçin.",
        },
      ],
    },
    finalCTA: {
      title: "Eğitimde Fark Yaratmaya Hazır mısınız?",
      subtitle: "Binlerce eğitimcinin güvendiği platformu şimdi ücretsiz deneyin.",
      primaryCTA: { text: "Ücretsiz Başla", href: "/indir" },
      secondaryCTA: { text: "Bize Ulaşın", href: "/iletisim" },
    },
  },

  features: {
    hero: {
      title: "Tüm Özellikler",
      subtitle: "CourseIntellect'in sunduğu kapsamlı özelliklerle eğitimi dönüştürün.",
    },
    categories: [
      { id: "all", name: "Tümü" },
      { id: "teacher", name: "Öğretmen" },
      { id: "student", name: "Öğrenci" },
      { id: "parent", name: "Veli" },
      { id: "admin", name: "Yönetim" },
    ],
    items: [],
  },

  pricing: {
    hero: {
      title: "Şeffaf Fiyatlandırma",
      subtitle: "İhtiyacınıza uygun planı seçin. Gizli maliyet yok.",
    },
    toggleLabels: {
      monthly: "Aylık",
      yearly: "Yıllık",
      discount: "2 ay ücretsiz",
    },
    plans: [
      {
        id: "1",
        name: "Başlangıç",
        description: "Bireysel öğretmenler için",
        priceMonthly: 0,
        priceYearly: 0,
        features: ["5 sınıfa kadar", "Temel raporlar", "E-posta desteği", "Mobil uygulama erişimi"],
        ctaText: "Ücretsiz Başla",
      },
      {
        id: "2",
        name: "Profesyonel",
        description: "Okullar için ideal",
        priceMonthly: 299,
        priceYearly: 249,
        features: ["Sınırsız sınıf", "Gelişmiş raporlar", "7/24 destek", "Veli portalı", "API erişimi", "Özel eğitim"],
        isPopular: true,
        ctaText: "Hemen Başla",
      },
      {
        id: "3",
        name: "Kurumsal",
        description: "Büyük kurumlar için",
        priceMonthly: 0,
        priceYearly: 0,
        features: [
          "Tüm Pro özellikleri",
          "Özel sunucu",
          "SLA garantisi",
          "Dedicated hesap yöneticisi",
          "Özel entegrasyonlar",
          "Yerinde eğitim",
        ],
        ctaText: "İletişime Geç",
      },
    ],
    comparisonTitle: "Tüm Özellikleri Karşılaştır",
  },

  download: {
    hero: {
      title: "CourseIntellect'i İndirin",
      subtitle: "Tüm platformlarda mükemmel deneyim",
    },
    platforms: [
      {
        id: "windows",
        name: "Windows",
        description: "Windows 10 ve 11 için optimize edilmiş masaüstü uygulaması",
        icon: "Monitor",
        downloadUrl: "#",
        version: "2.1.0",
        requirements: ["Windows 10/11 (64-bit)", "4 GB RAM", "500 MB disk alanı", ".NET 8 Runtime"],
      },
      {
        id: "macos",
        name: "macOS",
        description: "macOS Monterey ve sonrası için native uygulama",
        icon: "Apple",
        downloadUrl: "#",
        version: "2.1.0",
        requirements: ["macOS 12.0+", "Apple Silicon veya Intel", "4 GB RAM", "500 MB disk alanı"],
      },
      {
        id: "ios",
        name: "iOS",
        description: "iPhone ve iPad için optimize edilmiş mobil uygulama",
        icon: "Smartphone",
        downloadUrl: "#",
        version: "2.1.0",
        requirements: ["iOS 14.0+", "iPhone 8 ve sonrası", "150 MB depolama"],
      },
      {
        id: "android",
        name: "Android",
        description: "Android cihazlar için modern mobil uygulama",
        icon: "Smartphone",
        downloadUrl: "#",
        version: "2.1.0",
        requirements: ["Android 8.0+", "2 GB RAM", "150 MB depolama"],
      },
    ],
    versionNotes: {
      title: "Sürüm Notları",
      notes: [
        {
          version: "2.1.0",
          date: "15 Ocak 2026",
          changes: ["Yeni dashboard tasarımı", "Performans iyileştirmeleri", "Hata düzeltmeleri"],
        },
        {
          version: "2.0.0",
          date: "1 Aralık 2025",
          changes: ["Tamamen yenilenmiş arayüz", "Veli portalı eklendi", "Anlık mesajlaşma özelliği"],
        },
      ],
    },
  },

  contact: {
    hero: {
      title: "Bize Ulaşın",
      subtitle: "Sorularınız mı var? Size yardımcı olmaktan mutluluk duyarız.",
    },
    info: {
      email: "info@courseintellect.com",
      phone: "+90 (212) 555 0123",
      address: "Levent, Büyükdere Cad. No:123, 34330 Beşiktaş/İstanbul",
      workingHours: "Pazartesi - Cuma: 09:00 - 18:00",
    },
    form: {
      nameLabel: "Adınız Soyadınız",
      emailLabel: "E-posta Adresiniz",
      subjectLabel: "Konu",
      messageLabel: "Mesajınız",
      submitButton: "Gönder",
      successMessage: "Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız.",
    },
  },

  footer: {
    description: "Eğitimde yeni nesil deneyim sunan akıllı platform.",
    sections: [
      {
        id: "1",
        title: "Ürün",
        links: [
          { id: "1", label: "Özellikler", href: "/ozellikler" },
          { id: "2", label: "Fiyatlar", href: "/fiyatlar" },
          { id: "3", label: "İndir", href: "/indir" },
        ],
      },
      {
        id: "2",
        title: "Şirket",
        links: [
          { id: "1", label: "Hakkımızda", href: "/hakkimizda" },
          { id: "2", label: "Blog", href: "/blog" },
          { id: "3", label: "Kariyer", href: "/kariyer" },
        ],
      },
      {
        id: "3",
        title: "Destek",
        links: [
          { id: "1", label: "İletişim", href: "/iletisim" },
          { id: "2", label: "Yardım Merkezi", href: "/yardim" },
          { id: "3", label: "SSS", href: "/#sss" },
        ],
      },
    ],
    socialLinks: [
      { id: "1", platform: "Twitter", url: "https://twitter.com/courseintellect", icon: "Twitter" },
      { id: "2", platform: "LinkedIn", url: "https://linkedin.com/company/courseintellect", icon: "Linkedin" },
      { id: "3", platform: "Instagram", url: "https://instagram.com/courseintellect", icon: "Instagram" },
      { id: "4", platform: "YouTube", url: "https://youtube.com/@courseintellect", icon: "Youtube" },
    ],
    copyright: "© 2026 CourseIntellect. Tüm hakları saklıdır.",
    legalLinks: [
      { id: "1", label: "Gizlilik Politikası", href: "/kvkk" },
      { id: "2", label: "Kullanım Şartları", href: "/kullanim-sartlari" },
    ],
  },

  general: {
    siteName: "CourseIntellect",
    siteDescription: "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu.",
    siteKeywords: ["eğitim", "öğretmen", "öğrenci", "veli", "okul yönetimi", "ders takibi"],
  },
}
