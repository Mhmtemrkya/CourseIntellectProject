"use client"
import { useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

type Ticket = { id: string; ticketNumber: string; subject: string; tenant: string; customerNumber?: string; contactEmail?: string; user: string; userRole: string; category: string; summary: string; status: string; lastMessage: string; replyEmailSent?: boolean | null }
export default function SupportAdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState("")
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  async function load() {
    setLoading(true); setError("")
    try { setTickets(await apiRequest<Ticket[]>("/api/platformops/support-tickets")) }
    catch (e) { setError(e instanceof Error ? e.message : "Talepler alınamadı") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function update(status: string, sendReply = false) {
    if (!selected || busy || (sendReply && !reply.trim())) return
    setBusy(true); setError(""); setNotice("")
    try {
      const updated = await apiRequest<Ticket>(`/api/platformops/support-tickets/${selected.id}`, { method: "PUT", body: { status, ...(sendReply ? { lastMessage: reply.trim() } : {}) } })
      setTickets(items => items.map(t => t.id === updated.id ? updated : t)); setSelected(updated)
      if (updated.replyEmailSent === false) setError("Yanıt kaydedildi ancak e-posta gönderilemedi. E-posta yapılandırmasını kontrol edip yeniden gönderin.")
      else { setNotice(sendReply ? (updated.replyEmailSent === true ? "Yanıt kaydedildi ve e-posta gönderildi." : "Yanıt talebe kaydedildi.") : "Talep durumu güncellendi."); if (sendReply) setReply("") }
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı") }
    finally { setBusy(false) }
  }
  return <div className="space-y-6 p-6">
    <h1 className="text-3xl font-bold">Destek ve şikayetler</h1>
    <p className="text-muted-foreground">Müşteri numarasıyla gelen başvuruları inceleyin, yanıtlayın ve sonuçlandırın.</p>
    <input aria-label="Talep ara" className="w-full rounded-xl border p-3" placeholder="Müşteri numarası, kurum, konu veya e-posta ara" value={search} onChange={e => setSearch(e.target.value)} />
    {error && <p role="alert" className="text-red-600">{error} <button onClick={load} className="underline">Yenile</button></p>}
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">{loading ? <p>Yükleniyor…</p> : tickets.length === 0 ? <p>Henüz destek talebi yok.</p> : tickets.filter(t => `${t.customerNumber} ${t.tenant} ${t.subject} ${t.contactEmail}`.toLowerCase().includes(search.toLowerCase())).map(t => <button key={t.id} onClick={() => { setSelected(t); setReply(""); setNotice("") }} className={`w-full rounded-xl border p-5 text-left ${selected?.id === t.id ? "border-orange-500 bg-orange-50" : "bg-white"}`}><p className="font-semibold">{t.subject}</p><p className="text-sm">{t.tenant} · {t.customerNumber || "—"}</p><p className="text-sm text-slate-500">{t.contactEmail} · {t.category} · {t.status}</p></button>)}</div>
      {selected && <section className="space-y-4 self-start rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-bold">{selected.subject}</h2>
        <p>{selected.user} · {selected.contactEmail}</p><p className="text-xs text-slate-500">{selected.userRole} · {selected.customerNumber}</p>
        <p className="whitespace-pre-wrap">{selected.summary}</p>
        {selected.lastMessage !== selected.summary && <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Son yanıt</p><p className="whitespace-pre-wrap">{selected.lastMessage}</p></div>}
        <label className="block">Yanıt<textarea className="mt-2 w-full rounded-xl border p-3" rows={5} maxLength={2000} value={reply} onChange={e => setReply(e.target.value)} /></label>
        <p className="text-xs text-slate-500">Harici başvuruların kimliği doğrulanmamıştır. Yanıtta kurumun özel bilgilerini paylaşmayın.</p>
        <div className="flex flex-wrap gap-3"><button disabled={busy || !reply.trim()} onClick={() => update("in-progress", true)} className="rounded-xl bg-orange-500 px-4 py-3 text-white disabled:opacity-50">Yanıtı gönder</button><button disabled={busy} onClick={() => update(selected.status === "resolved" ? "open" : "resolved")} className="rounded-xl border px-4 py-3">{selected.status === "resolved" ? "Yeniden aç" : "Çözüldü olarak işaretle"}</button></div>
      </section>}
    </div>
  </div>
}
