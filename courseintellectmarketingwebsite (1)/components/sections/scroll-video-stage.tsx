"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"

type FrameManifest = {
  fps: number
  width: number
  videos: { dir: string; count: number; duration: number }[]
}

const MANIFEST_URL = "/frames/manifest.json"
const FRAMES_BASE = "/frames"
const FALLBACK_VIDEO_URL = "/hero-dimensional-portal.mp4"
// Extracted frames are not included in the static deployment; use the bundled video.
const FRAME_SEQUENCE_ENABLED = false
const PRIMING_BATCH = 24 // first batch to load before dismissing loader (1 second of video)

const ANNOTATIONS = [
  {
    at: [0.18, 0.32] as const,
    eyebrow: "01 / Bilgi evreni",
    title: "Hepsi tek platformda",
    body: "Öğretmen, öğrenci, veli — üçünün de ihtiyacı aynı ekosistemde buluşuyor.",
    side: "right" as const,
  },
  {
    at: [0.45, 0.6] as const,
    eyebrow: "02 / Entegre deneyim",
    title: "Veriniz hep birbirine bağlı",
    body: "Ders, ödev, sınav, rapor, bildirim — hiçbir adım tekrar etmiyor.",
    side: "left" as const,
  },
  {
    at: [0.7, 0.85] as const,
    eyebrow: "03 / Ölçeklenebilir",
    title: "Tek kurum, binlerce kullanıcı",
    body: "Türkiye sunucularında KVKK uyumlu, ISO 27001 sertifikalı altyapı.",
    side: "right" as const,
  },
]

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function fadeRange(p: number, start: number, end: number, fade = 0.04) {
  if (p < start - fade || p > end + fade) return 0
  if (p < start) return clamp((p - (start - fade)) / fade)
  if (p > end) return clamp(1 - (p - end) / fade)
  return 1
}

function buildFrameUrls(manifest: FrameManifest): string[] {
  const urls: string[] = []
  for (const v of manifest.videos) {
    for (let i = 1; i <= v.count; i++) {
      const idx = String(i).padStart(4, "0")
      urls.push(`${FRAMES_BASE}/${v.dir}/frame_${idx}.jpg`)
    }
  }
  return urls
}

