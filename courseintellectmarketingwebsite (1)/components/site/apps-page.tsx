"use client"
import Link from "next/link"
import { ArrowRight, Download } from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { useUserAuth } from "@/context/user-auth-context"
import { ReferenceHero, ReferenceGallery, SceneImage } from "./product-story"
import type { ShowcaseAsset } from "@/lib/showcase-assets"

function safeDownload(value?: string) {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null }
  catch { return value.startsWith("/downloads/") ? value : null }
}
export function AppsPage() {
  const content = useSectionContent("download")
  const { isAuthenticated } = useUserAuth()
  const groups = [
    { title: "Web", subtitle: "Tarayıcıda aç.", description: "Her cihazdan, ek kurulum gerektirmeden kullanmaya başlayın.", asset: "apps-web-option", ids: [] },
    { title: "Mobil", subtitle: "Android · iOS", description: "İndirme seçenekleri burada listelenir.", asset: "apps-mobile-option", ids: ["android", "ios"] },
    { title: "Masaüstü", subtitle: "Windows · macOS", description: "İndirme seçenekleri burada listelenir.", asset: "apps-desktop-option", ids: ["windows", "macos"] },
  ]
  return <div className="ref-story"><ReferenceHero title="Her cihazda." accent="SchoolAsist." description="Masaüstü, web ve mobil deneyimi." asset="apps-device" /><ReferenceGallery title="Ekran değişir. Akış devam eder." href="/ozellikler" linkLabel="Platformu keşfet" cards={[
    { asset: "apps-desktop", title: "Masaüstü.", description: "Daha geniş görünüm, daha fazla kontrol.", href: "#indirme" },
    { asset: "apps-mobile", title: "Mobil.", description: "Her an, her yerde yanınızda.", href: "#indirme" },
  ]} /><section id="indirme" className="ref-download"><h2>Size uygun şekilde başlayın.</h2><p>SchoolAsist’i dilediğiniz cihazda kullanın.</p><small>Güncel sürüm ve erişim seçenekleri burada listelenir.</small><div className="ref-download-grid">{groups.map(group => {
    const links = content.platforms.filter(p => group.ids.includes(p.id)).map(p => ({ ...p, url: safeDownload(p.downloadUrl) })).filter(p => p.url)
    return <article key={group.title}><SceneImage asset={group.asset as ShowcaseAsset} alt={`${group.title} cihazında SchoolAsist logosu`} /><h3>{group.title}</h3><p>{group.subtitle}</p><small>{group.description}</small>{group.title === "Web" ? <Link className="sa-button" href="/giris">Web uygulamasını aç <ArrowRight size={16} /></Link> : links.length ? links.map(p => isAuthenticated ? <a className="sa-button" href={p.url!} key={p.id} target="_blank" rel="noopener noreferrer">{p.name} indir <Download size={15} /></a> : <Link key={p.id} className="sa-button" href="/giris">{p.name} için giriş yap</Link>) : <span className="ref-download-unavailable">İndirme seçenekleri henüz yayımlanmadı</span>}</article>
  })}</div><small className="ref-demo-note">Temsili demo verileri</small></section></div>
}
