"use client"

import { Check, Loader2, AlertCircle } from "lucide-react"

interface SaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error"
  lastSaved?: Date
}

export function SaveIndicator({ status, lastSaved }: SaveIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "saving" && (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Kaydediliyor...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">
            Kaydedildi
            {lastSaved && (
              <span className="ml-1">
                ({lastSaved.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })})
              </span>
            )}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-destructive">Kaydetme hatası</span>
        </>
      )}
    </div>
  )
}
