"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Building2, Mail, Phone, Users, CheckCircle, Loader2, ArrowLeft,
  ShieldCheck, BarChart3, Sparkles, MapPin, FileText, Globe, Hash, Briefcase,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TURKISH_PROVINCES, maskTrPhone, maskTc, maskMebCode, maskTaxNumber,
  maskPostalCode, phoneDigits, isValidTrMobile, isValidTrPhone, isValidEmail,
  isValidWebsite, isValidTaxNumber,
} from "@/lib/form-rules"
import { useLanguage } from "@/context/language-context"
import { apiRequest, ApiRequestError } from "@/lib/api-client"
import { registrationEnabled, TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget"
import { billingEnabled } from "@/lib/billing"

const plans = [
  { value: "Starter", label: { tr: "Starter — Küçük Kurumlar", en: "Starter — Small Institutions" } },
  { value: "Business", label: { tr: "Business — Orta Ölçekli", en: "Business — Medium Scale" } },
  { value: "Enterprise", label: { tr: "Enterprise — Büyük Kurumlar", en: "Enterprise — Large Institutions" } },
]

const features = [
  {
    icon: ShieldCheck,
    title: { tr: "Güvenli Altyapı", en: "Secure Infrastructure" },
    desc: { tr: "Verileriniz şifreli ve güvende", en: "Your data is encrypted and safe" },
  },
  {
    icon: BarChart3,
    title: { tr: "Detaylı Raporlama", en: "Detailed Reporting" },
    desc: { tr: "Gerçek zamanlı analitik paneli", en: "Real-time analytics dashboard" },
  },
  {
    icon: Sparkles,
    title: { tr: "AI Destekli Araçlar", en: "AI-Powered Tools" },
    desc: { tr: "Yapay zeka ile eğitimi güçlendirin", en: "Enhance education with AI" },
  },
]

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs font-medium text-destructive">{msg}</p>
}

function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 text-sm font-semibold text-foreground/70">
      {icon}
      <span>{label}</span>
      <span className="ml-1 h-px flex-1 bg-border" />
    </div>
  )
}

