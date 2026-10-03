"use client"

import { useId, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BookOpen, BriefcaseBusiness, Building2, Bus, CalendarDays, Check, ChevronDown, GraduationCap, HeartHandshake, MapPin, ShieldCheck, Users, Utensils } from "lucide-react"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { roleDayStories } from "@/lib/role-day-stories"
import { RoleCapabilityList } from "./role-capability-list"
import styles from "./role-experience.module.css"

const ease = [.22, 1, .36, 1] as const
const icons = { yonetici: Building2, ogretmen: BookOpen, veli: Users, ogrenci: GraduationCap, muhasebe: BarChart3, personel: BriefcaseBusiness, rehberlik: HeartHandshake, "sube-muduru": MapPin, yemekhane: Utensils, "servis-soforu": Bus }

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [20, 0], opacity: [.75, 1] }} viewport={{ once: true, amount: .12 }} transition={{ duration: .75, ease }}>{children}</motion.div>
}

function RoleArt({ id, eager = false }: { id: RoleId; eager?: boolean }) {
  const root = `/images/role-day-art/${id}`
  return <picture><source media="(max-width:600px)" srcSet={`${root}-mobile.webp`}/><Image src={`${root}.webp`} width={1536} height={1024} alt={`${roles.find(role => role.id === id)?.name} günlük akışını anlatan özel ürün sahnesi; temsili demo.`} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} sizes="(max-width:740px) 100vw, 55vw" className={styles.art}/></picture>
}

