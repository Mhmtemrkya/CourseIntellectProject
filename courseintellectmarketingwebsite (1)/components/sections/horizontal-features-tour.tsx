"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

type PanelData = {
  num: string
  eyebrow: string
  title: string
  body: string
  accent: string // hex
  Visual: React.ComponentType<{ progress: number }>
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

/* ---------------- Visuals (per panel) ---------------- */

function VisualCourseTracking({ progress }: { progress: number }) {
  const days = ["Pzt", "Sal", "Çar", "Per", "Cum"]
  const blocks = [
    { h: 0.55, color: "#D9790B" },
    { h: 0.7, color: "#FBB971" },
    { h: 0.4, color: "#D9790B" },
    { h: 0.85, color: "#FBB971" },
    { h: 0.6, color: "#D9790B" },
  ]
  // Use progress for a "highlight that travels" effect — not for whether bars exist
  const highlightIdx = Math.min(blocks.length - 1, Math.floor(progress * blocks.length))
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-br from-[#0a2535]/85 to-[#021622]/85 backdrop-blur-sm">
        {/* Panel chrome */}
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-white/65">
              <BookOpen className="h-3.5 w-3.5 text-[#D9790B]" />
              Haftalık Plan
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono uppercase tracking-[0.18em]">7. Sınıf</span>
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="relative h-[calc(100%-57px)] px-6 pb-6 pt-6">
          {/* Day axis labels */}
          <div className="absolute inset-x-6 bottom-6 flex justify-between">
            {days.map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`text-[10px] uppercase tracking-[0.18em] ${i === highlightIdx ? "text-[#FBB971]" : "text-white/40"}`}>
                  {d}
                </div>
              </div>
            ))}
          </div>
          {/* Bars — always full height */}
          <div className="absolute inset-x-6 bottom-14 top-4 flex items-end justify-between gap-3">
            {blocks.map((b, i) => {
              const isHi = i === highlightIdx
              return (
                <div key={i} className="flex flex-1 items-end justify-center">
                  <div
                    className="w-full rounded-t-md transition-all duration-400"
                    style={{
                      height: `${b.h * 100}%`,
                      background: isHi
                        ? `linear-gradient(to top, ${b.color}, #FBB971)`
                        : `linear-gradient(to top, ${b.color}88, ${b.color}55)`,
                      boxShadow: isHi ? `0 0 32px ${b.color}88` : `0 0 14px ${b.color}33`,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* Floating notif card — visible from start, subtle hover */}
      <div
        className="absolute -right-4 top-10 w-[210px] rounded-2xl border border-[#D9790B]/30 bg-[#021622]/90 p-4 backdrop-blur-md"
        style={{
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.7), 0 0 30px rgba(217,121,11,0.15)",
          transform: `translateY(${Math.sin(progress * 4) * 4}px)`,
        }}
      >
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[#FBB971]">
          <CheckCircle2 className="h-3 w-3" />
          Tamamlandı
        </div>
        <div className="mt-2 text-[13px] font-medium text-white">Matematik · Konu 4.2</div>
        <div className="mt-1 text-[11px] text-white/60">28 / 30 öğrenci</div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#D9790B] to-[#FBB971]" style={{ width: "93%" }} />
        </div>
      </div>
    </div>
  )
}

function VisualNotifications({ progress }: { progress: number }) {
  const cards = [
    { x: 4, y: 14, icon: Bell, title: "Sınav hatırlatıcı", body: "Matematik · 14:30", color: "#D9790B" },
    { x: 70, y: 28, icon: Calendar, title: "Etkinlik", body: "Veli toplantısı yarın", color: "#FBB971" },
    { x: 8, y: 64, icon: CheckCircle2, title: "Ödev tamam", body: "Fizik · Bölüm 3", color: "#5499c7" },
    { x: 62, y: 70, icon: Bell, title: "Yeni mesaj", body: "Ahmet öğretmen", color: "#D9790B" },
  ]
  // Progress drives which card pulses
  const activeCard = Math.min(cards.length - 1, Math.floor(progress * cards.length))
  return (
    <div className="relative h-full w-full">
      {/* Center pulse — always visible */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="grid h-28 w-28 place-items-center rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(217,121,11,0.45) 0%, rgba(217,121,11,0.1) 55%, transparent 100%)",
          }}
        >
          <div
            className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#D9790B] to-[#F08C1E]"
            style={{ boxShadow: "0 0 50px rgba(217,121,11,0.7), inset 0 -2px 8px rgba(0,0,0,0.25)" }}
          >
            <Bell className="h-7 w-7 text-[#021622]" />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D9790B]/45"
            style={{ animation: `ci-pulse-ring 2.6s ease-out ${i * 0.65}s infinite` }}
          />
        ))}
      </div>

      {/* Connecting lines from center to each card */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
        {cards.map((c, i) => {
          const x1 = "50%"
          const y1 = "50%"
          const x2 = `${c.x + 12}%`
          const y2 = `${c.y + 8}%`
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(217,121,11,0.18)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          )
        })}
      </svg>

      {/* Notification cards — all visible from start */}
      {cards.map((c, i) => {
        const Icon = c.icon
        const isActive = i === activeCard
        return (
          <div
            key={i}
            className="absolute w-[210px] rounded-2xl border bg-[#021622]/90 p-3.5 backdrop-blur-md transition-all duration-500"
            style={{
              top: `${c.y}%`,
              left: `${c.x}%`,
              borderColor: isActive ? `${c.color}80` : "rgba(255,255,255,0.08)",
              boxShadow: isActive
                ? `0 20px 50px -10px rgba(0,0,0,0.7), 0 0 36px ${c.color}66`
                : "0 18px 40px -12px rgba(0,0,0,0.5)",
              transform: isActive ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="grid h-9 w-9 place-items-center rounded-lg"
                style={{ background: `${c.color}22` }}
              >
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-white">{c.title}</div>
                <div className="text-[11px] text-white/55 truncate">{c.body}</div>
              </div>
              {isActive && (
                <span
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VisualReports({ progress }: { progress: number }) {
  const bars = [44, 62, 38, 78, 55, 84, 72, 60, 88]
  // Highlighted bar travels with progress
  const hiIdx = Math.min(bars.length - 1, Math.floor(progress * bars.length))
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-br from-[#0a2535]/85 to-[#021622]/85 backdrop-blur-sm">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-white/65">
              <BarChart3 className="h-3.5 w-3.5 text-[#D9790B]" />
              Sınıf Performansı · 7. Sınıf
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              +12%
            </div>
          </div>
        </div>
        {/* KPI Row */}
        <div className="grid grid-cols-3 border-b border-white/[0.06]">
          {[
            { k: "Ortalama", v: "84.2" },
            { k: "Devam", v: "%96" },
            { k: "Ödev", v: "92%" },
          ].map((kpi, i) => (
            <div key={i} className="border-l border-white/[0.06] px-5 py-4 first:border-l-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{kpi.k}</div>
              <div className="mt-1 font-mono text-[22px] font-medium text-white tabular-nums">{kpi.v}</div>
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="relative px-6 pb-6 pt-6">
          {/* Grid lines */}
          <div className="absolute inset-x-6 bottom-12 top-6 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-px w-full bg-white/[0.04]" />
            ))}
          </div>
          {/* Bars — always full height */}
          <div className="relative flex h-44 items-end justify-between gap-2">
            {bars.map((b, i) => {
              const isHi = i === hiIdx
              return (
                <div key={i} className="relative flex flex-1 justify-center">
                  <div
                    className="w-full rounded-t-md transition-all duration-400"
                    style={{
                      height: `${b}%`,
                      background: isHi
                        ? "linear-gradient(to top, #D9790B, #FBB971)"
                        : "linear-gradient(to top, rgba(217,121,11,0.5), rgba(251,185,113,0.4))",
                      boxShadow: isHi ? "0 0 28px rgba(217,121,11,0.6)" : "none",
                    }}
                  />
                  {isHi && (
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-[#D9790B]/40 bg-[#021622] px-2 py-0.5 font-mono text-[10px] text-[#FBB971]"
                      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
                    >
                      {b}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Trend line overlay — always drawn */}
          <svg
            className="absolute inset-x-6 bottom-12 h-44 pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polyline
              points="5,56 16,38 27,62 38,22 49,45 60,16 71,28 82,40 93,12"
              fill="none"
              stroke="#FBB971"
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
            <circle cx={5 + hiIdx * 11} cy={[56, 38, 62, 22, 45, 16, 28, 40, 12][hiIdx]} r="1.6" fill="#FBB971" />
          </svg>
        </div>
        {/* Bottom caption */}
        <div className="absolute inset-x-6 bottom-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-white/40">
          <span>Eki — Şub</span>
          <span>Hedef · 80%</span>
        </div>
      </div>
    </div>
  )
}

function VisualParentPortal({ progress }: { progress: number }) {
  // Items always visible; progress drives which item is highlighted
  const items = [
    { label: "Matematik · Sınav", v: "94", color: "#FBB971" },
    { label: "Fizik · Ödev", v: "✓", color: "#D9790B" },
    { label: "Türkçe · Devam", v: "✓", color: "#5499c7" },
    { label: "Kimya · Rapor", v: "📈", color: "#FBB971" },
  ]
  const hiItem = Math.min(items.length - 1, Math.floor(progress * items.length))
  return (
    <div className="relative h-full w-full">
      {/* Phone frame */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative h-[460px] w-[240px] rounded-[40px] border border-white/[0.12] bg-[#021622]"
          style={{
            boxShadow:
              "0 36px 70px -20px rgba(0,0,0,0.75), inset 0 0 1px rgba(255,255,255,0.1), 0 0 90px rgba(217,121,11,0.18)",
            transform: `perspective(1100px) rotateY(-9deg) rotateX(3deg) translateY(${Math.sin(progress * 4) * 4}px)`,
          }}
        >
          {/* Notch */}
          <div className="absolute left-1/2 top-3 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/15" />
          {/* Screen */}
          <div className="absolute inset-3 overflow-hidden rounded-[32px] bg-gradient-to-b from-[#0a2535] to-[#021622] p-4">
            {/* Header */}
            <div className="flex items-center justify-between text-[9px] text-white/55">
              <span className="font-mono">09:41</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-[#D9790B]" />
                <span className="text-[8px] uppercase tracking-[0.15em]">Veli</span>
              </span>
            </div>
            {/* Greeting */}
            <div className="mt-4">
              <div className="text-[10px] text-white/45">Merhaba Sayın Veli,</div>
              <div className="text-[16px] font-semibold text-white">Selin&apos;in günü</div>
            </div>
            {/* Stat card — always visible */}
            <div
              className="mt-4 rounded-2xl border border-[#D9790B]/35 bg-gradient-to-br from-[#D9790B]/18 to-[#D9790B]/5 p-4"
              style={{ boxShadow: "0 0 24px rgba(217,121,11,0.15)" }}
            >
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#FBB971]">Bugün · 5 Mart</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[28px] font-semibold text-white tabular-nums">5</span>
                <span className="text-[11px] text-white/65">ders · hepsi tamam</span>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full bg-[#D9790B]"
                    style={{ opacity: 0.85 }}
                  />
                ))}
              </div>
            </div>
            {/* Items — always visible, highlighted active */}
            <div className="mt-4 space-y-2">
              {items.map((item, i) => {
                const isHi = i === hiItem
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border bg-white/[0.025] px-3 py-2.5 transition-all duration-300"
                    style={{
                      borderColor: isHi ? `${item.color}66` : "rgba(255,255,255,0.06)",
                      background: isHi ? `${item.color}12` : "rgba(255,255,255,0.025)",
                      transform: isHi ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: item.color,
                          boxShadow: isHi ? `0 0 8px ${item.color}` : "none",
                        }}
                      />
                      <span className="text-[11px] text-white/80">{item.label}</span>
                    </div>
                    <span className="font-mono text-[12px]" style={{ color: item.color }}>{item.v}</span>
                  </div>
                )
              })}
            </div>
            {/* Bottom nav hint */}
            <div className="absolute inset-x-3 bottom-3 flex justify-around rounded-2xl border border-white/[0.06] bg-white/[0.03] py-2.5">
              {[Bell, Calendar, BookOpen, Users].map((Icon, i) => (
                <Icon key={i} className={`h-3.5 w-3.5 ${i === 0 ? "text-[#FBB971]" : "text-white/40"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Panel data ---------------- */

const PANELS: PanelData[] = [
  {
    num: "01",
    eyebrow: "Ders Takibi",
    title: "Her dersin nabzını tut.",
    body: "Müfredat, konu ve kazanım haritası tek panoda. Öğrenci ilerlemesi otomatik kayıt altında — sen yorumuna odaklan.",
    accent: "#D9790B",
    Visual: VisualCourseTracking,
  },
  {
    num: "02",
    eyebrow: "Anlık Bildirimler",
    title: "Doğru kişiye, doğru anda.",
    body: "Önemli olan öğretmene, öğrenciye ve veliye aynı anda — kanal seçimi otomatik. Bildirim yorgunluğu yok.",
    accent: "#FBB971",
    Visual: VisualNotifications,
  },
  {
    num: "03",
    eyebrow: "Detaylı Raporlar",
    title: "Veriyle karar ver.",
    body: "Sınıf, kurum, şube — her seviyede analiz. PDF dışa aktarım, özelleştirilebilir panolar, eğilim grafikleri.",
    accent: "#D9790B",
    Visual: VisualReports,
  },
  {
    num: "04",
    eyebrow: "Veli Portalı",
    title: "Aile, sınıfa dahil.",
    body: "Veliler çocuğunun gününü saniyesine kadar görür. Mesaj, görüşme talebi, ilerleme — tek dokunuşla.",
    accent: "#FBB971",
    Visual: VisualParentPortal,
  },
]

/* ---------------- Main horizontal scroll component ---------------- */

export function HorizontalFeaturesTour() {
  const sectionRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)

  const update = useCallback(() => {
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const scrollable = el.offsetHeight - window.innerHeight
    const p = clamp(-rect.top / scrollable)
    setProgress(p)
  }, [])

  useEffect(() => {
    update()
    const onScroll = () => update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [update])

  // Active panel index (0..3)
  const activeIdx = Math.min(PANELS.length - 1, Math.floor(progress * PANELS.length))
  // Local progress within active panel (0..1)
  const localProgress = clamp(progress * PANELS.length - activeIdx)
  const translateX = -progress * (PANELS.length - 1) * 100 // in vw

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#021622]"
      style={{ height: `${PANELS.length * 100}vh` }}
      data-section="cinematic-features"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Background ambient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, rgba(217,121,11,0.08), transparent 45%), radial-gradient(circle at 80% 70%, rgba(0,53,79,0.5), transparent 55%)",
          }}
        />

        {/* Section eyebrow + progress (top-fixed within sticky) */}
        <div className="absolute inset-x-0 top-0 z-20 px-6 pt-28 md:px-12 lg:px-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[#FBB971]/85">
                <span aria-hidden className="inline-block h-px w-8 bg-[#D9790B]" />
                <span>Özellikler · Tur</span>
              </div>
              <div className="mt-2 font-display text-[14px] text-white/65">
                Yatay scroll ile gez — her durakta bir yeteneği gör.
              </div>
            </div>
            {/* Step dots */}
            <div className="hidden items-center gap-2 md:flex">
              {PANELS.map((p, i) => {
                const isActive = i === activeIdx
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.25em] transition-colors"
                      style={{ color: isActive ? "#FBB971" : "rgba(255,255,255,0.35)" }}
                    >
                      {p.num}
                    </span>
                    {i < PANELS.length - 1 && (
                      <span
                        className="h-px w-8 rounded-full bg-white/15"
                        style={{
                          background: i < activeIdx ? "#D9790B" : "rgba(255,255,255,0.12)",
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Panels (translateX) */}
        <div
          className="flex h-full"
          style={{
            width: `${PANELS.length * 100}vw`,
            transform: `translate3d(${translateX}vw, 0, 0)`,
            willChange: "transform",
          }}
        >
          {PANELS.map((p, i) => {
            const isActive = i === activeIdx
            const localP = isActive ? localProgress : i < activeIdx ? 1 : 0
            return (
              <div
                key={p.num}
                className="grid h-full w-screen shrink-0 items-center px-6 md:grid-cols-12 md:gap-8 md:px-16 lg:px-24"
              >
                {/* Content */}
                <div className="md:col-span-5">
                  {/* Big number ghost */}
                  <div
                    className="font-display font-bold leading-none text-white/[0.05] select-none"
                    style={{
                      fontSize: "clamp(140px, 18vw, 280px)",
                      letterSpacing: "-0.06em",
                      marginBottom: "-0.4em",
                      transform: `translateX(${(1 - localP) * -20}px)`,
                      opacity: 0.06 + localP * 0.04,
                    }}
                  >
                    {p.num}
                  </div>
                  <div className="relative">
                    {/* Eyebrow */}
                    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: p.accent }}>
                      <span aria-hidden className="inline-block h-px w-8" style={{ background: p.accent }} />
                      <span>{p.num} · {p.eyebrow}</span>
                    </div>
                    {/* Title */}
                    <h3
                      className="mt-6 font-display font-semibold text-white"
                      style={{
                        fontSize: "clamp(32px, 4.4vw, 64px)",
                        lineHeight: 1.05,
                        letterSpacing: "-0.025em",
                      }}
                    >
                      {p.title}
                    </h3>
                    {/* Body */}
                    <p className="mt-6 max-w-md text-[15px] leading-[1.65] text-white/65 md:text-[17px]">
                      {p.body}
                    </p>
                    {/* Inline detail meta */}
                    <div className="mt-8 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.25em] text-white/35">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" style={{ color: p.accent }} />
                        Canlı önizleme
                      </span>
                      <span className="h-px w-6 bg-white/15" />
                      <span>Kaydır → ilerle</span>
                    </div>
                  </div>
                </div>

                {/* Visual */}
                <div className="md:col-span-7">
                  <div
                    className="relative mx-auto aspect-[4/3] w-full max-w-[680px]"
                    style={{
                      transform: `scale(${0.98 + localP * 0.02})`,
                    }}
                  >
                    <p.Visual progress={localP} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom progress bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-8 md:px-12 lg:px-16">
          <div className="flex items-center gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
              {String(activeIdx + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
            </div>
            <div className="relative h-px flex-1 overflow-hidden bg-white/10">
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(to right, #D9790B, #FBB971)",
                  boxShadow: "0 0 12px rgba(217,121,11,0.6)",
                }}
              />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
              {Math.round(progress * 100)}%
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes ci-pulse-ring {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
      `}</style>
    </section>
  )
}