export default function KurumKaydiPage() {
  const { language } = useLanguage()
  const [submitted, setSubmitted] = useState(false)
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    institutionName: "",
    contactName: "",
    contactTitle: "",
    email: "",
    phone: "",
    plan: "Starter",
    estimatedStudents: 50,
    institutionType: "PrivateSchool",
    // Kurumsal/yasal
    mebCode: "",
    taxOffice: "",
    taxNumber: "",
    // Adres
    city: "",
    district: "",
    addressLine: "",
    postalCode: "",
    // Kurum iletişimi
    institutionPhone: "",
    institutionEmail: "",
    website: "",
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [kvkkAccepted, setKvkkAccepted] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

  const t = {
    title: { tr: "Kurumunuzu Kaydedin", en: "Register Your Institution" },
    subtitle: billingEnabled
      ? {
          tr: "Formu doldurun, ekibimiz en kısa sürede sizinle iletişime geçsin.",
          en: "Fill out the form and our team will contact you shortly.",
        }
      : {
          tr: "Formu doldurun; kurumunuz onaylandığında platformu ücretsiz kullanmaya başlayın.",
          en: "Fill out the form and start using the platform for free once your institution is approved.",
        },
    leftHeading: { tr: "Kurumunuzu Dijital Geleceğe Taşıyın", en: "Take Your Institution to the Digital Future" },
    leftSubtitle: {
      tr: "Öğrenci, öğretmen ve veliler için tasarlanmış eksiksiz eğitim yönetim platformu.",
      en: "A complete education management platform designed for students, teachers and parents.",
    },
    institutionName: { tr: "Kurum Adı", en: "Institution Name" },
    contactName: { tr: "Yetkili Adı Soyadı", en: "Contact Person" },
    email: { tr: "E-posta", en: "Email" },
    phone: { tr: "Telefon", en: "Phone" },
    plan: { tr: "İlgilendiğiniz Plan", en: "Plan of Interest" },
    students: { tr: "Tahmini Öğrenci Sayısı", en: "Estimated Student Count" },
    institutionType: { tr: "Kurum Türü", en: "Institution Type" },
    contactTitle: { tr: "Yetkili Görevi", en: "Title" },
    sectionCorporate: { tr: "Kurumsal Bilgiler (isteğe bağlı)", en: "Corporate Details (optional)" },
    sectionAddress: { tr: "Adres (isteğe bağlı)", en: "Address (optional)" },
    sectionContact: { tr: "Kurum İletişimi (isteğe bağlı)", en: "Institution Contact (optional)" },
    mebCode: { tr: "MEB Kurum Kodu", en: "MEB Institution Code" },
    taxNumber: { tr: "Vergi / TC No", en: "Tax / ID Number" },
    taxOffice: { tr: "Vergi Dairesi", en: "Tax Office" },
    city: { tr: "İl", en: "Province" },
    district: { tr: "İlçe", en: "District" },
    addressLine: { tr: "Açık Adres", en: "Street Address" },
    postalCode: { tr: "Posta Kodu", en: "Postal Code" },
    institutionPhone: { tr: "Kurum Telefonu", en: "Institution Phone" },
    institutionEmail: { tr: "Kurum E-postası", en: "Institution Email" },
    website: { tr: "Web Sitesi", en: "Website" },
    submit: { tr: "Başvuruyu Gönder", en: "Submit Application" },
    successTitle: { tr: "Başvurunuz Alındı!", en: "Application Received!" },
    successDesc: {
      tr: "Başvurunuz platform yönetimine iletildi. Onaylandıktan sonra kurum admin giriş bilgileriniz size iletilecek.",
      en: "Your application has been sent to platform management. After approval, your institution admin credentials will be shared with you.",
    },
    successVerifyDesc: {
      tr: "E-posta adresinize bir doğrulama bağlantısı gönderdik. Başvurunuzun incelemeye alınması için bağlantıya tıklayın.",
      en: "We sent a verification link to your email address. Click it so your application can be reviewed.",
    },
    kvkk: {
      tr: "Kişisel verilerimin aydınlatma metni kapsamında işlenmesini kabul ediyorum.",
      en: "I consent to the processing of my personal data as described in the privacy notice.",
    },
    kvkkRequired: {
      tr: "Devam etmek için aydınlatma metnini onaylamanız gerekir.",
      en: "You must accept the privacy notice to continue.",
    },
    captchaRequired: {
      tr: "Lütfen \"robot değilim\" doğrulamasını tamamlayın.",
      en: "Please complete the human verification.",
    },
    captchaUnavailable: {
      tr: "Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.",
      en: "Security verification could not load. Refresh the page and try again.",
    },
    backHome: { tr: "Ana Sayfaya Dön", en: "Back to Home" },
    back: { tr: "Geri", en: "Back" },
    privacy: { tr: "Gizlilik", en: "Privacy" },
    terms: { tr: "Şartlar", en: "Terms" },
    unavailableTitle: { tr: "Kurum Kaydı Geçici Olarak Kapalı", en: "Institution Registration Temporarily Unavailable" },
    unavailable: {
      tr: "Kurum kaydı şu anda geçici olarak kapalıdır. Lütfen daha sonra tekrar deneyin.",
      en: "Institution registration is temporarily unavailable. Please try again later.",
    },
  }

  // Bot koruması: gizli alan doluysa istek gönderilmez, sessizce "başarılı" gösterilir.
  const [website, setWebsite] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!registrationEnabled) return
    if (website.trim() !== "") {
      setSubmitted(true)
      return
    }
    const errs: Record<string, string> = {}
    const req = language === "tr" ? "Bu alan zorunludur." : "This field is required."
    if (form.institutionName.trim().length < 3) errs.institutionName = language === "tr" ? "Kurum adı en az 3 karakter olmalıdır." : "At least 3 characters."
    if (form.contactName.trim().length < 3) errs.contactName = req
    if (!isValidEmail(form.email)) errs.email = language === "tr" ? "Geçerli bir e-posta girin." : "Enter a valid email."
    if (!isValidTrMobile(form.phone)) errs.phone = language === "tr" ? "Cep telefonu 5xx ile başlayan 10 hane olmalıdır." : "Mobile must be 10 digits starting with 5."
    if (!(form.estimatedStudents >= 1 && form.estimatedStudents <= 100000)) errs.estimatedStudents = language === "tr" ? "1-100.000 aralığında olmalıdır." : "Must be 1-100,000."
    // Opsiyonel alanlar: yalnız dolu gelince biçim doğrulanır.
    if (form.taxNumber && !isValidTaxNumber(form.taxNumber)) errs.taxNumber = language === "tr" ? "Vergi no 10 haneli (ya da 11 haneli geçerli TC) olmalıdır." : "Tax number must be 10 digits (or a valid 11-digit ID)."
    if (form.mebCode && (form.mebCode.length < 6 || form.mebCode.length > 8)) errs.mebCode = language === "tr" ? "MEB kodu 6-8 haneli olmalıdır." : "MEB code must be 6-8 digits."
    if (form.postalCode && form.postalCode.length !== 5) errs.postalCode = language === "tr" ? "Posta kodu 5 haneli olmalıdır." : "Postal code must be 5 digits."
    if (form.institutionPhone && !isValidTrPhone(form.institutionPhone)) errs.institutionPhone = language === "tr" ? "Telefon 10 haneli olmalıdır." : "Phone must be 10 digits."
    if (form.institutionEmail && !isValidEmail(form.institutionEmail)) errs.institutionEmail = language === "tr" ? "Geçerli bir e-posta girin." : "Enter a valid email."
    if (form.website && !isValidWebsite(form.website)) errs.website = language === "tr" ? "Geçerli bir web adresi girin." : "Enter a valid website."
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      setError(language === "tr" ? "Lütfen işaretli alanları düzeltin." : "Please fix the highlighted fields.")
      return
    }
    if (!kvkkAccepted) {
      setError(t.kvkkRequired[language])
      return
    }
    if (turnstileEnabled && !captchaToken) {
      setError(t.captchaRequired[language])
      return
    }
    setLoading(true)
    try {
      const response = await apiRequest<{ verificationRequired?: boolean }>("/api/platformops/tenants/register", {
        method: "POST",
        token: null,
        body: {
          institutionName: form.institutionName.trim(),
          contactName: form.contactName.trim(),
          contactTitle: form.contactTitle.trim() || undefined,
          email: form.email.trim(),
          phone: phoneDigits(form.phone),
          // Ücretsiz dönemde plan gönderilmez; backend de yok sayar.
          ...(billingEnabled ? { plan: form.plan } : {}),
          estimatedStudents: Number(form.estimatedStudents),
          institutionType: form.institutionType,
          // Genişletilmiş kurum bilgileri (opsiyonel; boşlar gönderilmez)
          mebCode: form.mebCode || undefined,
          taxOffice: form.taxOffice.trim() || undefined,
          taxNumber: form.taxNumber || undefined,
          city: form.city || undefined,
          district: form.district.trim() || undefined,
          addressLine: form.addressLine.trim() || undefined,
          postalCode: form.postalCode || undefined,
          institutionPhone: form.institutionPhone ? phoneDigits(form.institutionPhone) : undefined,
          institutionEmail: form.institutionEmail.trim() || undefined,
          website: form.website.trim() || undefined,
          captchaToken,
          kvkkAccepted,
        },
      })
      setVerificationRequired(response?.verificationRequired === true)
      setSubmitted(true)
    } catch (err: unknown) {
      // Token tek kullanımlıktır: başarısız denemeden sonra widget yenilenmeli.
      setCaptchaToken(null)
      setCaptchaResetKey((k) => k + 1)
      if (err instanceof ApiRequestError && err.code === "NETWORK_ERROR") {
        setError(
          language === "tr"
            ? "Canlı sunucuya ulaşılamıyor. Lütfen kısa bir süre sonra tekrar deneyin."
            : "The live server cannot be reached. Please try again shortly.",
        )
      } else {
        setError(err instanceof Error ? err.message : "Bir hata oluştu. Lütfen tekrar deneyin.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (!registrationEnabled) {
    return (
      <main
        data-registration-enabled={registrationEnabled}
        className="min-h-screen flex items-center justify-center bg-background p-6"
      >
        <Card className="w-full max-w-lg border-0 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 rounded-full bg-muted p-3">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle>{t.unavailableTitle[language]}</CardTitle>
            <CardDescription className="text-base">{t.unavailable[language]}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline"><Link href="/">{t.backHome[language]}</Link></Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="SchoolAsist" width={48} height={48} className="brightness-0 invert" />
            <span className="text-2xl font-bold text-primary-foreground">
              Course<span className="text-accent">Intellect</span>
            </span>
          </Link>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-primary-foreground leading-tight">{t.leftHeading[language]}</h1>
            <p className="text-lg text-primary-foreground/80">{t.leftSubtitle[language]}</p>
          </div>
          <div className="flex gap-4 text-primary-foreground/60 text-sm">
            <Link href="/kvkk" className="hover:text-primary-foreground">{t.privacy[language]}</Link>
            <Link href="/kullanim-sartlari" className="hover:text-primary-foreground">{t.terms[language]}</Link>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 bg-background">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-green-100">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">{t.successTitle[language]}</h2>
            <p className="text-muted-foreground mb-8">{verificationRequired ? t.successVerifyDesc[language] : t.successDesc[language]}</p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/">{t.backHome[language]}</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div data-registration-enabled={registrationEnabled} className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="SchoolAsist" width={48} height={48} className="brightness-0 invert" />
            <span className="text-2xl font-bold text-primary-foreground">
              Course<span className="text-accent">Intellect</span>
            </span>
          </Link>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-primary-foreground leading-tight">{t.leftHeading[language]}</h1>
            <p className="text-lg text-primary-foreground/80">{t.leftSubtitle[language]}</p>
          </div>
          <div className="space-y-4">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="p-2 rounded-lg bg-white/10 shrink-0">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary-foreground">{f.title[language]}</p>
                    <p className="text-sm text-primary-foreground/70">{f.desc[language]}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-4 text-primary-foreground/60 text-sm">
          <Link href="/kvkk" className="hover:text-primary-foreground">{t.privacy[language]}</Link>
          <Link href="/kullanim-sartlari" className="hover:text-primary-foreground">{t.terms[language]}</Link>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/logo.png" alt="SchoolAsist" width={40} height={40} />
              <span className="text-xl font-bold">Course<span className="text-accent">Intellect</span></span>
            </Link>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link
              href={billingEnabled ? "/fiyatlar" : "/"}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.back[language]}
            </Link>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Building2 className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <CardTitle>{t.title[language]}</CardTitle>
                    <CardDescription>{t.subtitle[language]}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot: insanlar görmez, botlar doldurur */}
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="institutionName">{t.institutionName[language]}</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="institutionName"
                        value={form.institutionName}
                        onChange={(e) => setForm((p) => ({ ...p, institutionName: e.target.value }))}
                        placeholder="Örn: ABC Eğitim Kurumu"
                        className="pl-10"
                        required
                      />
                    </div>
                    <FieldErr msg={fieldErrors.institutionName} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">{t.contactName[language]}</Label>
                      <Input
                        id="contactName"
                        value={form.contactName}
                        onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                        placeholder="Örn: Ahmet Yılmaz"
                        required
                      />
                      <FieldErr msg={fieldErrors.contactName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactTitle">{t.contactTitle[language]}</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="contactTitle"
                          value={form.contactTitle}
                          onChange={(e) => setForm((p) => ({ ...p, contactTitle: e.target.value }))}
                          placeholder={language === "tr" ? "Örn: Kurucu, Müdür" : "e.g. Founder"}
                          className="pl-10"
                          maxLength={80}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t.email[language]}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="info@kurum.com"
                          className="pl-10"
                          required
                        />
                      </div>
                      <FieldErr msg={fieldErrors.email} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.phone[language]}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          value={form.phone}
                          onChange={(e) => setForm((p) => ({ ...p, phone: maskTrPhone(e.target.value) }))}
                          placeholder="+90 5xx xxx xx xx"
                          className="pl-10"
                          required
                        />
                      </div>
                      <FieldErr msg={fieldErrors.phone} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.institutionType[language]}</Label>
                      <Select value={form.institutionType} onValueChange={(v) => setForm((p) => ({ ...p, institutionType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PrivateSchool">{language === "tr" ? "Özel Okul" : "Private School"}</SelectItem>
                          <SelectItem value="CourseCenter">{language === "tr" ? "Kurs Merkezi" : "Course Center"}</SelectItem>
                          <SelectItem value="StudyCenter">{language === "tr" ? "Etüt Merkezi" : "Study Center"}</SelectItem>
                          <SelectItem value="Other">{language === "tr" ? "Diğer" : "Other"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="students">{t.students[language]}</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="students"
                          type="number"
                          min={1}
                          max={100000}
                          value={form.estimatedStudents}
                          onChange={(e) => setForm((p) => ({ ...p, estimatedStudents: Number(e.target.value) }))}
                          className="pl-10"
                          required
                        />
                      </div>
                      <FieldErr msg={fieldErrors.estimatedStudents} />
                    </div>
                  </div>

                  {billingEnabled && (
                  <div className="space-y-2">
                    <Label>{t.plan[language]}</Label>
                    <Select value={form.plan} onValueChange={(v) => setForm((p) => ({ ...p, plan: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label[language]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  {/* ── Kurumsal bilgiler (opsiyonel) ── */}
                  <SectionHead icon={<FileText className="w-4 h-4" />} label={t.sectionCorporate[language]} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mebCode">{t.mebCode[language]}</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="mebCode" inputMode="numeric" value={form.mebCode}
                          onChange={(e) => setForm((p) => ({ ...p, mebCode: maskMebCode(e.target.value) }))}
                          placeholder={language === "tr" ? "6-8 haneli" : "6-8 digits"} className="pl-10" />
                      </div>
                      <FieldErr msg={fieldErrors.mebCode} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxNumber">{t.taxNumber[language]}</Label>
                      <Input id="taxNumber" inputMode="numeric" value={form.taxNumber}
                        onChange={(e) => setForm((p) => ({ ...p, taxNumber: maskTaxNumber(e.target.value) }))}
                        placeholder={language === "tr" ? "10 haneli VKN" : "10-digit tax no"} />
                      <FieldErr msg={fieldErrors.taxNumber} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxOffice">{t.taxOffice[language]}</Label>
                    <Input id="taxOffice" value={form.taxOffice} maxLength={120}
                      onChange={(e) => setForm((p) => ({ ...p, taxOffice: e.target.value }))}
                      placeholder={language === "tr" ? "Örn: Kadıköy V.D." : "Tax office"} />
                  </div>

                  {/* ── Adres (opsiyonel) ── */}
                  <SectionHead icon={<MapPin className="w-4 h-4" />} label={t.sectionAddress[language]} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.city[language]}</Label>
                      <Select value={form.city} onValueChange={(v) => setForm((p) => ({ ...p, city: v }))}>
                        <SelectTrigger><SelectValue placeholder={language === "tr" ? "İl seçin" : "Select"} /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {TURKISH_PROVINCES.map((prov) => (
                            <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">{t.district[language]}</Label>
                      <Input id="district" value={form.district} maxLength={80}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                        placeholder={language === "tr" ? "Örn: Kadıköy" : "District"} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_120px] gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="addressLine">{t.addressLine[language]}</Label>
                      <Input id="addressLine" value={form.addressLine} maxLength={400}
                        onChange={(e) => setForm((p) => ({ ...p, addressLine: e.target.value }))}
                        placeholder={language === "tr" ? "Mahalle, cadde, no" : "Street address"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">{t.postalCode[language]}</Label>
                      <Input id="postalCode" inputMode="numeric" value={form.postalCode}
                        onChange={(e) => setForm((p) => ({ ...p, postalCode: maskPostalCode(e.target.value) }))}
                        placeholder="34710" />
                      <FieldErr msg={fieldErrors.postalCode} />
                    </div>
                  </div>

                  {/* ── Kurum iletişimi (opsiyonel) ── */}
                  <SectionHead icon={<Globe className="w-4 h-4" />} label={t.sectionContact[language]} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="institutionPhone">{t.institutionPhone[language]}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="institutionPhone" type="tel" inputMode="numeric" value={form.institutionPhone}
                          onChange={(e) => setForm((p) => ({ ...p, institutionPhone: maskTrPhone(e.target.value) }))}
                          placeholder="+90 2xx xxx xx xx" className="pl-10" />
                      </div>
                      <FieldErr msg={fieldErrors.institutionPhone} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="institutionEmail">{t.institutionEmail[language]}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="institutionEmail" type="email" value={form.institutionEmail}
                          onChange={(e) => setForm((p) => ({ ...p, institutionEmail: e.target.value }))}
                          placeholder="iletisim@kurum.com" className="pl-10" />
                      </div>
                      <FieldErr msg={fieldErrors.institutionEmail} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">{t.website[language]}</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="website" value={form.website} maxLength={200}
                        onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://kurum.com" className="pl-10" />
                    </div>
                    <FieldErr msg={fieldErrors.website} />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <Checkbox
                      id="kvkk"
                      checked={kvkkAccepted}
                      onCheckedChange={(checked) => setKvkkAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="kvkk" className="text-xs font-normal leading-relaxed text-muted-foreground">
                      {t.kvkk[language]}{" "}
                      <Link href="/kvkk" className="underline hover:text-foreground">
                        {t.privacy[language]}
                      </Link>
                      {" · "}
                      <Link href="/kullanim-sartlari" className="underline hover:text-foreground">
                        {t.terms[language]}
                      </Link>
                    </Label>
                  </div>

                  <TurnstileWidget
                    language={language}
                    resetKey={captchaResetKey}
                    onToken={setCaptchaToken}
                    onError={() => setError(t.captchaUnavailable[language])}
                  />

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t.submit[language]}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
