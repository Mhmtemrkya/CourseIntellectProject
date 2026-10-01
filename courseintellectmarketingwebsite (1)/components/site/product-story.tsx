"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, FileText, LockKeyhole, Pause, Play, Plus, X, BarChart3 } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import { type ShowcaseAsset } from "@/lib/showcase-assets"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { SiteCTA } from "./site-shell"
import { HighlightArtwork, ProductScene } from "./product-scene"
import { highlightHeadline, highlightTopic, productHighlights } from "@/lib/product-highlights"
import { roleCapabilities } from "@/lib/role-capabilities"
import { RoleCapabilityList } from "./role-capability-list"
import { ScrollExperience } from "./scroll-experience"
export { roles } from "@/lib/site-experience-data"
export type { RoleId } from "@/lib/site-experience-data"

export function SceneImage({ asset, alt, className = "", role }: { asset: ShowcaseAsset; alt: string; priority?: boolean; className?: string; role?: RoleId }) {
  return <ProductScene asset={asset} alt={alt} className={className} role={role} />
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { once: true, amount: .1 })
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <motion.div ref={ref} className={className} initial={false} animate={{ y: mounted && !reduced && visible ? [12, 0] : 0 }} transition={{ duration: .6, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
}

export function ReferenceHero({ title, accent, description, asset, eyebrow, explore = false, exploreHref = "#kesfet", exploreLabel = "Platformu keşfet", role }: { title: string; accent: string; description: string; asset: ShowcaseAsset; eyebrow?: string; explore?: boolean; exploreHref?: string; exploreLabel?: string; role?: RoleId }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [0, -60])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.18])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -90])
  const opacity = useTransform(scrollYProgress, [0, .65, 1], [1, .8, 0])
  return <section ref={ref} className={`ref-hero ${eyebrow === "SchoolAsist" ? "ref-home-hero" : ""}`}>
    <motion.div className="ref-hero-copy" style={reduced ? undefined : { y: copyY, opacity }}>{eyebrow && <p className="ref-eyebrow">{eyebrow}</p>}<h1>{title}<br /><span>{accent}</span></h1><p>{description}</p></motion.div>
    <motion.div className="ref-hero-scene" style={reduced ? undefined : { y, scale }}><div key={`${asset}-${role || "default"}`} className="ref-scene-swap"><SceneImage asset={asset} role={role} alt={`${title} ${accent} SchoolAsist ürün ekranları, temsili demo verileri.`} priority /></div></motion.div>
    {explore && <div className="ref-explore-floor"><a className="ref-explore" href={exploreHref}>{exploreLabel} <ArrowDown size={16} /></a></div>}
  </section>
}

