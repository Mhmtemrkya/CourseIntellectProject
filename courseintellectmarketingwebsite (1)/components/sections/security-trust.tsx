"use client"

import { useRef } from "react"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import {
  EyeOff, Fingerprint, KeyRound, Lock, Server, ShieldCheck,
} from "lucide-react"
import { useLanguage } from "@/context/language-context"

const COPY = {
  tr: {
    eyebrow: "Güvenlik & KVKK",
    title: "Veli verisi emanettir.",
    titleAccent: "Öyle koruyoruz.",
    subtitle:
      "Bir eğitim platformu; öğrenci, veli ve finans verisi taşır. SchoolAsist güvenliği pazarlama cümlesi olarak değil, mimari karar olarak ele alır.",
    cards: [
      {
        icon: "key",
        title: "Şifreli oturum saklama",
        text: "Oturum anahtarları mobilde iOS Keychain / Android Keystore'da, masaüstünde işletim sistemi anahtar zincirine bağlı AES-GCM şifrelemesiyle tutulur.",
      },
      {
        icon: "eyeoff",
        title: "Rehberlik notu gizliliği",
        text: "Rehberlik görüşme notlarını kurum yöneticisi bile göremez; idareye yalnız sayısal özet gider. Gizlilik seviyesini rehber belirler.",
      },
      {
        icon: "fingerprint",
        title: "Rol bazlı veri izolasyonu",
        text: "7 rolün her biri yalnız kendi verisine erişir; kurumlar arası veri tam izole edilir (çok kiracılı mimari, sorgu düzeyinde filtre).",
      },
      {
        icon: "lock",
        title: "Sıkı içerik politikası",
        text: "Masaüstü uygulaması sıkı CSP ile çalışır: yalnız bilinen sunucularla konuşur, üçüncü taraf servislere veri sızdırmaz — QR kodlar bile cihazda üretilir.",
      },
      {
        icon: "server",
        title: "Türkiye'de barındırma",
        text: "Veriler KVKK kapsamında, yedekli altyapıda saklanır. Yedekten dönüşte bile oturum anahtarları taşınamaz — cihaza özeldir.",
      },
      {
        icon: "shield",
        title: "Sürekli sıkılaştırma",
        text: "Bağımlılıklar düzenli taranır (son denetim: 0 bilinen açık), tek kullanımlık şifreler ilk girişte zorunlu değiştirilir.",
      },
    ],
    footer: "Detaylı aydınlatma metni ve veri işleme politikası:",
    kvkkLink: "KVKK Sayfası",
  },
  en: {
    eyebrow: "Security & Privacy",
    title: "Student data is a trust.",
    titleAccent: "We treat it that way.",
    subtitle:
      "An education platform carries student, parent and finance data. SchoolAsist treats security as an architectural decision, not a marketing line.",
    cards: [
      {
        icon: "key",
        title: "Encrypted session storage",
        text: "Session keys live in iOS Keychain / Android Keystore on mobile, and behind OS-keychain-backed AES-GCM encryption on desktop.",
      },
      {
        icon: "eyeoff",
        title: "Counseling note privacy",
        text: "Even institution admins can't read counseling notes; management only receives numeric summaries. The counselor sets the privacy level.",
      },
      {
        icon: "fingerprint",
        title: "Role-based data isolation",
        text: "Each of the 7 roles accesses only its own data; institutions are fully isolated from each other (multi-tenant, query-level filters).",
      },
      {
        icon: "lock",
        title: "Strict content policy",
        text: "The desktop app runs under a strict CSP: it only talks to known servers and leaks nothing to third parties — even QR codes are generated on-device.",
      },
      {
        icon: "server",
        title: "Hosted in Türkiye",
        text: "Data is stored on redundant infrastructure under KVKK. Session keys never survive a device transfer — they are device-bound.",
      },
      {
        icon: "shield",
        title: "Continuous hardening",
        text: "Dependencies are scanned regularly (latest audit: 0 known vulnerabilities); one-time passwords must be changed at first login.",
      },
    ],
    footer: "Full privacy notice and data processing policy:",
    kvkkLink: "Privacy Page",
  },
}

const ICONS: Record<string, typeof ShieldCheck> = {
  key: KeyRound,
  eyeoff: EyeOff,
  fingerprint: Fingerprint,
  lock: Lock,
  server: Server,
  shield: ShieldCheck,
}

export function SecurityTrust() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section className="relative overflow-hidden bg-[#0c2a3c] py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div ref={ref} className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-16 grid gap-8 md:grid-cols-12 md:items-end md:text-left"
        >
          <div className="md:col-span-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FFB25A]">
              <span className="h-px w-8 bg-[#F7941D]" />
              {copy.eyebrow}
            </div>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.05] text-white md:text-6xl">
              {copy.title} <span className="text-[#FFB25A]">{copy.titleAccent}</span>
            </h2>
          </div>
          <p className="text-base leading-7 text-white/65 md:col-span-4">{copy.subtitle}</p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {copy.cards.map((card, index) => {
            const Icon = ICONS[card.icon] ?? ShieldCheck
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 28 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 + index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm transition-colors hover:border-accent/40"
              >
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-accent/15 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-2 font-bold text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-white/65">{card.text}</p>
              </motion.div>
            )
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center text-sm text-white/60"
        >
          {copy.footer}{" "}
          <Link href="/kvkk" className="font-semibold text-accent underline-offset-4 hover:underline">
            {copy.kvkkLink}
          </Link>
        </motion.p>
      </div>
    </section>
  )
}
