"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, Users, MessageSquare, FileText, Languages, LogIn, Settings, BookOpen, Mail, ExternalLink, ChevronDown, Trash2 } from "lucide-react"

export const adminNavigation = [
  { label: "Genel bakış", href: "/admin", icon: LayoutDashboard },
  { label: "Kurumlar", href: "/admin/kurumlar", icon: Building2 },
  { label: "Kullanıcılar", href: "/admin/kullanicilar", icon: Users },
  { label: "Destek ve şikayetler", href: "/admin/destek", icon: MessageSquare },
  { label: "İçerik yönetimi", href: "/admin/icerik/anasayfa", icon: FileText },
  { label: "Çeviriler", href: "/admin/ceviriler", icon: Languages },
  { label: "Giriş kayıtları", href: "/admin/kullanicilar/girisler", icon: LogIn },
  { label: "Ayarlar", href: "/admin/ayarlar", icon: Settings },
  { label: "Kayıt listesi", href: "/admin/kullanicilar/kayitlar", icon: Users },
  { label: "Kurslar", href: "/admin/kurslar", icon: BookOpen },
  { label: "Mesajlar", href: "/admin/mesajlar", icon: Mail },
  { label: "Silme talepleri", href: "/admin/silme-talepleri", icon: Trash2 },
]
const contentPages = [
  ["Anasayfa", "anasayfa"], ["Özellikler", "ozellikler"], ["Fiyatlar", "fiyatlar"],
  ["İndir", "indir"], ["İletişim", "iletisim"], ["Genel", "genel"],
]
export function AdminSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, "")
  const [contentOpen, setContentOpen] = useState(pathname.startsWith("/admin/icerik"))
  return <aside className={`sadmin-admin-sidebar${mobile ? " is-mobile" : ""}`}>
    <Link href="/admin/" className="sadmin-admin-brand" onClick={onNavigate}>
      <Image src="/images/logo.png" alt="SchoolAsist logosu" width={39} height={39} priority />
      <span>School<span>Asist</span></span>
    </Link>
    <nav aria-label="Yönetim menüsü" className="sadmin-admin-navigation">
      <p className="sadmin-nav-label">YÖNETİM</p>
      {adminNavigation.slice(0, 8).map(({ label, href, icon: Icon }) => {
        const content = href.includes("/icerik/")
        const active = content ? pathname.startsWith("/admin/icerik/") : pathname === href
        return <div key={href}>
          {content ? <button className={`sadmin-nav-item${active ? " is-active" : ""}`} aria-expanded={contentOpen} onClick={() => setContentOpen(!contentOpen)}>
            <Icon size={19}/><span>{label}</span><ChevronDown size={14} className={contentOpen ? "rotate-180" : ""}/>
          </button> : <Link href={`${href}/`} className={`sadmin-nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}><Icon size={19}/><span>{label}</span></Link>}
          {content && contentOpen && <div className="sadmin-nav-children">{contentPages.map(([name, slug]) => <Link key={slug} href={`/admin/icerik/${slug}/`} aria-current={pathname === `/admin/icerik/${slug}` ? "page" : undefined} onClick={onNavigate}>{name}</Link>)}</div>}
        </div>
      })}
      <details className="sadmin-nav-additional">
        <summary>Diğer sayfalar<ChevronDown size={13}/></summary>
        {adminNavigation.slice(8).map(({label, href, icon: Icon}) => <Link key={href} href={`${href}/`} className={`sadmin-nav-item${pathname === href ? " is-active" : ""}`} aria-current={pathname === href ? "page" : undefined} onClick={onNavigate}><Icon size={19}/><span>{label}</span></Link>)}
      </details>
    </nav>
    <Link href="/" target="_blank" rel="noopener noreferrer" className="sadmin-admin-site-link"><ExternalLink size={18}/>Siteyi görüntüle</Link>
  </aside>
}
