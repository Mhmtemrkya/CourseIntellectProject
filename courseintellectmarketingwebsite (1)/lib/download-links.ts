// İndirme bağlantıları yönetim panelinden (CMS) düzenlenebilir. Ele geçirilmiş ya da
// yanlış girilmiş bir içerik ziyaretçiyi başka bir dosyaya/siteye yönlendirmesin diye
// yalnız resmî mağazalara ve kendi GitHub sürümlerimize giden https bağlantıları kabul edilir.
const ALLOWED_DOWNLOADS: ReadonlyArray<{ host: string; pathPrefix: string }> = [
  { host: "apps.apple.com", pathPrefix: "/" },
  { host: "play.google.com", pathPrefix: "/store/apps/details" },
  { host: "github.com", pathPrefix: "/Mhmtemrkya/CourseIntellectProject/releases/" },
]

export function safeDownloadUrl(value?: string): string | null {
  if (!value) return null
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null
  const allowed = ALLOWED_DOWNLOADS.some(rule => url.hostname === rule.host && url.pathname.startsWith(rule.pathPrefix))
  return allowed ? url.href : null
}

export const downloadActionLabel: Record<string, string> = {
  ios: "App Store'dan indir",
  android: "Google Play'den indir",
  macos: "Mac App Store'dan indir",
  windows: "Windows için indir (.exe)",
}
