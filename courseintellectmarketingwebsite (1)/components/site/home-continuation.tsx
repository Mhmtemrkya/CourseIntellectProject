"use client"

import { useId, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion"
import * as Dialog from "@radix-ui/react-dialog"
import { ArrowRight, ArrowUpRight, Bell, BookOpen, BriefcaseBusiness, Building2, Bus, ChevronRight, GraduationCap, HeartHandshake, MapPin, Monitor, Plus, Smartphone, TrendingUp, Users, Utensils, X } from "lucide-react"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { productHighlights, type HighlightTopic } from "@/lib/product-highlights"
import { RoleCapabilityList } from "./role-capability-list"
import styles from "./home-continuation.module.css"

const ease = [.22, 1, .36, 1] as const
const root = "/images/home-lower-art/"
const roleIcons = { yonetici: Building2, ogretmen: GraduationCap, veli: Users, ogrenci: GraduationCap, muhasebe: TrendingUp, personel: BriefcaseBusiness, rehberlik: HeartHandshake, "sube-muduru": MapPin, yemekhane: Utensils, "servis-soforu": Bus }

function Entrance({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [24, 0], opacity: [.75, 1] }} viewport={{ once: true, amount: .12 }} transition={{ duration: .85, delay, ease }}>{children}</motion.div>
}

function Artwork({ name, alt, className }: { name: string; alt: string; className?: string }) {
  return <picture><source media="(max-width: 600px)" srcSet={`${root}${name}-mobile.webp`} /><Image className={className || styles.artwork} src={`${root}${name}.webp`} width={1536} height={1024} alt={alt} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 60vw, 40vw" loading="lazy" /></picture>
}

const processes = [
  { asset: "lessons", title: "Ders akışı", description: "Planlama, yoklama ve gelişim. Bir eğitim gününün bütün adımları.", milestone: "Ders tamamlanır", topic: "learning", Icon: BookOpen, href: "/deneyim/ogretmen", alt: "Günün ders programı ve yoklama kaydını gösteren açık ders planlayıcısı. Temsili demo." },
  { asset: "messages", title: "İletişim", description: "Öğrenci, veli ve öğretmen için doğru bilgi, doğru yerde.", milestone: "Bilgi paylaşılır", topic: "communication", Icon: Bell, href: "/deneyim/veli", alt: "Demo 1 günlük özeti, kurum duyuruları ve veli bilgilendirmesinden oluşan iletişim sahnesi." },
  { asset: "finance", title: "Finansal görünüm", description: "Tahsilat, taksit ve giderler. Kurumunuzun finansal akışı bir arada.", milestone: "Özet güncellenir", topic: "finance", Icon: TrendingUp, href: "/deneyim/muhasebe", alt: "Gelir ve gider grafikleri, finans raporu ve tahsilatları anlatan özel ürün görseli." },
] satisfies { asset: string; title: string; description: string; milestone: string; topic: HighlightTopic; Icon: typeof BookOpen; href: string; alt: string }[]

function ProcessScene({ item, index, progress }: { item: (typeof processes)[number]; index: number; progress: MotionValue<number> }) {
  const reduced = useReducedMotion()
  const lift = useTransform(progress, [0, .55, 1], [index === 1 ? 25 : 12, 0, -20])
  const detail = productHighlights[item.topic]
  return <Dialog.Root>
    <article className={styles.processScene}>
      <Entrance delay={index * .1}><h3>{item.title}</h3><p>{item.description}</p></Entrance>
      <motion.div className={styles.sceneArt} style={reduced ? undefined : { y: lift }}><Entrance delay={index * .12}><Artwork name={item.asset} alt={item.alt} /></Entrance></motion.div>
      <Dialog.Trigger className={styles.sceneTrigger} aria-label={`${item.title}, ayrıntıları incele`}><span className={styles.plus}><Plus size={21} aria-hidden="true" /></span><span>Ayrıntıları incele <ArrowRight size={17} aria-hidden="true" /></span></Dialog.Trigger>
    </article>
    <Dialog.Portal><Dialog.Overlay className="sa-highlight-overlay" /><Dialog.Content className={`sa-highlight-dialog ${styles.processDialog}`} data-lenis-prevent>
      <Dialog.Close className="sa-highlight-close" aria-label="İncelemeyi kapat"><X size={22} /></Dialog.Close>
      <header><span>{detail.label}</span><Dialog.Title>{item.title}</Dialog.Title><Dialog.Description>{item.description}</Dialog.Description></header>
      <div className={styles.dialogArt}><Artwork name={item.asset} alt="" /></div>
      <div className={styles.dialogDetails}>{detail.points.map(([title, description]) => <div key={title}><h3>{title}</h3><p>{description}</p></div>)}</div>
      <footer><p>Özellikler, rol ve kurum yetkileri kapsamında sunulur.</p><Dialog.Close asChild><Link href={item.href}>Deneyimi keşfet <ArrowRight size={17} /></Link></Dialog.Close></footer>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}

