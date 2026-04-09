import type React from "react"
import { UserAuthProvider } from "@/context/user-auth-context"

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <UserAuthProvider>{children}</UserAuthProvider>
}
