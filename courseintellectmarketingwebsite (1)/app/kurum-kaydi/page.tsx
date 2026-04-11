"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Building2, Mail, Phone, Users, CheckCircle, Loader2, ArrowLeft,
  ShieldCheck, BarChart3, Sparkles, Lock,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/context/language-context"
import { apiRequest } from "@/lib/api-client"

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

export default function KurumKaydiPage() {
  const { language } = useLanguage()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    institutionName: "",
    contactName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    plan: "Starter",
    estimatedStudents: 50,
  })

  const t = {
    title: { tr: "Kurumunuzu Kaydedin", en: "Register Your Institution" },
    subtitle: {
      tr: "Formu doldurun, ekibimiz en kısa sürede sizinle iletişime geçsin.",
      en: "Fill out the form and our team will contact you shortly.",
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
    password: { tr: "Kurum Yöneticisi Şifresi", en: "Institution Admin Password" },
    confirmPassword: { tr: "Şifre Tekrarı", en: "Confirm Password" },
    plan: { tr: "İlgilendiğiniz Plan", en: "Plan of Interest" },
    students: { tr: "Tahmini Öğrenci Sayısı", en: "Estimated Student Count" },
    submit: { tr: "Başvuruyu Gönder", en: "Submit Application" },
    successTitle: { tr: "Başvurunuz Alındı!", en: "Application Received!" },
    successDesc: {
      tr: "Başvurunuz platform yönetimine iletildi. Onaylandıktan sonra e-postanız ve oluşturduğunuz şifreyle Kurum Girişi yapabilirsiniz.",
      en: "Your application has been sent to platform management. After approval, you can sign in with your email and the password you created.",
    },
    backHome: { tr: "Ana Sayfaya Dön", en: "Back to Home" },
    back: { tr: "Geri", en: "Back" },
    privacy: { tr: "Gizlilik", en: "Privacy" },
    terms: { tr: "Şartlar", en: "Terms" },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (form.password.length < 8) {
      setError(language === "tr" ? "Şifre en az 8 karakter olmalı." : "Password must be at least 8 characters.")
      return
    }
    if (form.password !== form.confirmPassword) {
      setError(language === "tr" ? "Şifreler eşleşmiyor." : "Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      await apiRequest("/api/platformops/tenants/register", {
        method: "POST",
        token: null,
        body: {
          institutionName: form.institutionName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          plan: form.plan,
          estimatedStudents: Number(form.estimatedStudents),
        },
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.message || "Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="CourseIntellect" width={48} height={48} className="brightness-0 invert" />
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
            <p className="text-muted-foreground mb-8">{t.successDesc[language]}</p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/">{t.backHome[language]}</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="CourseIntellect" width={48} height={48} className="brightness-0 invert" />
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
              <Image src="/images/logo.png" alt="CourseIntellect" width={40} height={40} />
              <span className="text-xl font-bold">Course<span className="text-accent">Intellect</span></span>
            </Link>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link
              href="/fiyatlar"
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactName">{t.contactName[language]}</Label>
                    <Input
                      id="contactName"
                      value={form.contactName}
                      onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                      placeholder="Örn: Ahmet Yılmaz"
                      required
                    />
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.phone[language]}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="05xx xxx xx xx"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">{t.password[language]}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          minLength={8}
                          value={form.password}
                          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                          placeholder="En az 8 karakter"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t.confirmPassword[language]}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          minLength={8}
                          value={form.confirmPassword}
                          onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                          placeholder="Şifreyi tekrar girin"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

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

                  <div className="space-y-2">
                    <Label htmlFor="students">{t.students[language]}</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="students"
                        type="number"
                        min={1}
                        value={form.estimatedStudents}
                        onChange={(e) => setForm((p) => ({ ...p, estimatedStudents: Number(e.target.value) }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

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
