"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { apiRequest } from "@/lib/api-client"

export type Language = "tr" | "en"

export interface Translations {
  // Navbar
  navbar: {
    home: string
    features: string
    pricing: string
    download: string
    contact: string
    login: string
    getStarted: string
  }
  // Hero
  hero: {
    badge: string
    title: string
    subtitle: string
    primaryCTA: string
    secondaryCTA: string
  }
  // Stats
  stats: {
    activeUsers: string
    schools: string
    satisfaction: string
    lessonHours: string
  }
  // Features
  features: {
    title: string
    subtitle: string
    smartTracking: string
    smartTrackingDesc: string
    notifications: string
    notificationsDesc: string
    reports: string
    reportsDesc: string
    parentPortal: string
    parentPortalDesc: string
    calendar: string
    calendarDesc: string
    messaging: string
    messagingDesc: string
    homework: string
    homeworkDesc: string
    badges: string
    badgesDesc: string
  }
  // Platforms
  platforms: {
    title: string
    subtitle: string
    desktop: string
    desktopDesc: string
    mobile: string
    mobileDesc: string
    downloadBtn: string
    requirements: string
  }
  // How it works
  howItWorks: {
    title: string
    subtitle: string
    step1Title: string
    step1Desc: string
    step2Title: string
    step2Desc: string
    step3Title: string
    step3Desc: string
  }
  // Testimonials
  testimonials: {
    title: string
    subtitle: string
  }
  // FAQ
  faq: {
    title: string
    subtitle: string
    q1: string
    a1: string
    q2: string
    a2: string
    q3: string
    a3: string
    q4: string
    a4: string
    q5: string
    a5: string
  }
  // CTA
  cta: {
    title: string
    subtitle: string
    primaryBtn: string
    secondaryBtn: string
  }
  // Footer
  footer: {
    description: string
    product: string
    company: string
    support: string
    about: string
    blog: string
    careers: string
    helpCenter: string
    privacy: string
    terms: string
    copyright: string
  }
  // Common
  common: {
    loading: string
    error: string
    success: string
    save: string
    cancel: string
    delete: string
    edit: string
    view: string
    search: string
    filter: string
    all: string
    none: string
    yes: string
    no: string
    back: string
    next: string
    previous: string
    learnMore: string
    seeAll: string
    free: string
    month: string
    year: string
    popular: string
  }
}

