"use client"
import { ReactLenis } from "lenis/react"
import { useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
export function SmoothScrollProvider({children}:{children:ReactNode}){
 const reduced=useReducedMotion();const path=usePathname()
 if(reduced||path.startsWith("/admin")||path.startsWith("/kurum-kaydi")||path.startsWith("/giris")||path.startsWith("/auth"))return <>{children}</>
 return <ReactLenis root options={{autoRaf:true,lerp:.1,smoothWheel:true,syncTouch:false,anchors:true}}>{children}</ReactLenis>
}