function DailyFlow() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start .85", "end .4"] })
  const length = useTransform(scrollYProgress, [0, .8], [0, 1])
  return <section ref={ref} className={styles.daily} id="gunluk-akis" aria-labelledby="home-flow-heading">
    <div className={styles.container}>
      <Entrance className={styles.sectionHeading}><div><p className={styles.eyebrow}>Kurumun günlük akışı</p><h2 id="home-flow-heading">Bir gün.<br /><span>Birlikte ilerleyen akış.</span></h2></div><Link href="/platform">Platformu keşfet <ArrowUpRight size={18} /></Link></Entrance>
      <div className={styles.scenes}>{processes.map((item, index) => <ProcessScene key={item.asset} item={item} index={index} progress={scrollYProgress} />)}</div>
      <div className={styles.milestones}>
        <svg viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`${uid}-ribbon`}><stop stopColor="#ff9400" /><stop offset=".45" stopColor="#ffac3f" /><stop offset=".65" stopColor="#3776fa" /><stop offset="1" stopColor="#ff9200" /></linearGradient></defs><path d="M-50 20C150 100 260 24 420 47S740 70 810 46 1050 75 1250 10" /><motion.path d="M-50 20C150 100 260 24 420 47S740 70 810 46 1050 75 1250 10" stroke={`url(#${uid}-ribbon)`} style={reduced ? { pathLength: 1 } : { pathLength: length }} /></svg>
        {processes.map(({ Icon, milestone }, index) => <Entrance key={milestone} delay={index * .15}><span className={styles.milestoneIcon}><Icon size={20} /></span><strong>{milestone}</strong></Entrance>)}
      </div>
      <p className={styles.demo}>Temsili demo verileri</p>
    </div>
    <div className={styles.nextSection}><a href="#rol-ozellikleri">Kendi çalışma alanınızı keşfedin <ArrowRight size={16} /></a></div>
  </section>
}

function RoleArtwork({ id }: { id: RoleId }) {
  const source = id === "yonetici" ? `${root}manager.webp` : id === "ogretmen" ? "/images/brain-cinematic-v3/teachers.webp" : `/images/brain-role-art/${id}.webp`
  return <picture><source media="(max-width: 600px)" srcSet={`${root}role-${id}-mobile.webp`} /><Image src={source} width={1536} height={1024} alt={`${roles.find(role => role.id === id)?.name} çalışma alanını anlatan temsili ürün görseli`} className={styles.artwork} loading="lazy" sizes="(max-width: 600px) 100vw, (max-width: 1000px) 60vw, 38vw" /></picture>
}

