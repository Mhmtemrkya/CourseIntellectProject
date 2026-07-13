"use client"

import { motion } from "framer-motion"
import { Bell, Check, CircleDollarSign, ClipboardCheck, MessageSquareText } from "lucide-react"
import { useLanguage } from "@/context/language-context"

const COPY = {
  tr: {
    eyebrow: "Bir gün / Tek veri akışı",
    title: "Kurum hareket ederken SchoolAsist sessizce senkronize eder.",
    subtitle: "Aynı işlem, ilgili herkesin ekranına kendi rolü ve yetkisi kadar yansır. Tekrar veri girişi ve kopuk iletişim ortadan kalkar.",
    moments: [
      { time: "08:10", role: "Öğretmen", title: "Yoklama tamamlandı", body: "Sınıf yoklaması kaydedildi; devamsızlık yönetim ve veli ekranına işlendi.", icon: ClipboardCheck },
      { time: "11:40", role: "Muhasebe", title: "Tahsilat işlendi", body: "Ödeme en eski taksite mahsup edildi, makbuz oluştu ve veli hesabı güncellendi.", icon: CircleDollarSign },
      { time: "17:20", role: "Kurum Yöneticisi", title: "Gün kapanışı hazır", body: "Şube performansı, devam oranı, tahsilat ve bekleyen görevler tek özette toplandı.", icon: Check },
    ],
    stream: [
      { time: "08:10:24", text: "7-A yoklaması tamamlandı", actor: "Ahmet Demir" },
      { time: "08:10:25", text: "Veli devamsızlık bildirimi oluşturuldu", actor: "Otomatik" },
      { time: "11:40:08", text: "Tahsilat makbuzu #2026-1842", actor: "Selim Besim" },
      { time: "14:05:31", text: "Yeni çalışma planı öğrenciye atandı", actor: "Rehberlik" },
      { time: "17:20:00", text: "Şube günlük özeti güncellendi", actor: "Otomatik" },
    ],
  },
  en: {
    eyebrow: "One day / One data flow",
    title: "As your institution moves, SchoolAsist quietly keeps it in sync.",
    subtitle: "Every action reaches the right people according to their role and scope. Duplicate entry and disconnected communication disappear.",
    moments: [
      { time: "08:10", role: "Teacher", title: "Attendance completed", body: "Class attendance is recorded and reflected in management and parent workspaces.", icon: ClipboardCheck },
      { time: "11:40", role: "Accounting", title: "Collection recorded", body: "Payment is applied to the oldest installment, a receipt is created and the parent account updates.", icon: CircleDollarSign },
      { time: "17:20", role: "Institution Admin", title: "Daily close is ready", body: "Branch performance, attendance, collections and pending tasks are summarized together.", icon: Check },
    ],
    stream: [
      { time: "08:10:24", text: "Class 7-A attendance completed", actor: "Ahmet Demir" },
      { time: "08:10:25", text: "Parent absence notice created", actor: "Automatic" },
      { time: "11:40:08", text: "Collection receipt #2026-1842", actor: "Selim Besim" },
      { time: "14:05:31", text: "New study plan assigned", actor: "Counseling" },
      { time: "17:20:00", text: "Branch daily summary updated", actor: "Automatic" },
    ],
  },
}

export function TestimonialsSection() {
  const { language } = useLanguage()
  const copy = COPY[language]

  return (
    <section className="relative overflow-hidden bg-[#061a27] py-24 text-white md:py-36">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)", backgroundSize: "80px 80px" }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FFB25A]">
              <span className="h-px w-8 bg-[#F7941D]" />
              {copy.eyebrow}
            </div>
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] md:text-6xl lg:text-7xl">{copy.title}</h2>
          </div>
          <p className="text-base leading-8 text-white/58 lg:col-span-4">{copy.subtitle}</p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-12">
          <div className="space-y-px bg-white/10 lg:col-span-7">
            {copy.moments.map((moment, index) => {
              const Icon = moment.icon
              return (
                <motion.article
                  key={moment.time}
                  initial={{ opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.12, duration: 0.6 }}
                  className="grid gap-5 bg-[#082131] p-6 sm:grid-cols-[96px_1fr] md:p-8"
                >
                  <div>
                    <div className="font-mono text-2xl font-semibold text-[#FFB25A]">{moment.time}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/38">{moment.role}</div>
                  </div>
                  <div className="flex gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/6 text-emerald-300">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold">{moment.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-white/58">{moment.body}</p>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            className="border border-white/10 bg-[#041720] p-6 lg:col-span-5 lg:p-8"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                <Bell className="h-4 w-4 text-[#F7941D]" />
                Canlı işlem akışı
              </div>
              <span className="flex items-center gap-2 text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LIVE
              </span>
            </div>
            <div className="mt-3">
              {copy.stream.map((event) => (
                <div key={`${event.time}-${event.text}`} className="grid grid-cols-[72px_1fr] gap-3 border-b border-white/8 py-4 last:border-b-0">
                  <span className="font-mono text-[10px] text-white/35">{event.time}</span>
                  <div>
                    <div className="text-sm text-white/75">{event.text}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/35">
                      <MessageSquareText className="h-3 w-3" />
                      {event.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
