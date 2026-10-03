"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/** Static exports retain old bookmarked URLs without rendering a web sign-in form. */
export function AppAccessRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/indir") }, [router])
  return <section className="sa-verification"><div className="sa-verification-panel"><h1>Hesabınıza uygulamadan erişin.</h1><p>SchoolAsist’e masaüstü veya mobil uygulamanızdan giriş yapabilirsiniz.</p><Link className="sa-button" href="/indir">Masaüstü ve mobil uygulamalar</Link></div></section>
}