function RoleExplorer() {
  const [active, setActive] = useState<RoleId>("yonetici")
  const reduced = useReducedMotion()
  const selected = roles.find(role => role.id === active)!
  const prefix = useId()
  const panelId = `${prefix}-role-preview`
  return <section className={styles.explorer} id="rol-ozellikleri" aria-labelledby="home-role-heading">
    <div className={styles.container}>
      <Entrance className={styles.explorerHeading}><h2 id="home-role-heading">Herkesin rolü ayrı.<br /><span>Akış aynı.</span></h2><p>Size tanımlanan özellikleri, kendi çalışma alanınızda keşfedin.</p></Entrance>
      <div className={styles.explorerLayout}>
        <div className={styles.roleRail} role="tablist" aria-label="Rol özellikleri" aria-orientation="vertical">{roles.map((role, index) => { const Icon = roleIcons[role.id]; return <button key={role.id} id={`${prefix}-tab-${role.id}`} role="tab" aria-selected={role.id === active} aria-controls={panelId} tabIndex={role.id === active ? 0 : -1} onClick={() => setActive(role.id)} onKeyDown={event => {
          let next = index
          if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % roles.length
          else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + roles.length) % roles.length
          else if (event.key === "Home") next = 0
          else if (event.key === "End") next = roles.length - 1
          else return
          event.preventDefault(); setActive(roles[next].id)
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus()
        }}><Icon size={21} strokeWidth={1.6} aria-hidden="true" /><span>{role.name}</span><ChevronRight size={15} aria-hidden="true" /></button> })}</div>
        <div id={panelId} role="tabpanel" aria-labelledby={`${prefix}-tab-${active}`} tabIndex={0} className={styles.rolePanel}>
          <div className={styles.roleVisual}><h3>{selected.name} deneyimi</h3><p>{selected.description}</p>
            <div className={styles.roleArt}><AnimatePresence mode="wait" initial={false}><motion.div key={active} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: reduced ? 0 : .35, ease }}><RoleArtwork id={active} /></motion.div></AnimatePresence></div>
            <Link href={`/deneyim/${active}`} className={styles.roleLink}>Deneyimi yakından keşfet <ArrowUpRight size={17} /></Link>
          </div>
          <div className={styles.roleFeatures}><p className={styles.featureIntro}>Bir başlık seçin, ayrıntılarını keşfedin.</p><RoleCapabilityList key={active} id={active} compact /></div>
        </div>
      </div>
      <Link href="/deneyim" className={styles.allRoles}>Bütün rol deneyimlerini keşfet <ArrowUpRight size={18} /></Link>
    </div>
  </section>
}

function Devices() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, .5, 1], [45, 0, -30])
  const scale = useTransform(scrollYProgress, [0, .5, 1], [.97, 1, 1.02])
  const line = useTransform(scrollYProgress, [0, .6], [0, 1])
  return <section ref={ref} className={styles.devices} id="her-ekranda" aria-labelledby="home-device-heading">
    <svg className={styles.deviceRibbon} viewBox="0 0 1440 700" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M-100 570C330 290 500 720 850 460S1270 580 1520 170" style={reduced ? { pathLength: 1 } : { pathLength: line }} /><motion.path d="M-100 590C330 310 500 740 850 480S1270 600 1520 190" style={reduced ? { pathLength: 1 } : { pathLength: line }} /></svg>
    <div className={styles.deviceLayout}>
      <Entrance className={styles.deviceCopy}><p className={styles.eyebrow}>Birlikte çalışan ekranlar</p><h2 id="home-device-heading">Her ekranda.<br /><span>Aynı bütünlük.</span></h2><p>Masaüstü ve mobil uygulamalarda SchoolAsist.</p><div className={styles.platforms}><span><Monitor size={27} />Masaüstü</span><span><Smartphone size={27} />Mobil</span></div><Link href="/indir" className={styles.deviceLink}>Uygulamaları keşfet <ArrowUpRight size={18} /></Link></Entrance>
      <motion.div className={styles.deviceArt} style={reduced ? undefined : { y, scale }}><Artwork name="devices" alt="Dizüstü bilgisayar, tablet ve telefonda SchoolAsist kurum özeti ve ders programı. Temsili demo ekranları." /><p className={styles.demo}>Temsili demo ekranları</p></motion.div>
    </div>
  </section>
}

export function HomeContinuation() {
  return <div className={styles.continuation} data-home-continuation>
    <DailyFlow /><RoleExplorer /><Devices />

  </div>
}
