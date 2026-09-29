"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Ücretsiz dönemde fiyat/satın alma sayfalarına gelen ziyaretçiyi (eski
 * bağlantı, yer imi) kurum kaydına yönlendirir. Site statik dışa aktarıldığı
 * için yönlendirme istemci tarafında yapılır.
 */
export function BillingDisabledRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/kurum-kaydi")
  }, [router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center pt-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Yönlendiriliyor" />
    </div>
  )
}
