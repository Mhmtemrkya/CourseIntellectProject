"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Plus, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import { type ShowcaseAsset } from "@/lib/showcase-assets"
import { type RoleId } from "@/lib/site-experience-data"
import { HighlightArtwork, ProductScene } from "./product-scene"
import { highlightHeadline, highlightTopic, productHighlights } from "@/lib/product-highlights"
import { ExperienceDirectory, RoleExperience } from "./role-experience"
import { SchoolBrainExperience } from "./school-brain-experience"
import { HomeContinuation } from "./home-continuation"
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

export function HomeStory() {
  return <div className="ref-story brain-home-story sa-home-redesign"><SchoolBrainExperience /><HomeContinuation /></div>
}

export function RolesStory() {
  return <ExperienceDirectory />
}

export function RoleStory({ id }: { id: RoleId }) {
  return <RoleExperience id={id} />
}
