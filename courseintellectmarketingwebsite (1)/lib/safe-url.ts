/**
 * Yönetim panelinden düzenlenen site içeriğindeki bağlantıları güvenli hale getirir.
 * Yalnız site içi yollar ("/...", "#..."), http(s), mailto ve tel kabul edilir;
 * `javascript:`, `data:`, `vbscript:` ve protokol-göreli ("//evil.com") adresler "#" olur.
 * İçerik herkese açık sayfalarda bağlantı olarak çizildiği için bu, kayıtlı XSS'e karşı
 * ikinci savunma hattıdır (sunucu da kayıtta aynı kuralı uygular).
 */
export function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "#"
  // Tarayıcının yok saydığı kontrol karakterleri/boşluklar ("java\tscript:") temizlenerek bakılır.
  const trimmed = value.trim()
  const compact = trimmed.replace(/[\u0000- \u007f-\u009f]/g, "")
  if (compact === "") return "#"
  if (compact.startsWith("//") || compact.startsWith("\\\\") || compact.startsWith("/\\")) return "#"
  if (compact.startsWith("/") || compact.startsWith("#") || compact.startsWith("?")) return trimmed
  const scheme = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  if (!scheme) return "#"
  return ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase()) ? trimmed : "#"
}

const URL_KEY = /(href|url|link)$/i

/** İçerik ağacında anahtarı href/url/link ile biten tüm metin alanlarını süzer (kopya döner). */
export function sanitizeContentUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sanitizeContentUrls(item)) as T
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = typeof item === "string" && URL_KEY.test(key) ? safeUrl(item) : sanitizeContentUrls(item)
    }
    return result as T
  }
  return value
}
