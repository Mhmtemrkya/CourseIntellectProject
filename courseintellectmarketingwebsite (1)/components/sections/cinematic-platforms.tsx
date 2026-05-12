"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Monitor, Smartphone, ShieldCheck, Zap } from "lucide-react"

const ThreeDScene = dynamic(() => import("./three-d-platform-scene"), {
  ssr: false,
  loading: () => null,
})

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

const SPECS = [
  { icon: Monitor, k: "Masaüstü", v: "Windows · macOS" },
  { icon: Smartphone, k: "Mobil", v: "iOS · Android" },
  { icon: ShieldCheck, k: "Güvenlik", v: "KVKK · ISO 27001" },
  { icon: Zap, k: "Hız", v: "< 100 ms gecikme" },
]

export function CinematicPlatforms() {
  const sectionRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)

  const update = useCallback(() => {
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const scrollable = el.offsetHeight - window.innerHeight
    const p = clamp(-rect.top / scrollable)
    setProgress(p)
  }, [])

  useEffect(() => {
    setMounted(true)
    update()
    const onScroll = () => update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [update])

  // Text overlays choreography
  const titleOpacity = clamp(progress * 4)
  const specsOpacity = clamp((progress - 0.25) * 3)
  const ctaOpacity = clamp((progress - 0.55) * 3)

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#021622]"
      style={{ height: "220vh" }}
      data-section="cinematic-platforms"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Ambient bg */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(217,121,11,0.10), transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(0,53,79,0.5), transparent 60%)",
          }}
        />

        {/* 3D scene */}
        <div className="absolute inset-0">
          {mounted && <ThreeDScene progress={progress} />}
        </div>


        {/* Bottom gradient for text readability */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background: "linear-gradient(to top, rgba(2,22,34,0.92), transparent)",
          }}
        />

        {/* === Text overlay === */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-16 md:px-14 lg:px-24 lg:pb-20">
          <div className="grid items-end gap-12 md:grid-cols-12">
            {/* Left: heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={titleOpacity > 0.1 ? { opacity: 1, y: 0 } : { opacity: 0.2, y: 20 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="md:col-span-7"
              style={{ opacity: 0.3 + titleOpacity * 0.7 }}
            >
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[#FBB971]/85">
                <span aria-hidden className="inline-block h-px w-8 bg-[#D9790B]" />
                <span>Platformlar · 3D</span>
              </div>
              <h2
                className="mt-6 max-w-[820px] font-display font-semibold text-white"
                style={{
                  fontSize: "clamp(36px, 5vw, 84px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.03em",
                }}
              >
                Her cihazda <span className="text-[#FBB971]">aynı deneyim.</span>
              </h2>
              <p className="mt-6 max-w-[480px] text-[15px] leading-[1.65] text-white/65 md:text-[17px]">
                Masaüstü gücü, mobil özgürlüğü — tek hesap, tek veri akışı. Cihazlar arası geçişte hiçbir şey kaybolmuyor.
              </p>
            </motion.div>

            {/* Right: specs grid */}
            <motion.div
              initial={false}
              animate={{ opacity: specsOpacity }}
              transition={{ duration: 0.6 }}
              className="md:col-span-5"
            >
              <div className="grid grid-cols-2 gap-3">
                {SPECS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 14 }}
                      animate={specsOpacity > 0.2 ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.05 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D9790B]/15">
                          <Icon className="h-4 w-4 text-[#FBB971]" />
                        </span>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">{s.k}</div>
                          <div className="text-[13px] font-medium text-white">{s.v}</div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* CTA */}
              <motion.div
                initial={false}
                animate={{ opacity: ctaOpacity, y: ctaOpacity > 0.3 ? 0 : 10 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 flex items-center gap-5"
              >
                <Link href="/indir">
                  <button className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#D9790B] px-7 text-[14px] font-semibold tracking-tight text-[#00354F] transition-all hover:-translate-y-[1px] hover:bg-[#F08C1E]">
                    İndir
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
                <Link
                  href="/ozellikler"
                  className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/60 underline-offset-4 transition hover:text-white hover:underline"
                >
                  Tüm özellikler
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Top eyebrow corner */}
        <div className="absolute left-6 top-28 z-10 font-mono text-[10px] uppercase tracking-[0.32em] text-white/40 md:left-14 lg:left-24">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1 w-1 rounded-full bg-[#D9790B]"
              style={{ boxShadow: "0 0 6px #D9790B" }}
            />
            <span>3D · Gerçek zamanlı render</span>
          </div>
        </div>
      </div>
    </section>
  )
}
