"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { Brand } from "@/components/site/site-shell"
import { apiRequest } from "@/lib/api-client"

const KEY="schoolasist_bootstrap_auth"
export default function PasswordPage(){
 const [auth,setAuth]=useState<{accessToken:string;refreshToken:string}|null>(null)
 const [ready,setReady]=useState(false)
 const [current,setCurrent]=useState("")
 const [password,setPassword]=useState("")
 const [confirm,setConfirm]=useState("")
 const [busy,setBusy]=useState(false)
 const [done,setDone]=useState(false)
 const [error,setError]=useState("")
 useEffect(()=>{try{const raw=sessionStorage.getItem(KEY);if(raw)setAuth(JSON.parse(raw))}catch{sessionStorage.removeItem(KEY)}setReady(true)},[])
 async function submit(e:React.FormEvent){e.preventDefault();if(!auth||busy)return;setError("");if(password!==confirm){setError("Yeni parolalar eşleşmiyor.");return}if(password===current){setError("Yeni parola geçici paroladan farklı olmalıdır.");return}setBusy(true);try{await apiRequest("/api/auth/change-password",{method:"POST",token:auth.accessToken,body:{currentPassword:current,newPassword:password}});sessionStorage.removeItem(KEY);setAuth(null);setCurrent("");setPassword("");setConfirm("");setDone(true)}catch(e){setError(e instanceof Error?e.message:"Parola değiştirilemedi.")}finally{setBusy(false)}}
 async function cancel(){if(auth)try{await apiRequest("/api/auth/logout",{method:"POST",token:auth.accessToken,body:{refreshToken:auth.refreshToken}})}catch{}sessionStorage.removeItem(KEY);setAuth(null)}
 return <main className="sa-site sa-verification"><Brand/><div className="sa-verification-panel">{done?<><CheckCircle2 size={50}/><h1>Yeni başlangıcınız hazır.</h1><p>Parolanız değiştirildi. Yeni parolanızla yeniden giriş yapın.</p><div className="sa-actions"><Link className="sa-button" href="/giris">Giriş yap</Link></div></>:auth?<><ShieldCheck size={45}/><h1>Önce, size ait bir parola.</h1><p>Geçici parolanız yalnızca ilk giriş içindir. Devam etmek için yeni bir parola oluşturun.</p><form className="sa-form-surface mt-8 text-left" onSubmit={submit}><div className="sa-field"><label htmlFor="current">Geçici parola</label><input id="current" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></div><div className="sa-field"><label htmlFor="new">Yeni parola</label><input id="new" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="sa-field"><label htmlFor="confirm">Yeni parola tekrar</label><input id="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div><p className="sa-form-help">En az 10 karakter, büyük harf, küçük harf ve rakam kullanın. Kolay tahmin edilen veya başka hesaplarda kullandığınız parolaları seçmeyin.</p>{error&&<p role="alert" className="sa-error">{error}</p>}<button className="sa-button" disabled={busy}>{busy?"Kaydediliyor…":"Parolamı değiştir"}</button></form><button className="sa-text-link mt-6" disabled={busy} onClick={cancel}>Oturumu kapat</button></>:<><ShieldCheck size={45}/><h1>{ready?"Önce giriş yapın.":"Hazırlanıyor…"}</h1><p>Geçici parolanızla giriş yaptıktan sonra bu adımı tamamlayabilirsiniz.</p><div className="sa-actions"><Link className="sa-button" href="/giris">Giriş yap</Link></div></>}</div></main>
}
