"use client"

import type React from "react"

import { useState } from "react"
import {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  FileText,
  MessageSquare,
  Settings,
  Shield,
  Zap,
  Award,
  Target,
  Lightbulb,
  Rocket,
  Heart,
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  Gift,
  Headphones,
  Globe,
  Smartphone,
  Monitor,
  Cloud,
  Lock,
  Key,
  Search,
  X,
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  FileText,
  MessageSquare,
  Settings,
  Shield,
  Zap,
  Award,
  Target,
  Lightbulb,
  Rocket,
  Heart,
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  Gift,
  Headphones,
  Globe,
  Smartphone,
  Monitor,
  Cloud,
  Lock,
  Key,
}

interface IconPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function IconPicker({ label, value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredIcons = Object.keys(iconMap).filter((name) => name.toLowerCase().includes(search.toLowerCase()))

  const SelectedIcon = iconMap[value] || BookOpen

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 px-3 py-2.5 border border-border rounded-lg hover:border-muted-foreground/50 transition-colors"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <SelectedIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-foreground">{value || "İkon seçin"}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İkon ara..."
                  className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {filteredIcons.map((name) => {
                  const Icon = iconMap[name]
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange(name)
                        setIsOpen(false)
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        value === name ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                      title={name}
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
