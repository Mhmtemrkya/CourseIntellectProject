"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  Mail,
  Settings,
  ChevronLeft,
  Home,
  DollarSign,
  Download,
  Phone,
  FileCheck,
  Languages,
  LogIn,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  children?: { label: string; href: string; icon?: LucideIcon }[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    label: "İçerik Yönetimi",
    href: "/admin/icerik",
    icon: FileText,
    children: [
      { label: "Anasayfa", href: "/admin/icerik/anasayfa" },
      { label: "Özellikler", href: "/admin/icerik/ozellikler" },
      { label: "Fiyatlar", href: "/admin/icerik/fiyatlar" },
      { label: "İndir", href: "/admin/icerik/indir" },
      { label: "İletişim", href: "/admin/icerik/iletisim" },
      { label: "Genel", href: "/admin/icerik/genel" },
    ],
  },
  {
    label: "Kullanıcılar",
    href: "/admin/kullanicilar",
    icon: Users,
    children: [
      { label: "Tüm Kullanıcılar", href: "/admin/kullanicilar", icon: Users },
      { label: "Giriş Kayıtları", href: "/admin/kullanicilar/girisler", icon: LogIn },
      { label: "Kayıt Listesi", href: "/admin/kullanicilar/kayitlar", icon: UserPlus },
    ],
  },
  { label: "Çeviriler", href: "/admin/ceviriler", icon: Languages },
  { label: "Kurslar", href: "/admin/kurslar", icon: BookOpen },
  { label: "Mesajlar", href: "/admin/mesajlar", icon: Mail },
  { label: "Ayarlar", href: "/admin/ayarlar", icon: Settings },
]

const contentIcons: Record<string, LucideIcon> = {
  anasayfa: Home,
  ozellikler: FileCheck,
  fiyatlar: DollarSign,
  indir: Download,
  iletisim: Phone,
  genel: Settings,
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(["İçerik Yönetimi", "Kullanıcılar"])

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]))
  }

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    if (href === "/admin/kullanicilar")
      return pathname === "/admin/kullanicilar" && !pathname.includes("/girisler") && !pathname.includes("/kayitlar")
    return pathname.startsWith(href)
  }

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="bg-sidebar text-sidebar-foreground h-screen sticky top-0 flex flex-col border-r border-sidebar-border"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="CourseIntellect"
            width={36}
            height={36}
            className="brightness-0 invert shrink-0"
          />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg whitespace-nowrap overflow-hidden"
              >
                Course<span className="text-sidebar-primary">Intellect</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            <ChevronLeft className="w-5 h-5" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.label)
            const itemIsActive = isActive(item.href)

            return (
              <li key={item.label}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        itemIsActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <AnimatePresence>
                        {!isCollapsed && (
                          <>
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex-1 text-left text-sm font-medium"
                            >
                              {item.label}
                            </motion.span>
                            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronLeft className="w-4 h-4 -rotate-90" />
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </button>
                    <AnimatePresence>
                      {isExpanded && !isCollapsed && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden ml-4 mt-1 space-y-1"
                        >
                          {item.children?.map((child) => {
                            const childSlug = child.href.split("/").pop() || ""
                            const ChildIcon = child.icon || contentIcons[childSlug] || FileText
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                    isActive(child.href)
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                  )}
                                >
                                  <ChildIcon className="w-4 h-4" />
                                  {child.label}
                                </Link>
                              </li>
                            )
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      itemIsActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-sm font-medium"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Home className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                Siteyi Görüntüle
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>
    </motion.aside>
  )
}
