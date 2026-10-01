"use client"

import { useRef, useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion"
import { ArrowDown, Move, ScanLine } from "lucide-react"
import { ProductScene } from "./product-scene"
import { roles, type RoleId } from "@/lib/site-experience-data"
import type { ShowcaseAsset } from "@/lib/showcase-assets"

type Chapter = { title: string; detail: string; label: string; asset: ShowcaseAsset; role: RoleId }

function ChapterLayer({ chapter, index, progress, staticMode }: { chapter: Chapter; index: number; progress: MotionValue<number>; staticMode: boolean }) {
  // Hold each scene long enough to read; crossfades occupy only the boundaries.
  const opacity = useTransform(progress, index === 0 ? [0, .27, .36] : index === 1 ? [.27, .36, .62, .71] : [.62, .71, 1], index === 0 ? [1, 1, 0] : index === 1 ? [0, 1, 1, 0] : [0, 1, 1])
  const scale = useTransform(progress, [0, .33, .66, 1], [1.13, 1, .94, 1.04])
  const rotateY = useTransform(progress, [0, .5, 1], [-7, 0, 7])
  const y = useTransform(progress, [0, .5, 1], [25, 0, -20])
  const textY = useTransform(progress, index === 0 ? [0, .36] : index === 1 ? [.27, .36, .71] : [.62, .71, 1], index === 0 ? [0, -16] : index === 1 ? [20, 0, -16] : [20, 0, 0])
  return <motion.article className="sa-cinema-chapter" style={staticMode ? { opacity: 1 } : { opacity }}>
    <motion.div className="sa-cinema-device" style={staticMode ? { scale: 1, rotateY: 0, y: 0 } : { scale, rotateY, y }} aria-hidden="true"><ProductScene className="sa-cinema-desktop" asset={chapter.asset} role={chapter.role} alt="" transparent /><ProductScene className="sa-cinema-phone" asset="roles-device" role={chapter.role} device="phone" alt="" transparent /></motion.div>
    <motion.div className="sa-cinema-copy" style={staticMode ? { y: 0 } : { y: textY }}><p>{chapter.label}</p><h3>{chapter.title}</h3><span>{chapter.detail}</span></motion.div>
  </motion.article>
}

export function ScrollExperience({ role, platform = false }: { role?: RoleId; platform?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [simplified, setSimplified] = useState(false)
  const [chapter, setChapter] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  useMotionValueEvent(scrollYProgress, "change", value => setChapter(value < .315 ? 0 : value < .665 ? 1 : 2))
  const staticMode = !!reduced || simplified
  const selected = roles.find(item => item.id === role)
  const chapters: Chapter[] = role && selected ? selected.features.map((feature, index) => ({ label: `${selected.name} · ${String(index + 1).padStart(2, "0")}`, title: feature, detail: index === 0 ? selected.description : index === 1 ? "İhtiyacınız olan bilgi ve işlemler, kendi çalışma alanınızda." : "Tanımlanan rol ve veri kapsamıyla, bütün ayrıntılar elinizin altında.", asset: index === 1 ? "home-ecosystem" : "roles-device", role })) : [
    { label: "01 · Eğitim", title: "Dersin bütün akışı.", detail: "Program, yoklama, içerik ve değerlendirme. Öğretmenin çalışma alanında birlikte.", asset: "roles-device", role: "ogretmen" },
    { label: "02 · İletişim", title: "Bilgi, doğru kişide.", detail: "Veli, yalnızca hesabına bağlı öğrencilerin devamını, gelişimini ve paylaşılan bildirimlerini takip eder.", asset: "home-ecosystem", role: "veli" },
    { label: "03 · Yönetim", title: "Büyük resim. Bütün detaylar.", detail: "Kurum, şube, ekip ve finans. Her kullanıcıya kendi rolü ve yetkisi kadar erişim.", asset: "roles-device", role: "yonetici" },
  ]
  function goChapter(index: number) {
    const section = ref.current
    if (!section) return
    const top = section.getBoundingClientRect().top + window.scrollY
    const distance = Math.max(0, section.offsetHeight - window.innerHeight)
    window.scrollTo({ top: top + distance * [.08, .5, .92][index], behavior: reduced ? "instant" : "smooth" })
  }
  return <section ref={ref} className="sa-cinema" data-static={staticMode} aria-label={selected ? `${selected.name} deneyimini yakından keşfedin` : "SchoolAsist deneyimini yakından keşfedin"}>
    <div className="sa-cinema-sticky"><header><div><p className="ref-eyebrow">{platform ? "Birlikte çalışan süreçler" : "Yakından bakın"}</p><h2>{selected ? "Size ait bir deneyim." : "Bir platform. Bütün akış."}</h2></div><button type="button" onClick={() => setSimplified(value => !value)} aria-pressed={simplified} disabled={!!reduced} aria-label="Sade görünüm"><ScanLine size={17} /><span>{staticMode ? "Sade görünüm" : "Hareketi azalt"}</span></button></header>
      <div className="sa-cinema-stage">{chapters.map((item, index) => <ChapterLayer key={`${item.role}-${index}`} chapter={item} index={index} progress={scrollYProgress} staticMode={staticMode} />)}</div>
      {!staticMode && <div className="sa-cinema-rail"><span><Move size={15} /> Kaydırarak keşfedin</span><div role="group" aria-label="Ürün sahneleri">{chapters.map((item, index) => <button type="button" key={item.label} aria-label={`${index + 1}. sahne: ${item.title}`} aria-current={chapter === index ? "step" : undefined} onClick={() => goChapter(index)}><i data-active={chapter === index}><motion.b style={{ scaleX: scrollYProgress }} /></i></button>)}</div><span>{String(chapter + 1).padStart(2, "0")} / 03 <ArrowDown size={15} /></span></div>}
      <small className="sa-cinema-note">Temsili demo ekranları</small>
    </div>
  </section>
}
