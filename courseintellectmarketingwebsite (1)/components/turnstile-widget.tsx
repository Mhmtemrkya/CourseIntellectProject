"use client"

import { useEffect, useRef } from "react"

/**
 * Cloudflare Turnstile widget'ı.
 *
 * Site anahtarı tanımlı değilse (lokal geliştirme) widget hiç render edilmez ve
 * `turnstileEnabled` false döner. Üretimde anahtar zorunludur: backend
 * `Captcha:Secret` olmadan kayıt isteğini reddeder (fail-closed).
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

export const turnstileEnabled = SITE_KEY.length > 0

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("turnstile-load-failed")))
      return
    }
    const script = document.createElement("script")
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("turnstile-load-failed"))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export type TurnstileWidgetProps = {
  /** Token alındığında dolu, süresi dolduğunda/hata olduğunda null döner. */
  onToken: (token: string | null) => void
  /** Yükleme başarısızsa çağrılır; form kullanıcıya durumu söyleyebilsin diye. */
  onError?: () => void
  language?: string
  /** Sıfırlama tetikleyicisi: değeri değişince widget yenilenir. */
  resetKey?: number
}

export function TurnstileWidget({ onToken, onError, language, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)

  onTokenRef.current = onToken
  onErrorRef.current = onError

  useEffect(() => {
    if (!turnstileEnabled) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          language: language === "en" ? "en" : "tr",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
          "error-callback": () => {
            onTokenRef.current(null)
            onErrorRef.current?.()
          },
        })
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.()
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // widget zaten kaldırılmış olabilir
        }
        widgetIdRef.current = null
      }
    }
  }, [language])

  useEffect(() => {
    if (!resetKey || !widgetIdRef.current || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
    onTokenRef.current(null)
  }, [resetKey])

  if (!turnstileEnabled) return null

  return <div ref={containerRef} className="flex justify-center" />
}
