"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarDays, Download, Info, Monitor, Smartphone, UserRound } from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { downloadActionLabel, safeDownloadUrl } from "@/lib/download-links"
import styles from "./apps-page.module.css"

type PlatformId = "windows" | "macos" | "ios" | "android"

function PlatformIcon({ platform }: { platform: PlatformId }) {
  if (platform === "windows") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m2 4 8.5-1.2v8.4H2V4Zm10-1.4L22 1.2v10h-10V2.6ZM2 12.7h8.5v8.4L2 19.9v-7.2Zm10 0h10v10.1l-10-1.4v-8.7Z" /></svg>
  if (platform === "android") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.4 5.9 4.9 3.4l.9-.5 1.5 2.5A9.8 9.8 0 0 1 12 4.3c1.7 0 3.3.4 4.7 1.1l1.5-2.5.9.5-1.5 2.5A7.5 7.5 0 0 1 21 11H3a7.5 7.5 0 0 1 3.4-5.1ZM7.5 8.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Zm9 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM3 12h18v6a2 2 0 0 1-2 2h-1v2h-2v-2H8v2H6v-2H5a2 2 0 0 1-2-2v-6Z" /></svg>
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 4.1c1-1.2.9-2.6.9-3.1-1.3.1-2.8.9-3.6 1.9-.8.9-1.1 2-1 3.1 1.4.1 2.7-.6 3.7-1.9Zm3.1 8.5c0-2 1.6-3 1.7-3.1-1-1.5-2.6-1.7-3.2-1.7-1.3-.2-2.6.8-3.3.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.8.8-3.6 2.1-1.6 2.6-.4 6.5 1.1 8.6.7 1.1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1 2.7-2.1.9-1.2 1.3-2.4 1.3-2.5-.1 0-2.3-.9-2.3-3.4Z" transform="translate(-2 1)" /></svg>
}

function PlayIcon() {
  return <svg viewBox="0 0 28 30" fill="none" aria-hidden="true"><path fill="#20D0A0" d="M1 1.5 16 15 1 28.5V1.5Z"/><path fill="#44C7FF" d="m1 1.5 18 10L16 15 1 1.5Z"/><path fill="#FFCF43" d="m19 11.5 6 3.2c.8.4.8 1.2 0 1.6l-6 3.2-5-4 5-4Z"/><path fill="#FF566B" d="m1 28.5 18-10L16 15 1 28.5Z"/></svg>
}

function Entrance({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [14, 0] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .65, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
}

function DownloadLink({ id, url, store = false }: { id: PlatformId; url?: string; store?: boolean }) {
  const href = safeDownloadUrl(url)
  const label = downloadActionLabel[id]
  const className = `${styles.downloadLink} ${store ? styles.storeLink : id === "windows" ? styles.windowsLink : styles.macLink}`
  const icon = id === "android" && store ? <PlayIcon /> : <PlatformIcon platform={id} />
  const content = <>{icon}{store ? <span><small>{id === "ios" ? "App Store’dan" : "Google Play’den"}</small><strong>indir</strong></span> : <span>{label}</span>}{!store && <Download size={16} />}</>
  if (!href) return <span className={`${className} ${styles.unavailable}`} role="link" aria-disabled="true" aria-label={`${label} — indirme bağlantısı henüz yayımlanmadı`}>{content}<small className={styles.unavailableLabel}>Henüz yayımlanmadı</small></span>
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`${label} (yeni sekmede açılır)`}>{content}</a>
}

function SharedFlow() {
  return <section className={styles.flow} aria-labelledby="apps-flow-title">
    <svg className={styles.ribbon} viewBox="0 0 1440 350" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="apps-orange-ribbon"><stop stopColor="#ffb526"/><stop offset=".5" stopColor="#ff7c00"/><stop offset="1" stopColor="#ffbe5a"/></linearGradient><linearGradient id="apps-blue-ribbon"><stop stopColor="#123c94"/><stop offset=".55" stopColor="#488cff"/><stop offset="1" stopColor="#0a42bd"/></linearGradient></defs><path d="M-90 18C170 55 400 370 680 238S1040 260 1160 170 1370 160 1510 30" stroke="url(#apps-blue-ribbon)" strokeWidth="14"/><path d="M380 305C540 55 605 270 830 175S1000 205 1170 150 1400 150 1510 32" stroke="url(#apps-orange-ribbon)" strokeWidth="19"/><path d="M380 300C540 50 605 265 830 170S1000 200 1170 145 1400 145 1510 27" stroke="#ffdc9c" strokeWidth="2"/></svg>
    <div className={`${styles.container} ${styles.flowInner}`}>
      <Entrance className={styles.flowCopy}><h2 id="apps-flow-title">Ekran değişir.<br/><span>Akış devam eder.</span></h2><p>Kurumunuzun bilgileri, aynı hesapla her ekranda.</p></Entrance>
      <Entrance className={styles.previews}>
        <div className={styles.preview}><div className={styles.previewSurface}><h3><i><CalendarDays size={22}/></i>Ders programı</h3><div className={styles.lessonRows}><p><time>08.00</time><span/>Matematik</p><p><time>09.00</time><span/>Türkçe</p><p><time>10.00</time><span/>Fen Bilimleri</p></div></div></div>
        <div className={styles.preview}><div className={styles.previewSurface}><h3><i><Bell size={22}/></i>Duyurular</h3><div className={styles.noticeRows}><div><i/><span/><span/></div><div><i/><span/><span/></div><div><i/><span/><span/></div></div></div></div>
        <div className={styles.preview}><div className={styles.previewSurface}><h3><i><Monitor size={22}/></i>Kurum özeti</h3><div className={styles.chartBars} aria-hidden="true">{[38, 67, 49, 89, 63, 78].map((height, index) => <span key={index} style={{ height: `${height}%` }}/>)}</div></div></div>
        <p className={styles.flowCaption}>Temsili demo görünümü</p>
      </Entrance>
    </div>
  </section>
}

