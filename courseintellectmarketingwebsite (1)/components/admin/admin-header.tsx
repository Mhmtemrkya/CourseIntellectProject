"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Search, ChevronDown, LogOut, Settings, Menu } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/auth-context"
import { useContent } from "@/context/content-context"
import { adminNavigation } from "./admin-sidebar"

export function AdminHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname().replace(/\/$/, "")
  const { user, logout } = useAuth()
  const { isDirty, saveContent, lastSaved } = useContent()
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const section = adminNavigation.find(item => item.href === pathname)?.label ?? (pathname.includes("/icerik/") ? "İçerik yönetimi" : "Yönetim")
  const results = adminNavigation.filter(item => item.label.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")))
  return <header className="sadmin-admin-header">
    <button className="sadmin-icon-button sadmin-mobile-menu" onClick={onMenuOpen} aria-label="Yönetim menüsünü aç"><Menu size={21}/></button>
    <div className="sadmin-admin-breadcrumb"><Link href="/admin/">Platform yönetimi</Link><span>/</span><strong>{section}</strong></div>
    <div className="sadmin-admin-header-actions">
      {isDirty && <button className="sadmin-button sadmin-button-primary" onClick={() => void saveContent()}>Kaydet</button>}
      {lastSaved && !isDirty && <span className="sadmin-save-status">Son kayıt {lastSaved.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>}
      <div className="sadmin-header-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false) }}>
        <Search size={17}/><input aria-label="Yönetim sayfalarında ara" placeholder="Panelde ara…" value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === "Escape") setSearchOpen(false) }}/>
        {searchOpen && <div className="sadmin-header-search-results">{results.length ? results.map(item => <Link key={item.href} href={`${item.href}/`} onClick={() => { setSearchOpen(false); setQuery("") }}><item.icon size={17}/>{item.label}</Link>) : <p>Sayfa bulunamadı.</p>}</div>}
      </div>
      <Link href="/admin/mesajlar/" className="sadmin-icon-button" aria-label="Mesajları görüntüle"><Bell size={20}/></Link>
      <DropdownMenu><DropdownMenuTrigger asChild><button className="sadmin-admin-account"><span className="sadmin-account-avatar">{user?.name.split(/\s+/).map(n => n[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR") || "PY"}</span><span>Platform yöneticisi</span><ChevronDown size={13}/></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="sadmin-admin-menu"><div className="px-2 py-2"><p className="font-semibold text-sm">{user?.name}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div><DropdownMenuSeparator/><DropdownMenuItem asChild><Link href="/admin/ayarlar/"><Settings size={16}/>Ayarlar</Link></DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={logout}><LogOut size={16}/>Çıkış yap</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
}
