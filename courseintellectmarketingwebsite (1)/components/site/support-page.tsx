"use client"
import { useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget"
import { SupportExperience } from "./support-experience"


const emptyForm = { customerNumber: "", name: "", email: "", category: "Destek", subject: "", message: "", institutionName: "" }
export function SupportPage({ contact = false }: { contact?: boolean }) {
  const [form, setForm] = useState(emptyForm)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [reset, setReset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  function field(key: keyof typeof form, value: string) { setForm(previous => ({ ...previous, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try {
      const body = contact ? { name: form.name.trim(), email: form.email.trim(), subject: form.subject.trim(), message: `${form.institutionName.trim() ? `Kurum: ${form.institutionName.trim()}\n\n` : ""}${form.message.trim()}`, captchaToken } : { customerNumber: form.customerNumber.trim(), name: form.name.trim(), email: form.email.trim(), category: form.category, subject: form.subject.trim(), message: form.message.trim(), captchaToken }
      await apiRequest(contact ? "/api/contactmessages" : "/api/public-support", { method: "POST", token: null, body })
      setSent(true); setForm(emptyForm)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "İşlem tamamlanamadı. Lütfen tekrar deneyin.") }
    finally { setBusy(false); setCaptchaToken(null); setReset(k => k + 1) }
  }
  const formContent = <div className="ref-service-form" id="support-form">{sent ? <div className="sa-success" role="status"><CheckCircle2 size={48} /><h2>Mesajınız alındı.</h2><p>{contact ? "İletişim talebiniz platform yönetimine iletildi." : "Destek talebiniz kaydedildi. Ekibimiz talebinizi inceleyecek."}</p><button className="sa-button" onClick={() => setSent(false)}>Yeni mesaj gönder</button></div> : <form onSubmit={submit} aria-label={contact ? "İletişim formu" : "Destek talebi formu"}>{!contact && <h2>Destek talebi oluştur</h2>}
    <div className={contact ? "ref-contact-fields" : "ref-support-fields"}>
    {!contact && <div className="sa-field"><label htmlFor="customerNumber">Müşteri numarası</label><input id="customerNumber" required minLength={3} maxLength={40} value={form.customerNumber} onChange={e => field("customerNumber", e.target.value)} placeholder="Örn. SA-DEMO-001" /></div>}
    <div className="sa-field"><label htmlFor="name">Ad soyad</label><input id="name" required minLength={2} maxLength={150} autoComplete="name" placeholder="Adınız soyadınız" value={form.name} onChange={e => field("name", e.target.value)} /></div>
    <div className="sa-field"><label htmlFor="email">E-posta</label><input id="email" type="email" required maxLength={180} autoComplete="email" placeholder="E-posta adresiniz" value={form.email} onChange={e => field("email", e.target.value)} /></div>
    {contact ? <div className="sa-field"><label htmlFor="institutionName">Kurum adı <small>(isteğe bağlı)</small></label><input id="institutionName" maxLength={150} autoComplete="organization" placeholder="Örn. Demo Kurum" value={form.institutionName} onChange={e => field("institutionName", e.target.value)} /></div> : <div className="sa-field"><label htmlFor="category">Talep türü</label><select id="category" value={form.category} onChange={e => field("category", e.target.value)}>{["Destek", "Şikayet", "Erişim"].map(category => <option key={category}>{category}</option>)}</select></div>}
    <div className="sa-field ref-field-wide"><label htmlFor="subject">Konu</label>{contact ? <select id="subject" required value={form.subject} onChange={e => field("subject", e.target.value)}><option value="" disabled>Seçiniz</option>{["Kurum başvurusu", "Platform hakkında bilgi", "İş birliği", "Diğer"].map(subject => <option key={subject}>{subject}</option>)}</select> : <input id="subject" required minLength={3} maxLength={180} placeholder="Talebinizin konusunu yazın" value={form.subject} onChange={e => field("subject", e.target.value)} />}</div>
    <div className="sa-field ref-field-wide"><label htmlFor="message">{contact ? "Mesajınız" : "Sorununuzu anlatın"}</label><textarea id="message" required minLength={10} maxLength={contact ? 1800 : 2000} placeholder={contact ? "Mesajınızı buraya yazın…" : "Detayları buraya yazın…"} value={form.message} onChange={e => field("message", e.target.value)} /></div>
    </div><div className="ref-form-security"><ShieldCheck size={24} /><div><strong>Güvenlik doğrulaması</strong><TurnstileWidget size="compact" key={reset} onToken={setCaptchaToken} onError={() => setError("Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.")} />{!turnstileEnabled && <p>Bilgileriniz talebinizi değerlendirmek için kullanılır.</p>}</div></div>{error && <p className="sa-error" role="alert">{error}</p>}<button type="submit" className="sa-button" disabled={busy || (turnstileEnabled && !captchaToken)}>{busy ? <><Loader2 size={17} className="animate-spin" /> Gönderiliyor…</> : <>{contact ? "Mesajı gönder" : "Talep oluştur"} <ArrowRight size={18} /></>}</button><p className="ref-form-privacy">Parola veya öğrenciye ait özel bilgi paylaşmayın. <Link href="/kvkk">Aydınlatma metni</Link></p>
  </form>}</div>
  if (!contact) return <SupportExperience category={form.category} onCategory={category => field("category", category)}>{formContent}</SupportExperience>
  return <div className="ref-support ref-contact"><section className="ref-service-hero"><div><h1>Tanışalım.<br /><span>Birlikte başlayalım.</span></h1><p>Kurumunuz veya başvurunuz hakkında bize yazın.</p></div></section>
    <div className="ref-service-content"><aside>
      <Image src="/images/logo.png" width={100} height={100} alt="SchoolAsist" className="ref-contact-logo" /><h2>Mevcut kurum<br />müşterisi misiniz?</h2><p>Eğer kurumunuz zaten SchoolAsist kullanıyorsa, müşteri numaranızla destek sayfasına giderek daha hızlı destek alabilirsiniz.</p><Link className="sa-text-link" href="/destek">Müşteri numaranızla destek sayfasına gidin <ArrowRight size={20} /></Link><hr /><h3>Kurum kaydı için</h3><p>ücretsiz başvuru formunu kullanın.</p><Link className="sa-text-link" href="/kurum-kaydi">Kurum Kaydı <ArrowRight size={20} /></Link><div className="ref-company-contact"><strong>Maydanoz Yazılım</strong><a href="mailto:info@schoolasist.com">info@schoolasist.com</a><a href="tel:+908502428425">0850 242 84 25</a></div>
    </aside>{formContent}</div></div>
}