function RoleNavigation({ id }: { id?: RoleId }) {
  const other = roles.slice(4)
  const selected = other.find(role => role.id === id)
  return <nav className={styles.roleNavigation} aria-label="Rol deneyimleri"><div>{roles.slice(0,4).map(role => <Link key={role.id} href={`/deneyim/${role.id}`} aria-current={id === role.id ? "page" : undefined}>{role.name}</Link>)}<details className={styles.moreRoles} onKeyDown={event => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus() } }}><summary data-active={!!selected}>{selected?.name || "Diğer roller"}<ChevronDown size={15}/></summary><div>{other.map(role => <Link key={role.id} href={`/deneyim/${role.id}`} aria-current={id === role.id ? "page" : undefined} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open") }}>{role.name}<ArrowUpRight size={14}/></Link>)}</div></details></div></nav>
}

function DayJourney({ id }: { id: RoleId }) {
  const story = roleDayStories[id]
  const [active, setActive] = useState(1)
  const reduced = useReducedMotion()
  const uid = useId()
  const selected = story.phases[active]
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0,.5,1], [20,0,-20])
  return <section ref={ref} className={styles.journey} id="gunun-akisi" aria-labelledby="role-day-heading">
    <div className={styles.container}><Reveal><h2 id="role-day-heading">{story.journey}</h2></Reveal>
      <div className={styles.dayRail} role="tablist" aria-label={`${roles.find(role=>role.id===id)?.name} günlük akışı`}>{story.phases.map((phase,index) => <button key={phase.label} role="tab" id={`${uid}-tab-${index}`} aria-selected={active===index} aria-controls={`${uid}-panel`} tabIndex={active===index?0:-1} onClick={()=>setActive(index)} onKeyDown={event=>{
        let next = index
        if(event.key==="ArrowRight") next=(index+1)%story.phases.length
        else if(event.key==="ArrowLeft") next=(index+story.phases.length-1)%story.phases.length
        else if(event.key==="Home") next=0
        else if(event.key==="End") next=story.phases.length-1
        else return
        event.preventDefault();setActive(next);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus()
      }}><span className={styles.railDot}/><span><strong>{phase.label}</strong><small>{index===0?"Hazırlık ve planlama":index===1?"Takip ve koordinasyon":"Değerlendirme ve takip"}</small></span></button>)}<motion.span className={styles.railProgress} aria-hidden="true" initial={false} animate={{scaleX:(active+.5)/3}} transition={{duration:reduced?0:.45,ease}}/></div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${active}`} tabIndex={0} className={styles.dayPanel}><AnimatePresence mode="wait" initial={false}><motion.div key={active} className={styles.dayLayout} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:reduced?0:.22,ease}}>
        <div className={styles.dayCopy}><p className={styles.eyebrow}>{selected.label} · {roles.find(role=>role.id===id)?.name}</p><h3>{selected.title}</h3><p>{selected.description}</p><span className={styles.status}><i/>Temsili günlük akış</span></div>
        <motion.div className={styles.demoBoard} style={reduced?undefined:{y}}><header><span><CalendarDays size={18}/>{selected.label}</span><small>Demo çalışma alanı</small></header><div className={styles.boardRows}>{selected.rows.map(([title,detail,status],index)=><div key={title}><span className={styles.avatar}>{index===0?<BookOpen size={21}/>:index===1?<Users size={21}/>:<BarChart3 size={21}/>}</span><div><strong>{title}</strong><p>{detail}</p></div><span className={styles.rowStatus} data-pending={/İncelenecek|Planlandı|Çalışılıyor/.test(status)}>{status}</span><div className={styles.miniVisual} aria-hidden="true">{index===0?<div className={styles.miniPeople}>{["Demo 1","Demo 2","Demo 3"].map((label,i)=><div key={label}><span><Users size={13}/></span><small>{label}</small><i data-last={i===2}/></div>)}</div>:index===1?<div className={styles.miniCalendar}>{["Pzt","Sal","Çar","Per","Cum"].map((label,i)=><div key={label}><small>{label}</small><i data-selected={i===active+1}/><i/></div>)}</div>:<div className={styles.miniChart}><svg viewBox="0 0 200 80"><path d="M5 68C30 65 30 38 55 42S80 70 103 37S130 54 155 22S180 34 195 7"/></svg><div>{[32,47,38,69,56,83].map((height,i)=><i key={i} style={{height:`${height}%`}}/>)}</div></div>}</div></div>)}</div><div className={styles.boardFoot}><span><Check size={15}/>Bilgiler bir arada</span><div className={styles.spark} aria-hidden="true">{[35,57,42,72,54,81,65,93].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div></div><small className={styles.demoNote}>Temsili demo verileri; kurumunuzun canlı kayıtları değildir.</small></motion.div>
      </motion.div></AnimatePresence></div>
    </div>
  </section>
}

function FeatureChapter({ id }: { id: RoleId }) {
  return <section className={styles.features} aria-labelledby="role-feature-heading"><div className={styles.featureLayout}><Reveal className={styles.featureCopy}><p className={styles.eyebrow}>{roles.find(role=>role.id===id)?.name} çalışma alanı</p><h2 id="role-feature-heading">Kontrol sizde.<br/><span>Ayrıntılar bir dokunuş uzağınızda.</span></h2><p>Size tanımlanan bütün alanları keşfedin. Bir başlık seçin, özelliklerin tamamını açılan pencerede inceleyin.</p><Link href="/indir">Masaüstü ve mobil uygulamalar<ArrowUpRight size={17}/></Link></Reveal><div className={styles.featureCatalog}><RoleCapabilityList id={id} compact/></div></div></section>
}

function NextRoles({ id }: { id: RoleId }) {
  const index=roles.findIndex(role=>role.id===id)
  const next=[roles[(index+1)%roles.length],roles[(index+2)%roles.length]]
  return <section className={styles.next} aria-labelledby="next-role-heading"><Reveal><h2 id="next-role-heading">Akış diğer rollerle<br/><span>devam eder.</span></h2><p>Aynı ekosistemde, her rol için özel bir deneyim.</p><Link href="/deneyim">Bütün deneyimler<ArrowUpRight size={16}/></Link></Reveal><div className={styles.nextCards}>{next.map(role=><Link key={role.id} href={`/deneyim/${role.id}`}><div className={styles.nextArt}><RoleArt id={role.id}/></div><div><h3>{role.name} deneyimi</h3><p>{role.description}</p><span aria-hidden="true"><ArrowRight size={21}/></span></div></Link>)}</div></section>
}

export function RoleExperience({ id }: { id: RoleId }) {
  const role=roles.find(role=>role.id===id)!
  const story=roleDayStories[id]
  const ref=useRef<HTMLElement>(null)
  const reduced=useReducedMotion()
  const {scrollYProgress}=useScroll({target:ref,offset:["start start","end start"]})
  const y=useTransform(scrollYProgress,[0,1],[0,-28])
  return <div className={`${styles.page} sa-role-day-story`} data-role={id}><RoleNavigation id={id}/><section ref={ref} className={styles.hero} aria-labelledby="role-hero-title"><div className={styles.heroInner}><Reveal className={styles.heroCopy}><nav aria-label="İçerik yolu" className={styles.breadcrumb}><Link href="/deneyim">Deneyimler</Link><span>/</span><span>{role.name}</span></nav><p className={styles.roleLabel}>{role.name} deneyimi</p><h1 id="role-hero-title">{role.title}<br/><span>{story.accent}</span></h1><p className={styles.description}>{role.description}</p><div className={styles.heroActions}><a className={styles.primary} href="#gunun-akisi">Akışı keşfet<ArrowDown size={18}/></a><a className={styles.secondary} href="#tum-ozellikler">Tüm özellikler<ArrowUpRight size={18}/></a></div></Reveal><motion.div className={styles.heroArt} style={reduced?undefined:{y}}><RoleArt id={id} eager/></motion.div></div><div className={styles.heroFloor}><span>{role.features.map((feature,index)=><span key={feature}><i/>{feature}{index<role.features.length-1&&<b aria-hidden="true">·</b>}</span>)}</span><small>Temsili demo verileri</small></div></section><DayJourney id={id}/><FeatureChapter id={id}/><NextRoles id={id}/></div>
}

export function ExperienceDirectory() {
  return <div className={`${styles.page} sa-role-directory-v2`}><RoleNavigation/><section className={styles.directoryHero}><Reveal><p className={styles.eyebrow}>SchoolAsist deneyimleri</p><h1>Herkesin rolü ayrı.<br/><span>Akış birlikte ilerler.</span></h1><p>Kendi çalışma alanınızı seçin. Bir günün planını, günlük araçlarınızı ve bütün özelliklerinizi keşfedin.</p></Reveal><div><RoleArt id="yonetici" eager/></div></section><section className={styles.directory} aria-labelledby="role-directory-heading"><h2 id="role-directory-heading">Size özel bir deneyim.</h2><div>{roles.map(role=>{const Icon=icons[role.id];return <Link key={role.id} href={`/deneyim/${role.id}`}><div className={styles.directoryArt}><RoleArt id={role.id}/></div><span className={styles.directoryTitle}><Icon size={23}/><h3>{role.name}</h3><ArrowUpRight size={19}/></span><p>{role.description}</p></Link>})}</div><aside><ShieldCheck size={23}/><p>Her kullanıcı yalnızca kurumunun tanımladığı rol, modül ve veri kapsamına erişir. Buradaki sahneler temsili demodur.</p></aside></section></div>
}
