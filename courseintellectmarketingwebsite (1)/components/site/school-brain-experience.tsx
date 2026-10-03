"use client"

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { ArrowDown, ArrowRight, BookOpen, Check, Mouse, RotateCcw } from "lucide-react"
import { useLenis } from "lenis/react"
import { brainChapters, brainIntroEnd, brainProcesses, brainRolePresentation, brainStoryTimeline, brainTimeline } from "@/lib/school-brain"
import { roles, type RoleId } from "@/lib/site-experience-data"
import SchoolCinematicArt from "./school-cinematic-art"

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function RolePreview({ role }: { role: RoleId }) {
  const selected = roles.find(item => item.id === role)!
  return <div className="brain-static-book" aria-label={`${selected.name} için temsili çalışma alanı`}>
    <div><span><BookOpen size={17} /> {selected.name}</span><h3>{selected.screen}</h3>{selected.features.map(item => <p key={item}><i><Check size={12} /></i>{item}</p>)}</div>
    <div><span>Demo 1 · Çalışma alanı</span><svg viewBox="0 0 160 120" aria-hidden="true"><path d="M24 98 90 18 144 98Z M90 18V98" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="90" cy="18" r="4" fill="currentColor"/></svg><strong>{selected.screen}</strong><p>{selected.description}</p><span className="brain-static-assignment">Günün akışı hazır <Check size={14} /></span></div>
  </div>
}

