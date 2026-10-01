"use client"
import { useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Headphones, Info, Loader2, MessageCircle, Search, ShieldCheck, UserRound } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget"
import { SceneImage } from "./product-story"

const questions = [
  ["Müşteri numaramı nereden bulabilirim?", "Kurumunuz onaylandığında gönderilen e-postada müşteri numaranız yer alır. Bulamıyorsanız iletişim sayfasından bize ulaşın."],
  ["Kurum kaydı ücretli mi?", "Şu anda paket seçmeden ücretsiz kurum başvurusu yapabilirsiniz. E-postanızı doğruladıktan sonra başvurunuz platform yöneticisinin onayına sunulur."],
  ["Doğrulama e-postası gelmedi. Ne yapmalıyım?", "Spam klasörünüzü kontrol edin. Bağlantı geçersiz veya süresi dolmuşsa aynı e-posta adresiyle yeniden başvurabilirsiniz. Sorun devam ederse bize ulaşın."],
  ["Geçici parolamın süresi doldu.", "Destek ekibine müşteri numaranızla başvurun. Platform yöneticisi yeni kurulum bilgileri oluşturabilir. Yeni parola üretildiğinde eski parola geçersiz olur."],
  ["Kurumum kapatıldığında ne olur?", "Kapatılan kurumun kullanıcılarının platform erişimi de engellenir. Erişim durumunuz için kurum yöneticinizle veya destek ekibiyle iletişime geçin."],
]
const emptyForm = { customerNumber: "", name: "", email: "", category: "Destek", subject: "", message: "", institutionName: "" }
export function SupportPage({ contact = false }: { contact?: boolean }) {
  const [form, setForm] = useState(emptyForm)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [reset, setReset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
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
  return <div className={`ref-support ${contact ? "ref-contact" : ""}`}><section className="ref-service-hero">
    {!contact && <><SceneImage asset="support-symbol" alt="Destek için konuşma balonu ve soru işareti sahnesi" priority className="ref-support-symbol" /><SceneImage asset="support-laptop" alt="" className="ref-support-laptop" /></>}
    <div><h1>{contact ? "Tanışalım." : "Sorununuzu"}<br /><span>{contact ? "Birlikte başlayalım." : "birlikte çözelim."}</span></h1><p>{contact ? "Kurumunuz veya başvurunuz hakkında bize yazın." : "Müşteri numaranızla destek talebi oluşturun."}</p>{!contact && <div className="ref-support-search"><Search size={23} /><label htmlFor="faq-search" className="sr-only">Yardım konularında ara</label><input id="faq-search" type="search" placeholder="Yardım konularında ara" value={search} onChange={event => setSearch(event.target.value)} /></div>}</div>
  </section>{!contact && search.trim() && <section className="ref-search-results" aria-label="Yardım arama sonuçları"><div className="sa-faq">{questions.filter(q => q.join(" ").toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}{!questions.some(q => q.join(" ").toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))) && <p role="status">Bu aramayla eşleşen konu bulunamadı.</p>}</div></section>}
  <div className="ref-service-content"><aside>{contact ? <>
    <Image src="/images/logo.png" width={100} height={100} alt="SchoolAsist" className="ref-contact-logo" /><h2>Mevcut kurum<br />müşterisi misiniz?</h2><p>Eğer kurumunuz zaten SchoolAsist kullanıyorsa, müşteri numaranızla destek sayfasına giderek daha hızlı destek alabilirsiniz.</p><Link className="sa-text-link" href="/destek">Müşteri numaranızla destek sayfasına gidin <ArrowRight size={20} /></Link><hr /><h3>Kurum kaydı için</h3><p>ücretsiz başvuru formunu kullanın.</p><Link className="sa-text-link" href="/kurum-kaydi">Kurum Kaydı <ArrowRight size={20} /></Link><div className="ref-company-contact"><strong>Maydanoz Yazılım</strong><a href="mailto:info@schoolasist.com">info@schoolasist.com</a><a href="tel:+908502428425">0850 242 84 25</a></div>
  </> : <><p className="ref-service-kicker">DESTEK</p><h2>Nasıl yardımcı<br />olabiliriz?</h2><p>Karşılaştığınız sorunlar, talepleriniz veya önerileriniz için destek talebi oluşturun. Ekibimiz en kısa sürede sizinle iletişime geçer.</p><div className="ref-support-categories">{[["Destek", "Teknik destek ve kullanım sorunları", Headphones], ["Şikayet", "Görüş ve şikayetlerinizi iletin", MessageCircle], ["Erişim", "Hesap ve erişim talepleri", UserRound]].map(([category, text, Icon]) => { const I = Icon as typeof Headphones; return <a key={String(category)} href="#support-form" onClick={() => field("category", String(category))}><i><I size={24} /></i><span><strong>{String(category)}</strong><small>{String(text)}</small></span><ChevronRight size={18} /></a> })}</div><div className="ref-customer-hint"><Info /><div><p>Müşteri numaranız onay e-postanızda yer alır.</p><p>Numaranızı bilmiyorsanız <Link href="/iletisim">iletişim formunu kullanın. <ArrowUpRight size={14} /></Link></p></div></div></> }</aside>
  <div className="ref-service-form" id="support-form">{sent ? <div className="sa-success" role="status"><CheckCircle2 size={48} /><h2>Mesajınız alındı.</h2><p>{contact ? "İletişim talebiniz platform yönetimine iletildi." : "Destek talebiniz kaydedildi. Ekibimiz talebinizi inceleyecek."}</p><button className="sa-button" onClick={() => setSent(false)}>Yeni mesaj gönder</button></div> : <form onSubmit={submit} aria-label={contact ? "İletişim formu" : "Destek talebi formu"}>{!contact && <h2>Destek talebi oluştur</h2>}
    <div className={contact ? "ref-contact-fields" : "ref-support-fields"}>
    {!contact && <div className="sa-field"><label htmlFor="customerNumber">Müşteri numarası</label><input id="customerNumber" required minLength={3} maxLength={40} value={form.customerNumber} onChange={e => field("customerNumber", e.target.value)} placeholder="Müşteri numaranız" /></div>}
    <div className="sa-field"><label htmlFor="name">Ad soyad</label><input id="name" required minLength={2} maxLength={150} autoComplete="name" placeholder="Adınız soyadınız" value={form.name} onChange={e => field("name", e.target.value)} /></div>
    <div className="sa-field"><label htmlFor="email">E-posta</label><input id="email" type="email" required maxLength={180} autoComplete="email" placeholder="E-posta adresiniz" value={form.email} onChange={e => field("email", e.target.value)} /></div>
    {contact ? <div className="sa-field"><label htmlFor="institutionName">Kurum adı <small>(isteğe bağlı)</small></label><input id="institutionName" maxLength={150} autoComplete="organization" placeholder="Örn. Demo Kurum" value={form.institutionName} onChange={e => field("institutionName", e.target.value)} /></div> : <div className="sa-field"><label htmlFor="category">Talep türü</label><select id="category" value={form.category} onChange={e => field("category", e.target.value)}>{["Destek", "Şikayet", "Erişim"].map(category => <option key={category}>{category}</option>)}</select></div>}
    <div className="sa-field ref-field-wide"><label htmlFor="subject">Konu</label>{contact ? <select id="subject" required value={form.subject} onChange={e => field("subject", e.target.value)}><option value="" disabled>Seçiniz</option>{["Kurum başvurusu", "Platform hakkında bilgi", "İş birliği", "Diğer"].map(subject => <option key={subject}>{subject}</option>)}</select> : <input id="subject" required minLength={3} maxLength={180} placeholder="Talebinizin konusunu yazın" value={form.subject} onChange={e => field("subject", e.target.value)} />}</div>
    <div className="sa-field ref-field-wide"><label htmlFor="message">{contact ? "Mesajınız" : "Sorununuzu anlatın"}</label><textarea id="message" required minLength={10} maxLength={contact ? 1800 : 2000} placeholder={contact ? "Mesajınızı buraya yazın…" : "Detayları buraya yazın…"} value={form.message} onChange={e => field("message", e.target.value)} /></div>
    </div><div className="ref-form-security"><ShieldCheck size={24} /><div><strong>Güvenlik doğrulaması</strong><TurnstileWidget key={reset} onToken={setCaptchaToken} onError={() => setError("Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.")} />{!turnstileEnabled && <p>Bilgileriniz talebinizi değerlendirmek için kullanılır.</p>}</div></div>{error && <p className="sa-error" role="alert">{error}</p>}<button type="submit" className="sa-button" disabled={busy || (turnstileEnabled && !captchaToken)}>{busy ? <><Loader2 size={17} className="animate-spin" /> Gönderiliyor…</> : <>{contact ? "Mesajı gönder" : "Talep oluştur"} <ArrowRight size={18} /></>}</button><p className="ref-form-privacy">Parola veya öğrenciye ait özel bilgi paylaşmayın. <Link href="/kvkk">Aydınlatma metni</Link></p>
  </form>}</div></div></div>
}
