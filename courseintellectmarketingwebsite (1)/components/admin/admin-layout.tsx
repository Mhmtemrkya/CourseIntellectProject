"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"
import { useAuth } from "@/context/auth-context"

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { if (!isLoading && !isAuthenticated) router.push("/admin/login") }, [isAuthenticated, isLoading, router])
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Yönetim paneli yükleniyor"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"/></div>
  if (!isAuthenticated) return null
  return <div className="sadmin-admin-shell">
    <AdminSidebar/>
    <div className="sadmin-admin-workspace"><AdminHeader onMenuOpen={() => setMenuOpen(true)}/>
      <motion.main key={pathname} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }} className={`sadmin-admin-main${pathname.replace(/\/$/, "") === "/admin/kurumlar" ? " sadmin-institutions-main" : ""}`}>{children}</motion.main>
    </div>
    <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}><Dialog.Portal><Dialog.Overlay className="sadmin-modal-overlay"/><Dialog.Content className="sadmin-mobile-navigation" onCloseAutoFocus={e => { e.preventDefault(); document.querySelector<HTMLButtonElement>(".sadmin-mobile-menu")?.focus() }}><Dialog.Title className="sr-only">Yönetim menüsü</Dialog.Title><Dialog.Description className="sr-only">SchoolAsist yönetim sayfaları</Dialog.Description><Dialog.Close className="sadmin-icon-button sadmin-mobile-nav-close" aria-label="Menüyü kapat"><X size={20}/></Dialog.Close><AdminSidebar mobile onNavigate={() => setMenuOpen(false)}/></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
