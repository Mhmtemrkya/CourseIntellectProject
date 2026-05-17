"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { GraduationCap, Users, BookOpen, Calculator, Eye, EyeOff, ArrowLeft, Loader2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useUserAuth } from "@/context/user-auth-context"
import { useLanguage } from "@/context/language-context"
import type { UserRole } from "@/types/user"
import { cn } from "@/lib/utils"

const userTypes: {
  role: UserRole
  icon: typeof GraduationCap
  label: { tr: string; en: string }
  description: { tr: string; en: string }
  color: string
}[] = [
  {
    role: "student",
    icon: GraduationCap,
    label: { tr: "Öğrenci", en: "Student" },
    description: { tr: "Derslerinizi takip edin", en: "Track your courses" },
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    role: "parent",
    icon: Users,
    label: { tr: "Veli", en: "Parent" },
    description: { tr: "Çocuğunuzun eğitimini izleyin", en: "Monitor your child's education" },
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    role: "teacher",
    icon: BookOpen,
    label: { tr: "Öğretmen", en: "Teacher" },
    description: { tr: "Sınıflarınızı yönetin", en: "Manage your classes" },
    color: "bg-purple-500 hover:bg-purple-600",
  },
  {
    role: "accountant",
    icon: Calculator,
    label: { tr: "Muhasebeci", en: "Accountant" },
    description: { tr: "Finansal işlemleri yönetin", en: "Manage financial operations" },
    color: "bg-orange-500 hover:bg-orange-600",
  },
  {
    role: "administrative",
    icon: Building2,
    label: { tr: "Bilgi İşlem", en: "IT Staff" },
    description: { tr: "Teknik ve idari işlemleri yönetin", en: "Manage technical and administrative operations" },
    color: "bg-slate-600 hover:bg-slate-700",
  },
]

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const { login, register } = useUserAuth()
  const { language } = useLanguage()
  const router = useRouter()

  const t = {
    title: { tr: "Hoş Geldiniz", en: "Welcome" },
    subtitle: { tr: "Hesabınıza giriş yapın", en: "Sign in to your account" },
    selectRole: { tr: "Kullanıcı tipinizi seçin", en: "Select your user type" },
    email: { tr: "E-posta", en: "Email" },
    password: { tr: "Şifre", en: "Password" },
    name: { tr: "Ad Soyad", en: "Full Name" },
    phone: { tr: "Telefon", en: "Phone" },
    login: { tr: "Giriş Yap", en: "Sign In" },
    register: { tr: "Kayıt Ol", en: "Sign Up" },
    noAccount: { tr: "Hesabınız yok mu?", en: "Don't have an account?" },
    hasAccount: { tr: "Zaten hesabınız var mı?", en: "Already have an account?" },
    back: { tr: "Geri", en: "Back" },
    forgotPassword: { tr: "Şifremi Unuttum", en: "Forgot Password" },
    adminLogin: { tr: "Platform Admin Girişi", en: "Platform Admin Login" },
    demoCredentials: { tr: "Demo Hesap", en: "Demo Account" },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return

    setIsLoading(true)
    setError("")

    try {
      if (isRegister) {
        if (selectedRole === "admin") {
          router.push("/kurum-kaydi")
          return
        }

        const result = await register(email, password, name, selectedRole, phone)
        if (result.success) {
          setError("Site sahibi onayı bekleniyor.")
          setIsRegister(false)
          setPassword("")
        } else {
          setError(result.error || "Kayıt başarısız")
        }
      } else {
        const result = await login(email, password, selectedRole)
        if (result.success) {
          router.push("/")
        } else {
          setError(result.error || "Giriş başarısız")
        }
      }
    } catch (err) {
      setError("Bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  const getDemoCredentials = (role: UserRole) => {
    const demos: Record<UserRole, { email: string; password: string }> = {
      student: { email: "ogrenci@courseintellect.com", password: "ogrenci123" },
      parent: { email: "veli@courseintellect.com", password: "veli123" },
      teacher: { email: "ogretmen@courseintellect.com", password: "ogretmen123" },
      accountant: { email: "muhasebe@courseintellect.com", password: "muhasebe123" },
      administrative: { email: "idari.ceren", password: "CRN2026B" },
      admin: { email: "kurum.admin", password: "KRM2026A" },
      editor: { email: "editor@courseintellect.com", password: "editor123" },
    }
    return demos[role]
  }

  const usesUsernameCredential = selectedRole === "admin" || selectedRole === "administrative"

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="CourseIntellect"
              width={48}
              height={48}
              className="brightness-0 invert"
            />
            <span className="text-2xl font-bold text-primary-foreground">
              Course<span className="text-accent">Intellect</span>
            </span>
          </Link>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            {language === "tr" ? "Eğitimde Yeni Nesil Deneyim" : "Next Generation Education Experience"}
          </h1>
          <p className="text-lg text-primary-foreground/80">
            {language === "tr"
              ? "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu."
              : "Smart education platform designed for teachers, students and parents."}
          </p>
        </div>

        <div className="flex gap-4 text-primary-foreground/60 text-sm">
          <Link href="/kvkk" className="hover:text-primary-foreground">
            {language === "tr" ? "Gizlilik" : "Privacy"}
          </Link>
          <Link href="/kullanim-sartlari" className="hover:text-primary-foreground">
            {language === "tr" ? "Şartlar" : "Terms"}
          </Link>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/logo.png" alt="CourseIntellect" width={40} height={40} />
              <span className="text-xl font-bold">
                Course<span className="text-accent">Intellect</span>
              </span>
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {!selectedRole ? (
              // Role selection
              <motion.div
                key="role-selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">{t.title[language]}</h2>
                  <p className="text-muted-foreground">{t.selectRole[language]}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {userTypes.map((type, index) => {
                    const Icon = type.icon
                    return (
                      <motion.button
                        key={type.role}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => {
                          setIsRegister(false)
                          setSelectedRole(type.role)
                        }}
                        className={cn(
                          "group relative p-6 rounded-xl border-2 border-border hover:border-primary transition-all bg-card hover:shadow-lg",
                          type.role === "administrative" && "col-span-2",
                        )}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className={cn("p-3 rounded-full text-white", type.color)}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-foreground">{type.label[language]}</p>
                            <p className="text-xs text-muted-foreground mt-1">{type.description[language]}</p>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                <div className="pt-2 space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">
                        {language === "tr" ? "Kurum" : "Institution"}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setIsRegister(false)
                      setSelectedRole("admin")
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-primary transition-all bg-card hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-indigo-500 text-white">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground text-sm">
                          {language === "tr" ? "Kurum Girişi" : "Institution Login"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr" ? "Kurum yöneticisi olarak giriş yapın" : "Sign in as institution admin"}
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-sm">→</span>
                  </motion.button>

                  <p className="text-center text-xs text-muted-foreground">
                    {language === "tr" ? "Kurumunuz kayıtlı değil mi?" : "Institution not registered?"}{" "}
                    <Link href="/kurum-kaydi" className="text-primary hover:underline font-medium">
                      {language === "tr" ? "Kayıt Ol" : "Register"}
                    </Link>
                  </p>

                  <div className="text-center pt-1">
                    <Link
                      href="/admin/login"
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      {t.adminLogin[language]} →
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : (
              // Login form
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedRole(null)} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div>
                        <CardTitle>{isRegister ? t.register[language] : t.login[language]}</CardTitle>
                        <CardDescription>
                          {selectedRole === "admin"
                            ? language === "tr" ? "Kurum Yöneticisi" : "Institution Admin"
                            : userTypes.find((ut) => ut.role === selectedRole)?.label[language]}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {isRegister && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="name">{t.name[language]}</Label>
                            <Input
                              id="name"
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required={isRegister}
                              placeholder={language === "tr" ? "Adınız Soyadınız" : "Your Full Name"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">{t.phone[language]}</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder={language === "tr" ? "05xx xxx xx xx" : "+90"}
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="email">
                          {usesUsernameCredential ? language === "tr" ? "Kullanıcı adı" : "Username" : t.email[language]}
                        </Label>
                        <Input
                          id="email"
                          type={usesUsernameCredential ? "text" : "email"}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder={selectedRole === "admin" ? "kurum.admin" : selectedRole === "administrative" ? "idari.ceren" : "ornek@email.com"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">{t.password[language]}</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-destructive text-center"
                        >
                          {error}
                        </motion.p>
                      )}

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isRegister ? (
                          t.register[language]
                        ) : (
                          t.login[language]
                        )}
                      </Button>

                      {!isRegister && (
                        <div className="p-3 bg-secondary rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">{t.demoCredentials[language]}:</p>
                          <p className="text-xs font-mono">{getDemoCredentials(selectedRole).email}</p>
                          <p className="text-xs font-mono">{getDemoCredentials(selectedRole).password}</p>
                        </div>
                      )}

                      {selectedRole === "admin" ? (
                        <div className="text-center text-sm">
                          <span className="text-muted-foreground">
                            {language === "tr" ? "Kurumunuz henüz onaylanmadı mı?" : "Institution not approved yet?"}{" "}
                          </span>
                          <Link href="/kurum-kaydi" className="text-primary hover:underline font-medium">
                            {language === "tr" ? "Kurum Kaydı" : "Institution Registration"}
                          </Link>
                        </div>
                      ) : (
                        <div className="text-center text-sm">
                          <span className="text-muted-foreground">
                            {isRegister ? t.hasAccount[language] : t.noAccount[language]}{" "}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-primary hover:underline font-medium"
                          >
                            {isRegister ? t.login[language] : t.register[language]}
                          </button>
                        </div>
                      )}

                      {!isRegister && (
                        <div className="text-center">
                          <button type="button" className="text-sm text-muted-foreground hover:text-primary">
                            {t.forgotPassword[language]}
                          </button>
                        </div>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
