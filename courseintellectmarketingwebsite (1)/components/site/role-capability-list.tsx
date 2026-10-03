"use client"

import { useId, useState } from "react"
import { ArrowUpRight, BookOpen, Building2, CalendarDays, ClipboardCheck, FileText, GraduationCap, Headphones, MessageCircle, Plus, Route, Search, ShieldCheck, Users, Utensils, Wallet, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { roleCapabilities } from "@/lib/role-capabilities"

function capabilityStyle(title: string) {
  const name = title.toLocaleLowerCase("tr-TR")
  if (/yemek/.test(name)) return { Icon: Utensils, tone: "sage", label: "Kurum hizmetleri" }
  if (/rota|sefer/.test(name)) return { Icon: Route, tone: "sky", label: "Ulaşım" }
  if (/yetki|onay|arşiv/.test(name)) return { Icon: ShieldCheck, tone: "slate", label: "Erişim ve kontrol" }
  if (/iletişim|görüşme|talepler/.test(name)) return { Icon: MessageCircle, tone: "sky", label: "İletişim" }
  if (/randevu|envanter/.test(name)) return { Icon: CalendarDays, tone: "lilac", label: "Planlama" }
  if (/hesap|tahsilat|ödeme/.test(name)) return { Icon: Wallet, tone: "sand", label: "Finans" }
  if (/belge|bordro/.test(name)) return { Icon: FileText, tone: "sand", label: "Belgeler" }
  if (/rapor|denetim|sınav|ödev|değerlendirme/.test(name)) return { Icon: ClipboardCheck, tone: "sage", label: "Takip ve değerlendirme" }
  if (/içerik|soru|öğrenme/.test(name)) return { Icon: BookOpen, tone: "lilac", label: "İçerik ve öğrenme" }
  if (/akademik|ders|eğitim/.test(name)) return { Icon: GraduationCap, tone: "sky", label: "Eğitim" }
  if (/öğrenci|kişiler|kayıt|ekip/.test(name)) return { Icon: Users, tone: "sage", label: "Kişiler ve ekip" }
  if (/destek|işletim/.test(name)) return { Icon: Headphones, tone: "slate", label: "İşletim" }
  return { Icon: Building2, tone: "slate", label: "Kurum yönetimi" }
}

export function RoleCapabilityList({ id, compact = false }: { id: RoleId; compact?: boolean }) {
  const [query, setQuery] = useState("")
  const inputId = useId()
  const role = roles.find(role => role.id === id)!
  const catalog = roleCapabilities[id]
  const search = query.trim().toLocaleLowerCase("tr-TR")
  const groups = catalog.groups.map((group, index) => ({ ...group, index, items: group.items.filter(item => `${group.title} ${item.join(" ")}`.toLocaleLowerCase("tr-TR").includes(search)) })).filter(group => group.items.length)
  const total = catalog.groups.reduce((sum, group) => sum + group.items.length, 0)
  const matches = groups.reduce((sum, group) => sum + group.items.length, 0)
  return <section className={`sa-capabilities${compact ? " sa-capabilities-compact" : ""}`} id="tum-ozellikler" aria-labelledby="capabilities-title">
    <header className={compact ? "sr-only" : undefined}><p className="ref-eyebrow">{role.name} deneyimi</p><h2 id="capabilities-title">Yapabilecekleriniz.<br /><span>Başlıklarla keşfedin.</span></h2><p>{total} özellik alanı. Ayrıntıları görmek için bir başlık seçin.</p></header>
    <div className="sa-capability-tools"><label htmlFor={inputId}><Search size={18} /><span className="sr-only">{role.name} özelliklerinde ara</span><input id={inputId} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Özelliklerde ara…" /></label><p role="status" aria-live="polite">{search ? `${matches} / ${total} özellik` : "Tüm özellikler gösteriliyor"}</p></div>
    <div className="sa-capability-groups sa-capability-card-grid">{groups.map(group => {
      const { Icon, tone, label } = capabilityStyle(group.title)
      return <Dialog.Root key={`${id}-${group.title}`}>
        <article id={`capability-${id}-${group.index}`} className="sa-capability-card" data-tone={tone}>
          <Dialog.Trigger className="sa-capability-card-trigger" aria-label={`${group.title}, ayrıntıları aç`}>
            {compact ? <><span className="sa-capability-card-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span><h3>{group.title}</h3><span className="sa-capability-compact-plus"><Plus size={15} aria-hidden="true" /></span></> : <><span className="sa-capability-card-top"><span className="sa-capability-card-icon"><Icon size={24} strokeWidth={1.7} aria-hidden="true" /></span><span className="sa-capability-card-category">{label}</span></span><h3>{group.title}</h3><span className="sa-capability-card-bottom"><span>Ayrıntıları keşfet</span><ArrowUpRight size={20} aria-hidden="true" /></span><Icon className="sa-capability-card-watermark" size={150} strokeWidth={.65} aria-hidden="true" /></>}
          </Dialog.Trigger>
        </article>
        <Dialog.Portal><Dialog.Overlay className="sa-highlight-overlay" /><Dialog.Content className="sa-highlight-dialog sa-capability-dialog" data-lenis-prevent><Dialog.Close className="sa-highlight-close" aria-label="Özellik ayrıntılarını kapat"><X size={22} /></Dialog.Close><header><span>{role.name} deneyimi</span><Dialog.Title>{group.title}</Dialog.Title><Dialog.Description>{group.summary}</Dialog.Description></header><div className="sa-capability-modal-list"><p>{search ? `Aramanızla eşleşen ${group.items.length} özellik` : `${group.items.length} özellik`}</p><dl>{group.items.map(([title, detail]) => <div key={title}><dt>{title}</dt><dd>{detail}</dd></div>)}</dl></div><aside className="sa-capability-modal-scope"><ShieldCheck size={20} /><p>{catalog.scope}</p></aside></Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    })}</div>
    {groups.length === 0 && <div className="sa-capability-empty"><p>Bu aramayla eşleşen özellik bulunamadı.</p><button onClick={() => setQuery("")}>Tüm özellikleri göster</button></div>}
    <aside className="sa-capability-scope"><ShieldCheck size={24} /><p>{catalog.scope}</p></aside>
  </section>
}
