"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUserAuth } from "@/context/user-auth-context"
import { apiRequest, ApiRequestError } from "@/lib/api-client"

type SupportTicket = {
  id: string
  ticketNumber: string
  subject: string
  tenant?: string
  tenantName?: string
  user?: string
  requestedBy?: string
  category: string
  priority: string
  status: string
  summary: string
  lastMessage?: string
  messages?: number
  createdAtUtc: string
  updatedAtUtc: string
}

const CATEGORIES = [
  { value: "Genel", label: "Genel" },
  { value: "Teknik", label: "Teknik destek" },
  { value: "Faturalama", label: "Faturalama" },
  { value: "Hesap", label: "Hesap & Erişim" },
  { value: "Öneri", label: "Öneri / Geri bildirim" },
]

const PRIORITIES = [
  { value: "low", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
]

export default function SupportPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useUserAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState("Genel")
  const [priority, setPriority] = useState("normal")
  const [summary, setSummary] = useState("")

  const isTenantAdmin = user?.role?.toLowerCase() === "admin"

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/giris?next=${encodeURIComponent("/destek")}`)
    }
  }, [isLoading, isAuthenticated, router])

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated || !isTenantAdmin) return
    setLoadingTickets(true)
    try {
      const list = await apiRequest<SupportTicket[]>("/api/support-tickets/mine")
      setTickets(Array.isArray(list) ? list : [])
    } catch {
      // Sessiz geç — UI'da boş liste gösterilir
    } finally {
      setLoadingTickets(false)
    }
  }, [isAuthenticated, isTenantAdmin])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Sadece kurum yöneticisi ticket açabilir
  if (!isTenantAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-32 text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
          <ShieldCheck className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold">Sadece kurum yöneticisi</h1>
        <p className="mt-3 text-muted-foreground">
          Destek talebi yalnızca kurum yöneticisi tarafından oluşturulabilir.
          Lütfen kurumunuzun yöneticisine ulaşın.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="outline">Anasayfaya dön</Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !summary.trim()) {
      setError("Konu ve mesaj zorunludur.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const created = await apiRequest<SupportTicket>("/api/support-tickets", {
        method: "POST",
        body: { subject: subject.trim(), summary: summary.trim(), category, priority },
      })
      setSuccessId(created.ticketNumber || created.id)
      setSubject("")
      setSummary("")
      setCategory("Genel")
      setPriority("normal")
      await loadTickets()
      // Başarı mesajı 5 sn sonra kapanır
      setTimeout(() => setSuccessId(null), 5000)
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message || "Talep oluşturulamadı.")
      } else {
        setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-20 lg:py-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Anasayfaya dön
      </Link>

      <div className="mt-8 mb-10">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-accent/85">
          <span aria-hidden className="inline-block h-px w-8 bg-accent" />
          <span>Destek · Ticket Sistemi</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Bize ulaşın</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Bir sorun ya da öneriniz mi var? Talebinizi açın, ekibimiz en kısa sürede
          dönsün. Talepleriniz aşağıdaki listeden takip edilebilir.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-8">
              <h2 className="text-lg font-semibold">Yeni talep</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kurum: <span className="font-medium text-foreground">{user?.name || user?.email}</span>
              </p>

              {successId && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">Talebiniz oluşturuldu</div>
                    <div className="text-emerald-400/80 text-xs mt-0.5">
                      Takip numarası: <span className="font-mono">{successId}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Konu</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Kısa konu başlığı"
                    maxLength={120}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={category} onValueChange={setCategory} disabled={submitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Öncelik</Label>
                    <Select value={priority} onValueChange={setPriority} disabled={submitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Açıklama</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Sorunu / talebi mümkün olduğunca açık şekilde anlatın..."
                    rows={6}
                    maxLength={1800}
                    disabled={submitting}
                    required
                  />
                  <div className="text-right text-[11px] text-muted-foreground">
                    {summary.length} / 1800
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
                    </>
                  ) : (
                    <>
                      Talebi gönder
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* My tickets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Açtığım talepler</h2>
            {loadingTickets && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {!loadingTickets && tickets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <LifeBuoy className="mx-auto mb-3 h-6 w-6 opacity-40" />
                Henüz talep oluşturmadınız.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const status = ticket.status?.toLowerCase() || "open"
  const hasReply =
    Boolean(ticket.lastMessage) &&
    ticket.lastMessage?.trim() !== ticket.summary?.trim()
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>{ticket.ticketNumber}</span>
              <span>·</span>
              <span>{ticket.category}</span>
            </div>
            <div className="mt-1.5 truncate font-medium text-foreground">
              {ticket.subject}
            </div>
            <div className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
              {ticket.summary}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {hasReply && (
          <div className="mt-3 rounded-lg border border-accent/25 bg-accent/[0.06] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-accent">
              <ShieldCheck className="h-3 w-3" />
              CourseIntellect Yanıtı
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90 line-clamp-3">
              {ticket.lastMessage}
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{new Date(ticket.createdAtUtc).toLocaleString("tr-TR")}</span>
          <div className="flex items-center gap-2">
            {ticket.messages ? (
              <span className="font-mono">{ticket.messages} mesaj</span>
            ) : null}
            <PriorityChip priority={ticket.priority} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "resolved" || status === "closed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Çözüldü
      </span>
    )
  }
  if (status === "in-progress" || status === "pending") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        <Clock className="h-3 w-3" /> İşleniyor
      </span>
    )
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <XCircle className="h-3 w-3" /> İptal
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
      <AlertCircle className="h-3 w-3" /> Açık
    </span>
  )
}

function PriorityChip({ priority }: { priority: string }) {
  const p = (priority || "normal").toLowerCase()
  const map: Record<string, { label: string; cls: string }> = {
    urgent: { label: "Acil", cls: "text-red-400" },
    high: { label: "Yüksek", cls: "text-amber-400" },
    normal: { label: "Normal", cls: "text-muted-foreground" },
    low: { label: "Düşük", cls: "text-muted-foreground/70" },
  }
  const c = map[p] || map.normal
  return <span className={`uppercase tracking-[0.14em] ${c.cls}`}>{c.label}</span>
}