function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.loading = "eager"
    img.crossOrigin = "anonymous"
    const onAbort = () => {
      img.src = ""
      reject(new Error("aborted"))
    }
    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener("abort", onAbort, { once: true })
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed: ${src}`))
    img.src = src
  })
}

export function ScrollVideoStage() {
  const { hero } = useSectionContent("homepage")
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<(HTMLImageElement | null)[]>([])
  const totalFramesRef = useRef(0)
  const targetIdxRef = useRef(0)
  const currentIdxRef = useRef(0)
  const lastDrawnRef = useRef(-1)
  const dprRef = useRef(typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1)

  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(false)
  const [primed, setPrimed] = useState(false)
  const [useFallbackVideo, setUseFallbackVideo] = useState(!FRAME_SEQUENCE_ENABLED)

  // Preload frames (priming batch first, rest in background)
  useEffect(() => {
    if (!FRAME_SEQUENCE_ENABLED) {
      setReady(true)
      return
    }

    let aborted = false
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: "force-cache" })
        if (!res.ok) throw new Error("manifest fetch failed")
        const manifest: FrameManifest = await res.json()
        const urls = buildFrameUrls(manifest)
        totalFramesRef.current = urls.length
        framesRef.current = new Array(urls.length).fill(null)

        // Prime first batch (in order) — so we can show the canvas ASAP
        const primeCount = Math.min(PRIMING_BATCH, urls.length)
        for (let i = 0; i < primeCount; i++) {
          if (aborted) return
          const img = await loadImage(urls[i], ac.signal).catch(() => null)
          if (img) framesRef.current[i] = img
          setLoaded((i + 1) / urls.length)
        }
        if (aborted) return
        setPrimed(true)

        // Background-load the rest, in parallel batches of 8
        const remaining = urls.slice(primeCount)
        let loadedCount = primeCount
        const PARALLEL = 8
        for (let i = 0; i < remaining.length; i += PARALLEL) {
          if (aborted) return
          const slice = remaining.slice(i, i + PARALLEL)
          await Promise.all(
            slice.map(async (url, k) => {
              const idx = primeCount + i + k
              const img = await loadImage(url, ac.signal).catch(() => null)
              if (img) framesRef.current[idx] = img
              loadedCount += 1
              setLoaded(loadedCount / urls.length)
            })
          )
        }
        if (!aborted) setReady(true)
      } catch {
        // The exported site ships an MP4 fallback when extracted frames are absent.
        if (!aborted) {
          setUseFallbackVideo(true)
          setReady(true)
        }
      }
    })()

    // Safety: dismiss loader after 8s no matter what
    const safety = setTimeout(() => {
      if (!aborted && !ready) {
        setPrimed(true)
        setReady(true)
      }
    }, 8000)

    return () => {
      aborted = true
      ac.abort()
      clearTimeout(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Canvas sizing (Retina-aware)
  const sizeCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = dprRef.current
    const w = window.innerWidth
    const h = window.innerHeight
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    lastDrawnRef.current = -1 // force redraw
  }, [])

  useEffect(() => {
    sizeCanvas()
    window.addEventListener("resize", sizeCanvas)
    return () => window.removeEventListener("resize", sizeCanvas)
  }, [sizeCanvas])

  // Draw a frame cover-fit
  const drawFrame = useCallback((idx: number) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const img = framesRef.current[idx]
    if (!img) return
    const cw = c.width
    const ch = c.height
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    if (!iw || !ih) return
    const scale = Math.max(cw / iw, ch / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    ctx.fillStyle = "#021E2E"
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(img, dx, dy, dw, dh)
  }, [])

  // Scroll → target frame index
  const updateScroll = useCallback(() => {
    const sec = sectionRef.current
    if (!sec) return
    const rect = sec.getBoundingClientRect()
    const scrollable = sec.offsetHeight - window.innerHeight
    const scrolled = clamp(-rect.top / scrollable)
    setProgress(scrolled)
    const total = totalFramesRef.current
    if (!total) return
    targetIdxRef.current = Math.round(scrolled * (total - 1))
  }, [])

  // rAF loop: ease current → target, draw frame when changed
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const total = totalFramesRef.current
      if (total > 0) {
        const target = targetIdxRef.current
        // Lerp index for smoothness; snap when close
        const cur = currentIdxRef.current
        const diff = target - cur
        if (Math.abs(diff) < 0.5) {
          currentIdxRef.current = target
        } else {
          currentIdxRef.current = cur + diff * 0.22
        }
        const idx = Math.max(0, Math.min(total - 1, Math.round(currentIdxRef.current)))
        // Find nearest loaded frame (in case of partial preload)
        let drawIdx = idx
        if (!framesRef.current[drawIdx]) {
          for (let off = 1; off < total && off < 30; off++) {
            const a = drawIdx - off
            const b = drawIdx + off
            if (a >= 0 && framesRef.current[a]) {
              drawIdx = a
              break
            }
            if (b < total && framesRef.current[b]) {
              drawIdx = b
              break
            }
          }
        }
        if (drawIdx !== lastDrawnRef.current) {
          drawFrame(drawIdx)
          lastDrawnRef.current = drawIdx
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [drawFrame])

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
  const approachOpacity = fadeRange(progress, 0.34, 0.42, 0.04)
  const ctaStripOpacity = fadeRange(progress, 0.91, 1.0, 0.05)

  return (
    <>
      {/* Loader */}
      <div
        aria-hidden={primed}
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#021E2E] transition-opacity duration-500 ${
          primed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div
          className="h-16 w-16"
          style={{
            filter: "drop-shadow(0 0 26px rgba(217,121,11,0.55))",
            animation: "ci-pulse 2.2s ease-in-out infinite",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="mt-6 text-[11px] uppercase tracking-[0.32em] text-[#8FA4AE]">
          Yükleniyor
        </div>
        <div className="mt-6 h-[2px] w-[220px] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-[#D9790B] via-[#F08C1E] to-[#FBB971] transition-[width] duration-200"
            style={{ width: `${Math.max(loaded, 0.05) * 100}%` }}
          />
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-[#8FA4AE]/70 font-mono tabular-nums">
          {Math.round(loaded * 100)}%
        </div>
      </div>

      {/* Top scroll progress bar */}
      <div
        aria-hidden
        className="fixed left-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#D9790B] via-[#F08C1E] to-[#FBB971]"
        style={{
          width: `${progress * 100}%`,
          boxShadow: "0 0 12px rgba(217,121,11,0.6)",
        }}
      />

      {/* Background-load progress (subtle, after loader dismissed) */}
      {primed && !ready && (
        <div
          aria-hidden
          className="fixed bottom-4 right-4 z-[55] flex items-center gap-2 rounded-full border border-white/10 bg-[#021E2E]/80 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[#8FA4AE] backdrop-blur"
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#D9790B]" />
          {Math.round(loaded * 100)}%
        </div>
      )}

      {/* The big sticky scroll stage */}
      <section
        ref={sectionRef}
        className="relative z-[2] -mt-20 h-[420vh] md:h-[460vh]"
      >
        <div
          className="sticky top-0 h-screen w-full overflow-hidden bg-[#021E2E]"
          style={{ contain: "paint" }}
        >
          {useFallbackVideo && (
            <video
              aria-hidden
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src={FALLBACK_VIDEO_URL}
              onCanPlay={() => {
                setLoaded(1)
                setPrimed(true)
              }}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                filter: "brightness(0.6) saturate(0.95) contrast(1.05)",
              }}
            />
          )}

          {/* Canvas (frame sequence renderer) */}
          <canvas
            ref={canvasRef}
            aria-hidden
            className={`absolute inset-0 h-full w-full ${useFallbackVideo ? "hidden" : ""}`}
            style={{
              filter: "brightness(0.6) saturate(0.95) contrast(1.05)",
              willChange: "contents",
            }}
          />

          {/* Base tint (very subtle, keeps the video readable) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(2,30,46,0.18) 0%, rgba(2,30,46,0.28) 70%, rgba(2,30,46,0.55) 100%)",
            }}
          />

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


          {/* === Overlay 2: APPROACH === */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center px-6"
            style={{ opacity: approachOpacity }}
          >
            <div className="text-center">
              <h2
                className="font-medium tracking-[-0.01em] text-white/90"
                style={{ fontSize: "clamp(26px, 4.8vw, 60px)" }}
              >
                Eğitime yakından bak.
              </h2>
              <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#8FA4AE]">
                Bir portaldan geç
              </div>
            </div>
          </div>

          {/* === Annotation cards === */}
          {ANNOTATIONS.map((ann, i) => {
            const op = fadeRange(progress, ann.at[0], ann.at[1], 0.04)
            return (
              <div
                key={i}
                className={`pointer-events-none absolute bottom-[8%] max-w-[380px] px-6 transition-opacity duration-300 md:bottom-[12%] ${
                  ann.side === "right" ? "right-0 md:right-12" : "left-0 md:left-12"
                }`}
                style={{
                  opacity: op,
                  transform: `translateY(${(1 - op) * 16}px)`,
                }}
              >
                <div
                  className="relative rounded-[20px] border border-[#D9790B]/25 px-7 py-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
                  style={{ background: "rgba(2,30,46,0.62)" }}
                >
                  <span className="absolute left-0 top-5 bottom-5 w-[3px] rounded-full bg-[#D9790B]" />
                  <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-[#FBB971]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D9790B] shadow-[0_0_8px_#D9790B]" />
                    {ann.eyebrow}
                  </div>
                  <h4 className="mt-2.5 text-[19px] font-semibold leading-snug text-white">
                    {ann.title}
                  </h4>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#B8C4CA]">
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
                <Button className="rounded-full bg-[#D9790B] px-7 font-semibold text-[#00354F] hover:bg-[#F08C1E]">
                  Hemen Başla
                </Button>
              </Link>
              <Link href={hero.secondaryCTA.href}>
                <Button
                  variant="outline"
                  className="rounded-full border-white/25 bg-transparent text-white hover:border-[#D9790B]/60 hover:text-[#FBB971]"
                >
                  Demo İzle
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes ci-pulse {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(217,121,11,0.35)); }
          50%      { filter: drop-shadow(0 0 38px rgba(217,121,11,0.75)); }
        }
        @keyframes ci-bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50%      { transform: translateY(6px); opacity: 0.45; }
        }
        @keyframes ci-cta-glow {
          0%, 100% { box-shadow: 0 8px 22px -8px rgba(217,121,11,0.55), 0 0 0 0 rgba(217,121,11,0.0); }
          50%      { box-shadow: 0 14px 36px -10px rgba(217,121,11,0.85), 0 0 0 8px rgba(217,121,11,0.08); }
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
            "linear-gradient(to bottom, transparent, #D9790B 30%, #D9790B 70%, transparent)",
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
                className="inline-block h-px w-8 bg-[#D9790B]"
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
                            "linear-gradient(100deg, #D9790B 0%, #F08C1E 45%, #FBB971 70%, #D9790B 100%)",
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
                className="group h-12 rounded-full bg-[#D9790B] px-7 text-[14px] font-semibold tracking-tight text-[#00354F] transition-all hover:-translate-y-[1px] hover:bg-[#F08C1E]"
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
              background: "linear-gradient(to bottom, transparent, #D9790B 50%, transparent)",
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
