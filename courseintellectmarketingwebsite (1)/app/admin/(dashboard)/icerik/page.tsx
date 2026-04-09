"use client"

import Link from "next/link"
import { Home, Grid3X3, CreditCard, Download, Mail, Settings2, ChevronRight, FileText } from "lucide-react"

const contentPages = [
  {
    title: "Anasayfa",
    description: "Hero, özellikler, istatistikler, SSS ve CTA bölümleri",
    href: "/admin/icerik/anasayfa",
    icon: Home,
    sections: 8,
  },
  {
    title: "Özellikler",
    description: "Tüm özellik kartları ve kategori isimleri",
    href: "/admin/icerik/ozellikler",
    icon: Grid3X3,
    sections: 2,
  },
  {
    title: "Fiyatlar",
    description: "Paketler, fiyatlar ve özellik listeleri",
    href: "/admin/icerik/fiyatlar",
    icon: CreditCard,
    sections: 3,
  },
  {
    title: "İndir",
    description: "Platform bilgileri ve sürüm notları",
    href: "/admin/icerik/indir",
    icon: Download,
    sections: 2,
  },
  {
    title: "İletişim",
    description: "İletişim bilgileri ve form ayarları",
    href: "/admin/icerik/iletisim",
    icon: Mail,
    sections: 2,
  },
  {
    title: "Genel Ayarlar",
    description: "Navbar, footer ve site geneli metinler",
    href: "/admin/icerik/genel",
    icon: Settings2,
    sections: 4,
  },
  {
    title: "Yasal Sayfalar",
    description: "KVKK ve Kullanım Şartları içerikleri",
    href: "/admin/icerik/yasal",
    icon: FileText,
    sections: 2,
  },
]

export default function ContentIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">İçerik Yönetimi</h1>
        <p className="text-muted-foreground mt-1">Sitenizdeki tüm metinleri buradan düzenleyebilirsiniz</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {contentPages.map((page) => {
          const Icon = page.icon
          return (
            <Link
              key={page.href}
              href={page.href}
              className="group flex items-start gap-4 p-5 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {page.title}
                  </h2>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{page.description}</p>
                <p className="text-xs text-muted-foreground mt-2">{page.sections} bölüm</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
