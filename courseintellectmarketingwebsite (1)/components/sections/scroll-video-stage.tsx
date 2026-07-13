"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"

const STAGE_VISUALS = [
  { src: "/images/product/vaka-merkezi.png", position: "center center" },
  { src: "/images/product/kutuphane.png", position: "center center" },
  { src: "/images/product/giris.png", position: "center center" },
] as const

const ANNOTATIONS_BY_LANGUAGE = {
  tr: [
    {
      at: [0.17, 0.31] as const,
      eyebrow: "01 / Yönetim merkezi",
      title: "Kurumun nabzı, canlı.",
      body: "Şubeler, öğrenciler, ekipler ve kritik göstergeler tek bakışta önünüzde.",
      side: "right" as const,
    },
    {
      at: [0.37, 0.51] as const,
      eyebrow: "02 / Akademik akış",
      title: "Her süreç aynı ritimde.",
      body: "Ders programından sınava, yoklamadan rapora kadar bütün akademik akış bağlantılı.",
      side: "left" as const,
    },
    {
      at: [0.57, 0.71] as const,
      eyebrow: "03 / Rol bazlı deneyim",
      title: "Herkes için doğru ekran.",
      body: "Yönetici, öğretmen, öğrenci, veli ve ekipler yalnızca ihtiyaç duyduğu araçlarla çalışır.",
      side: "right" as const,
    },
    {
      at: [0.77, 0.89] as const,
      eyebrow: "04 / Akıllı karar",
      title: "Veriden karara, saniyeler içinde.",
      body: "Finansal görünüm, performans eğilimleri ve operasyonel içgörüler daima güncel.",
      side: "left" as const,
    },
  ],
  en: [
    {
      at: [0.17, 0.31] as const,
      eyebrow: "01 / Command center",
      title: "Your institution, live.",
      body: "Branches, students, teams and critical indicators are visible at a glance.",
      side: "right" as const,
    },
    {
      at: [0.37, 0.51] as const,
      eyebrow: "02 / Academic flow",
      title: "Every process, in rhythm.",
      body: "Schedules, exams, attendance and reports move together in one connected flow.",
      side: "left" as const,
    },
    {
      at: [0.57, 0.71] as const,
      eyebrow: "03 / Role-based experience",
      title: "The right workspace for everyone.",
      body: "Leaders, teachers, students, parents and teams see only the tools they need.",
      side: "right" as const,
    },
    {
      at: [0.77, 0.89] as const,
      eyebrow: "04 / Intelligent decisions",
      title: "From data to decision, instantly.",
      body: "Financial visibility, performance trends and operational insights stay current.",
      side: "left" as const,
    },
  ],
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function fadeRange(p: number, start: number, end: number, fade = 0.04) {
  if (p < start - fade || p > end + fade) return 0
  if (p < start) return clamp((p - (start - fade)) / fade)
  if (p > end) return clamp(1 - (p - end) / fade)
  return 1
}

function visualOpacity(index: number, progress: number) {
  const segment = 1 / STAGE_VISUALS.length
  const start = index * segment
  const end = (index + 1) * segment
  const blend = 0.025
  if (progress < start - blend || progress > end + blend) return 0
  if (index > 0 && progress < start + blend) {
    return clamp((progress - (start - blend)) / (blend * 2))
  }
  if (index < STAGE_VISUALS.length - 1 && progress > end - blend) {
    return clamp(((end + blend) - progress) / (blend * 2))
  }
  return 1
}

export function ScrollVideoStage() {
  const { language } = useLanguage()
  const ANNOTATIONS = ANNOTATIONS_BY_LANGUAGE[language]
  const { hero } = useSectionContent("homepage")
  const sectionRef = useRef<HTMLElement>(null)

  const [progress, setProgress] = useState(0)
  const [primed, setPrimed] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [stageActive, setStageActive] = useState(true)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPrimed(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  const updateScroll = useCallback(() => {
    const sec = sectionRef.current
    if (!sec) return
    const rect = sec.getBoundingClientRect()
    const scrollable = Math.max(1, sec.offsetHeight - window.innerHeight)
    const scrolled = reducedMotion ? 0 : clamp(-rect.top / scrollable)
    setProgress(scrolled)
    setStageActive(rect.bottom > 0 && rect.top < window.innerHeight)
  }, [reducedMotion])

  useEffect(() => {
    updateScroll()
    const onScroll = () => updateScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [updateScroll])

  const heroOpacity = fadeRange(progress, 0.0, 0.13, 0.05)
  const ctaStripOpacity = fadeRange(progress, 0.91, 1.0, 0.05)
  const activeChapter = Math.min(STAGE_VISUALS.length - 1, Math.floor(progress * STAGE_VISUALS.length))

  return (
    <>
      {/* Top scroll progress bar */}
      <div
        aria-hidden
        className="fixed left-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#F7941D] via-[#F08C1E] to-[#FBB971]"
        style={{
          width: `${progress * 100}%`,
          opacity: stageActive ? 1 : 0,
          boxShadow: "0 0 12px rgba(247,148,29,0.6)",
          transition: "opacity 220ms ease",
        }}
      />

      {/* The big sticky scroll stage */}
      <section
        ref={sectionRef}
        className={`relative z-[2] -mt-20 ${reducedMotion ? "h-[100svh]" : "h-[360vh] md:h-[520vh]"}`}
      >
        <div
          className="sticky top-0 h-screen w-full overflow-hidden bg-[#021E2E]"
          style={{ contain: "paint" }}
        >
          {STAGE_VISUALS.map((visual, index) => {
            const segment = 1 / STAGE_VISUALS.length
            const localProgress = clamp((progress - index * segment) / segment)

            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={visual.src}
                src={visual.src}
                alt=""
                aria-hidden
                loading={index === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition: visual.position,
                  opacity: reducedMotion ? (index === 0 ? 1 : 0) : visualOpacity(index, progress),
                  transform: `scale(${1.02 + localProgress * 0.035}) translate3d(0, ${(localProgress - 0.5) * -1.5}%, 0)`,
                  filter: "brightness(0.58) saturate(0.9) contrast(1.04)",
                  transition: "opacity 220ms linear",
                  willChange: "opacity, transform",
                }}
              />
            )
          })}

          {/* Base tint (very subtle, keeps the video readable) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(2,30,46,0.18) 0%, rgba(2,30,46,0.28) 70%, rgba(2,30,46,0.55) 100%)",
            }}
          />

          {/* Film chapter indicator */}
          {!reducedMotion && (
            <div className="pointer-events-none absolute right-6 top-24 z-10 hidden items-center gap-3 md:flex md:right-12">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                Sahne {String(activeChapter + 1).padStart(2, "0")}
              </span>
              <div className="flex gap-1.5">
                {STAGE_VISUALS.map((visual, index) => (
                  <span
                    key={visual.src}
                    className={`h-px transition-all duration-300 ${index === activeChapter ? "w-10 bg-[#F7941D]" : "w-5 bg-white/20"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Subtle vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(2,30,46,0.55) 100%)",
            }}
          />

          {/* HERO-ONLY left darkening gradient — fades with hero overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: heroOpacity,
              background:
                "linear-gradient(95deg, rgba(2,22,34,0.92) 0%, rgba(2,22,34,0.78) 28%, rgba(2,22,34,0.4) 52%, rgba(2,22,34,0.05) 75%, transparent 90%)",
            }}
          />

          {/* HERO-ONLY bottom darkening gradient — anchors content */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: heroOpacity,
              background:
                "linear-gradient(to top, rgba(2,22,34,0.85) 0%, rgba(2,22,34,0.55) 22%, rgba(2,22,34,0.05) 45%, transparent 60%)",
            }}
          />

          {/* === Overlay 1: HERO (premium editorial) === */}
          <HeroOverlay hero={hero} opacity={heroOpacity} primed={primed} />

          {/* === Annotation cards === */}
          {ANNOTATIONS.map((ann, i) => {
            const op = fadeRange(progress, ann.at[0], ann.at[1], 0.04)
            return (
              <div
                key={i}
                className={`pointer-events-none absolute bottom-[10%] max-w-[440px] px-6 transition-opacity duration-300 md:bottom-auto md:top-1/2 md:-translate-y-1/2 ${
                  ann.side === "right" ? "right-0 md:right-16 lg:right-24" : "left-0 md:left-16 lg:left-24"
                }`}
                style={{
                  opacity: op,
                }}
              >
                <div className="relative isolate border-l border-[#F7941D]/65 py-2 pl-6 md:pl-8">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-6 -inset-y-20 -z-10 md:hidden"
                    style={{ background: "linear-gradient(to top, rgba(2,22,34,0.94) 12%, rgba(2,22,34,0.70) 58%, transparent 100%)" }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-20 -inset-y-24 -z-10 hidden md:block"
                    style={{
                      background: ann.side === "right"
                        ? "linear-gradient(to left, rgba(2,22,34,0.90) 22%, rgba(2,22,34,0.56) 62%, transparent 100%)"
                        : "linear-gradient(to right, rgba(2,22,34,0.90) 22%, rgba(2,22,34,0.56) 62%, transparent 100%)",
                    }}
                  />
                  <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.24em] text-[#FBB971]">
                    <span className="h-px w-8 bg-[#F7941D]" />
                    {ann.eyebrow}
                  </div>
                  <h3 className="mt-5 max-w-[420px] font-display text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white md:text-[46px]">
                    {ann.title}
                  </h3>
                  <p className="mt-5 max-w-[390px] text-[14px] leading-[1.75] text-white/65 md:text-[15px]">
                    {ann.body}
                  </p>
                </div>
              </div>
            )
          })}

          {/* === CTA strip (final) === */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center px-6"
            style={{ opacity: ctaStripOpacity }}
          >
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
              <Link href={hero.primaryCTA.href}>
                <Button className="rounded-md bg-[#F7941D] px-7 font-semibold text-[#15294B] hover:bg-[#F08C1E]">
                  {hero.primaryCTA.text}
                </Button>
              </Link>
              <Link href={hero.secondaryCTA.href}>
                <Button
                  variant="outline"
                  className="rounded-md border-white/25 bg-transparent text-white hover:border-[#F7941D]/60 hover:text-[#FBB971]"
                >
                  {hero.secondaryCTA.text}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes ci-pulse {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(247,148,29,0.35)); }
          50%      { filter: drop-shadow(0 0 38px rgba(247,148,29,0.75)); }
        }
        @keyframes ci-bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50%      { transform: translateY(6px); opacity: 0.45; }
        }
        @keyframes ci-cta-glow {
          0%, 100% { box-shadow: 0 8px 22px -8px rgba(247,148,29,0.55), 0 0 0 0 rgba(247,148,29,0.0); }
          50%      { box-shadow: 0 14px 36px -10px rgba(247,148,29,0.85), 0 0 0 8px rgba(247,148,29,0.08); }
        }
        @keyframes ci-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ci-line-drop {
          0%   { top: -20%; opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes ci-ember {
          0%   { transform: translate3d(0, 0, 0) scale(0.8); opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.5; }
          100% { transform: translate3d(var(--ex), -90vh, 0) scale(1.1); opacity: 0; }
        }
        @keyframes ci-meta-blink {
          0%, 60%, 100% { opacity: 1; }
          70%, 90%      { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ci-no-motion * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  )
}

/* ============================================================================
 * HeroOverlay — premium editorial hero
 * Asymmetric layout, ghost background word, character stagger entrance,
 * orange shimmer accent, mouse-tracking parallax, mono meta corners,
 * floating embers, modern scroll hint.
 * ========================================================================== */

type HeroData = {
  badge?: string
  title: string
  subtitle: string
  primaryCTA: { text: string; href: string }
  secondaryCTA: { text: string; href: string }
}

function HeroOverlay({ hero, opacity, primed }: { hero: HeroData; opacity: number; primed: boolean }) {
  // Subtle mouse parallax (very restrained)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 50, damping: 22, mass: 0.7 })
  const sy = useSpring(my, { stiffness: 50, damping: 22, mass: 0.7 })
  const px = useTransform(sx, [-1, 1], [-4, 4])
  const py = useTransform(sy, [-1, 1], [-3, 3])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      mx.set((e.clientX / w) * 2 - 1)
      my.set((e.clientY / h) * 2 - 1)
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [mx, my])

  const words = hero.title.split(" ")
  const lastIdx = words.length - 1

  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity }}>
      {/* === Single accent: subtle vertical hairline anchor === */}
      <motion.div
        aria-hidden
        initial={{ scaleY: 0, opacity: 0 }}
        animate={primed ? { scaleY: 1, opacity: 1 } : {}}
        transition={{ delay: 0.25, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-6 top-1/2 hidden h-[140px] w-[1px] origin-top -translate-y-1/2 md:block md:left-12 lg:left-20"
        style={{
          background:
            "linear-gradient(to bottom, transparent, #F7941D 30%, #F7941D 70%, transparent)",
        }}
      />

      {/* === Hero content (bottom-left editorial) === */}
      <motion.div
        className="pointer-events-auto absolute inset-x-0 bottom-[12%] px-6 md:bottom-[14%] md:px-16 lg:px-24"
        style={{ x: px, y: py }}
      >
        <div className="max-w-[860px]">
          {/* Eyebrow — small mono uppercase, replaces the badge */}
          {hero.badge && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={primed ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-7 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[#FBB971]/85"
            >
              <span
                aria-hidden
                className="inline-block h-px w-8 bg-[#F7941D]"
              />
              <span>{hero.badge}</span>
            </motion.div>
          )}

          {/* Headline — confident two-line, line-by-line reveal */}
          <motion.h1
            className="font-display font-semibold text-white"
            style={{
              fontSize: "clamp(38px, 6.4vw, 104px)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              textWrap: "balance" as const,
            }}
          >
            {words.map((word, wi) => {
              const isAccent = wi === lastIdx
              return (
                <motion.span
                  key={wi}
                  className="mr-[0.22em] inline-block"
                  initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                  animate={primed ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                  transition={{
                    delay: 0.5 + wi * 0.09,
                    duration: 0.95,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={
                    isAccent
                      ? {
                          backgroundImage:
                            "linear-gradient(100deg, #F7941D 0%, #F08C1E 45%, #FBB971 70%, #F7941D 100%)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }
                      : undefined
                  }
                >
                  {word}
                </motion.span>
              )
            })}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={primed ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5 + words.length * 0.09 + 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-[520px] text-[15px] leading-[1.65] text-white/75 md:text-[17px]"
          >
            {hero.subtitle}
          </motion.p>

          {/* Hairline divider — editorial polish */}
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={primed ? { scaleX: 1 } : {}}
            transition={{ delay: 0.5 + words.length * 0.09 + 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 h-px w-20 origin-left bg-white/15"
          />

          {/* Single primary CTA + tertiary text link */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={primed ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5 + words.length * 0.09 + 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 flex flex-wrap items-center gap-7"
          >
            <Link href={hero.primaryCTA.href}>
              <Button
                size="lg"
                className="group h-12 rounded-md bg-[#F7941D] px-7 text-[14px] font-semibold tracking-tight text-[#15294B] transition-all hover:-translate-y-[1px] hover:bg-[#F08C1E]"
              >
                {hero.primaryCTA.text}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link
              href={hero.secondaryCTA.href}
              className="group inline-flex items-center gap-2.5 text-[13px] font-medium uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 transition group-hover:border-[#FBB971] group-hover:text-[#FBB971]">
                <Play className="h-3 w-3 translate-x-[1px]" fill="currentColor" />
              </span>
              <span>{hero.secondaryCTA.text}</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* === Tiny scroll indicator (bottom-right) === */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={primed ? { opacity: 1 } : {}}
        transition={{ delay: 1.6, duration: 0.9 }}
        className="absolute bottom-10 right-6 flex flex-col items-center gap-3 md:right-12"
      >
        <div className="relative h-12 w-[1px] overflow-hidden bg-white/10">
          <span
            aria-hidden
            className="absolute inset-x-0 h-3"
            style={{
              background: "linear-gradient(to bottom, transparent, #F7941D 50%, transparent)",
              animation: "ci-line-drop 2.2s ease-in-out infinite",
            }}
          />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">
          scroll
        </span>
      </motion.div>
    </div>
  )
}
