"use client"

import { useId, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, Info, MessageCircle, Plus, Search, UserRound, Wrench } from "lucide-react"
import { supportQuestions } from "@/lib/support-questions"
import { SupportFooterArt } from "./support-footer-art"
import styles from "./support-experience.module.css"

const ease = [.22, 1, .36, 1] as const
const topics = [
  { value: "Destek", label: "Teknik destek", Icon: Wrench },
  { value: "Şikayet", label: "Şikayet ve öneri", Icon: MessageCircle },
  { value: "Erişim", label: "Hesap ve erişim", Icon: UserRound },
]

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [20, 0], opacity: [.7, 1] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .8, delay, ease }}>{children}</motion.div>
}

function Answer({ question, answer, id }: { question: string; answer: string; id: string }) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  return <article className={styles.answer} data-open={open}>
    <h3><button id={`${id}-trigger`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={() => setOpen(!open)}>{question}<Plus size={21} aria-hidden="true" /></button></h3>
    <AnimatePresence initial={false}>{open && <motion.div id={`${id}-answer`} role="region" aria-labelledby={`${id}-trigger`} initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .3, ease }}><p>{answer}</p></motion.div>}</AnimatePresence>
  </article>
}

export function SupportExperience({ children, category, onCategory }: { children: ReactNode; category: string; onCategory: (value: string) => void }) {
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const lift = useTransform(scrollYProgress, [0, 1], [0, -25])
  const line = useTransform(scrollYProgress, [0, .6], [.35, 1])
  const query = search.trim().toLocaleLowerCase("tr-TR")
  const answers = supportQuestions.map(([question, answer], index) => ({ question, answer, index })).filter(item => `${item.question} ${item.answer}`.toLocaleLowerCase("tr-TR").includes(query))
  return <div className={`${styles.page} sa-support-v2`}>
    <section ref={ref} className={styles.hero} aria-labelledby="support-title">
      <div className={styles.heroInner}>
        <Reveal className={styles.heroCopy}><h1 id="support-title">Sorununuzu<br /><span>birlikte çözelim.</span></h1><p>Müşteri numaranızla destek talebi oluşturun.</p><div className={styles.search}><Search size={23} aria-hidden="true" /><label htmlFor={`${uid}-search`} className="sr-only">Yardım konularında ara</label><input id={`${uid}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Yardım konularında ara" aria-controls="sik-sorulan-sorular" /></div>{query && <a className={styles.searchHint} href="#sik-sorulan-sorular">{answers.length ? `${answers.length} yardım konusu bulundu` : "Eşleşen yardım konusu bulunamadı"}<ArrowRight size={15} /></a>}</Reveal>
        <motion.div className={styles.heroArt} style={reduced ? undefined : { y: lift }}><SupportFooterArt name="support-headset" alt="Turuncu ve lacivert destek kulaklığı, konuşma paneli ve SchoolAsist logosu" eager /></motion.div>
      </div>
      <svg className={styles.ribbon} viewBox="0 0 1440 170" preserveAspectRatio="none" aria-hidden="true"><path d="M-50 60C200 150 470 150 715 83S1120 64 1490 8" /><motion.path d="M-50 60C200 150 470 150 715 83S1120 64 1490 8" style={reduced ? { pathLength: 1 } : { pathLength: line }} /></svg>
    </section>
    <section className={styles.workspace} aria-label="Destek başvurusu">
      <Reveal className={styles.help}><p className={styles.eyebrow}>Destek merkezi</p><h2>Size nasıl<br /> yardımcı olalım?</h2><nav aria-label="Destek kategorileri">{topics.map(({ value, label, Icon }) => <a key={value} href="#support-form" aria-current={category === value ? "true" : undefined} onClick={() => onCategory(value)}><Icon size={27} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span><ArrowRight size={18} aria-hidden="true" /></a>)}</nav><div className={styles.hint}><Info size={22} aria-hidden="true" /><div><p>Müşteri numaranız onay e-postanızda yer alır.</p><Link href="/iletisim">Numaramı bilmiyorum <ArrowRight size={16} /></Link></div></div></Reveal>
      <Reveal className={styles.formPanel} delay={.1}>{children}</Reveal>
    </section>
    <section className={styles.faq} id="sik-sorulan-sorular" aria-labelledby="support-faq-heading">
      <div className={styles.faqInner}><Reveal><p className={styles.eyebrow}>Sıkça sorulan sorular</p><h2 id="support-faq-heading">Hızlı <span>yanıtlar.</span></h2></Reveal><p className={styles.resultCount} role="status" aria-live="polite">{query ? `${answers.length} yardım konusu bulundu` : ""}</p><div className={styles.answers}>{answers.map(({ question, answer, index }) => <Answer key={question} question={question} answer={answer} id={`${uid}-faq-${index}`} />)}</div>{!answers.length && <div className={styles.empty}><p>Bu aramayla eşleşen konu bulunamadı.</p><button onClick={() => setSearch("")}>Tüm soruları göster <ArrowRight size={16} /></button></div>}</div>
    </section>
  </div>
}
