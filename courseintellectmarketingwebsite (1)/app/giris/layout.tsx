import type React from "react"
import type { Metadata } from "next"
import { UserAuthProvider } from "@/context/user-auth-context"
import { PublicLayout } from "@/components/layout/public-layout"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <UserAuthProvider><PublicLayout className="ref-account-site">{children}</PublicLayout></UserAuthProvider>
}
