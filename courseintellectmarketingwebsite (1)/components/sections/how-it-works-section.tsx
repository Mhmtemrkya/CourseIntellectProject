"use client"

import { motion } from "framer-motion"
import { Building2, Check, Rocket, UsersRound } from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"

const icons = [Building2, UsersRound, Rocket]

export function HowItWorksSection() {
  const { howItWorks } = useSectionContent("homepage")
  const { language } = useLanguage()

  return (
    <section className="relative overflow-hidden bg-[#f6f8fa] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            className="lg:col-span-8"
          >
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d26d00]">
              <span className="h-px w-8 bg-[#F7941D]" />
              {language === "tr" ? "Kurulum / 01-03" : "Onboarding / 01-03"}
            </div>
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] text-[#061a27] md:text-6xl">
              {howItWorks.sectionTitle}
            </h2>
          </motion.div>
          <p className="max-w-md text-base leading-7 text-[#53636d] lg:col-span-4 lg:justify-self-end">
            {howItWorks.sectionSubtitle}. SchoolAsist ekibi veri aktarımı ve ilk yapılandırmada kurumunuzun yanında olur.
          </p>
        </div>

        <div className="relative mt-16 grid gap-5 md:grid-cols-3 md:gap-0">
          <div aria-hidden className="absolute left-[16.66%] right-[16.66%] top-10 hidden h-px bg-[#d6dde2] md:block" />
          {howItWorks.steps.map((step, index) => {
            const Icon = icons[index] ?? Check
            return (
              <motion.article
                key={step.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: index * 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="relative border border-[#dfe5e9] bg-white p-7 md:min-h-[270px] md:border-r-0 md:p-8 md:last:border-r"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <span className="grid h-20 w-20 place-items-center rounded-full border border-[#dfe5e9] bg-white shadow-[0_12px_28px_-20px_rgba(6,26,39,.35)]">
                    <Icon className="h-6 w-6 text-[#F7941D]" />
                  </span>
                  <span className="font-mono text-xs text-[#91a0a9]">0{step.step}</span>
                </div>
                <h3 className="mt-8 text-xl font-semibold text-[#061a27]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5d6c75]">{step.description}</p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
