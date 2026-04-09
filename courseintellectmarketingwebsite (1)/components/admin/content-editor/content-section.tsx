"use client"

import type React from "react"

import { useState } from "react"
import { ChevronDown, Eye } from "lucide-react"

interface ContentSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  defaultOpen?: boolean
  onPreview?: () => void
}

export function ContentSection({ title, description, children, defaultOpen = true, onPreview }: ContentSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="text-left">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPreview()
              }}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && <div className="p-5 space-y-5">{children}</div>}
    </div>
  )
}
