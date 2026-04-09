"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Search, ChevronDown, LogOut, User, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/auth-context"
import { useContent } from "@/context/content-context"

const pathNames: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/icerik": "İçerik Yönetimi",
  "/admin/icerik/anasayfa": "Anasayfa İçeriği",
  "/admin/icerik/ozellikler": "Özellikler İçeriği",
  "/admin/icerik/fiyatlar": "Fiyatlar İçeriği",
  "/admin/icerik/indir": "İndir İçeriği",
  "/admin/icerik/iletisim": "İletişim İçeriği",
  "/admin/icerik/genel": "Genel Ayarlar",
  "/admin/kullanicilar": "Kullanıcılar",
  "/admin/kurslar": "Kurslar",
  "/admin/mesajlar": "Mesajlar",
  "/admin/ayarlar": "Ayarlar",
}

export function AdminHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isDirty, saveContent, lastSaved } = useContent()
  const [showSearch, setShowSearch] = useState(false)

  const currentPageName = pathNames[pathname] || "Dashboard"

  const getBreadcrumbs = () => {
    const parts = pathname.split("/").filter(Boolean)
    const breadcrumbs: { label: string; href: string }[] = []

    let currentPath = ""
    for (const part of parts) {
      currentPath += `/${part}`
      const label = pathNames[currentPath]
      if (label) {
        breadcrumbs.push({ label, href: currentPath })
      }
    }

    return breadcrumbs
  }

  return (
    <header className="h-16 bg-background border-b border-border px-6 flex items-center justify-between">
      {/* Left - Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {getBreadcrumbs().map((crumb, index, arr) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <span className={index === arr.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
              {crumb.label}
            </span>
            {index < arr.length - 1 && <span className="text-muted-foreground">/</span>}
          </span>
        ))}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-4">
        {/* Save Status */}
        {isDirty && (
          <Button size="sm" onClick={saveContent} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Kaydet
          </Button>
        )}
        {lastSaved && !isDirty && (
          <span className="text-xs text-muted-foreground">
            Son kayıt: {lastSaved.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}

        {/* Search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
            >
              <Input placeholder="Ara..." className="h-9" autoFocus onBlur={() => setShowSearch(false)} />
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSearch(!showSearch)}
          className="text-muted-foreground"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-sm font-medium text-accent">{user?.name.charAt(0)}</span>
              </div>
              <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Ayarlar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
