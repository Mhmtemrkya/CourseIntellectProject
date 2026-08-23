// Sunucuda üretilen belgeleri (base64) tarayıcıda indirtir.
// PDF'i istemcide yeniden üretmeyiz: şablon tek yerde, sunucuda kalsın.
export function downloadBase64File(
  base64: string | null | undefined,
  fileName: string | null | undefined,
  mimeType = "application/pdf",
): boolean {
  if (!base64 || typeof window === "undefined") return false

  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName || "belge.pdf"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Sekme kapanmadan URL'i bırakmak sızıntı olur.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
