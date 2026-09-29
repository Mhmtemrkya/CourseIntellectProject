// Ücretli paket akışı (paket limitleri, paket yükseltme) açık mı?
// Varsayılan KAPALI: şu an kaydolan her kurum platformu ücretsiz kullanır.
// Akış silinmedi, yalnız gizlendi; geri açmak için derlemede
// REACT_APP_BILLING_ENABLED=true verin ve backend'de "Billing:Enabled" = true yapın.
export const billingEnabled = process.env.REACT_APP_BILLING_ENABLED === 'true';
