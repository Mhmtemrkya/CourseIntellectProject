"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Check, Network, ShieldCheck } from "lucide-react"
import { useLanguage } from "@/context/language-context"

const roles = ["Kurum", "Şube", "İdari", "Muhasebe", "Rehberlik", "Öğretmen", "Öğrenci", "Veli", "Yemekhane"]

const COPY = {
  tr: {
    eyebrow: "SchoolAsist / Operasyon mimarisi",
    title: "Bir okul otomasyonu değil. Kurumun işletim sistemi.",
    body: "Akademik, finansal ve idari süreçler ayrı araçlarda dağılmaz. Aynı öğrenci, sınıf, şube ve kullanıcı modeli üzerinde birlikte çalışır.",
    cta: "Tüm rol özelliklerini inceleyin",
    signals: [
      { value: "09", label: "rol için ayrı çalışma alanı" },
      { value: "01", label: "ortak ve güvenilir veri modeli" },
      { value: "∞", label: "şube ölçeğinde izole büyüme" },
      { value: "RBAC", label: "modül ve işlem bazlı yetki" },
    ],
  },
  en: {
    eyebrow: "SchoolAsist / Operating architecture",
    title: "Not another school tool. The operating system for your institution.",
    body: "Academic, financial and administrative workflows do not live in disconnected tools. They work on one shared model of students, classes, branches and users.",
    cta: "Explore every role",
    signals: [
      { value: "09", label: "purpose-built role workspaces" },
      { value: "01", label: "shared and trusted data model" },
      { value: "∞", label: "isolated growth across branches" },
      { value: "RBAC", label: "module and action permissions" },
    ],
  },
}

export function CinematicStats() {
  const { language } = useLanguage()
  const copy = COPY[language]

  return (
    <section className="relative overflow-hidden bg-[#f4f7f8] py-24 md:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: "linear-gradient(#dfe5e9 1px, transparent 1px), linear-gradient(90deg, #dfe5e9 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "linear-gradient(to bottom, black, transparent 92%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            className="lg:col-span-8"
          >
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d26d00]">
              <span className="h-px w-8 bg-[#F7941D]" />
              {copy.eyebrow}
            </div>
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] text-[#061a27] md:text-6xl lg:text-7xl">{copy.title}</h2>
          </motion.div>
          <div className="lg:col-span-4">
            <p className="text-base leading-8 text-[#52636d]">{copy.body}</p>
            <Link href="/ozellikler" className="group mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#15294B] hover:text-[#d26d00]">
              {copy.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <div className="mt-16 border border-[#d9e0e4] bg-white shadow-[0_35px_90px_-55px_rgba(6,26,39,.5)]">
          <div className="flex overflow-x-auto border-b border-[#dfe5e9]">
            {roles.map((role, index) => (
              <div key={role} className="flex min-w-max items-center gap-2 border-r border-[#e7ecef] px-4 py-3 text-xs text-[#5d6c75] last:border-r-0">
                <span className={`h-1.5 w-1.5 rounded-full ${index < 2 ? "bg-[#F7941D]" : "bg-emerald-500"}`} />
                {role}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-12">
            <div className="relative min-h-[420px] overflow-hidden border-b border-[#dfe5e9] lg:col-span-9 lg:min-h-[620px] lg:border-b-0 lg:border-r">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/product/vaka-merkezi.png" alt="SchoolAsist kurum operasyon paneli" className="absolute inset-0 h-full w-full object-cover object-left-top" loading="lazy" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061a27]/28 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-md border border-white/60 bg-white/88 px-3 py-2 text-xs font-semibold text-[#061a27] shadow-lg backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,.7)]" />
                Canlı kurum görünümü
              </div>
            </div>

            <div className="flex flex-col bg-[#061a27] p-6 text-white lg:col-span-3 lg:p-8">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFB25A]">
                <Network className="h-4 w-4" />
                Veri akışı
              </div>
              <div className="mt-8 space-y-5">
                {["Kurum geneli konsolide görünüm", "Tek tıkla şube bazlı filtre", "Rol ve işlem düzeyinde erişim", "Kritik işlemlerde denetim izi"].map((item) => (
                  <div key={item} className="flex items-start gap-3 border-b border-white/10 pb-5 text-sm leading-6 text-white/68 last:border-b-0">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-8">
                <div className="flex items-center gap-2 text-xs text-white/42">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Şube ve kurum verisi otomatik izole edilir
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid border-x border-b border-[#dfe5e9] bg-white sm:grid-cols-2 lg:grid-cols-4">
          {copy.signals.map((signal, index) => (
            <motion.div
              key={signal.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="border-b border-[#dfe5e9] p-6 sm:border-r lg:border-b-0 lg:p-8 lg:last:border-r-0"
            >
              <div className="font-mono text-3xl font-semibold text-[#061a27]">{signal.value}</div>
              <div className="mt-2 text-xs uppercase leading-5 tracking-[0.13em] text-[#75838b]">{signal.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