const defaultTranslations: Record<Language, Translations> = {
  tr: {
    navbar: {
      home: "Anasayfa",
      features: "Özellikler",
      pricing: "Fiyatlar",
      download: "İndir",
      contact: "İletişim",
      login: "Giriş Yap",
      getStarted: "Hemen Başla",
    },
    hero: {
      badge: "Yeni Nesil Eğitim Platformu",
      title: "Eğitimde Yeni Nesil Deneyim",
      subtitle:
        "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu. Ders takibi, anlık bildirimler ve detaylı raporlarla eğitimi kolaylaştırın.",
      primaryCTA: "Ücretsiz Dene",
      secondaryCTA: "Demo İzle",
    },
    stats: {
      activeUsers: "Aktif Kullanıcı",
      schools: "Okul",
      satisfaction: "Memnuniyet",
      lessonHours: "Ders Saati",
    },
    features: {
      title: "Güçlü Özellikler",
      subtitle: "Eğitim süreçlerinizi kolaylaştıran kapsamlı araçlar",
      smartTracking: "Akıllı Ders Takibi",
      smartTrackingDesc: "Derslerinizi planlayın, takip edin ve öğrenci ilerlemesini anlık izleyin.",
      notifications: "Anlık Bildirimler",
      notificationsDesc: "Ödev, sınav ve duyurulardan anında haberdar olun.",
      reports: "Detaylı Raporlar",
      reportsDesc: "Performans analizleri ve özelleştirilebilir raporlar oluşturun.",
      parentPortal: "Veli Portalı",
      parentPortalDesc: "Veliler çocuklarının eğitim sürecini yakından takip edebilir.",
      calendar: "Takvim Yönetimi",
      calendarDesc: "Sınav, ödev ve etkinlik takvimini kolayca yönetin.",
      messaging: "Anlık Mesajlaşma",
      messagingDesc: "Öğretmen, öğrenci ve veliler arasında güvenli iletişim.",
      homework: "Ödev Yönetimi",
      homeworkDesc: "Ödevleri oluşturun, dağıtın ve değerlendirin.",
      badges: "Başarı Rozetleri",
      badgesDesc: "Öğrencileri motive eden gamification özellikleri.",
    },
    platforms: {
      title: "Her Platformda Yanınızda",
      subtitle: "Masaüstü ve mobil uygulamalarımızla her yerden erişin",
      desktop: "Masaüstü Uygulaması",
      desktopDesc: "Windows ve macOS için güçlü masaüstü uygulaması. .NET MAUI teknolojisi ile geliştirildi.",
      mobile: "Mobil Uygulama",
      mobileDesc: "iOS ve Android için optimize edilmiş mobil uygulama. Flutter ile geliştirildi.",
      downloadBtn: "İndir",
      requirements: "Gereksinimler",
    },
    howItWorks: {
      title: "Nasıl Çalışır?",
      subtitle: "3 kolay adımda başlayın",
      step1Title: "Hesap Oluşturun",
      step1Desc: "Ücretsiz hesabınızı oluşturun ve okulunuzu kaydedin.",
      step2Title: "Kurulum Yapın",
      step2Desc: "Sınıflarınızı, öğrencilerinizi ve derslerinizi ekleyin.",
      step3Title: "Kullanmaya Başlayın",
      step3Desc: "Hemen eğitim süreçlerinizi yönetmeye başlayın.",
    },
    testimonials: {
      title: "Kullanıcılarımız Ne Diyor?",
      subtitle: "Binlerce eğitimcinin güvendiği platform",
    },
    faq: {
      title: "Sıkça Sorulan Sorular",
      subtitle: "Merak ettiklerinizi yanıtlıyoruz",
      q1: "CourseIntellect ücretsiz mi?",
      a1: "Temel özelliklerimizi ücretsiz olarak kullanabilirsiniz. Gelişmiş özellikler için uygun fiyatlı paketlerimize göz atabilirsiniz.",
      q2: "Hangi cihazlarda kullanabilirim?",
      a2: "Windows, macOS masaüstü uygulamalarımız ve iOS, Android mobil uygulamalarımız mevcuttur. Ayrıca web tarayıcınızdan da erişebilirsiniz.",
      q3: "Verilerim güvende mi?",
      a3: "Evet, tüm verileriniz 256-bit SSL şifreleme ile korunmaktadır. KVKK uyumlu altyapımızla verileriniz güvende.",
      q4: "Teknik destek sağlıyor musunuz?",
      a4: "Evet, 7/24 teknik destek ekibimiz size yardımcı olmak için hazır. E-posta, telefon veya canlı sohbet ile bize ulaşabilirsiniz.",
      q5: "Okulum için özel fiyatlandırma alabilir miyim?",
      a5: "Evet, kurumsal müşterilerimiz için özel fiyatlandırma seçeneklerimiz mevcuttur. Satış ekibimizle iletişime geçin.",
    },
    cta: {
      title: "Eğitimde Fark Yaratmaya Hazır mısınız?",
      subtitle: "Binlerce eğitimcinin güvendiği platformu şimdi ücretsiz deneyin.",
      primaryBtn: "Ücretsiz Başla",
      secondaryBtn: "Bize Ulaşın",
    },
    footer: {
      description: "Eğitimde yeni nesil deneyim sunan akıllı platform.",
      product: "Ürün",
      company: "Şirket",
      support: "Destek",
      about: "Hakkımızda",
      blog: "Blog",
      careers: "Kariyer",
      helpCenter: "Yardım Merkezi",
      privacy: "Gizlilik Politikası",
      terms: "Kullanım Şartları",
      copyright: "© 2026 CourseIntellect. Tüm hakları saklıdır.",
    },
    common: {
      loading: "Yükleniyor...",
      error: "Hata",
      success: "Başarılı",
      save: "Kaydet",
      cancel: "İptal",
      delete: "Sil",
      edit: "Düzenle",
      view: "Görüntüle",
      search: "Ara",
      filter: "Filtrele",
      all: "Tümü",
      none: "Hiçbiri",
      yes: "Evet",
      no: "Hayır",
      back: "Geri",
      next: "İleri",
      previous: "Önceki",
      learnMore: "Daha Fazla",
      seeAll: "Tümünü Gör",
      free: "Ücretsiz",
      month: "ay",
      year: "yıl",
      popular: "Popüler",
    },
  },
  en: {
    navbar: {
      home: "Home",
      features: "Features",
      pricing: "Pricing",
      download: "Download",
      contact: "Contact",
      login: "Sign In",
      getStarted: "Get Started",
    },
    hero: {
      badge: "Next Generation Education Platform",
      title: "Next Generation Education Experience",
      subtitle:
        "Smart education platform designed for teachers, students and parents. Simplify education with course tracking, instant notifications and detailed reports.",
      primaryCTA: "Try Free",
      secondaryCTA: "Watch Demo",
    },
    stats: {
      activeUsers: "Active Users",
      schools: "Schools",
      satisfaction: "Satisfaction",
      lessonHours: "Lesson Hours",
    },
    features: {
      title: "Powerful Features",
      subtitle: "Comprehensive tools to simplify your education processes",
      smartTracking: "Smart Course Tracking",
      smartTrackingDesc: "Plan, track your courses and monitor student progress in real-time.",
      notifications: "Instant Notifications",
      notificationsDesc: "Stay informed about homework, exams and announcements instantly.",
      reports: "Detailed Reports",
      reportsDesc: "Create performance analyses and customizable reports.",
      parentPortal: "Parent Portal",
      parentPortalDesc: "Parents can closely follow their children's education process.",
      calendar: "Calendar Management",
      calendarDesc: "Easily manage exam, homework and event calendar.",
      messaging: "Instant Messaging",
      messagingDesc: "Secure communication between teachers, students and parents.",
      homework: "Homework Management",
      homeworkDesc: "Create, distribute and evaluate homework.",
      badges: "Achievement Badges",
      badgesDesc: "Gamification features that motivate students.",
    },
    platforms: {
      title: "Available on All Platforms",
      subtitle: "Access from anywhere with our desktop and mobile apps",
      desktop: "Desktop Application",
      desktopDesc: "Powerful desktop application for Windows and macOS. Developed with .NET MAUI technology.",
      mobile: "Mobile Application",
      mobileDesc: "Optimized mobile application for iOS and Android. Developed with Flutter.",
      downloadBtn: "Download",
      requirements: "Requirements",
    },
    howItWorks: {
      title: "How It Works?",
      subtitle: "Get started in 3 easy steps",
      step1Title: "Create Account",
      step1Desc: "Create your free account and register your school.",
      step2Title: "Setup",
      step2Desc: "Add your classes, students and courses.",
      step3Title: "Start Using",
      step3Desc: "Start managing your education processes right away.",
    },
    testimonials: {
      title: "What Our Users Say?",
      subtitle: "Platform trusted by thousands of educators",
    },
    faq: {
      title: "Frequently Asked Questions",
      subtitle: "We answer your questions",
      q1: "Is CourseIntellect free?",
      a1: "You can use our basic features for free. Check out our affordable packages for advanced features.",
      q2: "Which devices can I use?",
      a2: "We have Windows, macOS desktop apps and iOS, Android mobile apps. You can also access from your web browser.",
      q3: "Is my data secure?",
      a3: "Yes, all your data is protected with 256-bit SSL encryption. Your data is safe with our GDPR compliant infrastructure.",
      q4: "Do you provide technical support?",
      a4: "Yes, our 24/7 technical support team is ready to help you. You can reach us via email, phone or live chat.",
      q5: "Can I get custom pricing for my school?",
      a5: "Yes, we have custom pricing options for our corporate customers. Contact our sales team.",
    },
    cta: {
      title: "Ready to Make a Difference in Education?",
      subtitle: "Try the platform trusted by thousands of educators for free now.",
      primaryBtn: "Start Free",
      secondaryBtn: "Contact Us",
    },
    footer: {
      description: "Smart platform offering next generation experience in education.",
      product: "Product",
      company: "Company",
      support: "Support",
      about: "About Us",
      blog: "Blog",
      careers: "Careers",
      helpCenter: "Help Center",
      privacy: "Privacy Policy",
      terms: "Terms of Use",
      copyright: "© 2026 CourseIntellect. All rights reserved.",
    },
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      search: "Search",
      filter: "Filter",
      all: "All",
      none: "None",
      yes: "Yes",
      no: "No",
      back: "Back",
      next: "Next",
      previous: "Previous",
      learnMore: "Learn More",
      seeAll: "See All",
      free: "Free",
      month: "month",
      year: "year",
      popular: "Popular",
    },
  },
}

