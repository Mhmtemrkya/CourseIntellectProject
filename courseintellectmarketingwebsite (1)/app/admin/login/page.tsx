"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShieldCheck, Eye, EyeOff, ArrowRight, KeyRound, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth, type AdminChallenge } from "@/context/auth-context"

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, verifyLogin, finishLogin, isAuthenticated, isLoading: authLoading } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [challenge, setChallenge] = useState<AdminChallenge | null>(null)
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isAuthenticated && !authLoading) router.replace("/admin")
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (!challenge) return
    const expire = window.setTimeout(() => {
      setChallenge(null)
      setCode("")
      setError("Doğrulama süresi doldu. Kullanıcı adı ve şifrenizle yeniden başlayın.")
    }, Math.max(0, Date.parse(challenge.expiresAtUtc) - Date.now()))
    return () => window.clearTimeout(expire)
  }, [challenge])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setError("")
    try {
      if (!challenge) {
        const result = await login(username, password)
        if (result.challenge) {
          setChallenge(result.challenge)
          setPassword("")
          setShowPassword(false)
        } else setError(result.error || "Giriş tamamlanamadı.")
      } else {
        const result = await verifyLogin(challenge.challengeToken, code)
        setCode("")
        if (!result.session) setError(result.error || "Doğrulama tamamlanamadı.")
        else {
          finishLogin(result.session)
          router.replace("/admin")
        }
      }
    } finally { setIsLoading(false) }
  }

  if (authLoading) return <div className="min-h-screen grid place-items-center bg-background" role="status">Yönetim oturumu kontrol ediliyor…</div>

  const title = challenge ? "E-postanızdaki güvenlik kodu" : "Platform yönetimi"

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#f5f6fa] text-[#101d3b]">
      <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-20 bg-[#101d3b] text-white relative overflow-hidden">
        <div aria-hidden="true" className="absolute w-[500px] h-[500px] rounded-full bg-orange-500/10 -bottom-40 -left-40 blur-3xl" />
        <div className="flex items-center gap-3 relative"><Image src="/images/logo.png" alt="SchoolAsist logosu" width={52} height={52} /><span className="text-2xl font-semibold tracking-tight">SchoolAsist</span></div>
        <div className="relative max-w-lg py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"><ShieldCheck size={18} /> Yetkili yönetim alanı</span>
          <h1 className="mt-8 text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.08]">Platformun kontrolü.<br /><span className="text-orange-400">Güvenli erişim.</span></h1>
          <p className="mt-6 text-lg text-white/65 leading-relaxed">Kurum başvuruları, erişim yetkileri ve platform işlemleri tek bir yönetim alanında.</p>
          <ol className="mt-10 space-y-4 text-sm text-white/75">
            <li className="flex items-center gap-3"><ShieldCheck className="text-orange-400" size={18} /> Yetkilendirilmiş iki yönetici hesabı</li>
            <li className="flex items-center gap-3"><KeyRound className="text-orange-400" size={18} /> Yönetici hesabı ve şifre</li>
            <li className="flex items-center gap-3"><ShieldCheck className="text-orange-400" size={18} /> E-postayla tek kullanımlık kod</li>
          </ol>
        </div>
        <p className="relative text-xs text-white/45">Yalnızca yetkilendirilmiş platform yöneticileri için.</p>
      </aside>
      <main className="flex items-center justify-center p-5 sm:p-10 lg:p-12">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden flex items-center gap-3 mb-10"><Image src="/images/logo.png" alt="SchoolAsist logosu" width={44} height={44} /><span className="text-xl font-semibold">SchoolAsist</span></div>
          <div className="mb-8"><div className="w-12 h-12 grid place-items-center rounded-2xl bg-white shadow-sm mb-5"><ShieldCheck className="text-orange-500" /></div><h2 className="text-3xl font-semibold tracking-tight">{title}</h2><p className="text-sm text-slate-500 mt-3 leading-relaxed">{challenge ? `${challenge.emailHint} adresine gönderdiğimiz 6 haneli kodu girin.` : "Yönetici e-postanız ve şifrenizle başlayın. Panel, e-posta kodunu doğruladıktan sonra açılır."}</p></div>
          {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!challenge ? <>
                <div className="space-y-2"><Label htmlFor="username">Yönetici e-posta adresi</Label><Input id="username" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} required className="bg-white h-12" /></div>
                <div className="space-y-2"><Label htmlFor="password">Şifre</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} required className="bg-white h-12 pr-12" /><button type="button" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
              </> : <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-3"><Mail className="text-orange-500 shrink-0" size={22} /><p className="text-sm text-slate-600 leading-relaxed">Kod 5 dakika geçerlidir. E-postayı göremiyorsanız gereksiz posta klasörünü de kontrol edin.</p></div>
                <div className="space-y-2"><Label htmlFor="security-code">E-posta doğrulama kodu</Label><Input id="security-code" autoFocus autoComplete="one-time-code" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} disabled={isLoading} required className="bg-white h-14 text-lg tracking-widest" /></div>
              </>}
              <Button type="submit" disabled={isLoading} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white">{isLoading ? "Kontrol ediliyor…" : challenge ? "Kodu doğrula" : "Güvenli girişe devam et"}<ArrowRight className="ml-2" size={16} /></Button>
              {challenge && <button type="button" disabled={isLoading} onClick={() => { setChallenge(null); setCode(""); setError("") }} className="text-sm text-slate-600 underline underline-offset-4">Yeniden başla</button>}
            </form>
          <p className="mt-8 text-xs text-slate-500 leading-relaxed">Bu alan kurum kullanıcılarının giriş ekranı değildir. Yönetici oturumu bu tarayıcı oturumunda tutulur; 15 dakika işlem yapılmazsa kapatılır.</p>
        </div>
      </main>
    </div>
  )
}
