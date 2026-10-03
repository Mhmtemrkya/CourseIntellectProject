"use client"

import { useRef, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, GraduationCap, Monitor, Smartphone, TrendingUp, Users } from "lucide-react"
import styles from "./platform-story.module.css"

const ease = [.22, 1, .36, 1] as const

function Entrance({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  // Server-rendered content stays visible, including without JavaScript.
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [24, 0], opacity: [.75, 1] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .85, delay, ease }}>{children}</motion.div>
}

function Artwork({ name, alt, hero = false }: { name: string; alt: string; hero?: boolean }) {
  return <picture>
    <source media="(max-width: 600px)" srcSet={`/images/platform-art/${name}-mobile.webp`} />
    <Image src={`/images/platform-art/${name}.webp`} alt={alt} width={1536} height={1024} sizes={hero ? "(max-width: 800px) 100vw, 65vw" : "(max-width: 600px) 100vw, (max-width: 800px) 50vw, 35vw"} fetchPriority={hero ? "high" : undefined} loading={hero ? "eager" : "lazy"} className={styles.artwork} />
  </picture>
}

function PlatformHero() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const artY = useTransform(scrollYProgress, [0, 1], [0, -55])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -25])
  const ribbonY = useTransform(scrollYProgress, [0, 1], [0, 40])
  return <section ref={ref} className={styles.hero} aria-labelledby="platform-title">
    <motion.div className={styles.heroRibbon} style={reduced ? undefined : { y: ribbonY }} aria-hidden="true"><svg viewBox="0 0 1440 650" preserveAspectRatio="none"><path d="M-100 570C220 740 380 270 760 295S1180 595 1560 340" /></svg></motion.div>
    <div className={styles.heroInner}>
      <motion.div className={styles.heroCopy} style={reduced ? undefined : { y: copyY }}>
        <p className={styles.eyebrow}>SchoolAsist Platform</p>
        <h1 id="platform-title">Bütün süreçler.<br /><span>Birlikte çalışır.</span></h1>
        <p className={styles.lead}>Dersler, öğrenciler, iletişim ve finans tek merkezde.</p>
        <a href="#platform-surecleri" className={styles.primary}>Platformu keşfet <ArrowDown size={18} /></a>
      </motion.div>
      <motion.div className={styles.heroArt} style={reduced ? undefined : { y: artY }}>
        <Entrance><Artwork name="hero" hero alt="SchoolAsist logosu ve birbirine bağlanan kurum özeti, devam ve ders ekranları. Temsili ürün görseli." /></Entrance>
        <span className={styles.heroCaption}><span /> Kurumunuzu bir araya getiren platform</span>
      </motion.div>
    </div>
    <div className={styles.heroFoot}><span><Check size={14} /> Rol ve kurum yetkileriyle erişim</span><span>Masaüstü · Mobil</span></div>
  </section>
}

const modules = [
  { name: "lessons", Icon: CalendarDays, title: "Ders ve yoklama", description: "Programı planlayın, dersleri işleyin ve devam durumunu takip edin.", href: "/deneyim/ogretmen", link: "Öğretmen deneyimi", alt: "Takvim, ders planlayıcısı ve ders kitaplarından oluşan özel hazırlanmış ürün görseli." },
  { name: "students", Icon: GraduationCap, title: "Öğrenci gelişimi", description: "Ödevlerden değerlendirmelere, öğrencinin gelişimini birlikte görün.", href: "/deneyim/ogrenci", link: "Öğrenci deneyimi", alt: "Öğrenci ilerlemesini anlatan mavi gelişim halkası ve öğrenme basamakları." },
  { name: "finance", Icon: TrendingUp, title: "Finansal takip", description: "Tahsilat, taksit ve giderleri izleyin. Raporlarla bütün resmi görün.", href: "/deneyim/muhasebe", link: "Muhasebe deneyimi", alt: "Turuncu ve mavi finans akışları, fatura ve finansal grafiklerden oluşan ürün görseli." },
] as const

function ConnectedProcesses() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start .85", "end .35"] })
  const path = useTransform(scrollYProgress, [0, .8], [0, 1])
  return <section ref={ref} id="platform-surecleri" className={styles.processes} aria-labelledby="process-title">
    <div className={styles.container}>
      <Entrance className={styles.sectionHeading}><p className={styles.eyebrow}>Birbirinden güç alan süreçler</p><h2 id="process-title">Her süreç,<br className={styles.mobileBreak} /><span> birbirine bağlı.</span></h2><p>Dağınık işler yerine, kurumunuzla birlikte ilerleyen bir bütün.</p></Entrance>
      <div className={styles.moduleGrid}>
        <svg className={styles.moduleRibbon} viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="platform-module-gradient"><stop stopColor="#ffb454" /><stop offset=".5" stopColor="#ff8100" /><stop offset="1" stopColor="#2857ea" /></linearGradient></defs><path d="M-40 310C110 160 245 400 425 290S705 100 810 235 1090 280 1260 160" /><motion.path d="M-40 310C110 160 245 400 425 290S705 100 810 235 1090 280 1260 160" style={reduced ? { pathLength: 1 } : { pathLength: path }} /></svg>
        {modules.map(({ name, Icon, title, description, href, link, alt }, index) => <article key={name} className={styles.module}>
          <Entrance delay={index * .1}><div className={styles.moduleTitle}><span><Icon size={22} strokeWidth={1.8} /></span><h3>{title}</h3></div>
            <Link href={href} className={styles.moduleArt} aria-label={`${title}: ${link}`}><Artwork name={name} alt={alt} /></Link>
            <p>{description}</p><Link href={href} className={styles.textLink}>{link} <ArrowUpRight size={17} /></Link>
          </Entrance>
        </article>)}
      </div>
      <p className={styles.demoNote}>Görseller temsili ürün anlatımıdır. Gerçek özellikleri rol sayfalarında inceleyebilirsiniz.</p>
    </div>
  </section>
}

