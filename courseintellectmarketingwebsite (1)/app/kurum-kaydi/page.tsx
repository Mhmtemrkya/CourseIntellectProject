"use client"

import { useRef, useState, type InputHTMLAttributes } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import styles from "./registration.module.css"
import {
  Building2, Mail, Loader2, ArrowRight, ArrowUpRight,
  ShieldCheck, MapPin, Plus, Monitor, Smartphone,
} from "lucide-react"
import Link from "next/link"
import { ApplicationStatus } from "@/components/site/application-status"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TURKISH_PROVINCES, maskTrPhone, maskMebCode, maskTaxNumber,
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

function Field({ label, error, helper, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; helper?: string }) {
  return <div className={styles.field}><label htmlFor={props.id}>{label}</label><input {...props} aria-invalid={error ? true : undefined} aria-describedby={error ? `${props.id}-error` : helper ? `${props.id}-help` : undefined}/>{error ? <p id={`${props.id}-error`} className={styles.fieldError}>{error}</p> : helper ? <p id={`${props.id}-help`} className={styles.helper}>{helper}</p> : null}</div>
}

export default function KurumKaydiPage() {
  const { language } = useLanguage()
  const reduced = useReducedMotion()
  const formRef = useRef<HTMLFormElement>(null)
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
    title: { tr: "Ücretsiz Kurum Kaydı", en: "Register Your Institution" },
    subtitle: billingEnabled
      ? {
          tr: "Formu doldurun, ekibimiz en kısa sürede sizinle iletişime geçsin.",
          en: "Fill out the form and our team will contact you shortly.",
        }
      : {
          tr: "Kurum bilgilerinizi girin, yönetici onayından sonra kullanmaya başlayın.",
          en: "Fill out the form and start using the platform for free once your institution is approved.",
        },
    leftHeading: { tr: "Kurumunuz için yeni bir başlangıç.", en: "Take Your Institution to the Digital Future" },
    leftSubtitle: {
      tr: "Paket seçmeden ücretsiz başvurun.",
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
    submit: { tr: "Ücretsiz başvuru oluştur", en: "Submit Application" },
    successTitle: { tr: "İlk adım tamamlandı.", en: "First step complete." },
    successDesc: {
      tr: "Başvurunuz platform yönetimine iletildi. Onaylandıktan sonra kurum admin giriş bilgileriniz size iletilecek.",
      en: "Your application has been sent to platform management. After approval, your institution admin credentials will be shared with you.",
    },
    successVerifyDesc: {
      tr: "E-posta adresinize bir doğrulama bağlantısı gönderdik. Başvurunuzun incelemeye alınması için bağlantıya tıklayın.",
      en: "We sent a verification link to your email address. Click it so your application can be reviewed.",
    },
    kvkk: {
      tr: "Kurum başvurusu aydınlatma metnini okudum.",
      en: "I have read the institution application privacy notice.",
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
    if (loading) return
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
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (!kvkkAccepted) {
      setError(t.kvkkRequired[language])
      document.getElementById("kvkk")?.focus()
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

  const tr = language === "tr"
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(previous => ({ ...previous, [key]: value }))
    setFieldErrors(previous => { const next = { ...previous }; delete next[key]; return next })
  }
  const corporateErrors = ["taxNumber", "mebCode"].some(key => fieldErrors[key])
  const addressErrors = ["postalCode", "institutionPhone", "institutionEmail", "website"].some(key => fieldErrors[key])

  if (submitted) {
    return <ApplicationStatus phase={verificationRequired ? "verify" : "received"} institution={form.institutionName} email={form.email} />
  }

  return <div className={`${styles.page} sa-registration-v2`} data-registration-enabled={registrationEnabled}>
    <section className={styles.intro} aria-labelledby="registration-heading">
      <motion.div initial={false} animate={reduced ? undefined : { y: [14, 0], opacity: [.8, 1] }} transition={{ duration: .7 }}>
        <p className={styles.eyebrow}>{tr ? "Ücretsiz kurum başvurusu" : "Free institution application"}</p>
        <h1 id="registration-heading">{tr ? <>Kurumunuz için<br/><span>yeni bir başlangıç.</span></> : <>A new beginning.<br/><span>For your institution.</span></>}</h1>
        <p className={styles.lead}>{tr ? "Paket seçmeden, ücretsiz başvurun." : "Apply for free, without choosing a plan."}</p>
        <p className={styles.description}>{tr ? "E-posta doğrulaması ve yönetici onayından sonra masaüstü ve mobil uygulamalarımızla kullanmaya başlayın." : "Start using our desktop and mobile apps after email verification and administrator approval."}</p>
      </motion.div>
      <div className={styles.art}><picture><source media="(max-width:600px)" srcSet="/images/registration-art/application-mobile.webp"/><Image src="/images/registration-art/application.webp" width={1536} height={1024} alt={tr ? "SchoolAsist kurum başvuru dosyası, e-posta zarfı ve onay sürecini anlatan özel görsel" : "SchoolAsist institution application folder, email envelope and approval process"} loading="eager" fetchPriority="high" sizes="(max-width:900px) 100vw, 48vw"/></picture></div>
      <ol className={styles.steps} aria-label={tr ? "Başvuru süreci" : "Application process"}>{(tr ? [["Kurum bilgileri", "Başvurunuzu oluşturun"], ["E-posta doğrulama", "Adresinizi doğrulayın"], ["Yönetici onayı", "Sonucu e-posta ile alın"]] : [["Institution details", "Submit your application"], ["Verify email", "Confirm your address"], ["Administrator approval", "Receive the result by email"]]).map(([title, description]) => <li key={title}><i aria-hidden="true"/><strong>{title}</strong><span>{description}</span></li>)}</ol>
      <Link href="/destek" className={styles.help}>{tr ? "Sorunuz mu var?" : "Have a question?"}<span>{tr ? "Destek merkezine ulaşın" : "Visit the support center"}</span><ArrowRight size={18}/></Link>
    </section>

    <section className={styles.formPanel} aria-labelledby="application-form-title">
      <header><div><h2 id="application-form-title">{tr ? "Kurum başvurusu" : "Institution application"}</h2><span>{tr ? "Ücretsiz" : "Free"}</span></div><p>{tr ? "Kurum ve yetkili bilgilerinizi paylaşın." : "Share institution and contact details."}</p></header>
      {!registrationEnabled && <div className={styles.unavailable} role="status"><ShieldCheck size={21}/><p><strong>{t.unavailableTitle[language]}</strong>{t.unavailable[language]}</p><Link href="/destek">{tr ? "Destek" : "Support"}<ArrowUpRight size={14}/></Link></div>}
      <form ref={formRef} onSubmit={handleSubmit} aria-label={tr ? "Kurum başvuru formu" : "Institution application form"} aria-busy={loading} noValidate>
        <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className={styles.honeypot}/>
        <fieldset disabled={loading || !registrationEnabled} className={styles.primaryFields}>
          <legend>{tr ? "Kurum bilgileri" : "Institution details"}</legend>
          <Field id="institutionName" label={t.institutionName[language]} value={form.institutionName} onChange={e=>update("institutionName",e.target.value)} maxLength={150} autoComplete="organization" required placeholder={tr ? "Kurumunuzun adı" : "Institution name"} error={fieldErrors.institutionName}/>
          <div className={styles.fieldGrid}><div className={styles.field}><label htmlFor="institutionType">{t.institutionType[language]}</label><select id="institutionType" value={form.institutionType} onChange={e=>update("institutionType",e.target.value)}>{[["PrivateSchool","Özel Okul","Private School"],["CourseCenter","Kurs Merkezi","Course Center"],["StudyCenter","Etüt Merkezi","Study Center"],["Other","Diğer","Other"]].map(([value,turkish,english])=><option key={value} value={value}>{tr?turkish:english}</option>)}</select></div><Field id="students" label={t.students[language]} type="number" min={1} max={100000} value={form.estimatedStudents} onChange={e=>update("estimatedStudents",Number(e.target.value))} required error={fieldErrors.estimatedStudents}/></div>
        </fieldset>
        <fieldset disabled={loading || !registrationEnabled} className={styles.contactFields}>
          <legend>{tr ? "Yetkili bilgileri" : "Contact details"}</legend>
          <div className={styles.fieldGrid}><Field id="contactName" label={tr ? "Ad soyad" : "Full name"} value={form.contactName} onChange={e=>update("contactName",e.target.value)} maxLength={150} autoComplete="name" placeholder={tr ? "Adınız ve soyadınız" : "Your full name"} required error={fieldErrors.contactName}/><Field id="contactTitle" label={tr ? "Görevi" : "Title"} value={form.contactTitle} onChange={e=>update("contactTitle",e.target.value)} maxLength={80} autoComplete="organization-title" placeholder={tr ? "Örn. Kurum yöneticisi" : "e.g. Institution manager"}/></div>
          <div className={styles.fieldGrid}><Field id="email" label={tr ? "E-posta adresi" : "Email address"} type="email" value={form.email} onChange={e=>update("email",e.target.value)} maxLength={180} autoComplete="email" placeholder="ornek@kurum.com" required error={fieldErrors.email} helper={tr ? "Doğrulama bağlantısını bu adrese göndereceğiz." : "We will send a verification link to this address."}/><Field id="phone" label={tr ? "Cep telefonu" : "Mobile phone"} type="tel" inputMode="tel" value={form.phone} onChange={e=>update("phone",maskTrPhone(e.target.value))} autoComplete="tel" placeholder="05xx xxx xx xx" required error={fieldErrors.phone}/></div>
        </fieldset>
        {billingEnabled && <div className={styles.field}><label htmlFor="plan">{t.plan[language]}</label><select id="plan" value={form.plan} onChange={e=>update("plan",e.target.value)} disabled={loading || !registrationEnabled}>{plans.map(plan=><option key={plan.value} value={plan.value}>{plan.label[language]}</option>)}</select></div>}
        <details className={styles.optional} open={corporateErrors ? true : undefined}><summary><Building2 size={18}/><span>{tr ? "Kurumsal bilgiler" : "Corporate details"}</span><small>{tr ? "İsteğe bağlı" : "Optional"}</small><Plus size={18}/></summary><fieldset disabled={loading || !registrationEnabled}><legend className="sr-only">{t.sectionCorporate[language]}</legend><div className={styles.fieldGrid}><Field id="mebCode" label={t.mebCode[language]} inputMode="numeric" value={form.mebCode} onChange={e=>update("mebCode",maskMebCode(e.target.value))} placeholder={tr ? "6–8 haneli" : "6–8 digits"} error={fieldErrors.mebCode}/><Field id="taxNumber" label={t.taxNumber[language]} inputMode="numeric" value={form.taxNumber} onChange={e=>update("taxNumber",maskTaxNumber(e.target.value))} placeholder={tr ? "10 haneli VKN" : "10-digit tax number"} error={fieldErrors.taxNumber}/></div><Field id="taxOffice" label={t.taxOffice[language]} value={form.taxOffice} onChange={e=>update("taxOffice",e.target.value)} maxLength={120}/></fieldset></details>
        <details className={styles.optional} open={addressErrors ? true : undefined}><summary><MapPin size={18}/><span>{tr ? "Adres ve kurum iletişimi" : "Address and institution contact"}</span><small>{tr ? "İsteğe bağlı" : "Optional"}</small><Plus size={18}/></summary><fieldset disabled={loading || !registrationEnabled}><legend className="sr-only">{t.sectionAddress[language]}</legend><div className={styles.fieldGrid}><div className={styles.field}><label htmlFor="city">{t.city[language]}</label><select id="city" value={form.city} onChange={e=>update("city",e.target.value)} autoComplete="address-level1"><option value="">{tr ? "İl seçin" : "Select province"}</option>{TURKISH_PROVINCES.map(province=><option key={province}>{province}</option>)}</select></div><Field id="district" label={t.district[language]} value={form.district} onChange={e=>update("district",e.target.value)} maxLength={80} autoComplete="address-level2"/></div><Field id="addressLine" label={t.addressLine[language]} value={form.addressLine} onChange={e=>update("addressLine",e.target.value)} maxLength={400} autoComplete="street-address"/><Field id="postalCode" label={t.postalCode[language]} inputMode="numeric" value={form.postalCode} onChange={e=>update("postalCode",maskPostalCode(e.target.value))} autoComplete="postal-code" error={fieldErrors.postalCode}/><div className={styles.fieldGrid}><Field id="institutionPhone" label={t.institutionPhone[language]} type="tel" inputMode="tel" value={form.institutionPhone} onChange={e=>update("institutionPhone",maskTrPhone(e.target.value))} error={fieldErrors.institutionPhone}/><Field id="institutionEmail" label={t.institutionEmail[language]} type="email" maxLength={180} value={form.institutionEmail} onChange={e=>update("institutionEmail",e.target.value)} error={fieldErrors.institutionEmail}/></div><Field id="website" label={t.website[language]} type="url" maxLength={200} value={form.website} onChange={e=>update("website",e.target.value)} placeholder="https://kurum.com" error={fieldErrors.website}/></fieldset></details>
        {turnstileEnabled && <div className={styles.security}><div><ShieldCheck size={24}/><span><strong>{tr ? "Güvenlik doğrulaması" : "Security verification"}</strong><small>{tr ? "Başvurunuzun güvenliği için doğrulamayı tamamlayın." : "Complete verification to protect your application."}</small></span></div><TurnstileWidget language={language} size="flexible" resetKey={captchaResetKey} onToken={setCaptchaToken} onError={()=>setError(t.captchaUnavailable[language])}/></div>}
        <div className={styles.consent}><Checkbox id="kvkk" checked={kvkkAccepted} disabled={loading || !registrationEnabled} onCheckedChange={checked=>setKvkkAccepted(checked===true)}/><Label htmlFor="kvkk">{tr ? <>Kurum başvurusu <Link href="/kvkk">aydınlatma metnini</Link> okudum.</> : <>I have read the institution application <Link href="/kvkk">privacy notice</Link>.</>} <Link href="/kullanim-sartlari">{t.terms[language]}</Link></Label></div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button type="submit" disabled={loading || !registrationEnabled || (turnstileEnabled && !captchaToken)} className={styles.submit}>{loading ? <Loader2 size={18} className="animate-spin"/> : null}{loading ? (tr ? "Başvurunuz gönderiliyor…" : "Submitting…") : t.submit[language]}<ArrowRight size={18}/></Button>
        <p className={styles.approval}><Mail size={18}/>{tr ? "Onaydan sonra giriş bilgileriniz e-posta ile gönderilir." : "After approval, your sign-in details are sent by email."}</p>
      </form>
      <div className={styles.apps}><p>{tr ? "Hesabınıza uygulamalarımızdan erişin." : "Access your account through our apps."}</p><Link href="/indir"><Monitor size={15}/><Smartphone size={15}/>{tr ? "Masaüstü ve mobil uygulamalar" : "Desktop and mobile apps"}<ArrowUpRight size={15}/></Link></div>
    </section>
  </div>
}
