"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import type { SiteContent, ContentState } from "@/types/content"
import { defaultContent } from "@/data/default-content"
import { apiRequest } from "@/lib/api-client"
import { useLanguage } from "@/context/language-context"

const HISTORY_LIMIT = 10
const SECTION_KEYS = Object.keys(defaultContent) as (keyof SiteContent)[]

function setSection<K extends keyof SiteContent>(target: SiteContent, key: K, value: SiteContent[K]) {
  target[key] = value
}

type ContentResponse = {
  section: string
  language: string
  version: number
  isPublished: boolean
  updatedAt?: string
  content: SiteContent[keyof SiteContent]
}

interface ContentContextValue extends ContentState {
  updateContent: <K extends keyof SiteContent>(section: K, data: Partial<SiteContent[K]>) => void
  updateNestedContent: <K extends keyof SiteContent>(section: K, path: string, value: unknown) => void
  saveContent: (section?: keyof SiteContent) => Promise<void>
  resetContent: () => void
  undoChange: () => void
  exportContent: () => string
  importContent: (jsonString: string) => boolean
}

const ContentContext = createContext<ContentContextValue | null>(null)

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent>(defaultContent)
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [history, setHistory] = useState<SiteContent[]>([])
  const { language } = useLanguage()
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith("/admin")

  const loadContent = useCallback(async () => {
    const basePath = isAdminRoute ? "/api/sitecontents" : "/api/sitecontents"
    const results = await Promise.allSettled(
      SECTION_KEYS.map((section) =>
        apiRequest<ContentResponse>(`${basePath}/${section}`, {
          query: { language },
        }),
      ),
    )

    const nextContent: SiteContent = { ...defaultContent }
    let latestSaved: Date | null = null

    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return
      const payload = result.value
      const sectionKey = SECTION_KEYS[index]
      setSection(nextContent, sectionKey, payload.content as SiteContent[typeof sectionKey])

      if (payload.updatedAt) {
        const updated = new Date(payload.updatedAt)
        if (!latestSaved || updated > latestSaved) {
          latestSaved = updated
        }
      }
    })

    setContent(nextContent)
    setLastSaved(latestSaved)
    setIsDirty(false)
    setHistory([])
  }, [isAdminRoute, language])

  useEffect(() => {
    loadContent().catch((error) => {
      console.error("Content load failed:", error)
    })
  }, [loadContent])

  const updateContent = useCallback(
    <K extends keyof SiteContent>(section: K, data: Partial<SiteContent[K]>) => {
      setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), content])
      setContent((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...data },
      }))
      setIsDirty(true)
    },
    [content],
  )

  const updateNestedContent = useCallback(
    <K extends keyof SiteContent>(section: K, path: string, value: unknown) => {
      setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), content])

      setContent((prev) => {
        const newContent = { ...prev }
        const keys = path.split(".")
        let current: Record<string, unknown> = newContent[section] as Record<string, unknown>

        for (let i = 0; i < keys.length - 1; i++) {
          if (current[keys[i]] && typeof current[keys[i]] === "object") {
            current[keys[i]] = { ...(current[keys[i]] as object) }
            current = current[keys[i]] as Record<string, unknown>
          }
        }

        current[keys[keys.length - 1]] = value
        return newContent
      })
      setIsDirty(true)
    },
    [content],
  )

  const saveContent = useCallback(
    async (section?: keyof SiteContent) => {
      const targetSections = section ? [section] : SECTION_KEYS
      const responses = await Promise.all(
        targetSections.map((sectionKey) =>
          apiRequest<ContentResponse>(`/api/sitecontents/${sectionKey}`, {
            method: "PUT",
            body: {
              language,
              content: content[sectionKey],
              publish: true,
            },
          }),
        ),
      )

      const updatedContent: SiteContent = { ...content }
      let latestSaved: Date | null = lastSaved

      responses.forEach((payload) => {
        const sectionKey = payload.section as keyof SiteContent
        if (SECTION_KEYS.includes(sectionKey)) {
          setSection(updatedContent, sectionKey, payload.content as SiteContent[typeof sectionKey])
        }
        if (payload.updatedAt) {
          const updated = new Date(payload.updatedAt)
          if (!latestSaved || updated > latestSaved) {
            latestSaved = updated
          }
        }
      })

      setContent(updatedContent)
      setLastSaved(latestSaved)
      setIsDirty(false)
    },
    [content, language, lastSaved],
  )

  const resetContent = useCallback(() => {
    setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), content])
    setContent(defaultContent)
    setIsDirty(true)
  }, [content])

  const undoChange = useCallback(() => {
    if (history.length === 0) return

    const previousContent = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    setContent(previousContent)
    setIsDirty(true)
  }, [history])

  const exportContent = useCallback(() => {
    return JSON.stringify(content, null, 2)
  }, [content])

  const importContent = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString) as SiteContent
        setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), content])
        setContent(parsed)
        setIsDirty(true)
        return true
      } catch (error) {
        console.error("Content import failed:", error)
        return false
      }
    },
    [content],
  )

  return (
    <ContentContext.Provider
      value={{
        content,
        isDirty,
        lastSaved,
        history,
        updateContent,
        updateNestedContent,
        saveContent,
        resetContent,
        undoChange,
        exportContent,
        importContent,
      }}
    >
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  const context = useContext(ContentContext)
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider")
  }
  return context
}

// Section content helper.
export function useSectionContent<K extends keyof SiteContent>(section: K): SiteContent[K] {
  const { content } = useContent()
  return content[section]
}
