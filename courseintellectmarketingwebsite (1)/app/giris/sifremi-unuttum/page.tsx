"use client"
import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { Brand } from "@/components/site/site-shell"
import { apiRequest } from "@/lib/api-client"
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState("")
 const [sent,setSent]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");try{await apiRequest("/api/auth/forgot-password",{method:"POST",token:null,body:{email:email.trim()}});setEmail("");setSent(true)}catch(e){setError(e instanceof Error?e.message:"Talep iletilemedi.")}finally{setBusy(false)}}
 return <main className="sa-site sa-verification"><Brand/><div className="sa-verification-panel">{sent?<><CheckCircle2 size={48}/><h1>Talebinizi aldık.</h1><p>E-posta adresiniz sistemde kayıtlıysa parola sıfırlama talebiniz kurum yetkililerine iletildi. Güvenliğiniz için hesap bilgilerini burada paylaşmıyoruz.</p><div className="sa-actions"><Link href="/giris" className="sa-button">Girişe dön</Link><Link href="/destek" className="sa-text-link">Destek</Link></div></>:<><ShieldCheck size={45}/><h1>Yeniden erişim.</h1><p>Hesabınıza bağlı e-posta adresini girin. Talebiniz kurum yetkilileri tarafından incelenecek.</p><form onSubmit={submit} className="sa-form-surface mt-8 text-left"><label htmlFor="email">E-posta adresi</label><input id="email" type="email" autoComplete="email" maxLength={180} required value={email} onChange={e=>setEmail(e.target.value)}/>{error&&<p className="sa-error" role="alert">{error}</p>}<button className="sa-button" disabled={busy}>{busy?"Gönderiliyor…":"Talebi gönder"}</button></form><div className="sa-actions"><Link href="/giris" className="sa-text-link">Girişe dön</Link></div></>}</div></main>
}
