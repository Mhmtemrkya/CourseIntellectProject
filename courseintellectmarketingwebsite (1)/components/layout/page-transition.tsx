"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import { PageLoader } from "@/components/ui/page-loader"

type PageLoaderVariant = NonNullable<React.ComponentProps<typeof PageLoader>["variant"]>

const pathToPageName: Record<string, PageLoaderVariant> = {
  "/": "home",
  "/ozellikler": "features",
  "/fiyatlar": "pricing",
  "/indir": "download",
  "/iletisim": "contact",
  "/kvkk": "legal",
  "/kullanim-sartlari": "legal",
  "/giris": "login",
  "/admin": "admin",
  "/admin/login": "login",
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState(pathname)

  const getPageName = useCallback((path: string) => {
    // Check exact match first
    if (pathToPageName[path]) return pathToPageName[path]

    // Check if starts with admin
    if (path.startsWith("/admin")) return "admin"

    // Default
    return "home"
  }, [])

  useEffect(() => {
    // Only trigger loading if path actually changed
    if (pathname !== currentPath) {
      setIsLoading(true)

      // Simulate minimum loading time for smooth animation
      const timer = setTimeout(() => {
        setIsLoading(false)
        setCurrentPath(pathname)
      }, 600)

      return () => clearTimeout(timer)
    }
  }, [pathname, currentPath])

  const pageName = getPageName(pathname)

  return (
    <>
      <AnimatePresence mode="wait">{isLoading && <PageLoader key="loader" variant={pageName} />}</AnimatePresence>
      {children}
    </>
  )
}
