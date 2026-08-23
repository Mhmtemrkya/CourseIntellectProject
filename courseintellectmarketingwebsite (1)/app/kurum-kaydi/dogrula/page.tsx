"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/context/language-context"
import { apiRequest } from "@/lib/api-client"

type VerifyState = "loading" | "success" | "failed"

export default function KurumKaydiDogrulaPage() {
  const { language } = useLanguage()
  const [state, setState] = useState<VerifyState>("loading")

  useEffect(() => {
    // Statik dışa aktarımda useSearchParams prerender'ı zorlaştırıyor; sorgu
    // dizesini doğrudan okuyoruz.
    const token = new URLSearchParams(window.location.search).get("token")

    const verify = async () => {
      try {
        await apiRequest("/api/platformops/tenants/verify", {
          method: "POST",
          token: null,
          body: { token },
        })
        setState("success")
      } catch {
        // Geçersiz, süresi dolmuş ve bilinmeyen kod aynı sonucu verir.
        setState("failed")
      }
    }

    void verify()
  }, [])

  const t = {
    loading: { tr: "Başvurunuz doğrulanıyor...", en: "Verifying your application..." },
    successTitle: { tr: "Adresiniz Doğrulandı", en: "Address Verified" },
    successDesc: {
      tr: "Başvurunuz incelemeye alındı. Onaylandıktan sonra kurum yönetici bilgileriniz sizinle paylaşılacak.",
      en: "Your application is now under review. Once approved, your institution admin details will be shared with you.",
    },
    failedTitle: { tr: "Bağlantı Geçersiz", en: "Invalid Link" },
    failedDesc: {
      tr: "Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Formu yeniden doldurup tekrar başvurabilirsiniz.",
      en: "This verification link is invalid or has expired. You can submit the form again.",
    },
    retry: { tr: "Yeniden Başvur", en: "Apply Again" },
    backHome: { tr: "Ana Sayfaya Dön", en: "Back to Home" },
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image src="/images/logo.png" alt="SchoolAsist" width={40} height={40} />
          <span className="text-xl font-bold">
            Course<span className="text-accent">Intellect</span>
          </span>
        </Link>

        {state === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">{t.loading[language]}</p>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <CheckCircle className="w-14 h-14 mx-auto text-green-600" />
            <h1 className="text-2xl font-bold">{t.successTitle[language]}</h1>
            <p className="text-muted-foreground">{t.successDesc[language]}</p>
            <Button asChild className="w-full">
              <Link href="/">{t.backHome[language]}</Link>
            </Button>
          </div>
        )}

        {state === "failed" && (
          <div className="space-y-4">
            <XCircle className="w-14 h-14 mx-auto text-destructive" />
            <h1 className="text-2xl font-bold">{t.failedTitle[language]}</h1>
            <p className="text-muted-foreground">{t.failedDesc[language]}</p>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/">{t.backHome[language]}</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/kurum-kaydi">{t.retry[language]}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
