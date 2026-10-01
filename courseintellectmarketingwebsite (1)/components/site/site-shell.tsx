"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react"
import { motion, useScroll, useSpring } from "framer-motion"

export function Brand() {
  return <Link href="/" className="sa-brand" aria-label="SchoolAsist ana sayfa"><Image src="/images/logo.png" width={38} height={38} alt="" priority /><span>SchoolAsist</span></Link>
}

const links = [["/ozellikler", "Platform"], ["/deneyim", "Deneyim"], ["/destek", "Destek"]] as const

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })
  return <header className="sa-nav" onKeyDown={event => { if (event.key === "Escape") { setOpen(false); event.currentTarget.querySelector<HTMLButtonElement>(".sa-menu")?.focus() } }}><div className="sa-nav-inner"><Brand />
    <nav id="site-navigation" aria-label="Ana menü" className={open ? "sa-links is-open" : "sa-links"}>
      <div className="ref-nav-center">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) || href === "/ozellikler" && ["/platform", "/indir", "/kurum-kaydi"].some(p => pathname.startsWith(p)) || href === "/destek" && pathname.startsWith("/iletisim") ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}</div>
      <div className="ref-nav-account"><Link href="/giris" onClick={() => setOpen(false)}>Giriş Yap</Link>
      <Link href="/kurum-kaydi" className="sa-button" onClick={() => setOpen(false)}>Ücretsiz Kurum Kaydı</Link></div>
    </nav>
    <button className="sa-menu" onClick={() => setOpen(!open)} aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} aria-controls="site-navigation">{open ? <X /> : <Menu />}</button>
  </div><motion.div className="sa-scroll-progress" style={{ scaleX: progress }} aria-hidden /></header>
}

export function SiteFooter() {
  return <footer className="sa-footer"><Brand /><div className="ref-footer-product"><Link href="/ozellikler">Platform</Link><Link href="/destek">Destek</Link><Link href="/indir">Uygulamalar</Link></div><div className="sa-footer-links"><Link href="/kvkk">KVKK</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım koşulları</Link></div></footer>
}

export function SiteCTA({ title = "Kurumunuz için yeni bir başlangıç.", description = "Paket seçmeden ücretsiz başvurun. Yönetici onayından sonra kullanmaya başlayın.", login = false, support = true }: { title?: string; description?: string; login?: boolean; support?: boolean }) {
  return <section className="ref-cta"><h2>{title}</h2><p>{description}</p><div className="sa-actions"><Link className="sa-button" href={login ? "/giris" : "/kurum-kaydi"}>{login ? "Giriş Yap" : "Ücretsiz Kurum Kaydı"} <ArrowRight size={17}/></Link>{support && <Link className="sa-text-link" href={login ? "/indir" : "/destek"}>{login ? "Mobil uygulama indir" : "Destek sayfası"} <ArrowUpRight size={16}/></Link>}</div></section>
}
