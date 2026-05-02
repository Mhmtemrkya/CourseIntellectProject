"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, Loader2, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSectionContent } from "@/context/content-context"
import { useUserAuth } from "@/context/user-auth-context"
import { apiRequest, ApiRequestError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type PurchaseResponse = {
  id: string
  invoiceNumber: string
  planName: string
  amount: number
  status: string
  billingPeriod: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan")
  const periodParam = searchParams.get("period") === "yearly" ? "yearly" : "monthly"
  const pricing = useSectionContent("pricing")
  const { user, isAuthenticated, isLoading } = useUserAuth()
  const [period, setPeriod] = useState<"monthly" | "yearly">(periodParam)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<PurchaseResponse | null>(null)

  const plan = useMemo(
    () => pricing.plans.find((p) => p.id === planId) || null,
    [pricing.plans, planId],
  )

  const monthlyPrice = plan?.priceMonthly || 0
  const yearlyPrice = plan?.priceYearly || monthlyPrice
  const unitPrice = period === "yearly" ? yearlyPrice : monthlyPrice
  const totalDue = period === "yearly" ? unitPrice * 12 : unitPrice

  // Auth gate — redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = `/satin-alma?plan=${encodeURIComponent(planId || "")}&period=${period}`
      router.push(`/giris?next=${encodeURIComponent(next)}`)
    }
  }, [isLoading, isAuthenticated, router, planId, period])

  if (!plan) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-32 text-center">
        <h1 className="text-2xl font-bold">Paket bulunamadı</h1>
        <p className="text-muted-foreground mt-3">
          Geçersiz ya da kaldırılmış bir paket seçtiniz.
        </p>
        <Link href="/fiyatlar">
          <Button className="mt-6">Fiyatlar Sayfasına Dön</Button>
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handlePurchase = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await apiRequest<PurchaseResponse>("/api/platformsubscriptions/purchase", {
        method: "POST",
        body: {
          planId: plan.id,
          planName: plan.name,
          amount: totalDue,
          billingPeriod: period === "yearly" ? "Yıllık" : "Aylık",
          currency: "TRY",
        },
      })
      setSuccess(response)
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message || "Satın alma sırasında bir sorun oluştu.")
      } else {
        setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Check className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold">Satın alma tamamlandı</h1>
          <p className="mt-3 text-muted-foreground">
            <span className="font-semibold text-foreground">{success.planName}</span> paketi aboneliğiniz aktive edildi.
          </p>
          <Card className="mt-8 text-left">
            <CardContent className="space-y-3 p-6">
              <Row label="Fatura No" value={<span className="font-mono">{success.invoiceNumber}</span>} />
              <Row label="Paket" value={success.planName} />
              <Row label="Periyot" value={success.billingPeriod} />
              <Row label="Tutar" value={`₺${success.amount.toLocaleString("tr-TR")}`} />
              <Row
                label="Durum"
                value={
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    <Check className="h-3 w-3" />
                    {success.status === "paid" ? "Ödendi" : "Bekliyor"}
                  </span>
                }
              />
            </CardContent>
          </Card>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/indir">
              <Button>Uygulamayı İndir</Button>
            </Link>
            <Link href="/fiyatlar">
              <Button variant="outline">Fiyatlar Sayfası</Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-20 lg:py-28">
      <Link href="/fiyatlar" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Paketlere geri dön
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left: order summary */}
        <Card className="border-accent/20">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-accent">Sipariş Özeti</div>
                <h2 className="mt-2 text-2xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>
              {plan.isPopular && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
                  En Popüler
                </span>
              )}
            </div>

            {/* Period toggle */}
            <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border bg-secondary/30 p-1.5">
              {(["monthly", "yearly"] as const).map((opt) => {
                const active = opt === period
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPeriod(opt)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt === "monthly" ? "Aylık" : "Yıllık"}
                    {opt === "yearly" && yearlyPrice < monthlyPrice && (
                      <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        2 ay ücretsiz
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Pricing */}
            <div className="mt-7 space-y-3 border-t pt-6 text-sm">
              <Row label={`Aylık tutar (${period === "yearly" ? "yıllık peşin" : "aylık"})`} value={`₺${unitPrice.toLocaleString("tr-TR")}`} />
              {period === "yearly" && (
                <Row label="x 12 ay" value={`₺${(unitPrice * 12).toLocaleString("tr-TR")}`} />
              )}
              <div className="my-2 h-px bg-border" />
              <Row
                label={<span className="text-base font-semibold text-foreground">Toplam</span>}
                value={
                  <span className="text-lg font-bold">₺{totalDue.toLocaleString("tr-TR")}</span>
                }
              />
              <p className="pt-1 text-xs text-muted-foreground">KDV dahil. Faturalar e-posta ile gönderilir.</p>
            </div>

            {/* Features list */}
            <div className="mt-7 border-t pt-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Paket içeriği</div>
              <ul className="mt-3 space-y-2.5">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Right: confirmation */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-8">
              <h3 className="text-xl font-bold">Onay</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Bu işlem aboneliğinizi <span className="font-medium text-foreground">{plan.name}</span> paketine yükseltir.
                Ödeme entegrasyonu yakında — şu an manuel onay ile aktive edilir.
              </p>

              {user && (
                <div className="mt-6 space-y-1.5 rounded-xl border bg-secondary/30 px-4 py-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Kurum hesabı</div>
                  <div className="font-medium">{user.name || user.email}</div>
                  <div className="text-muted-foreground text-xs">{user.email}</div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                onClick={handlePurchase}
                disabled={submitting}
                className="mt-6 h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İşleniyor...
                  </>
                ) : (
                  <>
                    Aboneliği Onayla · ₺{totalDue.toLocaleString("tr-TR")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  KVKK ve ISO 27001 uyumlu altyapı. Faturalar otomatik üretilir, kurum panelinizde görüntülenebilir.
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="px-2 text-xs text-muted-foreground">
            Devam ederek <Link href="/kullanim-sartlari" className="underline">Kullanım Şartları</Link> ve <Link href="/kvkk" className="underline">KVKK</Link>&apos;yı kabul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