export function SchoolBrainExperience({ role, onRoleChange }: { role?: RoleId; onRoleChange?: (id: RoleId) => void }) {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const visible = useInView(section, { margin: "200px" })
  const [pageVisible, setPageVisible] = useState(true)
  const [ready, setReady] = useState(false), [unavailable, setUnavailable] = useState(false)
  const [compact, setCompact] = useState(false), [deviceReady, setDeviceReady] = useState(false)
  const [chapter, setChapter] = useState(role ? 2 : 0), chapterRef = useRef(role ? 2 : 0)
  const [activeRole, setActiveRole] = useState<RoleId>(role ?? "yonetici")
  const roleRef = useRef<RoleId>(role ?? "yonetici")
  const [attempt, setAttempt] = useState(0)
  const lenis = useLenis()
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] })
  const progress = useSpring(scrollYProgress, { stiffness: 105, damping: 28, restDelta: .0001 })
  const storyProgress = useTransform(progress, value => brainStoryTimeline(value).sceneProgress)
  const fixedProgress = useMotionValue(1)
  const sceneProgress = role ? fixedProgress : storyProgress
  const titleOpacity = useTransform(sceneProgress, p => brainTimeline(p).title)
  const titleY = useTransform(sceneProgress, [.23, .43], [0, -36])
  const processOpacity = useTransform(sceneProgress, [.38, .48, .62, .73], [0, 1, 1, 0])
  const processY = useTransform(sceneProgress, [.38, .48], [12, 0])
  const roleOpacity = useTransform(sceneProgress, p => brainTimeline(p).teacherCopy)
  const roleY = useTransform(sceneProgress, [.74, .88], [24, 0])
  const cueOpacity = useTransform(sceneProgress, [0, .12, .22], [1, .35, 0])
  const staticMode = !!reduced || unavailable
  const selected = roles.find(item => item.id === activeRole)!, copy = brainRolePresentation[activeRole]
  const CopyHeading = role ? "h1" : "h2"
  const applyRole = useCallback((next: RoleId) => {
    if (roleRef.current === next) return
    roleRef.current = next; setActiveRole(next); onRoleChange?.(next)
  }, [onRoleChange])
  useMotionValueEvent(progress, "change", value => {
    if (role || staticMode) return
    const story = brainStoryTimeline(value), next = brainTimeline(story.sceneProgress).chapter
    if (next !== chapterRef.current) { chapterRef.current = next; setChapter(next) }
    applyRole(story.roleId)
  })
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)")
    const resize = () => { setCompact(media.matches); setDeviceReady(true) }
    const visibility = () => setPageVisible(!document.hidden)
    resize(); visibility()
    media.addEventListener("change", resize); document.addEventListener("visibilitychange", visibility)
    return () => { media.removeEventListener("change", resize); document.removeEventListener("visibilitychange", visibility) }
  }, [])
  const onReady = useCallback(() => setReady(true), [])
  const onFailure = useCallback(() => { setUnavailable(true); setReady(false) }, [])
  function scrollToProgress(value: number) {
    const element = section.current
    if (!element) return
    const top = element.getBoundingClientRect().top + window.scrollY
    const destination = top + (element.offsetHeight - window.innerHeight) * value
    if (lenis) lenis.scrollTo(destination, { duration: 1.35 })
    else window.scrollTo({ top: destination, behavior: reduced ? "instant" : "smooth" })
  }
  function goToChapter(index: number) {
    if (staticMode) { section.current?.querySelector(".brain-teacher-copy")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }); return }
    scrollToProgress(brainChapters[index].progress * brainIntroEnd)
  }
  function retryScene() { setUnavailable(false); setReady(false); setAttempt(value => value + 1) }
  return <section ref={section} className={`school-brain${role ? " school-brain-role" : ""}${staticMode ? " is-static" : ""}`} aria-label={role ? `${selected.name} deneyimi` : "SchoolAsist: okulun dijital beyni"} data-chapter={role ? selected.name : brainChapters[chapter].label} data-role={activeRole} data-scene={unavailable ? "fallback" : staticMode ? "static" : ready ? "ready" : "loading"}>
    <div className="brain-sticky">
      <div className="brain-atmosphere" aria-hidden="true" />
      {!role && <motion.div className="brain-heading" style={staticMode ? undefined : { opacity: titleOpacity, y: titleY }} aria-hidden={!staticMode && chapter === 2}>
        <h1>Bir okulun tüm aklı.<br /><span>Tek merkezde.</span></h1><p>Derslerden yönetime, her süreç aynı merkezde.</p>
      </motion.div>}
      {!role && !staticMode && <motion.div className="brain-process-copy" style={{opacity:processOpacity,y:processY}} aria-hidden={chapter !== 1}>
        <span>Birbirine bağlı süreçler</span>
        <h2>Her süreç. <em>Aynı merkezde.</em></h2>
      </motion.div>}
      <div className={`brain-visual${ready ? " is-ready" : ""}`}>
        <div className="brain-poster" aria-hidden="true"><div className="brain-poster-halo" /><Image src="/images/logo.png" alt="" width={360} height={360} priority /><div className="brain-poster-platform"><i/><i/><i/></div></div>
        {!unavailable && deviceReady && <SceneBoundary key={attempt} onFailure={onFailure}><SchoolCinematicArt progress={sceneProgress} role={activeRole} story={!role} compact={compact} running={!reduced && visible && pageVisible} onReady={onReady} onFailure={onFailure}/></SceneBoundary>}
      </div>
      <motion.div id="brain-role-content" className="brain-teacher-copy" style={staticMode || role ? undefined : { opacity: roleOpacity, y: roleY }} inert={!staticMode && !role && chapter !== 2}>
          <motion.div key={activeRole} className="brain-copy-content" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, ease: [.22,1,.36,1] }}>
            <span className="brain-kicker"><BookOpen size={17} /> {selected.name.toLocaleUpperCase("tr-TR")} DENEYİMİ</span>
            <CopyHeading>{copy.title}<br /><span>{copy.accent}</span></CopyHeading>
            <p>{selected.description}</p>
            <Link href={role ? "#tum-ozellikler" : `/deneyim/${activeRole}/`} className="brain-primary-link">{role ? "Bütün özellikleri incele" : `${selected.name} deneyimini keşfet`} <ArrowRight size={18}/></Link>
            <small>Temsili demo verileri · Kurum ve rol yetkileri kapsamında</small>
          </motion.div>
      </motion.div>
      {staticMode && <><nav className="brain-static-processes" aria-label="Okul süreçleri">{brainProcesses.map(item => <Link key={item.id} href={item.href}>{item.label}<ArrowRight size={15}/></Link>)}</nav><RolePreview role={activeRole} /></>}
      {!staticMode && !role && <motion.div className="brain-scroll-cue" style={{ opacity: cueOpacity }} inert={chapter !== 0}><button onClick={() => goToChapter(1)} className="brain-primary-link">Deneyimi keşfet <ArrowRight size={18}/></button><span><Mouse size={16}/> Kaydır ve okulun akışını keşfet <ArrowDown size={13}/></span></motion.div>}
      {!staticMode && !role && chapter !== 2 && <nav className="brain-chapter-nav" aria-label="Animasyon bölümleri">{brainChapters.map((item, index) => <button key={item.label} onClick={() => goToChapter(index)} aria-label={item.label} aria-current={chapter === index ? "step" : undefined}><i/><span>{item.label}</span></button>)}</nav>}
      {unavailable && <button className="brain-retry" onClick={retryScene}><RotateCcw size={14}/> Görünümü tekrar yükle</button>}
      <noscript><style>{`.school-brain{height:auto!important}.brain-sticky{position:relative!important;min-height:760px;padding-top:660px}.brain-teacher-copy,.brain-chapter-nav,.brain-scroll-cue{display:none!important}`}</style><nav className="brain-static-processes">{roles.map(item => <a key={item.id} href={`/deneyim/${item.id}/`}>{item.name}</a>)}</nav></noscript>
    </div>
    <div className="brain-exit-glow" aria-hidden="true" />
  </section>
}
