"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Building2, LifeBuoy, CheckCircle2 } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget"

export default function SupportPage() {
  const [form, setForm] = useState({ customerNumber: "", name: "", email: "", category: "Destek", subject: "", message: "" })
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try {
      await apiRequest("/api/public-support", { method: "POST", token: null, body: { ...form, captchaToken } })
      setSent(true)
    } catch (e) { setError(e instanceof Error ? e.message : "Talep gönderilemedi. Lütfen tekrar deneyin.") }
    finally { setBusy(false); setCaptchaToken(null); setResetKey(k => k + 1) }
  }
  const field = "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
  return <main className="min-h-screen bg-slate-50 px-5 pb-20 pt-32 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <p className="mb-3 font-semibold text-orange-600">SCHOOLASIST DESTEK</p>
      <h1 className="text-4xl font-bold tracking-tight">Size nasıl yardımcı olabiliriz?</h1>
      <p className="mt-4 max-w-2xl text-slate-600">Kurum kaydı oluşturun veya müşteri numaranızla sorun ve şikayetlerinizi iletin. Hesabınıza giriş yapamıyorsanız da buradan bize ulaşabilirsiniz.</p>
      <div className="mt-10 grid gap-7 md:grid-cols-[1fr_1.6fr]">
        <aside className="self-start rounded-3xl bg-slate-900 p-8 text-white">
          <Building2 className="mb-5 h-10 w-10 text-orange-400" />
          <h2 className="text-2xl font-bold">Kurumunuz için ücretsiz kayıt</h2>
          <p className="mt-4 text-slate-300">Paket seçimi veya ödeme gerekmez. Başvurunuz yönetim tarafından incelenir; onay ve ilk giriş bilgileriniz e-posta ile gönderilir.</p>
          <Link href="/kurum-kaydi" className="mt-7 inline-block rounded-xl bg-orange-400 px-6 py-3 font-bold text-slate-950">Ücretsiz kurum kaydı oluştur</Link>
          <p className="mt-8 text-sm text-slate-300">Müşteri numaranız onay e-postanızda yer alır. Numaranızı bilmiyorsanız <Link href="/iletisim" className="underline">iletişim formunu</Link> kullanabilirsiniz.</p>
        </aside>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {sent ? <div role="status" className="py-12 text-center"><CheckCircle2 className="mx-auto mb-5 h-12 w-12 text-green-600" /><h2 className="text-2xl font-bold">Talebiniz alındı</h2><p className="mt-4 text-slate-600">Destek ekibimiz belirttiğiniz e-posta adresinden size ulaşacak.</p></div> : <form onSubmit={submit} className="space-y-5">
            <h2 className="flex items-center gap-3 text-2xl font-bold"><LifeBuoy /> Destek ve şikayet formu</h2>
            <label className="block">Müşteri numarası<input className={field} required maxLength={40} minLength={3} placeholder="SA-123456789012" value={form.customerNumber} onChange={e => setForm({ ...form, customerNumber: e.target.value })} /></label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label>Ad soyad<input className={field} autoComplete="name" required minLength={2} maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label>E-posta<input className={field} autoComplete="email" type="email" required maxLength={180} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            </div>
            <label className="block">Talep türü<select className={field} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>Destek</option><option>Şikayet</option><option>Erişim</option></select></label>
            <label className="block">Konu<input className={field} required minLength={3} maxLength={180} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>
            <label className="block">Sorununuzu anlatın<textarea className={field} rows={5} required minLength={10} maxLength={2000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
            <p className="text-xs text-slate-500">Parola veya öğrencilere ait özel bilgileri paylaşmayın. <Link href="/kvkk" className="underline">Aydınlatma metni</Link></p>
            <TurnstileWidget onToken={setCaptchaToken} resetKey={resetKey} onError={() => setError("Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyin.")} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={busy || (turnstileEnabled && !captchaToken)} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50">{busy ? "Gönderiliyor…" : "Talebi gönder"}</button>
          </form>}
        </section>
      </div>
    </div>
  </main>
}