export type GalleryCard = { asset: ShowcaseAsset; title: string; description: string; href: string }
function DiscoveryCard({ card, pause }: { card: GalleryCard; pause: () => void }) {
  const cardRef = useRef<HTMLElement>(null)
  const revealed = useInView(cardRef, { once: true, amount: .25 })
  const topic = highlightTopic(card.asset)
  const content = productHighlights[topic]
  return <Dialog.Root onOpenChange={open => { if (open) pause() }}>
    <article ref={cardRef} className="ref-gallery-card" data-topic={topic} data-revealed={revealed}>
      <div className="ref-card-copy"><p className="sa-card-eyebrow">{card.title}</p><h3>{highlightHeadline(card.asset)}</h3><p>{card.description}</p></div>
      <HighlightArtwork asset={card.asset} />
      <span className="sa-card-demo">Temsili demo ekranı</span>
      <Dialog.Trigger className="sa-card-open" aria-label={`${card.title} Ayrıntıları incele`}><span><Plus size={23} strokeWidth={2.2} /></span></Dialog.Trigger>
    </article>
    <Dialog.Portal>
      <Dialog.Overlay className="sa-highlight-overlay" />
      <Dialog.Content className="sa-highlight-dialog" data-lenis-prevent>
        <Dialog.Close className="sa-highlight-close" aria-label="İncelemeyi kapat"><X size={22} /></Dialog.Close>
        <header><span>{content.label}</span><Dialog.Title>{card.title}</Dialog.Title><Dialog.Description>{card.description}</Dialog.Description></header>
        <div className="sa-highlight-modal-art" data-topic={topic}><HighlightArtwork asset={card.asset} /></div>
        <div className="sa-highlight-details">{content.points.map(([title, detail], i) => <div key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></div>)}</div>
        <footer><p>Özellikler, kullanıcının rolü ve kurum yetkileri kapsamında sunulur.</p><Dialog.Close asChild><Link href={card.href}>Bütün özellikleri incele <ArrowRight size={18} /></Link></Dialog.Close></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
export function ReferenceGallery({ title, accent, cards, linkLabel = "Deneyimi incele", href = "/deneyim", compact = false }: { title: string; accent?: string; cards: GalleryCard[]; linkLabel?: string; href?: string; compact?: boolean; canvas?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const visible = useInView(ref, { amount: .2 })
  const positions = useCallback(() => {
    const gallery = ref.current
    if (!gallery) return []
    const nodes = Array.from(gallery.children) as HTMLElement[]
    const max = Math.max(0, gallery.scrollWidth - gallery.clientWidth)
    // Trim duplicate snap positions when several cards fit in the viewport.
    return [...new Set(nodes.map(node => Math.min(max, Math.max(0, node.offsetLeft - nodes[0].offsetLeft))))]
  }, [])
  const [snaps, setSnaps] = useState<number[]>([0])
  useEffect(() => {
    const gallery = ref.current
    if (!gallery) return
    const resize = new ResizeObserver(() => { const points = positions(); setSnaps(points); setActive(value => Math.min(value, points.length - 1)) })
    resize.observe(gallery)
    for (const child of gallery.children) resize.observe(child)
    return () => resize.disconnect()
  }, [positions])
  const go = useCallback((index: number) => {
    const gallery = ref.current
    const points = positions()
    if (!gallery || !points.length) return
    const next = Math.max(0, Math.min(index, points.length - 1))
    gallery.scrollTo({ left: points[next], behavior: reduced ? "instant" : "smooth" })
  }, [positions, reduced])
  useEffect(() => {
    if (paused || hovered || reduced || !visible || snaps.length < 2) return
    const timer = window.setInterval(() => {
      if (!document.hidden) go(active + 1 < snaps.length ? active + 1 : 0)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [active, paused, hovered, reduced, visible, snaps.length, go])
  function updateActive() {
    const gallery = ref.current
    if (!gallery) return
    const points = positions()
    let nearest = 0
    points.forEach((point, index) => {
      if (Math.abs(point - gallery.scrollLeft) < Math.abs(points[nearest] - gallery.scrollLeft)) nearest = index
    })
    setActive(nearest)
  }
  return <section id="kesfet" className={`ref-discovery ${compact ? "ref-discovery-compact" : ""}`}>
    <div className="ref-section-heading"><h2>{title}{accent && <><br /><span>{accent}</span></>}</h2><Link href={href}>{linkLabel} <ArrowUpRight size={17} /></Link></div>
    <div ref={ref} className="ref-gallery" onScroll={updateActive} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onPointerDown={() => setPaused(true)} onFocusCapture={() => setPaused(true)}>
      {cards.map(card => <DiscoveryCard key={card.asset} card={card} pause={() => setPaused(true)} />)}
    </div>
    {snaps.length > 1 && <div className="ref-gallery-controls" data-playing={!paused && !hovered && !reduced && visible}><div className="sa-gallery-pagination">{snaps.map((point, index) => <button key={point} aria-label={`${index + 1}. galeri konumu`} aria-pressed={active === index} className="ref-dot" onClick={() => { setPaused(true); go(index) }}><span key={`${active}-${paused}-${hovered}`} /></button>)}<button disabled={!!reduced} aria-label={paused ? "Galeriyi oynat" : "Galeriyi duraklat"} onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div><div className="sa-gallery-arrows"><button aria-label="Önceki görünüm" disabled={active === 0} onClick={() => { setPaused(true); go(active - 1) }}><ArrowLeft size={18} /></button><button aria-label="Sonraki görünüm" disabled={active >= snaps.length - 1} onClick={() => { setPaused(true); go(active + 1) }}><ArrowRight size={18} /></button></div></div>}
  </section>
}

function RoleTabs({ active, onSelect, dark = false }: { active: RoleId; onSelect: (id: RoleId) => void; dark?: boolean }) {
  return <div className={`ref-role-tabs ${dark ? "ref-role-tabs-dark" : ""}`} role="tablist" aria-label="Rol deneyimi">{roles.map((role, i) => <button key={role.id} id={`tab-${role.id}`} role="tab" aria-selected={role.id === active} aria-controls="role-preview" tabIndex={role.id === active ? 0 : -1} onClick={e => { onSelect(role.id); e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }) }} onKeyDown={e => {
    let next = i
    if (e.key === "ArrowRight") next = (i + 1) % roles.length
    else if (e.key === "ArrowLeft") next = (i - 1 + roles.length) % roles.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = roles.length - 1
    else return
    e.preventDefault(); onSelect(roles[next].id)
    ;(e.currentTarget.parentElement?.querySelectorAll("button")[next] as HTMLButtonElement)?.focus()
  }}>{role.name}{role.id === active && <motion.span className="ref-tab-indicator" layoutId="role-tab-indicator" transition={{ type: "spring", stiffness: 400, damping: 35 }} />}</button>)}</div>
}

const roleScene: Record<RoleId, ShowcaseAsset> = { rehberlik: "roles-device", "sube-muduru": "yonetici-device", yemekhane: "roles-device", "servis-soforu": "roles-device", "platform-yoneticisi": "roles-device", yonetici: "yonetici-device", ogretmen: "ogretmen-device", veli: "veli-phone", ogrenci: "ogrenci-device", muhasebe: "muhasebe-device", personel: "personel-device" }

function RoleDiscoveryCard({ role }: { role: (typeof roles)[number] }) {
  const profile = roleCapabilities[role.id]
  const count = profile.groups.reduce((total, group) => total + group.items.length, 0)
  const topic = role.id === "muhasebe" ? "finance" : role.id === "veli" ? "communication" : role.id === "ogrenci" || role.id === "rehberlik" ? "progress" : role.id === "ogretmen" ? "learning" : "operations"
  return <Link href={`/deneyim/${role.id}`} className="sa-role-editorial" data-topic={topic}>
    <div className="sa-role-card-copy"><span className="sa-role-category">Size özel çalışma alanı</span><h3>{role.name}</h3><p>{role.description}</p><ul>{role.features.map(feature => <li key={feature}>{feature}</li>)}</ul></div>
    <div className="sa-role-card-art" aria-hidden="true"><ProductScene asset={roleScene[role.id]} role={role.id} alt="" transparent /></div>
    <span className="sa-role-card-action">{count} özellik başlığını keşfet <ArrowUpRight size={18} /></span>
  </Link>
}

export function HomeStory() {
  const [active, setActive] = useState<RoleId>("ogretmen")
  return <div className="ref-story"><ReferenceHero title="Bütün kurum." accent="Tek bir deneyim." description="Yönetim, eğitim ve iletişim. Birlikte." eyebrow="SchoolAsist" asset="home-device" explore />
    <ReferenceGallery title="Yakından keşfedin." canvas={972} cards={[
      { asset: "home-lessons", title: "Ders akışı.", description: "Planlama, yoklama ve gelişim.", href: "/deneyim/ogretmen" },
      { asset: "home-messages", title: "İletişim.", description: "Her an yanında.", href: "/deneyim/veli" },
      { asset: "muhasebe-plan", title: "Finansal görünüm.", description: "Her hareket net.", href: "/deneyim/muhasebe" },
    ]} />
    <ScrollExperience /><section className="ref-home-ecosystem"><Reveal><h2>Her ekranda.<br /><span>Aynı bütünlük.</span></h2><p>Masaüstü, web ve mobilde SchoolAsist.</p></Reveal><div role="tabpanel" id="role-preview" aria-labelledby={`tab-${active}`}><div key={active} className="ref-scene-swap"><SceneImage asset="home-ecosystem" role={active} alt={`${roles.find(r => r.id === active)?.name} deneyimi; temsili demo ekranları`} /></div></div><RoleTabs active={active} onSelect={setActive} /><Link href={`/deneyim/${active}`} className="ref-selected-role">{roles.find(r => r.id === active)?.name} deneyimini incele <ArrowRight size={15} /></Link><small className="ref-demo-note">Temsili demo verileri</small></section><SiteCTA /></div>
}

export function PlatformStory() {
  return <div className="ref-story"><ReferenceHero title="Kurumunuzun bütün gücü." accent="Tek platformda." description="Dersler, öğrenciler, iletişim ve finans bir arada." asset="platform-device" /><ReferenceGallery title="Her süreci yakından görün." compact linkLabel="Platformu keşfet" href="/deneyim" cards={[
    { asset: "platform-lessons", title: "Ders ve yoklama", description: "Planlayın, işleyin, anında kaydedin.", href: "/deneyim/ogretmen" },
    { asset: "platform-student", title: "Öğrenci gelişimi", description: "Devamsızlık, notlar ve daha fazlası.", href: "/deneyim/ogrenci" },
    { asset: "platform-finance", title: "Finansal takip", description: "Gelir, gider ve raporlar tek yerde.", href: "/deneyim/muhasebe" },
  ]} /><ScrollExperience platform /><section className="ref-light-showcase"><Reveal><h2>Bilgi bir kez girilir.<br /><span>Akış birlikte ilerler.</span></h2><p>Aynı bilgi, herkes için doğru yerde, doğru zamanda.</p></Reveal><SceneImage asset="platform-flow" alt="Öğretmen yoklamayı kaydeder, veli bilgilendirme alır ve yönetici günlük özeti görür. Temsili demo ekranları." /></section><SiteCTA title="Kurumunuzla başlayın." description="Formu doldurun, ekibimiz sizinle iletişime geçsin." support={false} /></div>
}

export function RolesStory() {
  const [active, setActive] = useState<RoleId>("ogretmen")
  const selected = roles.find(r => r.id === active)!
  return <div className="ref-story"><div className="ref-roles-hero"><ReferenceHero title="Aynı kurum." accent="Her role özel." description="İhtiyacınız olan bilgi, size ait çalışma alanında." asset="roles-device" role={active} /><div role="tabpanel" id="role-preview" aria-labelledby={`tab-${active}`} className="sr-only">{selected.name}: {selected.description}</div><RoleTabs active={active} onSelect={setActive} dark /></div><ScrollExperience role={active} /><section className="ref-role-directory"><h2>Kendi deneyiminizi <span>keşfedin.</span></h2><div className="ref-role-cards">{roles.map(role => <RoleDiscoveryCard key={role.id} role={role} />)}</div><div className="ref-access-note"><LockKeyhole /><div><strong>Erişimler rol ve kurum yetkilerine göre belirlenir.</strong><p>Her kullanıcı yalnızca kendisine tanımlanan alanlara erişir. Ek ve özel roller, kurum yöneticisinin tanımladığı modül ve işlem izinleriyle şekillenir; herkese aynı yetki verilmez.</p></div></div></section></div>
}

const roleGalleries: Partial<Record<RoleId, { title: string; accent?: string; assets: [ShowcaseAsset, string, string][] }>> = {
  yonetici: { title: "Gününüz tek bakışta.", assets: [["yonetici-branches", "Şube ve ekip yönetimi.", "Tüm şubeleriniz, ekipleriniz ve kullanıcılarınız tek ekranda."], ["yonetici-reports", "Günlük raporlar.", "Yoklama, ders ve iletişim raporlarına hızlıca ulaşın."]] },
  ogretmen: { title: "Hazırlıktan değerlendirmeye.", assets: [["ogretmen-materials", "Ders materyalleri.", "Zengin içerikle daha etkili dersler."], ["ogretmen-homework", "Ödev takibi.", "Teslimleri kolayca izleyin."]] },
  veli: { title: "İhtiyacınız olan bilgi.", accent: "Yanınızda.", assets: [["veli-lessons", "Ders ve devam.", "Günlük akışı kolayca takip edin."], ["veli-messages", "Öğretmen iletişimi.", "Önemli bilgiler size ulaşsın."]] },
  ogrenci: { title: "Bugünden yarına.", assets: [["ogrenci-homework", "Ödevlerini takip et.", "Çalışmaların ve teslimlerin tek yerde."], ["ogrenci-schedule", "Ders programın her zaman yanında.", "Günün programını gör."]] },
  muhasebe: { title: "Kaydı tamamlayın.", accent: "Akışı izleyin.", assets: [["muhasebe-payment", "Tahsilat kaydedin.", "Ödemeler anında kayıt altında."], ["muhasebe-plan", "Taksit planını takip edin.", "Ödeme durumlarını kolayca görün."]] },
  personel: { title: "Görevden iletişime.", assets: [["personel-tasks", "Görevleri kolayca tamamlayın.", "Size verilen görevleri takip edin ve tamamlayın."], ["personel-announcements", "Önemli duyuruları kaçırmayın.", "Kurum duyuruları her zaman yanınızda."]] },
}

function FinanceHistory() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("Tüm durumlar")
  const [type, setType] = useState("Tüm türler")
  const rows = [["12 Mar 2024", "Demo 1", "Taksit 1", "Tahsilat", "+₺10.400", "Ödendi"], ["08 Mar 2024", "Demo 2", "Taksit 1", "Tahsilat", "+₺9.800", "Bekliyor"], ["05 Mar 2024", "Demo 3", "Taksit 2", "Tahsilat", "+₺10.400", "Gecikti"], ["01 Mar 2024", "—", "Kırtasiye gideri", "Gider", "−₺2.300", "Ödendi"]]
  const filtered = rows.filter(row => row.join(" ").toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")) && (status === "Tüm durumlar" || row[5] === status) && (type === "Tüm türler" || row[3] === type))
  return <div className="ref-finance-table"><div className="ref-table-toolbar"><strong>Tüm Hareketler</strong><input aria-label="Demo öğrenci adıyla ara" placeholder="Öğrenci adıyla ara…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Demo işlem türü" value={type} onChange={e => setType(e.target.value)}>{["Tüm türler", "Tahsilat", "Gider"].map(option => <option key={option}>{option}</option>)}</select><select aria-label="Demo ödeme durumu" value={status} onChange={e => setStatus(e.target.value)}>{["Tüm durumlar", "Ödendi", "Bekliyor", "Gecikti"].map(option => <option key={option}>{option}</option>)}</select></div><div className="ref-table-scroll"><table><thead><tr>{["Tarih", "Öğrenci", "Açıklama", "Tür", "Tutar", "Durum"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} className={i === 4 && row[3] === "Gider" ? "ref-amount-out" : undefined}>{i === 5 ? <span className={`ref-status ref-status-${cell === "Ödendi" ? "paid" : cell === "Bekliyor" ? "pending" : "late"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table>{filtered.length === 0 && <p role="status">Bu filtrelerle eşleşen demo kayıt bulunamadı.</p>}</div><small>Temsili demo verileri</small></div>
}

export function RoleStory({ id }: { id: RoleId }) {
  const role = roles.find(r => r.id === id)!
  const gallery = roleGalleries[id]
  return <div className={`ref-story ref-role-${id}`}>
    {id === "veli" ? <section className="ref-parent-hero"><SceneImage asset="veli-phone" alt="Veli portalı telefon ekranı; temsili demo verileri" priority /><div><p className="ref-eyebrow">VELİ</p><h1>{role.title}<br /><span>{role.accent}</span></h1><p>{role.description}</p><a className="ref-explore" href="#tum-ozellikler">Bütün özellikleri görün <ArrowDown size={16} /></a><SceneImage asset="veli-notification" alt="Demo 1 matematik dersine katıldı bildirim sahnesi" priority /></div></section> : id === "ogrenci" ? <section className="ref-student-hero"><div><p className="ref-eyebrow">ÖĞRENCİ</p><h1>Sıradaki <br />hedefin.<br /><span>Önünde.</span></h1><p>{role.description}</p><a className="ref-explore" href="#tum-ozellikler">Bütün özelliklerini keşfet <ArrowDown size={16} /></a></div><SceneImage asset="ogrenci-device" alt="Öğrenci ders ve ödev programı; temsili demo ekranı" priority /></section> : <ReferenceHero eyebrow={role.name.toLocaleUpperCase("tr-TR")} title={role.title} accent={role.accent} description={role.description} asset={roleScene[id]} role={id} explore exploreHref="#tum-ozellikler" exploreLabel="Bütün özellikleri görün" />}
    {gallery && <ReferenceGallery title={gallery.title} accent={gallery.accent} href="#tum-ozellikler" linkLabel="Bütün özellikleri incele" cards={gallery.assets.map(([asset, title, description]) => ({ asset, title, description, href: "#tum-ozellikler" }))} />}
    <ScrollExperience role={id} />
    <RoleCapabilityList id={id} />
    {gallery && <section id="rol-detay" className="ref-light-showcase">
      {id === "yonetici" && <><h2>Yetkiyi doğru kişiye verin.</h2><p>Her rol için ihtiyaç olan erişim. Güvenli ve düzenli.</p><SceneImage asset="yonetici-access" alt="Öğretmen, veli ve muhasebe için ayrı erişim kapsamları; temsili demo verileri" /></>}
      {id === "ogretmen" && <><h2>Gelişimi <span>görünür kılın.</span></h2><p>Her öğrencinin yolculuğunu kolayca takip edin.</p><div className="ref-teacher-progress"><div className="ref-progress-track">{[["Başlangıç", "Mevcut durumu görün."], ["Süreç", "Ders içi katılımı izleyin."], ["Çalışma", "Ödev ve etkinlikleri takip edin."], ["Gelişim", "İlerlemesini değerlendirin."]].map(([title, description], index) => <div key={title}><b>{index + 1}</b><strong>{title}</strong><p>{description}</p></div>)}</div><div className="ref-feedback"><strong>Öğretmen Geri Bildirimi</strong><small>12 Mart 2024</small><div><b>D1</b><span><strong>Demo 1</strong><p>Denklem çözme çalışması</p></span></div><p>Doğru yaklaşım sergiliyor. İşlem adımlarını daha detaylı göstermesi faydalı olacaktır.</p></div></div><Link className="sa-button" href="/giris">Öğretmen deneyimini keşfet <ArrowRight size={17} /></Link><small className="ref-demo-note">Temsili demo verileri</small></>}
      {id === "veli" && <div className="ref-parent-detail"><div><h2>Birden fazla öğrenci.<br /><span>Tek görünüm.</span></h2><p>Tüm çocuklarınızın bilgilerini takip edin, karışıklık yaşamayın.</p></div><SceneImage asset="veli-students" alt="Veli portalında Demo 1 ve Demo 2 öğrenci seçimi; temsili demo verileri" /></div>}
      {id === "ogrenci" && <><h2>Ne yaptığını gör.<br /><span>Ne yapacağını bil.</span></h2><p>Adım adım planla, düzenli çalış, ödevlerini tamamla, gelişimini takip et.</p><div className="ref-student-steps">{[[BookOpen, "Konu", "Ders içeriklerini inceler, konuları öğrenirsin."], [FileText, "Çalışma", "Kendi planına göre düzenli çalışırsın."], [CheckCircle2, "Ödev", "Ödevlerini tamamlar ve teslim edersin."], [BarChart3, "Değerlendirme", "Sonuçlarını görür, gelişimini takip edersin."]].map(([Icon, title, text], i) => { const I = Icon as typeof BookOpen; return <div key={String(title)}><I size={35} /><h3>{i + 1}. {String(title)}</h3><p>{String(text)}</p></div> })}</div></>}
      {id === "muhasebe" && <><h2>Geçmişi görün.<br /><em>Bekleyeni takip edin.</em></h2><p>Tüm tahsilat, taksit ve gider hareketleri tek listede.</p><FinanceHistory /></>}
      {id === "personel" && <><h2>İhtiyacınıza göre <span>erişim.</span></h2><p>Her rol, kendi yetkisi dahilinde bilgiye ve işlemlere ulaşır.</p><SceneImage asset="personel-access" alt="İdari, bilgi işlem ve kurum ekibi ekranları; temsili demo verileri" /></>}
    </section>}
    {id === "ogretmen" ? null : ["veli", "ogrenci", "muhasebe"].includes(id) ? <SiteCTA title={id === "veli" ? "Kurumunuzun paylaştığı hesapla giriş yapın." : id === "ogrenci" ? "Kurum hesabınla giriş yap." : "Kurum yetkinizle giriş yapın."} description={id === "veli" ? "Çocuğunuzun bilgilerine kurumunuzun sağladığı hesapla güvenle erişin." : id === "ogrenci" ? "Tüm özelliklere kurum hesabınla güvenle eriş." : "Finansal süreçleri SchoolAsist ile kolayca yönetin."} login support={id === "ogrenci"} /> : <SiteCTA />}
  </div>
}
