"use client"
import { Download } from "lucide-react"
import { useSectionContent } from "@/context/content-context"
import { ReferenceHero, ReferenceGallery, SceneImage } from "./product-story"
import type { ShowcaseAsset } from "@/lib/showcase-assets"

function safeDownload(value?: string) {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null }
  catch { return value.startsWith("/downloads/") ? value : null }
}
export function AppsPage() {
  const content = useSectionContent("download")
  const groups = [
    { title: "Mobil", subtitle: "Android · iOS", description: "İndirme seçenekleri burada listelenir.", asset: "apps-mobile-option", ids: ["android", "ios"] },
    { title: "Masaüstü", subtitle: "Windows · macOS", description: "İndirme seçenekleri burada listelenir.", asset: "apps-desktop-option", ids: ["windows", "macos"] },
  ]
  return <div className="ref-story"><ReferenceHero title="Her cihazda." accent="SchoolAsist." description="Hesabınıza masaüstü ve mobil uygulamalarımızdan giriş yapın." asset="apps-device" /><ReferenceGallery title="Ekran değişir. Akış devam eder." href="/ozellikler" linkLabel="Platformu keşfet" cards={[
    { asset: "apps-desktop", title: "Masaüstü.", description: "Daha geniş görünüm, daha fazla kontrol.", href: "#indirme" },
    { asset: "apps-mobile", title: "Mobil.", description: "Her an, her yerde yanınızda.", href: "#indirme" },
  ]} /><section id="indirme" className="ref-download"><h2>Size uygun şekilde başlayın.</h2><p>SchoolAsist’i dilediğiniz cihazda kullanın.</p><small>Uygulamayı indirin. Kurumunuz onaylandıktan sonra e-postanızdaki bilgilerle uygulamadan giriş yapın.</small><div className="ref-download-grid" style={{gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 300px), 1fr))"}}>{groups.map(group => {
    const links = content.platforms.filter(p => group.ids.includes(p.id)).map(p => ({ ...p, url: safeDownload(p.downloadUrl) })).filter(p => p.url)
    return <article key={group.title}><SceneImage asset={group.asset as ShowcaseAsset} alt={`${group.title} cihazında SchoolAsist logosu`} /><h3>{group.title}</h3><p>{group.subtitle}</p><small>{group.description}</small>{links.length ? links.map(p => <a className="sa-button" href={p.url!} key={p.id} target="_blank" rel="noopener noreferrer">{p.name} indir <Download size={15} /></a>) : <span className="ref-download-unavailable">İndirme seçenekleri henüz yayımlanmadı</span>}</article>
  })}</div><small className="ref-demo-note">Temsili demo verileri</small></section></div>
}
