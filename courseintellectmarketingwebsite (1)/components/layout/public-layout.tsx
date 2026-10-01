"use client"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MotionConfig } from "framer-motion"
import { SiteNav, SiteFooter } from "@/components/site/site-shell"
import { SiteMotion } from "@/components/site/site-motion"
export function PublicLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  const path = usePathname()
  return <MotionConfig reducedMotion="user"><div className={`sa-site ${className}`}><a className="sr-only focus:not-sr-only" href="#main-content">İçeriğe geç</a><SiteNav/><main id="main-content"><div key={path} className="sa-page-entry">{children}</div></main><SiteFooter/><SiteMotion/></div></MotionConfig>
}
