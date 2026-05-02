import type React from "react"
import { PublicLayout } from "@/components/layout/public-layout"
import { UserAuthProvider } from "@/context/user-auth-context"
import { MaintenanceGate } from "@/components/system/maintenance-gate"

export default function PublicRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserAuthProvider>
      <MaintenanceGate>
        <PublicLayout>{children}</PublicLayout>
      </MaintenanceGate>
    </UserAuthProvider>
  )
}
