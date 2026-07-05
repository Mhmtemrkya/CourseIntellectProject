"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { ArrowRight, BarChart3, BellRing, BookOpen, HeartHandshake, QrCode, ShieldAlert } from "lucide-react"
import { useLanguage } from "@/context/language-context"

const COPY = {
  tr: {
    eyebrow: "Rakiplerde olmayan modüller",
    title: "Sadece yönetim değil,",
    titleAccent: "fark yaratan araçlar",
    subtitle:
      "Yoklama ve not defterini herkes yapıyor. SchoolAsist, kurumunuzu bir adım öne taşıyan modüllerle geliyor.",
    modules: [
      {
        name: "Rehberlik Modülü",
        tagline: "Riskli öğrenciyi siz fark etmeden sistem gösterir",
        description:
          "Devamsızlık, sınav ve ödev verilerinden beslenen canlı risk motoru; görüşme kayıtları, veli randevu sistemi, haftalık çalışma programları ve envanterler — hepsi KVKK hassasiyetiyle.",
        image: "/images/product/vaka-merkezi.png",
        bullets: [
          { icon: "shield", text: "Kural tabanlı canlı risk takibi" },
          { icon: "bell", text: "Randevu + takip hatırlatmaları" },
          { icon: "chart", text: "İdareye içerik gizli, sayısal rapor" },
        ],
      },
      {
        name: "Kütüphane Modülü",
        tagline: "Barkodu okut, 5 saniyede ödünç ver",
        description:
          "ISBN barkodu taramayla kitap ekleme, kopya ve limit takibi, rezervasyon kuyruğu, öğrenci-veliye otomatik iade hatırlatmaları ve sınıflar arası okuma ligi.",
        image: "/images/product/kutuphane.png",
        bullets: [
          { icon: "qr", text: "Mobil barkod taramayla katalog" },
          { icon: "bell", text: "Öğrenci + veliye iade bildirimi" },
          { icon: "chart", text: "Okuma ligi ve kategori analizi" },
        ],
      },
      {
        name: "Tek Platform, 7 Rol",
        tagline: "Yönetici, öğretmen, öğrenci, veli, muhasebe, rehberlik, yemekhane",
        description:
          "Her rol kendi paneline girer, yalnız kendi verisini görür. Masaüstü uygulaması ve mobil uygulama aynı canlı veriyi paylaşır — çifte kayıt yok.",
        image: "/images/product/giris.png",
        bullets: [
          { icon: "shield", text: "Rol bazlı yetki ve veri izolasyonu" },
          { icon: "book", text: "Masaüstü + iOS + Android" },
          { icon: "chart", text: "Gerçek zamanlı senkron veri" },
        ],
      },
    ],
    cta: "Tüm özellikleri incele",
  },
  en: {
    eyebrow: "Modules competitors don't have",
    title: "Not just management,",
    titleAccent: "tools that set you apart",
    subtitle:
      "Everyone does attendance and grade books. SchoolAsist ships with modules that move your institution ahead.",
    modules: [
      {
        name: "Guidance Module",
        tagline: "The system flags at-risk students before you notice",
        description:
          "A live risk engine fed by attendance, exam and homework data; counseling records, parent appointments, weekly study plans and inventories — all with strict privacy rules.",
        image: "/images/product/vaka-merkezi.png",
        bullets: [
          { icon: "shield", text: "Rule-based live risk tracking" },
          { icon: "bell", text: "Appointments + follow-up reminders" },
          { icon: "chart", text: "Numbers-only reports for management" },
        ],
      },
      {
        name: "Library Module",
        tagline: "Scan the barcode, lend in 5 seconds",
        description:
          "Add books by scanning ISBN barcodes, track copies and limits, reservation queues, automatic return reminders to students and parents, and a reading league.",
        image: "/images/product/kutuphane.png",
        bullets: [
          { icon: "qr", text: "Mobile barcode cataloguing" },
          { icon: "bell", text: "Return alerts to student + parent" },
          { icon: "chart", text: "Reading league & category analytics" },
        ],
      },
      {
        name: "One Platform, 7 Roles",
        tagline: "Admin, teacher, student, parent, accounting, counselor, cafeteria",
        description:
          "Each role gets its own panel and sees only its own data. The desktop and mobile apps share the same live data — no double entry.",
        image: "/images/product/giris.png",
        bullets: [
          { icon: "shield", text: "Role-based access & data isolation" },
          { icon: "book", text: "Desktop + iOS + Android" },
          { icon: "chart", text: "Real-time synced data" },
        ],
      },
    ],
    cta: "Explore all features",
  },
}

const ICONS: Record<string, typeof ShieldAlert> = {
  shield: ShieldAlert,
  bell: BellRing,
  chart: BarChart3,
  qr: QrCode,
  book: BookOpen,
}

function ModuleCard({
  module,
  index,
}: {
  module: (typeof COPY)["tr"]["modules"][number]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const reversed = index % 2 === 1

  return (
    <div
      ref={ref}
      className={`grid items-center gap-10 lg:grid-cols-2 ${reversed ? "lg:[direction:rtl]" : ""}`}
    >
      {/* Metin */}
      <motion.div
        initial={{ opacity: 0, x: reversed ? 40 : -40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="lg:[direction:ltr]"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
          {index === 0 ? <HeartHandshake className="h-4 w-4" /> : index === 1 ? <BookOpen className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {module.name}
        </div>
        <h3 className="text-2xl font-bold text-primary md:text-3xl">{module.tagline}</h3>
        <p className="mt-4 leading-relaxed text-muted-foreground">{module.description}</p>
        <ul className="mt-6 space-y-3">
          {module.bullets.map((bullet, bulletIndex) => {
            const Icon = ICONS[bullet.icon] ?? ShieldAlert
            return (
              <motion.li
                key={bullet.text}
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.25 + bulletIndex * 0.12, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium text-foreground/85">{bullet.text}</span>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>

      {/* Gerçek ürün görseli */}
      <motion.div
        initial={{ opacity: 0, y: 48, rotateX: 8 }}
        animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -8, transition: { duration: 0.3 } }}
        className="relative lg:[direction:ltr]"
        style={{ perspective: 1200 }}
      >
        {/* Nokta ızgarası dekoru */}
        <div
          aria-hidden
          className="absolute -right-6 -top-6 h-24 w-24 opacity-60"
          style={{
            backgroundImage: "radial-gradient(var(--brand-accent) 2px, transparent 2px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_32px_80px_-24px_rgba(21,41,75,0.35)]">
          <div className="flex items-center gap-1.5 border-b border-primary/5 bg-secondary/60 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <Image
            src={module.image}
            alt={module.name}
            width={1232}
            height={950}
            className="w-full"
          />
        </div>
      </motion.div>
    </div>
  )
}

export function ModulesShowcase() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const headerRef = useRef<HTMLDivElement>(null)
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" })

  return (
    <section className="relative overflow-hidden bg-white py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 24 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-20 max-w-2xl text-center"
        >
          <span className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-accent">
            {copy.eyebrow}
          </span>
          <h2 className="text-3xl font-bold text-primary md:text-5xl">
            {copy.title} <span className="text-accent">{copy.titleAccent}</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{copy.subtitle}</p>
        </motion.div>

        <div className="space-y-24 md:space-y-32">
          {copy.modules.map((module, index) => (
            <ModuleCard key={module.name} module={module} index={index} />
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/ozellikler"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-semibold text-white shadow-lg transition-all hover:shadow-[0_16px_40px_-12px_rgba(21,41,75,0.5)]"
          >
            {copy.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}
