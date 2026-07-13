"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"

export function CTASection() {
  const { finalCTA } = useSectionContent("homepage")
  const { language } = useLanguage()

  return (
    <section className="relative min-h-[680px] overflow-hidden bg-[#061a27] text-white md:min-h-[760px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/product/giris.png"
        alt="SchoolAsist uygulama giriş ekranı"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ filter: "saturate(.9) contrast(1.03)" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,26,39,.98)_0%,rgba(6,26,39,.91)_46%,rgba(6,26,39,.42)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#061a27] to-transparent" />

      <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-6 py-24 md:min-h-[760px] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FFB25A]">
            <span className="h-px w-8 bg-[#F7941D]" />
            {language === "tr" ? "SchoolAsist ile başlayın" : "Start with SchoolAsist"}
          </div>
          <h2 className="mt-6 text-4xl font-semibold leading-[1.02] md:text-6xl lg:text-7xl">{finalCTA.title}</h2>
          <p className="mt-7 max-w-xl text-base leading-8 text-white/68 md:text-lg">{finalCTA.subtitle}</p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={finalCTA.primaryCTA.href}
              className="group inline-flex h-12 items-center justify-center gap-3 rounded-md bg-[#F7941D] px-7 text-sm font-bold text-[#15294B] transition hover:bg-[#FFB25A]"
            >
              {finalCTA.primaryCTA.text}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={finalCTA.secondaryCTA.href}
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/24 px-7 text-sm font-semibold text-white transition hover:border-white/55 hover:bg-white/8"
            >
              {finalCTA.secondaryCTA.text}
            </Link>
          </div>

          <div className="mt-9 flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            {language === "tr" ? "KVKK uyumlu · Rol bazlı erişim · Güvenli veri izolasyonu" : "Privacy compliant · Role-based access · Secure data isolation"}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