type TranslationItem = {
  key: string
  language: Language
  value: string
  category?: string | null
}

type TranslationUpdate = {
  key: string
  language: Language
  value: string
}

function buildKeyMap(
  source: Record<string, unknown>,
  prefix = "",
  map: Record<string, string> = {},
): Record<string, string> {
  Object.entries(source).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      buildKeyMap(value as Record<string, unknown>, fullKey, map)
      return
    }
    if (typeof value === "string") {
      map[fullKey.toLowerCase()] = fullKey
    }
  })
  return map
}

const DEFAULT_KEY_MAP = buildKeyMap(defaultTranslations.tr as unknown as Record<string, unknown>)

function getCanonicalKey(key: string) {
  const normalized = key.trim().toLowerCase()
  return DEFAULT_KEY_MAP[normalized] || key.trim()
}

function setNestedValue(target: Record<string, unknown>, key: string, value: string) {
  const keys = key.split(".")
  let current = target
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
}

function collectTranslationItems(
  language: Language,
  source: Record<string, unknown>,
  prefix = "",
  items: TranslationItem[] = [],
) {
  Object.entries(source).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      collectTranslationItems(language, value as Record<string, unknown>, fullKey, items)
      return
    }
    if (typeof value === "string" && value.trim().length > 0) {
      items.push({
        key: fullKey,
        language,
        value,
        category: fullKey.split(".")[0],
      })
    }
  })
  return items
}

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  translations: Translations
  customTranslations: Record<Language, Partial<Translations>>
  updateCustomTranslation: (lang: Language, key: string, value: string) => void
  saveCustomTranslations: (updates?: TranslationUpdate[]) => Promise<void>
  getTranslation: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const LANGUAGE_KEY = "courseintellect_language"
