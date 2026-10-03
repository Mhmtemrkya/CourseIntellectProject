import Image from "next/image"

export function SupportFooterArt({ name, alt, eager = false }: { name: "support-headset" | "footer-logo"; alt: string; eager?: boolean }) {
  const root = "/images/support-footer-art/"
  return <picture><source media="(max-width: 600px)" srcSet={`${root}${name}-mobile.webp`} /><Image src={`${root}${name}.webp`} width={1536} height={1024} alt={alt} sizes="(max-width: 600px) 100vw, 50vw" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} style={{ display: "block", width: "100%", height: "auto" }} /></picture>
}
