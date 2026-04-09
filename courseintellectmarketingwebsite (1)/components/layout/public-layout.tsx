"use client"

import type React from "react"
import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { Navbar } from "./navbar"
import { Footer } from "./footer"
import { useSectionContent } from "@/context/content-context"

interface PublicLayoutProps {
  children: React.ReactNode
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const pathname = usePathname()
  const general = useSectionContent("general")

  useEffect(() => {
    const title = general.siteDescription
      ? `${general.siteName} - ${general.siteDescription}`
      : general.siteName

    document.title = title

    const ensureMeta = (selector: string, attr: "name" | "property", value: string) => {
      let tag = document.querySelector(selector) as HTMLMetaElement | null
      if (!tag) {
        tag = document.createElement("meta")
        tag.setAttribute(attr, value)
        document.head.appendChild(tag)
      }
      return tag
    }

    const descriptionTag = ensureMeta("meta[name=\"description\"]", "name", "description")
    descriptionTag.content = general.siteDescription || ""

    const keywordTag = ensureMeta("meta[name=\"keywords\"]", "name", "keywords")
    keywordTag.content = (general.siteKeywords || []).join(", ")

    const ogTitleTag = ensureMeta("meta[property=\"og:title\"]", "property", "og:title")
    ogTitleTag.content = title

    const ogDescriptionTag = ensureMeta("meta[property=\"og:description\"]", "property", "og:description")
    ogDescriptionTag.content = general.siteDescription || ""
  }, [general.siteDescription, general.siteKeywords, general.siteName])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  )
}
