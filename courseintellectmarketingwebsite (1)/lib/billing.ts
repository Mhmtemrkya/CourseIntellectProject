/**
 * Ücretli paket akışı (plan seçimi, fiyatlar ve satın alma) açık mı?
 *
 * Varsayılan KAPALI: şu an kaydolan her kurum platformu ücretsiz kullanır.
 * Akış silinmedi, yalnız gizlendi; geri açmak için derlemede
 * NEXT_PUBLIC_BILLING_ENABLED=true verin ve backend'de "Billing:Enabled" = true yapın.
 */
export const billingEnabled = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true"

/** Ücretsiz dönemde menü/alt bilgide gösterilmeyen ücretli akış sayfaları. */
export const billingOnlyPaths = ["/fiyatlar", "/satin-alma"]

export function isHiddenBillingPath(href: string) {
  return !billingEnabled && billingOnlyPaths.some((path) => href === path || href.startsWith(`${path}/`) || href.startsWith(`${path}?`))
}