const steps = [
  { title: "Uygulamayı indirin", detail: "Cihazınıza uygun sürümü seçin.", Icon: Download },
  { title: "Kurumunuz onaylansın", detail: "Başvurunuzun değerlendirilmesini bekleyin.", Icon: CalendarDays },
  { title: "Hesabınızla giriş yapın", detail: "E-postanızdaki bilgilerle başlayın.", Icon: UserRound },
]

export function AppsPage() {
  const content = useSectionContent("download")
  const urlFor = (id: PlatformId) => content.platforms.find(platform => platform.id === id)?.downloadUrl
  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="apps-title">
      <div className={`${styles.container} ${styles.heroInner}`}>
        <Entrance className={styles.heroCopy}><p className={styles.eyebrow}>SchoolAsist Uygulamaları</p><h1 id="apps-title">Her cihazda.<br/><span>Aynı akışta.</span></h1><p className={styles.lead}>Okulunuzun günlük akışı, masaüstünde ve cebinizde sizinle.</p><div className={styles.heroActions}><a className={styles.primary} href="#indirme">Uygulamayı seçin <ArrowDown size={19}/></a><Link className={styles.textLink} href="/destek">Kurulum desteği <ArrowUpRight size={17}/></Link></div><ul className={styles.platforms} aria-label="Desteklenen platformlar">{([['windows', 'Windows'], ['macos', 'macOS'], ['ios', 'iOS'], ['android', 'Android']] as const).map(([id, label]) => <li key={id}><PlatformIcon platform={id}/><span>{label}</span></li>)}</ul></Entrance>
        <Entrance className={styles.heroArt}><Image src="/images/home-lower-art/devices.webp" alt="SchoolAsist ders programı ve kurum görünümünün dizüstü bilgisayar, tablet ve telefondaki temsili ekranları." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 65vw" preload/><p className={styles.caption}>Temsili uygulama ekranları</p></Entrance>
      </div>
    </section>

    <section id="indirme" className={styles.downloads} aria-labelledby="apps-download-title">
      <div className={styles.container}>
        <Entrance className={styles.sectionHeading}><div><h2 id="apps-download-title">Size uygun şekilde <span>başlayın.</span></h2><p>SchoolAsist’i çalıştığınız cihaza indirin.</p></div><small>Resmî indirme seçenekleri</small></Entrance>
        <div className={styles.downloadGrid}>
          <Entrance className={`${styles.downloadCard} ${styles.desktopCard}`}><div className={styles.cardCopy}><p className={styles.cardEyebrow}><Monitor size={35}/><span>Masaüstü</span></p><h3>Geniş ekran. Tam kontrol.</h3><p>Windows ve macOS için çalışma alanınız.</p></div><div className={styles.cardArt}><Image src="/images/apps-redesign/desktop.webp" alt="SchoolAsist kurum görünümünü gösteren dizüstü bilgisayar. Temsili demo." width={1536} height={1024} sizes="(max-width: 760px) 95vw, 45vw"/></div><div className={styles.cardBottom}><div className={styles.downloadActions}><DownloadLink id="windows" url={urlFor("windows")}/><DownloadLink id="macos" url={urlFor("macos")}/></div><p className={styles.platformNote}>Windows · macOS</p></div></Entrance>
          <Entrance className={`${styles.downloadCard} ${styles.mobileCard}`}><div className={styles.cardCopy}><p className={styles.cardEyebrow}><Smartphone size={35}/><span>Mobil</span></p><h3>Günün akışı cebinizde.</h3><p>iPhone, iPad ve Android cihazlar için.</p></div><div className={styles.cardArt}><Image src="/images/apps-redesign/mobile.webp" alt="SchoolAsist ders programı ve duyurularını gösteren iki telefon. Temsili demo." width={1536} height={1024} sizes="(max-width: 760px) 95vw, 45vw"/></div><div className={styles.cardBottom}><div className={styles.downloadActions}><DownloadLink id="ios" url={urlFor("ios")} store/><DownloadLink id="android" url={urlFor("android")} store/></div><p className={styles.platformNote}>iOS · iPadOS · Android</p></div></Entrance>
        </div>
      </div>
    </section>

    <SharedFlow/>

    <section className={styles.setup} aria-labelledby="apps-setup-title"><div className={styles.container}>
      <Entrance><h2 id="apps-setup-title">Üç adımda <span>hazır olun.</span></h2><ol className={styles.steps}>{steps.map(({ title, detail, Icon }, index) => <li key={title}><span className={styles.stepNumber}>0{index + 1}</span><span className={styles.stepIcon}><Icon size={26}/></span><div><h3>{title}</h3><p>{detail}</p></div>{index < 2 && <ArrowRight className={styles.stepArrow} size={24} aria-hidden="true"/>}</li>)}</ol><p className={styles.info}><Info size={19}/><span>Kurumunuz onaylandıktan sonra e-postanızdaki bilgilerle uygulamadan giriş yapın.</span></p></Entrance>
      <div className={styles.help}><h2>Kurulumda desteğe mi ihtiyacınız var?</h2><Link href="/destek">Destek merkezine git <ArrowUpRight size={17}/></Link></div>
    </div></section>
  </div>
}
