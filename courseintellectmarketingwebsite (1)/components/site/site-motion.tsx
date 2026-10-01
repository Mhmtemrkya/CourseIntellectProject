"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useReducedMotion } from "framer-motion"

// Observe actual sections once, rather than running timers or hiding server
// content. This also works when JavaScript or motion is disabled.
export function SiteMotion() {
  const path = usePathname()
  const reduced = useReducedMotion()
  const sentinel = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reduced) return
    const root = sentinel.current?.closest(".sa-site")
    if (!root) return
    const animations = new Set<Animation>()
    const reveal = (element: Element, delay = 0) => {
      // Web Animations does not mutate React-owned attributes. A streamed page
      // can still be hydrating when its enclosing layout effect starts.
      const animation = element.animate([{ opacity: .65, transform: "translateY(20px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 700, delay, easing: "cubic-bezier(.22,1,.36,1)" })
      animations.add(animation)
      animation.onfinish = () => animations.delete(animation)
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const heading = entry.target.querySelector("h2,h3")
        if (entry.target.matches(".sa-capability-groups>article")) reveal(entry.target)
        else if (heading) reveal(heading)
        entry.target.querySelectorAll(".ref-role-cards>a,.ref-student-steps>div,.ref-download-grid>article,.ref-progress-track>div,.ref-finance-table").forEach((node, i) => reveal(node, Math.min(i, 3) * 90))
        entry.target.querySelectorAll(".scene-chart").forEach(node => {
          const animation = node.animate([{ strokeDasharray: "900", strokeDashoffset: "900" }, { strokeDasharray: "900", strokeDashoffset: "0" }], { duration: 1400, easing: "cubic-bezier(.22,1,.36,1)" })
          animations.add(animation)
          animation.onfinish = () => animations.delete(animation)
        })
        observer.unobserve(entry.target)
      })
    }, { threshold: .12 })
    const frame = requestAnimationFrame(() => {
      root.querySelectorAll(".ref-section-heading, .ref-light-showcase, .ref-home-ecosystem, .ref-cta, .ref-role-directory, .ref-download, .ref-service-content>aside, .ref-service-form, .ref-status-content, .ref-legal-layout article>section, .sa-capability-groups>article").forEach(node => {
        observer.observe(node)
      })
    })
    return () => { cancelAnimationFrame(frame); observer.disconnect(); animations.forEach(animation => animation.cancel()) }
  }, [path, reduced])
  return <span ref={sentinel} hidden />
}
