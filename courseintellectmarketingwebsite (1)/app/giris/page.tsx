"use client"
import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Mail, LockKeyhole, ShieldCheck, Loader2, Users } from "lucide-react"
import { SceneImage } from "@/components/site/product-story"
import { useUserAuth } from "@/context/user-auth-context"
import type { UserRole } from "@/types/user"

const userRoles: { value: UserRole; label: string }[] = [
  { value: "teacher", label: "Öğretmen" }, { value: "student", label: "Öğrenci" },
  { value: "parent", label: "Veli" }, { value: "accountant", label: "Muhasebe" },
  { value: "administrative", label: "Personel / Bilgi İşlem" }, { value: "admin", label: "Kurum Yöneticisi" },
]
export default function LoginPage() {
  const [role, setRole] = useState<UserRole>("teacher")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { login } = useUserAuth()
  const router = useRouter()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try {
      const result = await login(email.trim(), password, role)
      if (result.success) router.push(result.mustChangePassword ? "/giris/parola" : "/indir")
      else setError(result.error || "Giriş tamamlanamadı.")
    } catch { setError("Giriş tamamlanamadı. Lütfen tekrar deneyin.") }
    finally { setBusy(false) }
  }
  return <div className="ref-login"><section className="ref-login-brand"><div><h1>Akışınıza <br /><span>geri dönün.</span></h1><p>Yönetim, eğitim ve iletişim. Birlikte.</p></div><SceneImage asset="login-device" alt="SchoolAsist tablet ve telefon ekranları; temsili demo verileri" priority /></section><section className="ref-login-form"><h2>Giriş Yap</h2><p>SchoolAsist hesabınıza giriş yapın.</p><form onSubmit={submit}>
    <div className="sa-field"><label htmlFor="login-role">Rolünüz</label><div className="ref-icon-input"><Users /><select id="login-role" value={role} onChange={event => setRole(event.target.value as UserRole)}>{userRoles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
    <div className="sa-field"><label htmlFor="login-identity">E-posta / Kullanıcı adı</label><div className="ref-icon-input"><Mail /><input id="login-identity" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" maxLength={180} placeholder={role === "admin" ? "kurum.admin" : "E-posta veya kullanıcı adı"} /></div></div>
    <div className="sa-field"><label htmlFor="login-password">Şifre</label><div className="ref-icon-input"><LockKeyhole /><input id="login-password" type={visible ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" maxLength={128} placeholder="••••••••" /><button type="button" aria-label={visible ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</button></div><Link className="ref-forgot" href="/giris/sifremi-unuttum">Şifremi unuttum?</Link></div>
    <div className="ref-security-note"><ShieldCheck /><div><strong>Güvenli erişim</strong><p>Kurum hesabınızla ve size tanımlanan rol ile giriş yapın.</p></div></div>{error && <p className="sa-error" role="alert">{error}</p>}
    <button type="submit" className="sa-button" disabled={busy}>{busy ? <><Loader2 size={18} className="animate-spin" /> Giriş yapılıyor…</> : <>Giriş Yap <ArrowRight size={19} /></>}</button>
  </form><div className="ref-login-links"><p>Yeni kurum musunuz? <Link href="/kurum-kaydi">Ücretsiz Kurum Kaydı <ArrowRight size={17} /></Link></p><Link href="/destek">Destek için iletişime geçin <ArrowUpRight size={17} /></Link><Link href="/admin/login" className="ref-admin-link">Platform yöneticisi girişi</Link></div></section></div>
}
