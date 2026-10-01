"use client"
import { Analytics } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"
export function PublicAnalytics(){const path=usePathname();if(path.startsWith("/kurum-kaydi")||path.startsWith("/giris")||path.startsWith("/auth")||path.startsWith("/admin")||path.startsWith("/destek")||path.startsWith("/iletisim"))return null;return <Analytics/>}