const steps = [
  { role: "Öğretmen", Icon: BookOpen, label: "Yoklama kaydedildi", detail: "Dersin devam kaydı tamamlandı.", href: "/deneyim/ogretmen", stage: "Ders kaydı", type: "attendance" },
  { role: "Veli", Icon: Users, label: "Bilgi veliye ulaştı", detail: "Öğrencinin günlük akışı görülebilir.", href: "/deneyim/veli", stage: "Veli görünümü", type: "notification" },
  { role: "Yönetici", Icon: TrendingUp, label: "Günlük özet hazır", detail: "Kurumun devam görünümü güncellendi.", href: "/deneyim/yonetici", stage: "Kurum özeti", type: "summary" },
] as const

function FlowStep({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const Icon = step.Icon
  return <Entrance delay={index * .16} className={styles.flowStep}>
    <div className={styles.flowRole}><span className={styles.roleIcon}><Icon size={23} /></span><div><h3>{step.role}</h3><p>{step.label}</p></div></div>
    <div className={styles.flowPreview}>
      {step.type === "attendance" ? <><span className={styles.previewIcon}><CalendarDays size={21} /></span><div><b>Demo 1 · Matematik</b><small>Dersin yoklaması tamamlandı</small></div><span className={styles.success}><Check size={17} /></span></> : step.type === "notification" ? <><span className={styles.previewIcon}><Users size={21} /></span><div><b>Günlük ders bilgisi</b><small>Öğrencinizin devam kaydı güncellendi.</small></div><span className={styles.notificationDot} /></> : <><div className={styles.summaryFigure}><small>Devam oranı</small><b>%96 <span>↗ %4</span></b></div><div className={styles.miniBars} aria-hidden="true">{[35, 52, 46, 70, 61, 89, 78].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></>}
    </div>
    <p className={styles.flowDetail}>{step.detail}</p><Link href={step.href}>{step.stage} <ArrowRight size={16} /></Link>
  </Entrance>
}

function InformationFlow() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start .8", "end .45"] })
  const length = useTransform(scrollYProgress, [0, .85], [0, 1])
  return <section ref={ref} className={styles.flow} aria-labelledby="flow-title">
    <div className={styles.flowAmbient} aria-hidden="true" />
    <div className={styles.container}>
      <Entrance className={styles.sectionHeading}><p className={styles.eyebrow}>Bilginin doğal akışı</p><h2 id="flow-title">Bir işlem.<br /><span>Herkes için doğru bilgi.</span></h2><p>Öğretmenin kaydı, velinin görünümü ve yöneticinin özeti aynı sürecin parçası.</p></Entrance>
      <div className={styles.flowGrid}>
        <svg className={styles.flowLine} viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90C200 90 230 150 400 150S600 90 800 90 1000 140 1200 140" /><motion.path d="M0 90C200 90 230 150 400 150S600 90 800 90 1000 140 1200 140" style={reduced ? { pathLength: 1 } : { pathLength: length }} /></svg>
        <svg className={styles.flowLineMobile} viewBox="0 0 100 900" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0C100 200 0 250 50 450S90 700 50 900" /><motion.path d="M50 0C100 200 0 250 50 450S90 700 50 900" style={reduced ? { pathLength: 1 } : { pathLength: length }} /></svg>
        {steps.map((step, index) => <FlowStep key={step.role} step={step} index={index} />)}
      </div>
      <div className={styles.flowFoot}><span><Check size={15} /> Her kullanıcı kendi yetki kapsamındaki bilgilere erişir.</span><span>Temsili demo akışı</span></div>
    </div>
  </section>
}

function DeviceExperience() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, .5, 1], [40, 0, -30])
  return <section ref={ref} className={styles.devices} aria-labelledby="device-title">
    <div className={styles.deviceLayout}>
      <Entrance className={styles.deviceCopy}><p className={styles.eyebrow}>Çalıştığınız her yerde</p><h2 id="device-title">Masaüstünden<br /><span>cebinize.</span></h2><p>Masaüstü ve mobil uygulamalar.<br />Kurumunuzla bağlantınız hep yanınızda.</p><div className={styles.devicePlatforms}>{[[Monitor, "Masaüstü"], [Smartphone, "Mobil"]].map(([Icon, label]) => { const I = Icon as typeof Monitor; return <span key={String(label)}><I size={25} strokeWidth={1.5} />{String(label)}</span> })}</div><Link className={styles.textLink} href="/indir">Uygulamaları keşfet <ArrowUpRight size={17} /></Link></Entrance>
      <motion.div className={styles.deviceArt} style={reduced ? undefined : { y }}><Artwork name="devices" alt="SchoolAsist kurum özeti, ders programı ve günlük ders listesinin dizüstü bilgisayar, tablet ve telefondaki temsili görünümleri." /><span className={styles.demoNote}>Temsili demo ekranları</span></motion.div>
    </div>
  </section>
}

export function PlatformStory() {
  return <div className={`${styles.page} sa-platform-page`}>
    <PlatformHero /><ConnectedProcesses /><InformationFlow /><DeviceExperience />

  </div>
}
