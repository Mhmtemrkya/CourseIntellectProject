// Site içerik tipleri - Admin panelden düzenlenebilir tüm içerikler

export interface NavLink {
  id: string
  label: string
  href: string
}

export interface CTAButton {
  text: string
  href: string
}

export interface StatItem {
  id: string
  value: number
  suffix?: string
  label: string
}

export interface FeatureItem {
  id: string
  icon: string
  title: string
  description: string
  category?: string
}

export interface HowItWorksStep {
  id: string
  step: number
  title: string
  description: string
}

export interface Testimonial {
  id: string
  name: string
  role: string
  company?: string
  quote: string
  avatar?: string
}

export interface FAQItem {
  id: string
  question: string
  answer: string
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  features: string[]
  isPopular?: boolean
  ctaText: string
}

export interface PlatformInfo {
  id: string
  name: string
  description: string
  icon: string
  downloadUrl: string
  version: string
  requirements: string[]
}

export interface ContactInfo {
  email: string
  phone: string
  address: string
  workingHours: string
}

export interface FooterSection {
  id: string
  title: string
  links: NavLink[]
}

export interface SocialLink {
  id: string
  platform: string
  url: string
  icon: string
}

// Ana içerik yapısı
export interface SiteContent {
  // Navbar
  navbar: {
    logoText: string
    links: NavLink[]
    ctaButton: CTAButton
  }

  // Anasayfa
  homepage: {
    hero: {
      badge?: string
      title: string
      subtitle: string
      primaryCTA: CTAButton
      secondaryCTA: CTAButton
    }
    stats: StatItem[]
    features: {
      sectionTitle: string
      sectionSubtitle: string
      items: FeatureItem[]
    }
    platforms: {
      sectionTitle: string
      sectionSubtitle: string
      desktop: PlatformInfo
      mobile: PlatformInfo
    }
    howItWorks: {
      sectionTitle: string
      sectionSubtitle: string
      steps: HowItWorksStep[]
    }
    testimonials: {
      sectionTitle: string
      sectionSubtitle: string
      items: Testimonial[]
    }
    faq: {
      sectionTitle: string
      sectionSubtitle: string
      items: FAQItem[]
    }
    finalCTA: {
      title: string
      subtitle: string
      primaryCTA: CTAButton
      secondaryCTA: CTAButton
    }
  }

  // Özellikler sayfası
  features: {
    hero: {
      title: string
      subtitle: string
    }
    categories: { id: string; name: string }[]
    items: FeatureItem[]
  }

  // Fiyatlandırma sayfası
  pricing: {
    hero: {
      title: string
      subtitle: string
    }
    toggleLabels: {
      monthly: string
      yearly: string
      discount: string
    }
    plans: PricingPlan[]
    comparisonTitle: string
  }

  // İndir sayfası
  download: {
    hero: {
      title: string
      subtitle: string
    }
    platforms: PlatformInfo[]
    versionNotes: {
      title: string
      notes: { version: string; date: string; changes: string[] }[]
    }
  }

  // İletişim sayfası
  contact: {
    hero: {
      title: string
      subtitle: string
    }
    info: ContactInfo
    form: {
      nameLabel: string
      emailLabel: string
      subjectLabel: string
      messageLabel: string
      submitButton: string
      successMessage: string
    }
  }

  // Footer
  footer: {
    description: string
    sections: FooterSection[]
    socialLinks: SocialLink[]
    copyright: string
    legalLinks: NavLink[]
  }

  // Genel ayarlar
  general: {
    siteName: string
    siteDescription: string
    siteKeywords: string[]
  }
}

// Admin panel için içerik durumu
export interface ContentState {
  content: SiteContent
  isDirty: boolean
  lastSaved: Date | null
  history: SiteContent[]
}
