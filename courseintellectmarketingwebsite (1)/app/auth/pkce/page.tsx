"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE_URL } from "@/lib/api-client"

const ALLOWED_CLIENTS = new Set(["mobile", "desktop"])
const ALLOWED_REDIRECT_URIS = new Set(["courseintellect://callback"])

type PkceParams = {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
}

function validateParams(searchParams: URLSearchParams): { ok: true; params: PkceParams } | { ok: false; error: string } {
  const clientId = searchParams.get("client_id") ?? ""
  const redirectUri = searchParams.get("redirect_uri") ?? ""
  const codeChallenge = searchParams.get("code_challenge") ?? ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "S256"
  const responseType = searchParams.get("response_type") ?? "code"

  if (!clientId || !redirectUri || !codeChallenge) {
    return { ok: false, error: "Eksik PKCE parametreleri." }
  }
  if (!ALLOWED_CLIENTS.has(clientId)) {
    return { ok: false, error: "Tanınmayan istemci." }
  }
  if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
    return { ok: false, error: "Yetkisiz yönlendirme adresi." }
  }
  if (codeChallengeMethod !== "S256") {
    return { ok: false, error: "Desteklenmeyen code_challenge_method." }
  }
  if (responseType !== "code") {
    return { ok: false, error: "Desteklenmeyen response_type." }
  }

  return { ok: true, params: { clientId, redirectUri, codeChallenge, codeChallengeMethod } }
}

function PkcePageInner() {
  const searchParams = useSearchParams()
  const validation = useMemo(() => validateParams(searchParams), [searchParams])

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!validation.ok) setError(validation.error)
  }, [validation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validation.ok) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/pkce/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          clientId: validation.params.clientId,
          redirectUri: validation.params.redirectUri,
          codeChallenge: validation.params.codeChallenge,
          codeChallengeMethod: validation.params.codeChallengeMethod,
        }),
      })

      if (response.status === 401) {
        setError("Kullanıcı adı veya şifre hatalı.")
        return
      }
      if (!response.ok) {
        setError(`Giriş başarısız (${response.status}).`)
        return
      }

      const body = (await response.json()) as { code: string; redirectUri: string }
      if (!body.code || !body.redirectUri) {
        setError("Sunucudan eksik yanıt alındı.")
        return
      }

      const target = new URL(body.redirectUri)
      target.searchParams.set("code", body.code)
      window.location.href = target.toString()
    } catch {
      setError("Sunucuya ulaşılamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  const blocked = !validation.ok

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="CourseIntellect" width={40} height={40} />
            <span className="text-xl font-bold">
              Course<span className="text-accent">Intellect</span>
            </span>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle>Uygulama Girişi</CardTitle>
            </div>
            <CardDescription>
              CourseIntellect uygulaması adına güvenli giriş yapmak için hesap bilgilerini gir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={blocked || isLoading}
                  placeholder="kurum.admin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={blocked || isLoading}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={blocked || isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button type="submit" className="w-full" disabled={blocked || isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giriş Yap ve Uygulamaya Dön"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Giriş başarılı olduğunda uygulamaya otomatik olarak geri döndürüleceksin.
        </p>
      </div>
    </div>
  )
}

export default function PkceAuthorizePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
      <PkcePageInner />
    </Suspense>
  )
}
