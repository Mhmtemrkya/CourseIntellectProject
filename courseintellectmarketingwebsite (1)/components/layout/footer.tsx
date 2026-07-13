"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  ArrowRight,
  ArrowUpRight,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"

const iconMap: Record<string, React.ElementType> = {
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
}

export function Footer() {
  const footer = useSectionContent("footer")
  const contact = useSectionContent("contact")
  const { language } = useLanguage()
  const copy = language === "tr"
    ? {
        eyebrow: "Kurumunuz için yeni çalışma standardı",
        title: "Eğitimin tüm operasyonu, tek bir akışta.",
        action: "SchoolAsist'i keşfedin",
        contact: "İletişim",
        availability: "Türkiye genelinde kurumlara açık",
      }
    : {
        eyebrow: "A new operating standard for your institution",
        title: "Every education operation, in one connected flow.",
        action: "Explore SchoolAsist",
        contact: "Contact",
        availability: "Available to institutions across Türkiye",
      }
  const visibleSections = footer.sections.map((section) => ({
    ...section,
    title: section.title === "Destek" ? (language === "tr" ? "Kaynaklar" : "Resources") : section.title,
    links: section.links.filter((link) => !["/destek", "/yardim"].includes(link.href)),
  }))

  return (
    <footer id="schoolasist-footer" className="relative overflow-hidden bg-[#061a27] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(to bottom, black, transparent 72%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-10 border-b border-white/10 py-16 md:grid-cols-12 md:items-end md:py-20"
        >
          <div className="md:col-span-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FFB25A]">
              <span className="h-px w-8 bg-[#F7941D]" />
              {copy.eyebrow}
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.08] md:text-5xl">
              {copy.title}
            </h2>
          </div>
          <div className="md:col-span-4 md:flex md:justify-end">
            <Link
              href="/indir"
              className="group inline-flex h-12 items-center gap-3 rounded-md bg-[#F7941D] px-6 text-sm font-bold text-[#15294B] transition hover:bg-[#FFB25A]"
            >
              {copy.action}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>

        <div className="grid gap-12 py-14 md:grid-cols-12 md:py-16">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="SchoolAsist ana sayfa">
              <Image src="/images/logo.png" alt="SchoolAsist" width={46} height={46} className="h-11 w-11 object-contain" />
              <span className="text-xl font-extrabold">
                School<span className="text-[#F7941D]">Asist</span>
              </span>
            </Link>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/58">{footer.description}</p>
            <div className="mt-7 flex items-center gap-3 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              {copy.availability}
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
            {visibleSections.map((section) => (
              <div key={section.id}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">{section.title}</h3>
                <ul className="mt-5 space-y-3.5">
                  {section.links.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={link.href}
                        className="group inline-flex items-center gap-1.5 text-sm text-white/68 transition hover:text-white"
                      >
                        {link.label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 border-t border-white/10 py-8 lg:grid-cols-12 lg:items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/55 lg:col-span-7">
            <a href={`mailto:${contact.info.email}`} className="inline-flex items-center gap-2 transition hover:text-white">
              <Mail className="h-3.5 w-3.5 text-[#F7941D]" />
              {contact.info.email}
            </a>
            <a href={`tel:${contact.info.phone}`} className="inline-flex items-center gap-2 transition hover:text-white">
              <Phone className="h-3.5 w-3.5 text-[#F7941D]" />
              {contact.info.phone}
            </a>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-[#F7941D]" />
              {contact.info.address}
            </span>
          </div>
          <div className="flex items-center gap-2 lg:col-span-5 lg:justify-end">
            <span className="mr-2 text-xs text-white/38">{copy.contact}</span>
            {footer.socialLinks.map((social) => {
              const Icon = iconMap[social.icon] || Twitter
              return (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-white/55 transition hover:border-[#F7941D]/60 hover:text-[#FFB25A]"
                  aria-label={social.platform}
                >
                  <Icon className="h-4 w-4" />
                </a>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.copyright}</p>
          <div className="flex gap-6">
            {footer.legalLinks.map((link) => (
              <Link key={link.id} href={link.href} className="transition hover:text-white/75">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