const CUSTOM_TRANSLATIONS_KEY = "courseintellect_custom_translations"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("tr")
  const [customTranslations, setCustomTranslations] = useState<Record<Language, Partial<Translations>>>({
    tr: {},
    en: {},
  })
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith("/admin")

  useEffect(() => {
    try {
      const storedLang = localStorage.getItem(LANGUAGE_KEY) as Language | null
      if (storedLang && (storedLang === "tr" || storedLang === "en")) {
        setLanguageState(storedLang)
      }

      const storedCustom = localStorage.getItem(CUSTOM_TRANSLATIONS_KEY)
      if (storedCustom) {
        setCustomTranslations(JSON.parse(storedCustom))
      }
    } catch (error) {
      console.error("Error loading language settings:", error)
    }
  }, [])

  const loadCustomTranslations = useCallback(async () => {
    const basePath = "/api/translations"
    const [trItems, enItems] = await Promise.all([
      apiRequest<TranslationItem[]>(basePath, { query: { language: "tr" } }),
      apiRequest<TranslationItem[]>(basePath, { query: { language: "en" } }),
    ])

    const nextCustom: Record<Language, Partial<Translations>> = { tr: {}, en: {} }
    trItems.forEach((item) => {
      setNestedValue(nextCustom.tr as Record<string, unknown>, getCanonicalKey(item.key), item.value)
    })
    enItems.forEach((item) => {
      setNestedValue(nextCustom.en as Record<string, unknown>, getCanonicalKey(item.key), item.value)
    })

    setCustomTranslations(nextCustom)
    localStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(nextCustom))
  }, [isAdminRoute])

  useEffect(() => {
    loadCustomTranslations().catch((error) => {
      console.error("Translation load failed:", error)
    })
  }, [loadCustomTranslations])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_KEY, lang)
  }, [])

  const updateCustomTranslation = useCallback((lang: Language, key: string, value: string) => {
    const canonicalKey = getCanonicalKey(key)
    setCustomTranslations((prev) => {
      const nextCustom = { ...prev, [lang]: { ...prev[lang] } }
      setNestedValue(nextCustom[lang] as Record<string, unknown>, canonicalKey, value)
      return nextCustom
    })
  }, [])

  const saveCustomTranslations = useCallback(
    async (updates?: TranslationUpdate[]) => {
      const normalizedUpdates =
        updates
          ?.filter((update) => update.value.trim().length > 0)
          .map((update) => ({
            ...update,
            key: getCanonicalKey(update.key),
          })) ?? []

      const items =
        normalizedUpdates.length > 0
          ? normalizedUpdates.map((update) => ({
              key: update.key,
              language: update.language,
              value: update.value,
              category: update.key.split(".")[0],
            }))
          : [
              ...collectTranslationItems("tr", customTranslations.tr as Record<string, unknown>),
              ...collectTranslationItems("en", customTranslations.en as Record<string, unknown>),
            ]

      if (items.length === 0) {
        return
      }

      const payload = items.map((item) => ({
        key: item.key.toLowerCase(),
        language: item.language,
        value: item.value,
        category: item.category,
      }))

      await apiRequest<TranslationItem[]>("/api/translations", {
        method: "PUT",
        body: payload,
      })

      let nextCustom = customTranslations
      if (normalizedUpdates.length > 0) {
        nextCustom = {
          tr: { ...customTranslations.tr },
          en: { ...customTranslations.en },
        }
        normalizedUpdates.forEach((update) => {
          setNestedValue(nextCustom[update.language] as Record<string, unknown>, update.key, update.value)
        })
        setCustomTranslations(nextCustom)
      }

      localStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(nextCustom))
    },
    [customTranslations],
  )

  const getTranslation = useCallback(
    (key: string): string => {
      const canonicalKey = getCanonicalKey(key)
      const keys = canonicalKey.split(".")
      let customValue: unknown = customTranslations[language]
      let defaultValue: unknown = defaultTranslations[language]

      for (const k of keys) {
        if (customValue && typeof customValue === "object") {
          customValue = (customValue as Record<string, unknown>)[k]
        } else {
          customValue = undefined
        }

        if (defaultValue && typeof defaultValue === "object") {
          defaultValue = (defaultValue as Record<string, unknown>)[k]
        } else {
          defaultValue = undefined
        }
      }

      return (customValue as string) || (defaultValue as string) || key
    },
    [language, customTranslations],
  )

  // Merge custom translations with defaults
  const mergeTranslations = useCallback((defaults: Translations, custom: Partial<Translations>): Translations => {
    const merge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
      const result = { ...target }
      for (const key in source) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
          result[key] = merge((target[key] as Record<string, unknown>) || {}, source[key] as Record<string, unknown>)
        } else if (source[key] !== undefined) {
          result[key] = source[key]
        }
      }
      return result
    }
    const merged = merge(defaults as unknown as Record<string, unknown>, custom as Record<string, unknown>)
    return merged as unknown as Translations
  }, [])

  const translations = mergeTranslations(defaultTranslations[language], customTranslations[language])

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        translations,
        customTranslations,
        updateCustomTranslation,
        saveCustomTranslations,
        getTranslation,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

export { defaultTranslations }
