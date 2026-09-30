import type React from "react"
import type { Metadata } from "next"
import { UserAuthProvider } from "@/context/user-auth-context"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <UserAuthProvider>{children}</UserAuthProvider>
}
