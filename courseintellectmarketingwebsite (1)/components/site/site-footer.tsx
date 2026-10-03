"use client"

import { useId, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, ArrowUp, ArrowUpRight, Building2, Mail, Phone } from "lucide-react"
import { SupportFooterArt } from "./support-footer-art"
import styles from "./site-footer.module.css"

const platformLinks = [["/ozellikler", "Özellikler"], ["/deneyim", "Rol deneyimleri"], ["/indir", "Masaüstü ve mobil uygulamalar"], ["/kurum-kaydi", "Ücretsiz kurum kaydı"]] as const
const supportLinks = [["/destek", "Destek merkezi"], ["/iletisim", "İletişim"], ["/destek#sik-sorulan-sorular", "Sık sorulan sorular"]] as const

export function SiteFooter() {
  const path = usePathname()
  const closing = ["/", "/destek", "/iletisim", "/platform", "/ozellikler"].includes(path.replace(/\/$/, "") || "/")
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] })
  const y = useTransform(scrollYProgress, [0, 1], [22, -8])
  const line = useTransform(scrollYProgress, [0, .9], [.1, 1])
  if (path.startsWith("/kurum-kaydi")) return <footer ref={ref} className={styles.compact}><Link href="/" className={styles.compactBrand} aria-label="SchoolAsist ana sayfa"><Image src="/images/logo.png" width={34} height={34} alt=""/><span>SchoolAsist</span></Link><small>© {new Date().getFullYear()} SchoolAsist · Maydanoz Yazılım</small><nav aria-label="Yasal bilgiler"><Link href="/kvkk">KVKK</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım koşulları</Link></nav></footer>
  return <footer ref={ref} className={`${styles.footer} sa-footer-v2`}>
    {closing && <section className={styles.closing} aria-labelledby={`${uid}-closing-title`}>
      <div className={styles.closingInner}><motion.div className={styles.closingCopy} initial={false} whileInView={reduced ? undefined : { y: [20, 0], opacity: [.75, 1] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .8 }}><h2 id={`${uid}-closing-title`}>Kurumunuzun akışı,<br /><span>buradan başlar.</span></h2><p>Paket seçmeden ücretsiz kurum başvurusu.</p><div className={styles.actions}><Link className={styles.primary} href="/kurum-kaydi">Ücretsiz Kurum Kaydı <ArrowRight size={21} /></Link><Link className={styles.supportLink} href="/destek">Destek ekibine ulaşın <ArrowUpRight size={18} /></Link></div></motion.div><motion.div className={styles.art} style={reduced ? undefined : { y }}><SupportFooterArt name="footer-logo" alt="SchoolAsist logosu ve eğitim panelinin ışıklı platform üzerindeki görünümü" /></motion.div></div>
      <svg className={styles.wave} viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`${uid}-edge`}><stop stopColor="#ff8600"/><stop offset=".6" stopColor="#ffc477"/><stop offset="1" stopColor="#ff9200"/></linearGradient></defs><path d="M0 18C300 95 530 11 740 45S1110 105 1440 45V100H0Z"/><motion.path d="M0 18C300 95 530 11 740 45S1110 105 1440 45" stroke={`url(#${uid}-edge)`} style={reduced ? { pathLength: 1 } : { pathLength: line }} /></svg>
    </section>}
    <div className={styles.dark}>
      <div className={styles.columns}>
        <div className={styles.brandColumn}><Link href="/" className={styles.brand} aria-label="SchoolAsist ana sayfa"><Image src="/images/logo.png" width={64} height={64} alt="" loading="lazy"/><span>School<span>Asist</span></span></Link><p>Eğitimin tüm süreçleri.<br /><span>Tek bir akışta.</span></p></div>
        <nav className={styles.linkColumn} aria-label="Footer platform bağlantıları"><h2>Platform</h2>{platformLinks.map(([href, label]) => <Link key={href} href={href}>{label}<ArrowRight size={16} aria-hidden="true" /></Link>)}</nav>
        <nav className={styles.linkColumn} aria-label="Footer destek bağlantıları"><h2>Destek</h2>{supportLinks.map(([href, label]) => <Link key={href} href={href}>{label}<ArrowRight size={16} aria-hidden="true" /></Link>)}</nav>
        <div className={styles.contact}><h2>Bize ulaşın</h2><a href="mailto:info@schoolasist.com"><Mail size={20} aria-hidden="true"/>info@schoolasist.com</a><a href="tel:+908502428425"><Phone size={20} aria-hidden="true"/>0850 242 84 25</a><p><Building2 size={20} aria-hidden="true"/>Maydanoz Yazılım</p></div>
      </div>
      <div className={styles.watermark} aria-hidden="true">SchoolAsist</div>
      <div className={styles.bottom}><small>© {new Date().getFullYear()} SchoolAsist · Maydanoz Yazılım</small><nav aria-label="Yasal bilgiler"><Link href="/kvkk">KVKK</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım koşulları</Link></nav><a className={styles.toTop} href="#site-top" aria-label="Sayfanın başına dön"><ArrowUp size={23}/></a></div>
    </div>
  </footer>
}
