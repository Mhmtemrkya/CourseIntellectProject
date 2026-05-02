"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import { useSectionContent } from "@/context/content-context"

function useCountUp(target: number, active: boolean, durationMs = 2200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs)
      const eased = 1 - Math.pow(1 - p, 5)
      setVal(Math.floor(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, durationMs])
  return val
}

function formatTR(n: number) {
  return n.toLocaleString("tr-TR")
}

export function CinematicStats() {
  const { stats } = useSectionContent("homepage")
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-30%" })

  return (
    <section ref={ref} className="relative bg-[#021622] py-32 md:py-44 overflow-hidden">
      {/* Subtle starscape — minimal */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 24%, rgba(217,121,11,0.08), transparent 38%), radial-gradient(circle at 82% 76%, rgba(0,53,79,0.7), transparent 50%)",
        }}
      />

      {/* Hairline grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(216,121,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(216,121,11,1) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          backgroundPosition: "center center",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        {/* Eyebrow + headline */}
        <div className="mb-20 flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between md:gap-20 md:mb-28">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-25%" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[#FBB971]/85"
            >
              <span aria-hidden className="inline-block h-px w-8 bg-[#D9790B]" />
              <span>Rakamlar · Konuşur</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-25%" }}
              transition={{ delay: 0.15, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-[780px] font-display font-semibold text-white"
              style={{
                fontSize: "clamp(34px, 4.6vw, 72px)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
              }}
            >
              Türkiye genelinde binlerce kuruma <span className="text-[#FBB971]">eşlik ediyoruz</span>.
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-25%" }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="max-w-xs text-[14px] leading-relaxed text-white/60"
          >
            Her sayı, bir derste, bir öğrencide, bir velinin gözünde karşılığını buluyor — ve büyümeye devam ediyor.
          </motion.p>
        </div>

        {/* Architectural number grid — 2x2 on most viewports for breathing room */}
        <div className="grid grid-cols-1 gap-y-16 sm:grid-cols-2 sm:gap-x-12 md:gap-x-16 md:gap-y-24 xl:grid-cols-4 xl:gap-x-10">
          {stats.map((s, i) => (
            <StatBlock
              key={s.id}
              index={i + 1}
              total={stats.length}
              value={s.value}
              suffix={s.suffix || ""}
              label={s.label}
              active={inView}
              delay={0.15 * i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatBlock({
  index,
  total,
  value,
  suffix,
  label,
  active,
  delay,
}: {
  index: number
  total: number
  value: number
  suffix: string
  label: string
  active: boolean
  delay: number
}) {
  const animated = useCountUp(value, active, 2200)
  const display = formatTR(animated)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="group relative min-w-0"
    >
      {/* Index marker */}
      <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
        <span>{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span
          className="inline-block h-1 w-1 rounded-full bg-[#D9790B]"
          style={{ boxShadow: "0 0 6px #D9790B" }}
        />
      </div>

      {/* Big number — sized to fit any column without overflow */}
      <div className="font-display font-semibold leading-none tabular-nums text-white">
        <div
          className="flex items-baseline whitespace-nowrap"
          style={{
            fontSize: "clamp(38px, 4.6vw, 78px)",
            letterSpacing: "-0.045em",
            textShadow: active ? "0 0 36px rgba(217,121,11,0.18)" : "none",
            transition: "text-shadow 600ms ease",
          }}
        >
          <span>{display}</span>
          <span
            className="ml-1 font-medium text-[#FBB971]"
            style={{ fontSize: "0.45em" }}
          >
            {suffix}
          </span>
        </div>
      </div>

      {/* Divider */}
      <motion.div
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={active ? { scaleX: 1 } : {}}
        transition={{ delay: delay + 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="my-5 h-px w-12 origin-left bg-[#D9790B]/70"
      />

      {/* Label */}
      <div className="text-[13px] uppercase tracking-[0.18em] text-white/65 md:text-[14px]">
        {label}
      </div>
    </motion.div>
  )
}
