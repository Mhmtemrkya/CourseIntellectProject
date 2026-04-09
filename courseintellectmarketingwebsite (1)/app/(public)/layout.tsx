import type React from "react"
import { PublicLayout } from "@/components/layout/public-layout"
import { UserAuthProvider } from "@/context/user-auth-context"

export default function PublicRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserAuthProvider>
      <PublicLayout>{children}</PublicLayout>
    </UserAuthProvider>
  )
}
