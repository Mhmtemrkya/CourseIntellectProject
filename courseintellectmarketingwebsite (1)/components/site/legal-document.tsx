"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Info, ArrowRight } from "lucide-react"

export function LegalDocument({ title, kind, introduction, sections }: { title: string; kind: "kvkk" | "privacy" | "terms"; introduction: string; sections: { id: string; title: string; content: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting)
      if (visible) setActive(visible.target.id)
    }, { rootMargin: "-80px 0px -60% 0px" })
    sections.forEach(section => { const element = document.getElementById(section.id); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [sections])
  return <div className={`ref-legal ref-legal-${kind}`}>{kind === "kvkk" && <header className="ref-legal-band"><p>YASAL BİLGİLENDİRME</p><h2>{title}</h2></header>}{kind === "terms" && <header className="ref-legal-title"><h1>{title}</h1><p>{introduction}</p></header>}<div className="ref-legal-layout"><nav aria-label="Belge içeriği">{kind === "privacy" && <h2>Bu sayfada</h2>}{sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined} onClick={() => setActive(section.id)}>{section.title.replace(/^\d+\.\s*/, "")}</a>)}</nav><article>{kind !== "terms" && <header>{kind === "kvkk" && <p className="ref-legal-eyebrow">KİŞİSEL VERİLERİN KORUNMASI KANUNU</p>}<h1>{title}</h1><p>{introduction}</p></header>}{sections.map(section => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.content.split("\n\n").map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}</section>)}<div className="ref-legal-notice"><Info size={22} /><p>{kind === "terms" ? "Kurum kullanımı e-posta doğrulaması ve yönetici onayından sonra başlar." : "Kişisel veri başvurularınız için info@schoolasist.com üzerinden ulaşabilirsiniz."}</p></div><Link className="ref-legal-crosslink" href={kind === "privacy" ? "/kvkk" : "/gizlilik"}>{kind === "privacy" ? "KVKK Aydınlatma Metni" : "Gizlilik Politikası"} <ArrowRight size={17} /></Link></article></div></div>
}
