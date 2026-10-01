"use client"
import type { ReactNode } from "react"
// Navigation renders immediately. Section reveals provide motion without a simulated loading delay.
export function PageTransitionProvider({children}:{children:ReactNode}){return <>{children}</>}
